export function setupInput(options) {
  const { canvas, state, sendMessage } = options;

  document.addEventListener("keydown", (event) => {
    state.input.keys[event.key.toLowerCase()] = true;

    if (event.key >= "1" && event.key <= "5") {
      const slot = parseInt(event.key, 10);

      if (slot !== state.input.activeSlot) {
        state.input.activeSlot = slot;
        state.input.lastLocalWeaponSwitchTime = Date.now();
        sendMessage({
          type: "weapon_switch",
          slot
        });
      }
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      state.input.aimMode = "keyboard";
    }

    if (event.key === " ") {
      shoot(state, sendMessage);
    }
  });

  document.addEventListener("keyup", (event) => {
    state.input.keys[event.key.toLowerCase()] = false;
  });

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + state.camera.x;
    const mouseY = event.clientY - rect.top + state.camera.y;
    const player = state.gameState.players[state.playerId];

    if (!player) {
      return;
    }

    state.input.turretAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
    state.input.aimMode = "mouse";
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      state.input.mouseHeld = true;
      shoot(state, sendMessage);
    }
  });

  canvas.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
      state.input.mouseHeld = false;
    }
  });

  canvas.addEventListener("mouseleave", () => {
    state.input.mouseHeld = false;
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      state.input.spaceHeld = true;
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "Space") {
      state.input.spaceHeld = false;
    }
  });

  document.addEventListener("visibilitychange", () => {
    state.tabActive = !document.hidden;
  });

  window.addEventListener("blur", () => {
    state.input.mouseHeld = false;
    state.input.spaceHeld = false;
  });

  setInterval(() => {
    if (!state.input.mouseHeld && !state.input.spaceHeld) {
      return;
    }

    shoot(state, sendMessage);
  }, 50);

  setInterval(() => {
    updateInput(state, sendMessage);
  }, 1000 / 30);
}

function updateInput(state, sendMessage) {
  if (!state.playerId || !state.tabActive) {
    return;
  }

  if (state.input.aimMode === "keyboard") {
    if (state.input.keys.arrowleft) {
      state.input.turretAngle -= state.input.rotateSpeed;
    }

    if (state.input.keys.arrowright) {
      state.input.turretAngle += state.input.rotateSpeed;
    }
  }

  const payload = {
    type: "input",
    keys: state.input.keys,
    turretAngle: state.input.turretAngle
  };
  const serializedPayload = JSON.stringify(payload);

  if (serializedPayload === state.input.lastInput) {
    return;
  }

  if (sendMessage(payload)) {
    state.input.lastInput = serializedPayload;
  }
}

function shoot(state, sendMessage) {
  const player = state.gameState.players[state.playerId];

  if (!player) {
    return;
  }

  const weapon = player.weaponSlots?.[state.input.activeSlot - 1] || null;

  if (!weapon) {
    return;
  }

  sendMessage({ type: "shoot" });
}
