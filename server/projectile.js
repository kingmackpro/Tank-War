const WebSocket = require("ws");

const { destroyEntity, getEntity, registerEntity } = require("./entities");
const { intersects, mapCollision, rectFromCenter } = require("./physics");

function normalizeIgnore(ignore) {
  return {
    owner: Boolean(ignore?.owner),
    walls: Boolean(ignore?.walls)
  };
}

function normalizeBounce(bounce) {
  if (typeof bounce === "number") {
    return bounce;
  }

  return bounce ? 1 : 0;
}

function spawnProjectile(gameState, config) {
  const projectile = registerEntity(gameState, {
    type: "projectile",
    ownerId: config.ownerId,
    x: config.x,
    y: config.y,
    vx: config.vx,
    vy: config.vy,
    speed: config.speed || Math.hypot(config.vx, config.vy),
    size: config.size,
    damage: config.damage,
    damageType: config.damageType || "kinetic",
    ignore: normalizeIgnore(config.ignore),
    range: Number.isFinite(config.range) ? config.range : null,
    distanceTravelled: 0,
    bounceRemaining: normalizeBounce(config.bounce),
    targetId: config.targetId || null,
    homing: config.homing
      ? {
          enabled: true,
          turnRate: Number.isFinite(config.homing.turnRate)
            ? config.homing.turnRate
            : 0.15
        }
      : null,
    expiresAt: Number.isFinite(config.lifetime)
      ? Date.now() + config.lifetime
      : null
  }, "projectile");

  gameState.projectiles.push(projectile);
  return projectile;
}

function broadcastDamage(wss, damageEvent) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(damageEvent));
    }
  });
}

function respawnPlayer(player, getSpawnPoint, map, tankSize, players) {
  const spawn = getSpawnPoint(map, tankSize, players, player.id);

  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = player.tank.hp;
  player.armorHp = player.tank.armorHp;
}

function shieldBlocksDamage(gameState, player, projectile) {
  if (!player.runtime) {
    return false;
  }

  const shields = Object.values(gameState.internal.entities).filter((entity) => (
    entity.type === "shield" &&
    entity.attachedToPlayerId === player.id
  ));

  return shields.some((shield) => (
    Array.isArray(shield.damageFilters) &&
    shield.damageFilters.includes(projectile.damageType)
  ));
}

function applyProjectileDamage(projectile, target, targetId) {
  const incomingDamage = projectile.damage;
  const effectiveDamage = Math.max(0, incomingDamage - target.tank.armor);
  const armorBefore = target.armorHp;

  let armorDamage = 0;
  let hpDamage = 0;

  if (armorBefore > 0 && effectiveDamage === 0) {
    armorDamage = Math.min(incomingDamage, armorBefore);
  } else if (armorBefore > 0) {
    armorDamage = Math.min(incomingDamage, armorBefore);
    hpDamage = effectiveDamage;
    target.hp -= effectiveDamage;
  } else {
    hpDamage = incomingDamage;
    target.hp -= incomingDamage;
  }

  target.armorHp -= incomingDamage;

  if (target.armorHp < 0) target.armorHp = 0;
  if (target.hp < 0) target.hp = 0;

  return {
    type: "damage",
    targetId,
    armorDamage,
    hpDamage
  };
}

function updateProjectileHoming(projectile, gameState) {
  if (!projectile.homing?.enabled || !projectile.targetId) {
    return;
  }

  const target = gameState.players[projectile.targetId] || getEntity(gameState, projectile.targetId);

  if (!target) {
    return;
  }

  const dx = target.x - projectile.x;
  const dy = target.y - projectile.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return;
  }

  const desiredVx = (dx / distance) * projectile.speed;
  const desiredVy = (dy / distance) * projectile.speed;
  const turnRate = projectile.homing.turnRate;

  projectile.vx += (desiredVx - projectile.vx) * turnRate;
  projectile.vy += (desiredVy - projectile.vy) * turnRate;

  const normalizedSpeed = Math.hypot(projectile.vx, projectile.vy) || projectile.speed;
  projectile.vx = (projectile.vx / normalizedSpeed) * projectile.speed;
  projectile.vy = (projectile.vy / normalizedSpeed) * projectile.speed;
}

function updateProjectiles(gameState, map, wss, tankSize, getSpawnPoint, deltaScale = 1) {
for (let i = gameState.projectiles.length - 1; i >= 0; i -= 1) {
const p = gameState.projectiles[i];
const prevX = p.x, prevY = p.y;
const mx = p.vx * deltaScale, my = p.vy * deltaScale;
updateProjectileHoming(p, gameState);
p.x += mx; p.y += my;
p.distanceTravelled += Math.hypot(p.vx, p.vy) * deltaScale;
if (p.expiresAt && Date.now() >= p.expiresAt) { destroyEntity(gameState, p.id); continue; }
if (Number.isFinite(p.range) && p.distanceTravelled >= p.range) { destroyEntity(gameState, p.id); continue; }
const pBox = rectFromCenter(p.x, p.y, p.size, p.size);
if (!p.ignore.walls && mapCollision(map, pBox)) {
if (p.bounceRemaining > 0) {
const xHit = mapCollision(map, rectFromCenter(prevX + mx, prevY, p.size, p.size));
const yHit = mapCollision(map, rectFromCenter(prevX, prevY + my, p.size, p.size));
if (xHit) p.vx *= -1;
if (yHit) p.vy *= -1;
if (!xHit && !yHit) { p.vx *= -1; p.vy *= -1; }
p.x = prevX + p.vx * deltaScale;
p.y = prevY + p.vy * deltaScale;
p.bounceRemaining -= 1;
continue;
}
destroyEntity(gameState, p.id);
continue;
}
for (const id in gameState.players) {
const player = gameState.players[id];
player.id = id;
if (id === p.ownerId && p.ignore.owner) continue;
const tankBox = rectFromCenter(player.x, player.y, tankSize, tankSize);
if (!intersects(pBox, tankBox)) continue;
if (shieldBlocksDamage(gameState, player, p)) {
destroyEntity(gameState, p.id); break; }
const ev = applyProjectileDamage(p, player, id);
broadcastDamage(wss, ev);
destroyEntity(gameState, p.id);
if (player.hp <= 0) respawnPlayer(player, getSpawnPoint, map, tankSize, gameState.players);
break;
}
}
}

module.exports = {
  spawnProjectile,
  updateProjectiles
};
