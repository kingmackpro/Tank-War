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

function respawnPlayer(player, getSpawnPoint, map, tankSize) {
  const spawn = getSpawnPoint(map, tankSize);

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

function updateProjectiles(
  gameState,
  map,
  wss,
  tankSize,
  getSpawnPoint
) {
  for (let i = gameState.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = gameState.projectiles[i];
    const previousX = projectile.x;
    const previousY = projectile.y;

    updateProjectileHoming(projectile, gameState);

    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.distanceTravelled += Math.hypot(projectile.vx, projectile.vy);

    if (projectile.expiresAt && Date.now() >= projectile.expiresAt) {
      destroyEntity(gameState, projectile.id);
      continue;
    }

    if (
      Number.isFinite(projectile.range) &&
      projectile.distanceTravelled >= projectile.range
    ) {
      destroyEntity(gameState, projectile.id);
      continue;
    }

    const projectileBox = rectFromCenter(
      projectile.x,
      projectile.y,
      projectile.size,
      projectile.size
    );

    if (!projectile.ignore.walls && mapCollision(map, projectileBox)) {
      if (projectile.bounceRemaining > 0) {
        const xCollision = mapCollision(
          map,
          rectFromCenter(previousX + projectile.vx, previousY, projectile.size, projectile.size)
        );
        const yCollision = mapCollision(
          map,
          rectFromCenter(previousX, previousY + projectile.vy, projectile.size, projectile.size)
        );

        if (xCollision) {
          projectile.vx *= -1;
        }

        if (yCollision) {
          projectile.vy *= -1;
        }

        if (!xCollision && !yCollision) {
          projectile.vx *= -1;
          projectile.vy *= -1;
        }

        projectile.x = previousX + projectile.vx;
        projectile.y = previousY + projectile.vy;
        projectile.bounceRemaining -= 1;
        continue;
      }

      destroyEntity(gameState, projectile.id);
      continue;
    }

    for (const id in gameState.players) {
      const player = gameState.players[id];
      player.id = id;

      if (id === projectile.ownerId && projectile.ignore.owner) {
        continue;
      }

      const tankBox = rectFromCenter(player.x, player.y, tankSize, tankSize);

      if (!intersects(projectileBox, tankBox)) {
        continue;
      }

      if (shieldBlocksDamage(gameState, player, projectile)) {
        destroyEntity(gameState, projectile.id);
        break;
      }

      const damageEvent = applyProjectileDamage(projectile, player, id);
      broadcastDamage(wss, damageEvent);

      destroyEntity(gameState, projectile.id);

      if (player.hp <= 0) {
        respawnPlayer(player, getSpawnPoint, map, tankSize);
      }

      break;
    }
  }
}

module.exports = {
  spawnProjectile,
  updateProjectiles
};
