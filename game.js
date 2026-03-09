const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const socket = new WebSocket("ws://localhost:8080");

const TANK_SIZE = 40;
const TANK_HALF = 20;

let playerId=null;
let map=null;
let gameState={players:{},projectiles:[]};

const keys={};

let turretAngle=0;
let aimMode="mouse";
let activeSlot=1;

const rotateSpeed=0.06;

/* INPUT */

document.addEventListener("keydown",(e)=>{

keys[e.key.toLowerCase()] = true;

if(e.key>="1" && e.key<="5"){

activeSlot=parseInt(e.key);

socket.send(JSON.stringify({
type:"weapon_switch",
slot:activeSlot
}));

}

if(e.key==="ArrowLeft"||e.key==="ArrowRight")
aimMode="keyboard";

if(e.key===" ")
shoot();

});

document.addEventListener("keyup",(e)=>{
keys[e.key.toLowerCase()] = false;
});

/* MOUSE AIM */

canvas.addEventListener("mousemove",(e)=>{

const rect=canvas.getBoundingClientRect();

const mx=e.clientX-rect.left;
const my=e.clientY-rect.top;

const p=gameState.players[playerId];
if(!p) return;

turretAngle=Math.atan2(my-p.y,mx-p.x);

aimMode="mouse";

});

canvas.addEventListener("mousedown",shoot);

function shoot(){

if(activeSlot!==1) return;

socket.send(JSON.stringify({type:"shoot"}));

}

/* SERVER */

socket.onmessage=(event)=>{

const data=JSON.parse(event.data);

if(data.type==="init") playerId=data.id;
if(data.type==="map") map=data.data;
if(data.type==="state") gameState=data;

};

/* SEND INPUT */

function updateInput(){

if(!playerId) return;

if(aimMode==="keyboard"){

if(keys["arrowleft"]) turretAngle-=rotateSpeed;
if(keys["arrowright"]) turretAngle+=rotateSpeed;

}

socket.send(JSON.stringify({
type:"input",
keys:keys,
turretAngle:turretAngle,
aimMode:aimMode
}));

}

setInterval(updateInput,1000/60);

/* DRAW MAP */

function drawMap(){

if(!map) return;

ctx.fillStyle="#444";
map.walls.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));

ctx.fillStyle="#777";
map.stones.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));

ctx.fillStyle="#6b4a2d";
map.covers.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));

}

/* HOTBAR */

function drawHotbar(){

const slots=5;
const size=60;
const spacing=10;

const total=slots*size+(slots-1)*spacing;
const start=canvas.width/2-total/2;

const y = canvas.height - size - 10;

for(let i=1;i<=slots;i++){

const x=start+(i-1)*(size+spacing);

ctx.fillStyle=i===activeSlot?"#aaa":"#555";
ctx.fillRect(x,y,size,size);

ctx.strokeStyle="#222";
ctx.strokeRect(x,y,size,size);

ctx.fillStyle="#000";
ctx.font="20px monospace";
ctx.fillText(i,x+25,y+35);

if(i===1){
ctx.fillStyle="#ffd800";
ctx.fillRect(x+26,y+12,8,26);
}

}

}

/* DRAW */

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height);

ctx.fillStyle="#242424";
ctx.fillRect(0,0,canvas.width,canvas.height);

drawMap();

/* tanks */

for(const id in gameState.players){

const p=gameState.players[id];

ctx.fillStyle=id===playerId?"#3cb371":"#ff4444";

ctx.fillRect(p.x-TANK_HALF,p.y-TANK_HALF,TANK_SIZE,TANK_SIZE);

ctx.save();

ctx.translate(p.x,p.y);
ctx.rotate(p.turretAngle);

ctx.fillStyle="#2fd9ff";
ctx.fillRect(0,-5,40,10);

ctx.restore();

}

/* bullets */

ctx.fillStyle="#ffd800";

gameState.projectiles.forEach(b=>{
ctx.fillRect(b.x-3,b.y-3,6,6);
});

drawHotbar();

}

function loop(){

draw();
requestAnimationFrame(loop);

}

loop();