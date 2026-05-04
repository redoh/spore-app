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

export default function TribalStage() {
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
  const cx = width / 2;
  const groundY = height * 0.7;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Canvas style={{ flex: 1, width, height, backgroundColor: '#1a0e22' }}>
        {/* Stars */}
        {Array.from({ length: 80 }).map((_, i) => {
          const x = ((i * 137.508) % width) | 0;
          const y = ((i * 91.327) % (height * 0.6)) | 0;
          const tw = (Math.sin(t * 2 + i) + 1) / 2;
          return (
            <Circle
              key={`s-${i}`}
              cx={x}
              cy={y}
              r={1 + (i % 3) * 0.5}
              color="#9ec0ff"
              opacity={0.3 + tw * 0.5}
            />
          );
        })}
        {/* Moon */}
        <Circle cx={width * 0.78} cy={height * 0.18} r={36} color="#f0e8c2" opacity={0.95} />
        <Circle cx={width * 0.81} cy={height * 0.16} r={32} color="#1a0e22" opacity={0.5} />

        {/* Ground */}
        <Circle cx={cx} cy={groundY + 360} r={460} color="#3a2a16" />
        <Circle cx={cx - 200} cy={groundY + 380} r={440} color="#3a2a16" />
        <Circle cx={cx + 200} cy={groundY + 380} r={440} color="#3a2a16" />

        {/* Bonfire — flames flicker */}
        {(() => {
          const fx = cx;
          const fy = groundY - 16;
          const els: React.ReactElement[] = [];
          // logs
          els.push(<Circle key="log1" cx={fx - 12} cy={fy + 10} r={8} color="#5a3818" />);
          els.push(<Circle key="log2" cx={fx + 12} cy={fy + 10} r={8} color="#5a3818" />);
          els.push(<Circle key="log3" cx={fx} cy={fy + 12} r={9} color="#3a2210" />);
          // flame body
          for (let i = 0; i < 5; i++) {
            const flick = Math.sin(t * 8 + i) * 4;
            els.push(
              <Circle
                key={`fl-${i}`}
                cx={fx + flick * 0.5}
                cy={fy - 8 - i * 8 - Math.abs(flick) * 0.5}
                r={14 - i * 2}
                color={i < 2 ? '#fff0a8' : i < 4 ? '#ffae3d' : '#d04a1a'}
                opacity={0.9 - i * 0.1}
              />,
            );
          }
          // glow
          els.push(<Circle key="glow" cx={fx} cy={fy - 12} r={60} color="#ff8a3a" opacity={0.18} />);
          return els;
        })()}

        {/* Three tribe creatures around bonfire */}
        {[-1, 0, 1].map((side) => {
          const bx = cx + side * 90;
          const by = groundY - 4;
          const facing = side === 0 ? -1 : -side;
          const r = 22;
          const sway = Math.sin(t * 1.5 + side) * 2;
          const els: React.ReactElement[] = [];
          // legs
          for (let i = 0; i < 4; i++) {
            const off = (i - 1.5) * 8;
            els.push(
              <Circle
                key={`tl-${side}-${i}`}
                cx={bx + off}
                cy={by + r + 12}
                r={4}
                color="#1f6356"
              />,
            );
          }
          els.push(<Circle key={`tsh-${side}`} cx={bx} cy={by + r + 18} r={r * 0.8} color="#000" opacity={0.4} />);
          els.push(<Circle key={`tb-${side}`} cx={bx} cy={by + sway} r={r} color={theme.colors.player} />);
          els.push(<Circle key={`tbe-${side}`} cx={bx} cy={by + r * 0.25 + sway} r={r * 0.78} color={'#3da291'} opacity={0.7} />);
          // head facing fire (center)
          const hx = bx + 12 * facing;
          const hy = by - r * 0.45 + sway;
          els.push(<Circle key={`th-${side}`} cx={hx} cy={hy} r={r * 0.55} color={theme.colors.player} />);
          // eye
          els.push(<Circle key={`tew-${side}`} cx={hx + 5 * facing} cy={hy} r={4} color="#f0fff8" />);
          els.push(<Circle key={`tep-${side}`} cx={hx + 6 * facing} cy={hy} r={2} color="#0a0410" />);
          // little spear leaning
          if (side !== 0) {
            const sx = bx + 14 * facing;
            const sy = by - 2;
            els.push(
              <Circle key={`tsp-${side}`} cx={sx + 8 * facing} cy={sy - 18} r={2.5} color="#cccccc" />,
            );
            // shaft - approximate with several small circles
            for (let s = 0; s < 6; s++) {
              els.push(
                <Circle
                  key={`tspp-${side}-${s}`}
                  cx={sx + (s * 1.4) * facing}
                  cy={sy - 4 - s * 3}
                  r={1.5}
                  color="#7a5028"
                />,
              );
            }
          }
          return <React.Fragment key={`tribe-${side}`}>{els}</React.Fragment>;
        })}
      </Canvas>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.banner}>
          <Text style={styles.eyebrow}>YENİ EVRE</Text>
          <Text style={styles.title}>Kabile Evresi</Text>
          <Text style={styles.body}>
            Kabilenin etrafında ateş yandı. Artık aletler kullanıyor, başka
            kabilelerle barış veya savaş yapmaya hazırlanıyorsun.
          </Text>
          <Text style={[styles.body, { color: theme.colors.warning }]}>
            Bu evre yapım aşamasında. Yakında: ittifak/savaş, av sürüsü
            yönetimi, kült ve teknoloji.
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
              setStage('creature');
              setStatus('playing');
            }}
            style={[styles.btn, styles.btnPrimary]}
          >
            <Text style={styles.btnPrimaryTxt}>Yaratık Evresine Dön</Text>
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
  root: { flex: 1, backgroundColor: '#1a0e22' },
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
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
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
