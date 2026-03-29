function rectFromCenter(cx, cy, w, h) {
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h
  };
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function getMapObjects(map) {
  return [
    ...(map.walls || []),
    ...(map.stones || []),
    ...(map.covers || [])
  ];
}

function mapCollision(map, box) {
  const objects = getMapObjects(map);

  for (const object of objects) {
    if (intersects(box, object)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  getMapObjects,
  intersects,
  mapCollision,
  rectFromCenter
};
