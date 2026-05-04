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
import { applyParts, createWorld, stepWorld } from '../game/world';
import type { Cell, PartId, World } from '../game/types';
import HUD from '../components/HUD';
import EvolveModal from '../components/EvolveModal';
import DebugButton from '../components/DebugButton';
import MiniMap from '../components/MiniMap';

const FIXED_DT = 1 / 60;

// Tribal stage threshold — bigger creature with more parts
const TRIBAL_RADIUS_THRESHOLD = 38;
const TRIBAL_PARTS_THRESHOLD = 4;

// Earth palette for creature stage
const PALETTE = {
  sky: '#1a2238',
  ground: '#3a2a16',
  groundDark: '#2a1d0e',
  grass: '#4f7a3e',
  fruit: '#e8634a',
  rock: '#3a3d52',
  rockShade: '#1f2238',
  creatureBody: '#6cf0d3',
  creatureBelly: '#3da291',
  creatureLeg: '#2c8a76',
};

export default function CreatureStage() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const setCarryOver = useGame((s) => s.setCarryOver);
  const reportRunEnd = useGame((s) => s.reportRunEnd);
  const reportStageReached = useGame((s) => s.reportStageReached);
  const addDna = useGame((s) => s.addDna);
  const status = useGame((s) => s.status);
  const carryOver = useGame((s) => s.carryOver);

  // Build world fresh on mount, seeded from cell-stage carry-over (if any).
  // Creature stage is bigger and more dangerous than cell.
  const worldRef = useRef<World>(
    createWorld({
      startRadius: Math.max(20, (carryOver?.radius ?? 22) * 0.85),
      startHp: 90,
      startSpeed: 200,
      startParts: carryOver?.parts ?? [],
      maxFood: 70,
      maxCells: 18,
      plantBias: 0.55,
    }),
  );
  const inputRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [evolveOpen, setEvolveOpen] = useState(false);
  const [drag, setDrag] = useState<{
    ox: number;
    oy: number;
    cx: number;
    cy: number;
  } | null>(null);

  // Apply carry-over parts on mount so stats reflect inherited evolution.
  useEffect(() => {
    if (carryOver?.parts?.length) {
      applyParts(worldRef.current.player, carryOver.parts);
    }
    // We intentionally only do this once (mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const paused = evolveOpen || status !== 'playing';
      if (!paused) {
        while (acc >= FIXED_DT) {
          const r = stepWorld(w, { move: inputRef.current }, FIXED_DT);
          acc -= FIXED_DT;
          if (r.dnaGained > 0) addDna(r.dnaGained);
          if (r.damageTaken > 4) {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
  }, [addDna, reportRunEnd, setStatus, status, evolveOpen]);

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

  // Static decorative rocks (deterministic per world dimensions)
  const rocks = useMemo(() => {
    const arr: { x: number; y: number; r: number }[] = [];
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 60; i++) {
      arr.push({
        x: rand() * w.width,
        y: rand() * w.height,
        r: 18 + rand() * 28,
      });
    }
    return arr;
  }, [w.width, w.height]);

  const canTribal =
    w.player.radius >= TRIBAL_RADIUS_THRESHOLD &&
    w.player.parts.length >= TRIBAL_PARTS_THRESHOLD;

  const goTribal = () => {
    reportRunEnd(w.player.radius);
    reportStageReached('tribal');
    setCarryOver({ parts: [...w.player.parts], radius: w.player.radius });
    setStage('tribal');
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
      <Canvas
        style={{ flex: 1, width, height, backgroundColor: PALETTE.ground }}
      >
        {/* Soft darker ground patches for visual texture */}
        {groundPatches(w.width, w.height, camX, camY, width, height)}

        {/* Decorative rocks (visible ones only) */}
        {rocks.map((r, i) => {
          const x = r.x - camX;
          const y = r.y - camY;
          if (
            x < -r.r ||
            y < -r.r ||
            x > width + r.r ||
            y > height + r.r
          )
            return null;
          return (
            <React.Fragment key={`rock-${i}`}>
              <Circle cx={x + 3} cy={y + 4} r={r.r} color="#000" opacity={0.25} />
              <Circle cx={x} cy={y} r={r.r} color={PALETTE.rock} />
              <Circle cx={x - r.r * 0.3} cy={y - r.r * 0.3} r={r.r * 0.55} color={PALETTE.rockShade} opacity={0.55} />
            </React.Fragment>
          );
        })}

        {/* Food (plants = grass tufts, meat = fruit) */}
        {w.food.map((f) => {
          const x = f.pos.x - camX;
          const y = f.pos.y - camY;
          if (x < -20 || y < -20 || x > width + 20 || y > height + 20)
            return null;
          if (f.kind === 'plant') {
            // Tuft of 3 small green dots
            return (
              <React.Fragment key={'f' + f.id}>
                <Circle cx={x - 3} cy={y + 1} r={f.radius * 0.7} color={PALETTE.grass} opacity={0.95} />
                <Circle cx={x + 3} cy={y + 1} r={f.radius * 0.7} color={PALETTE.grass} opacity={0.95} />
                <Circle cx={x} cy={y - 2} r={f.radius * 0.85} color="#7be38a" opacity={0.95} />
              </React.Fragment>
            );
          }
          // Fruit / berry
          return (
            <React.Fragment key={'f' + f.id}>
              <Circle cx={x} cy={y + 2} r={f.radius * 0.95} color="#000" opacity={0.3} />
              <Circle cx={x} cy={y} r={f.radius} color={PALETTE.fruit} />
              <Circle cx={x - f.radius * 0.35} cy={y - f.radius * 0.35} r={f.radius * 0.3} color="#ffb3a3" opacity={0.7} />
            </React.Fragment>
          );
        })}

        {/* AI creatures */}
        {w.cells.map((c) =>
          renderCreature(c, w.player.radius, camX, camY, width, height, t, false),
        )}

        {/* Player creature */}
        {renderCreature(w.player, w.player.radius, camX, camY, width, height, t, true)}

        {/* Particles */}
        {w.particles.map((p) => (
          <Circle
            key={'p' + p.id}
            cx={p.pos.x - camX}
            cy={p.pos.y - camY}
            r={p.radius * (p.life / p.maxLife)}
            color={p.color}
            opacity={Math.max(0, p.life / p.maxLife)}
          />
        ))}

        {/* Drag indicator */}
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

      <HUD
        hp={w.player.hp}
        maxHp={w.player.maxHp}
        radius={w.player.radius}
        diet={w.player.diet}
      />

      <DebugButton
        player={w.player}
        top={insets.top + 60}
        growBy={4}
        dnaPerTap={80}
        maxRadius={60}
      />

      {canTribal ? (
        <TribalButton bottom={insets.bottom + 24} onPress={goTribal} />
      ) : (
        <EvolveButton
          bottom={insets.bottom + 24}
          onPress={() => setEvolveOpen(true)}
        />
      )}

      <PauseButton
        top={insets.top + 14}
        onPress={() => {
          setStatus('menu');
          reportRunEnd(w.player.radius);
        }}
      />

      <MiniMap
        worldWidth={w.width}
        worldHeight={w.height}
        cam={{ x: camX, y: camY, w: width, h: height }}
        player={{ x: w.player.pos.x, y: w.player.pos.y, color: theme.colors.accent }}
        dots={[
          ...w.food.map((f) => ({
            x: f.pos.x,
            y: f.pos.y,
            color: f.kind === 'plant' ? '#7be38a' : '#e8634a',
            r: 0.9,
          })),
          ...w.cells.map((c) => ({
            x: c.pos.x,
            y: c.pos.y,
            color:
              c.radius > w.player.radius * 1.08
                ? '#d75c5c'
                : c.radius < w.player.radius * 0.92
                  ? '#a3d96c'
                  : '#e3c069',
            r: 1.7,
          })),
        ]}
        top={insets.top + 64}
        right={14}
      />

      <EvolveModal
        visible={evolveOpen}
        onClose={() => setEvolveOpen(false)}
        onApply={(parts) => {
          applyParts(w.player, parts);
          setEvolveOpen(false);
        }}
        currentParts={w.player.parts}
      />
    </View>
  );
}

function renderCreature(
  cell: Cell,
  playerR: number,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  t: number,
  isPlayer: boolean,
) {
  const x = cell.pos.x - camX;
  const y = cell.pos.y - camY;
  const r = cell.radius;
  // Cull off-screen (with margin for legs / tail)
  const margin = r * 2 + 10;
  if (x < -margin || y < -margin || x > vw + margin || y > vh + margin)
    return null;

  const vlen = Math.hypot(cell.vel.x, cell.vel.y);
  const moving = vlen > 8;
  const dir =
    vlen > 5
      ? { x: cell.vel.x / vlen, y: cell.vel.y / vlen }
      : { x: 0, y: -1 };
  // Perpendicular to direction (for legs sticking out sideways)
  const perp = { x: -dir.y, y: dir.x };
  const parts = new Set<PartId>(cell.parts);

  // Color: by relative size for AI, fixed for player
  const baseColor = isPlayer
    ? PALETTE.creatureBody
    : cell.radius > playerR * 1.08
      ? '#d75c5c'
      : cell.radius < playerR * 0.92
        ? '#a3d96c'
        : '#e3c069';
  const bellyColor = isPlayer
    ? PALETTE.creatureBelly
    : 'rgba(0,0,0,0.35)';
  const legColor = isPlayer ? PALETTE.creatureLeg : darken(baseColor);

  const els: React.ReactElement[] = [];
  const keyPrefix = (isPlayer ? 'p-' : 'c-' + cell.id + '-') + '';

  // Walk animation phase: 4 legs in two pairs, alternating
  const walkPhase = moving ? t * 8 : 0;

  // Legs (drawn FIRST so body covers their roots)
  const legCount = parts.has('jet') ? 6 : 4;
  for (let i = 0; i < legCount; i++) {
    // Distribute legs along the body, slightly offset perpendicular
    const along = ((i + 0.5) / legCount - 0.5) * r * 1.6;
    // alternate side per pair
    const side = i % 2 === 0 ? 1 : -1;
    const lx = x + dir.x * along + perp.x * side * (r * 0.85);
    const ly = y + dir.y * along + perp.y * side * (r * 0.85);
    const lift = moving
      ? Math.max(0, Math.sin(walkPhase + i * 1.3)) * Math.max(2, r * 0.18)
      : 0;
    // Foot offset further from body
    const fx = lx + perp.x * side * (r * 0.5);
    const fy = ly + perp.y * side * (r * 0.5) - lift;
    els.push(
      <Circle
        key={keyPrefix + 'legseg-' + i}
        cx={(lx + fx) / 2}
        cy={(ly + fy) / 2}
        r={Math.max(2.5, r * 0.16)}
        color={legColor}
      />,
    );
    els.push(
      <Circle
        key={keyPrefix + 'foot-' + i}
        cx={fx}
        cy={fy}
        r={Math.max(3, r * 0.22)}
        color={legColor}
      />,
    );
  }

  // Tail (behind, segments)
  const tailSegs = 4;
  for (let i = 1; i <= tailSegs; i++) {
    const wag = Math.sin(t * 4 + i * 0.7) * (moving ? 6 : 3);
    const tx = x - dir.x * (r + i * r * 0.45) + perp.x * wag * 0.18;
    const ty = y - dir.y * (r + i * r * 0.45) + perp.y * wag * 0.18;
    els.push(
      <Circle
        key={keyPrefix + 'tail-' + i}
        cx={tx}
        cy={ty}
        r={Math.max(2.5, r * 0.45 - i * r * 0.08)}
        color={baseColor}
        opacity={0.9 - i * 0.08}
      />,
    );
  }

  // Body shadow on ground
  els.push(
    <Circle
      key={keyPrefix + 'shadow'}
      cx={x}
      cy={y + r * 0.7}
      r={r * 0.95}
      color="#000"
      opacity={0.28}
    />,
  );

  // Body (main + belly highlight)
  els.push(
    <Circle key={keyPrefix + 'body'} cx={x} cy={y} r={r} color={baseColor} />,
  );
  els.push(
    <Circle
      key={keyPrefix + 'belly'}
      cx={x}
      cy={y + r * 0.25}
      r={r * 0.78}
      color={bellyColor}
      opacity={0.7}
    />,
  );

  // Shell back armor
  if (parts.has('shell')) {
    // a darker oval on top (back)
    els.push(
      <Circle
        key={keyPrefix + 'shell'}
        cx={x - dir.x * r * 0.1}
        cy={y - dir.y * r * 0.1 - r * 0.15}
        r={r * 0.85}
        color="#1f4e44"
        opacity={0.85}
      />,
    );
    // shell highlight ridge
    els.push(
      <Circle
        key={keyPrefix + 'shell-h'}
        cx={x - dir.x * r * 0.2}
        cy={y - dir.y * r * 0.2 - r * 0.25}
        r={r * 0.45}
        color="#3a8a7a"
        opacity={0.7}
      />,
    );
  }

  // Head: small forward bump
  const hx = x + dir.x * r * 0.85;
  const hy = y + dir.y * r * 0.85;
  els.push(
    <Circle key={keyPrefix + 'head'} cx={hx} cy={hy} r={r * 0.55} color={baseColor} />,
  );

  // Eye
  if (parts.has('eye') || isPlayer) {
    const ex = hx + dir.x * r * 0.18;
    const ey = hy + dir.y * r * 0.18;
    els.push(
      <Circle key={keyPrefix + 'eye-w'} cx={ex} cy={ey} r={r * 0.22} color="#f0fff8" />,
    );
    els.push(
      <Circle
        key={keyPrefix + 'eye-p'}
        cx={ex + dir.x * r * 0.06}
        cy={ey + dir.y * r * 0.06}
        r={r * 0.12}
        color="#0a0410"
      />,
    );
  }

  // Mouth / jaw
  if (parts.has('jaw')) {
    const mx = hx + dir.x * r * 0.5;
    const my = hy + dir.y * r * 0.5;
    els.push(
      <Circle
        key={keyPrefix + 'mouth'}
        cx={mx}
        cy={my}
        r={r * 0.28}
        color="#170611"
      />,
    );
    // fang
    els.push(
      <Circle
        key={keyPrefix + 'fang'}
        cx={mx + dir.x * r * 0.18}
        cy={my + dir.y * r * 0.18}
        r={r * 0.13}
        color={theme.colors.danger}
      />,
    );
  }

  // Spike → back ridge spines (3 spines along the back)
  if (parts.has('spike')) {
    for (let i = 0; i < 3; i++) {
      const along = (i - 1) * r * 0.45;
      const sx = x + dir.x * along;
      const sy = y + dir.y * along - r * 0.85;
      els.push(
        <Circle
          key={keyPrefix + 'spine-' + i}
          cx={sx}
          cy={sy}
          r={r * 0.18}
          color={theme.colors.danger}
        />,
      );
    }
  }

  // Filter → tongue / extra mouth cilia (small dots in front)
  if (parts.has('filter')) {
    for (let i = 0; i < 4; i++) {
      const along = r + (i + 1) * r * 0.18;
      const ofs = (i % 2 === 0 ? 1 : -1) * r * 0.12;
      els.push(
        <Circle
          key={keyPrefix + 'tongue-' + i}
          cx={x + dir.x * along + perp.x * ofs}
          cy={y + dir.y * along + perp.y * ofs}
          r={r * 0.09}
          color={PALETTE.fruit}
          opacity={0.8}
        />,
      );
    }
  }

  return <React.Fragment key={'creature-' + cell.id}>{els}</React.Fragment>;
}

function darken(hex: string) {
  // very rough: mix with #000 at 50%
  if (!hex.startsWith('#') || hex.length !== 7) return '#222';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (n: number) => Math.floor(n * 0.55).toString(16).padStart(2, '0');
  return '#' + d(r) + d(g) + d(b);
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
      // Pseudo-random hash from coords for shade variation
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

function EvolveButton({
  onPress,
  bottom,
}: {
  onPress: () => void;
  bottom: number;
}) {
  const dna = useGame((s) => s.dna);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.evolveBtn, { bottom }]}
    >
      <Text style={styles.evolveTxt}>EVRİL</Text>
      <Text style={styles.evolveDna}>{Math.floor(dna)} DNA</Text>
    </TouchableOpacity>
  );
}

function TribalButton({
  onPress,
  bottom,
}: {
  onPress: () => void;
  bottom: number;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.tribalBtn, { bottom }]}
    >
      <Text style={styles.tribalTxt}>KABİLE KUR</Text>
      <Text style={styles.tribalSub}>Kabile Evresine geç</Text>
    </TouchableOpacity>
  );
}

function PauseButton({
  onPress,
  top,
}: {
  onPress: () => void;
  top: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pauseBtn, { top }]}
      activeOpacity={0.7}
    >
      <Text style={styles.pauseTxt}>×</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.ground },
  evolveBtn: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 30,
    backgroundColor: theme.colors.bgPanel,
    borderColor: theme.colors.dna,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowColor: theme.colors.dna,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  evolveTxt: {
    color: theme.colors.dna,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  evolveDna: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 2,
  },
  tribalBtn: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 16,
    paddingHorizontal: 34,
    borderRadius: 32,
    backgroundColor: theme.colors.warning,
    alignItems: 'center',
    shadowColor: theme.colors.warning,
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  tribalTxt: {
    color: '#1a0d00',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tribalSub: {
    color: '#1a0d00',
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
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
});
