const ALLOWED_KEYS = ["w", "a", "s", "d", "arrowleft", "arrowright", " "];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMessage(message) {
  try {
    return JSON.parse(message.toString());
  } catch (error) {
    return null;
  }
}

function sanitizeKeys(keys) {
  const nextKeys = {};

  for (const key of ALLOWED_KEYS) {
    nextKeys[key] = Boolean(keys[key]);
  }

  return nextKeys;
}

function validateInputMessage(data) {
  return isPlainObject(data) &&
    data.type === "input" &&
    isPlainObject(data.keys) &&
    Number.isFinite(data.turretAngle) &&
    Math.abs(data.turretAngle) <= Math.PI * 2;
}

function validateSessionMessage(data) {
  return isPlainObject(data) &&
    data.type === "session" &&
    (typeof data.sessionId === "string" || data.sessionId === null) &&
    (typeof data.username === "string" || typeof data.username === "undefined");
}

function validateWeaponSwitchMessage(data) {
  return isPlainObject(data) &&
    data.type === "weapon_switch" &&
    Number.isInteger(Number(data.slot));
}

function validateShootMessage(data) {
  return isPlainObject(data) && data.type === "shoot";
}

module.exports = {
  parseMessage,
  sanitizeKeys,
  validateInputMessage,
  validateSessionMessage,
  validateShootMessage,
  validateWeaponSwitchMessage
};
