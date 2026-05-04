import React, { useMemo } from 'react';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

type Props = {
  width: number;
  height: number;
  count?: number;
  speed?: number; // pixels per "tick" unit (effectively per second since tick = seconds)
  color?: string;
  size?: { min: number; max: number };
  tick: number;
  // Drift direction multipliers (negative drift to bias upward, etc.)
  driftBias?: { x: number; y: number };
  // Seed so each instance can have independent particle field
  seed?: number;
};

const seedRand = (seed: number) => {
  let s = seed % 233280;
  if (s <= 0) s = 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/**
 * Deterministic ambient particle field rendered on top of a stage. Particles
 * drift slowly and wrap around the canvas so the field never depletes.
 * Position is a function of the `tick` prop so the host stage drives motion.
 */
export default function AmbientParticles({
  width,
  height,
  count = 40,
  speed = 14,
  color = '#ffffff',
  size = { min: 0.6, max: 1.6 },
  tick,
  driftBias = { x: 0, y: 0 },
  seed = 7777,
}: Props) {
  const particles = useMemo(() => {
    const r = seedRand(seed);
    return Array.from({ length: count }, () => ({
      x: r() * width,
      y: r() * height,
      vx: (r() - 0.5) * 2 * speed + driftBias.x * speed,
      vy: (r() - 0.5) * 2 * speed + driftBias.y * speed,
      sz: size.min + r() * (size.max - size.min),
      op: 0.2 + r() * 0.55,
    }));
  }, [width, height, count, speed, seed, driftBias.x, driftBias.y, size.min, size.max]);

  return (
    <View style={[styles.fill, { width, height }]} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        {particles.map((p, i) => {
          const x = (((p.x + p.vx * tick) % width) + width) % width;
          const y = (((p.y + p.vy * tick) % height) + height) % height;
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={p.sz}
              color={color}
              opacity={p.op}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
});
