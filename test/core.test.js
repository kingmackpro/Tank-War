const test = require("node:test");
const assert = require("node:assert/strict");

const { mapCollision, rectFromCenter } = require("../server/physics");
const { updatePlayers } = require("../server/player");
const { spawnProjectile, updateProjectiles } = require("../server/projectile");
const { createWeaponSystem } = require("../server/weapons");
const { attachPlayerRuntime, createPlayerRuntime } = require("../server/weapons/runtime");
const {
  parseMessage,
  sanitizeKeys,
  validateInputMessage
} = require("../server/protocol");

const EMPTY_MAP = { width: 500, height: 500, walls: [], stones: [], covers: [] };

test("protocol rejects malformed or impossible client movement", () => {
  assert.equal(parseMessage("not json"), null);
  assert.equal(validateInputMessage({ type: "input", keys: {}, turretAngle: Infinity }), false);
  assert.equal(validateInputMessage({ type: "input", keys: {}, turretAngle: 10 }), false);
  assert.equal(validateInputMessage({ type: "input", keys: { w: true }, turretAngle: 0 }), true);
  assert.deepEqual(sanitizeKeys({ w: 1, cheat: true }), {
    w: true, a: false, s: false, d: false, arrowleft: false, arrowright: false, " ": false
  });
});

test("movement respects map obstacles and other tanks", () => {
  const map = { ...EMPTY_MAP, walls: [{ x: 100, y: 0, w: 20, h: 500 }] };
  const gameState = {
    players: {
      one: { x: 70, y: 100, keys: { d: true }, tank: { speed: 20 } },
      two: { x: 170, y: 100, keys: {}, tank: { speed: 3 } }
    }
  };

  updatePlayers(gameState, map, 40);
  assert.equal(gameState.players.one.x, 70);

  gameState.players.one.x = 130;
  gameState.players.one.keys = { d: true };
  updatePlayers(gameState, EMPTY_MAP, 40);
  assert.equal(gameState.players.one.x, 130);
  assert.equal(mapCollision(map, rectFromCenter(110, 100, 40, 40)), true);
});

test("projectiles damage, destroy themselves, and respawn a destroyed tank", () => {
  const events = [];
  const gameState = {
    players: {
      owner: { id: "owner", x: 50, y: 50, hp: 100, armorHp: 0, tank: { hp: 100, armorHp: 0, armor: 0 } },
      target: { id: "target", x: 100, y: 50, hp: 10, armorHp: 0, tank: { hp: 100, armorHp: 0, armor: 0 } }
    },
    projectiles: [],
    internal: { entities: {}, nextEntityId: 1 }
  };
  const wss = { clients: [{ readyState: 1, send: (value) => events.push(JSON.parse(value)) }] };

  spawnProjectile(gameState, { ownerId: "owner", x: 70, y: 50, vx: 20, vy: 0, size: 6, damage: 10, ignore: { owner: true } });
  updateProjectiles(gameState, EMPTY_MAP, wss, 40, () => ({ x: 300, y: 300 }));

  assert.equal(gameState.projectiles.length, 0);
  assert.equal(gameState.players.target.hp, 100);
  assert.deepEqual({ x: gameState.players.target.x, y: gameState.players.target.y }, { x: 300, y: 300 });
  assert.equal(events[0].type, "damage");
  assert.equal(events[0].hpDamage, 10);
});

test("weapon input is resolved on the server into a projectile", () => {
  const definitions = {
    fast: { id: "fast", name: "Fast", cooldown: 0, state: {}, events: { tap: [{ conditions: [], actions: [{ type: "spawn_projectile", speed: 12, damage: 8 }] }], hold_start: [], hold_end: [], re_press: [] } }
  };
  const gameState = { players: {}, projectiles: [], internal: { entities: {}, nextEntityId: 1, scheduledActions: [], nextScheduledActionId: 1 } };
  const player = { id: "player", x: 50, y: 50, turretAngle: 0, tank: { type: "basic" }, weaponSlot: 0 };
  attachPlayerRuntime(player, createPlayerRuntime(["fast"], definitions));
  gameState.players.player = player;
  const system = createWeaponSystem({ barrelLength: 30, gameState, map: EMPTY_MAP, tankSize: 40, weaponDefinitions: definitions, getEntity: () => null, destroyEntity: () => {}, registerEntity: () => null, spawnProjectile: (config) => spawnProjectile(gameState, config) });

  system.handleShootInput(player);
  system.update(Date.now());
  assert.equal(gameState.projectiles.length, 1);
  assert.equal(gameState.projectiles[0].vx, 12);
});
