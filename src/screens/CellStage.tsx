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
import { applyParts, createWorld, stepWorld } from '../game/world';
import type { Cell, PartId, World } from '../game/types';
import HUD from '../components/HUD';
import EvolveModal from '../components/EvolveModal';
import DebugButton from '../components/DebugButton';
import MiniMap from '../components/MiniMap';
import AmbientParticles from '../components/AmbientParticles';
import Vignette from '../components/Vignette';

const FIXED_DT = 1 / 60;

// Player must be this big AND have this many parts to be allowed to crawl
// onto land into the Creature Stage.
const LAND_RADIUS_THRESHOLD = 30;
const LAND_PARTS_THRESHOLD = 3;

export default function CellStage() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const setCarryOver = useGame((s) => s.setCarryOver);
  const reportRunEnd = useGame((s) => s.reportRunEnd);
  const reportStageReached = useGame((s) => s.reportStageReached);
  const addDna = useGame((s) => s.addDna);
  const status = useGame((s) => s.status);

  const worldRef = useRef<World>(createWorld());
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
    const t = e.nativeEvent.touches[0];
    lastTouchRef.current = { x: t.pageX, y: t.pageY };
    inputRef.current = { x: 0, y: 0 };
    setDrag({ ox: t.pageX, oy: t.pageY, cx: t.pageX, cy: t.pageY });
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!lastTouchRef.current) {
      lastTouchRef.current = { x: t.pageX, y: t.pageY };
      return;
    }
    const dx = t.pageX - lastTouchRef.current.x;
    const dy = t.pageY - lastTouchRef.current.y;
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
        ? { ...prev, cx: t.pageX, cy: t.pageY }
        : { ox: t.pageX, oy: t.pageY, cx: t.pageX, cy: t.pageY },
    );
  };
  const onTouchEnd = () => {
    inputRef.current = { x: 0, y: 0 };
    lastTouchRef.current = null;
    setDrag(null);
  };

  const bg = useMemo(() => theme.colors.bgDeep, []);

  const canLand =
    w.player.radius >= LAND_RADIUS_THRESHOLD &&
    w.player.parts.length >= LAND_PARTS_THRESHOLD;

  const goCreature = () => {
    reportRunEnd(w.player.radius);
    reportStageReached('creature');
    setCarryOver({ parts: [...w.player.parts], radius: w.player.radius });
    setStage('creature');
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
      <Canvas style={{ flex: 1, width, height, backgroundColor: bg }}>
        {/* Petri-dish water gradient (screen-space) */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width * 0.5, height * 0.45)}
            r={Math.max(width, height) * 0.85}
            colors={['#0d1f3d', '#070d24', '#02050f']}
            positions={[0, 0.55, 1]}
          />
        </Rect>

        {gridDots(w.width, w.height, camX, camY, width, height)}

        {w.food.map((f) => {
          const x = f.pos.x - camX;
          const y = f.pos.y - camY;
          if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return null;
          return (
            <Circle
              key={'f' + f.id}
              cx={x}
              cy={y}
              r={f.radius}
              color={f.kind === 'plant' ? theme.colors.plant : theme.colors.meat}
              opacity={0.95}
            />
          );
        })}

        {w.cells.map((c) => {
          const x = c.pos.x - camX;
          const y = c.pos.y - camY;
          if (
            x < -c.radius - 6 ||
            y < -c.radius - 6 ||
            x > width + c.radius + 6 ||
            y > height + c.radius + 6
          )
            return null;
          const playerR = w.player.radius;
          const colorBase =
            c.radius > playerR * 1.08
              ? theme.colors.danger
              : c.radius < playerR * 0.92
                ? theme.colors.plant
                : theme.colors.warning;
          return (
            <React.Fragment key={'c' + c.id}>
              <Circle cx={x} cy={y} r={c.radius + 3} color={colorBase} opacity={0.18} />
              <Circle cx={x} cy={y} r={c.radius} color={colorBase} opacity={0.85} />
              <Circle
                cx={x}
                cy={y}
                r={Math.max(2, c.radius * 0.45)}
                color={theme.colors.bgDeep}
                opacity={0.5}
              />
            </React.Fragment>
          );
        })}

        {renderPlayer(w.player, camX, camY)}

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

        {/* Drag indicator: origin ring + dotted path + cursor */}
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

      {/* Tiny microbes drifting in the water */}
      <AmbientParticles
        width={width}
        height={height}
        count={32}
        speed={8}
        color="#9ec0ff"
        size={{ min: 0.5, max: 1.2 }}
        tick={t}
        seed={1234}
      />

      {/* Cinematic vignette */}
      <Vignette width={width} height={height} color="#000000" intensity={0.6} />

      <HUD
        hp={w.player.hp}
        maxHp={w.player.maxHp}
        radius={w.player.radius}
        diet={w.player.diet}
      />

      <DebugButton
        player={w.player}
        top={insets.top + 60}
        growBy={3}
        dnaPerTap={60}
        maxRadius={60}
      />

      {canLand ? (
        <LandButton bottom={insets.bottom + 24} onPress={goCreature} />
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
            color:
              f.kind === 'plant' ? theme.colors.plant : theme.colors.meat,
            r: 0.9,
          })),
          ...w.cells.map((c) => ({
            x: c.pos.x,
            y: c.pos.y,
            color:
              c.radius > w.player.radius * 1.08
                ? theme.colors.danger
                : c.radius < w.player.radius * 0.92
                  ? theme.colors.plant
                  : theme.colors.warning,
            r: 1.6,
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

function renderPlayer(player: Cell, camX: number, camY: number) {
  const px = player.pos.x - camX;
  const py = player.pos.y - camY;
  const pr = player.radius;
  const vlen = Math.hypot(player.vel.x, player.vel.y);
  const dir =
    vlen > 5
      ? { x: player.vel.x / vlen, y: player.vel.y / vlen }
      : { x: 0, y: -1 };
  const parts = new Set<PartId>(player.parts);
  const els: React.ReactElement[] = [];

  // bloom (soft BlurMask glow behind everything)
  els.push(
    <Circle
      key="bloom"
      cx={px}
      cy={py}
      r={pr * 1.7}
      color={theme.colors.player}
      opacity={0.45}
    >
      <BlurMask blur={20} style="solid" />
    </Circle>,
  );
  // outer aura
  els.push(
    <Circle
      key="halo"
      cx={px}
      cy={py}
      r={pr + 8}
      color={theme.colors.player}
      opacity={0.18}
    />,
  );
  // shell
  if (parts.has('shell')) {
    els.push(
      <Circle
        key="shell-outer"
        cx={px}
        cy={py}
        r={pr + 4}
        color="#a8f5e3"
        opacity={0.55}
      />,
    );
    els.push(
      <Circle
        key="shell-mid"
        cx={px}
        cy={py}
        r={pr + 2}
        color={theme.colors.bgDeep}
        opacity={0.4}
      />,
    );
  }
  // jet trail (rendered behind body)
  if (parts.has('jet')) {
    for (let i = 0; i < 4; i++) {
      const off = pr + (i + 1) * pr * 0.45;
      els.push(
        <Circle
          key={`jet-${i}`}
          cx={px - dir.x * off}
          cy={py - dir.y * off}
          r={Math.max(2, (pr * 0.34) / (i + 1))}
          color={theme.colors.accent}
          opacity={0.55 / (i + 1)}
        />,
      );
    }
  }
  // body
  els.push(
    <Circle key="body" cx={px} cy={py} r={pr} color={theme.colors.player} />,
  );
  // nucleus
  els.push(
    <Circle
      key="nucleus"
      cx={px}
      cy={py}
      r={Math.max(3, pr * 0.5)}
      color={theme.colors.playerInner}
    />,
  );
  // spikes
  if (parts.has('spike')) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      els.push(
        <Circle
          key={`spike-${i}`}
          cx={px + Math.cos(a) * pr * 1.2}
          cy={py + Math.sin(a) * pr * 1.2}
          r={Math.max(2, pr * 0.18)}
          color={theme.colors.danger}
        />,
      );
    }
  }
  // filter cilia
  if (parts.has('filter')) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      els.push(
        <Circle
          key={`filter-${i}`}
          cx={px + Math.cos(a) * pr * 1.08}
          cy={py + Math.sin(a) * pr * 1.08}
          r={Math.max(1.4, pr * 0.09)}
          color={theme.colors.plant}
          opacity={0.85}
        />,
      );
    }
  }
  // jaw
  if (parts.has('jaw')) {
    els.push(
      <Circle
        key="jaw-shadow"
        cx={px + dir.x * pr * 0.65}
        cy={py + dir.y * pr * 0.65}
        r={pr * 0.36}
        color="#170611"
        opacity={0.85}
      />,
    );
    els.push(
      <Circle
        key="jaw-fang"
        cx={px + dir.x * pr * 0.85}
        cy={py + dir.y * pr * 0.85}
        r={pr * 0.18}
        color={theme.colors.danger}
      />,
    );
  }
  // eye
  if (parts.has('eye')) {
    els.push(
      <Circle
        key="eye-sclera"
        cx={px + dir.x * pr * 0.42}
        cy={py + dir.y * pr * 0.42}
        r={pr * 0.34}
        color="#f0fff8"
      />,
    );
    els.push(
      <Circle
        key="eye-pupil"
        cx={px + dir.x * pr * 0.52}
        cy={py + dir.y * pr * 0.52}
        r={pr * 0.18}
        color="#0a0410"
      />,
    );
  }
  return els;
}

function gridDots(
  worldW: number,
  worldH: number,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
) {
  const step = 120;
  const dots = [];
  const startX = Math.max(step / 2, Math.floor(camX / step) * step + step / 2);
  const endX = Math.min(worldW, camX + vw + step);
  const startY = Math.max(step / 2, Math.floor(camY / step) * step + step / 2);
  const endY = Math.min(worldH, camY + vh + step);
  for (let x = startX; x < endX; x += step) {
    for (let y = startY; y < endY; y += step) {
      dots.push(
        <Circle
          key={`g${x}-${y}`}
          cx={x - camX}
          cy={y - camY}
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

function LandButton({
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
      style={[styles.landBtn, { bottom }]}
    >
      <Text style={styles.landTxt}>KARAYA ÇIK</Text>
      <Text style={styles.landSub}>Yaratık Evresine geç</Text>
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
  landBtn: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 16,
    paddingHorizontal: 34,
    borderRadius: 32,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  landTxt: {
    color: theme.colors.bgDeep,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  landSub: {
    color: theme.colors.bgDeep,
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
