# Tank War Architecture

## VERIFIED (local, 2026-09-15)

- One Node.js process serves the static browser client and owns a WebSocket server on port 8080.
- The browser sends intent only: session, movement keys, turret angle, selected weapon slot, and shoot input.
- The server owns player position, collision checks, weapon cooldowns, projectiles, damage, respawn, and state snapshots.
- Weapon definitions are loaded from `Backend/Weapons.json`. Their event/action format is data-driven, so future component-built weapons can compile to the same runtime definition shape instead of requiring client authority.

## Runtime boundaries

- `server/state.js`: loaded static map/tank/weapon data plus ephemeral match state.
- `server/server.js`: static files, WebSocket lifecycle, session restoration, and network validation.
- `server/player.js`, `server/projectile.js`, `server/physics.js`: authoritative simulation rules.
- `server/weapons/`: data loader and event/action execution runtime.
- `src/`: untrusted presentation, local input collection, and WebSocket client.

The server broadcasts public snapshots. Runtime-only weapon fields are intentionally non-enumerable and are not serialized to clients.

## Persistence plan (PLANNED)

Do not write match state to a database every tick. A future database should store accounts, profile/settings, progression, match statistics, unlocks, inventories, and saved tank/weapon designs. A match server should retain positions, inputs, projectiles, cooldowns, health, and temporary effects only in memory for the duration of a match.

## Deployment / Vercel

Vercel is appropriate for the static client, HTTP APIs, authentication callbacks, and database-facing endpoints. It is not an appropriate replacement for this long-lived authoritative WebSocket simulation process. Deploy the game server to a persistent compute host that supports long-running WebSocket connections; have the Vercel-hosted client connect to that service over WSS. Matchmaking can live in an API/database layer and assign clients to a game-server instance.
