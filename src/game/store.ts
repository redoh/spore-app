import { create } from 'zustand';

import type { GameStatus, PartId, Stage } from './types';

export type CarryOver = {
  parts: PartId[];
  radius: number;
};

type Store = {
  status: GameStatus;
  stage: Stage;
  dna: number;
  totalDna: number;
  unlockedParts: PartId[];
  bestRadius: number;
  bestStage: Stage;
  carryOver: CarryOver | null;
  setStatus: (s: GameStatus) => void;
  setStage: (s: Stage) => void;
  addDna: (amount: number) => void;
  spendDna: (amount: number) => boolean;
  unlockPart: (id: PartId) => void;
  resetRun: () => void;
  reportRunEnd: (reachedRadius: number) => void;
  reportStageReached: (s: Stage) => void;
  setCarryOver: (c: CarryOver | null) => void;
};

const STAGE_RANK: Record<Stage, number> = {
  cell: 0,
  creature: 1,
  tribal: 2,
  civilization: 3,
  space: 4,
};

export const useGame = create<Store>((set, get) => ({
  status: 'menu',
  stage: 'cell',
  dna: 0,
  totalDna: 0,
  unlockedParts: [],
  bestRadius: 0,
  bestStage: 'cell',
  carryOver: null,
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
      carryOver: null,
    }),
  reportRunEnd: (reachedRadius) =>
    set((s) => ({ bestRadius: Math.max(s.bestRadius, reachedRadius) })),
  reportStageReached: (s) =>
    set((prev) => ({
      bestStage:
        STAGE_RANK[s] > STAGE_RANK[prev.bestStage] ? s : prev.bestStage,
    })),
  setCarryOver: (carryOver) => set({ carryOver }),
}));
