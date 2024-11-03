const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;
const JWT_SECRET = "secreta_chave_para_jwt";
const USERS_FILE = path.join(__dirname, "users.json");

app.use(bodyParser.json());
app.use(express.static("public"));

// Função para carregar usuários do arquivo
function loadUsers() {
    if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE, "utf-8");
        return JSON.parse(data);
    }
    return {};
}

// Função para salvar usuários no arquivo
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Carrega os usuários na inicialização do servidor
let users = loadUsers();

// Endpoint para registro de usuário
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(400).json({ message: "Usuário já existe." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = { password: hashedPassword };
    saveUsers(users);
    res.status(201).json({ message: "Usuário registrado com sucesso." });
});

// Endpoint para login de usuário
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Credenciais inválidas." });
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});

// Endpoint de administração para listar usuários
app.get("/users", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== "Bearer admin-secret-token") {
        return res.status(403).json({ message: "Acesso negado" });
    }

    // Exclui a senha para exibir somente o nome de usuário
    const userList = Object.keys(users).map((username) => ({ username }));
    res.json(userList);
});

// Inicializar o servidor WebSocket
const server = app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

function authenticateToken(ws, req, next) {
    const token = req.url.split("token=")[1];
    if (!token) return ws.close();

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return ws.close();
        ws.user = user;
        next();
    });
}

let clientCount = 0;

wss.on("connection", (ws, req) => {
    authenticateToken(ws, req, () => {
        clientCount++;
        console.log(`Novo cliente conectado: ${ws.user.username}. Total de clientes: ${clientCount}`);

        ws.on("message", (message) => {
            const data = JSON.parse(message);
            const nome = ws.user.username;
            const mensagem = data.mensagem;

            console.log(`${nome}: ${mensagem}`);

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ nome, mensagem }));
                }
            });
        });

        ws.on("close", () => {
            clientCount--;
            console.log(`Cliente desconectado. Total de clientes: ${clientCount}`);
        });
    });
});
