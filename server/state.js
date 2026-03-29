const fs = require("fs");
const path = require("path");

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

const gameState = {
  players: {},
  projectiles: []
};

const sessions = {};

module.exports = {
  BARREL_LENGTH,
  PORT,
  SESSION_TTL_MS,
  TANK_SIZE,
  gameState,
  map,
  sessions,
  tanks
};
