const { mapCollision, rectFromCenter } = require("../physics");

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createActionExecutor(dependencies) {
  const {
    barrelLength,
    destroyEntity,
    gameState,
    getEntity,
    map,
    registerEntity,
    spawnProjectile,
    tankSize
  } = dependencies;

  function getTargetEntity(context, explicitId) {
    const entityId =
      explicitId ||
      context.selectedEntityId ||
      context.slotRuntime.selectedTargetId ||
      context.lastEntityId;

    if (!entityId) {
      return null;
    }

    return gameState.players[entityId] || getEntity(entityId);
  }

  function markLastEntity(context, entity) {
    if (!entity) {
      return;
    }

    context.lastEntityId = entity.id;

    if (!context.slotRuntime.activeEntityIds.includes(entity.id)) {
      context.slotRuntime.activeEntityIds.push(entity.id);
    }
  }

  function executeSpawnProjectile(action, context, angleOffset = 0) {
    const speed = Number.isFinite(action.speed) ? action.speed : 6;
    const projectileAngle = context.player.turretAngle + angleOffset;
    const projectile = spawnProjectile({
      ownerId: context.playerId,
      x: context.player.x + Math.cos(projectileAngle) * (action.barrelLength || barrelLength),
      y: context.player.y + Math.sin(projectileAngle) * (action.barrelLength || barrelLength),
      vx: Math.cos(projectileAngle) * speed,
      vy: Math.sin(projectileAngle) * speed,
      speed,
      size: Number.isFinite(action.size) ? action.size : 6,
      damage: Number.isFinite(action.damage) ? action.damage : 0,
      damageType: action.damageType || "kinetic",
      lifetime: Number.isFinite(action.lifetime) ? action.lifetime : null,
      range: Number.isFinite(action.range) ? action.range : null,
      bounce: action.bounce,
      ignore: action.ignore,
      targetId: action.targetId || context.slotRuntime.selectedTargetId || null,
      homing: action.homing || null
    });

    markLastEntity(context, projectile);
    return true;
  }

  function executeSpawnEntity(action, context) {
    const entity = registerEntity({
      type: action.entityType || "entity",
      ownerId: context.playerId,
      x: Number.isFinite(action.x) ? action.x : context.player.x,
      y: Number.isFinite(action.y) ? action.y : context.player.y,
      radius: Number.isFinite(action.radius) ? action.radius : 0,
      expiresAt: Number.isFinite(action.duration) ? context.now + action.duration : null
    }, action.entityType || "entity");

    markLastEntity(context, entity);
    return true;
  }

  function movePlayerWithCollision(player, nextX, nextY) {
    const nextXbox = rectFromCenter(nextX, player.y, tankSize, tankSize);

    if (!mapCollision(map, nextXbox)) {
      player.x = nextX;
    }

    const nextYBox = rectFromCenter(player.x, nextY, tankSize, tankSize);

    if (!mapCollision(map, nextYBox)) {
      player.y = nextY;
    }
  }

  function executeActions(actions, context) {
    let executed = false;

    for (const action of actions) {
      switch (action.type) {
        case "spawn_projectile":
          executed = executeSpawnProjectile(action, context) || executed;
          break;
        case "destroy_entity": {
          const entityId = action.entityId || context.lastEntityId;
          destroyEntity(entityId);
          executed = true;
          break;
        }
        case "set_speed": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            const speed = Number.isFinite(action.speed) ? action.speed : entity.speed;
            const angle = Math.atan2(entity.vy || 0, entity.vx || 0);
            entity.speed = speed;
            entity.vx = Math.cos(angle) * speed;
            entity.vy = Math.sin(angle) * speed;
            executed = true;
          }
          break;
        }
        case "set_lifetime": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity && Number.isFinite(action.lifetime)) {
            entity.expiresAt = context.now + action.lifetime;
            executed = true;
          }
          break;
        }
        case "set_range": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity && Number.isFinite(action.range)) {
            entity.range = action.range;
            executed = true;
          }
          break;
        }
        case "set_bounce": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            entity.bounceRemaining = typeof action.bounce === "number" ? action.bounce : 1;
            executed = true;
          }
          break;
        }
        case "set_ignore": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            entity.ignore = {
              owner: Boolean(action.ignore?.owner),
              walls: Boolean(action.ignore?.walls)
            };
            executed = true;
          }
          break;
        }
        case "create_area": {
          const area = registerEntity({
            type: "area",
            ownerId: context.playerId,
            x: context.player.x,
            y: context.player.y,
            radius: Number.isFinite(action.radius) ? action.radius : 100,
            expiresAt: Number.isFinite(action.duration) ? context.now + action.duration : null
          }, "area");

          markLastEntity(context, area);
          executed = true;
          break;
        }
        case "detect_in_radius": {
          const radius = Number.isFinite(action.radius) ? action.radius : 100;
          const detectedIds = [];

          for (const playerId in gameState.players) {
            if (playerId === context.playerId) {
              continue;
            }

            const targetPlayer = gameState.players[playerId];
            if (distanceBetween(context.player, targetPlayer) <= radius) {
              detectedIds.push(playerId);
            }
          }

          context.slotRuntime.detectedEntityIds = detectedIds;
          executed = true;
          break;
        }
        case "select_nearest": {
          const sourceIds = context.slotRuntime.detectedEntityIds || [];
          let nearestId = null;
          let nearestDistance = Infinity;

          sourceIds.forEach((entityId) => {
            const entity = getTargetEntity(context, entityId);

            if (!entity) {
              return;
            }

            const distance = distanceBetween(context.player, entity);

            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestId = entityId;
            }
          });

          context.slotRuntime.selectedTargetId = nearestId;
          context.selectedEntityId = nearestId;
          executed = true;
          break;
        }
        case "apply_homing": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            entity.homing = {
              enabled: true,
              turnRate: Number.isFinite(action.turnRate) ? action.turnRate : 0.15
            };
            entity.targetId = action.targetId || context.slotRuntime.selectedTargetId || null;
            executed = true;
          }
          break;
        }
        case "set_target":
          context.slotRuntime.selectedTargetId =
            action.targetId ||
            context.selectedEntityId ||
            context.lastEntityId ||
            null;
          executed = true;
          break;
        case "clear_target":
          context.slotRuntime.selectedTargetId = null;
          executed = true;
          break;
        case "dash_forward": {
          const distance = Number.isFinite(action.distance) ? action.distance : 60;
          const nextX = context.player.x + Math.cos(context.player.turretAngle) * distance;
          const nextY = context.player.y + Math.sin(context.player.turretAngle) * distance;
          movePlayerWithCollision(context.player, nextX, nextY);
          executed = true;
          break;
        }
        case "lock_movement":
          context.player.runtime.movementLock.locked = true;
          context.player.runtime.movementLock.rotationOnly = false;
          context.player.runtime.movementLock.expiresAt = Number.isFinite(action.duration)
            ? context.now + action.duration
            : 0;
          context.player.runtime.controlState = "holding";
          executed = true;
          break;
        case "allow_rotation_only":
          context.player.runtime.movementLock.rotationOnly = true;
          context.player.runtime.movementLock.expiresAt = Number.isFinite(action.duration)
            ? context.now + action.duration
            : 0;
          context.player.runtime.controlState = "holding";
          executed = true;
          break;
        case "unlock_movement":
          context.player.runtime.movementLock.locked = false;
          context.player.runtime.movementLock.rotationOnly = false;
          context.player.runtime.movementLock.expiresAt = 0;

          if (context.player.runtime.controlState === "holding") {
            context.player.runtime.controlState = "idle";
          }

          executed = true;
          break;
        case "teleport_to_entity": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            context.player.x = entity.x;
            context.player.y = entity.y;
            executed = true;
          }
          break;
        }
        case "spawn_shield": {
          const shield = registerEntity({
            type: "shield",
            ownerId: context.playerId,
            attachedToPlayerId: context.playerId,
            x: context.player.x,
            y: context.player.y,
            radius: Number.isFinite(action.radius) ? action.radius : 30,
            damageFilters: Array.isArray(action.damageTypes)
              ? [...action.damageTypes]
              : action.damageType
                ? [action.damageType]
                : [],
            expiresAt: Number.isFinite(action.duration) ? context.now + action.duration : null
          }, "shield");

          markLastEntity(context, shield);
          executed = true;
          break;
        }
        case "attach_to_player": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            entity.attachedToPlayerId = action.playerId || context.playerId;
            executed = true;
          }
          break;
        }
        case "spawn_multiple": {
          const count = Number.isInteger(action.count) ? action.count : 1;
          const spread = Number.isFinite(action.spread) ? action.spread : 0;
          const nestedActions = Array.isArray(action.actions)
            ? action.actions
            : action.action
              ? [action.action]
              : [];

          for (let index = 0; index < count; index += 1) {
            const angleOffset = count === 1
              ? 0
              : (-spread / 2) + (spread / Math.max(count - 1, 1)) * index;

            nestedActions.forEach((nestedAction) => {
              if (nestedAction.type === "spawn_projectile") {
                executeSpawnProjectile(nestedAction, context, angleOffset);
                executed = true;
              } else {
                executeActions([nestedAction], context);
                executed = true;
              }
            });
          }
          break;
        }
        case "filter_damage_type": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            entity.damageFilters = Array.isArray(action.damageTypes)
              ? [...action.damageTypes]
              : action.damageType
                ? [action.damageType]
                : [];
            executed = true;
          }
          break;
        }
        case "apply_status": {
          const target = getTargetEntity(context, action.targetId) || context.player;

          if (target?.runtime) {
            target.runtime.statuses.push({
              type: action.status || "disable",
              expiresAt: Number.isFinite(action.duration)
                ? context.now + action.duration
                : null
            });
            executed = true;
          }
          break;
        }
        case "set_duration": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity && Number.isFinite(action.duration)) {
            entity.expiresAt = context.now + action.duration;
            executed = true;
          }
          break;
        }
        case "spawn_entity":
          executed = executeSpawnEntity(action, context) || executed;
          break;
        case "transfer_control": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity) {
            context.player.runtime.controlledEntityId = entity.id;
            context.player.runtime.controlState = "controlled_entity";
            executed = true;
          }
          break;
        }
        case "return_control":
          context.player.runtime.controlledEntityId = null;
          context.player.runtime.controlState = "idle";
          executed = true;
          break;
        case "replace_entity": {
          const entityId = action.entityId || context.lastEntityId;
          destroyEntity(entityId);
          if (action.replacement) {
            executeActions([action.replacement], context);
          }
          executed = true;
          break;
        }
        case "expire_after": {
          const entity = getTargetEntity(context, action.entityId);
          if (entity && Number.isFinite(action.duration)) {
            entity.expiresAt = context.now + action.duration;
            executed = true;
          }
          break;
        }
        case "conditional_trigger":
          if (context.evaluateConditions(action.conditions || [], context)) {
            executeActions(action.actions || [], context);
            executed = true;
          }
          break;
        case "delay_action": {
          const scheduledAction = {
            id: `scheduled_${gameState.internal.nextScheduledActionId}`,
            tag: action.tag || null,
            executeAt: context.now + (Number.isFinite(action.delay) ? action.delay : 0),
            playerId: context.playerId,
            slotIndex: context.slotIndex,
            actions: Array.isArray(action.actions) ? action.actions : []
          };

          gameState.internal.nextScheduledActionId += 1;
          gameState.internal.scheduledActions.push(scheduledAction);
          executed = true;
          break;
        }
        case "cancel_action":
          gameState.internal.scheduledActions = gameState.internal.scheduledActions.filter(
            (scheduledAction) => (
              action.id
                ? scheduledAction.id !== action.id
                : scheduledAction.tag !== action.tag
            )
          );
          executed = true;
          break;
        default:
          break;
      }
    }

    return executed;
  }

  return {
    executeActions
  };
}

module.exports = {
  createActionExecutor
};
