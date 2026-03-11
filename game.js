const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* SERVER URL */
const SERVER_URL = "wss://grip-spreading-ordinance-blonde.trycloudflare.com";

let socket;
let sessionId = localStorage.getItem("tankSession");

/* CAMERA */

let cameraX = 0;
let cameraY = 0;

/* FPS and PING */

let fps = 0;
let frameCount = 0;
let lastFpsTime = performance.now();

let lastFrameTime = performance.now();
let frameMS = 0;


/* CONNECT */


function connect(){

socket = new WebSocket(SERVER_URL);

socket.onopen = () => {

socket.send(JSON.stringify({
type:"session",
sessionId:sessionId
}));

};

socket.onmessage = handleServerMessage;

socket.onclose = () => {

console.log("Disconnected. Reconnecting...");
setTimeout(connect,2000);

};

socket.onerror = () => socket.close();

}

connect();

/* CONSTANTS */

const TANK_SIZE = 40;
const TANK_HALF = 20;

let playerId = null;
let map = null;

let gameState = {players:{},projectiles:[]};

let lastServerTime = 0;

const keys = {};

let turretAngle = 0;
let aimMode = "mouse";
let activeSlot = 1;

const rotateSpeed = 0.06;

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

/* HOTBAR SWITCH */

if(e.key>="1" && e.key<="5"){

const slot = parseInt(e.key);

if(slot !== activeSlot){

activeSlot = slot;

if(socket.readyState===WebSocket.OPEN){
socket.send(JSON.stringify({
type:"weapon_switch",
slot:slot
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

/* FIRE HOLD STATE */

let mouseHeld = false;
let spaceHeld = false;

/* MOUSE AIM */

canvas.addEventListener("mousemove",(e)=>{

const rect = canvas.getBoundingClientRect();

const mx = e.clientX - rect.left + cameraX;
const my = e.clientY - rect.top + cameraY;

const p = gameState.players[playerId];
if(!p) return;

/* turret always rotates */

turretAngle = Math.atan2(my-p.y,mx-p.x);

aimMode="mouse";

});

/* MOUSE HOLD */

canvas.addEventListener("mousedown",(e)=>{

if(e.button === 0){
mouseHeld = true;
shoot();
}

});

canvas.addEventListener("mouseup",(e)=>{

if(e.button === 0){
mouseHeld = false;
}

});

/* RESET IF CURSOR LEAVES CANVAS */

canvas.addEventListener("mouseleave",()=>{
mouseHeld = false;
});

/* SPACE HOLD TRACK */

document.addEventListener("keydown",(e)=>{
if(e.code === "Space") spaceHeld = true;
});

document.addEventListener("keyup",(e)=>{
if(e.code === "Space") spaceHeld = false;
});

/* RESET IF TAB CHANGES OR WINDOW BLURS */

window.addEventListener("blur",()=>{
mouseHeld = false;
spaceHeld = false;
});

/* AUTO FIRE LOOP */

setInterval(()=>{

if(!mouseHeld && !spaceHeld) return;

shoot();

},50);

/* SHOOT */

function shoot(){

const p = gameState.players[playerId];
if(!p) return;

/* check active slot weapon */

const weapon = p.tank.weapons[activeSlot-1] || null;

/* empty slot = no firing */

if(!weapon) return;

if(socket.readyState!==WebSocket.OPEN) return;

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

if(data.type==="init") playerId=data.id;

if(data.type==="map") map=data.data;

/* STATE SNAP */

if(data.type==="state"){

if(data.time <= lastServerTime) return;

lastServerTime = data.time;

gameState.players = data.players;
gameState.projectiles = data.projectiles;

}

/* DAMAGE EVENT */

if(data.type==="damage"){

if(!tabActive) return;

const p = gameState.players[data.targetId];
if(!p) return;

if(data.targetId===playerId){
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

let lastInput="";

function updateInput(){

if(!playerId) return;
if(!tabActive) return;

if(aimMode==="keyboard"){

if(keys["arrowleft"]) turretAngle-=rotateSpeed;
if(keys["arrowright"]) turretAngle+=rotateSpeed;

}

const payload = JSON.stringify({
type:"input",
keys:keys,
turretAngle:turretAngle
});

if(payload!==lastInput && socket.readyState===WebSocket.OPEN){

socket.send(payload);
lastInput=payload;

}

}

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

const p=particles[i];

p.x+=p.vx;
p.y+=p.vy;
p.life--;

if(p.life<=0) particles.splice(i,1);

}

}

function drawParticles(){

particles.forEach(p=>{
ctx.fillStyle=p.color;
ctx.fillRect(p.x,p.y,3,3);
});

}

/* DAMAGE TEXT */

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

const d=damageTexts[i];

d.y+=d.vy;
d.life--;

if(d.life<=0) damageTexts.splice(i,1);

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
map.walls.forEach(o=>ctx.fillRect(o.x - cameraX, o.y - cameraY, o.w, o.h));

ctx.fillStyle="#777";
map.stones.forEach(o=>ctx.fillRect(o.x - cameraX, o.y - cameraY, o.w, o.h));

ctx.fillStyle="#6b4a2d";
map.covers.forEach(o=>ctx.fillRect(o.x - cameraX, o.y - cameraY, o.w, o.h));

}

/* HUD */

function drawHUD(){

const p=gameState.players[playerId];
if(!p) return;

const weapon=p.tank.weapons[activeSlot-1]||null;

ctx.fillStyle="white";
ctx.font="16px monospace";

ctx.fillText("HP: "+p.hp,10,20);
ctx.fillText("Armor: "+p.armorHp,10,40);
ctx.fillText("Energy: "+p.tank.energy,10,60);
ctx.fillText("Speed: "+p.tank.speed,10,80);

ctx.fillText("Weapon: "+(weapon?weapon.name:"Empty"),10,100);

ctx.fillText("FPS: "+fps,10,140);
ctx.fillText("MS: "+frameMS.toFixed(1),10,160);


}

/* HOTBAR */

function drawHotbar(){

const p=gameState.players[playerId];
if(!p) return;

const weapons=p.tank.weapons;

const slots=5;
const size=60;
const spacing=10;

const total=slots*size+(slots-1)*spacing;
const start=canvas.width/2-total/2;

const y=canvas.height-size-10;

for(let i=0;i<slots;i++){

const x=start+i*(size+spacing);
const weapon=weapons[i]||null;

ctx.fillStyle=(i+1===activeSlot)?"#aaa":"#555";
ctx.fillRect(x,y,size,size);

ctx.strokeStyle="#222";
ctx.strokeRect(x,y,size,size);

ctx.fillStyle="#000";
ctx.font="18px monospace";
ctx.fillText(i+1,x+24,y+34);

if(weapon){

/* weapon icon */

ctx.fillStyle="#ffd800";
ctx.fillRect(x+size/2-4,y+12,8,26);

/* RELOAD BAR */

const lastShot = p.lastShotTime ? p.lastShotTime[i] : 0;

const elapsed = Date.now() - lastShot;

const ratio = Math.min(elapsed / weapon.cooldown, 1);

/* background bar */

ctx.fillStyle="#111";
ctx.fillRect(x, y + size - 6, size, 4);

/* progress */

ctx.fillStyle="#00ff88";
ctx.fillRect(
  x,
  y + size - 6,
  size * ratio,
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

const player = gameState.players[playerId];

if(player){
cameraX = player.x - canvas.width/2;
cameraY = player.y - canvas.height/2;

/* CAMERA CLAMP */

if(map){
cameraX = Math.max(0, Math.min(cameraX, map.width - canvas.width));
cameraY = Math.max(0, Math.min(cameraY, map.height - canvas.height));
}
}

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

const p=gameState.players[id];

ctx.fillStyle=id===playerId?"#3cb371":"#ff4444";

ctx.fillRect(
p.x - cameraX - TANK_HALF + shakeX,
p.y - cameraY - TANK_HALF + shakeY,
TANK_SIZE,
TANK_SIZE
);

/* BARS */

const barWidth=40;
const barHeight=4;

const armorPercent=p.armorHp/p.tank.armorHp;
const hpPercent=p.hp/p.tank.hp;

const barX=p.x - cameraX - barWidth/2 + shakeX;
const barY=p.y - cameraY + TANK_HALF + 6 + shakeY;

ctx.fillStyle="#000";
ctx.fillRect(barX,barY,barWidth,10);

ctx.fillStyle="#4aa3ff";
ctx.fillRect(barX,barY,barWidth*armorPercent,barHeight);

ctx.fillStyle="#ff3b3b";
ctx.fillRect(barX,barY+6,barWidth*hpPercent,barHeight);

/* TURRET (always visible) */

ctx.save();

ctx.translate(p.x - cameraX, p.y - cameraY);
ctx.rotate(p.turretAngle);

ctx.fillStyle="#2fd9ff";
ctx.fillRect(0,-5,40,10);

ctx.restore();

}

/* BULLETS */

ctx.fillStyle="#ffd800";

gameState.projectiles.forEach(b=>{
ctx.fillRect(
b.x - cameraX - b.size/2,
b.y - cameraY - b.size/2,
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

const now = performance.now();

frameMS = now - lastFrameTime;
lastFrameTime = now;

frameCount++;

if(now - lastFpsTime >= 1000){
fps = frameCount;
frameCount = 0;
lastFpsTime = now;
}

updateParticles();
updateDamageTexts();

draw();

requestAnimationFrame(loop);

}


loop();