# Tank War Next Steps

1. Add a real match/lobby lifecycle and server instance assignment.
2. Add integration tests that start the WebSocket server and exercise reconnect/disconnect behavior.
3. Add interpolation/client prediction only after measuring current snapshot behavior.
4. Define authenticated accounts and persistence boundaries; keep simulation state in memory.
5. Add server-side rate limits and a session/authentication strategy before exposing a public server.
6. Deploy the static client separately from a persistent WSS game-server host.
7. Expand weapon-definition validation before adding new weapon action types.
8. Design component-built weapon definitions to compile into the existing validated event/action schema.
