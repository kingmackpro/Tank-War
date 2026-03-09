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

/* MAP */

const map = {
walls:[
{x:0,y:0,w:900,h:20},
{x:0,y:580,w:900,h:20},
{x:0,y:0,w:20,h:600},
{x:880,y:0,w:20,h:600}
],

stones:[
{x:250,y:200,w:80,h:80}
],

covers:[
{x:600,y:150,w:100,h:50},
{x:400,y:450,w:120,h:40}
]
};

/* GAME STATE */

const gameState = {
players:{},
projectiles:[]
};

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

const objects=[...map.walls,...map.stones,...map.covers];

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

/* CREATE PLAYER */

function createPlayer(id){

const tank = JSON.parse(JSON.stringify(tanks.defaultTank));

gameState.players[id]={

x:450,
y:300,
turretAngle:0,
keys:{},

tank:tank,

hp:tank.hp,
armorHp:tank.armorHp,

weaponSlot:0,
lastShotTime:0

};

}

wss.on("connection",(ws)=>{

const id=Math.random().toString(36).substring(2,9);

createPlayer(id);

ws.send(JSON.stringify({type:"init",id}));
ws.send(JSON.stringify({type:"map",data:map}));

ws.on("message",(msg)=>{

const data=JSON.parse(msg);
const player=gameState.players[id];
if(!player) return;

/* INPUT */

if(data.type==="input"){

player.keys=data.keys;
player.turretAngle=data.turretAngle;

}

/* WEAPON SWITCH */

if(data.type==="weapon_switch"){
player.weaponSlot=data.slot;
}

/* SHOOT */

if(data.type==="shoot"){

const weapon = player.tank.weapons[player.weaponSlot];
if(!weapon) return;

const now = Date.now();

/* COOLDOWN */

if(now - player.lastShotTime < weapon.cooldown) return;

player.lastShotTime = now;

gameState.projectiles.push({

x:player.x+Math.cos(player.turretAngle)*BARREL_LENGTH,
y:player.y+Math.sin(player.turretAngle)*BARREL_LENGTH,

vx:Math.cos(player.turretAngle)*weapon.projectileSpeed,
vy:Math.sin(player.turretAngle)*weapon.projectileSpeed,

size:weapon.projectileSize,
damage:weapon.damage,

ownerId:id

});

}

});

ws.on("close",()=>{
delete gameState.players[id];
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

gameState.projectiles.forEach((b,i)=>{

b.x+=b.vx;
b.y+=b.vy;

const box=rectFromCenter(b.x,b.y,b.size,b.size);

/* MAP HIT */

if(mapCollision(box)){
gameState.projectiles.splice(i,1);
return;
}

/* PLAYER HIT */

for(const id in gameState.players){

const p=gameState.players[id];

if(id===b.ownerId) continue;

const tankBox=rectFromCenter(p.x,p.y,TANK_SIZE,TANK_SIZE);

if(intersects(box,tankBox)){

let dmg=b.damage;

/* ARMOR */

if(p.armorHp>0){

p.armorHp-=dmg;

if(p.armorHp<0){

dmg=-p.armorHp;
p.armorHp=0;
p.hp-=dmg;

}

}else{

p.hp-=dmg;

}

/* REMOVE BULLET */

gameState.projectiles.splice(i,1);

/* RESPAWN */

if(p.hp<=0){

p.x=450;
p.y=300;

p.hp=p.tank.hp;
p.armorHp=p.tank.armorHp;

}

break;

}

}

});

/* BROADCAST */

const packet=JSON.stringify({
type:"state",
players:gameState.players,
projectiles:gameState.projectiles
});

wss.clients.forEach(c=>{
if(c.readyState===WebSocket.OPEN)
c.send(packet);
});

}

setInterval(updateGame,1000/60);