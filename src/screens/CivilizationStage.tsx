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

export default function CivilizationStage() {
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
  const groundY = height * 0.78;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Canvas style={{ flex: 1, width, height, backgroundColor: '#0c1a2c' }}>
        {/* Sky gradient (faked with stacked translucent circles) */}
        <Circle cx={width * 0.5} cy={-200} r={width * 1.2} color="#1a3a5c" opacity={0.6} />

        {/* Sun behind buildings */}
        <Circle cx={width * 0.78} cy={height * 0.28} r={42} color="#ffd6a5" opacity={0.8} />
        <Circle cx={width * 0.78} cy={height * 0.28} r={68} color="#ffae3d" opacity={0.18} />

        {/* Hills */}
        <Circle cx={width * 0.2} cy={groundY + 50} r={140} color="#2c3850" />
        <Circle cx={width * 0.8} cy={groundY + 60} r={170} color="#243049" />

        {/* Ground */}
        <Circle cx={width / 2} cy={groundY + 380} r={460} color="#1a2236" />
        <Circle cx={width / 2 - 220} cy={groundY + 400} r={440} color="#1a2236" />
        <Circle cx={width / 2 + 220} cy={groundY + 400} r={440} color="#1a2236" />

        {/* Buildings — stylized blocks built from circles */}
        {[
          { x: width * 0.18, h: 60, color: '#3a4a6a' },
          { x: width * 0.32, h: 110, color: '#475a82' },
          { x: width * 0.46, h: 75, color: '#3a4a6a' },
          { x: width * 0.58, h: 140, color: '#5670a0' },
          { x: width * 0.7, h: 90, color: '#3a4a6a' },
          { x: width * 0.84, h: 65, color: '#475a82' },
        ].map((b, i) => {
          const els: React.ReactElement[] = [];
          const baseY = groundY - b.h / 2;
          // building body
          els.push(
            <Circle
              key={`b-body-${i}`}
              cx={b.x}
              cy={baseY}
              r={Math.max(b.h * 0.4, 30)}
              color={b.color}
            />,
          );
          // top
          els.push(
            <Circle
              key={`b-top-${i}`}
              cx={b.x}
              cy={baseY - b.h * 0.3}
              r={Math.max(b.h * 0.25, 18)}
              color={b.color}
            />,
          );
          // window lights — twinkle
          for (let r = 0; r < 3; r++) {
            for (let c = -1; c <= 1; c++) {
              const wx = b.x + c * 8;
              const wy = baseY - b.h * 0.3 + r * 12;
              const lit =
                ((Math.sin(t * 1.7 + i * 1.7 + r + c) + 1) / 2) > 0.55;
              els.push(
                <Circle
                  key={`b-win-${i}-${r}-${c}`}
                  cx={wx}
                  cy={wy}
                  r={1.6}
                  color={lit ? '#ffd47a' : '#1a1a26'}
                  opacity={lit ? 0.95 : 0.6}
                />,
              );
            }
          }
          return <React.Fragment key={`b-${i}`}>{els}</React.Fragment>;
        })}

        {/* Flying machine drifting across */}
        {(() => {
          const fx = ((t * 30) % (width + 200)) - 100;
          const fy = height * 0.32 + Math.sin(t * 2) * 4;
          return (
            <>
              <Circle cx={fx} cy={fy} r={9} color={theme.colors.accent} />
              <Circle cx={fx - 6} cy={fy + 2} r={6} color={theme.colors.accent} opacity={0.85} />
              <Circle cx={fx + 8} cy={fy + 1} r={5} color={theme.colors.accent} opacity={0.7} />
              <Circle cx={fx} cy={fy - 4} r={3} color={theme.colors.warning} />
            </>
          );
        })()}
      </Canvas>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.banner}>
          <Text style={styles.eyebrow}>YENİ EVRE</Text>
          <Text style={styles.title}>Medeniyet Evresi</Text>
          <Text style={styles.body}>
            Şehirleri kurdun, taş aletlerden makinelere geçiyorsun. Diğer
            şehir devletleriyle ticaret, savaş ve diplomasi seni bekliyor.
          </Text>
          <Text style={[styles.body, { color: theme.colors.warning }]}>
            Bu evre yapım aşamasında. Yakında: şehir kurma ekonomisi, askeri/dini/ticari yöntemler ve uzay araçları.
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>TOPLAM DNA</Text>
              <Text style={styles.statV}>{Math.floor(totalDna)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>EN İYİ EVRE</Text>
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
              setStage('tribal');
              setStatus('playing');
            }}
            style={[styles.btn, styles.btnPrimary]}
          >
            <Text style={styles.btnPrimaryTxt}>Kabile Evresine Dön</Text>
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
  root: { flex: 1, backgroundColor: '#0c1a2c' },
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
