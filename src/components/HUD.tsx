import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import type { DietPreference } from '../game/types';
import { useGame } from '../game/store';

type Props = {
  hp: number;
  maxHp: number;
  radius: number;
  diet: DietPreference;
};

const dietLabel: Record<DietPreference, string> = {
  herbivore: 'Otçul',
  carnivore: 'Etçil',
  omnivore: 'Hepçil',
  unknown: '—',
};

const dietColor: Record<DietPreference, string> = {
  herbivore: theme.colors.plant,
  carnivore: theme.colors.danger,
  omnivore: theme.colors.warning,
  unknown: theme.colors.textDim,
};

export default function HUD({ hp, maxHp, radius, diet }: Props) {
  const insets = useSafeAreaInsets();
  const dna = useGame((s) => s.dna);
  const hpPct = Math.max(0, Math.min(1, hp / maxHp));

  return (
    <View style={[styles.wrap, { top: insets.top + 12 }]} pointerEvents="none">
      <View style={styles.row}>
        <Text style={styles.label}>CAN</Text>
        <View style={styles.barOuter}>
          <View
            style={[
              styles.barInner,
              {
                width: `${hpPct * 100}%`,
                backgroundColor:
                  hpPct > 0.5
                    ? theme.colors.accent
                    : hpPct > 0.25
                      ? theme.colors.warning
                      : theme.colors.danger,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>DNA</Text>
        <Text style={[styles.value, { color: theme.colors.dna }]}>
          {Math.floor(dna)}
        </Text>
        <Text style={styles.muted}>· Boy {radius.toFixed(1)}</Text>
        <Text style={[styles.muted, { color: dietColor[diet] }]}>
          · {dietLabel[diet]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 76,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: theme.colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    width: 32,
  },
  value: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  muted: {
    color: theme.colors.textDim,
    fontSize: 12,
  },
  barOuter: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.bgPanel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    borderRadius: 4,
  },
});
