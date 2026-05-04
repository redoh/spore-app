import type { Particle, Vec2 } from './types';

const W = 3000;
const H = 3000;

let nextId = 1;
const id = () => nextId++;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const len = (v: Vec2) => Math.hypot(v.x, v.y);
const norm = (v: Vec2): Vec2 => {
  const l = len(v) || 1;
  return { x: v.x / l, y: v.y / l };
};
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export type CityOwner = 'player' | 'rival' | 'neutral';

export type City = {
  id: number;
  pos: Vec2;
  owner: CityOwner;
  hp: number;
  maxHp: number;
  radius: number;
  goldRate: number; // gold per second contributed to its owner
  name: string;
};

export type Soldier = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  faction: 'player' | 'rival';
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  targetCityId: number | null;
  attackCd: number;
};

export type Leader = {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
};

export type CivWorld = {
  width: number;
  height: number;
  leader: Leader;
  cities: City[];
  soldiers: Soldier[];
  particles: Particle[];
  gold: number;
  friendship: number;
  rivalHostility: number;
  rivalDefeated: boolean;
  rivalAllied: boolean;
  goldTimer: number;
  rivalSpawnTimer: number;
  time: number;
};

export const CIV_BOUNDS = { width: W, height: H };

export function createCivWorld(): CivWorld {
  const playerCity: City = {
    id: id(),
    pos: { x: W * 0.2, y: H * 0.5 },
    owner: 'player',
    hp: 300,
    maxHp: 300,
    radius: 110,
    goldRate: 1,
    name: 'Başkent',
  };
  const rivalCity: City = {
    id: id(),
    pos: { x: W * 0.8, y: H * 0.5 },
    owner: 'rival',
    hp: 300,
    maxHp: 300,
    radius: 110,
    goldRate: 1,
    name: 'Düşman',
  };
  const cities: City[] = [
    playerCity,
    rivalCity,
    {
      id: id(),
      pos: { x: W * 0.42, y: H * 0.25 },
      owner: 'neutral',
      hp: 120,
      maxHp: 120,
      radius: 80,
      goldRate: 0.6,
      name: 'Vadi',
    },
    {
      id: id(),
      pos: { x: W * 0.58, y: H * 0.78 },
      owner: 'neutral',
      hp: 120,
      maxHp: 120,
      radius: 80,
      goldRate: 0.6,
      name: 'Liman',
    },
    {
      id: id(),
      pos: { x: W * 0.5, y: H * 0.5 },
      owner: 'neutral',
      hp: 140,
      maxHp: 140,
      radius: 90,
      goldRate: 0.8,
      name: 'Pazar',
    },
  ];

  const leader: Leader = {
    pos: { x: playerCity.pos.x + 140, y: playerCity.pos.y },
    vel: { x: 0, y: 0 },
    radius: 24,
    speed: 240,
    hp: 200,
    maxHp: 200,
  };

  return {
    width: W,
    height: H,
    leader,
    cities,
    soldiers: [],
    particles: [],
    gold: 20,
    friendship: 0,
    rivalHostility: 0,
    rivalDefeated: false,
    rivalAllied: false,
    goldTimer: 0,
    rivalSpawnTimer: 4,
    time: 0,
  };
}

export type StepInput = { move: Vec2 };
export type StepResult = {
  goldGained: number;
  rivalJustDefeated: boolean;
  rivalJustAllied: boolean;
  cityCaptured: City | null;
  died: boolean;
};

export function stepCivWorld(
  world: CivWorld,
  input: StepInput,
  dt: number,
): StepResult {
  world.time += dt;
  const result: StepResult = {
    goldGained: 0,
    rivalJustDefeated: false,
    rivalJustAllied: false,
    cityCaptured: null,
    died: false,
  };

  // Leader movement
  const leader = world.leader;
  const mag = Math.min(1, len(input.move));
  if (mag > 0.05) {
    const dir = norm(input.move);
    leader.vel.x = dir.x * leader.speed * mag;
    leader.vel.y = dir.y * leader.speed * mag;
  } else {
    leader.vel.x *= 0.85;
    leader.vel.y *= 0.85;
  }
  leader.pos.x = clamp(
    leader.pos.x + leader.vel.x * dt,
    leader.radius,
    world.width - leader.radius,
  );
  leader.pos.y = clamp(
    leader.pos.y + leader.vel.y * dt,
    leader.radius,
    world.height - leader.radius,
  );

  // Gold accumulates from player-owned cities
  world.goldTimer -= dt;
  if (world.goldTimer <= 0) {
    let total = 0;
    for (const c of world.cities) {
      if (c.owner === 'player') total += c.goldRate;
    }
    world.gold += total;
    result.goldGained += total;
    world.goldTimer = 1; // every 1s
  }

  // Rival auto-spawns soldiers if hostile
  world.rivalSpawnTimer -= dt;
  if (
    world.rivalHostility > 0.5 &&
    !world.rivalDefeated &&
    world.rivalSpawnTimer <= 0
  ) {
    const rivalCity = world.cities.find((c) => c.owner === 'rival');
    const playerCity = world.cities.find(
      (c) => c.owner === 'player' && c.name === 'Başkent',
    );
    if (rivalCity && playerCity && rivalCity.hp > 0) {
      world.soldiers.push(
        spawnSoldier('rival', rivalCity.pos, playerCity.id),
      );
    }
    world.rivalSpawnTimer = rand(4, 7);
  }

  // Soldier movement and combat
  for (let i = world.soldiers.length - 1; i >= 0; i--) {
    const s = world.soldiers[i];
    s.attackCd = Math.max(0, s.attackCd - dt);
    if (s.hp <= 0) {
      spawnHit(world, s.pos, '#666');
      world.soldiers.splice(i, 1);
      continue;
    }
    const targetCity = world.cities.find((c) => c.id === s.targetCityId);
    if (!targetCity || targetCity.hp <= 0) {
      // No target — wander around or despawn
      world.soldiers.splice(i, 1);
      continue;
    }
    // March toward target city
    const toCity = {
      x: targetCity.pos.x - s.pos.x,
      y: targetCity.pos.y - s.pos.y,
    };
    const d = len(toCity);
    if (d > targetCity.radius * 0.6) {
      const dir = norm(toCity);
      s.vel.x = dir.x * s.speed;
      s.vel.y = dir.y * s.speed;
    } else {
      // Attack city
      if (s.attackCd <= 0) {
        targetCity.hp = Math.max(0, targetCity.hp - s.damage);
        s.attackCd = 0.6;
        spawnHit(world, s.pos, '#ffae3d');
        if (targetCity.hp <= 0) {
          // City captured / razed; if rival capital → defeated, friendly capital → game over
          if (targetCity.owner === 'rival' && targetCity.name === 'Düşman') {
            world.rivalDefeated = true;
            result.rivalJustDefeated = true;
          } else if (
            targetCity.owner === 'player' &&
            targetCity.name === 'Başkent'
          ) {
            world.leader.hp = 0;
          }
        }
      }
      s.vel.x = 0;
      s.vel.y = 0;
    }
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;

    // Soldier vs soldier combat
    for (let j = i - 1; j >= 0; j--) {
      const o = world.soldiers[j];
      if (o.faction === s.faction) continue;
      if (o.hp <= 0) continue;
      if (dist(s.pos, o.pos) < 22) {
        if (s.attackCd <= 0) {
          o.hp -= s.damage;
          s.attackCd = 0.5;
          spawnHit(world, o.pos);
        }
        if (o.attackCd <= 0) {
          s.hp -= o.damage;
          o.attackCd = 0.5;
          spawnHit(world, s.pos);
        }
      }
    }

    // Soldier vs enemy leader
    if (s.faction === 'rival') {
      if (dist(s.pos, leader.pos) < leader.radius + 16) {
        if (s.attackCd <= 0) {
          leader.hp -= s.damage;
          s.attackCd = 0.6;
          spawnHit(world, leader.pos);
        }
      }
    }
  }

  // Leader auto-attacks nearby enemy soldiers (fends off attackers)
  for (const s of world.soldiers) {
    if (s.faction !== 'rival' || s.hp <= 0) continue;
    if (dist(s.pos, leader.pos) < leader.radius + 28) {
      // light damage to soldier
      s.hp -= 14 * dt;
      if (s.hp <= 0) spawnHit(world, s.pos, '#ff5b6e');
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

  // Death
  if (leader.hp <= 0) {
    leader.hp = 0;
    result.died = true;
  }

  return result;
}

function spawnSoldier(
  faction: 'player' | 'rival',
  origin: Vec2,
  targetCityId: number,
): Soldier {
  // Spawn slightly offset from city center
  const a = rand(0, Math.PI * 2);
  return {
    id: id(),
    pos: { x: origin.x + Math.cos(a) * 90, y: origin.y + Math.sin(a) * 90 },
    vel: { x: 0, y: 0 },
    faction,
    hp: 30,
    maxHp: 30,
    damage: 6,
    speed: 110 + rand(-10, 10),
    targetCityId,
    attackCd: 0,
  };
}

function spawnHit(world: CivWorld, pos: Vec2, color = '#ff5b6e') {
  for (let i = 0; i < 5; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(40, 100);
    world.particles.push({
      id: id(),
      pos: { ...pos },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: rand(0.4, 0.7),
      maxLife: 0.7,
      radius: rand(2, 3.5),
      color,
    });
  }
}

// Player actions

export function nearestRivalCity(world: CivWorld): City | null {
  return world.cities.find((c) => c.owner === 'rival' && c.hp > 0) ?? null;
}

export function nearestNeutralCity(world: CivWorld): City | null {
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of world.cities) {
    if (c.owner !== 'neutral') continue;
    const d = dist(world.leader.pos, c.pos);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function isNearRival(world: CivWorld): boolean {
  const r = nearestRivalCity(world);
  if (!r) return false;
  return dist(world.leader.pos, r.pos) < r.radius + 220;
}

export function isNearNeutral(world: CivWorld): boolean {
  const n = nearestNeutralCity(world);
  if (!n) return false;
  return dist(world.leader.pos, n.pos) < n.radius + 200;
}

export function civAttack(world: CivWorld): boolean {
  if (world.gold < 10) return false;
  const rival = nearestRivalCity(world);
  if (!rival) return false;
  if (!isNearRival(world)) return false;
  const playerCapital = world.cities.find(
    (c) => c.owner === 'player' && c.name === 'Başkent',
  );
  if (!playerCapital) return false;
  world.gold -= 10;
  world.rivalHostility = Math.min(1, world.rivalHostility + 0.3);
  world.friendship = Math.max(0, world.friendship - 10);
  for (let i = 0; i < 3; i++) {
    world.soldiers.push(spawnSoldier('player', playerCapital.pos, rival.id));
  }
  return true;
}

export function civTrade(world: CivWorld): boolean {
  if (world.gold < 8) return false;
  const rival = nearestRivalCity(world);
  if (!rival) return false;
  if (!isNearRival(world)) return false;
  world.gold -= 8;
  world.friendship = Math.min(100, world.friendship + 15);
  world.rivalHostility = Math.max(0, world.rivalHostility - 0.2);
  if (world.friendship >= 100 && !world.rivalDefeated) {
    world.rivalAllied = true;
  }
  // visual sparkle
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2);
    world.particles.push({
      id: id(),
      pos: { ...rival.pos },
      vel: { x: Math.cos(a) * 80, y: Math.sin(a) * 80 },
      life: 0.9,
      maxLife: 0.9,
      radius: 3,
      color: '#a98bff',
    });
  }
  return true;
}

export function civConvert(world: CivWorld): City | null {
  if (world.gold < 6) return null;
  if (!isNearNeutral(world)) return null;
  const n = nearestNeutralCity(world);
  if (!n) return null;
  world.gold -= 6;
  n.owner = 'player';
  // give a small gold rate boost on conversion
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2);
    world.particles.push({
      id: id(),
      pos: { ...n.pos },
      vel: { x: Math.cos(a) * 90, y: Math.sin(a) * 90 },
      life: 0.9,
      maxLife: 0.9,
      radius: 3,
      color: '#6cf0d3',
    });
  }
  return n;
}
