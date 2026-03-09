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
players: {},
bullets: []
};


/* ---------------- HTTP SERVER ---------------- */

const server = http.createServer((req,res)=>{

let filePath = "./";

if(req.url === "/") filePath += "index.html";
else filePath += req.url;

const ext = path.extname(filePath);

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

server.listen(PORT,()=>{
console.log("Server running http://localhost:8080");
});


/* ---------------- WEBSOCKET ---------------- */

const wss = new WebSocket.Server({server});

function createPlayer(id){

gameState.players[id] = {
x:450,
y:300,
turretAngle:0,
keys:{}
};

}

function rectCollision(a,b){

return a.x < b.x + b.w &&
a.x + a.w > b.x &&
a.y < b.y + b.h &&
a.y + a.h > b.y;

}

wss.on("connection",(ws)=>{

const id = Math.random().toString(36).substring(2,9);

createPlayer(id);

console.log("Client connected:",id);

ws.send(JSON.stringify({
type:"init",
id:id,
map:map
}));

ws.on("message",(msg)=>{

const data = JSON.parse(msg);

if(data.type === "input"){

const player = gameState.players[id];

if(!player) return;

player.keys = data.keys;
player.turretAngle = data.turretAngle;

}

});

ws.on("close",()=>{

delete gameState.players[id];
console.log("Player disconnected:",id);

});

});


/* ---------------- GAME LOOP ---------------- */

const SPEED = 3;

function updateGame(){

for(const id in gameState.players){

const p = gameState.players[id];

let dx=0;
let dy=0;

if(p.keys.w) dy-=SPEED;
if(p.keys.s) dy+=SPEED;
if(p.keys.a) dx-=SPEED;
if(p.keys.d) dx+=SPEED;

p.x += dx;
p.y += dy;

}

/* broadcast state */

const packet = JSON.stringify({
type:"state",
players:gameState.players,
bullets:gameState.bullets
});

wss.clients.forEach(client=>{
if(client.readyState === WebSocket.OPEN){
client.send(packet);
}
});

}

setInterval(updateGame,1000/60);