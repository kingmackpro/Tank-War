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
  input: {
    keys: {},
    turretAngle: 0,
    aimMode: "mouse",
    activeSlot: 1,
    mouseHeld: false,
    spaceHeld: false,
    lastInput: "",
    rotateSpeed: 0.06
  }
};

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
