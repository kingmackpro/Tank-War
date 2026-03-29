# Weapon API Guide

This file explains how weapons work in this project right now, and how to safely create or modify them.

It is written for developers and AI agents working inside this codebase.

## 1. Where Weapons Are Defined

All weapon definitions live in:

- `Backend/Weapons.json`

Each weapon is identified by a unique `id`.

Players do not embed full weapon logic in tank data. Tanks only reference weapon IDs in:

- `Backend/tanks.json`

Each player can have at most 5 weapon slots.

Example tank loadout:

```json
{
  "weaponSlots": [
    "basic_gun",
    "fast_gun",
    "heavy_gun",
    null,
    null
  ]
}
```

`null` means an empty slot.

## 2. How Weapons Work In The System

The weapon pipeline is:

`input -> event -> weapon definition -> conditions -> actions -> game world`

Runtime flow in this project:

1. The client sends normal gameplay input to the server.
2. The server receives `shoot` and weapon switch input in `server/server.js`.
3. The weapon system in `server/weapons/index.js` converts input into weapon events.
4. The selected weapon definition is loaded from `Backend/Weapons.json`.
5. Conditions are evaluated in `server/weapons/conditions.js`.
6. If conditions pass, actions are executed in `server/weapons/actions.js`.
7. Actions modify authoritative game state, entities, projectiles, targets, control state, or timers.

Important:

- No weapon should contain hardcoded gameplay logic outside this pipeline.
- Weapon behavior must come from JSON plus the shared executor.
- The server remains authoritative.

## 3. Weapon Structure

Weapons in `Backend/Weapons.json` use this real structure:

```json
{
  "id": "basic_gun",
  "name": "Basic Gun",
  "cooldown": 200,
  "state": {
    "charge": 0,
    "flags": {},
    "timers": {}
  },
  "events": {
    "tap": [],
    "hold_start": [],
    "hold_end": [],
    "re_press": []
  }
}
```

Field meanings:

- `id`
  Unique weapon ID. Tanks reference this value in `weaponSlots`.
- `name`
  Display name used by the client HUD.
- `cooldown`
  Central cooldown duration in milliseconds.
- `state`
  Default internal state for this weapon.
- `events`
  Event-to-pipeline mapping. Each event contains an array of pipelines.

Each event pipeline can contain:

```json
{
  "conditions": [
    { "type": "cooldown_ready" }
  ],
  "actions": [
    { "type": "spawn_projectile", "damage": 15, "speed": 6, "size": 6 }
  ],
  "consumeCooldown": true
}
```

## 4. Events

Supported events:

- `tap`
- `hold_start`
- `hold_end`
- `re_press`

How they are triggered in the current system:

- `tap`
  Triggered when fire starts for a weapon slot.
- `hold_start`
  Triggered once when fire input begins and the weapon enters holding state.
- `hold_end`
  Triggered when held fire times out and the server decides the hold ended.
- `re_press`
  Triggered when repeated fire input arrives while the same weapon is already considered held.

Current mapping lives in:

- `server/weapons/index.js`

Practical note:

- The current client still sends `shoot`.
- The server converts repeated `shoot` messages into hold/re-press style weapon events.
- Event semantics are centralized in the weapon runtime, not in weapon JSON itself.

## 5. Action System

All weapon behavior is executed through:

- `server/weapons/actions.js`

Actions are predefined. You cannot invent a new action name in `Weapons.json` unless you also implement it in `actions.js`.

Supported actions in the current project:

- `spawn_projectile`
  Spawns a projectile entity with configurable damage, speed, size, homing, range, bounce, ignore rules, and lifetime.
- `destroy_entity`
  Removes an entity or projectile from the game world.
- `create_area`
  Creates an area entity with radius and optional duration.
- `detect_in_radius`
  Finds nearby players inside a radius and stores them for later targeting.
- `apply_homing`
  Applies homing behavior to an entity and assigns a target.
- `dash_forward`
  Moves the player forward using server-side collision checks.
- `lock_movement`
  Locks player movement during weapon behavior such as holding or charging.
- `allow_rotation_only`
  Prevents normal movement while still allowing aim/rotation behavior.
- `unlock_movement`
  Explicitly restores player movement if a weapon used hold-based movement locking.
- `teleport_to_entity`
  Teleports the player to a target entity.
- `spawn_shield`
  Creates a shield entity attached to the player.
- `apply_status`
  Applies a runtime status such as `EMP` or `disable`.
- `spawn_entity`
  Spawns a generic runtime entity.
- `transfer_control`
  Moves player control into a spawned entity state.
- `return_control`
  Returns player control back to the player.
- `expire_after`
  Sets an expiration time on an entity.
- `delay_action`
  Schedules actions to execute later.
- `cancel_action`
  Cancels scheduled delayed actions.

Also implemented in the executor and available for use:

- `set_speed`
- `set_lifetime`
- `set_range`
- `set_bounce`
- `set_ignore`
- `select_nearest`
- `set_target`
- `clear_target`
- `attach_to_player`
- `spawn_multiple`
- `filter_damage_type`
- `set_duration`
- `replace_entity`
- `conditional_trigger`

Important rules:

- Action parameters must match what `server/weapons/actions.js` expects.
- JSON does not auto-validate arbitrary fields beyond loader shape checks.
- If you add a new action name in JSON but do not implement it in the executor, it will do nothing useful.

## 6. Conditions System

Conditions are checked before actions run.

Condition logic lives in:

- `server/weapons/conditions.js`

Supported conditions:

- `cooldown_ready`
- `is_holding`
- `is_not_holding`
- `entity_exists`
- `target_in_radius`
- `collision_detected`
- `charge_complete`

Also currently supported:

- `owner_tag_valid`

What conditions do:

- They prevent actions from running when the weapon state or world state is not valid.
- They are the safe gate before execution.
- They should be used instead of adding special checks somewhere else in the server.

## 7. State System

Weapon state is stored per weapon slot instance, per player.

Runtime state is created in:

- `server/weapons/runtime.js`

Each slot tracks values such as:

- `cooldownEndsAt`
- `lastTriggeredAt`
- `charge`
- `flags`
- `timers`
- `activeEntityIds`
- `selectedTargetId`
- `detectedEntityIds`
- `isHolding`
- `holdStartTime`
- `holdDuration`
- `holdProgress`
- `maxHoldTime`
- `lastEventType`

Player runtime also tracks:

- pending weapon events
- hold input state
- movement lock state
- statuses
- control state
- controlled entity reference

This state is required for more advanced weapons such as:

- switch/swap behavior
- shields
- charge weapons
- spawned controllable entities
- delayed or chained triggers

Movement lock safety:

- Hold-based weapons can lock movement with `lock_movement` or `allow_rotation_only`
- Movement can be explicitly restored with `unlock_movement`
- The runtime also force-unlocks movement when the player is no longer holding and not executing another controlling state
- Movement should never remain permanently locked after `hold_end`

## 8. Cooldown Rules

Cooldown is mandatory.

Current cooldown handling is centralized in:

- `server/weapons/index.js`

Rules:

- Cooldown is defined per weapon in `Weapons.json`
- Cooldown readiness is checked with the `cooldown_ready` condition
- Cooldown is applied centrally after successful execution when the event pipeline consumes cooldown
- Do not bypass cooldown in ad hoc code

If a weapon should not consume cooldown for a specific pipeline, set:

```json
{
  "consumeCooldown": false
}
```

Use that carefully.

## Hold Feedback Data

The server now exposes hold-related data in the normal player snapshot so the client can draw charge bars, hold rings, or other UI feedback.

Per weapon slot, the snapshot includes:

- `isHolding`
- `holdStartTime`
- `holdDuration`
- `holdProgress`
- `maxHoldTime`

How it works:

- On `hold_start`, the runtime stores `holdStartTime`
- Each server tick, `holdDuration` is updated while holding
- If the weapon defines `maxHoldTime`, then `holdProgress` is calculated as:
  `holdDuration / maxHoldTime`
- `holdProgress` is clamped to the range `0..1`
- On `hold_end`, hold timing values are reset

If a weapon does not define `maxHoldTime`, `holdProgress` stays at `0` unless you extend the runtime for a different hold model.

## 9. How To Create A New Weapon

Follow these steps:

1. Add a new weapon entry to `Backend/Weapons.json`
2. Define:
   - `id`
   - `name`
   - `cooldown`
   - `state`
   - `events`
3. Build behavior using existing conditions and actions only
4. Add the new weapon ID to a tank loadout in `Backend/tanks.json`
5. Restart the server so the new weapon definitions load
6. Verify the weapon shape is valid and uses only supported action/condition types

Practical checklist:

- Does the weapon have a unique `id`?
- Does every used event contain valid pipelines?
- Does every pipeline contain at least one action?
- Are all action names already implemented in `actions.js`?
- Are all condition names already implemented in `conditions.js`?
- If the weapon uses holding, does it cleanly release movement by `hold_end` or `unlock_movement`?
- If the weapon is charge-based, does it define `maxHoldTime` if client progress UI is needed?

## 10. How To Modify A Weapon

To change an existing weapon:

1. Edit only `Backend/Weapons.json`
2. Change cooldown, conditions, actions, or default state as needed
3. Keep the same JSON structure
4. Do not move weapon logic into other files

Do not edit:

- `server/weapons/actions.js`
- `server/weapons/conditions.js`
- `server/weapons/index.js`

unless you are adding a real new API capability.

If the desired behavior can be expressed with existing actions and conditions, JSON is the only place you should modify.

## 11. How To Add New API Features

If you need a behavior the current API cannot express, extend the API itself.

Safe process:

1. Add the new action to `server/weapons/actions.js`
2. Add any needed normalization/validation in `server/weapons/loader.js`
3. Add a new condition in `server/weapons/conditions.js` if required
4. If new runtime state is needed, extend `server/weapons/runtime.js`
5. If new event behavior is needed, update `server/weapons/index.js`
6. Document the new action or condition in this file

Important:

- Keep new behavior generic
- Do not add a weapon-specific branch like `if (weapon.id === "shield_gun")`
- Add reusable API primitives, not special cases

## Rules

These rules are mandatory for this project:

- Do not hardcode weapon behavior anywhere outside the Weapon API
- Do not invent unsupported action names in JSON
- Do not invent unsupported condition names in JSON
- Do not bypass centralized cooldown handling
- Do not put weapon logic back into tank definitions
- Do not add weapon-specific logic directly in player movement, server message handlers, or client UI
- Keep definitions valid, minimal, and data-driven

## Minimal Valid Example

```json
{
  "id": "example_gun",
  "name": "Example Gun",
  "cooldown": 250,
  "maxHoldTime": 1000,
  "state": {
    "charge": 0,
    "flags": {},
    "timers": {}
  },
  "events": {
    "tap": [
      {
        "conditions": [
          { "type": "cooldown_ready" }
        ],
        "actions": [
          {
            "type": "spawn_projectile",
            "damage": 12,
            "speed": 7,
            "size": 6,
            "damageType": "kinetic",
            "ignore": { "owner": true }
          }
        ]
      }
    ],
    "hold_start": [
      {
        "conditions": [
          { "type": "cooldown_ready" }
        ],
        "actions": [
          { "type": "lock_movement" }
        ],
        "consumeCooldown": false
      }
    ],
    "hold_end": [
      {
        "actions": [
          { "type": "unlock_movement" }
        ],
        "consumeCooldown": false
      }
    ],
    "re_press": []
  }
}
```

## File Map

Use this when working on the system:

- `Backend/Weapons.json`
  Weapon definitions
- `Backend/tanks.json`
  Tank loadouts using weapon IDs
- `server/weapons/loader.js`
  Weapon loading and structural validation
- `server/weapons/runtime.js`
  Per-player and per-slot weapon state
- `server/weapons/conditions.js`
  Condition evaluation
- `server/weapons/actions.js`
  Central action executor
- `server/weapons/index.js`
  Event pipeline, hold logic, scheduled actions, cooldown integration
- `server/projectile.js`
  Shared projectile runtime behavior after creation
- `server/entities.js`
  Shared entity registration and cleanup

## Final Guidance

When adding or editing weapons, the correct question is:

"Can this be expressed as data using the current Weapon API?"

If yes:

- change JSON only

If no:

- extend the API in the shared weapon system files
- keep it generic
- document it here

That is the standard for this project.
