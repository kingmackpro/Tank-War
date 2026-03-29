const { evaluateConditions } = require("./conditions");
const { syncPlayerWeaponPublicState } = require("./runtime");
const { createActionExecutor } = require("./actions");

function hasBlockingStatus(player, now) {
  return player.runtime.statuses.some((status) => (
    (!status.expiresAt || status.expiresAt > now) &&
    (status.type === "EMP" || status.type === "disable")
  ));
}

function createWeaponSystem(dependencies) {
  const {
    barrelLength,
    destroyEntity,
    gameState,
    getEntity,
    map,
    registerEntity,
    spawnProjectile,
    tankSize,
    weaponDefinitions
  } = dependencies;

  const actionExecutor = createActionExecutor({
    barrelLength,
    destroyEntity,
    gameState,
    getEntity,
    map,
    registerEntity,
    spawnProjectile,
    tankSize
  });

  function getSlotRuntime(player, slotIndex) {
    if (!player.runtime) {
      return null;
    }

    return player.runtime.weaponSlots[slotIndex] || null;
  }

  function queueWeaponEvent(player, slotIndex, eventType) {
    player.runtime.pendingWeaponEvents.push({
      slotIndex,
      eventType,
      queuedAt: Date.now()
    });
  }

  function handleWeaponSwitch(player, slotIndex) {
    if (slotIndex < 0 || slotIndex >= 5) {
      return;
    }

    player.weaponSlot = slotIndex;
    syncPlayerWeaponPublicState(player, weaponDefinitions);
  }

  function handleShootInput(player) {
    const now = Date.now();

    if (hasBlockingStatus(player, now)) {
      return;
    }

    const slotIndex = player.weaponSlot;
    const slotRuntime = getSlotRuntime(player, slotIndex);

    if (!slotRuntime || !slotRuntime.weaponId) {
      return;
    }

    player.runtime.fireInput.lastInputAt = now;
    player.runtime.fireInput.slotIndex = slotIndex;

    if (!player.runtime.fireInput.isHolding) {
      player.runtime.fireInput.isHolding = true;
      slotRuntime.isHolding = true;
      queueWeaponEvent(player, slotIndex, "hold_start");
      queueWeaponEvent(player, slotIndex, "tap");
      return;
    }

    queueWeaponEvent(player, slotIndex, "re_press");
  }

  function shouldConsumeCooldown(eventType, pipeline) {
    if (pipeline.consumeCooldown === false) {
      return false;
    }

    return eventType === "tap" || eventType === "re_press";
  }

  function processScheduledActions(now) {
    const readyActions = [];
    const pendingActions = [];

    gameState.internal.scheduledActions.forEach((scheduledAction) => {
      if (scheduledAction.executeAt <= now) {
        readyActions.push(scheduledAction);
      } else {
        pendingActions.push(scheduledAction);
      }
    });

    gameState.internal.scheduledActions = pendingActions;

    readyActions.forEach((scheduledAction) => {
      const player = gameState.players[scheduledAction.playerId];

      if (!player) {
        return;
      }

      const slotRuntime = getSlotRuntime(player, scheduledAction.slotIndex);

      if (!slotRuntime || !slotRuntime.weaponId) {
        return;
      }

      const context = {
        evaluateConditions,
        gameState,
        getEntity,
        lastEntityId: null,
        now,
        player,
        playerId: scheduledAction.playerId,
        selectedEntityId: slotRuntime.selectedTargetId,
        slotIndex: scheduledAction.slotIndex,
        slotRuntime
      };

      actionExecutor.executeActions(scheduledAction.actions, context);
    });
  }

  function processWeaponEvent(player, event, now) {
    const slotRuntime = getSlotRuntime(player, event.slotIndex);

    if (!slotRuntime || !slotRuntime.weaponId) {
      return;
    }

    const weaponDefinition = weaponDefinitions[slotRuntime.weaponId];

    if (!weaponDefinition) {
      return;
    }

    if (event.eventType === "hold_start") {
      slotRuntime.isHolding = true;
      slotRuntime.holdStartTime = now;
      slotRuntime.holdDuration = 0;
      slotRuntime.holdProgress = 0;
    }

    if (event.eventType === "hold_end") {
      slotRuntime.isHolding = false;
      slotRuntime.holdStartTime = 0;
      slotRuntime.holdDuration = 0;
      slotRuntime.holdProgress = 0;
    }

    const pipelines = weaponDefinition.events[event.eventType] || [];

    pipelines.forEach((pipeline) => {
      const context = {
        collisionDetected: false,
        evaluateConditions,
        gameState,
        getEntity,
        lastEntityId: null,
        now,
        player,
        playerId: player.id,
        selectedEntityId: slotRuntime.selectedTargetId,
        slotIndex: event.slotIndex,
        slotRuntime
      };

      if (!evaluateConditions(pipeline.conditions, context)) {
        return;
      }

      const executed = actionExecutor.executeActions(pipeline.actions, context);

      if (executed && shouldConsumeCooldown(event.eventType, pipeline)) {
        slotRuntime.lastTriggeredAt = now;
        slotRuntime.cooldownEndsAt = now + weaponDefinition.cooldown;
      }

      slotRuntime.lastEventType = event.eventType;
    });
  }

  function updatePlayerRuntime(player, now) {
    player.runtime.statuses = player.runtime.statuses.filter((status) => (
      !status.expiresAt || status.expiresAt > now
    ));

    player.runtime.weaponSlots.forEach((slotRuntime) => {
      if (slotRuntime.isHolding && slotRuntime.holdStartTime > 0) {
        slotRuntime.holdDuration = now - slotRuntime.holdStartTime;

        if (Number.isFinite(slotRuntime.maxHoldTime) && slotRuntime.maxHoldTime > 0) {
          slotRuntime.holdProgress = Math.max(
            0,
            Math.min(slotRuntime.holdDuration / slotRuntime.maxHoldTime, 1)
          );
        } else {
          slotRuntime.holdProgress = 0;
        }
      } else {
        slotRuntime.holdDuration = 0;
        slotRuntime.holdProgress = 0;
      }
    });

    if (
      player.runtime.movementLock.expiresAt &&
      player.runtime.movementLock.expiresAt <= now
    ) {
      player.runtime.movementLock.locked = false;
      player.runtime.movementLock.rotationOnly = false;
      player.runtime.movementLock.expiresAt = 0;

      if (player.runtime.controlState === "holding") {
        player.runtime.controlState = "idle";
      }
    }

    if (
      player.runtime.fireInput.isHolding &&
      now - player.runtime.fireInput.lastInputAt > 140
    ) {
      const heldSlotIndex = player.runtime.fireInput.slotIndex ?? player.weaponSlot;
      const slotRuntime = getSlotRuntime(player, heldSlotIndex);

      player.runtime.fireInput.isHolding = false;
      player.runtime.fireInput.slotIndex = null;

      if (slotRuntime) {
        slotRuntime.isHolding = false;
      }

      queueWeaponEvent(player, heldSlotIndex, "hold_end");
    }

    const hasHoldingSlot = player.runtime.weaponSlots.some((slotRuntime) => slotRuntime.isHolding);
    const isExecuting = player.runtime.controlState === "executing";
    const isControlledEntity = player.runtime.controlState === "controlled_entity";

    if (!hasHoldingSlot && !isExecuting && !isControlledEntity) {
      player.runtime.movementLock.locked = false;
      player.runtime.movementLock.rotationOnly = false;
      player.runtime.movementLock.expiresAt = 0;

      if (player.runtime.controlState === "holding") {
        player.runtime.controlState = "idle";
      }
    }

    while (player.runtime.pendingWeaponEvents.length > 0) {
      const event = player.runtime.pendingWeaponEvents.shift();
      processWeaponEvent(player, event, now);
    }

    const hasHoldingSlotAfterEvents = player.runtime.weaponSlots.some((slotRuntime) => slotRuntime.isHolding);
    const isExecutingAfterEvents = player.runtime.controlState === "executing";
    const isControlledEntityAfterEvents = player.runtime.controlState === "controlled_entity";

    if (!hasHoldingSlotAfterEvents && !isExecutingAfterEvents && !isControlledEntityAfterEvents) {
      player.runtime.movementLock.locked = false;
      player.runtime.movementLock.rotationOnly = false;
      player.runtime.movementLock.expiresAt = 0;

      if (player.runtime.controlState === "holding") {
        player.runtime.controlState = "idle";
      }
    }

    syncPlayerWeaponPublicState(player, weaponDefinitions);
  }

  function update(now) {
    processScheduledActions(now);

    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      player.id = playerId;
      updatePlayerRuntime(player, now);
    }
  }

  return {
    handleShootInput,
    handleWeaponSwitch,
    update
  };
}

module.exports = {
  createWeaponSystem
};
