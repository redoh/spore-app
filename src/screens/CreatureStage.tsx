import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { useGame } from '../game/store';

export default function CreatureStage() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const totalDna = useGame((s) => s.totalDna);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Slow drifting horizon decoration
  const decor = useMemo(() => makeDecor(width, height), [width, height]);
  const t = tick / 60; // seconds approx
  const cx = width / 2;
  const groundY = height * 0.78;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Canvas style={{ flex: 1, width, height, backgroundColor: '#0e1733' }}>
        {/* "stars" / sparse parallax dots */}
        {decor.stars.map((s, i) => (
          <Circle
            key={`s-${i}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            color="#3a4d80"
            opacity={s.o}
          />
        ))}
        {/* hills (just stacked circles for primitive landscape) */}
        {decor.hills.map((h, i) => (
          <Circle
            key={`h-${i}`}
            cx={h.x}
            cy={h.y + Math.sin(t * 0.4 + i) * 1.5}
            r={h.r}
            color={h.c}
            opacity={0.95}
          />
        ))}

        {/* sea behind ground */}
        <Circle cx={cx} cy={height * 1.4} r={height * 0.85} color="#0a3a4f" />

        {/* ground line */}
        <Circle cx={cx} cy={groundY + 220} r={260} color="#3a2a16" />
        <Circle cx={cx - 90} cy={groundY + 230} r={250} color="#3a2a16" />
        <Circle cx={cx + 90} cy={groundY + 230} r={250} color="#3a2a16" />

        {/* creature: a body with legs and an eye, bouncing slightly */}
        {(() => {
          const bx = cx;
          const by = groundY - 6 - Math.abs(Math.sin(t * 2.5)) * 4;
          const r = 30;
          const els: React.ReactElement[] = [];
          // legs
          for (let i = 0; i < 4; i++) {
            const off = (i - 1.5) * 18;
            const phase = t * 6 + i * 1.4;
            const lift = Math.max(0, Math.sin(phase)) * 6;
            els.push(
              <Circle
                key={`leg-${i}`}
                cx={bx + off}
                cy={by + r + 14 - lift}
                r={6}
                color="#2c8a76"
              />,
            );
            els.push(
              <Circle
                key={`foot-${i}`}
                cx={bx + off}
                cy={by + r + 22 - lift}
                r={5}
                color="#1f6356"
              />,
            );
          }
          // body shadow
          els.push(
            <Circle
              key="bshadow"
              cx={bx}
              cy={by + r + 26}
              r={r * 0.7}
              color="#000"
              opacity={0.35}
            />,
          );
          // body
          els.push(
            <Circle
              key="body"
              cx={bx}
              cy={by}
              r={r}
              color={theme.colors.player}
            />,
          );
          els.push(
            <Circle
              key="bellyshade"
              cx={bx}
              cy={by + r * 0.2}
              r={r * 0.85}
              color="#3da291"
              opacity={0.55}
            />,
          );
          // head bump
          els.push(
            <Circle
              key="head"
              cx={bx + 18}
              cy={by - r * 0.5}
              r={r * 0.55}
              color={theme.colors.player}
            />,
          );
          // eye
          els.push(
            <Circle
              key="eye-w"
              cx={bx + 26}
              cy={by - r * 0.65}
              r={6}
              color="#f0fff8"
            />,
          );
          els.push(
            <Circle
              key="eye-p"
              cx={bx + 28}
              cy={by - r * 0.6}
              r={3}
              color="#0a0410"
            />,
          );
          // tail
          for (let i = 1; i <= 3; i++) {
            const wag = Math.sin(t * 4 + i * 0.6) * 4 * i;
            els.push(
              <Circle
                key={`tail-${i}`}
                cx={bx - r - i * 10}
                cy={by + i * 2 + wag * 0.3}
                r={Math.max(3, r * 0.4 - i * 4)}
                color={theme.colors.player}
                opacity={0.95 - i * 0.1}
              />,
            );
          }
          return els;
        })()}
      </Canvas>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.banner}>
          <Text style={styles.eyebrow}>YENİ EVRE</Text>
          <Text style={styles.title}>Yaratık Evresi</Text>
          <Text style={styles.body}>
            Karaya çıktın. Şimdi sürünerek yiyecek arıyor, daha karmaşık
            uzuvlar geliştiriyorsun.
          </Text>
          <Text style={[styles.body, { color: theme.colors.warning }]}>
            Bu evrenin oynanışı yapım aşamasında — yakında hareket, çene/pençe
            takma ve diğer yaratıklarla karşılaşma.
          </Text>
          <Text style={styles.stat}>
            Toplam DNA · <Text style={styles.statV}>{Math.floor(totalDna)}</Text>
          </Text>
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
          <TouchableOpacity
            onPress={() => {
              setStage('cell');
              setStatus('menu');
            }}
            style={[styles.btn, styles.btnGhost]}
          >
            <Text style={styles.btnGhostTxt}>Ana Menü</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setStage('cell');
              setStatus('playing');
            }}
            style={[styles.btn, styles.btnPrimary]}
          >
            <Text style={styles.btnPrimaryTxt}>Hücre Evresine Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeDecor(width: number, height: number) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.5,
      r: Math.random() * 1.4 + 0.6,
      o: Math.random() * 0.7 + 0.2,
    });
  }
  const hills = [
    { x: width * 0.2, y: height * 0.65, r: 100, c: '#1d2950' },
    { x: width * 0.55, y: height * 0.62, r: 130, c: '#1f2d57' },
    { x: width * 0.85, y: height * 0.66, r: 90, c: '#1d2950' },
  ];
  return { stars, hills };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e1733' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  banner: {
    marginTop: 24,
    backgroundColor: 'rgba(11,18,38,0.85)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  body: {
    color: theme.colors.textDim,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  stat: {
    color: theme.colors.textDim,
    marginTop: 14,
    fontSize: 12,
  },
  statV: {
    color: theme.colors.dna,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: 'rgba(11,18,38,0.85)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnGhostTxt: { color: theme.colors.text, fontWeight: '700' },
  btnPrimaryTxt: {
    color: theme.colors.bgDeep,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
