import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas, Circle, BlurMask, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import { useGame } from '../game/store';
import {
  createSpaceWorld,
  isNearPlanet,
  nearestPlanet,
  spaceAttack,
  spaceColonize,
  spaceDiplomacy,
  stepSpaceWorld,
  type Planet,
  type Ship,
  type SpaceWorld,
  type UFO,
} from '../game/space-world';
import MiniMap from '../components/MiniMap';
import AmbientParticles from '../components/AmbientParticles';
import Vignette from '../components/Vignette';

const FIXED_DT = 1 / 60;

export default function SpaceStage() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const reportRunEnd = useGame((s) => s.reportRunEnd);
  const reportStageReached = useGame((s) => s.reportStageReached);
  const addDna = useGame((s) => s.addDna);
  const status = useGame((s) => s.status);

  const worldRef = useRef<SpaceWorld>(createSpaceWorld());
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
          const r = stepSpaceWorld(w, { move: inputRef.current }, FIXED_DT);
          acc -= FIXED_DT;
          if (r.energyGained > 0) addDna(r.energyGained);
          if (r.galaxyJustConquered || r.rivalJustDefeated || r.rivalJustAllied) {
            try {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch {}
          }
          if (r.died) {
            reportRunEnd(w.ufo.radius);
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

  const camX = Math.max(0, Math.min(w.width - width, w.ufo.pos.x - width / 2));
  const camY = Math.max(0, Math.min(w.height - height, w.ufo.pos.y - height / 2));

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

  // Stars (deterministic, world-space)
  const stars = useMemo(() => {
    const arr: { x: number; y: number; r: number; o: number }[] = [];
    let seed = 9999;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 280; i++) {
      arr.push({
        x: rnd() * w.width,
        y: rnd() * w.height,
        r: 0.6 + rnd() * 1.6,
        o: 0.3 + rnd() * 0.6,
      });
    }
    return arr;
  }, [w.width, w.height]);

  // Nebulae (deterministic)
  const nebulae = useMemo(() => {
    const arr: { x: number; y: number; r: number; color: string }[] = [];
    const colors = ['#3a1f5c', '#1f3a5c', '#5c1f3a', '#1f5c3a'];
    let seed = 4242;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 12; i++) {
      arr.push({
        x: rnd() * w.width,
        y: rnd() * w.height,
        r: 280 + rnd() * 220,
        color: colors[i % colors.length],
      });
    }
    return arr;
  }, [w.width, w.height]);

  const neutralPlanet = nearestPlanet(w, (p) => p.owner === 'neutral');
  const rivalPlanet = nearestPlanet(w, (p) => p.owner === 'rival' && p.hp > 0);
  const nearNeutral = !!neutralPlanet && isNearPlanet(w, neutralPlanet);
  const nearRival = !!rivalPlanet && isNearPlanet(w, rivalPlanet);

  // Final win → show victory overlay
  if (w.galaxyConquered) {
    return <Victory />;
  }

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
      <Canvas style={{ flex: 1, width, height, backgroundColor: '#02050f' }}>
        {/* screen-space deep-space gradient */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width * 0.5, height * 0.4)}
            r={Math.max(width, height) * 0.85}
            colors={['#0d1f4a', '#040820', '#02050f']}
            positions={[0, 0.55, 1]}
          />
        </Rect>

        {/* nebulae — soft blurred clouds, layered for depth */}
        {nebulae.map((n, i) => {
          const x = n.x - camX;
          const y = n.y - camY;
          if (x < -n.r || y < -n.r || x > width + n.r || y > height + n.r)
            return null;
          return (
            <React.Fragment key={`neb-${i}`}>
              <Circle cx={x} cy={y} r={n.r} color={n.color} opacity={0.22}>
                <BlurMask blur={40} style="solid" />
              </Circle>
              <Circle
                cx={x + n.r * 0.2}
                cy={y - n.r * 0.15}
                r={n.r * 0.55}
                color={n.color}
                opacity={0.32}
              >
                <BlurMask blur={28} style="solid" />
              </Circle>
            </React.Fragment>
          );
        })}

        {/* stars */}
        {stars.map((s, i) => {
          const x = s.x - camX;
          const y = s.y - camY;
          if (x < -2 || y < -2 || x > width + 2 || y > height + 2) return null;
          const tw = (Math.sin(t * 1.4 + i * 0.3) + 1) / 2;
          return (
            <Circle
              key={`st-${i}`}
              cx={x}
              cy={y}
              r={s.r}
              color="#cee0ff"
              opacity={s.o * (0.6 + tw * 0.4)}
            />
          );
        })}

        {/* planets */}
        {w.planets.map((p) => renderPlanet(p, camX, camY, width, height, t))}

        {/* ships */}
        {w.ships.map((s) => renderShip(s, camX, camY, width, height))}

        {/* UFO */}
        {renderUFO(w.ufo, camX, camY, width, height, t)}

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

        {/* lens flare around the brightest light source (UFO) */}
        {(() => {
          const ufoSx = w.ufo.pos.x - camX;
          const ufoSy = w.ufo.pos.y - camY;
          // 5 small flare dots along a diagonal
          return Array.from({ length: 5 }).map((_, i) => {
            const f = (i - 2) / 2;
            return (
              <Circle
                key={`flare-${i}`}
                cx={ufoSx + f * 80}
                cy={ufoSy + f * 80}
                r={Math.max(2, 7 - Math.abs(f) * 4)}
                color={i % 2 === 0 ? '#6cf0d3' : '#ffd47a'}
                opacity={0.18 - Math.abs(f) * 0.06}
              >
                <BlurMask blur={6} style="solid" />
              </Circle>
            );
          });
        })()}

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

      {/* Vignette overlay — deep-space cinematic edge fade */}
      <Vignette width={width} height={height} color="#000000" intensity={0.65} />

      {/* HUD */}
      <View style={[styles.hud, { top: insets.top + 12 }]} pointerEvents="none">
        <View style={styles.hudRow}>
          <Stat label="ENERJİ" value={Math.floor(w.energy).toString()} color={theme.colors.warning} />
          <Stat
            label="CAN"
            value={`${Math.max(0, Math.floor(w.ufo.hp))}/${w.ufo.maxHp}`}
            color={theme.colors.accent}
          />
          <Stat label="DOSTLUK" value={`${Math.floor(w.friendship)}%`} color={theme.colors.dna} />
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
            label="GEZEGEN"
            value={`${w.planets.filter((p) => p.owner === 'player').length}/${w.planets.length}`}
            color={theme.colors.text}
          />
          <Stat
            label="FİLO"
            value={`${w.ships.filter((s) => s.faction === 'player').length}/${w.ships.filter((s) => s.faction === 'rival').length}`}
            color={theme.colors.text}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={() => {
          setStatus('menu');
          reportRunEnd(w.ufo.radius);
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
        player={{ x: w.ufo.pos.x, y: w.ufo.pos.y, color: theme.colors.accent }}
        dots={[
          // Planets (big markers, owner-colored)
          ...w.planets.map((p) => ({
            x: p.pos.x,
            y: p.pos.y,
            color:
              p.owner === 'player'
                ? '#6cf0d3'
                : p.owner === 'rival'
                  ? '#e3826a'
                  : '#cccccc',
            r: p.name === 'Anavatan' || p.name === 'Düşman' ? 5 : 4,
            opacity: 0.95,
          })),
          // Ships
          ...w.ships.map((s) => ({
            x: s.pos.x,
            y: s.pos.y,
            color: s.faction === 'player' ? '#6cf0d3' : '#e3826a',
            r: 1.4,
          })),
        ]}
        top={insets.top + 90}
        right={14}
      />

      {/* Debug */}
      <View style={[styles.debugRow, { top: insets.top + 90 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.debugBtn} onPress={() => (w.energy += 30)}>
          <Text style={styles.debugTxt}>+30 enerji</Text>
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
            for (const p of w.planets) {
              if (p.owner === 'rival') p.hp = 0;
              if (p.owner === 'neutral') p.owner = 'player';
            }
            w.rivalDefeated = true;
          }}
        >
          <Text style={styles.debugTxt}>galaksiyi al</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.actions, { bottom: insets.bottom + 24 }]}>
        {nearNeutral && neutralPlanet ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionBtn, w.energy < 8 && styles.actionDisabled]}
            onPress={() => {
              if (spaceColonize(w)) {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }
            }}
          >
            <Text style={styles.actionTxt}>SÖMÜRGELEŞTİR</Text>
            <Text style={styles.actionSub}>
              8 enerji · {neutralPlanet.name}'i ele geçir
            </Text>
          </TouchableOpacity>
        ) : nearRival && rivalPlanet ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.actionBtn, w.energy < 10 && styles.actionDisabled]}
              onPress={() => {
                if (spaceDiplomacy(w)) {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }
              }}
            >
              <Text style={styles.actionTxt}>DİPLOMASİ</Text>
              <Text style={styles.actionSub}>10 enerji · +18 dostluk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.actionBtn,
                styles.warBtn,
                w.energy < 12 && styles.actionDisabled,
              ]}
              onPress={() => {
                if (spaceAttack(w)) {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  } catch {}
                }
              }}
            >
              <Text style={[styles.actionTxt, { color: theme.colors.danger }]}>
                SALDIR
              </Text>
              <Text style={styles.actionSub}>12 enerji · 3 gemi yolla</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.hint}>
            <Text style={styles.hintTxt}>
              Tarafsız gezegenleri sömürgeleştir, düşmanla diplomasi kur ya da
              filo gönder. Tüm galaksiyi ele geçirince zafer.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
    </View>
  );
}

function renderPlanet(
  p: Planet,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  t: number,
) {
  const x = p.pos.x - camX;
  const y = p.pos.y - camY;
  const r = p.radius;
  if (x < -r * 2 || y < -r * 2 || x > vw + r * 2 || y > vh + r * 2)
    return null;

  const baseColor = ownerTint(p.owner, p.hue);
  const els: React.ReactElement[] = [];
  const k = `pl${p.id}-`;

  // Atmospheric bloom (soft glow ring) — BlurMask for actual blur
  els.push(
    <Circle
      key={k + 'bloom'}
      cx={x}
      cy={y}
      r={r + 18}
      color={ownerAuraColor(p.owner)}
      opacity={0.45}
    >
      <BlurMask blur={26} style="solid" />
    </Circle>,
  );

  // Ring (behind planet for ringed planets)
  if (p.ringStyle === 1) {
    for (let i = 0; i < 50; i++) {
      const a = (i / 50) * Math.PI * 2;
      els.push(
        <Circle
          key={k + 'rng-' + i}
          cx={x + Math.cos(a) * (r * 1.4)}
          cy={y + Math.sin(a) * (r * 0.45)}
          r={2}
          color="#a98bff"
          opacity={0.55}
        />,
      );
    }
  }

  // Drop shadow (long, behind body)
  els.push(
    <Circle
      key={k + 'shadow'}
      cx={x + r * 0.2}
      cy={y + r * 0.25}
      r={r * 1.05}
      color="#000"
      opacity={0.55}
    >
      <BlurMask blur={10} style="solid" />
    </Circle>,
  );
  // Planet body (radial gradient — lit from upper-left)
  els.push(
    <Circle key={k + 'body'} cx={x} cy={y} r={r}>
      <RadialGradient
        c={vec(x - r * 0.35, y - r * 0.35)}
        r={r * 1.4}
        colors={[lighten(baseColor, 0.35), baseColor, shade(baseColor, -0.55)]}
        positions={[0, 0.55, 1]}
      />
    </Circle>,
  );

  // Surface details (continents / craters)
  for (let i = 0; i < 6; i++) {
    const sa = (i * 137.508 + p.id * 7.91) * 0.0174533;
    const sr = (i % 3) * (r * 0.18) + r * 0.18;
    const sx = x + Math.cos(sa) * (r * 0.45);
    const sy = y + Math.sin(sa) * (r * 0.45);
    els.push(
      <Circle
        key={k + 'cnt-' + i}
        cx={sx}
        cy={sy}
        r={sr}
        color={shade(baseColor, -0.18)}
        opacity={0.6}
      />,
    );
  }

  // Atmosphere highlight
  els.push(
    <Circle
      key={k + 'hl'}
      cx={x - r * 0.35}
      cy={y - r * 0.35}
      r={r * 0.55}
      color="#ffffff"
      opacity={0.18}
    />,
  );

  // Moons
  if (p.ringStyle === 2) {
    for (let i = 0; i < 2; i++) {
      const a = t * (0.6 + i * 0.4) + i * 1.7;
      const md = r * 1.6;
      els.push(
        <Circle
          key={k + 'moon-' + i}
          cx={x + Math.cos(a) * md}
          cy={y + Math.sin(a) * md * 0.55}
          r={r * 0.18}
          color="#bcb3a0"
        />,
      );
    }
  }

  // Owner flag dot above planet
  els.push(
    <Circle
      key={k + 'flag'}
      cx={x}
      cy={y - r - 18}
      r={6}
      color={ownerColor(p.owner)}
    />,
  );

  // HP bar if damaged
  if (p.hp < p.maxHp) {
    const w = r * 1.5;
    const bx = x - w / 2;
    const by = y - r - 32;
    const hpPct = p.hp / p.maxHp;
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

  return <React.Fragment key={'pl-' + p.id}>{els}</React.Fragment>;
}

function renderShip(s: Ship, camX: number, camY: number, vw: number, vh: number) {
  const x = s.pos.x - camX;
  const y = s.pos.y - camY;
  if (x < -22 || y < -22 || x > vw + 22 || y > vh + 22) return null;
  const color = s.faction === 'player' ? theme.colors.accent : '#e3826a';
  const vlen = Math.hypot(s.vel.x, s.vel.y);
  const dir =
    vlen > 5 ? { x: s.vel.x / vlen, y: s.vel.y / vlen } : { x: 0, y: -1 };
  return (
    <React.Fragment key={'sh-' + s.id}>
      {/* engine bloom (BlurMask glow) */}
      <Circle cx={x - dir.x * 11} cy={y - dir.y * 11} r={9} color="#ffae3d" opacity={0.7}>
        <BlurMask blur={9} style="solid" />
      </Circle>
      <Circle cx={x - dir.x * 9} cy={y - dir.y * 9} r={5} color="#ffd47a" opacity={0.95} />
      <Circle cx={x - dir.x * 14} cy={y - dir.y * 14} r={3} color="#fff8d5" opacity={0.7} />
      {/* hull halo */}
      <Circle cx={x} cy={y} r={11} color={color} opacity={0.35}>
        <BlurMask blur={5} style="solid" />
      </Circle>
      {/* hull */}
      <Circle cx={x} cy={y} r={7} color={color} />
      <Circle cx={x + dir.x * 4} cy={y + dir.y * 4} r={3} color="#0a0410" />
    </React.Fragment>
  );
}

function renderUFO(ufo: UFO, camX: number, camY: number, vw: number, vh: number, t: number) {
  const x = ufo.pos.x - camX;
  const y = ufo.pos.y - camY;
  const r = ufo.radius;
  if (x < -r * 2 || y < -r * 2 || x > vw + r * 2 || y > vh + r * 2) return null;
  const els: React.ReactElement[] = [];
  // big atmospheric bloom under hull (BlurMask)
  els.push(
    <Circle
      key="ufo-bloom"
      cx={x}
      cy={y + r * 0.5}
      r={r * 2.4}
      color={theme.colors.accent}
      opacity={0.55}
    >
      <BlurMask blur={32} style="solid" />
    </Circle>,
  );
  // softer wider halo
  els.push(
    <Circle key="ufo-g" cx={x} cy={y + r * 0.4} r={r * 1.6} color={theme.colors.accent} opacity={0.22} />,
  );
  // dome
  els.push(<Circle key="ufo-d" cx={x} cy={y - r * 0.2} r={r * 0.7} color="#9ec0ff" opacity={0.85} />);
  els.push(<Circle key="ufo-d2" cx={x - r * 0.1} cy={y - r * 0.35} r={r * 0.35} color="#ffffff" opacity={0.55} />);
  // hull
  els.push(<Circle key="ufo-h" cx={x} cy={y + r * 0.15} r={r} color={theme.colors.accent} />);
  els.push(<Circle key="ufo-h2" cx={x} cy={y + r * 0.15} r={r * 0.85} color="#3a8a7a" opacity={0.5} />);
  // belly lights blink
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + t * 1.4;
    const lx = x + Math.cos(a) * r * 0.7;
    const ly = y + r * 0.18 + Math.sin(a) * r * 0.18 * 0.4;
    const lit = (Math.sin(t * 6 + i * 1.5) + 1) / 2 > 0.5;
    els.push(
      <Circle
        key={'ufo-l' + i}
        cx={lx}
        cy={ly}
        r={2.5}
        color={lit ? '#ffd47a' : '#1a1a26'}
        opacity={lit ? 0.95 : 0.7}
      />,
    );
  }
  return <>{els}</>;
}

function ownerColor(o: 'player' | 'rival' | 'neutral'): string {
  return o === 'player' ? '#6cf0d3' : o === 'rival' ? '#e3826a' : '#cccccc';
}

function ownerAuraColor(o: 'player' | 'rival' | 'neutral'): string {
  return o === 'player' ? '#6cf0d3' : o === 'rival' ? '#e3826a' : '#7d88a8';
}

function ownerTint(owner: 'player' | 'rival' | 'neutral', hue: number): string {
  // Convert HSL-ish to a nice planet color. Just produce a fixed color per hue value
  // by interpolating between a few presets.
  if (hue < 30) return '#c47045';
  if (hue < 60) return '#d4a45a';
  if (hue < 90) return '#a4c45a';
  if (hue < 150) return '#5ec07a';
  if (hue < 200) return '#5a9ac0';
  if (hue < 240) return '#5a78c0';
  if (hue < 280) return '#9a5ac0';
  if (hue < 320) return '#c05a9a';
  return '#c45a5a';
}

function lighten(hex: string, amount: number) {
  return shade(hex, amount);
}

function shade(hex: string, amount: number) {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const apply = (n: number) =>
    Math.max(0, Math.min(255, Math.floor(n * (1 + amount))))
      .toString(16)
      .padStart(2, '0');
  return '#' + apply(r) + apply(g) + apply(b);
}

function Victory() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const totalDna = useGame((s) => s.totalDna);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((tt) => (tt + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const t = tick / 60;

  return (
    <View style={[victoryStyles.root, { paddingTop: insets.top + 28 }]}>
      <Canvas style={{ flex: 1, width, height, backgroundColor: '#02050f' }}>
        {Array.from({ length: 280 }).map((_, i) => {
          const x = ((i * 137.508) % width) | 0;
          const y = ((i * 91.327) % height) | 0;
          const tw = (Math.sin(t * 1.4 + i * 0.3) + 1) / 2;
          return (
            <Circle key={`vs-${i}`} cx={x} cy={y} r={1 + (i % 3) * 0.6} color="#cee0ff" opacity={0.4 + tw * 0.6} />
          );
        })}
        {/* Galaxy spiral with player accent */}
        {(() => {
          const cx = width / 2;
          const cy = height * 0.5;
          const arms = 4;
          const points = 220;
          const els: React.ReactElement[] = [];
          for (let a = 0; a < arms; a++) {
            for (let i = 0; i < points; i++) {
              const f = i / points;
              const ang = f * Math.PI * 4 + (a / arms) * Math.PI * 2 + t * 0.2;
              const rr = f * Math.min(width, height) * 0.45;
              const x = cx + Math.cos(ang) * rr;
              const y = cy + Math.sin(ang) * rr;
              const sz = 1.4 + (1 - f) * 2;
              els.push(
                <Circle
                  key={`gal-${a}-${i}`}
                  cx={x}
                  cy={y}
                  r={sz}
                  color={i % 11 === 0 ? '#a98bff' : '#6cf0d3'}
                  opacity={0.4 + (1 - f) * 0.5}
                />,
              );
            }
          }
          els.push(<Circle key="core" cx={cx} cy={cy} r={42} color="#ffd47a" />);
          els.push(<Circle key="core-glow" cx={cx} cy={cy} r={70} color="#ffae3d" opacity={0.5} />);
          els.push(<Circle key="core-glow2" cx={cx} cy={cy} r={120} color="#ff8a3a" opacity={0.18} />);
          return els;
        })()}
      </Canvas>

      <View style={victoryStyles.overlay} pointerEvents="box-none">
        <View style={victoryStyles.banner}>
          <Text style={victoryStyles.eyebrow}>OYUN BİTTİ</Text>
          <Text style={victoryStyles.title}>Galaksi Efendisi</Text>
          <Text style={victoryStyles.body}>
            Tek bir hücreden başlayıp galaksideki bütün dünyaları kendine
            bağladın. Spore yolculuğunu tamamladın.
          </Text>
          <View style={victoryStyles.statsRow}>
            <View style={victoryStyles.stat}>
              <Text style={victoryStyles.statLabel}>TOPLAM DNA</Text>
              <Text style={victoryStyles.statV}>{Math.floor(totalDna)}</Text>
            </View>
          </View>
        </View>

        <View style={[victoryStyles.actions, { paddingBottom: insets.bottom + 18 }]}>
          <TouchableOpacity
            onPress={() => {
              setStage('cell');
              setStatus('menu');
            }}
            style={victoryStyles.btn}
          >
            <Text style={victoryStyles.btnTxt}>YENİDEN BAŞLA</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02050f' },
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

const victoryStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02050f' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  banner: {
    backgroundColor: 'rgba(11,18,38,0.85)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  eyebrow: {
    color: theme.colors.dna,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: theme.colors.accent,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 4,
  },
  body: {
    color: theme.colors.textDim,
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: theme.colors.bgPanel,
    borderRadius: 10,
    padding: 12,
  },
  statLabel: {
    color: theme.colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  statV: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  actions: {},
  btn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: 'center',
  },
  btnTxt: {
    color: theme.colors.bgDeep,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
});
