const WebSocket = require("ws");

const { intersects, mapCollision, rectFromCenter } = require("./physics");

function createProjectile(player, playerId, barrelLength) {
  const slot = player.weaponSlot;
  const weapon = player.tank.weapons[slot] || null;

  if (!weapon) {
    return null;
  }

  const now = Date.now();
  const lastShot = player.lastShotTime[slot] || 0;

  if (now - lastShot < weapon.cooldown) {
    return null;
  }

  player.lastShotTime[slot] = now;

  return {
    x: player.x + Math.cos(player.turretAngle) * barrelLength,
    y: player.y + Math.sin(player.turretAngle) * barrelLength,
    vx: Math.cos(player.turretAngle) * weapon.projectileSpeed,
    vy: Math.sin(player.turretAngle) * weapon.projectileSpeed,
    size: weapon.projectileSize,
    damage: weapon.damage,
    ownerId: playerId
  };
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

function updateProjectiles(
  gameState,
  map,
  wss,
  tankSize,
  getSpawnPoint
) {
  for (let i = gameState.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = gameState.projectiles[i];

    projectile.x += projectile.vx;
    projectile.y += projectile.vy;

    const projectileBox = rectFromCenter(
      projectile.x,
      projectile.y,
      projectile.size,
      projectile.size
    );

    if (mapCollision(map, projectileBox)) {
      gameState.projectiles.splice(i, 1);
      continue;
    }

    for (const id in gameState.players) {
      const player = gameState.players[id];

      if (id === projectile.ownerId) {
        continue;
      }

      const tankBox = rectFromCenter(player.x, player.y, tankSize, tankSize);

      if (!intersects(projectileBox, tankBox)) {
        continue;
      }

      const damageEvent = applyProjectileDamage(projectile, player, id);
      broadcastDamage(wss, damageEvent);

      gameState.projectiles.splice(i, 1);

      if (player.hp <= 0) {
        respawnPlayer(player, getSpawnPoint, map, tankSize);
      }

      break;
    }
  }
}

module.exports = {
  createProjectile,
  updateProjectiles
};
