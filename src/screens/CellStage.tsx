import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';
import { useGame } from '../game/store';
import { applyParts, createWorld, stepWorld } from '../game/world';
import type { World } from '../game/types';
import HUD from '../components/HUD';
import EvolveModal from '../components/EvolveModal';

const FIXED_DT = 1 / 60;

export default function CellStage() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setStatus = useGame((s) => s.setStatus);
  const reportRunEnd = useGame((s) => s.reportRunEnd);
  const addDna = useGame((s) => s.addDna);
  const status = useGame((s) => s.status);

  const worldRef = useRef<World>(createWorld());
  const inputRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [evolveOpen, setEvolveOpen] = useState(false);

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

      // Pause sim while modal open or status not playing
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

  // Camera offset (clamped so we don't show beyond world bounds)
  const camX = Math.max(0, Math.min(w.width - width, w.player.pos.x - width / 2));
  const camY = Math.max(
    0,
    Math.min(w.height - height, w.player.pos.y - height / 2),
  );

  const onTouchStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    lastTouchRef.current = { x: t.pageX, y: t.pageY };
    inputRef.current = { x: 0, y: 0 };
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!lastTouchRef.current) {
      lastTouchRef.current = { x: t.pageX, y: t.pageY };
      return;
    }
    const dx = t.pageX - lastTouchRef.current.x;
    const dy = t.pageY - lastTouchRef.current.y;
    const max = 90;
    const mag = Math.hypot(dx, dy);
    const m = Math.min(1, mag / max);
    if (mag > 0.01) {
      inputRef.current = {
        x: (dx / mag) * m,
        y: (dy / mag) * m,
      };
    } else inputRef.current = { x: 0, y: 0 };
  };
  const onTouchEnd = () => {
    inputRef.current = { x: 0, y: 0 };
    lastTouchRef.current = null;
  };

  // Simple visual bg layer
  const bg = useMemo(() => theme.colors.bgDeep, []);

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
      <Canvas style={{ flex: 1, width, height, backgroundColor: bg }}>
        {/* World bounds frame */}
        <Group transform={[{ translateX: -camX }, { translateY: -camY }]}>
          <Rect x={0} y={0} width={w.width} height={w.height}>
            <RadialGradient
              c={vec(w.width / 2, w.height / 2)}
              r={Math.max(w.width, w.height) / 1.4}
              colors={['#0d1736', '#03060f']}
            />
          </Rect>
          {/* Grid dots for parallax feel */}
          {gridDots(w.width, w.height)}

          {/* Food */}
          {w.food.map((f) => (
            <Circle
              key={'f' + f.id}
              cx={f.pos.x}
              cy={f.pos.y}
              r={f.radius}
              color={f.kind === 'plant' ? theme.colors.plant : theme.colors.meat}
              opacity={0.95}
            />
          ))}

          {/* AI cells */}
          {w.cells.map((c) => {
            const playerR = w.player.radius;
            const colorBase =
              c.radius > playerR * 1.08
                ? theme.colors.danger
                : c.radius < playerR * 0.92
                  ? theme.colors.plant
                  : theme.colors.warning;
            return (
              <Group key={'c' + c.id}>
                <Circle
                  cx={c.pos.x}
                  cy={c.pos.y}
                  r={c.radius + 3}
                  color={colorBase}
                  opacity={0.18}
                />
                <Circle
                  cx={c.pos.x}
                  cy={c.pos.y}
                  r={c.radius}
                  color={colorBase}
                  opacity={0.85}
                />
                <Circle
                  cx={c.pos.x}
                  cy={c.pos.y}
                  r={Math.max(2, c.radius * 0.45)}
                  color={theme.colors.bgDeep}
                  opacity={0.5}
                />
              </Group>
            );
          })}

          {/* Player */}
          <Group>
            <Circle
              cx={w.player.pos.x}
              cy={w.player.pos.y}
              r={w.player.radius + 6}
              color={theme.colors.player}
              opacity={0.2}
            />
            <Circle
              cx={w.player.pos.x}
              cy={w.player.pos.y}
              r={w.player.radius}
              color={theme.colors.player}
            />
            <Circle
              cx={w.player.pos.x}
              cy={w.player.pos.y}
              r={Math.max(3, w.player.radius * 0.5)}
              color={theme.colors.playerInner}
            />
          </Group>

          {/* Particles */}
          {w.particles.map((p) => (
            <Circle
              key={'p' + p.id}
              cx={p.pos.x}
              cy={p.pos.y}
              r={p.radius * (p.life / p.maxLife)}
              color={p.color}
              opacity={Math.max(0, p.life / p.maxLife)}
            />
          ))}
        </Group>
      </Canvas>

      <View style={styles.debug} pointerEvents="none">
        <Text style={styles.debugText}>
          {width}x{height} · f{tick} · cells {w.cells.length} · food{' '}
          {w.food.length} · p({w.player.pos.x.toFixed(0)},
          {w.player.pos.y.toFixed(0)}) cam({camX.toFixed(0)},{camY.toFixed(0)})
        </Text>
      </View>

      <HUD
        hp={w.player.hp}
        maxHp={w.player.maxHp}
        radius={w.player.radius}
        diet={w.player.diet}
      />

      <EvolveButton
        bottom={insets.bottom + 24}
        onPress={() => setEvolveOpen(true)}
      />

      <PauseButton
        top={insets.top + 14}
        onPress={() => {
          setStatus('menu');
          reportRunEnd(w.player.radius);
        }}
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

function gridDots(w: number, h: number) {
  const step = 120;
  const dots = [];
  for (let x = step / 2; x < w; x += step) {
    for (let y = step / 2; y < h; y += step) {
      dots.push(
        <Circle
          key={`g${x}-${y}`}
          cx={x}
          cy={y}
          r={1.3}
          color="#1d2a52"
          opacity={0.6}
        />,
      );
    }
  }
  return dots;
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
  root: { flex: 1, backgroundColor: theme.colors.bgDeep },
  debug: {
    position: 'absolute',
    bottom: 90,
    left: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,0,0.18)',
    borderRadius: 6,
  },
  debugText: {
    color: theme.colors.warning,
    fontSize: 10,
    fontFamily: 'monospace',
  },
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
  pauseBtn: {
    position: 'absolute',
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.bgPanel,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
