const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

/* LOAD TANK CONFIG */

const tanks = JSON.parse(
fs.readFileSync("./tanks.json","utf8")
);

/* CONSTANTS */

const PORT = 8080;
const TANK_SIZE = 40;
const BARREL_LENGTH = 30;

/* LOAD MAP */

const map = JSON.parse(
fs.readFileSync("./map.json","utf8")
);

/* AUTO MAP BORDERS */

map.walls.push(
 {x:0, y:0, w:map.width, h:20},                     // top
 {x:0, y:map.height-20, w:map.width, h:20},         // bottom
 {x:0, y:0, w:20, h:map.height},                    // left
 {x:map.width-20, y:0, w:20, h:map.height}          // right
);

/* GAME STATE */

const gameState = {
players:{},
projectiles:[]
};

/* SESSION SYSTEM */

const sessions = {};

/* PHYSICS */

function rectFromCenter(cx,cy,w,h){
return {x:cx-w/2,y:cy-h/2,w,h};
}

function intersects(a,b){
return (
a.x < b.x + b.w &&
a.x + a.w > b.x &&
a.y < b.y + b.h &&
a.y + a.h > b.y
);
}

function mapCollision(box){

const objects = [
 ...(map.walls || []),
 ...(map.stones || []),
 ...(map.covers || [])
];

for(const o of objects){
if(intersects(box,o)) return true;
}

return false;

}

/* HTTP SERVER */

const server=http.createServer((req,res)=>{

let file="./";

if(req.url==="/") file+="../index.html";
else file+="../"+req.url;

fs.readFile(file,(err,data)=>{

if(err){
res.writeHead(404);
res.end("Not found");
return;
}

let type="text/plain";

if(file.endsWith(".html")) type="text/html";
if(file.endsWith(".js")) type="text/javascript";

res.writeHead(200,{"Content-Type":type});
res.end(data);

});

});

server.listen(PORT,()=>console.log("Server running on 8080"));

/* WEBSOCKET */

const wss=new WebSocket.Server({server});


function getSpawnPoint(){

/* if spawn points exist */

if(map.spawnPoints && map.spawnPoints.length > 0){

const i = Math.floor(Math.random() * map.spawnPoints.length);
return map.spawnPoints[i];

}

/* otherwise random safe spawn */

while(true){

const x = 40 + Math.random() * (map.width - 80);
const y = 40 + Math.random() * (map.height - 80);

const box = rectFromCenter(x,y,TANK_SIZE,TANK_SIZE);

if(!mapCollision(box)){
return {x,y};
}

}

}

/* CREATE PLAYER */

function createPlayer(){

const tank = JSON.parse(JSON.stringify(tanks.defaultTank));

/* get spawn location */

const spawn = getSpawnPoint();

return {

x:spawn.x,
y:spawn.y,
turretAngle:0,
keys:{},

tank:tank,

hp:tank.hp,
armorHp:tank.armorHp,

weaponSlot:0,

/* cooldown per slot */

lastShotTime:[0,0,0,0,0]

};

}

/* CONNECTION */

wss.on("connection",(ws)=>{

let player=null;
let playerId=null;

ws.on("message",(msg)=>{

const data=JSON.parse(msg);

/* SESSION HANDSHAKE */

if(data.type==="session"){

let sessionId=data.sessionId;

if(sessionId && sessions[sessionId]){

playerId=sessionId;
player=sessions[sessionId];

}else{

playerId=Math.random().toString(36).substring(2,9);
player=createPlayer();
sessions[playerId]=player;

}

gameState.players[playerId]=player;

ws.send(JSON.stringify({type:"session",sessionId:playerId}));
ws.send(JSON.stringify({type:"init",id:playerId}));
ws.send(JSON.stringify({type:"map",data:map})); 

return;
}

if(!player) return;

/* INPUT */

if(data.type==="input"){
player.keys=data.keys;
player.turretAngle=data.turretAngle;
}

/* WEAPON SWITCH */

if(data.type==="weapon_switch"){

const slot=Number(data.slot);
const index=slot-1;

/* allow empty slot but clamp safely */

if(Number.isInteger(index) && index>=0 && index<5){
player.weaponSlot=index;
}

}

/* SHOOT */

if(data.type==="shoot"){

const slot = player.weaponSlot;

/* get weapon safely */

const weapon = player.tank.weapons[slot] || null;

/* empty slot cannot fire */

if(!weapon) return;

const now=Date.now();

/* cooldown per slot */

const lastShot=player.lastShotTime[slot] || 0;

if(now-lastShot < weapon.cooldown) return;

/* update cooldown */

player.lastShotTime[slot]=now;

/* spawn projectile */

gameState.projectiles.push({

x:player.x+Math.cos(player.turretAngle)*BARREL_LENGTH,
y:player.y+Math.sin(player.turretAngle)*BARREL_LENGTH,

vx:Math.cos(player.turretAngle)*weapon.projectileSpeed,
vy:Math.sin(player.turretAngle)*weapon.projectileSpeed,

size:weapon.projectileSize,
damage:weapon.damage,

ownerId:playerId

});

}

});

/* DISCONNECT */

ws.on("close",()=>{
delete gameState.players[playerId];
});

});

/* GAME LOOP */

function updateGame(){

/* PLAYER MOVEMENT */

for(const id in gameState.players){

const p=gameState.players[id];
const SPEED=p.tank.speed;

let dx=0;
let dy=0;

if(p.keys.w) dy-=SPEED;
if(p.keys.s) dy+=SPEED;
if(p.keys.a) dx-=SPEED;
if(p.keys.d) dx+=SPEED;

const nextBox=rectFromCenter(
p.x+dx,
p.y+dy,
TANK_SIZE,
TANK_SIZE
);

if(!mapCollision(nextBox)){
p.x+=dx;
p.y+=dy;
}

}

/* PROJECTILES */

for(let i=gameState.projectiles.length-1;i>=0;i--){

const b=gameState.projectiles[i];

b.x+=b.vx;
b.y+=b.vy;

const box=rectFromCenter(b.x,b.y,b.size,b.size);

/* MAP HIT */

if(mapCollision(box)){
gameState.projectiles.splice(i,1);
continue;
}

/* PLAYER HIT */

for(const id in gameState.players){

const p=gameState.players[id];

if(id===b.ownerId) continue;

const tankBox=rectFromCenter(p.x,p.y,TANK_SIZE,TANK_SIZE);

if(intersects(box,tankBox)){

const incomingDamage=b.damage;
const effectiveDamage=Math.max(0,incomingDamage-p.tank.armor);

const armorBefore=p.armorHp;

let armorDamage=0;
let hpDamage=0;

if(armorBefore>0 && effectiveDamage===0){

armorDamage=Math.min(incomingDamage,armorBefore);

}
else if(armorBefore>0){

armorDamage=Math.min(incomingDamage,armorBefore);

hpDamage=effectiveDamage;
p.hp-=effectiveDamage;

}
else{

hpDamage=incomingDamage;
p.hp-=incomingDamage;

}

p.armorHp-=incomingDamage;

if(p.armorHp<0) p.armorHp=0;
if(p.hp<0) p.hp=0;

/* DAMAGE EVENT */

wss.clients.forEach(c=>{
if(c.readyState===WebSocket.OPEN){
c.send(JSON.stringify({
type:"damage",
targetId:id,
armorDamage:armorDamage,
hpDamage:hpDamage
}));
}
});

/* REMOVE BULLET */

gameState.projectiles.splice(i,1);

/* RESPAWN */

if(p.hp<=0){

const spawn = getSpawnPoint();

p.x = spawn.x;
p.y = spawn.y;

p.hp = p.tank.hp;
p.armorHp = p.tank.armorHp;

}

break;

}

}

}

/* BROADCAST STATE */

const packet=JSON.stringify({
type:"state",
time:Date.now(),
players:gameState.players,
projectiles:gameState.projectiles
});

wss.clients.forEach(c=>{
if(c.readyState===WebSocket.OPEN)
c.send(packet);
});

}

setInterval(updateGame,1000/60);