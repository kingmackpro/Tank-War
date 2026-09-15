const { intersects, mapCollision, rectFromCenter } = require("./physics");
const {
  attachPlayerRuntime,
  createPlayerRuntime,
  syncPlayerWeaponPublicState
} = require("./weapons/runtime");

function cloneTank(template) {
  return JSON.parse(JSON.stringify(template));
}

function collidesWithPlayer(players, playerId, box, tankSize) {
  return Object.entries(players || {}).some(([id, player]) => (
    id !== playerId && intersects(box, rectFromCenter(player.x, player.y, tankSize, tankSize))
  ));
}

function getSpawnPoint(map, tankSize, players = {}, playerId = null) {
  const spawnPoints = map.spawnPoints || [];

  for (let offset = 0; offset < spawnPoints.length; offset += 1) {
    const spawn = spawnPoints[(Math.floor(Math.random() * spawnPoints.length) + offset) % spawnPoints.length];
    const box = rectFromCenter(spawn.x, spawn.y, tankSize, tankSize);

    if (!mapCollision(map, box) && !collidesWithPlayer(players, playerId, box, tankSize)) {
      return spawn;
    }
  }

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const x = 40 + Math.random() * (map.width - 80);
    const y = 40 + Math.random() * (map.height - 80);
    const box = rectFromCenter(x, y, tankSize, tankSize);

    if (!mapCollision(map, box) && !collidesWithPlayer(players, playerId, box, tankSize)) {
      return { x, y };
    }
  }

  // A full map is still playable; use the first configured spawn rather than hang.
  return spawnPoints[0] || { x: map.width / 2, y: map.height / 2 };
}

function createPlayer(tanks, weaponDefinitions, map, tankSize, players = {}) {
  const tank = cloneTank(tanks.defaultTank);
  const spawn = getSpawnPoint(map, tankSize, players);
  const weaponSlotIds = Array.isArray(tank.weaponSlots)
    ? tank.weaponSlots.slice(0, 5)
    : [];

  while (weaponSlotIds.length < 5) {
    weaponSlotIds.push(null);
  }

  const player = {
    id: null,
    x: spawn.x,
    y: spawn.y,
    turretAngle: 0,
    keys: {},
    tank,
    hp: tank.hp,
    armorHp: tank.armorHp,
    weaponSlot: 0,
    weaponSlots: [],
    weaponState: {
      activeSlot: 0,
      slots: []
    },
    playerState: "idle"
  };

  attachPlayerRuntime(
    player,
    createPlayerRuntime(weaponSlotIds, weaponDefinitions)
  );
  syncPlayerWeaponPublicState(player, weaponDefinitions);

  return player;
}

function updatePlayers(gameState, map, tankSize) {
  for (const id in gameState.players) {
    const player = gameState.players[id];
    const runtime = player.runtime;

    if (runtime?.controlState === "executing") {
      continue;
    }

    if (runtime?.controlState === "controlled_entity") {
      continue;
    }

    if (runtime?.movementLock.locked || runtime?.movementLock.rotationOnly) {
      continue;
    }

    const speed = player.tank.speed;

    let dx = 0;
    let dy = 0;

    if (player.keys.w) dy -= speed;
    if (player.keys.s) dy += speed;
    if (player.keys.a) dx -= speed;
    if (player.keys.d) dx += speed;

    const nextXbox = rectFromCenter(
      player.x + dx,
      player.y,
      tankSize,
      tankSize
    );

    if (!mapCollision(map, nextXbox) && !collidesWithPlayer(gameState.players, id, nextXbox, tankSize)) {
      player.x += dx;
    }

    const nextYBox = rectFromCenter(
      player.x,
      player.y + dy,
      tankSize,
      tankSize
    );

    if (!mapCollision(map, nextYBox) && !collidesWithPlayer(gameState.players, id, nextYBox, tankSize)) {
      player.y += dy;
    }
  }
}

module.exports = {
  collidesWithPlayer,
  createPlayer,
  getSpawnPoint,
  updatePlayers
};
