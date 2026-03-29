function createEntityId(gameState, prefix = "entity") {
  const id = `${prefix}_${gameState.internal.nextEntityId}`;
  gameState.internal.nextEntityId += 1;
  return id;
}

function registerEntity(gameState, entity, prefix = "entity") {
  const nextEntity = entity;

  if (!nextEntity.id) {
    nextEntity.id = createEntityId(gameState, prefix);
  }

  gameState.internal.entities[nextEntity.id] = nextEntity;
  return nextEntity;
}

function getEntity(gameState, entityId) {
  if (!entityId) {
    return null;
  }

  return gameState.internal.entities[entityId] || null;
}

function destroyEntity(gameState, entityId) {
  if (!entityId) {
    return;
  }

  delete gameState.internal.entities[entityId];

  for (let i = gameState.projectiles.length - 1; i >= 0; i -= 1) {
    if (gameState.projectiles[i].id === entityId) {
      gameState.projectiles.splice(i, 1);
    }
  }

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];

    if (!player.runtime) {
      continue;
    }

    player.runtime.weaponSlots.forEach((slotRuntime) => {
      slotRuntime.activeEntityIds = slotRuntime.activeEntityIds.filter(
        (activeEntityId) => activeEntityId !== entityId
      );

      if (slotRuntime.selectedTargetId === entityId) {
        slotRuntime.selectedTargetId = null;
      }
    });

    if (player.runtime.controlledEntityId === entityId) {
      player.runtime.controlledEntityId = null;

      if (player.runtime.controlState === "controlled_entity") {
        player.runtime.controlState = "idle";
      }
    }
  }
}

function tickEntities(gameState) {
  const now = Date.now();

  for (const entityId of Object.keys(gameState.internal.entities)) {
    const entity = gameState.internal.entities[entityId];

    if (!entity) {
      continue;
    }

    if (entity.attachedToPlayerId) {
      const owner = gameState.players[entity.attachedToPlayerId];

      if (!owner) {
        destroyEntity(gameState, entityId);
        continue;
      }

      entity.x = owner.x;
      entity.y = owner.y;
    }

    if (entity.expiresAt && now >= entity.expiresAt) {
      destroyEntity(gameState, entityId);
    }
  }
}

module.exports = {
  createEntityId,
  destroyEntity,
  getEntity,
  registerEntity,
  tickEntities
};
