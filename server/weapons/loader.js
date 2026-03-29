const fs = require("fs");

const SUPPORTED_EVENTS = ["tap", "hold_start", "hold_end", "re_press"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePipeline(pipeline) {
  return {
    conditions: Array.isArray(pipeline.conditions) ? pipeline.conditions : [],
    actions: Array.isArray(pipeline.actions) ? pipeline.actions : [],
    consumeCooldown: pipeline.consumeCooldown !== false
  };
}

function validatePipeline(weaponId, eventName, pipeline, index) {
  if (!isPlainObject(pipeline)) {
    throw new Error(`Weapon ${weaponId} event ${eventName} pipeline ${index} must be an object`);
  }

  if (!Array.isArray(pipeline.actions) || pipeline.actions.length === 0) {
    throw new Error(`Weapon ${weaponId} event ${eventName} pipeline ${index} requires actions`);
  }

  pipeline.actions.forEach((action, actionIndex) => {
    if (!isPlainObject(action) || typeof action.type !== "string") {
      throw new Error(
        `Weapon ${weaponId} event ${eventName} pipeline ${index} action ${actionIndex} is invalid`
      );
    }
  });

  if (pipeline.conditions && !Array.isArray(pipeline.conditions)) {
    throw new Error(`Weapon ${weaponId} event ${eventName} pipeline ${index} conditions must be an array`);
  }
}

function normalizeWeaponDefinition(definition) {
  if (!isPlainObject(definition)) {
    throw new Error("Weapon definition must be an object");
  }

  if (typeof definition.id !== "string" || definition.id.length === 0) {
    throw new Error("Weapon definition requires a string id");
  }

  if (typeof definition.name !== "string" || definition.name.length === 0) {
    throw new Error(`Weapon ${definition.id} requires a string name`);
  }

  if (!Number.isFinite(definition.cooldown) || definition.cooldown < 0) {
    throw new Error(`Weapon ${definition.id} requires a non-negative cooldown`);
  }

  if (!isPlainObject(definition.events)) {
    throw new Error(`Weapon ${definition.id} requires an events object`);
  }

  const normalizedEvents = {};

  for (const eventName of SUPPORTED_EVENTS) {
    const pipelines = definition.events[eventName] || [];

    if (!Array.isArray(pipelines)) {
      throw new Error(`Weapon ${definition.id} event ${eventName} must be an array`);
    }

    pipelines.forEach((pipeline, index) => {
      validatePipeline(definition.id, eventName, pipeline, index);
    });

    normalizedEvents[eventName] = pipelines.map(normalizePipeline);
  }

  return {
    id: definition.id,
    name: definition.name,
    cooldown: definition.cooldown,
    maxHoldTime: Number.isFinite(definition.maxHoldTime) ? definition.maxHoldTime : null,
    state: {
      charge: Number.isFinite(definition.state?.charge) ? definition.state.charge : 0,
      flags: isPlainObject(definition.state?.flags) ? { ...definition.state.flags } : {},
      timers: isPlainObject(definition.state?.timers) ? { ...definition.state.timers } : {}
    },
    events: normalizedEvents
  };
}

function loadWeaponDefinitions(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const definitions = Array.isArray(raw.definitions) ? raw.definitions : null;

  if (!definitions) {
    throw new Error("Weapons.json must contain a definitions array");
  }

  const weaponDefinitions = {};

  definitions.forEach((definition) => {
    const normalizedDefinition = normalizeWeaponDefinition(definition);

    if (weaponDefinitions[normalizedDefinition.id]) {
      throw new Error(`Duplicate weapon id: ${normalizedDefinition.id}`);
    }

    weaponDefinitions[normalizedDefinition.id] = normalizedDefinition;
  });

  return weaponDefinitions;
}

module.exports = {
  loadWeaponDefinitions
};
