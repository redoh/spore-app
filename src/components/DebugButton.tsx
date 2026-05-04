import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '../theme';
import { PARTS, type Cell } from '../game/types';
import { useGame } from '../game/store';

type Props = {
  player: Cell;
  top: number;
  // How much radius to grow per tap (defaults match each stage's progression)
  growBy?: number;
  // How much DNA to grant per tap
  dnaPerTap?: number;
  // Max radius cap (so the button does not grow past stage caps)
  maxRadius?: number;
};

export default function DebugButton({
  player,
  top,
  growBy = 3,
  dnaPerTap = 60,
  maxRadius = 60,
}: Props) {
  const addDna = useGame((s) => s.addDna);
  const unlockPart = useGame((s) => s.unlockPart);

  const onTap = () => {
    addDna(dnaPerTap);
    player.radius = Math.min(maxRadius, player.radius + growBy);
    player.maxHp += 10;
    player.hp = player.maxHp;
    // Unlock all parts so they show in the editor immediately
    Object.keys(PARTS).forEach((id) =>
      unlockPart(id as keyof typeof PARTS),
    );
  };

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <TouchableOpacity onPress={onTap} style={styles.btn} activeOpacity={0.7}>
        <Text style={styles.txt}>DEBUG +{dnaPerTap}DNA · +{growBy}r</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 200, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 0, 0.55)',
  },
  txt: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
