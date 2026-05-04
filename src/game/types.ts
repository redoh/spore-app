export type Vec2 = { x: number; y: number };

export type DietPreference = 'herbivore' | 'carnivore' | 'omnivore' | 'unknown';

export type FoodKind = 'plant' | 'meat';

export type Food = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  kind: FoodKind;
  hue: number;
};

export type Cell = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  hue: number;
  diet: DietPreference;
  ai: {
    target: Vec2 | null;
    cooldown: number;
    aggression: number;
  };
  parts: PartId[];
};

export type PartId =
  | 'spike'
  | 'jet'
  | 'jaw'
  | 'filter'
  | 'eye'
  | 'shell';

export type Part = {
  id: PartId;
  name: string;
  cost: number;
  description: string;
  effect: {
    speed?: number;
    damage?: number;
    armor?: number;
    sense?: number;
    eatRate?: number;
    maxHpBonus?: number;
  };
  diet?: DietPreference;
};

export type GameStatus = 'menu' | 'playing' | 'evolving' | 'gameover' | 'victory';

export type Stage = 'cell' | 'creature' | 'tribal' | 'civilization' | 'space';

export type World = {
  width: number;
  height: number;
  player: Cell;
  cells: Cell[];
  food: Food[];
  particles: Particle[];
  cameraOffset: Vec2;
  time: number;
  spawnTimer: number;
  foodTimer: number;
};

export type Particle = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
};

export const PARTS: Record<PartId, Part> = {
  spike: {
    id: 'spike',
    name: 'Diken',
    cost: 25,
    description: 'Sana çarpan düşmana hasar verir.',
    effect: { damage: 8, armor: 2 },
    diet: 'carnivore',
  },
  jet: {
    id: 'jet',
    name: 'Kamçı',
    cost: 20,
    description: 'Daha hızlı yüzersin.',
    effect: { speed: 35 },
  },
  jaw: {
    id: 'jaw',
    name: 'Çene',
    cost: 30,
    description: 'Et yemeyi ve avlanmayı kolaylaştırır.',
    effect: { damage: 12, eatRate: 1.5 },
    diet: 'carnivore',
  },
  filter: {
    id: 'filter',
    name: 'Süzgeç',
    cost: 20,
    description: 'Bitkileri çok daha hızlı sindirir.',
    effect: { eatRate: 1.6 },
    diet: 'herbivore',
  },
  eye: {
    id: 'eye',
    name: 'Göz',
    cost: 15,
    description: 'Daha uzağı görürsün, daha iyi avlanırsın.',
    effect: { sense: 80 },
  },
  shell: {
    id: 'shell',
    name: 'Kabuk',
    cost: 30,
    description: 'Dayanıklılığını ve canını arttırır.',
    effect: { armor: 6, maxHpBonus: 30 },
  },
};
