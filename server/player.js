const { mapCollision, rectFromCenter } = require("./physics");

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

function createPlayer(tanks, map, tankSize) {
  const tank = cloneTank(tanks.defaultTank);
  const spawn = getSpawnPoint(map, tankSize);

  return {
    x: spawn.x,
    y: spawn.y,
    turretAngle: 0,
    keys: {},
    tank,
    hp: tank.hp,
    armorHp: tank.armorHp,
    weaponSlot: 0,
    lastShotTime: [0, 0, 0, 0, 0]
  };
}

function updatePlayers(gameState, map, tankSize) {
  for (const id in gameState.players) {
    const player = gameState.players[id];
    const speed = player.tank.speed;

    let dx = 0;
    let dy = 0;

    if (player.keys.w) dy -= speed;
    if (player.keys.s) dy += speed;
    if (player.keys.a) dx -= speed;
    if (player.keys.d) dx += speed;

    const nextBox = rectFromCenter(
      player.x + dx,
      player.y + dy,
      tankSize,
      tankSize
    );

    if (!mapCollision(map, nextBox)) {
      player.x += dx;
      player.y += dy;
    }
  }
}

module.exports = {
  createPlayer,
  getSpawnPoint,
  updatePlayers
};
