export function drawTank(
  ctx,
  player,
  isLocalPlayer,
  cameraX,
  cameraY,
  tankSize,
  tankHalf,
  shakeX,
  shakeY
) {
  ctx.fillStyle = isLocalPlayer ? "#3cb371" : "#ff4444";

  ctx.fillRect(
    player.x - cameraX - tankHalf + shakeX,
    player.y - cameraY - tankHalf + shakeY,
    tankSize,
    tankSize
  );

  const barWidth = 40;
  const barHeight = 4;
  const armorPercent = player.armorHp / player.tank.armorHp;
  const hpPercent = player.hp / player.tank.hp;
  const barX = player.x - cameraX - barWidth / 2 + shakeX;
  const barY = player.y - cameraY + tankHalf + 6 + shakeY;

  ctx.fillStyle = "#000";
  ctx.fillRect(barX, barY, barWidth, 10);

  ctx.fillStyle = "#4aa3ff";
  ctx.fillRect(barX, barY, barWidth * armorPercent, barHeight);

  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(barX, barY + 6, barWidth * hpPercent, barHeight);

  ctx.save();
  ctx.translate(player.x - cameraX, player.y - cameraY);
  ctx.rotate(player.turretAngle);
  ctx.fillStyle = "#2fd9ff";
  ctx.fillRect(0, -5, 40, 10);
  ctx.restore();
}
