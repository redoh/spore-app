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
  civAttack,
  civConvert,
  civTrade,
  createCivWorld,
  isNearNeutral,
  isNearRival,
  nearestNeutralCity,
  nearestRivalCity,
  stepCivWorld,
  type City,
  type CivWorld,
  type Soldier,
} from '../game/civ-world';

const FIXED_DT = 1 / 60;
const PALETTE = {
  ground: '#274822',
  groundDark: '#1d3618',
  road: '#4a3a22',
  player: '#6cf0d3',
  rival: '#e3826a',
  neutral: '#cccccc',
  building: '#8a6e3c',
  buildingDark: '#5a4624',
  roof: '#3a2a16',
  flagPlayer: '#6cf0d3',
  flagRival: '#e3826a',
  flagNeutral: '#cccccc',
};

export default function CivilizationStage() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const reportRunEnd = useGame((s) => s.reportRunEnd);
  const reportStageReached = useGame((s) => s.reportStageReached);
  const addDna = useGame((s) => s.addDna);
  const status = useGame((s) => s.status);

  const worldRef = useRef<CivWorld>(createCivWorld());
  const inputRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [drag, setDrag] = useState<{
    ox: number;
    oy: number;
    cx: number;
    cy: number;
  } | null>(null);

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
          const r = stepCivWorld(w, { move: inputRef.current }, FIXED_DT);
          acc -= FIXED_DT;
          if (r.goldGained > 0) addDna(r.goldGained);
          if (r.rivalJustDefeated) {
            try {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch {}
          }
          if (r.died) {
            reportRunEnd(w.leader.radius);
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

  const camX = Math.max(0, Math.min(w.width - width, w.leader.pos.x - width / 2));
  const camY = Math.max(
    0,
    Math.min(w.height - height, w.leader.pos.y - height / 2),
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
    const max = 55;
    const mag = Math.hypot(dx, dy);
    const m = Math.min(1, mag / max);
    if (mag > 0.01) {
      inputRef.current = { x: (dx / mag) * m, y: (dy / mag) * m };
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

  // Decorative ground patches (deterministic)
  const patches = useMemo(() => {
    const arr: { x: number; y: number; r: number; shade: number }[] = [];
    let seed = 7777;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 80; i++) {
      arr.push({
        x: rnd() * w.width,
        y: rnd() * w.height,
        r: 80 + rnd() * 80,
        shade: rnd(),
      });
    }
    return arr;
  }, [w.width, w.height]);

  const nearRival = isNearRival(w);
  const nearNeutral = isNearNeutral(w);
  const rivalCity = nearestRivalCity(w);
  const neutralCity = nearestNeutralCity(w);

  const goSpace = () => {
    reportStageReached('space');
    reportRunEnd(w.leader.radius);
    setStage('space');
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
        {/* ground patches */}
        {patches.map((p, i) => {
          const x = p.x - camX;
          const y = p.y - camY;
          if (x < -p.r || y < -p.r || x > width + p.r || y > height + p.r)
            return null;
          return (
            <Circle
              key={`gp-${i}`}
              cx={x}
              cy={y}
              r={p.r}
              color={p.shade > 0.5 ? '#2f5126' : PALETTE.groundDark}
              opacity={0.55}
            />
          );
        })}

        {/* roads connecting cities (wide brown lines via stacked circles) */}
        {(() => {
          const els: React.ReactElement[] = [];
          const playerCap = w.cities.find(
            (c) => c.owner === 'player' && c.name === 'Başkent',
          );
          const rivalCap = w.cities.find(
            (c) => c.owner === 'rival' && c.name === 'Düşman',
          );
          if (playerCap && rivalCap) {
            const segs = 60;
            const dx = rivalCap.pos.x - playerCap.pos.x;
            const dy = rivalCap.pos.y - playerCap.pos.y;
            for (let i = 0; i < segs; i++) {
              const f = i / segs;
              const x = playerCap.pos.x + dx * f - camX;
              const y = playerCap.pos.y + dy * f - camY;
              if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
              els.push(
                <Circle
                  key={`road-${i}`}
                  cx={x}
                  cy={y}
                  r={12}
                  color={PALETTE.road}
                  opacity={0.6}
                />,
              );
            }
          }
          return els;
        })()}

        {/* cities */}
        {w.cities.map((c) =>
          renderCity(c, camX, camY, width, height, t),
        )}

        {/* soldiers */}
        {w.soldiers.map((s) => renderSoldier(s, camX, camY, width, height))}

        {/* leader (with crown) */}
        {renderLeader(w.leader, camX, camY, width, height, t)}

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

        {/* drag indicator */}
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

      {/* Top HUD */}
      <View style={[styles.hud, { top: insets.top + 12 }]} pointerEvents="none">
        <View style={styles.hudRow}>
          <Stat
            label="ALTIN"
            value={Math.floor(w.gold).toString()}
            color={theme.colors.warning}
          />
          <Stat
            label="CAN"
            value={`${Math.max(0, Math.floor(w.leader.hp))}/${w.leader.maxHp}`}
            color={theme.colors.accent}
          />
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
        <View style={[styles.hudRow, { marginTop: 6 }]}>
          <Stat
            label="ŞEHİR"
            value={`${w.cities.filter((c) => c.owner === 'player').length}/${w.cities.length}`}
            color={theme.colors.text}
          />
          <Stat
            label="ASKER"
            value={`${w.soldiers.filter((s) => s.faction === 'player').length}/${w.soldiers.filter((s) => s.faction === 'rival').length}`}
            color={theme.colors.text}
          />
        </View>
      </View>

      {/* Pause */}
      <TouchableOpacity
        onPress={() => {
          setStatus('menu');
          reportRunEnd(w.leader.radius);
        }}
        style={[styles.pauseBtn, { top: insets.top + 14 }]}
        activeOpacity={0.7}
      >
        <Text style={styles.pauseTxt}>×</Text>
      </TouchableOpacity>

      {/* Debug shortcuts */}
      <View style={[styles.debugRow, { top: insets.top + 90 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.debugBtn}
          onPress={() => {
            w.gold += 30;
          }}
        >
          <Text style={styles.debugTxt}>+30 altın</Text>
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
            const r = nearestRivalCity(w);
            if (r) r.hp = 0;
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
            style={styles.spaceBtn}
            onPress={goSpace}
          >
            <Text style={styles.spaceTxt}>UZAYA AÇIL</Text>
            <Text style={styles.spaceSub}>
              {w.rivalAllied ? 'İttifak' : 'Fetih'} tamamlandı · Uzay Evresine geç
            </Text>
          </TouchableOpacity>
        ) : nearRival && rivalCity ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.actionBtn, w.gold < 8 && styles.actionDisabled]}
              onPress={() => {
                if (civTrade(w)) {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }
              }}
            >
              <Text style={styles.actionTxt}>TİCARET</Text>
              <Text style={styles.actionSub}>8 altın · +15 dostluk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.actionBtn,
                styles.warBtn,
                w.gold < 10 && styles.actionDisabled,
              ]}
              onPress={() => {
                if (civAttack(w)) {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  } catch {}
                }
              }}
            >
              <Text style={[styles.actionTxt, { color: theme.colors.danger }]}>
                SALDIR
              </Text>
              <Text style={styles.actionSub}>10 altın · 3 asker yolla</Text>
            </TouchableOpacity>
          </>
        ) : nearNeutral && neutralCity ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionBtn, w.gold < 6 && styles.actionDisabled]}
            onPress={() => {
              const c = civConvert(w);
              if (c) {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }
            }}
          >
            <Text style={styles.actionTxt}>ELE GEÇİR</Text>
            <Text style={styles.actionSub}>
              6 altın · {neutralCity.name}'i etki altına al
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.hint}>
            <Text style={styles.hintTxt}>
              Tarafsız şehirleri ele geçir, başkentine yaklaşıp düşmanla
              ticaret yap ya da saldır. Şehirler altın üretir.
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

function renderCity(
  c: City,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  t: number,
) {
  const x = c.pos.x - camX;
  const y = c.pos.y - camY;
  if (x < -c.radius - 50 || y < -c.radius - 80 || x > vw + c.radius + 50 || y > vh + c.radius + 80)
    return null;
  const flagColor =
    c.owner === 'player'
      ? PALETTE.flagPlayer
      : c.owner === 'rival'
        ? PALETTE.flagRival
        : PALETTE.flagNeutral;
  const accent =
    c.owner === 'player' ? PALETTE.player : c.owner === 'rival' ? PALETTE.rival : PALETTE.neutral;

  const els: React.ReactElement[] = [];
  const k = `c${c.id}-`;
  // foundation
  els.push(
    <Circle key={k + 'f'} cx={x} cy={y} r={c.radius} color="#1f3018" opacity={0.85} />,
  );
  els.push(
    <Circle key={k + 'f2'} cx={x} cy={y - 6} r={c.radius * 0.95} color="#5a4624" opacity={0.65} />,
  );

  // 4 buildings around the center
  const buildings = [
    { dx: -0.45, dy: -0.2, h: 0.55 },
    { dx: 0.45, dy: -0.2, h: 0.65 },
    { dx: -0.3, dy: 0.4, h: 0.45 },
    { dx: 0.3, dy: 0.4, h: 0.5 },
  ];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const bx = x + b.dx * c.radius;
    const by = y + b.dy * c.radius;
    const bh = b.h * c.radius;
    // body
    els.push(
      <Circle
        key={k + 'b' + i}
        cx={bx}
        cy={by}
        r={c.radius * 0.22}
        color={PALETTE.building}
      />,
    );
    // roof
    els.push(
      <Circle
        key={k + 'br' + i}
        cx={bx}
        cy={by - bh * 0.45}
        r={c.radius * 0.18}
        color={PALETTE.roof}
      />,
    );
    // window
    els.push(
      <Circle
        key={k + 'bw' + i}
        cx={bx}
        cy={by}
        r={2.4}
        color="#ffd47a"
        opacity={0.85}
      />,
    );
  }

  // central keep (taller, with banner)
  const kx = x;
  const ky = y - 18;
  els.push(<Circle key={k + 'k'} cx={kx} cy={ky} r={c.radius * 0.32} color={PALETTE.building} />);
  els.push(<Circle key={k + 'kr'} cx={kx} cy={ky - c.radius * 0.32} r={c.radius * 0.22} color={PALETTE.roof} />);
  // flag pole
  for (let i = 0; i < 4; i++) {
    els.push(
      <Circle
        key={k + 'fp' + i}
        cx={kx}
        cy={ky - c.radius * 0.45 - i * 4}
        r={1.4}
        color="#3a2a16"
      />,
    );
  }
  // banner — animated wave
  const wave = Math.sin(t * 4 + c.id) * 2;
  els.push(
    <Circle
      key={k + 'fl'}
      cx={kx + 8 + wave * 0.4}
      cy={ky - c.radius * 0.55 - 12}
      r={5}
      color={flagColor}
    />,
  );

  // City name banner halo (so player can spot owner from distance)
  els.push(
    <Circle
      key={k + 'halo'}
      cx={x}
      cy={y}
      r={c.radius + 10}
      color={accent}
      opacity={0.1}
    />,
  );

  // HP bar if damaged
  if (c.hp < c.maxHp) {
    const w = c.radius * 1.5;
    const bx = x - w / 2;
    const by = y - c.radius - 30;
    const hpPct = c.hp / c.maxHp;
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

  return <React.Fragment key={'city-' + c.id}>{els}</React.Fragment>;
}

function renderSoldier(
  s: Soldier,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
) {
  const x = s.pos.x - camX;
  const y = s.pos.y - camY;
  if (x < -20 || y < -20 || x > vw + 20 || y > vh + 20) return null;
  const color = s.faction === 'player' ? PALETTE.player : PALETTE.rival;
  const k = `s${s.id}-`;
  return (
    <React.Fragment key={'sol-' + s.id}>
      <Circle cx={x} cy={y + 4} r={9} color="#000" opacity={0.3} />
      <Circle cx={x} cy={y} r={9} color={color} />
      <Circle cx={x} cy={y - 6} r={5} color={color} />
      <Circle cx={x + 1} cy={y - 6} r={1.5} color="#0a0410" />
    </React.Fragment>
  );
}

function renderLeader(
  l: { pos: { x: number; y: number }; radius: number; vel: { x: number; y: number } },
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  t: number,
) {
  const x = l.pos.x - camX;
  const y = l.pos.y - camY;
  const r = l.radius;
  if (x < -r * 2 || y < -r * 2 || x > vw + r * 2 || y > vh + r * 2)
    return null;

  const vlen = Math.hypot(l.vel.x, l.vel.y);
  const moving = vlen > 8;
  const dir =
    vlen > 5
      ? { x: l.vel.x / vlen, y: l.vel.y / vlen }
      : { x: 0, y: -1 };
  const perp = { x: -dir.y, y: dir.x };
  const els: React.ReactElement[] = [];

  // walking legs
  for (let i = 0; i < 4; i++) {
    const along = ((i + 0.5) / 4 - 0.5) * r * 1.4;
    const side = i % 2 === 0 ? 1 : -1;
    const lx = x + dir.x * along + perp.x * side * (r * 0.7);
    const ly = y + dir.y * along + perp.y * side * (r * 0.7);
    const lift = moving
      ? Math.max(0, Math.sin(t * 8 + i * 1.3)) * Math.max(2, r * 0.18)
      : 0;
    const fx = lx + perp.x * side * (r * 0.4);
    const fy = ly + perp.y * side * (r * 0.4) - lift;
    els.push(
      <Circle key={`lleg${i}`} cx={fx} cy={fy} r={Math.max(3, r * 0.2)} color="#2c8a76" />,
    );
  }

  els.push(<Circle key="lsh" cx={x} cy={y + r * 0.7} r={r * 0.95} color="#000" opacity={0.3} />);
  els.push(<Circle key="lb" cx={x} cy={y} r={r} color={PALETTE.player} />);
  els.push(<Circle key="lbe" cx={x} cy={y + r * 0.25} r={r * 0.78} color="rgba(0,0,0,0.25)" opacity={0.7} />);

  // head
  const hx = x + dir.x * r * 0.85;
  const hy = y + dir.y * r * 0.85;
  els.push(<Circle key="lh" cx={hx} cy={hy} r={r * 0.55} color={PALETTE.player} />);

  // crown (3 small spikes on top of head)
  for (let i = -1; i <= 1; i++) {
    els.push(
      <Circle
        key={`lcr${i}`}
        cx={hx + perp.x * i * r * 0.18 - dir.x * r * 0.05}
        cy={hy + perp.y * i * r * 0.18 - dir.y * r * 0.05 - r * 0.4}
        r={r * 0.13}
        color={theme.colors.warning}
      />,
    );
  }
  // crown band
  els.push(
    <Circle
      key="lcrb"
      cx={hx - dir.x * r * 0.05}
      cy={hy - dir.y * r * 0.05 - r * 0.3}
      r={r * 0.42}
      color={theme.colors.warning}
      opacity={0.3}
    />,
  );

  // eye
  const ex = hx + dir.x * r * 0.18;
  const ey = hy + dir.y * r * 0.18;
  els.push(<Circle key="lew" cx={ex} cy={ey} r={r * 0.22} color="#f0fff8" />);
  els.push(<Circle key="lep" cx={ex + dir.x * r * 0.06} cy={ey + dir.y * r * 0.06} r={r * 0.12} color="#0a0410" />);

  return <>{els}</>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.ground },
  hud: { position: 'absolute', left: 12, right: 76 },
  hudRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  pauseTxt: { color: theme.colors.text, fontSize: 26, lineHeight: 28, marginTop: -2 },
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
  warBtn: { borderColor: theme.colors.danger, shadowColor: theme.colors.danger },
  actionTxt: { color: theme.colors.dna, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  actionSub: { color: theme.colors.textDim, fontSize: 10, marginTop: 2 },
  spaceBtn: {
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 32,
    backgroundColor: theme.colors.dna,
    alignItems: 'center',
    shadowColor: theme.colors.dna,
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  spaceTxt: { color: '#0a0410', fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  spaceSub: { color: '#0a0410', fontSize: 11, opacity: 0.7, marginTop: 2 },
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
  },
});
