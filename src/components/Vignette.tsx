import React from 'react';
import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

type Props = {
  width: number;
  height: number;
  color?: string;
  intensity?: number; // 0..1
};

/**
 * Vignette overlay — radial gradient from transparent in the middle to a
 * darker edge color around the perimeter. Adds depth/focus.
 */
export default function Vignette({
  width,
  height,
  color = '#000000',
  intensity = 0.6,
}: Props) {
  const r = Math.max(width, height) * 0.85;
  // Build hex color w/ alpha for the outer ring
  const hex =
    color.length === 7
      ? color +
        Math.max(0, Math.min(255, Math.floor(intensity * 255)))
          .toString(16)
          .padStart(2, '0')
      : color;
  return (
    <View style={[styles.fill, { width, height }]} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width / 2, height / 2)}
            r={r}
            colors={[color + '00', color + '00', hex]}
            positions={[0, 0.55, 1]}
          />
        </Rect>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
});
