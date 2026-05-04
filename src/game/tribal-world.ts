import type { Vec2, Particle } from './types';

const W = 2400;
const H = 2400;

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

export type TribeId = 'player' | 'rival' | 'wild';

export type Member = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  damage: number;
  tribe: TribeId;
  isChief: boolean;
  ai: { target: Vec2 | null; cooldown: number; mode: 'follow' | 'fight' | 'wander' };
  attackCd: number;
};

export type Hut = {
  id: number;
  pos: Vec2;
  tribe: 'player' | 'rival';
  hp: number;
  maxHp: number;
  radius: number;
};

export type Resource = {
  id: number;
  pos: Vec2;
  kind: 'fruit' | 'meat';
};

export type TribalWorld = {
  width: number;
  height: number;
  player: Member;
  members: Member[];
  huts: Hut[];
  resources: Resource[];
  particles: Particle[];
  food: number;
  friendship: number;
  rivalDefeated: boolean;
  rivalAllied: boolean;
  time: number;
  resourceTimer: number;
  wildTimer: number;
  rivalHostility: number; // 0..1 (how hostile rival is toward player)
};

export const TRIBAL_BOUNDS = { width: W, height: H };

export function createTribalWorld(): TribalWorld {
  // Player chief in middle-left area; rival hut on right
  const playerHutPos: Vec2 = { x: W * 0.3, y: H * 0.5 };
  const rivalHutPos: Vec2 = { x: W * 0.7, y: H * 0.5 };

  const player: Member = {
    id: id(),
    pos: { x: playerHutPos.x + 80, y: playerHutPos.y },
    vel: { x: 0, y: 0 },
    radius: 22,
    speed: 130,
    hp: 120,
    maxHp: 120,
    damage: 14,
    tribe: 'player',
    isChief: true,
    ai: { target: null, cooldown: 0, mode: 'follow' },
    attackCd: 0,
  };

  const members: Member[] = [player];
  // 2 player followers
  for (let i = 0; i < 2; i++) {
    members.push({
      id: id(),
      pos: {
        x: playerHutPos.x + 60 + i * 30,
        y: playerHutPos.y + 60 + (i % 2) * 20,
      },
      vel: { x: 0, y: 0 },
      radius: 18,
      speed: 110,
      hp: 70,
      maxHp: 70,
      damage: 8,
      tribe: 'player',
      isChief: false,
      ai: { target: null, cooldown: 0, mode: 'follow' },
      attackCd: 0,
    });
  }
  // rival chief + 2 members
  members.push({
    id: id(),
    pos: { x: rivalHutPos.x - 70, y: rivalHutPos.y },
    vel: { x: 0, y: 0 },
    radius: 22,
    speed: 110,
    hp: 110,
    maxHp: 110,
    damage: 12,
    tribe: 'rival',
    isChief: true,
    ai: { target: null, cooldown: 0, mode: 'wander' },
    attackCd: 0,
  });
  for (let i = 0; i < 2; i++) {
    members.push({
      id: id(),
      pos: {
        x: rivalHutPos.x - 60 - i * 30,
        y: rivalHutPos.y + 70 - i * 20,
      },
      vel: { x: 0, y: 0 },
      radius: 18,
      speed: 100,
      hp: 60,
      maxHp: 60,
      damage: 8,
      tribe: 'rival',
      isChief: false,
      ai: { target: null, cooldown: 0, mode: 'wander' },
      attackCd: 0,
    });
  }
  // a few wild beasts roaming the middle
  for (let i = 0; i < 5; i++) {
    members.push({
      id: id(),
      pos: { x: rand(W * 0.35, W * 0.65), y: rand(H * 0.2, H * 0.8) },
      vel: { x: 0, y: 0 },
      radius: rand(16, 26),
      speed: rand(70, 110),
      hp: 50,
      maxHp: 50,
      damage: 10,
      tribe: 'wild',
      isChief: false,
      ai: { target: null, cooldown: 0, mode: 'wander' },
      attackCd: 0,
    });
  }

  const huts: Hut[] = [
    {
      id: id(),
      pos: playerHutPos,
      tribe: 'player',
      hp: 200,
      maxHp: 200,
      radius: 60,
    },
    {
      id: id(),
      pos: rivalHutPos,
      tribe: 'rival',
      hp: 200,
      maxHp: 200,
      radius: 60,
    },
  ];

  const resources: Resource[] = [];
  for (let i = 0; i < 16; i++) {
    resources.push({
      id: id(),
      pos: { x: rand(60, W - 60), y: rand(60, H - 60) },
      kind: Math.random() < 0.7 ? 'fruit' : 'meat',
    });
  }

  return {
    width: W,
    height: H,
    player,
    members,
    huts,
    resources,
    particles: [],
    food: 5,
    friendship: 0,
    rivalDefeated: false,
    rivalAllied: false,
    time: 0,
    resourceTimer: 0,
    wildTimer: 0,
    rivalHostility: 0.1,
  };
}

export type StepInput = { move: Vec2 };
export type StepResult = {
  foodGained: number;
  friendshipGained: number;
  damageTaken: number;
  died: boolean;
  rivalJustDefeated: boolean;
  rivalJustAllied: boolean;
};

export function stepTribalWorld(
  world: TribalWorld,
  input: StepInput,
  dt: number,
): StepResult {
  world.time += dt;
  const result: StepResult = {
    foodGained: 0,
    friendshipGained: 0,
    damageTaken: 0,
    died: false,
    rivalJustDefeated: false,
    rivalJustAllied: false,
  };

  const player = world.player;
  // Move chief from input
  const mag = Math.min(1, len(input.move));
  if (mag > 0.05) {
    const dir = norm(input.move);
    player.vel.x = dir.x * player.speed * mag;
    player.vel.y = dir.y * player.speed * mag;
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

  // AI for non-player members
  for (const m of world.members) {
    if (m === player) continue;
    if (m.hp <= 0) continue;
    m.ai.cooldown -= dt;
    m.attackCd = Math.max(0, m.attackCd - dt);

    if (m.tribe === 'player') {
      // Follower: stick near chief, attack hostile rivals
      const distChief = dist(m.pos, player.pos);
      const enemy = nearestEnemy(m, world);
      if (
        enemy &&
        dist(m.pos, enemy.pos) < 240 &&
        (m.tribe === 'player' && enemy.tribe === 'wild' ? true : world.rivalHostility > 0.5)
      ) {
        m.ai.mode = 'fight';
        m.ai.target = { ...enemy.pos };
      } else if (distChief > 110) {
        m.ai.mode = 'follow';
        // Find an offset position around the chief
        const angle = m.id * 1.13;
        m.ai.target = {
          x: player.pos.x + Math.cos(angle) * 80,
          y: player.pos.y + Math.sin(angle) * 80,
        };
      } else {
        m.ai.mode = 'wander';
        if (m.ai.cooldown <= 0) {
          m.ai.cooldown = rand(1, 2.5);
          m.ai.target = {
            x: player.pos.x + rand(-90, 90),
            y: player.pos.y + rand(-90, 90),
          };
        }
      }
    } else if (m.tribe === 'rival') {
      // Rival: defend their hut; if hostile, attack player tribe
      const rivalHut = world.huts.find((h) => h.tribe === 'rival');
      const enemy = nearestEnemy(m, world);
      if (world.rivalHostility > 0.5 && enemy) {
        m.ai.mode = 'fight';
        m.ai.target = { ...enemy.pos };
      } else if (m.ai.cooldown <= 0) {
        m.ai.cooldown = rand(1.5, 3.5);
        const cx = rivalHut?.pos.x ?? m.pos.x;
        const cy = rivalHut?.pos.y ?? m.pos.y;
        m.ai.target = {
          x: cx + rand(-120, 120),
          y: cy + rand(-120, 120),
        };
        m.ai.mode = 'wander';
      }
    } else {
      // Wild: wander and attack anything close enough
      const enemy = nearestEnemy(m, world);
      if (enemy && dist(m.pos, enemy.pos) < 180) {
        m.ai.mode = 'fight';
        m.ai.target = { ...enemy.pos };
      } else if (m.ai.cooldown <= 0) {
        m.ai.cooldown = rand(2, 5);
        m.ai.target = {
          x: m.pos.x + rand(-200, 200),
          y: m.pos.y + rand(-200, 200),
        };
        m.ai.mode = 'wander';
      }
    }

    // Move toward target
    if (m.ai.target) {
      const dx = m.ai.target.x - m.pos.x;
      const dy = m.ai.target.y - m.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      const speedMul = m.ai.mode === 'fight' ? 1.2 : 1;
      m.vel.x = (dx / d) * m.speed * speedMul;
      m.vel.y = (dy / d) * m.speed * speedMul;
      if (d < 8) m.ai.cooldown = 0;
    }
    m.pos.x = clamp(
      m.pos.x + m.vel.x * dt,
      m.radius,
      world.width - m.radius,
    );
    m.pos.y = clamp(
      m.pos.y + m.vel.y * dt,
      m.radius,
      world.height - m.radius,
    );
  }

  // Combat between members of opposing tribes
  for (let i = 0; i < world.members.length; i++) {
    const a = world.members[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < world.members.length; j++) {
      const b = world.members[j];
      if (b.hp <= 0) continue;
      if (!isHostile(a, b, world)) continue;
      const d = dist(a.pos, b.pos);
      if (d < a.radius + b.radius + 4) {
        // Bump apart
        const overlap = a.radius + b.radius - d + 2;
        const dir = norm({
          x: (b.pos.x - a.pos.x) || 0.001,
          y: b.pos.y - a.pos.y,
        });
        a.pos.x -= dir.x * overlap * 0.5;
        a.pos.y -= dir.y * overlap * 0.5;
        b.pos.x += dir.x * overlap * 0.5;
        b.pos.y += dir.y * overlap * 0.5;
        // Attack on cooldown
        if (a.attackCd <= 0) {
          b.hp -= a.damage;
          a.attackCd = 0.6;
          spawnHit(world, b.pos);
          if (b === player) result.damageTaken += a.damage;
        }
        if (b.attackCd <= 0) {
          a.hp -= b.damage;
          b.attackCd = 0.6;
          spawnHit(world, a.pos);
          if (a === player) result.damageTaken += b.damage;
        }
      }
    }
  }

  // Resource pickup by player tribe (chief + followers)
  for (const m of world.members) {
    if (m.tribe !== 'player' || m.hp <= 0) continue;
    for (let i = world.resources.length - 1; i >= 0; i--) {
      const r = world.resources[i];
      if (dist(m.pos, r.pos) < m.radius + 8) {
        world.food += r.kind === 'fruit' ? 1 : 2;
        result.foodGained += r.kind === 'fruit' ? 1 : 2;
        spawnHit(world, r.pos, '#7be38a');
        world.resources.splice(i, 1);
        // Heal slightly
        m.hp = Math.min(m.maxHp, m.hp + 3);
      }
    }
  }

  // Player attacks rival hut on contact (only when hostile)
  for (const hut of world.huts) {
    if (hut.tribe !== 'rival' || hut.hp <= 0) continue;
    if (
      world.rivalHostility > 0.5 &&
      dist(player.pos, hut.pos) < player.radius + hut.radius
    ) {
      if (player.attackCd <= 0) {
        hut.hp -= player.damage * 0.6;
        player.attackCd = 0.6;
        spawnHit(world, hut.pos, '#ffae3d');
      }
    }
  }

  // Check rival defeat: chief dead or hut destroyed (or all members dead)
  const rivalChief = world.members.find(
    (m) => m.tribe === 'rival' && m.isChief,
  );
  const rivalHut = world.huts.find((h) => h.tribe === 'rival');
  const rivalAlive = world.members.some(
    (m) => m.tribe === 'rival' && m.hp > 0,
  );
  if (
    !world.rivalDefeated &&
    !world.rivalAllied &&
    ((rivalChief && rivalChief.hp <= 0) ||
      (rivalHut && rivalHut.hp <= 0) ||
      !rivalAlive)
  ) {
    world.rivalDefeated = true;
    result.rivalJustDefeated = true;
  }

  // Hostility decays slightly when peaceful, escalates if player attacks
  // (handled externally via gift/attack actions)

  // Resource respawn
  world.resourceTimer -= dt;
  if (world.resourceTimer <= 0 && world.resources.length < 28) {
    world.resources.push({
      id: id(),
      pos: { x: rand(60, world.width - 60), y: rand(60, world.height - 60) },
      kind: Math.random() < 0.7 ? 'fruit' : 'meat',
    });
    world.resourceTimer = rand(1.2, 3);
  }

  // Wild beast respawn
  world.wildTimer -= dt;
  const wildAlive = world.members.filter(
    (m) => m.tribe === 'wild' && m.hp > 0,
  ).length;
  if (world.wildTimer <= 0 && wildAlive < 5) {
    world.members.push({
      id: id(),
      pos: { x: rand(world.width * 0.4, world.width * 0.6), y: rand(80, world.height - 80) },
      vel: { x: 0, y: 0 },
      radius: rand(14, 22),
      speed: rand(70, 110),
      hp: 50,
      maxHp: 50,
      damage: 10,
      tribe: 'wild',
      isChief: false,
      ai: { target: null, cooldown: 0, mode: 'wander' },
      attackCd: 0,
    });
    world.wildTimer = rand(4, 8);
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
  if (player.hp <= 0) {
    player.hp = 0;
    result.died = true;
  }

  return result;
}

function nearestEnemy(m: Member, world: TribalWorld): Member | null {
  let best: Member | null = null;
  let bestD = Infinity;
  for (const o of world.members) {
    if (o === m) continue;
    if (o.hp <= 0) continue;
    if (!areEnemies(m, o, world)) continue;
    const d = dist(m.pos, o.pos);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function areEnemies(a: Member, b: Member, world: TribalWorld): boolean {
  if (a.tribe === b.tribe) return false;
  if (a.tribe === 'wild' || b.tribe === 'wild') return true;
  // player vs rival: only hostile if hostility high enough or rival was provoked
  if (
    (a.tribe === 'player' && b.tribe === 'rival') ||
    (a.tribe === 'rival' && b.tribe === 'player')
  ) {
    return world.rivalHostility > 0.5;
  }
  return false;
}

function isHostile(a: Member, b: Member, world: TribalWorld): boolean {
  return areEnemies(a, b, world);
}

function spawnHit(world: TribalWorld, pos: Vec2, color = '#ff5b6e') {
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(40, 110);
    world.particles.push({
      id: id(),
      pos: { ...pos },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      life: rand(0.4, 0.7),
      maxLife: 0.7,
      radius: rand(2, 3.5),
      color,
    });
  }
}

// Player actions

export function tribalGift(world: TribalWorld): boolean {
  // Must be near rival hut, costs 5 food, gives +12 friendship.
  const rivalHut = world.huts.find((h) => h.tribe === 'rival');
  if (!rivalHut) return false;
  if (dist(world.player.pos, rivalHut.pos) > 150) return false;
  if (world.food < 5) return false;
  world.food -= 5;
  world.friendship = Math.min(100, world.friendship + 12);
  // Reduce hostility
  world.rivalHostility = Math.max(0, world.rivalHostility - 0.3);
  if (world.friendship >= 100 && !world.rivalDefeated) {
    world.rivalAllied = true;
  }
  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2);
    world.particles.push({
      id: id(),
      pos: { ...rivalHut.pos },
      vel: { x: Math.cos(a) * 60, y: Math.sin(a) * 60 },
      life: 0.8,
      maxLife: 0.8,
      radius: 3,
      color: '#a98bff',
    });
  }
  return true;
}

export function tribalDeclareWar(world: TribalWorld) {
  world.rivalHostility = 1;
  world.friendship = Math.max(0, world.friendship - 25);
}
