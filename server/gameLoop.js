const WebSocket = require("ws");

const { updatePlayers } = require("./player");
const { updateProjectiles } = require("./projectile");

function createGameLoop(dependencies) {
  const {
    gameState,
    getSpawnPoint,
    map,
    tankSize,
    wss
  } = dependencies;

  return function updateGame() {
    updatePlayers(gameState, map, tankSize);
    updateProjectiles(gameState, map, wss, tankSize, getSpawnPoint);

    const packet = JSON.stringify({
      type: "state",
      time: Date.now(),
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
