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
    frameMS: 0
  };

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

    const weapons = player.tank.weapons;
    const slots = 5;
    const size = 60;
    const spacing = 10;
    const total = slots * size + (slots - 1) * spacing;
    const start = canvas.width / 2 - total / 2;
    const y = canvas.height - size - 10;

    for (let i = 0; i < slots; i += 1) {
      const x = start + i * (size + spacing);
      const weapon = weapons[i] || null;

      ctx.fillStyle = i + 1 === state.input.activeSlot ? "#aaa" : "#555";
      ctx.fillRect(x, y, size, size);

      ctx.strokeStyle = "#222";
      ctx.strokeRect(x, y, size, size);

      ctx.fillStyle = "#000";
      ctx.font = "18px monospace";
      ctx.fillText(i + 1, x + 24, y + 34);

      if (!weapon) {
        continue;
      }

      ctx.fillStyle = "#ffd800";
      ctx.fillRect(x + size / 2 - 4, y + 12, 8, 26);

      const lastShot = player.lastShotTime ? player.lastShotTime[i] : 0;
      const elapsed = Date.now() - lastShot;
      const ratio = Math.min(elapsed / weapon.cooldown, 1);

      ctx.fillStyle = "#111";
      ctx.fillRect(x, y + size - 6, size, 4);

      ctx.fillStyle = "#00ff88";
      ctx.fillRect(x, y + size - 6, size * ratio, 4);
    }
  }

  function drawHud() {
    const player = state.gameState.players[state.playerId];

    if (!player) {
      return;
    }

    const weapon = player.tank.weapons[state.input.activeSlot - 1] || null;

    ctx.fillStyle = "white";
    ctx.font = "16px monospace";
    ctx.fillText(`HP: ${player.hp}`, 10, 20);
    ctx.fillText(`Armor: ${player.armorHp}`, 10, 40);
    ctx.fillText(`Energy: ${player.tank.energy}`, 10, 60);
    ctx.fillText(`Speed: ${player.tank.speed}`, 10, 80);
    ctx.fillText(`Weapon: ${weapon ? weapon.name : "Empty"}`, 10, 100);
    ctx.fillText(`FPS: ${effects.fps}`, 10, 140);
    ctx.fillText(`MS: ${effects.frameMS.toFixed(1)}`, 10, 160);
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#242424";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateCamera();
    drawMap();
    updateShake();

    for (const id in state.gameState.players) {
      drawTank(
        ctx,
        state.gameState.players[id],
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
    state.gameState.projectiles.forEach((projectile) => {
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
