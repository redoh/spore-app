import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';

import { theme } from '../theme';

export type MiniDot = {
  x: number;
  y: number;
  color: string;
  r?: number;
  opacity?: number;
};

type Props = {
  size?: number;
  worldWidth: number;
  worldHeight: number;
  cam: { x: number; y: number; w: number; h: number };
  player: { x: number; y: number; color?: string; r?: number };
  dots: MiniDot[];
  // Position from screen edge
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export default function MiniMap({
  size = 130,
  worldWidth,
  worldHeight,
  cam,
  player,
  dots,
  top,
  right,
  bottom,
  left,
}: Props) {
  const sx = size / worldWidth;
  const sy = size / worldHeight;
  const vpX = cam.x * sx;
  const vpY = cam.y * sy;
  const vpW = Math.max(6, Math.min(size, cam.w * sx));
  const vpH = Math.max(6, Math.min(size, cam.h * sy));

  const pos = {
    ...(top !== undefined ? { top } : null),
    ...(right !== undefined ? { right } : null),
    ...(bottom !== undefined ? { bottom } : null),
    ...(left !== undefined ? { left } : null),
  };

  return (
    <View
      style={[styles.frame, { width: size, height: size }, pos]}
      pointerEvents="none"
    >
      <Canvas style={{ flex: 1 }}>
        {dots.map((d, i) => (
          <Circle
            key={i}
            cx={d.x * sx}
            cy={d.y * sy}
            r={d.r ?? 1.4}
            color={d.color}
            opacity={d.opacity ?? 0.85}
          />
        ))}
        {/* player marker (pulsing halo + dot) */}
        <Circle
          cx={player.x * sx}
          cy={player.y * sy}
          r={(player.r ?? 3.2) + 2}
          color="#ffffff"
          opacity={0.35}
        />
        <Circle
          cx={player.x * sx}
          cy={player.y * sy}
          r={player.r ?? 3.2}
          color={player.color ?? theme.colors.accent}
        />
      </Canvas>
      {/* viewport rectangle */}
      <View
        style={[
          styles.viewport,
          { left: vpX, top: vpY, width: vpW, height: vpH },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewport: {
    position: 'absolute',
    borderColor: '#ffffff',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
