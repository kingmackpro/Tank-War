const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const SERVER_URL = "wss://discs-apr-different-buzz.trycloudflare.com";

let socket;

/* SESSION */

let sessionId = localStorage.getItem("tankSession");

/* CONNECTION */

function connect(){

socket = new WebSocket(SERVER_URL);

socket.onopen = () => {

console.log("Connected");

socket.send(JSON.stringify({
type:"session",
sessionId:sessionId
}));

};

socket.onmessage = handleServerMessage;

socket.onclose = () => {

console.log("Disconnected, reconnecting...");

setTimeout(connect,2000);

};

socket.onerror = () => socket.close();

}

connect();

/* GAME STATE */

const TANK_SIZE = 40;
const TANK_HALF = 20;

let playerId = null;
let map = null;

let gameState = { players:{}, projectiles:[] };

const keys = {};

let turretAngle = 0;
let aimMode = "mouse";
let activeSlot = 1;

const rotateSpeed = 0.06;

let lastServerTime = 0;

/* VISUAL EFFECTS */

let particles = [];
let damageTexts = [];

let shakeTime = 0;
let shakeX = 0;
let shakeY = 0;

/* TAB VISIBILITY */

let tabActive = true;

document.addEventListener("visibilitychange",()=>{
tabActive = !document.hidden;
});

/* INPUT */

document.addEventListener("keydown",(e)=>{

keys[e.key.toLowerCase()] = true;

if(e.key>="1" && e.key<="5"){

const newSlot = parseInt(e.key);

if(newSlot !== activeSlot){

activeSlot = newSlot;

if(socket.readyState === WebSocket.OPEN){
socket.send(JSON.stringify({
type:"weapon_switch",
slot:newSlot
}));
}

}

}

if(e.key==="ArrowLeft"||e.key==="ArrowRight") aimMode="keyboard";

if(e.key===" ") shoot();

});

document.addEventListener("keyup",(e)=>{
keys[e.key.toLowerCase()] = false;
});

/* MOUSE AIM */

canvas.addEventListener("mousemove",(e)=>{

const rect = canvas.getBoundingClientRect();

const mx = e.clientX - rect.left;
const my = e.clientY - rect.top;

const p = gameState.players[playerId];
if(!p) return;

turretAngle = Math.atan2(my-p.y,mx-p.x);

aimMode = "mouse";

});

canvas.addEventListener("mousedown",shoot);

function shoot(){

if(socket.readyState !== WebSocket.OPEN) return;

socket.send(JSON.stringify({type:"shoot"}));

}

/* SERVER MESSAGE */

function handleServerMessage(event){

const data = JSON.parse(event.data);

/* SESSION */

if(data.type==="session"){

sessionId = data.sessionId;

localStorage.setItem("tankSession",sessionId);

}

/* INIT */

if(data.type==="init") playerId = data.id;

/* MAP */

if(data.type==="map") map = data.data;

/* STATE WITH TIMESTAMP */

if(data.type==="state"){

if(data.time < lastServerTime) return;

lastServerTime = data.time;

gameState = data;

}

/* DAMAGE */

if(data.type==="damage"){

if(!tabActive) return;

const p = gameState.players[data.targetId];
if(!p) return;

if(data.targetId === playerId){
shakeTime = Date.now()+150;
}

if(data.armorDamage>0){
spawnParticles(p.x,p.y,"#4aa3ff");
spawnDamageText(p.x,p.y-20,data.armorDamage,"#4aa3ff");
}

if(data.hpDamage>0){
spawnParticles(p.x,p.y,"#ff3b3b");
spawnDamageText(p.x,p.y-35,data.hpDamage,"#ff3b3b");
}

}

}

/* INPUT LOOP */

function updateInput(){

if(!playerId) return;

if(aimMode==="keyboard"){

if(keys["arrowleft"]) turretAngle -= rotateSpeed;
if(keys["arrowright"]) turretAngle += rotateSpeed;

}

if(socket.readyState === WebSocket.OPEN){

socket.send(JSON.stringify({
type:"input",
keys:keys,
turretAngle:turretAngle,
aimMode:aimMode
}));

}

}

/* 30Hz input (stable networking) */

setInterval(updateInput,1000/30);

/* PARTICLES */

function spawnParticles(x,y,color){

for(let i=0;i<8;i++){
particles.push({
x:x,
y:y,
vx:(Math.random()-0.5)*4,
vy:(Math.random()-0.5)*4,
life:30,
color:color
});
}

}

function updateParticles(){

for(let i=particles.length-1;i>=0;i--){

const p = particles[i];

p.x += p.vx;
p.y += p.vy;
p.life--;

if(p.life<=0){
particles.splice(i,1);
}

}

}

function drawParticles(){

particles.forEach(p=>{
ctx.fillStyle = p.color;
ctx.fillRect(p.x,p.y,3,3);
});

}

/* DAMAGE NUMBERS */

function spawnDamageText(x,y,value,color){

damageTexts.push({
x:x,
y:y,
vy:-0.5,
life:60,
text:value,
color:color
});

}

function updateDamageTexts(){

for(let i=damageTexts.length-1;i>=0;i--){

const d = damageTexts[i];

d.y += d.vy;
d.life--;

if(d.life<=0){
damageTexts.splice(i,1);
}

}

}

function drawDamageTexts(){

ctx.font="14px monospace";

damageTexts.forEach(d=>{
ctx.fillStyle=d.color;
ctx.fillText(d.text,d.x,d.y);
});

}

/* MAP */

function drawMap(){

if(!map) return;

ctx.fillStyle="#444";
map.walls.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));

ctx.fillStyle="#777";
map.stones.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));

ctx.fillStyle="#6b4a2d";
map.covers.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));

}

/* HUD */

function drawHUD(){

const p = gameState.players[playerId];
if(!p) return;

const weapon = p.tank.weapons[p.weaponSlot] || null;

ctx.fillStyle="white";
ctx.font="16px monospace";

ctx.fillText("HP: "+p.hp,10,20);
ctx.fillText("Armor: "+p.armorHp,10,40);
ctx.fillText("Energy: "+p.tank.energy,10,60);
ctx.fillText("Speed: "+p.tank.speed,10,80);

ctx.fillText(
"Weapon: "+(weapon ? weapon.name : "Empty"),
10,100
);

}

/* HOTBAR */

function drawHotbar(){

const p = gameState.players[playerId];
if(!p) return;

const weapons = p.tank.weapons;

const slots = 5;
const size = 60;
const spacing = 10;

const total = slots*size+(slots-1)*spacing;
const start = canvas.width/2-total/2;

const y = canvas.height-size-10;

for(let i=0;i<slots;i++){

const x = start + i*(size+spacing);
const weapon = weapons[i] || null;

ctx.fillStyle = (i+1===activeSlot) ? "#aaa" : "#555";
ctx.fillRect(x,y,size,size);

ctx.strokeStyle="#222";
ctx.strokeRect(x,y,size,size);

ctx.fillStyle="#000";
ctx.font="18px monospace";
ctx.fillText(i+1,x+24,y+34);

if(weapon){

ctx.fillStyle="#ffd800";
ctx.fillRect(x + size/2 - 4, y + 12, 8, 26);

const lastShot = p.lastShotTime || 0;
const cooldown = weapon.cooldown;

const elapsed = Date.now() - lastShot;

let ratio = Math.min(elapsed/cooldown,1);

ctx.fillStyle="#00ff88";

ctx.fillRect(
x,
y+size-6,
size*ratio,
4
);

}

}

}

/* DRAW */

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height);

ctx.fillStyle="#242424";
ctx.fillRect(0,0,canvas.width,canvas.height);

drawMap();

/* SHAKE */

if(Date.now()<shakeTime){
shakeX=(Math.random()*6)-3;
shakeY=(Math.random()*6)-3;
}else{
shakeX=0;
shakeY=0;
}

/* TANKS */

for(const id in gameState.players){

const p = gameState.players[id];

ctx.fillStyle = id===playerId ? "#3cb371" : "#ff4444";

ctx.fillRect(
p.x-TANK_HALF+shakeX,
p.y-TANK_HALF+shakeY,
TANK_SIZE,
TANK_SIZE
);

/* HP + ARMOR BAR */

const barWidth = 40;
const barHeight = 4;

const armorPercent = p.armorHp / p.tank.armorHp;
const hpPercent = p.hp / p.tank.hp;

const barX = p.x - barWidth/2 + shakeX;
const barY = p.y + TANK_HALF + 6 + shakeY;

ctx.fillStyle="#000";
ctx.fillRect(barX,barY,barWidth,10);

ctx.fillStyle="#4aa3ff";
ctx.fillRect(barX,barY,barWidth*armorPercent,barHeight);

ctx.fillStyle="#ff3b3b";
ctx.fillRect(barX,barY+6,barWidth*hpPercent,barHeight);

/* turret */

ctx.save();

ctx.translate(p.x,p.y);
ctx.rotate(p.turretAngle);

ctx.fillStyle="#2fd9ff";
ctx.fillRect(0,-5,40,10);

ctx.restore();

}

/* BULLETS */

ctx.fillStyle="#ffd800";

gameState.projectiles.forEach(b=>{
ctx.fillRect(
b.x-b.size/2,
b.y-b.size/2,
b.size,
b.size
);
});

drawParticles();
drawDamageTexts();
drawHotbar();
drawHUD();

}

/* LOOP */

function loop(){

updateParticles();
updateDamageTexts();

draw();

requestAnimationFrame(loop);

}

loop();