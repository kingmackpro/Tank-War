function cloneStateValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneStateValue);
  }

  if (value && typeof value === "object") {
    const result = {};

    for (const key of Object.keys(value)) {
      result[key] = cloneStateValue(value[key]);
    }

    return result;
  }

  return value;
}

function createWeaponSlotRuntime(weaponId, weaponDefinitions) {
  const definition = weaponId ? weaponDefinitions[weaponId] : null;
  const state = definition ? definition.state : { charge: 0, flags: {}, timers: {} };

  return {
    weaponId,
    maxHoldTime: Number.isFinite(definition?.maxHoldTime) ? definition.maxHoldTime : null,
    cooldownEndsAt: 0,
    lastTriggeredAt: 0,
    charge: Number.isFinite(state.charge) ? state.charge : 0,
    flags: cloneStateValue(state.flags || {}),
    timers: cloneStateValue(state.timers || {}),
    activeEntityIds: [],
    selectedTargetId: null,
    detectedEntityIds: [],
    isHolding: false,
    holdStartTime: 0,
    holdDuration: 0,
    holdProgress: 0,
    lastEventType: null
  };
}

function createPlayerRuntime(weaponSlotIds, weaponDefinitions) {
  const normalizedWeaponSlotIds = weaponSlotIds.slice(0, 5);

  while (normalizedWeaponSlotIds.length < 5) {
    normalizedWeaponSlotIds.push(null);
  }

  return {
    weaponSlots: normalizedWeaponSlotIds.map((weaponId) => (
      createWeaponSlotRuntime(weaponId, weaponDefinitions)
    )),
    pendingWeaponEvents: [],
    fireInput: {
      isHolding: false,
      lastInputAt: 0,
      slotIndex: null
    },
    movementLock: {
      locked: false,
      rotationOnly: false,
      expiresAt: 0
    },
    statuses: [],
    controlState: "idle",
    controlledEntityId: null
  };
}

function attachPlayerRuntime(player, runtime) {
  Object.defineProperty(player, "runtime", {
    value: runtime,
    writable: true,
    enumerable: false,
    configurable: true
  });
}

function createWeaponSlotPublic(weaponId, weaponDefinitions) {
  if (!weaponId) {
    return null;
  }

  const definition = weaponDefinitions[weaponId];

  if (!definition) {
    return null;
  }

  return {
    id: definition.id,
    name: definition.name,
    cooldown: definition.cooldown
  };
}

function syncPlayerWeaponPublicState(player, weaponDefinitions) {
  player.weaponSlots = player.runtime.weaponSlots.map((slotRuntime) => (
    createWeaponSlotPublic(slotRuntime.weaponId, weaponDefinitions)
  ));

  player.weaponState = {
    activeSlot: player.weaponSlot,
    slots: player.runtime.weaponSlots.map((slotRuntime) => (
      slotRuntime.weaponId ? {
        weaponId: slotRuntime.weaponId,
        maxHoldTime: slotRuntime.maxHoldTime,
        cooldownEndsAt: slotRuntime.cooldownEndsAt,
        lastTriggeredAt: slotRuntime.lastTriggeredAt,
        charge: slotRuntime.charge,
        isHolding: slotRuntime.isHolding,
        holdStartTime: slotRuntime.holdStartTime,
        holdDuration: slotRuntime.holdDuration,
        holdProgress: slotRuntime.holdProgress,
        flags: { ...slotRuntime.flags }
      } : null
    ))
  };

  player.playerState = player.runtime.controlState;
}

module.exports = {
  attachPlayerRuntime,
  createPlayerRuntime,
  syncPlayerWeaponPublicState
};
