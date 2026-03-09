/* WEBSOCKET CONNECTION */

const socket = new WebSocket("ws://localhost:8080");

socket.addEventListener("open", () => {

console.log("Connected to server");

socket.send("client_ready");

});

socket.addEventListener("message", (event) => {

console.log("Message from server:", event.data);

});


/* ---------- GAME CODE BELOW ---------- */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const keys = {};
const bullets = [];

let activeWeapon = 1;
let aimMode = "mouse";

const tank = {
x:450,
y:300,
size:40,
speed:3,
turretAngle:0
};

const obstacles = [
{x:200,y:200,w:80,h:80},
{x:600,y:150,w:100,h:50},
{x:400,y:450,w:120,h:40}
];

const walls = [
{x:0,y:0,w:900,h:20},
{x:0,y:580,w:900,h:20},
{x:0,y:0,w:20,h:600},
{x:880,y:0,w:20,h:600}
];

let mouse = {x:0,y:0};

document.addEventListener("keydown",e=>{

keys[e.key.toLowerCase()] = true;

if(e.key >= "1" && e.key <= "5"){
activeWeapon = parseInt(e.key);
}

if(e.key === " "){
shoot();
}

if(e.key === "ArrowLeft" || e.key === "ArrowRight"){
aimMode = "keyboard";
}

});

document.addEventListener("keyup",e=>{
keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove",e=>{

const rect = canvas.getBoundingClientRect();

mouse.x = e.clientX - rect.left;
mouse.y = e.clientY - rect.top;

aimMode = "mouse";

});

canvas.addEventListener("mousedown",()=>{
shoot();
});


function shoot(){

if(activeWeapon !== 1) return;

const speed = 8;

bullets.push({
x:tank.x,
y:tank.y,
vx:Math.cos(tank.turretAngle)*speed,
vy:Math.sin(tank.turretAngle)*speed,
size:6
});

}


function rectCollision(a,b){

return a.x < b.x + b.w &&
a.x + a.w > b.x &&
a.y < b.y + b.h &&
a.y + a.h > b.y;

}


function update(){

let dx=0;
let dy=0;

if(keys["w"]) dy -= tank.speed;
if(keys["s"]) dy += tank.speed;
if(keys["a"]) dx -= tank.speed;
if(keys["d"]) dx += tank.speed;

tank.x += dx;
tank.y += dy;

const rotateSpeed = 0.05;

if(aimMode === "keyboard"){

if(keys["arrowleft"]) tank.turretAngle -= rotateSpeed;
if(keys["arrowright"]) tank.turretAngle += rotateSpeed;

}

if(aimMode === "mouse"){

tank.turretAngle = Math.atan2(
mouse.y - tank.y,
mouse.x - tank.x
);

}

bullets.forEach(b=>{
b.x += b.vx;
b.y += b.vy;
});

}


function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height);

ctx.fillStyle="#3cb371";

ctx.fillRect(
tank.x - tank.size/2,
tank.y - tank.size/2,
tank.size,
tank.size
);

ctx.save();

ctx.translate(tank.x,tank.y);
ctx.rotate(tank.turretAngle);

ctx.fillStyle="#2fd9ff";
ctx.fillRect(0,-6,42,12);

ctx.restore();

ctx.fillStyle="#ffd800";

bullets.forEach(b=>{
ctx.fillRect(b.x,b.y,b.size,b.size);
});

}


function gameLoop(){

update();
draw();

requestAnimationFrame(gameLoop);

}

gameLoop();