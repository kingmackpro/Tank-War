export function drawProjectile(ctx, projectile, cameraX, cameraY) {
  ctx.fillRect(
    projectile.x - cameraX - projectile.size / 2,
    projectile.y - cameraY - projectile.size / 2,
    projectile.size,
    projectile.size
  );
}
