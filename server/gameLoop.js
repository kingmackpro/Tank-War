const WebSocket = require("ws");

const { tickEntities } = require("./entities");
const { updatePlayers } = require("./player");
const { updateProjectiles } = require("./projectile");

function createGameLoop(dependencies) {
  const {
    gameState,
    getSpawnPoint,
    map,
    tankSize,
    weaponSystem,
    wss
  } = dependencies;

  return function updateGame() {
    const now = Date.now();

    weaponSystem.update(now);
    updatePlayers(gameState, map, tankSize);
    tickEntities(gameState);
    updateProjectiles(gameState, map, wss, tankSize, getSpawnPoint);

    const packet = JSON.stringify({
      type: "state",
      time: now,
      players: gameState.players,
      projectiles: gameState.projectiles
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(packet);
      }
    });
  };
}

module.exports = {
  createGameLoop
};
