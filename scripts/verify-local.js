const WebSocket = require("ws");

const port = Number.parseInt(process.env.PORT, 10) || 8080;
const url = `ws://127.0.0.1:${port}`;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = { socket, id: null, state: null, damageEvents: [] };
    const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${url}`)), 5000);

    socket.on("open", () => socket.send(JSON.stringify({ type: "session", sessionId: null })));
    socket.on("message", (rawMessage) => {
      const message = JSON.parse(rawMessage);

      if (message.type === "init") client.id = message.id;
      if (message.type === "state") client.state = message;
      if (message.type === "damage") client.damageEvents.push(message);

      if (client.id && client.state) {
        clearTimeout(timeout);
        resolve(client);
      }
    });
    socket.on("error", reject);
  });
}

async function verify() {
  const clients = await Promise.all([connect(), connect(), connect(), connect()]);

  try {
    await wait(100);
    const firstClient = clients[0];
    const secondClient = clients[1];
    const beforeMovement = secondClient.state.players[secondClient.id];
    secondClient.socket.send(JSON.stringify({ type: "input", keys: { d: true }, turretAngle: 0 }));
    await wait(120);
    const afterMovement = secondClient.state.players[secondClient.id];

    if (!(afterMovement.x > beforeMovement.x)) {
      throw new Error(`Movement did not synchronize: ${beforeMovement.x} -> ${afterMovement.x}`);
    }

    secondClient.socket.send(JSON.stringify({ type: "input", keys: {}, turretAngle: 0 }));
    const players = clients.map((client) => firstClient.state.players[client.id]);
    const horizontalPair = players.find((candidate) => candidate.id !== firstClient.id && Math.abs(candidate.y - firstClient.state.players[firstClient.id].y) < 1) ||
      players.find((candidate, index) => players.slice(index + 1).some((other) => Math.abs(candidate.y - other.y) < 1));

    if (!horizontalPair) {
      throw new Error("Could not find a clear horizontal spawn pair");
    }

    const shooterClient = clients.find((client) => client.id === horizontalPair.id);
    const targetPlayer = players.find((candidate) => candidate.id !== shooterClient.id && Math.abs(candidate.y - horizontalPair.y) < 1);
    const targetClient = clients.find((client) => client.id === targetPlayer.id);
    let target = targetClient.state.players[targetClient.id];
    let shooter = shooterClient.state.players[shooterClient.id];
    const angle = Math.atan2(target.y - shooter.y, target.x - shooter.x);
    shooterClient.socket.send(JSON.stringify({ type: "weapon_switch", slot: 2 }));
    shooterClient.socket.send(JSON.stringify({ type: "input", keys: {}, turretAngle: angle }));
    await wait(120);
    target = targetClient.state.players[targetClient.id];
    shooter = shooterClient.state.players[shooterClient.id];

    if (Math.abs(shooter.turretAngle - angle) > 0.01 || shooter.weaponSlot !== 1) {
      throw new Error("Server did not acknowledge authoritative aim or weapon selection");
    }

    shooterClient.socket.send(JSON.stringify({ type: "shoot" }));
    await wait(120);

    if (shooterClient.state.projectiles.length === 0) {
      throw new Error("Server did not create a projectile from shoot input");
    }

    const initialProjectile = shooterClient.state.projectiles[0];
    await wait(3800);

    if (!shooterClient.damageEvents.some((event) => event.targetId === targetClient.id)) {
      throw new Error(`Projectile damage event was not observed; initialProjectile=${JSON.stringify(initialProjectile)}, remaining=${JSON.stringify(shooterClient.state.projectiles)}, shooter=${JSON.stringify(shooter)}, target=${JSON.stringify(target)}`);
    }

    const disconnectedId = targetClient.id;
    targetClient.socket.close();
    await wait(80);

    if (shooterClient.state.players[disconnectedId]) {
      throw new Error("Disconnected player remained in synchronized state");
    }

    console.log("Local multiplayer verification passed: connect, movement, shooting, damage, and disconnect.");
  } finally {
    clients.forEach((client) => client.socket.close());
  }
}

verify().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
