import type { Particle, Vec2 } from './types';

const W = 3600;
const H = 3600;

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

export type PlanetOwner = 'player' | 'rival' | 'neutral';

export type Planet = {
  id: number;
  pos: Vec2;
  owner: PlanetOwner;
  hp: number;
  maxHp: number;
  radius: number;
  energyRate: number;
  name: string;
  hue: number; // visual hue 0..360 (used for color picking)
  ringStyle: number; // 0 none, 1 ring, 2 moons
};

export type Ship = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  faction: 'player' | 'rival';
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  targetPlanetId: number | null;
  attackCd: number;
};

export type UFO = {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
};

export type SpaceWorld = {
  width: number;
  height: number;
  ufo: UFO;
  planets: Planet[];
  ships: Ship[];
  particles: Particle[];
  energy: number;
  friendship: number;
  rivalHostility: number;
  rivalDefeated: boolean;
  rivalAllied: boolean;
  galaxyConquered: boolean;
  energyTimer: number;
  rivalSpawnTimer: number;
  time: number;
};

export const SPACE_BOUNDS = { width: W, height: H };

export function createSpaceWorld(): SpaceWorld {
  const home: Planet = {
    id: id(),
    pos: { x: W * 0.18, y: H * 0.5 },
    owner: 'player',
    hp: 350,
    maxHp: 350,
    radius: 90,
    energyRate: 1.5,
    name: 'Anavatan',
    hue: 168,
    ringStyle: 1,
  };
  const rival: Planet = {
    id: id(),
    pos: { x: W * 0.82, y: H * 0.5 },
    owner: 'rival',
    hp: 350,
    maxHp: 350,
    radius: 90,
    energyRate: 1.2,
    name: 'Düşman',
    hue: 18,
    ringStyle: 2,
  };
  const neutralSpecs: { x: number; y: number; r: number; name: string; hue: number; ring: number }[] = [
    { x: W * 0.4, y: H * 0.22, r: 60, name: 'Buz Dünyası', hue: 200, ring: 0 },
    { x: W * 0.6, y: H * 0.78, r: 60, name: 'Çöl', hue: 40, ring: 0 },
    { x: W * 0.5, y: H * 0.5, r: 70, name: 'Halkalı', hue: 280, ring: 1 },
    { x: W * 0.32, y: H * 0.78, r: 55, name: 'Orman', hue: 130, ring: 0 },
    { x: W * 0.7, y: H * 0.25, r: 55, name: 'Volkan', hue: 0, ring: 0 },
  ];
  const planets: Planet[] = [home, rival];
  for (const s of neutralSpecs) {
    planets.push({
      id: id(),
      pos: { x: s.x, y: s.y },
      owner: 'neutral',
      hp: 150,
      maxHp: 150,
      radius: s.r,
      energyRate: 0.7,
      name: s.name,
      hue: s.hue,
      ringStyle: s.ring,
    });
  }

  const ufo: UFO = {
    pos: { x: home.pos.x + 160, y: home.pos.y },
    vel: { x: 0, y: 0 },
    radius: 22,
    speed: 280,
    hp: 200,
    maxHp: 200,
  };

  return {
    width: W,
    height: H,
    ufo,
    planets,
    ships: [],
    particles: [],
    energy: 30,
    friendship: 0,
    rivalHostility: 0,
    rivalDefeated: false,
    rivalAllied: false,
    galaxyConquered: false,
    energyTimer: 0,
    rivalSpawnTimer: 5,
    time: 0,
  };
}

export type StepInput = { move: Vec2 };
export type StepResult = {
  energyGained: number;
  rivalJustDefeated: boolean;
  rivalJustAllied: boolean;
  galaxyJustConquered: boolean;
  planetCaptured: Planet | null;
  died: boolean;
};

export function stepSpaceWorld(
  world: SpaceWorld,
  input: StepInput,
  dt: number,
): StepResult {
  world.time += dt;
  const result: StepResult = {
    energyGained: 0,
    rivalJustDefeated: false,
    rivalJustAllied: false,
    galaxyJustConquered: false,
    planetCaptured: null,
    died: false,
  };

  // UFO movement
  const ufo = world.ufo;
  const mag = Math.min(1, len(input.move));
  if (mag > 0.05) {
    const dir = norm(input.move);
    ufo.vel.x = dir.x * ufo.speed * mag;
    ufo.vel.y = dir.y * ufo.speed * mag;
  } else {
    ufo.vel.x *= 0.86;
    ufo.vel.y *= 0.86;
  }
  ufo.pos.x = clamp(
    ufo.pos.x + ufo.vel.x * dt,
    ufo.radius,
    world.width - ufo.radius,
  );
  ufo.pos.y = clamp(
    ufo.pos.y + ufo.vel.y * dt,
    ufo.radius,
    world.height - ufo.radius,
  );

  // Energy accumulates from owned planets
  world.energyTimer -= dt;
  if (world.energyTimer <= 0) {
    let total = 0;
    for (const p of world.planets) {
      if (p.owner === 'player' && p.hp > 0) total += p.energyRate;
    }
    world.energy += total;
    result.energyGained += total;
    world.energyTimer = 1;
  }

  // Rival spawns ships periodically if hostile
  world.rivalSpawnTimer -= dt;
  if (
    world.rivalHostility > 0.5 &&
    !world.rivalDefeated &&
    world.rivalSpawnTimer <= 0
  ) {
    const rival = world.planets.find(
      (p) => p.owner === 'rival' && p.name === 'Düşman',
    );
    const home = world.planets.find(
      (p) => p.owner === 'player' && p.name === 'Anavatan',
    );
    if (rival && home && rival.hp > 0) {
      world.ships.push(spawnShip('rival', rival.pos, home.id));
    }
    world.rivalSpawnTimer = rand(5, 8);
  }

  // Ships
  for (let i = world.ships.length - 1; i >= 0; i--) {
    const s = world.ships[i];
    s.attackCd = Math.max(0, s.attackCd - dt);
    if (s.hp <= 0) {
      spawnHit(world, s.pos, '#888');
      world.ships.splice(i, 1);
      continue;
    }
    const target = world.planets.find((p) => p.id === s.targetPlanetId);
    if (!target || target.hp <= 0) {
      world.ships.splice(i, 1);
      continue;
    }
    const toT = { x: target.pos.x - s.pos.x, y: target.pos.y - s.pos.y };
    const d = len(toT);
    if (d > target.radius * 0.7) {
      const dir = norm(toT);
      s.vel.x = dir.x * s.speed;
      s.vel.y = dir.y * s.speed;
    } else {
      // Attack planet
      if (s.attackCd <= 0) {
        target.hp = Math.max(0, target.hp - s.damage);
        s.attackCd = 0.5;
        spawnHit(world, s.pos, '#ffae3d');
        if (target.hp <= 0) {
          if (target.owner === 'rival' && target.name === 'Düşman') {
            world.rivalDefeated = true;
            result.rivalJustDefeated = true;
          } else if (
            target.owner === 'player' &&
            target.name === 'Anavatan'
          ) {
            world.ufo.hp = 0;
          }
        }
      }
      s.vel.x = 0;
      s.vel.y = 0;
    }
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;

    // Ship vs ship combat
    for (let j = i - 1; j >= 0; j--) {
      const o = world.ships[j];
      if (o.faction === s.faction || o.hp <= 0) continue;
      if (dist(s.pos, o.pos) < 24) {
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

    // Enemy ship vs UFO
    if (s.faction === 'rival' && dist(s.pos, ufo.pos) < ufo.radius + 18) {
      if (s.attackCd <= 0) {
        ufo.hp -= s.damage;
        s.attackCd = 0.6;
        spawnHit(world, ufo.pos);
      }
    }
  }

  // UFO laser: continuously damages enemy ships within close range
  for (const s of world.ships) {
    if (s.faction !== 'rival' || s.hp <= 0) continue;
    if (dist(s.pos, ufo.pos) < ufo.radius + 36) {
      s.hp -= 18 * dt;
      if (Math.random() < 0.2) {
        // small spark
        const a = rand(0, Math.PI * 2);
        world.particles.push({
          id: id(),
          pos: { ...s.pos },
          vel: { x: Math.cos(a) * 30, y: Math.sin(a) * 30 },
          life: 0.3,
          maxLife: 0.3,
          radius: 1.4,
          color: '#6cf0d3',
        });
      }
    }
  }

  // Galaxy domination: all non-player planets are either rival-defeated or player
  if (
    !world.galaxyConquered &&
    (world.rivalDefeated || world.rivalAllied)
  ) {
    const remainingNeutral = world.planets.filter((p) => p.owner === 'neutral')
      .length;
    if (remainingNeutral === 0) {
      world.galaxyConquered = true;
      result.galaxyJustConquered = true;
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

  if (ufo.hp <= 0) {
    ufo.hp = 0;
    result.died = true;
  }

  return result;
}

function spawnShip(
  faction: 'player' | 'rival',
  origin: Vec2,
  targetPlanetId: number,
): Ship {
  const a = rand(0, Math.PI * 2);
  return {
    id: id(),
    pos: { x: origin.x + Math.cos(a) * 100, y: origin.y + Math.sin(a) * 100 },
    vel: { x: 0, y: 0 },
    faction,
    hp: 35,
    maxHp: 35,
    damage: 7,
    speed: 130 + rand(-15, 15),
    targetPlanetId,
    attackCd: 0,
  };
}

function spawnHit(world: SpaceWorld, pos: Vec2, color = '#ff5b6e') {
  for (let i = 0; i < 5; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(40, 110);
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

// Helpers for UI

export function nearestPlanet(
  world: SpaceWorld,
  filter?: (p: Planet) => boolean,
): Planet | null {
  let best: Planet | null = null;
  let bestD = Infinity;
  for (const p of world.planets) {
    if (filter && !filter(p)) continue;
    const d = dist(world.ufo.pos, p.pos);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function isNearPlanet(world: SpaceWorld, p: Planet): boolean {
  return dist(world.ufo.pos, p.pos) < p.radius + 200;
}

// Player actions

export function spaceColonize(world: SpaceWorld): Planet | null {
  if (world.energy < 8) return null;
  const target = nearestPlanet(world, (p) => p.owner === 'neutral');
  if (!target || !isNearPlanet(world, target)) return null;
  world.energy -= 8;
  target.owner = 'player';
  for (let i = 0; i < 20; i++) {
    const a = rand(0, Math.PI * 2);
    world.particles.push({
      id: id(),
      pos: { ...target.pos },
      vel: { x: Math.cos(a) * 100, y: Math.sin(a) * 100 },
      life: 1.0,
      maxLife: 1.0,
      radius: 3,
      color: '#6cf0d3',
    });
  }
  return target;
}

export function spaceAttack(world: SpaceWorld): boolean {
  if (world.energy < 12) return false;
  const rival = nearestPlanet(world, (p) => p.owner === 'rival' && p.hp > 0);
  if (!rival || !isNearPlanet(world, rival)) return false;
  const home = world.planets.find(
    (p) => p.owner === 'player' && p.name === 'Anavatan',
  );
  if (!home) return false;
  world.energy -= 12;
  world.rivalHostility = Math.min(1, world.rivalHostility + 0.3);
  world.friendship = Math.max(0, world.friendship - 10);
  for (let i = 0; i < 3; i++) {
    world.ships.push(spawnShip('player', home.pos, rival.id));
  }
  return true;
}

export function spaceDiplomacy(world: SpaceWorld): boolean {
  if (world.energy < 10) return false;
  const rival = nearestPlanet(world, (p) => p.owner === 'rival' && p.hp > 0);
  if (!rival || !isNearPlanet(world, rival)) return false;
  world.energy -= 10;
  world.friendship = Math.min(100, world.friendship + 18);
  world.rivalHostility = Math.max(0, world.rivalHostility - 0.25);
  if (world.friendship >= 100 && !world.rivalDefeated) {
    world.rivalAllied = true;
  }
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2);
    world.particles.push({
      id: id(),
      pos: { ...rival.pos },
      vel: { x: Math.cos(a) * 90, y: Math.sin(a) * 90 },
      life: 0.9,
      maxLife: 0.9,
      radius: 3,
      color: '#a98bff',
    });
  }
  return true;
}
