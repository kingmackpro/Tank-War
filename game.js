const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const socket = new WebSocket("ws://localhost:8080");

let playerId = null;
let gameState = {players:{},bullets:[]};

const keys = {};
let turretAngle = 0;


/* ---------------- INPUT ---------------- */

document.addEventListener("keydown",(e)=>{
keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup",(e)=>{
keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove",(e)=>{

const rect = canvas.getBoundingClientRect();

const mx = e.clientX - rect.left;
const my = e.clientY - rect.top;

const player = gameState.players[playerId];

if(!player) return;

turretAngle = Math.atan2(my-player.y,mx-player.x);

});


/* ---------------- SERVER CONNECTION ---------------- */

socket.addEventListener("open",()=>{
console.log("Connected to server");
});

socket.addEventListener("message",(event)=>{

const data = JSON.parse(event.data);

if(data.type==="init"){
playerId = data.id;
}

if(data.type==="state"){
gameState = data;
}

});


/* ---------------- SEND INPUT ---------------- */

function sendInput(){

if(!playerId) return;

socket.send(JSON.stringify({
type:"input",
keys:keys,
turretAngle:turretAngle
}));

}

setInterval(sendInput,1000/60);


/* ---------------- RENDER ---------------- */

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height);

for(const id in gameState.players){

const p = gameState.players[id];

ctx.fillStyle = id===playerId ? "#3cb371" : "#ff4444";

ctx.fillRect(
p.x-20,
p.y-20,
40,
40
);

ctx.save();

ctx.translate(p.x,p.y);
ctx.rotate(p.turretAngle);

ctx.fillStyle="#2fd9ff";
ctx.fillRect(0,-5,40,10);

ctx.restore();

}

}


function gameLoop(){

draw();
requestAnimationFrame(gameLoop);

}

gameLoop();