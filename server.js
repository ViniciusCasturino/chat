// server.js
const WebSocket = require("ws");
const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.static("public"));

const server = app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

let clientCount = 0;

wss.on("connection", (ws) => {
    clientCount++;
    console.log(`Novo cliente conectado. Total de clientes: ${clientCount}`);

    ws.on("message", (message) => {
        try {
            const { nome, mensagem } = JSON.parse(message);
            console.log(`${nome}: ${mensagem}`);

            // Distribui a mensagem formatada para todos os clientes conectados
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ nome, mensagem }));
                }
            });
        } catch (error) {
            console.log("Erro ao processar mensagem:", error);
        }
    });

    ws.on("close", () => {
        clientCount--;
        console.log(`Cliente desconectado. Total de clientes: ${clientCount}`);
    });
});
