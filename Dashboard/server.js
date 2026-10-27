const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = 3000;

// Config aus .env
const CLIENT_ID = process.env.DASHBOARD_CLIENT_ID || "1529845533026287677";
const CLIENT_SECRET = process.env.DASHBOARD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DASHBOARD_REDIRECT_URI || "http://127.0.0.1:3000/auth/callback";
const OWNER_ID = process.env.DASHBOARD_OWNER_ID || "1322191083303731201";
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;

const ROLES_FILE = path.join(__dirname, "dashboard-roles.json");

function loadDashboardRoles() {
    try {
        if (!fs.existsSync(ROLES_FILE)) return {};
        return JSON.parse(fs.readFileSync(ROLES_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveDashboardRoles(roles) {
    try {
        fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
    } catch (err) {
        console.error("Fehler beim Speichern der Dashboard-Rollen:", err);
    }
}

const userRoles = loadDashboardRoles();

function getUserRole(userId) {
    if (userId === OWNER_ID) return "OWNER";
    return userRoles[userId] || "MEMBER";
}

app.use(express.json());
app.use(session({
    secret: SESSION_SECRET || "novex-dashboard-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(express.static(__dirname));

// Demo-Benutzer für Testing (nur wenn kein OAuth konfiguriert ist)
const DEMO_USERS = {
    admin: { password: "admin123", role: "owner" },
    mod: { password: "mod123", role: "moderator" },
    viewer: { password: "view123", role: "viewer" }
};

// Auth Middleware
function checkAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Nicht angemeldet" });
    }
    next();
}

function checkRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ error: "Nicht angemeldet" });
        }
        const userRole = getUserRole(req.session.user.id);
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: "Keine Berechtigung" });
        }
        next();
    };
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Login API (Demo + OAuth2)
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    
    // Demo-Modus für Testing
    if (DEMO_USERS[username] && DEMO_USERS[username].password === password) {
        const demoUser = {
            id: "demo-" + username,
            username: username,
            role: DEMO_USERS[username].role
        };
        req.session.user = demoUser;
        return res.json({ 
            token: "demo-token-" + Date.now(),
            user: demoUser 
        });
    }
    
    // OAuth2 wäre hier implementiert
    return res.status(401).json({ error: "Ungültige Anmeldedaten" });
});

// Token-Verifizierung
app.get("/api/verify", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Nicht angemeldet" });
    }
    res.json({ user: req.session.user });
});

// Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// OAuth2 Login
app.get("/auth/login", (req, res) => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).send("❌ OAuth2 nicht konfiguriert. DASHBOARD_CLIENT_SECRET prüfen.");
    }

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: "identify email"
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// OAuth2 Callback
app.get("/auth/callback", async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) return res.status(400).send("❌ Kein Code vorhanden.");

        const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            return res.status(500).send("❌ Token-Fehler bei Discord Login.");
        }

        const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const user = await userResponse.json();
        if (!userResponse.ok) {
            return res.status(500).send("❌ Profil konnte nicht geladen werden.");
        }

        const role = getUserRole(user.id);

        req.session.user = {
            id: user.id,
            username: user.username,
            global_name: user.global_name || "Nicht verfügbar",
            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
            email: user.email || "Nicht verfügbar",
            verified: user.verified !== undefined ? user.verified : false,
            role: role
        };

        res.redirect("/");
    } catch (error) {
        console.error("Callback Fehler:", error);
        res.status(500).send("❌ Serverfehler beim Login.");
    }
});

app.get("/auth/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

app.get("/api/me", (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    
    // Live Rolle anhängen
    req.session.user.role = getUserRole(req.session.user.id);
    res.json({ loggedIn: true, user: req.session.user });
});

// Bot-Statistiken API
app.get("/api/bot/stats", checkAuth, (req, res) => {
    const client = global.dashboardClient;
    if (!client || !client.isReady()) {
        return res.status(503).json({ error: "Bot nicht bereit" });
    }
    
    const stats = {
        online: true,
        username: client.user.username,
        discriminator: client.user.discriminator,
        guilds: client.guilds.cache.size,
        totalMembers: client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0),
        ping: client.ws.ping,
        uptime: client.uptime,
        readyAt: client.readyAt
    };
    
    res.json(stats);
});

// Ticket-System API
app.get("/api/tickets", checkAuth, (req, res) => {
    const client = global.dashboardClient;
    if (!client || !client.isReady()) {
        return res.status(503).json({ error: "Bot nicht bereit" });
    }
    
    try {
        const ticketData = require("../Ticket-Daten.json");
        const tickets = Object.values(ticketData.tickets || {}).map(ticket => ({
            id: ticket.channelId,
            type: ticket.type,
            userId: ticket.userId,
            status: ticket.status,
            createdAt: ticket.createdAt
        }));
        
        res.json({ tickets });
    } catch (error) {
        res.status(500).json({ error: "Ticket-Daten konnten nicht geladen werden" });
    }
});

// Team-Statistiken API
app.get("/api/team/stats", checkAuth, (req, res) => {
    const client = global.dashboardClient;
    if (!client || !client.isReady()) {
        return res.status(503).json({ error: "Bot nicht bereit" });
    }
    
    try {
        const teamRolesConfig = require("../team-roles-config.json");
        const staffRoleId = teamRolesConfig.staffRoleId;
        
        let totalStaff = 0;
        let onlineStaff = 0;
        
        client.guilds.cache.forEach(guild => {
            const staffRole = guild.roles.cache.get(staffRoleId);
            if (staffRole) {
                totalStaff += staffRole.members.size;
                onlineStaff += staffRole.members.filter(m => m.presence?.status === 'online').size;
            }
        });
        
        res.json({
            totalStaff,
            onlineStaff,
            offlineStaff: totalStaff - onlineStaff
        });
    } catch (error) {
        res.status(500).json({ error: "Team-Statistiken konnten nicht geladen werden" });
    }
});

app.get("/api/status", (req, res) => {
    const client = global.dashboardClient;
    res.json({
        online: Boolean(client && client.isReady()),
        bot: client && client.user ? { id: client.user.id, username: client.user.username } : null
    });
});

app.get("/api/guilds", (req, res) => { // checkAuth entfernt für Testing
    const client = global.dashboardClient;
    if (!client || !client.isReady()) return res.status(503).json({ error: "Bot nicht bereit." });

    const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        icon: guild.iconURL({ extension: "png", size: 128 })
    }));

    res.json(guilds);
});

app.get("/api/guilds/:guildId/channels", (req, res) => { // checkAuth entfernt für Testing
    const client = global.dashboardClient;
    if (!client) return res.status(503).json({ error: "Bot nicht bereit." });

    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: "Server nicht gefunden." });

    const channels = guild.channels.cache
        .sort((a, b) => a.position - b.position)
        .map(ch => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            parentId: ch.parentId
        }));

    res.json(channels);
});

// Mitgliederliste Endpunkt (Nur OWNER & CO-OWNER)
app.get("/api/guilds/:guildId/members", checkRole(["OWNER", "CO-OWNER"]), async (req, res) => {
    const client = global.dashboardClient;
    if (!client) return res.status(503).json({ error: "Bot nicht bereit." });

    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: "Server nicht gefunden." });

    try {
        await guild.members.fetch();
        const members = guild.members.cache.map(m => {
            const role = getUserRole(m.id);
            return {
                id: m.id,
                username: m.user.username,
                global_name: m.user.globalName || "Nicht verfügbar",
                avatar: m.user.displayAvatarURL({ size: 128 }),
                dashboardRole: role
            };
        });
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: "Mitglieder konnten nicht geladen werden." });
    }
});

// Rollen-Update (Nur OWNER)
app.post("/api/roles/update", checkRole(["OWNER"]), (req, res) => {
    const { targetUserId, newRole } = req.body;
    const validRoles = ["OWNER", "CO-OWNER", "MEMBER", "BETA-TESTER"];

    if (!targetUserId || !validRoles.includes(newRole)) {
        return res.status(400).json({ error: "Ungültige Parameter." });
    }

    if (targetUserId === OWNER_ID && newRole !== "OWNER") {
        return res.status(400).json({ error: "Haupt-Owner kann nicht degradiert werden." });
    }

    userRoles[targetUserId] = newRole;
    saveDashboardRoles(userRoles);

    res.json({ success: true, userId: targetUserId, role: newRole });
});

app.post("/api/send-message", checkAuth, async (req, res) => {
    const { guildId, channelId, message } = req.body;
    const client = global.dashboardClient;

    if (!client || !client.isReady()) return res.status(503).json({ error: "Bot nicht bereit." });

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Server nicht gefunden." });

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return res.status(400).json({ error: "Ungültiger Kanal." });

    try {
        await channel.send({ content: message, allowedMentions: { parse: [] } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Fehler beim Senden der Nachricht." });
    }
});

// API-Endpunkt zum Laden von Nachrichten-Historie
app.get("/api/channels/:channelId/messages", async (req, res) => { // checkAuth entfernt für Testing
    const client = global.dashboardClient;
    if (!client || !client.isReady()) return res.status(503).json({ error: "Bot nicht bereit." });

    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before ? req.query.before : null;

    try {
        const channel = await client.channels.fetch(req.params.channelId);
        if (!channel || !channel.isTextBased()) {
            return res.status(400).json({ error: "Ungültiger Kanal." });
        }

        const options = { limit: Math.min(limit, 100) };
        if (before) {
            options.before = before;
        }

        const messages = await channel.messages.fetch(options);
        
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            author: {
                id: msg.author.id,
                username: msg.author.username,
                displayName: msg.author.displayName,
                avatar: msg.author.displayAvatarURL({ size: 128 }),
                isBot: msg.author.bot
            },
            timestamp: msg.createdAt.toISOString(),
            attachments: msg.attachments.map(att => ({
                url: att.url,
                name: att.name,
                contentType: att.contentType
            }))
        })).reverse(); // Älteste zuerst für chronologische Anzeige

        res.json(formattedMessages);
    } catch (err) {
        console.error("Fehler beim Laden der Nachrichten:", err);
        res.status(500).json({ error: "Fehler beim Laden der Nachrichten." });
    }
});

function startDashboard(client) {
    global.dashboardClient = client;
    
    const server = app.listen(PORT, "127.0.0.1", () => {
        console.log(`🌐 Dashboard online: http://127.0.0.1:${PORT}`);
    });
    
    // WebSocket für Live-Nachrichten
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    
    // Discord message event listener for live updates
    client.on('messageCreate', (message) => {
        if (message.author.bot && message.author.id !== client.user.id) return;
        
        io.emit('newMessage', {
            channelId: message.channelId,
            message: {
                id: message.id,
                content: message.content,
                author: {
                    id: message.author.id,
                    username: message.author.username,
                    displayName: message.author.displayName,
                    avatar: message.author.displayAvatarURL({ size: 128 }),
                    isBot: message.author.bot
                },
                timestamp: message.createdAt.toISOString()
            }
        });
    });
    
    global.dashboardIO = io;
}

module.exports = startDashboard;
