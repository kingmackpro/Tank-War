const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 8080;

/* ---------------- MAP DATA ---------------- */

const map = {
walls: [
{x:0,y:0,w:900,h:20},
{x:0,y:580,w:900,h:20},
{x:0,y:0,w:20,h:600},
{x:880,y:0,w:20,h:600}
],

stones: [
{x:200,y:200,w:80,h:80}
],

covers: [
{x:600,y:150,w:100,h:50},
{x:400,y:450,w:120,h:40}
]
};

/* ---------------- GAME STATE ---------------- */

const gameState = {
players:{},
projectiles:[]
};

/* ---------------- HTTP SERVER ---------------- */

const server = http.createServer((req,res)=>{

let filePath="./";

if(req.url==="/") filePath+="index.html";
else filePath+=req.url;

const ext=path.extname(filePath);

let type="text/plain";
if(ext==".html") type="text/html";
if(ext==".js") type="text/javascript";

fs.readFile(filePath,(err,data)=>{

if(err){
res.writeHead(404);
res.end("Not found");
return;
}

res.writeHead(200,{"Content-Type":type});
res.end(data);

});

});

server.listen(PORT,()=>console.log("Server running http://localhost:8080"));

/* ---------------- WEBSOCKET ---------------- */

const wss=new WebSocket.Server({server});

/* ---------------- UTILS ---------------- */

function rectCollision(a,b){

return a.x < b.x + b.w &&
a.x + a.w > b.x &&
a.y < b.y + b.h &&
a.y + a.h > b.y;

}

function createPlayer(id){

gameState.players[id]={
x:450,
y:300,
turretAngle:0,
aimMode:"mouse",
keys:{},
weaponSlot:1
};

}

/* ---------------- CONNECTION ---------------- */

wss.on("connection",(ws)=>{

const id=Math.random().toString(36).substring(2,9);

createPlayer(id);

console.log("Client connected:",id);

/* send player id */
ws.send(JSON.stringify({type:"init",id}));

/* send map */
ws.send(JSON.stringify({
type:"map",
data:map
}));

ws.on("message",(msg)=>{

const data=JSON.parse(msg);

const player=gameState.players[id];
if(!player) return;

/* PLAYER INPUT */

if(data.type==="input"){

player.keys=data.keys;
player.turretAngle=data.turretAngle;
player.aimMode=data.aimMode;

}

/* SHOOT */

if(data.type==="shoot"){

const speed=8;

gameState.projectiles.push({

x:player.x,
y:player.y,
vx:Math.cos(player.turretAngle)*speed,
vy:Math.sin(player.turretAngle)*speed,
size:6,
ownerId:id

});

}

/* WEAPON SWITCH */

if(data.type==="weapon_switch"){

player.weaponSlot=data.slot;

}

});

ws.on("close",()=>{

delete gameState.players[id];
console.log("Player disconnected:",id);

});

});

/* ---------------- GAME LOOP ---------------- */

const SPEED=3;

function updateGame(){

for(const id in gameState.players){

const p=gameState.players[id];

let dx=0;
let dy=0;

if(p.keys.w) dy-=SPEED;
if(p.keys.s) dy+=SPEED;
if(p.keys.a) dx-=SPEED;
if(p.keys.d) dx+=SPEED;

const next={
x:p.x+dx,
y:p.y+dy,
w:40,
h:40
};

let blocked=false;

[...map.walls,...map.stones,...map.covers].forEach(o=>{
if(rectCollision(next,o)) blocked=true;
});

if(!blocked){
p.x+=dx;
p.y+=dy;
}

}

/* PROJECTILES */

gameState.projectiles.forEach((b,i)=>{

b.x+=b.vx;
b.y+=b.vy;

const rect={x:b.x,y:b.y,w:b.size,h:b.size};

let hit=false;

[...map.walls,...map.stones].forEach(o=>{
if(rectCollision(rect,o)) hit=true;
});

if(hit){
gameState.projectiles.splice(i,1);
}

});

/* BROADCAST STATE */

const packet=JSON.stringify({
type:"state",
players:gameState.players,
projectiles:gameState.projectiles
});

wss.clients.forEach(c=>{
if(c.readyState===WebSocket.OPEN) c.send(packet);
});

}

setInterval(updateGame,1000/60);