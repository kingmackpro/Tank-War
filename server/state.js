const fs = require("fs");
const path = require("path");

const { loadWeaponDefinitions } = require("./weapons/loader");

const PORT = 8080;
const TANK_SIZE = 40;
const BARREL_LENGTH = 30;
const SESSION_TTL_MS = 30000;

function loadJson(fileName) {
  const filePath = path.join(__dirname, "..", "Backend", fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cloneMap(rawMap) {
  return {
    width: rawMap.width,
    height: rawMap.height,
    spawnPoints: [...(rawMap.spawnPoints || [])],
    walls: [...(rawMap.walls || [])],
    stones: [...(rawMap.stones || [])],
    covers: [...(rawMap.covers || [])]
  };
}

const tanks = loadJson("tanks.json");
const map = cloneMap(loadJson("map.json"));
const weaponDefinitions = loadWeaponDefinitions(
  path.join(__dirname, "..", "Backend", "Weapons.json")
);

const gameState = {
  players: {},
  projectiles: []
};

Object.defineProperty(gameState, "internal", {
  value: {
    entities: {},
    nextEntityId: 1,
    nextScheduledActionId: 1,
    scheduledActions: []
  },
  enumerable: false,
  writable: false
});

const sessions = {};

module.exports = {
  BARREL_LENGTH,
  PORT,
  SESSION_TTL_MS,
  TANK_SIZE,
  gameState,
  map,
  sessions,
  tanks,
  weaponDefinitions
};
