const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

/* CONSTANTS */

const PORT = 8080;

const TANK_SIZE = 40;
const TANK_HALF = TANK_SIZE / 2;
const BULLET_SIZE = 6;
const BULLET_HALF = BULLET_SIZE / 2;
const BARREL_LENGTH = 30;

const PLAYER_SPEED = 3;
const BULLET_SPEED = 8;

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

/* PHYSICS HELPERS */

function rect(x,y,w,h){
return {x,y,w,h};
}

function rectFromCenter(cx,cy,w,h){
return {
x:cx-w/2,
y:cy-h/2,
w,
h
};
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

const objects = [...map.walls,...map.stones,...map.covers];

for(const o of objects){
if(intersects(box,o)) return true;
}

return false;

}

/* HTTP SERVER */

const server = http.createServer((req,res)=>{

let file = "./";

if(req.url === "/") file += "index.html";
else file += req.url;

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

const wss = new WebSocket.Server({server});

wss.on("connection",(ws)=>{

const id = Math.random().toString(36).substring(2,9);

gameState.players[id] = {
x:450,
y:300,
turretAngle:0,
keys:{},
weaponSlot:1
};

ws.send(JSON.stringify({type:"init",id}));
ws.send(JSON.stringify({type:"map",data:map}));

ws.on("message",(msg)=>{

const data = JSON.parse(msg);
const player = gameState.players[id];
if(!player) return;

if(data.type === "input"){

player.keys = data.keys;
player.turretAngle = data.turretAngle;

}

if(data.type === "weapon_switch"){
player.weaponSlot = data.slot;
}

if(data.type === "shoot"){

if(player.weaponSlot !== 1) return;

const spawnX =
player.x + Math.cos(player.turretAngle) * BARREL_LENGTH;

const spawnY =
player.y + Math.sin(player.turretAngle) * BARREL_LENGTH;

gameState.projectiles.push({

x:spawnX,
y:spawnY,
vx:Math.cos(player.turretAngle) * BULLET_SPEED,
vy:Math.sin(player.turretAngle) * BULLET_SPEED,
size:BULLET_SIZE,
owner:id

});

}

});

ws.on("close",()=>{
delete gameState.players[id];
});

});

/* GAME LOOP */

function updateGame(){

/* PLAYERS */

for(const id in gameState.players){

const p = gameState.players[id];

let dx=0;
let dy=0;

if(p.keys.w) dy-=PLAYER_SPEED;
if(p.keys.s) dy+=PLAYER_SPEED;
if(p.keys.a) dx-=PLAYER_SPEED;
if(p.keys.d) dx+=PLAYER_SPEED;

const nextBox = rectFromCenter(
p.x + dx,
p.y + dy,
TANK_SIZE,
TANK_SIZE
);

if(!mapCollision(nextBox)){
p.x += dx;
p.y += dy;
}

}

/* PROJECTILES */

gameState.projectiles.forEach((b,i)=>{

b.x += b.vx;
b.y += b.vy;

const box = rectFromCenter(
b.x,
b.y,
BULLET_SIZE,
BULLET_SIZE
);

if(mapCollision(box)){
gameState.projectiles.splice(i,1);
}

});

/* BROADCAST */

const packet = JSON.stringify({
type:"state",
players:gameState.players,
projectiles:gameState.projectiles
});

wss.clients.forEach(c=>{
if(c.readyState === WebSocket.OPEN)
c.send(packet);
});

}

setInterval(updateGame,1000/60);