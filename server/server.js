const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const { destroyEntity, getEntity, registerEntity } = require("./entities");
const { createGameLoop } = require("./gameLoop");
const { createPlayer } = require("./player");
const { spawnProjectile } = require("./projectile");
const { createWeaponSystem } = require("./weapons");
const { syncPlayerWeaponPublicState } = require("./weapons/runtime");
const {
  parseMessage,
  sanitizeKeys,
  validateInputMessage,
  validateSessionMessage,
  validateShootMessage,
  validateWeaponSwitchMessage
} = require("./protocol");
const {
  BARREL_LENGTH,
  PORT,
  SESSION_TTL_MS,
  TANK_SIZE,
  gameState,
  map,
  sessions,
  tanks,
  weaponDefinitions
} = require("./state");

const ROOT_DIR = path.join(__dirname, "..");

function getContentType(filePath) {
  const extension = path.extname(filePath);

  if (extension === ".html") return "text/html";
  if (extension === ".js") return "text/javascript";
  if (extension === ".json") return "application/json";
  if (extension === ".css") return "text/css";

  return "text/plain";
}

function resolveRequestPath(urlPath) {
  const cleanPath = (urlPath === "/" ? "/index.html" : urlPath).split("?")[0];
  const requestPath = cleanPath.replace(/^\/+/, "");
  const resolvedPath = path.normalize(path.join(ROOT_DIR, requestPath));

  const relativePath = path.relative(ROOT_DIR, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

function clearSessionCleanup(session) {
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }
}

function scheduleSessionCleanup(playerId) {
  const session = sessions[playerId];

  if (!session) {
    return;
  }

  clearSessionCleanup(session);

  session.cleanupTimer = setTimeout(() => {
    if (sessions[playerId] === session) {
      delete sessions[playerId];
    }
  }, SESSION_TTL_MS);
}

function getOrCreateSession(sessionId) {
  if (sessionId && sessions[sessionId]) {
    const session = sessions[sessionId];
    clearSessionCleanup(session);
    session.player.id = sessionId;

    return {
      playerId: sessionId,
      player: session.player
    };
  }

  const playerId = require("crypto").randomUUID();
  const player = createPlayer(tanks, weaponDefinitions, map, TANK_SIZE, gameState.players);

  player.id = playerId;

  sessions[playerId] = {
    player,
    cleanupTimer: null
  };

  return { playerId, player };
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || "/");

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

const wss = new WebSocket.Server({ server });
const weaponSystem = createWeaponSystem({
  barrelLength: BARREL_LENGTH,
  destroyEntity: (entityId) => destroyEntity(gameState, entityId),
  gameState,
  getEntity: (entityId) => getEntity(gameState, entityId),
  map,
  registerEntity: (entity, prefix) => registerEntity(gameState, entity, prefix),
  spawnProjectile: (config) => spawnProjectile(gameState, config),
  tankSize: TANK_SIZE,
  weaponDefinitions
});

wss.on("connection", (ws) => {
  let player = null;
  let playerId = null;

  ws.on("message", (message) => {
    const data = parseMessage(message);

    if (!data) {
      return;
    }

    if (validateSessionMessage(data)) {
      const session = getOrCreateSession(data.sessionId);

      playerId = session.playerId;
      player = session.player;
      sessions[playerId].activeSocket = ws;
      syncPlayerWeaponPublicState(player, weaponDefinitions);
      gameState.players[playerId] = player;

      ws.send(JSON.stringify({ type: "session", sessionId: playerId }));
      ws.send(JSON.stringify({ type: "init", id: playerId }));
      ws.send(JSON.stringify({ type: "map", data: map }));

      return;
    }

    if (!player) {
      return;
    }

    if (sessions[playerId]?.activeSocket !== ws) {
      return;
    }

    if (validateInputMessage(data)) {
      player.keys = sanitizeKeys(data.keys);
      player.turretAngle = data.turretAngle;
      return;
    }

    if (validateWeaponSwitchMessage(data)) {
      const slot = Number(data.slot);
      const index = slot - 1;

      if (index >= 0 && index < 5) {
        weaponSystem.handleWeaponSwitch(player, index);
      }

      return;
    }

    if (validateShootMessage(data)) {
      weaponSystem.handleShootInput(player);
    }
  });

  ws.on("close", () => {
    if (!playerId) {
      return;
    }

    const session = sessions[playerId];

    // A reconnect can replace this socket before its close event is delivered.
    if (!session || session.activeSocket !== ws) {
      return;
    }

    session.activeSocket = null;
    player.keys = {};
    delete gameState.players[playerId];
    scheduleSessionCleanup(playerId);
  });
});

const updateGame = createGameLoop({
  gameState,
  getSpawnPoint: require("./player").getSpawnPoint,
  map,
  tankSize: TANK_SIZE,
  weaponSystem,
  wss
});

setInterval(updateGame, 1000 / 60);
