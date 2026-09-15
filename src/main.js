import { setupInput } from "./input.js";
import { createNetwork } from "./network.js";
import { createRenderer } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const state = {
  sessionId: localStorage.getItem("tankSession"),
  playerId: null,
  map: null,
  lastServerTime: 0,
  tabActive: true,
  camera: {
    x: 0,
    y: 0
  },
  gameState: {
    players: {},
    projectiles: []
  },
  previousGameState: {
    players: {},
    projectiles: []
  },
  currentGameState: {
    players: {},
    projectiles: []
  },
  lastSnapshotTime: Date.now(),
  input: {
    keys: {},
    turretAngle: 0,
    aimMode: "mouse",
    activeSlot: 1,
    hasWeaponSlotSync: false,
    lastLocalWeaponSwitchTime: 0,
    mouseHeld: false,
    spaceHeld: false,
    lastInput: "",
    rotateSpeed: 0.06
  }
};

function startGame() {
  const renderer = createRenderer(canvas, ctx, state);
  const network = createNetwork(state, {
    handleDamageEvent: renderer.handleDamageEvent
  });

  setupInput({
    canvas,
    state,
    sendMessage: network.sendMessage
  });

  renderer.start();
}

const loginOverlay = document.getElementById("login-overlay");
const usernameInput = document.getElementById("username-input");
const playButton = document.getElementById("play-button");
const loginError = document.getElementById("login-error");

function tryLogin() {
  const username = usernameInput.value.trim();
  if (username.length < 3 || username.length > 20) {
    loginError.textContent = "Username must be 3-20 characters.";
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    loginError.textContent = "Username can only contain letters, numbers, and underscores.";
    return;
  }
  
  localStorage.setItem("tankwar_player", JSON.stringify({ username }));
  loginOverlay.style.display = "none";
  startGame();
}

const cachedPlayer = localStorage.getItem("tankwar_player");
if (cachedPlayer) {
  try {
    const data = JSON.parse(cachedPlayer);
    if (data && data.username) {
      loginOverlay.style.display = "none";
      startGame();
    } else {
      loginOverlay.style.display = "flex";
    }
  } catch(e) {
    loginOverlay.style.display = "flex";
  }
} else {
  loginOverlay.style.display = "flex";
}

playButton.addEventListener("click", tryLogin);
usernameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") tryLogin();
});
