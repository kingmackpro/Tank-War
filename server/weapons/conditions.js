function getEntityLike(context, entityId) {
  if (!entityId) {
    return null;
  }

  return context.gameState.players[entityId] || context.getEntity(entityId);
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function evaluateCondition(condition, context) {
  switch (condition.type) {
    case "is_holding":
      return Boolean(context.slotRuntime.isHolding);
    case "is_not_holding":
      return !context.slotRuntime.isHolding;
    case "entity_exists": {
      const entityId =
        condition.entityId ||
        context.lastEntityId ||
        context.slotRuntime.selectedTargetId;
      return Boolean(getEntityLike(context, entityId));
    }
    case "cooldown_ready":
      return context.now >= context.slotRuntime.cooldownEndsAt;
    case "target_in_radius": {
      const target = getEntityLike(
        context,
        context.slotRuntime.selectedTargetId || context.selectedEntityId
      );

      if (!target) {
        return false;
      }

      const radius = Number.isFinite(condition.radius) ? condition.radius : Infinity;
      return distanceBetween(context.player, target) <= radius;
    }
    case "owner_tag_valid":
      if (!Array.isArray(condition.tags) || condition.tags.length === 0) {
        return true;
      }
      return condition.tags.includes(context.player.tank.type);
    case "collision_detected":
      return Boolean(context.collisionDetected);
    case "charge_complete": {
      const requiredCharge = Number.isFinite(condition.value) ? condition.value : 1;
      return context.slotRuntime.charge >= requiredCharge;
    }
    default:
      return false;
  }
}

function evaluateConditions(conditions, context) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return true;
  }

  return conditions.every((condition) => evaluateCondition(condition, context));
}

module.exports = {
  evaluateConditions
};
