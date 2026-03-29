import { drawProjectile } from "./entities/projectile.js";
import { drawTank } from "./entities/tank.js";

const TANK_SIZE = 40;
const TANK_HALF = 20;

export function createRenderer(canvas, ctx, state) {
  const effects = {
    particles: [],
    damageTexts: [],
    hitIndicators: [],
    shakeTime: 0,
    shakeX: 0,
    shakeY: 0,
    fps: 0,
    frameCount: 0,
    lastFpsTime: performance.now(),
    lastFrameTime: performance.now(),
    frameMS: 0,
    previousWeaponSlot: null,
    weaponAnimationProgress: 1,
    displayedWeaponName: "Empty"
  };

  function updateWeaponUiState(player) {
    const currentSlot = state.input.activeSlot;
    const weapon = player.weaponSlots?.[currentSlot - 1] || null;

    if (effects.previousWeaponSlot === null) {
      effects.previousWeaponSlot = currentSlot;
      effects.displayedWeaponName = weapon ? weapon.name : "Empty";
      effects.weaponAnimationProgress = 1;
      return;
    }

    if (currentSlot !== effects.previousWeaponSlot) {
      effects.previousWeaponSlot = currentSlot;
      effects.displayedWeaponName = weapon ? weapon.name : "Empty";
      effects.weaponAnimationProgress = 0;
      return;
    }

    if (effects.weaponAnimationProgress < 1) {
      effects.weaponAnimationProgress = Math.min(
        effects.weaponAnimationProgress + effects.frameMS / 160,
        1
      );
    }
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i += 1) {
      effects.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 30,
        color
      });
    }
  }

  function spawnDamageText(x, y, value, color) {
    effects.damageTexts.push({
      x,
      y,
      vy: -0.5,
      life: 60,
      text: value,
      color
    });
  }

  function handleDamageEvent(data) {
    const player = state.gameState.players[state.playerId];
    const target = state.gameState.players[data.targetId];

    if (player && target) {
      const screenX = target.x - state.camera.x;
      const screenY = target.y - state.camera.y;

      if (
        screenX < 0 || screenX > canvas.width ||
        screenY < 0 || screenY > canvas.height
      ) {
        const existing = effects.hitIndicators.find((indicator) => (
          Math.abs(indicator.x - target.x) < 50 &&
          Math.abs(indicator.y - target.y) < 50
        ));

        if (existing) {
          existing.time = Date.now() + 2000;
        } else {
          effects.hitIndicators.push({
            x: target.x,
            y: target.y,
            time: Date.now() + 2000
          });
        }
      }
    }

    if (!state.tabActive) {
      return;
    }

    const damageTarget = state.gameState.players[data.targetId];

    if (!damageTarget) {
      return;
    }

    if (data.targetId === state.playerId) {
      effects.shakeTime = Date.now() + 150;
    }

    if (data.armorDamage > 0) {
      spawnParticles(damageTarget.x, damageTarget.y, "#4aa3ff");
      spawnDamageText(damageTarget.x, damageTarget.y - 20, data.armorDamage, "#4aa3ff");
    }

    if (data.hpDamage > 0) {
      spawnParticles(damageTarget.x, damageTarget.y, "#ff3b3b");
      spawnDamageText(damageTarget.x, damageTarget.y - 35, data.hpDamage, "#ff3b3b");
    }
  }

  function updateParticles() {
    for (let i = effects.particles.length - 1; i >= 0; i -= 1) {
      const particle = effects.particles[i];

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= 1;

      if (particle.life <= 0) {
        effects.particles.splice(i, 1);
        continue;
      }

      if (
        particle.x < state.camera.x - 100 ||
        particle.x > state.camera.x + canvas.width + 100 ||
        particle.y < state.camera.y - 100 ||
        particle.y > state.camera.y + canvas.height + 100
      ) {
        effects.particles.splice(i, 1);
      }
    }
  }

  function updateDamageTexts() {
    for (let i = effects.damageTexts.length - 1; i >= 0; i -= 1) {
      const damageText = effects.damageTexts[i];

      damageText.y += damageText.vy;
      damageText.life -= 1;

      if (damageText.life <= 0) {
        effects.damageTexts.splice(i, 1);
      }
    }
  }

  function drawMap() {
    if (!state.map) {
      return;
    }

    ctx.fillStyle = "#444";
    state.map.walls.forEach((object) => {
      ctx.fillRect(object.x - state.camera.x, object.y - state.camera.y, object.w, object.h);
    });

    ctx.fillStyle = "#777";
    state.map.stones.forEach((object) => {
      ctx.fillRect(object.x - state.camera.x, object.y - state.camera.y, object.w, object.h);
    });

    ctx.fillStyle = "#6b4a2d";
    state.map.covers.forEach((object) => {
      ctx.fillRect(object.x - state.camera.x, object.y - state.camera.y, object.w, object.h);
    });
  }

  function drawParticles() {
    effects.particles.forEach((particle) => {
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        particle.x - state.camera.x,
        particle.y - state.camera.y,
        3,
        3
      );
    });
  }

  function drawDamageTexts() {
    ctx.font = "14px monospace";

    effects.damageTexts.forEach((damageText) => {
      ctx.fillStyle = damageText.color;
      ctx.fillText(
        damageText.text,
        damageText.x - state.camera.x,
        damageText.y - state.camera.y
      );
    });
  }

  function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawPanel(x, y, width, height, radius = 12) {
    ctx.save();
    ctx.fillStyle = "rgba(8,10,14,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.25;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    drawRoundedRect(x, y, width, height, radius);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();
    ctx.restore();
  }

  function drawBar(x, y, width, height, ratio, fillColor, label, valueText, options = {}) {
    const clampedRatio = Math.max(0, Math.min(ratio, 1));
    const {
      labelColor = "rgba(255,255,255,0.72)",
      backgroundColor = "rgba(255,255,255,0.08)",
      borderColor = "rgba(255,255,255,0.08)",
      shadowColor = "transparent",
      shadowBlur = 0,
      valueColor = labelColor
    } = options;

    ctx.save();
    ctx.font = "11px monospace";
    ctx.fillStyle = labelColor;
    ctx.fillText(label, x, y - 6);
    ctx.textAlign = "right";
    ctx.fillStyle = valueColor;
    ctx.fillText(valueText, x + width, y - 6);
    ctx.textAlign = "left";

    ctx.fillStyle = backgroundColor;
    drawRoundedRect(x, y, width, height, 6);
    ctx.fill();

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.fillStyle = fillColor;
    drawRoundedRect(x, y, width * clampedRatio, height, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }

  function drawHitIndicators() {
    const now = Date.now();

    for (let i = effects.hitIndicators.length - 1; i >= 0; i -= 1) {
      const indicator = effects.hitIndicators[i];

      if (now > indicator.time) {
        effects.hitIndicators.splice(i, 1);
        continue;
      }

      const screenX = indicator.x - state.camera.x;
      const screenY = indicator.y - state.camera.y;

      if (
        screenX > 0 && screenX < canvas.width &&
        screenY > 0 && screenY < canvas.height
      ) {
        continue;
      }

      const player = state.gameState.players[state.playerId];

      if (!player) {
        continue;
      }

      const dx = indicator.x - player.x;
      const dy = indicator.y - player.y;
      const angle = Math.atan2(dy, dx);
      const playerScreenX = player.x - state.camera.x;
      const playerScreenY = player.y - state.camera.y;
      const indicatorRadius = 120 + Math.sin(Date.now() * 0.01) * 6;
      const x = playerScreenX + Math.cos(angle) * indicatorRadius;
      const y = playerScreenY + Math.sin(angle) * indicatorRadius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, -5);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHotbar() {
    const player = state.gameState.players[state.playerId];

    if (!player) {
      return;
    }

    const weapons = player.weaponSlots || [];
    const slots = 5;
    const size = 60;
    const spacing = 10;
    const total = slots * size + (slots - 1) * spacing;
    const start = canvas.width / 2 - total / 2;
    const y = canvas.height - size - 14;

    for (let i = 0; i < slots; i += 1) {
      const isActive = i + 1 === state.input.activeSlot;
      const slotScale = isActive
        ? 1 + (1 - effects.weaponAnimationProgress) * 0.2
        : 1;
      const slotSize = size * slotScale;
      const offset = (slotSize - size) / 2;
      const x = start + i * (size + spacing) - offset;
      const slotY = y - offset;
      const weapon = weapons[i] || null;

      ctx.save();
      ctx.fillStyle = isActive ? "rgba(248,248,248,0.96)" : "rgba(28,30,36,0.8)";
      ctx.strokeStyle = isActive ? "#ffd800" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = isActive ? 3 : 1;
      ctx.shadowColor = isActive ? "rgba(255,216,0,0.45)" : "rgba(0,0,0,0.18)";
      ctx.shadowBlur = isActive ? 16 : 6;
      ctx.shadowOffsetY = isActive ? 4 : 2;
      drawRoundedRect(x, slotY, slotSize, slotSize, 12);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.stroke();

      ctx.fillStyle = isActive ? "#111" : "rgba(255,255,255,0.6)";
      ctx.font = isActive ? "bold 17px monospace" : "bold 15px monospace";
      ctx.fillText(i + 1, x + 11, slotY + 19);

      if (!weapon) {
        ctx.fillStyle = isActive ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.16)";
        ctx.font = "10px monospace";
        ctx.fillText("EMPTY", x + 10, slotY + slotSize * 0.62);
        ctx.restore();
        continue;
      }

      ctx.fillStyle = isActive ? "#ffb800" : "#c49a00";
      drawRoundedRect(x + slotSize / 2 - 4, slotY + 12, 8, 26, 3);
      ctx.fill();

      const slotState = player.weaponState?.slots?.[i] || null;
      const cooldownEndsAt = slotState ? slotState.cooldownEndsAt : 0;
      const remainingCooldown = Math.max(cooldownEndsAt - Date.now(), 0);
      const ratio = weapon.cooldown > 0
        ? 1 - (remainingCooldown / weapon.cooldown)
        : 1;

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      drawRoundedRect(x + 8, slotY + slotSize - 12, slotSize - 16, 6, 3);
      ctx.fill();

      ctx.fillStyle = isActive ? "#00ff88" : "rgba(0,255,136,0.55)";
      drawRoundedRect(x + 8, slotY + slotSize - 12, (slotSize - 16) * ratio, 6, 3);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHud() {
    const player = state.gameState.players[state.playerId];

    if (!player) {
      return;
    }

    const panelX = 14;
    const panelY = 14;
    const panelWidth = 270;
    const contentX = panelX + 18;
    const topPadding = 28;
    const bottomPadding = 18;
    const titleGap = 28;
    const barGap = 32;
    const sectionGap = 40;
    const weaponGap = 34;
    const perfLineGap = 15;

    let measureY = panelY + topPadding;
    measureY += titleGap;
    measureY += barGap;
    measureY += sectionGap;
    measureY += weaponGap;
    measureY += sectionGap;
    measureY += perfLineGap;
    const panelHeight = measureY - panelY + bottomPadding;

    let cursorY = panelY + topPadding;

    drawPanel(panelX, panelY, panelWidth, panelHeight);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 5;

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PLAYER", contentX, cursorY);
    cursorY += titleGap;

    drawBar(
      contentX,
      cursorY,
      panelWidth - 36,
      14,
      player.hp / player.tank.hp,
      "#45e06f",
      "HP",
      `${player.hp} / ${player.tank.hp}`,
      {
        labelColor: "rgba(255,255,255,0.92)",
        valueColor: "rgba(255,255,255,0.92)",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderColor: "rgba(255,255,255,0.12)",
        shadowColor: "rgba(69,224,111,0.3)",
        shadowBlur: 10
      }
    );
    cursorY += barGap;

    drawBar(
      contentX,
      cursorY,
      panelWidth - 36,
      10,
      player.armorHp / player.tank.armorHp,
      "#4aa3ff",
      "ARMOR",
      `${player.armorHp} / ${player.tank.armorHp}`,
      {
        labelColor: "rgba(255,255,255,0.68)",
        valueColor: "rgba(255,255,255,0.68)",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderColor: "rgba(255,255,255,0.08)"
      }
    );
    cursorY += sectionGap;

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("WEAPON", contentX, cursorY);
    cursorY += 24;

    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#ffd800";
    ctx.fillText(effects.displayedWeaponName, contentX, cursorY);
    cursorY += weaponGap;

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PERFORMANCE", contentX, cursorY);
    cursorY += 22;

    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.54)";
    ctx.fillText(`FPS  ${effects.fps}`, contentX, cursorY);
    cursorY += perfLineGap;
    ctx.fillText(`MS   ${effects.frameMS.toFixed(1)}`, contentX, cursorY);

    ctx.restore();
  }

  function updateCamera() {
    const player = state.gameState.players[state.playerId];

    if (!player) {
      return;
    }

    state.camera.x = player.x - canvas.width / 2;
    state.camera.y = player.y - canvas.height / 2;

    if (state.map) {
      state.camera.x = Math.max(0, Math.min(state.camera.x, state.map.width - canvas.width));
      state.camera.y = Math.max(0, Math.min(state.camera.y, state.map.height - canvas.height));
    }
  }

  function updateShake() {
    if (Date.now() < effects.shakeTime) {
      effects.shakeX = Math.random() * 6 - 3;
      effects.shakeY = Math.random() * 6 - 3;
      return;
    }

    effects.shakeX = 0;
    effects.shakeY = 0;
  }

  function draw() {
    const now = Date.now();
    const alpha = Math.min((now - state.lastSnapshotTime) / 100, 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#242424";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateCamera();
    drawMap();
    updateShake();

    const localPlayer = state.gameState.players[state.playerId];
    if (localPlayer) {
      updateWeaponUiState(localPlayer);
    }

    for (const id in state.currentGameState.players) {
      const currentPlayer = state.currentGameState.players[id];
      const previousPlayer = state.previousGameState.players[id];
      const interpolatedPlayer = previousPlayer ? {
        ...currentPlayer,
        x: previousPlayer.x + (currentPlayer.x - previousPlayer.x) * alpha,
        y: previousPlayer.y + (currentPlayer.y - previousPlayer.y) * alpha
      } : currentPlayer;

      drawTank(
        ctx,
        interpolatedPlayer,
        id === state.playerId,
        state.camera.x,
        state.camera.y,
        TANK_SIZE,
        TANK_HALF,
        effects.shakeX,
        effects.shakeY
      );
    }

    ctx.fillStyle = "#ffd800";
    state.currentGameState.projectiles.forEach((projectile) => {
      drawProjectile(ctx, projectile, state.camera.x, state.camera.y);
    });

    drawParticles();
    drawDamageTexts();
    drawHitIndicators();
    drawHotbar();
    drawHud();
  }

  function loop() {
    const now = performance.now();

    effects.frameMS = now - effects.lastFrameTime;
    effects.lastFrameTime = now;
    effects.frameCount += 1;

    if (now - effects.lastFpsTime >= 1000) {
      effects.fps = effects.frameCount;
      effects.frameCount = 0;
      effects.lastFpsTime = now;
    }

    updateParticles();
    updateDamageTexts();
    draw();

    requestAnimationFrame(loop);
  }

  return {
    handleDamageEvent,
    start() {
      loop();
    }
  };
}
