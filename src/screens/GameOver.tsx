import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { useGame } from '../game/store';

export default function GameOver() {
  const insets = useSafeAreaInsets();
  const totalDna = useGame((s) => s.totalDna);
  const bestRadius = useGame((s) => s.bestRadius);
  const resetRun = useGame((s) => s.resetRun);
  const setStatus = useGame((s) => s.setStatus);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <Text style={styles.title}>Tükendin</Text>
      <Text style={styles.subtitle}>
        Bu hayat sona erdi. DNA'n birikti, bir sonraki nesil daha güçlü olacak.
      </Text>

      <View style={styles.statsCard}>
        <Row label="Toplam DNA" value={String(Math.floor(totalDna))} />
        <Row label="En İyi Boy" value={bestRadius.toFixed(1)} />
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.btn}
        onPress={resetRun}
      >
        <Text style={styles.btnTxt}>YENİDEN DOĞ</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ghostBtn}
        onPress={() => setStatus('menu')}
      >
        <Text style={styles.ghostTxt}>Ana Menü</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDeep,
    paddingHorizontal: 28,
  },
  title: {
    color: theme.colors.danger,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 4,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontSize: 14,
    marginTop: 10,
  },
  statsCard: {
    marginTop: 28,
    backgroundColor: theme.colors.bgPanel,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: { color: theme.colors.textDim },
  rowValue: { color: theme.colors.text, fontWeight: '700' },
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnTxt: {
    color: theme.colors.bgDeep,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostTxt: { color: theme.colors.textDim },
});
