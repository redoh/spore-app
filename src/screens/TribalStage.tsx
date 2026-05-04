import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import { useGame } from '../game/store';
import {
  createTribalWorld,
  stepTribalWorld,
  tribalDeclareWar,
  tribalGift,
  type Member,
  type TribalWorld,
} from '../game/tribal-world';
import MiniMap from '../components/MiniMap';

const FIXED_DT = 1 / 60;
const PALETTE = {
  ground: '#3a2a16',
  groundDark: '#2a1d0e',
  player: '#6cf0d3',
  playerLeg: '#2c8a76',
  rival: '#c87a4d',
  rivalLeg: '#7a3e1f',
  wild: '#b3a370',
  wildLeg: '#5e542f',
  hutWall: '#7a5028',
  hutRoof: '#3a2a16',
  fire: '#ffae3d',
  fruit: '#e8634a',
  meat: '#a73a30',
};

export default function TribalStage() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const reportRunEnd = useGame((s) => s.reportRunEnd);
  const reportStageReached = useGame((s) => s.reportStageReached);
  const addDna = useGame((s) => s.addDna);
  const status = useGame((s) => s.status);

  const worldRef = useRef<TribalWorld>(createTribalWorld());
  const inputRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);
  // Drag indicator (origin + current) so user sees where they're "pulling".
  const [drag, setDrag] = useState<{
    ox: number;
    oy: number;
    cx: number;
    cy: number;
  } | null>(null);

  // Game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      acc += dt;
      const w = worldRef.current;
      const paused = status !== 'playing';
      if (!paused) {
        while (acc >= FIXED_DT) {
          const r = stepTribalWorld(w, { move: inputRef.current }, FIXED_DT);
          acc -= FIXED_DT;
          if (r.foodGained > 0) addDna(r.foodGained);
          if (r.damageTaken > 6) {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
          }
          if (r.rivalJustDefeated) {
            try {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch {}
          }
          if (r.died) {
            reportRunEnd(w.player.radius);
            setStatus('gameover');
            try {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
            } catch {}
            break;
          }
        }
      } else {
        acc = 0;
      }
      setTick((x) => (x + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [addDna, reportRunEnd, setStatus, status]);

  const w = worldRef.current;
  const t = tick / 60;

  const camX = Math.max(0, Math.min(w.width - width, w.player.pos.x - width / 2));
  const camY = Math.max(
    0,
    Math.min(w.height - height, w.player.pos.y - height / 2),
  );

  const onTouchStart = (e: GestureResponderEvent) => {
    const tt = e.nativeEvent.touches[0];
    lastTouchRef.current = { x: tt.pageX, y: tt.pageY };
    inputRef.current = { x: 0, y: 0 };
    setDrag({ ox: tt.pageX, oy: tt.pageY, cx: tt.pageX, cy: tt.pageY });
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    const tt = e.nativeEvent.touches[0];
    if (!lastTouchRef.current) {
      lastTouchRef.current = { x: tt.pageX, y: tt.pageY };
      return;
    }
    const dx = tt.pageX - lastTouchRef.current.x;
    const dy = tt.pageY - lastTouchRef.current.y;
    // Smaller threshold so a short flick already gives full speed.
    const max = 55;
    const mag = Math.hypot(dx, dy);
    const m = Math.min(1, mag / max);
    if (mag > 0.01) {
      inputRef.current = {
        x: (dx / mag) * m,
        y: (dy / mag) * m,
      };
    } else inputRef.current = { x: 0, y: 0 };
    setDrag((prev) =>
      prev
        ? { ...prev, cx: tt.pageX, cy: tt.pageY }
        : { ox: tt.pageX, oy: tt.pageY, cx: tt.pageX, cy: tt.pageY },
    );
  };
  const onTouchEnd = () => {
    inputRef.current = { x: 0, y: 0 };
    lastTouchRef.current = null;
    setDrag(null);
  };

  // Static decor: rocks
  const rocks = useMemo(() => {
    const arr: { x: number; y: number; r: number }[] = [];
    let seed = 4242;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 50; i++) {
      arr.push({
        x: rand() * w.width,
        y: rand() * w.height,
        r: 14 + rand() * 22,
      });
    }
    return arr;
  }, [w.width, w.height]);

  // Determine which UI button is active
  const rivalHut = w.huts.find((h) => h.tribe === 'rival');
  const nearRival =
    !!rivalHut &&
    Math.hypot(w.player.pos.x - rivalHut.pos.x, w.player.pos.y - rivalHut.pos.y) <
      220;

  const goCivilization = () => {
    reportStageReached('civilization');
    reportRunEnd(w.player.radius);
    setStage('civilization');
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  return (
    <View
      style={styles.root}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderStart={onTouchStart}
      onResponderMove={onTouchMove}
      onResponderRelease={onTouchEnd}
      onResponderTerminate={onTouchEnd}
    >
      <Canvas style={{ flex: 1, width, height, backgroundColor: PALETTE.ground }}>
        {groundPatches(w.width, w.height, camX, camY, width, height)}

        {/* rocks */}
        {rocks.map((r, i) => {
          const x = r.x - camX;
          const y = r.y - camY;
          if (x < -r.r || y < -r.r || x > width + r.r || y > height + r.r)
            return null;
          return (
            <React.Fragment key={`rk-${i}`}>
              <Circle cx={x + 2} cy={y + 3} r={r.r} color="#000" opacity={0.25} />
              <Circle cx={x} cy={y} r={r.r} color="#3a3d52" />
              <Circle cx={x - r.r * 0.3} cy={y - r.r * 0.3} r={r.r * 0.55} color="#1f2238" opacity={0.5} />
            </React.Fragment>
          );
        })}

        {/* huts */}
        {w.huts.map((h) => renderHut(h, camX, camY, width, height, t))}

        {/* resources */}
        {w.resources.map((r) => {
          const x = r.pos.x - camX;
          const y = r.pos.y - camY;
          if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return null;
          if (r.kind === 'fruit') {
            return (
              <React.Fragment key={`r-${r.id}`}>
                <Circle cx={x} cy={y + 2} r={6} color="#000" opacity={0.3} />
                <Circle cx={x} cy={y} r={6} color={PALETTE.fruit} />
                <Circle cx={x - 2} cy={y - 2} r={2} color="#ffb3a3" opacity={0.7} />
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={`r-${r.id}`}>
              <Circle cx={x} cy={y + 2} r={7} color="#000" opacity={0.3} />
              <Circle cx={x} cy={y} r={7} color={PALETTE.meat} />
              <Circle cx={x - 2} cy={y - 2} r={2} color="#e6776a" opacity={0.7} />
            </React.Fragment>
          );
        })}

        {/* members */}
        {w.members.map((m) => renderMember(m, camX, camY, width, height, t))}

        {/* particles */}
        {w.particles.map((p) => (
          <Circle
            key={'pp' + p.id}
            cx={p.pos.x - camX}
            cy={p.pos.y - camY}
            r={p.radius * (p.life / p.maxLife)}
            color={p.color}
            opacity={Math.max(0, p.life / p.maxLife)}
          />
        ))}

        {/* Drag indicator: origin ring + line + cursor */}
        {drag ? (
          <>
            <Circle cx={drag.ox} cy={drag.oy} r={28} color="#ffffff" opacity={0.12} />
            <Circle cx={drag.ox} cy={drag.oy} r={18} color="#ffffff" opacity={0.18} />
            {(() => {
              const dx = drag.cx - drag.ox;
              const dy = drag.cy - drag.oy;
              const mag = Math.hypot(dx, dy);
              if (mag < 4) return null;
              const steps = Math.min(8, Math.ceil(mag / 14));
              const els: React.ReactElement[] = [];
              for (let i = 1; i <= steps; i++) {
                const f = i / (steps + 1);
                els.push(
                  <Circle
                    key={`drag-l-${i}`}
                    cx={drag.ox + dx * f}
                    cy={drag.oy + dy * f}
                    r={2}
                    color="#ffffff"
                    opacity={0.4}
                  />,
                );
              }
              els.push(
                <Circle
                  key="drag-cur"
                  cx={drag.cx}
                  cy={drag.cy}
                  r={10}
                  color={theme.colors.accent}
                  opacity={0.85}
                />,
              );
              return <>{els}</>;
            })()}
          </>
        ) : null}
      </Canvas>

      {/* HUD top */}
      <View style={[styles.hud, { top: insets.top + 12 }]} pointerEvents="none">
        <View style={styles.hudRow}>
          <Stat
            label="CAN"
            value={`${Math.max(0, Math.floor(w.player.hp))}/${w.player.maxHp}`}
            color={theme.colors.accent}
          />
          <Stat label="YİYECEK" value={String(w.food)} color={theme.colors.warning} />
          <Stat
            label="DOSTLUK"
            value={`${Math.floor(w.friendship)}%`}
            color={theme.colors.dna}
          />
          <Stat
            label="RAKİP"
            value={
              w.rivalAllied
                ? 'Müttefik'
                : w.rivalDefeated
                  ? 'Yenildi'
                  : w.rivalHostility > 0.5
                    ? 'Düşman'
                    : 'Tarafsız'
            }
            color={
              w.rivalAllied
                ? theme.colors.accent
                : w.rivalDefeated
                  ? theme.colors.danger
                  : w.rivalHostility > 0.5
                    ? theme.colors.danger
                    : theme.colors.textDim
            }
          />
        </View>
      </View>

      {/* Pause */}
      <TouchableOpacity
        onPress={() => {
          setStatus('menu');
          reportRunEnd(w.player.radius);
        }}
        style={[styles.pauseBtn, { top: insets.top + 14 }]}
        activeOpacity={0.7}
      >
        <Text style={styles.pauseTxt}>×</Text>
      </TouchableOpacity>

      <MiniMap
        worldWidth={w.width}
        worldHeight={w.height}
        cam={{ x: camX, y: camY, w: width, h: height }}
        player={{ x: w.player.pos.x, y: w.player.pos.y, color: theme.colors.accent }}
        dots={[
          // Resources first (bottom layer)
          ...w.resources.map((r) => ({
            x: r.pos.x,
            y: r.pos.y,
            color: r.kind === 'fruit' ? '#e8634a' : '#a73a30',
            r: 0.8,
          })),
          // Huts as bigger markers
          ...w.huts.map((h) => ({
            x: h.pos.x,
            y: h.pos.y,
            color: h.tribe === 'player' ? '#6cf0d3' : '#e3826a',
            r: 4,
            opacity: 0.95,
          })),
          // Members
          ...w.members
            .filter((m) => m.hp > 0 && m !== w.player)
            .map((m) => ({
              x: m.pos.x,
              y: m.pos.y,
              color:
                m.tribe === 'player'
                  ? '#6cf0d3'
                  : m.tribe === 'rival'
                    ? '#e3826a'
                    : '#b3a370',
              r: 1.6,
            })),
        ]}
        top={insets.top + 64}
        right={14}
      />

      {/* Debug shortcuts */}
      <View style={[styles.debugRow, { top: insets.top + 60 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.debugBtn}
          onPress={() => {
            w.food += 20;
            w.player.hp = w.player.maxHp;
          }}
        >
          <Text style={styles.debugTxt}>+20 yiyecek</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.debugBtn}
          onPress={() => {
            w.friendship = Math.min(100, w.friendship + 25);
            w.rivalHostility = Math.max(0, w.rivalHostility - 0.25);
            if (w.friendship >= 100) w.rivalAllied = true;
          }}
        >
          <Text style={styles.debugTxt}>+25 dostluk</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.debugBtn}
          onPress={() => {
            // Insta-defeat rival
            for (const m of w.members) if (m.tribe === 'rival') m.hp = 0;
            const h = w.huts.find((x) => x.tribe === 'rival');
            if (h) h.hp = 0;
            w.rivalDefeated = true;
          }}
        >
          <Text style={styles.debugTxt}>rakibi yen</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={[styles.actions, { bottom: insets.bottom + 24 }]}>
        {w.rivalDefeated || w.rivalAllied ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.civBtn}
            onPress={goCivilization}
          >
            <Text style={styles.civTxt}>MEDENİYET KUR</Text>
            <Text style={styles.civSub}>
              {w.rivalAllied ? 'İttifak kuruldu' : 'Rakibi yendin'}
            </Text>
          </TouchableOpacity>
        ) : nearRival ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.actionBtn, w.food < 5 && styles.actionDisabled]}
              onPress={() => {
                if (tribalGift(w)) {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }
              }}
            >
              <Text style={styles.actionTxt}>HEDİYE</Text>
              <Text style={styles.actionSub}>5 yiyecek · +12 dostluk</Text>
            </TouchableOpacity>
            {w.rivalHostility < 0.5 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.actionBtn, styles.warBtn]}
                onPress={() => {
                  tribalDeclareWar(w);
                  try {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Warning,
                    );
                  } catch {}
                }}
              >
                <Text style={[styles.actionTxt, { color: theme.colors.danger }]}>SAVAŞ AÇ</Text>
                <Text style={styles.actionSub}>Saldırgan ol</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <View style={styles.hint}>
            <Text style={styles.hintTxt}>
              Ortadan toplananları yiyecek yap. Rakip kulübeye yaklaşınca
              HEDİYE ya da SAVAŞ AÇ butonu çıkar.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
    </View>
  );
}

function renderMember(
  m: Member,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  t: number,
) {
  if (m.hp <= 0) return null;
  const x = m.pos.x - camX;
  const y = m.pos.y - camY;
  const r = m.radius;
  if (x < -r * 2 || y < -r * 2 || x > vw + r * 2 || y > vh + r * 2)
    return null;
  const vlen = Math.hypot(m.vel.x, m.vel.y);
  const moving = vlen > 8;
  const dir =
    vlen > 5
      ? { x: m.vel.x / vlen, y: m.vel.y / vlen }
      : { x: 0, y: -1 };
  const perp = { x: -dir.y, y: dir.x };

  let body: string;
  let leg: string;
  if (m.tribe === 'player') {
    body = PALETTE.player;
    leg = PALETTE.playerLeg;
  } else if (m.tribe === 'rival') {
    body = PALETTE.rival;
    leg = PALETTE.rivalLeg;
  } else {
    body = PALETTE.wild;
    leg = PALETTE.wildLeg;
  }

  const els: React.ReactElement[] = [];
  const k = `m${m.id}-`;

  // Walk legs
  const walkPhase = moving ? t * 8 + m.id * 0.3 : 0;
  for (let i = 0; i < 4; i++) {
    const along = ((i + 0.5) / 4 - 0.5) * r * 1.6;
    const side = i % 2 === 0 ? 1 : -1;
    const lx = x + dir.x * along + perp.x * side * (r * 0.85);
    const ly = y + dir.y * along + perp.y * side * (r * 0.85);
    const lift = moving
      ? Math.max(0, Math.sin(walkPhase + i * 1.3)) * Math.max(2, r * 0.18)
      : 0;
    const fx = lx + perp.x * side * (r * 0.45);
    const fy = ly + perp.y * side * (r * 0.45) - lift;
    els.push(<Circle key={k + 'fl' + i} cx={fx} cy={fy} r={Math.max(3, r * 0.22)} color={leg} />);
  }

  // shadow
  els.push(<Circle key={k + 'sh'} cx={x} cy={y + r * 0.7} r={r * 0.95} color="#000" opacity={0.3} />);

  // body + belly
  els.push(<Circle key={k + 'b'} cx={x} cy={y} r={r} color={body} />);
  els.push(<Circle key={k + 'be'} cx={x} cy={y + r * 0.25} r={r * 0.78} color="rgba(0,0,0,0.25)" opacity={0.7} />);

  // head
  const hx = x + dir.x * r * 0.85;
  const hy = y + dir.y * r * 0.85;
  els.push(<Circle key={k + 'h'} cx={hx} cy={hy} r={r * 0.55} color={body} />);

  // eye
  const ex = hx + dir.x * r * 0.18;
  const ey = hy + dir.y * r * 0.18;
  els.push(<Circle key={k + 'ew'} cx={ex} cy={ey} r={r * 0.22} color="#f0fff8" />);
  els.push(<Circle key={k + 'ep'} cx={ex + dir.x * r * 0.06} cy={ey + dir.y * r * 0.06} r={r * 0.12} color="#0a0410" />);

  // chief crest (small spike on top of head)
  if (m.isChief) {
    els.push(
      <Circle
        key={k + 'cr'}
        cx={hx - dir.x * r * 0.1 - perp.x * r * 0.5}
        cy={hy - dir.y * r * 0.1 - perp.y * r * 0.5}
        r={r * 0.16}
        color={m.tribe === 'player' ? theme.colors.warning : theme.colors.danger}
      />,
    );
  }

  // spear (chief or player members carry one, pointing forward)
  if (m.tribe !== 'wild') {
    const sx = x + dir.x * r * 0.7 + perp.x * r * 0.7;
    const sy = y + dir.y * r * 0.7 + perp.y * r * 0.7;
    for (let s = 0; s < 6; s++) {
      els.push(
        <Circle
          key={k + 'sp' + s}
          cx={sx + dir.x * s * 4}
          cy={sy + dir.y * s * 4 - 6}
          r={1.6}
          color="#7a5028"
        />,
      );
    }
    els.push(
      <Circle
        key={k + 'spt'}
        cx={sx + dir.x * 6 * 4}
        cy={sy + dir.y * 6 * 4 - 6}
        r={2.4}
        color="#cccccc"
      />,
    );
  }

  // HP bar above head if damaged
  if (m.hp < m.maxHp) {
    const w = r * 1.6;
    const bx = x - w / 2;
    const by = y - r - 14;
    const hpPct = m.hp / m.maxHp;
    // background and fill rendered as small horizontal "bars" via Circles
    // (Skia Rect without transform also OK, but Circle keeps it minimal)
    for (let i = 0; i < Math.ceil(w); i += 2) {
      els.push(
        <Circle
          key={k + 'hpb' + i}
          cx={bx + i + 1}
          cy={by}
          r={1.5}
          color="#222"
          opacity={0.7}
        />,
      );
    }
    for (let i = 0; i < Math.ceil(w * hpPct); i += 2) {
      els.push(
        <Circle
          key={k + 'hpf' + i}
          cx={bx + i + 1}
          cy={by}
          r={1.5}
          color={hpPct > 0.5 ? theme.colors.accent : hpPct > 0.25 ? theme.colors.warning : theme.colors.danger}
        />,
      );
    }
  }

  return <React.Fragment key={'mem-' + m.id}>{els}</React.Fragment>;
}

function renderHut(
  h: { id: number; pos: { x: number; y: number }; tribe: 'player' | 'rival'; hp: number; maxHp: number; radius: number },
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  t: number,
) {
  const x = h.pos.x - camX;
  const y = h.pos.y - camY;
  if (x < -120 || y < -120 || x > vw + 120 || y > vh + 120) return null;
  const els: React.ReactElement[] = [];
  const k = `h${h.id}-`;
  // ground patch
  els.push(<Circle key={k + 'gp'} cx={x} cy={y + 18} r={h.radius + 16} color="#1a1208" opacity={0.6} />);
  // hut wall (bottom half) - approximate with big circle
  els.push(<Circle key={k + 'w'} cx={x} cy={y + 8} r={h.radius * 0.85} color={PALETTE.hutWall} />);
  // roof (cone-ish) - stack circles
  for (let i = 0; i < 5; i++) {
    els.push(
      <Circle
        key={k + 'rf' + i}
        cx={x}
        cy={y - 10 - i * 7}
        r={h.radius * (0.85 - i * 0.13)}
        color={PALETTE.hutRoof}
      />,
    );
  }
  // doorway
  els.push(<Circle key={k + 'd'} cx={x} cy={y + 22} r={h.radius * 0.28} color="#0a0805" />);
  // tribe banner color (small dot at top)
  els.push(
    <Circle
      key={k + 'flag'}
      cx={x}
      cy={y - 50}
      r={6}
      color={h.tribe === 'player' ? PALETTE.player : PALETTE.rival}
    />,
  );

  // campfire in front of player hut
  if (h.tribe === 'player') {
    const fx = x;
    const fy = y + 60;
    els.push(<Circle key={k + 'lg1'} cx={fx - 8} cy={fy + 4} r={5} color="#5a3818" />);
    els.push(<Circle key={k + 'lg2'} cx={fx + 8} cy={fy + 4} r={5} color="#5a3818" />);
    for (let i = 0; i < 4; i++) {
      const flick = Math.sin(t * 8 + i) * 3;
      els.push(
        <Circle
          key={k + 'fl' + i}
          cx={fx + flick * 0.4}
          cy={fy - 4 - i * 5 - Math.abs(flick) * 0.3}
          r={9 - i * 1.6}
          color={i < 2 ? '#fff0a8' : '#ffae3d'}
          opacity={0.92 - i * 0.12}
        />,
      );
    }
    els.push(<Circle key={k + 'glow'} cx={fx} cy={fy - 10} r={36} color="#ff8a3a" opacity={0.16} />);
  }

  // hut HP bar if damaged
  if (h.hp < h.maxHp) {
    const w = h.radius * 1.5;
    const bx = x - w / 2;
    const by = y - h.radius - 36;
    const hpPct = h.hp / h.maxHp;
    for (let i = 0; i < Math.ceil(w); i += 2) {
      els.push(
        <Circle
          key={k + 'hpb' + i}
          cx={bx + i + 1}
          cy={by}
          r={2}
          color="#222"
          opacity={0.7}
        />,
      );
    }
    for (let i = 0; i < Math.ceil(w * hpPct); i += 2) {
      els.push(
        <Circle
          key={k + 'hpf' + i}
          cx={bx + i + 1}
          cy={by}
          r={2}
          color={
            hpPct > 0.5
              ? theme.colors.accent
              : hpPct > 0.25
                ? theme.colors.warning
                : theme.colors.danger
          }
        />,
      );
    }
  }

  return <React.Fragment key={'hut-' + h.id}>{els}</React.Fragment>;
}

function groundPatches(
  worldW: number,
  worldH: number,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
) {
  const step = 200;
  const els: React.ReactElement[] = [];
  const startX = Math.max(step / 2, Math.floor(camX / step) * step + step / 2);
  const endX = Math.min(worldW, camX + vw + step);
  const startY = Math.max(step / 2, Math.floor(camY / step) * step + step / 2);
  const endY = Math.min(worldH, camY + vh + step);
  for (let x = startX; x < endX; x += step) {
    for (let y = startY; y < endY; y += step) {
      const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
      const f = h - Math.floor(h);
      els.push(
        <Circle
          key={`gp-${x}-${y}`}
          cx={x - camX + (f - 0.5) * 80}
          cy={y - camY + (f * 7 - 3.5) * 12}
          r={70 + f * 30}
          color={f > 0.5 ? '#48351c' : '#2c1f10'}
          opacity={0.5}
        />,
      );
    }
  }
  return els;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.ground },
  hud: {
    position: 'absolute',
    left: 12,
    right: 76,
  },
  hudRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
  },
  statLabel: {
    color: theme.colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statVal: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  pauseBtn: {
    position: 'absolute',
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseTxt: {
    color: theme.colors.text,
    fontSize: 26,
    lineHeight: 28,
    marginTop: -2,
  },
  actions: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  actionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
    backgroundColor: theme.colors.bgPanel,
    borderColor: theme.colors.dna,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowColor: theme.colors.dna,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    minWidth: 130,
  },
  actionDisabled: { opacity: 0.45 },
  warBtn: {
    borderColor: theme.colors.danger,
    shadowColor: theme.colors.danger,
  },
  actionTxt: {
    color: theme.colors.dna,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  actionSub: {
    color: theme.colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  civBtn: {
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 32,
    backgroundColor: theme.colors.warning,
    alignItems: 'center',
    shadowColor: theme.colors.warning,
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  civTxt: {
    color: '#1a0d00',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  civSub: { color: '#1a0d00', fontSize: 11, opacity: 0.7, marginTop: 2 },
  hint: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    maxWidth: '90%',
  },
  hintTxt: {
    color: theme.colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  debugRow: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  debugBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 200, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 0, 0.55)',
  },
  debugTxt: {
    color: theme.colors.warning,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
