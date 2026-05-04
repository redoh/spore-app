import React, { useEffect, useState } from 'react';
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

export default function SpaceStage() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const setStatus = useGame((s) => s.setStatus);
  const setStage = useGame((s) => s.setStage);
  const totalDna = useGame((s) => s.totalDna);
  const bestStage = useGame((s) => s.bestStage);

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

  const t = tick / 60;

  // Stars (deterministic)
  const stars = Array.from({ length: 160 }, (_, i) => ({
    x: ((i * 137.508) % width) | 0,
    y: ((i * 91.327) % height) | 0,
    r: 0.6 + (i % 4) * 0.4,
  }));

  // Planet positions (orbit around center)
  const cx = width / 2;
  const cy = height * 0.45;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Canvas style={{ flex: 1, width, height, backgroundColor: '#02050f' }}>
        {/* nebula */}
        <Circle cx={width * 0.7} cy={height * 0.3} r={260} color="#3a1f5c" opacity={0.25} />
        <Circle cx={width * 0.25} cy={height * 0.6} r={200} color="#1f3a5c" opacity={0.25} />

        {/* stars */}
        {stars.map((s, i) => {
          const tw = (Math.sin(t * 1.4 + i * 0.3) + 1) / 2;
          return (
            <Circle
              key={`st-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.r}
              color="#cee0ff"
              opacity={0.4 + tw * 0.55}
            />
          );
        })}

        {/* central sun */}
        <Circle cx={cx} cy={cy} r={50} color="#ffd47a" />
        <Circle cx={cx} cy={cy} r={70} color="#ffae3d" opacity={0.4} />
        <Circle cx={cx} cy={cy} r={110} color="#ff8a3a" opacity={0.18} />

        {/* orbiting planets */}
        {[
          { d: 130, period: 6, r: 14, color: '#6cf0d3' },
          { d: 200, period: 11, r: 22, color: '#a98bff' },
          { d: 280, period: 18, r: 18, color: '#e3826a' },
        ].map((p, i) => {
          const a = (t / p.period) * Math.PI * 2 + i * 1.3;
          const px = cx + Math.cos(a) * p.d;
          const py = cy + Math.sin(a) * p.d * 0.5;
          // orbit ring (faint)
          const ringEls: React.ReactElement[] = [];
          for (let j = 0; j < 30; j++) {
            const ra = (j / 30) * Math.PI * 2;
            ringEls.push(
              <Circle
                key={`or-${i}-${j}`}
                cx={cx + Math.cos(ra) * p.d}
                cy={cy + Math.sin(ra) * p.d * 0.5}
                r={1}
                color="#3a4a6a"
                opacity={0.25}
              />,
            );
          }
          return (
            <React.Fragment key={`pl-${i}`}>
              {ringEls}
              <Circle cx={px} cy={py + 2} r={p.r} color="#000" opacity={0.4} />
              <Circle cx={px} cy={py} r={p.r} color={p.color} />
              <Circle cx={px - p.r * 0.3} cy={py - p.r * 0.3} r={p.r * 0.55} color="#ffffff" opacity={0.18} />
            </React.Fragment>
          );
        })}

        {/* player ship orbiting outermost */}
        {(() => {
          const a = (t / 4) * Math.PI * 2;
          const d = 360;
          const sx = cx + Math.cos(a) * d;
          const sy = cy + Math.sin(a) * d * 0.5;
          const dirX = -Math.sin(a);
          const dirY = Math.cos(a) * 0.5;
          // engine flame
          return (
            <>
              <Circle cx={sx - dirX * 16} cy={sy - dirY * 16} r={6} color="#ffae3d" opacity={0.85} />
              <Circle cx={sx - dirX * 22} cy={sy - dirY * 22} r={4} color="#ffd47a" opacity={0.7} />
              <Circle cx={sx} cy={sy + 1} r={11} color="#000" opacity={0.4} />
              <Circle cx={sx} cy={sy} r={11} color={theme.colors.accent} />
              <Circle cx={sx + dirX * 6} cy={sy + dirY * 6} r={6} color="#0a0410" />
            </>
          );
        })()}
      </Canvas>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.banner}>
          <Text style={styles.eyebrow}>SON EVRE</Text>
          <Text style={styles.title}>Uzay Evresi</Text>
          <Text style={styles.body}>
            Gezegenden çıktın. Yıldızlar arasında yeni dünyalar keşfediyor,
            ittifaklar kuruyor, imparatorluğunu büyütüyorsun. Bu, evrenin
            efendisi olma yolculuğu.
          </Text>
          <Text style={[styles.body, { color: theme.colors.warning }]}>
            Bu evre yapım aşamasında. Yakında: yıldız haritası, gezegen
            sömürgeleştirme, uzay savaşları, yapay zeka türleriyle
            etkileşim.
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>TOPLAM DNA</Text>
              <Text style={styles.statV}>{Math.floor(totalDna)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>ULAŞILAN EN İYİ</Text>
              <Text style={styles.statV}>{stageLabel(bestStage)}</Text>
            </View>
          </View>
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
              setStage('civilization');
              setStatus('playing');
            }}
            style={[styles.btn, styles.btnPrimary]}
          >
            <Text style={styles.btnPrimaryTxt}>Medeniyet Evresine Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function stageLabel(s: string) {
  switch (s) {
    case 'cell':
      return 'Hücre';
    case 'creature':
      return 'Yaratık';
    case 'tribal':
      return 'Kabile';
    case 'civilization':
      return 'Medeniyet';
    case 'space':
      return 'Uzay';
    default:
      return s;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02050f' },
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
    color: theme.colors.dna,
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
  statsRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: theme.colors.bgPanel,
    borderRadius: 10,
    padding: 10,
  },
  statLabel: {
    color: theme.colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  statV: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: 10 },
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
