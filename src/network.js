const SERVER_URL = "wss://prospective-cos-crimes-unique.trycloudflare.com";

export function createNetwork(state, handlers) {
  let socket = null;

  function sendMessage(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }

  function handleServerMessage(event) {
    const data = JSON.parse(event.data);

    if (data.type === "session") {
      state.sessionId = data.sessionId;
      localStorage.setItem("tankSession", state.sessionId);
      return;
    }

    if (data.type === "init") {
      state.playerId = data.id;
      return;
    }

    if (data.type === "map") {
      state.map = data.data;
      return;
    }

    if (data.type === "state") {
      if (data.time <= state.lastServerTime) {
        return;
      }

      state.lastServerTime = data.time;
      state.gameState.players = data.players;
      state.gameState.projectiles = data.projectiles;

      const player = state.gameState.players[state.playerId];

      if (player && Number.isInteger(player.weaponSlot)) {
        state.input.activeSlot = player.weaponSlot + 1;
      }

      return;
    }

    if (data.type === "damage") {
      handlers.handleDamageEvent(data);
    }
  }

  function connect() {
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
      sendMessage({
        type: "session",
        sessionId: state.sessionId
      });
    };

    socket.onmessage = handleServerMessage;

    socket.onclose = () => {
      console.log("Disconnected. Reconnecting...");
      setTimeout(connect, 2000);
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  connect();

  return {
    sendMessage
  };
}
