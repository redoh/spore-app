import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { useGame } from '../game/store';

export default function MainMenu() {
  const insets = useSafeAreaInsets();
  const setStatus = useGame((s) => s.setStatus);
  const resetRun = useGame((s) => s.resetRun);
  const totalDna = useGame((s) => s.totalDna);
  const bestRadius = useGame((s) => s.bestRadius);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.hero}>
        <Text style={styles.brand}>SPORE</Text>
        <Text style={styles.tagline}>
          Tek bir hücreden başla, galaksiyi ele geçir.
        </Text>
      </View>

      <View style={styles.statsCard}>
        <Stat label="Toplam DNA" value={String(Math.floor(totalDna))} />
        <View style={styles.divider} />
        <Stat label="En İyi Boy" value={bestRadius.toFixed(1)} />
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.startBtn}
        onPress={() => {
          resetRun();
        }}
      >
        <Text style={styles.startTxt}>YENİ HAYAT</Text>
        <Text style={styles.startSub}>Hücre Evresi</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setStatus('menu')}
        style={styles.secondaryBtn}
      >
        <Text style={styles.secondaryTxt}>
          Yaratık · Kabile · Medeniyet · Uzay  (yakında)
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDeep,
    paddingHorizontal: 24,
  },
  hero: { alignItems: 'center', marginTop: 30 },
  brand: {
    fontSize: 64,
    fontWeight: '900',
    color: theme.colors.accent,
    letterSpacing: 8,
  },
  tagline: {
    color: theme.colors.textDim,
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgPanel,
    borderRadius: 18,
    padding: 18,
    marginTop: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 4,
  },
  statLabel: {
    color: theme.colors.textDim,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  startBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 22,
    paddingVertical: 22,
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  startTxt: {
    color: theme.colors.bgDeep,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  startSub: {
    color: theme.colors.bgDeep,
    opacity: 0.7,
    fontSize: 12,
    marginTop: 2,
  },
  secondaryBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryTxt: {
    color: theme.colors.textDim,
    fontSize: 12,
    letterSpacing: 1,
  },
});
