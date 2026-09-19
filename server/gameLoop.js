const WebSocket = require("ws");

const { tickEntities } = require("./entities");
const { updatePlayers } = require("./player");
const { updateProjectiles } = require("./projectile");

function createGameLoop(deps) {
const { gameState, getSpawnPoint, map, tankSize, weaponSystem, wss } = deps;
let prev = Date.now();
return function updateGame() {
const now = Date.now();
const elapsedMs = Math.max(0, Math.min(now - prev, 1000));
const deltaScale = elapsedMs / (1000 / 60);
prev = now;
weaponSystem.update(now);
updatePlayers(gameState, map, tankSize, deltaScale);
tickEntities(gameState);
updateProjectiles(gameState, map, wss, tankSize, getSpawnPoint, deltaScale);
const packet = JSON.stringify({ type: "state", time: now, players: gameState.players, projectiles: gameState.projectiles });
wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(packet); });
};
}
