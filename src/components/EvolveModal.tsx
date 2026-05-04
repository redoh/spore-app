import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { theme } from '../theme';
import { PARTS, type PartId } from '../game/types';
import { useGame } from '../game/store';

type Props = {
  visible: boolean;
  onClose: () => void;
  onApply: (parts: PartId[]) => void;
  currentParts: PartId[];
};

export default function EvolveModal({
  visible,
  onClose,
  onApply,
  currentParts,
}: Props) {
  const dna = useGame((s) => s.dna);
  const spendDna = useGame((s) => s.spendDna);
  const unlockedParts = useGame((s) => s.unlockedParts);
  const unlockPart = useGame((s) => s.unlockPart);

  const [selected, setSelected] = useState<PartId[]>(currentParts);

  useEffect(() => {
    if (visible) setSelected(currentParts);
  }, [visible, currentParts]);

  const toggle = (id: PartId) => {
    const part = PARTS[id];
    const isOwned = unlockedParts.includes(id);
    if (!isOwned) {
      if (spendDna(part.cost)) {
        unlockPart(id);
        setSelected((s) => [...s, id]);
      }
      return;
    }
    setSelected((s) =>
      s.includes(id) ? s.filter((p) => p !== id) : [...s, id],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Evrim Editörü</Text>
          <Text style={styles.dna}>{Math.floor(dna)} DNA</Text>
        </View>
        <Text style={styles.subtitle}>
          Parçaları DNA ile aç, takarak güçlen.
        </Text>

        <ScrollView contentContainerStyle={styles.list}>
          {Object.values(PARTS).map((p) => {
            const owned = unlockedParts.includes(p.id);
            const equipped = selected.includes(p.id);
            const affordable = dna >= p.cost;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.card,
                  equipped && styles.cardEquipped,
                  !owned && !affordable && styles.cardLocked,
                ]}
                activeOpacity={0.85}
                onPress={() => toggle(p.id)}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.cardName}>{p.name}</Text>
                  {owned ? (
                    <Text
                      style={[
                        styles.tag,
                        equipped ? styles.tagOn : styles.tagOff,
                      ]}
                    >
                      {equipped ? 'TAKILI' : 'TAK'}
                    </Text>
                  ) : (
                    <Text style={styles.tagCost}>{p.cost} DNA</Text>
                  )}
                </View>
                <Text style={styles.cardDesc}>{p.description}</Text>
                <View style={styles.statsRow}>
                  {p.effect.speed ? (
                    <Stat label="Hız" v={`+${p.effect.speed}`} />
                  ) : null}
                  {p.effect.damage ? (
                    <Stat label="Hasar" v={`+${p.effect.damage}`} />
                  ) : null}
                  {p.effect.armor ? (
                    <Stat label="Zırh" v={`+${p.effect.armor}`} />
                  ) : null}
                  {p.effect.maxHpBonus ? (
                    <Stat label="Can" v={`+${p.effect.maxHpBonus}`} />
                  ) : null}
                  {p.effect.eatRate ? (
                    <Stat label="Sindirim" v={`x${p.effect.eatRate}`} />
                  ) : null}
                  {p.effect.sense ? (
                    <Stat label="Görüş" v={`+${p.effect.sense}`} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.btn, styles.btnGhost]}
          >
            <Text style={styles.btnGhostTxt}>Kapat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onApply(selected)}
            style={[styles.btn, styles.btnPrimary]}
          >
            <Text style={styles.btnPrimaryTxt}>Uygula</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: theme.colors.bgSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingBottom: 28,
    paddingTop: 10,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 50,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  dna: {
    color: theme.colors.dna,
    fontWeight: '800',
    fontSize: 16,
  },
  subtitle: {
    color: theme.colors.textDim,
    marginTop: 2,
    marginBottom: 14,
  },
  list: { gap: 10, paddingBottom: 12 },
  card: {
    backgroundColor: theme.colors.bgPanel,
    borderRadius: 16,
    padding: 14,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  cardEquipped: {
    borderColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  cardLocked: { opacity: 0.55 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  cardDesc: {
    color: theme.colors.textDim,
    marginTop: 4,
    fontSize: 13,
  },
  tag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tagOn: {
    backgroundColor: theme.colors.accent,
    color: theme.colors.bgDeep,
  },
  tagOff: {
    backgroundColor: theme.colors.bgDeep,
    color: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  tagCost: {
    color: theme.colors.dna,
    fontWeight: '700',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  stat: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: theme.colors.bgDeep,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statLabel: { color: theme.colors.textDim, fontSize: 11 },
  statVal: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnPrimary: {
    backgroundColor: theme.colors.accent,
  },
  btnGhostTxt: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  btnPrimaryTxt: {
    color: theme.colors.bgDeep,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
