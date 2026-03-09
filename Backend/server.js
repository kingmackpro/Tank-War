const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 8080;

/* HTTP SERVER (serves frontend files) */

const server = http.createServer((req, res) => {

let filePath = "./";

if (req.url === "/") filePath += "index.html";
else filePath += req.url;

const ext = path.extname(filePath);

let contentType = "text/plain";

if (ext === ".html") contentType = "text/html";
if (ext === ".js") contentType = "text/javascript";

fs.readFile(filePath, (err, data) => {

if (err) {
res.writeHead(404);
res.end("Not found");
return;
}

res.writeHead(200, { "Content-Type": contentType });
res.end(data);

});

});

server.listen(PORT, () => {
console.log("HTTP server running on http://localhost:8080");
});


/* WEBSOCKET SERVER */

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {

console.log("Client connected");

ws.send("server_connected");

ws.on("message", (message) => {
console.log("Message from client:", message.toString());
});

});