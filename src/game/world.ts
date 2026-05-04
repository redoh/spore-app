import type {
  Cell,
  DietPreference,
  Food,
  Particle,
  PartId,
  Vec2,
  World,
} from './types';
import { PARTS } from './types';

const WORLD_W = 2400;
const WORLD_H = 2400;
const MAX_FOOD = 60;
const MAX_CELLS = 14;

export type WorldConfig = {
  startRadius?: number;
  startParts?: PartId[];
  startHp?: number;
  maxFood?: number;
  maxCells?: number;
  plantBias?: number; // 0..1, fraction of food that's plant; rest is meat
};

let nextId = 1;
const id = () => nextId++;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

const len = (v: Vec2) => Math.hypot(v.x, v.y);
const norm = (v: Vec2): Vec2 => {
  const l = len(v) || 1;
  return { x: v.x / l, y: v.y / l };
};
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export function createWorld(config: WorldConfig = {}): World {
  const startRadius = config.startRadius ?? 14;
  const startHp = config.startHp ?? 60;
  const maxFood = config.maxFood ?? MAX_FOOD;
  const plantBias = config.plantBias ?? 0.7;

  const player: Cell = {
    id: id(),
    pos: { x: WORLD_W / 2, y: WORLD_H / 2 },
    vel: { x: 0, y: 0 },
    radius: startRadius,
    speed: 110,
    hp: startHp,
    maxHp: startHp,
    hue: 168,
    diet: 'unknown',
    ai: { target: null, cooldown: 0, aggression: 0 },
    parts: config.startParts ? [...config.startParts] : [],
  };

  const world: World = {
    width: WORLD_W,
    height: WORLD_H,
    player,
    cells: [],
    food: [],
    particles: [],
    cameraOffset: { x: 0, y: 0 },
    time: 0,
    spawnTimer: 0,
    foodTimer: 0,
  };
  // Stash plantBias so spawnFood can use it without changing every call site.
  (world as unknown as { _plantBias: number })._plantBias = plantBias;
  (world as unknown as { _maxFood: number })._maxFood = maxFood;
  (world as unknown as { _maxCells: number })._maxCells =
    config.maxCells ?? MAX_CELLS;

  for (let i = 0; i < maxFood * 0.6; i++) world.food.push(spawnFood(world));
  for (let i = 0; i < 6; i++) world.cells.push(spawnCell(world, player.radius));

  return world;
}

function spawnFood(world: World): Food {
  const plantBias =
    (world as unknown as { _plantBias?: number })._plantBias ?? 0.7;
  const kind = Math.random() < plantBias ? 'plant' : 'meat';
  return {
    id: id(),
    pos: {
      x: rand(40, world.width - 40),
      y: rand(40, world.height - 40),
    },
    vel: { x: rand(-6, 6), y: rand(-6, 6) },
    radius: kind === 'plant' ? rand(4, 6) : rand(5, 7),
    kind,
    hue: kind === 'plant' ? 130 + rand(-15, 15) : 0 + rand(-10, 10),
  };
}

function spawnCell(world: World, playerRadius: number): Cell {
  const tier = Math.random();
  // Most cells are smaller (food), some are similar, a few are bigger threats.
  let radius: number;
  if (tier < 0.55) radius = rand(playerRadius * 0.45, playerRadius * 0.9);
  else if (tier < 0.85) radius = rand(playerRadius * 0.95, playerRadius * 1.3);
  else radius = rand(playerRadius * 1.4, playerRadius * 2.2);

  const diet: DietPreference =
    Math.random() < 0.5 ? 'herbivore' : 'carnivore';

  // Spawn off-screen-ish from player.
  const angle = rand(0, Math.PI * 2);
  const r = rand(380, 700);
  const px = world.player.pos.x + Math.cos(angle) * r;
  const py = world.player.pos.y + Math.sin(angle) * r;

  return {
    id: id(),
    pos: {
      x: clamp(px, 30, world.width - 30),
      y: clamp(py, 30, world.height - 30),
    },
    vel: { x: 0, y: 0 },
    radius,
    speed: rand(50, 95),
    hp: radius * 4,
    maxHp: radius * 4,
    hue: rand(0, 360),
    diet,
    ai: {
      target: null,
      cooldown: rand(0, 1.5),
      aggression: rand(0.3, 1),
    },
    parts: [],
  };
}

function spawnParticle(
  world: World,
  pos: Vec2,
  color: string,
  count = 6,
  spread = 60,
) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(20, spread);
    world.particles.push({
      id: id(),
      pos: { ...pos },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      life: rand(0.4, 0.9),
      maxLife: 0.9,
      radius: rand(1.5, 3.5),
      color,
    });
  }
}

type Effects = {
  speed: number;
  damage: number;
  armor: number;
  sense: number;
  eatRate: number;
  maxHpBonus: number;
};

export function partEffects(parts: PartId[]): Effects {
  const acc: Effects = {
    speed: 0,
    damage: 0,
    armor: 0,
    sense: 0,
    eatRate: 1,
    maxHpBonus: 0,
  };
  for (const p of parts) {
    const e = PARTS[p].effect;
    acc.speed += e.speed ?? 0;
    acc.damage += e.damage ?? 0;
    acc.armor += e.armor ?? 0;
    acc.sense += e.sense ?? 0;
    acc.maxHpBonus += e.maxHpBonus ?? 0;
    if (e.eatRate) acc.eatRate *= e.eatRate;
  }
  return acc;
}

export function applyParts(player: Cell, parts: PartId[]) {
  player.parts = [...parts];
  const eff = partEffects(parts);
  const baseMax = 60 + Math.floor((player.radius - 14) * 6);
  player.maxHp = baseMax + eff.maxHpBonus;
  player.hp = Math.min(player.maxHp, player.hp + eff.maxHpBonus * 0.5);
}

export type StepInput = {
  // Direction from player to where they want to move; magnitude 0..1.
  move: Vec2;
};

export type StepResult = {
  dnaGained: number;
  damageTaken: number;
  died: boolean;
  evolved: boolean;
};

export function stepWorld(
  world: World,
  input: StepInput,
  dt: number,
): StepResult {
  world.time += dt;
  const result: StepResult = {
    dnaGained: 0,
    damageTaken: 0,
    died: false,
    evolved: false,
  };

  const player = world.player;
  const eff = partEffects(player.parts);
  const speed = player.speed + eff.speed - player.radius * 1.2;

  // Player movement
  const mag = Math.min(1, len(input.move));
  if (mag > 0.05) {
    const dir = norm(input.move);
    player.vel.x = dir.x * speed * mag;
    player.vel.y = dir.y * speed * mag;
  } else {
    player.vel.x *= 0.85;
    player.vel.y *= 0.85;
  }
  player.pos.x = clamp(
    player.pos.x + player.vel.x * dt,
    player.radius,
    world.width - player.radius,
  );
  player.pos.y = clamp(
    player.pos.y + player.vel.y * dt,
    player.radius,
    world.height - player.radius,
  );

  const senseRange = 220 + eff.sense;

  // AI cells
  for (const c of world.cells) {
    c.ai.cooldown -= dt;
    if (c.ai.cooldown <= 0) {
      c.ai.cooldown = rand(1.2, 2.6);
      // Pick behavior: smaller cells flee from player if player is bigger,
      // bigger ones chase when close.
      const toPlayer = {
        x: player.pos.x - c.pos.x,
        y: player.pos.y - c.pos.y,
      };
      const d = len(toPlayer);
      const sees = d < 280;
      if (sees && c.radius > player.radius * 1.05) {
        c.ai.target = { ...player.pos };
      } else if (sees && c.radius < player.radius * 0.95) {
        c.ai.target = {
          x: c.pos.x - toPlayer.x,
          y: c.pos.y - toPlayer.y,
        };
      } else {
        // Wander toward random food
        const food = pickClosestFood(world, c);
        if (food) c.ai.target = { ...food.pos };
        else
          c.ai.target = {
            x: c.pos.x + rand(-200, 200),
            y: c.pos.y + rand(-200, 200),
          };
      }
    }
    if (c.ai.target) {
      const dir = norm({
        x: c.ai.target.x - c.pos.x,
        y: c.ai.target.y - c.pos.y,
      });
      const cs = c.speed - c.radius * 1.1;
      c.vel.x = dir.x * cs;
      c.vel.y = dir.y * cs;
    }
    c.pos.x = clamp(c.pos.x + c.vel.x * dt, c.radius, world.width - c.radius);
    c.pos.y = clamp(c.pos.y + c.vel.y * dt, c.radius, world.height - c.radius);
  }

  // Food drift
  for (const f of world.food) {
    f.pos.x += f.vel.x * dt;
    f.pos.y += f.vel.y * dt;
    f.vel.x += rand(-8, 8) * dt;
    f.vel.y += rand(-8, 8) * dt;
    f.vel.x *= 0.97;
    f.vel.y *= 0.97;
    f.pos.x = clamp(f.pos.x, 10, world.width - 10);
    f.pos.y = clamp(f.pos.y, 10, world.height - 10);
  }

  // Player <-> food collisions (eating)
  for (let i = world.food.length - 1; i >= 0; i--) {
    const f = world.food[i];
    if (dist(player.pos, f.pos) < player.radius + f.radius * 0.6) {
      world.food.splice(i, 1);
      const dnaGain = (f.kind === 'plant' ? 1 : 2) * eff.eatRate;
      result.dnaGained += dnaGain;
      player.radius = Math.min(60, player.radius + 0.18);
      player.hp = Math.min(player.maxHp, player.hp + 2);
      // Track diet
      if (player.diet === 'unknown')
        player.diet = f.kind === 'plant' ? 'herbivore' : 'carnivore';
      else if (
        (player.diet === 'herbivore' && f.kind === 'meat') ||
        (player.diet === 'carnivore' && f.kind === 'plant')
      )
        player.diet = 'omnivore';

      spawnParticle(world, f.pos, f.kind === 'plant' ? '#7be38a' : '#ff8a8a');
    }
  }

  // Cell collisions
  for (let i = world.cells.length - 1; i >= 0; i--) {
    const c = world.cells[i];
    const d = dist(player.pos, c.pos);
    if (d < player.radius + c.radius) {
      const overlap = player.radius + c.radius - d;
      const dir = norm({
        x: c.pos.x - player.pos.x || 0.001,
        y: c.pos.y - player.pos.y,
      });

      if (player.radius > c.radius * 1.08) {
        // Player eats cell
        const gain = Math.floor(c.radius * 0.7) + 2;
        result.dnaGained += gain;
        player.radius = Math.min(60, player.radius + c.radius * 0.06);
        player.hp = Math.min(player.maxHp, player.hp + 6);
        spawnParticle(world, c.pos, '#ff8a8a', 12, 90);
        world.cells.splice(i, 1);
      } else if (c.radius > player.radius * 1.08) {
        // Cell eats player → big damage based on size diff
        const dmg = (c.radius - player.radius) * 4 + 8 - eff.armor * 0.5;
        const taken = Math.max(1, dmg);
        player.hp -= taken;
        result.damageTaken += taken;
        // Knockback
        player.pos.x -= dir.x * overlap;
        player.pos.y -= dir.y * overlap;
        // Spike retaliates
        if (eff.damage > 0) c.hp -= eff.damage * 0.5;
        spawnParticle(world, player.pos, '#ff5b6e', 8, 70);
      } else {
        // Similar size: bump and small mutual damage
        player.pos.x -= dir.x * overlap * 0.5;
        player.pos.y -= dir.y * overlap * 0.5;
        c.pos.x += dir.x * overlap * 0.5;
        c.pos.y += dir.y * overlap * 0.5;
        const dmg = 2 - eff.armor * 0.2;
        player.hp -= Math.max(0.5, dmg);
        result.damageTaken += Math.max(0.5, dmg);
        c.hp -= 4 + eff.damage;
      }
    }

    // AI cells eat food too
    for (let j = world.food.length - 1; j >= 0; j--) {
      const f = world.food[j];
      if (
        c &&
        dist(c.pos, f.pos) < c.radius + f.radius * 0.6 &&
        ((f.kind === 'plant' && c.diet !== 'carnivore') ||
          (f.kind === 'meat' && c.diet !== 'herbivore'))
      ) {
        world.food.splice(j, 1);
        c.radius = Math.min(50, c.radius + 0.05);
      }
    }

    if (c && c.hp <= 0) {
      // Drop meat
      world.food.push({
        id: id(),
        pos: { ...c.pos },
        vel: { x: 0, y: 0 },
        radius: 6,
        kind: 'meat',
        hue: 0,
      });
      spawnParticle(world, c.pos, '#ff8a8a', 14, 100);
      world.cells.splice(i, 1);
    }
  }

  // Particles
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.vel.x *= 0.92;
    p.vel.y *= 0.92;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }

  // Spawn timers
  const maxFood =
    (world as unknown as { _maxFood?: number })._maxFood ?? MAX_FOOD;
  const maxCells =
    (world as unknown as { _maxCells?: number })._maxCells ?? MAX_CELLS;
  world.foodTimer -= dt;
  if (world.foodTimer <= 0 && world.food.length < maxFood) {
    world.food.push(spawnFood(world));
    world.foodTimer = rand(0.3, 0.8);
  }
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.cells.length < maxCells) {
    world.cells.push(spawnCell(world, player.radius));
    world.spawnTimer = rand(2.5, 5);
  }

  // Death
  if (player.hp <= 0) {
    player.hp = 0;
    result.died = true;
  }

  // Camera follows player smoothly
  // Camera offset is computed by renderer using viewport size; we just update player pos.

  // Evolution threshold: when radius reaches certain milestones, mark evolved
  // (actual UI prompt is handled by store/screen)

  return result;
}

function pickClosestFood(world: World, c: Cell): Food | null {
  let best: Food | null = null;
  let bestD = Infinity;
  for (const f of world.food) {
    if (
      (f.kind === 'plant' && c.diet === 'carnivore') ||
      (f.kind === 'meat' && c.diet === 'herbivore')
    )
      continue;
    const d = dist(c.pos, f.pos);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export const WORLD_BOUNDS = { width: WORLD_W, height: WORLD_H };
