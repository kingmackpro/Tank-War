const SERVER_URL = "wss://functions-antivirus-emily-shakespeare.trycloudflare.com";

export function createNetwork(state, handlers) {
  let socket = null;
  let currentServerUrl = SERVER_URL;
  let reconnectTimeout = null;

  function clearReconnectTimeout() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

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
      state.previousGameState = state.currentGameState;
      state.currentGameState = {
        players: data.players,
        projectiles: data.projectiles
      };
      state.gameState = state.currentGameState;
      state.lastSnapshotTime = Date.now();

      const player = state.currentGameState.players[state.playerId];

      if (player && Number.isInteger(player.weaponSlot)) {
        state.input.activeSlot = player.weaponSlot + 1;
      }

      return;
    }

    if (data.type === "damage") {
      handlers.handleDamageEvent(data);
    }
  }

  function disconnectSocket() {
    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
    socket = null;
  }

  function connect() {
    clearReconnectTimeout();

    const nextSocket = new WebSocket(currentServerUrl);
    socket = nextSocket;

    nextSocket.onopen = () => {
      sendMessage({
        type: "session",
        sessionId: state.sessionId
      });
    };

    nextSocket.onmessage = handleServerMessage;

    nextSocket.onclose = () => {
      if (socket !== nextSocket) {
        return;
      }

      console.log("Disconnected. Reconnecting...");
      reconnectTimeout = setTimeout(connect, 2000);
    };

    nextSocket.onerror = () => {
      nextSocket.close();
    };
  }

  function reconnect() {
    clearReconnectTimeout();
    disconnectSocket();
    connect();
  }

  function toPromptUrl(wsUrl) {
    if (wsUrl.startsWith("wss://")) {
      return `https://${wsUrl.slice(6)}`;
    }

    if (wsUrl.startsWith("ws://")) {
      return `http://${wsUrl.slice(5)}`;
    }

    return wsUrl;
  }

  function normalizeBackendUrl(url) {
    const trimmedUrl = url.trim();

    if (trimmedUrl.startsWith("https://")) {
      return `wss://${trimmedUrl.slice(8)}`;
    }

    if (trimmedUrl.startsWith("http://")) {
      return `ws://${trimmedUrl.slice(7)}`;
    }

    return null;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "F2") {
      return;
    }

    event.preventDefault();

    const input = window.prompt("Enter backend URL:", toPromptUrl(currentServerUrl));

    if (input === null) {
      return;
    }

    const nextUrl = normalizeBackendUrl(input);

    if (!nextUrl) {
      window.alert("Invalid backend URL. Use http:// or https://");
      return;
    }

    currentServerUrl = nextUrl;
    reconnect();
  });

  connect();

  return {
    sendMessage
  };
}
