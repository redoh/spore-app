import { create } from 'zustand';

import type { GameStatus, PartId, Stage } from './types';

type Store = {
  status: GameStatus;
  stage: Stage;
  dna: number;
  totalDna: number;
  unlockedParts: PartId[];
  bestRadius: number;
  setStatus: (s: GameStatus) => void;
  setStage: (s: Stage) => void;
  addDna: (amount: number) => void;
  spendDna: (amount: number) => boolean;
  unlockPart: (id: PartId) => void;
  resetRun: () => void;
  reportRunEnd: (reachedRadius: number) => void;
};

export const useGame = create<Store>((set, get) => ({
  status: 'menu',
  stage: 'cell',
  dna: 0,
  totalDna: 0,
  unlockedParts: [],
  bestRadius: 0,
  setStatus: (status) => set({ status }),
  setStage: (stage) => set({ stage }),
  addDna: (amount) =>
    set((s) => ({ dna: s.dna + amount, totalDna: s.totalDna + amount })),
  spendDna: (amount) => {
    if (get().dna < amount) return false;
    set((s) => ({ dna: s.dna - amount }));
    return true;
  },
  unlockPart: (id) =>
    set((s) =>
      s.unlockedParts.includes(id)
        ? s
        : { unlockedParts: [...s.unlockedParts, id] },
    ),
  resetRun: () =>
    set({
      status: 'playing',
      dna: 0,
      unlockedParts: [],
      stage: 'cell',
    }),
  reportRunEnd: (reachedRadius) =>
    set((s) => ({ bestRadius: Math.max(s.bestRadius, reachedRadius) })),
}));
