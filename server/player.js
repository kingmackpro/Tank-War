const { mapCollision, rectFromCenter } = require("./physics");
const {
  attachPlayerRuntime,
  createPlayerRuntime,
  syncPlayerWeaponPublicState
} = require("./weapons/runtime");

function cloneTank(template) {
  return JSON.parse(JSON.stringify(template));
}

function getSpawnPoint(map, tankSize) {
  if (map.spawnPoints && map.spawnPoints.length > 0) {
    const index = Math.floor(Math.random() * map.spawnPoints.length);
    return map.spawnPoints[index];
  }

  while (true) {
    const x = 40 + Math.random() * (map.width - 80);
    const y = 40 + Math.random() * (map.height - 80);
    const box = rectFromCenter(x, y, tankSize, tankSize);

    if (!mapCollision(map, box)) {
      return { x, y };
    }
  }
}

function createPlayer(tanks, weaponDefinitions, map, tankSize) {
  const tank = cloneTank(tanks.defaultTank);
  const spawn = getSpawnPoint(map, tankSize);
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

    if (!mapCollision(map, nextXbox)) {
      player.x += dx;
    }

    const nextYBox = rectFromCenter(
      player.x,
      player.y + dy,
      tankSize,
      tankSize
    );

    if (!mapCollision(map, nextYBox)) {
      player.y += dy;
    }
  }
}

module.exports = {
  createPlayer,
  getSpawnPoint,
  updatePlayers
};
