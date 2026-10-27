// =====================================================
// 🎬 ENTERTAINMENT-SYSTEM (NoVex RP)
// =====================================================
//
// Eigenständiges, in sich geschlossenes Modul für das
// Entertainment-System. Wird über initializeEntertainmentSystem(client, options)
// in index.js eingebunden.
//
// Enthält:
//   - !setup           -> Einrichtung aller Panels
//   - !willkommen-panel -> Willkommensnachricht-Panel
//   - !film-panel       -> Film- & Serien-Panel
//   - !umfrage-panel    -> Umfrage-Panel
//   - !spielkalender-panel -> Spielkalender-Panel
//   - !highscore-panel  -> Highscore-Panel
//   - !spiele-vorschlaege-panel -> Spiele-Vorschläge-Panel
//   - !ankuendigung-panel -> Ankündigungs-Panel
//   - !event-kalender-panel -> Event-Kalender-Panel
//   - !auto-nachrichten-panel -> Automatische Nachrichten-Panel
//   - !filmabend-panel  -> Filmabend-Panel
//   - !bewertung-panel  -> Filmbewertungs-Panel
//   - Dauerhafte Speicherung in entertainment-data.json
//   - Slash-Command Unterstützung für alle Panels
// =====================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField,
    MessageFlags,
    AttachmentBuilder,
    ChannelType
} = require("discord.js");

// =====================================================
// KONFIGURATION / FARBEN
// =====================================================

const ENT_COLOR_PRIMARY = 0x8b5cf6; // Lila – NoVex RP-Akzent
const ENT_COLOR_SUCCESS = 0x57F287;
const ENT_COLOR_DANGER  = 0xED4245;
const ENT_COLOR_WARNING = 0xFEE75C;
const ENT_COLOR_INFO    = 0x5865F2;

// =====================================================
// DATEIPFADE
// =====================================================

function resolveDataDir(options) {
    const dir = options.dataDir || path.join(__dirname, "data");
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    return dir;
}

function resolveImagesDir(options, dataDir) {
    const dir = options.imagesDir || path.join(dataDir, "entertainment-images");
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    return dir;
}

// =====================================================
// DATENBANK FUNKTIONEN
// =====================================================

function getDatabasePath(dataDir) {
    return path.join(dataDir, "entertainment-data.json");
}

function loadDatabase(dataDir) {
    try {
        const dbPath = getDatabasePath(dataDir);
        if (!fs.existsSync(dbPath)) {
            const initialData = {
                welcome: {},
                movies: [],
                series: [],
                polls: [],
                gameSchedule: [],
                highscores: [],
                gameSuggestions: [],
                announcements: [],
                events: [],
                autoMessages: [],
                movieNights: [],
                ratings: [],
                panels: {}
            };
            fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf8");
            return initialData;
        }
        
        const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        return data || {};
    } catch (error) {
        console.error("❌ Fehler beim Laden der Datenbank:", error);
        return {};
    }
}

function saveDatabase(dataDir, data) {
    try {
        const dbPath = getDatabasePath(dataDir);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Datenbank:", error);
        return false;
    }
}

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function errorReply(text) {
    return {
        content: `❌ ${text}`,
        flags: MessageFlags.Ephemeral
    };
}

function successReply(text) {
    return {
        content: `✅ ${text}`,
        flags: MessageFlags.Ephemeral
    };
}

async function respondOrEdit(interaction, payload) {
    if (interaction.deferred || interaction.replied) {
        const { flags, ...editablePayload } = payload;
        return interaction.editReply(editablePayload);
    }
    
    return interaction.reply(payload);
}

function generateId() {
    return crypto.randomBytes(8).toString("hex");
}

// =====================================================
// PENDING-SETUP-STORE
// =====================================================
// Hält Zwischendaten zwischen einem Modal-Submit (z.B. Nachrichtentext)
// und der darauffolgenden Kanal-/Rollen-Auswahl über native
// Discord-Select-Menüs (ChannelSelectMenuBuilder / RoleSelectMenuBuilder).
// Wird pro Nutzer gespeichert und läuft nach 10 Minuten automatisch ab.

const PENDING_TTL_MS = 10 * 60 * 1000;
const pendingActions = new Map();

function setPending(key, data) {
    pendingActions.set(key, { data, expiresAt: Date.now() + PENDING_TTL_MS });
}

function getPending(key) {
    const entry = pendingActions.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        pendingActions.delete(key);
        return null;
    }
    return entry.data;
}

function clearPending(key) {
    pendingActions.delete(key);
}

// =====================================================
// BOT-OWNER / ADMIN-BEREICH HILFSFUNKTIONEN
// =====================================================
// BOT_OWNER_ID wird in initializeEntertainmentSystem() aus options.botOwnerId
// gesetzt. Nur dieser einzelne Nutzer darf die "❗ ... Admin"-Bereiche
// (Spielkalender, Bewertung, Events, Autonachricht) verwenden.

let BOT_OWNER_ID = null;

function isBotOwner(userId) {
    return !!BOT_OWNER_ID && userId === BOT_OWNER_ID;
}

async function requireBotOwner(interaction) {
    if (!isBotOwner(interaction.user.id)) {
        await interaction.reply(errorReply("Nur der Bot-Owner darf diesen Adminbereich verwenden.")).catch(console.error);
        return false;
    }
    return true;
}

// Zerlegt dynamische Custom-IDs der Form "<prefix><type>_<entryId>" bzw.
// "<prefix><type>" (ohne entryId), z.B. "admin_edit_gameSchedule_ab12cd34".
function parseTypeId(customId, prefix) {
    const rest = customId.slice(prefix.length);
    const sep = rest.indexOf("_");
    if (sep === -1) return { type: rest, entryId: null };
    return { type: rest.slice(0, sep), entryId: rest.slice(sep + 1) };
}

function formatDate(date) {
    return new Date(date).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function formatTime(time) {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getWelcomeImagesDir(dataDir) {
    const dir = path.join(dataDir, "entertainment-images");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(destPath, () => {});
                return reject(new Error(`Download fehlgeschlagen (HTTP ${response.statusCode})`));
            }
            response.pipe(file);
            file.on("finish", () => file.close(() => resolve()));
        }).on("error", (error) => {
            file.close();
            fs.unlink(destPath, () => {});
            reject(error);
        });
    });
}

// =====================================================
// SLASH-COMMAND HANDLER
// =====================================================

async function handleEntertainmentSlashCommand(interaction, commandName, dataDir, db) {
    // Simuliere eine message-Nachricht für die bestehenden Handler
    const mockMessage = {
        channel: interaction.channel,
        guild: interaction.guild,
        member: interaction.member,
        author: interaction.user,
        content: `!${commandName}`,
        reply: async (content) => {
            // Ignorieren - wir nutzen die slash reply
        }
    };

    // Bestätigung dass Slash-Command ausgeführt wird
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Führe den entsprechenden Handler aus
    switch (commandName) {
        case "setups":
            await handleSetupsCommand(mockMessage, [], dataDir, db);
            break;
        case "willkommen-panel":
            await handleWelcomePanel(mockMessage, dataDir, db);
            break;
        case "film-panel":
            await handleFilmPanel(mockMessage, dataDir, db);
            break;
        case "umfrage-panel":
            await handleUmfragePanel(mockMessage, dataDir, db);
            break;
        case "spielkalender-panel":
            await handleSpielkalenderPanel(mockMessage, dataDir, db);
            break;
        case "highscore-panel":
            await handleHighscorePanel(mockMessage, dataDir, db);
            break;
        case "spiele-vorschlaege-panel":
            await handleSpieleVorschlaegePanel(mockMessage, dataDir, db);
            break;
        case "ankuendigung-panel":
            await handleAnkuendigungPanel(mockMessage, dataDir, db);
            break;
        case "event-kalender-panel":
            await handleEventKalenderPanel(mockMessage, dataDir, db);
            break;
        case "auto-nachrichten-panel":
            await handleAutoNachrichtenPanel(mockMessage, dataDir, db);
            break;
        case "filmabend-panel":
            await handleFilmabendPanel(mockMessage, dataDir, db);
            break;
        case "bewertung-panel":
            await handleBewertungPanel(mockMessage, dataDir, db);
            break;
    }

    // Erfolgsnachricht
    await interaction.editReply({ content: `✅ /${commandName} wurde ausgeführt. Das Panel wurde erstellt.` });
}

// =====================================================
// INITIALIZE FUNCTION
// =====================================================

function initializeEntertainmentSystem(client, options = {}) {
    const dataDir = resolveDataDir(options);
    const imagesDir = resolveImagesDir(options, dataDir);
    
    BOT_OWNER_ID = options.botOwnerId || null;
    
    console.log("🎬 Entertainment-System wird initialisiert...");
    
    // Datenbank initialisieren
    const db = loadDatabase(dataDir);
    
    // Command Handler registrieren
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith("!")) return;

        const args = message.content.slice(1).split(" ");
        const command = args[0].toLowerCase();

        try {
            // Setups Command (neu für Entertainment-System)
            if (command === "setups") {
                await handleSetupsCommand(message, args, dataDir, db);
            }
            // Welcome Panel
            else if (command === "willkommen-panel") {
                await handleWelcomePanel(message, dataDir, db);
            }
            // Film Panel
            else if (command === "film-panel") {
                await handleFilmPanel(message, dataDir, db);
            }
            // Umfrage Panel
            else if (command === "umfrage-panel") {
                await handleUmfragePanel(message, dataDir, db);
            }
            // Spielkalender Panel
            else if (command === "spielkalender-panel") {
                await handleSpielkalenderPanel(message, dataDir, db);
            }
            // Highscore Panel
            else if (command === "highscore-panel") {
                await handleHighscorePanel(message, dataDir, db);
            }
            // Spiele Vorschläge Panel
            else if (command === "spiele-vorschlaege-panel") {
                await handleSpieleVorschlaegePanel(message, dataDir, db);
            }
            // Ankündigung Panel
            else if (command === "ankuendigung-panel") {
                await handleAnkuendigungPanel(message, dataDir, db);
            }
            // Event Kalender Panel
            else if (command === "event-kalender-panel") {
                await handleEventKalenderPanel(message, dataDir, db);
            }
            // Auto Nachrichten Panel
            else if (command === "auto-nachrichten-panel") {
                await handleAutoNachrichtenPanel(message, dataDir, db);
            }
            // Filmabend Panel
            else if (command === "filmabend-panel") {
                await handleFilmabendPanel(message, dataDir, db);
            }
            // Bewertung Panel
            else if (command === "bewertung-panel") {
                await handleBewertungPanel(message, dataDir, db);
            }
        } catch (error) {
            console.error("❌ Fehler im Entertainment-System:", error);
            message.reply("❌ Ein Fehler ist aufgetreten.").catch(console.error);
        }
    });

    // Slash-Command Handler für Entertainment-System
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.__slashCommandPermissionDenied) return;

        const commandName = interaction.commandName;
        const entertainmentCommands = [
            "setups", "willkommen-panel", "film-panel", "umfrage-panel",
            "spielkalender-panel", "highscore-panel", "spiele-vorschlaege-panel",
            "ankuendigung-panel", "event-kalender-panel", "auto-nachrichten-panel",
            "filmabend-panel", "bewertung-panel"
        ];

        if (!entertainmentCommands.includes(commandName)) return;

        try {
            // Slash-Command Handler für Entertainment
            await handleEntertainmentSlashCommand(interaction, commandName, dataDir, db);
        } catch (error) {
            console.error(`❌ Fehler bei Entertainment Slash-Command /${commandName}:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
            }
        }
    });
    
    // Separater Listener: erkennt den einmaligen Bild-Upload für das
    // Willkommensbild (siehe handleWelcomeImageYes) und speichert ihn dauerhaft.
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        try {
            await handlePendingWelcomeImageUpload(message, dataDir, db);
        } catch (error) {
            console.error("❌ Fehler beim Verarbeiten des Willkommensbild-Uploads:", error);
        }
    });
    
    // Interaction Handler für Buttons, Modals und Select-Menüs
    client.on("interactionCreate", async (interaction) => {
        if (
            !interaction.isButton() &&
            !interaction.isModalSubmit() &&
            !interaction.isStringSelectMenu() &&
            !interaction.isRoleSelectMenu()
        ) return;

        // Nuke-Buttons vom Haupt-Bot-Handler ignorieren
        if (interaction.isButton() &&
            (interaction.customId.startsWith("nuke_confirm_") ||
             interaction.customId.startsWith("nuke_cancel_"))) {
            return;
        }

        try {
            if (interaction.isButton()) {
                await handleButtonInteraction(interaction, dataDir, db);
            } else if (interaction.isModalSubmit()) {
                await handleModalSubmit(interaction, dataDir, db);
            } else if (interaction.isRoleSelectMenu()) {
                await handleRoleSelectInteraction(interaction, dataDir, db);
            } else if (interaction.isStringSelectMenu()) {
                await handleSelectMenuInteraction(interaction, dataDir, db);
            }
        } catch (error) {
            console.error("❌ Fehler bei Interaction:", error);
        }
    });
    
    // Automatischer Versand der Willkommensnachricht bei neuen Mitgliedern
    client.on("guildMemberAdd", async (member) => {
        try {
            await sendWelcomeMessage(member, db, dataDir);
        } catch (error) {
            console.error("❌ Fehler beim automatischen Senden der Willkommensnachricht:", error);
        }
    });
    
    console.log("✅ Entertainment-System erfolgreich geladen!");
}

// =====================================================
// AUTOMATISCHER WILLKOMMENS-VERSAND
// =====================================================

function renderWelcomeMessage(welcomeConfig, member) {
    let message = welcomeConfig.message;
    
    if (welcomeConfig.mention) {
        message = message.split("{user}").join(member.toString());
    }
    
    return message;
}

async function sendWelcomeMessage(member, db, dataDir) {
    const guildId = member.guild.id;
    const welcomeConfig = db.welcome[guildId];
    
    // Kein Setup für diesen Server vorhanden -> nichts zu tun
    if (!welcomeConfig || !welcomeConfig.message || !welcomeConfig.channel) {
        return;
    }
    
    // Kanal auflösen: erst aus dem Cache, sonst per API nachladen
    let channel = member.guild.channels.cache.get(welcomeConfig.channel);
    
    if (!channel) {
        try {
            channel = await member.guild.channels.fetch(welcomeConfig.channel);
        } catch (error) {
            console.error(`❌ Willkommenskanal (${welcomeConfig.channel}) auf Server ${guildId} nicht gefunden:`, error.message);
            return;
        }
    }
    
    if (!channel || !channel.isTextBased()) {
        console.error(`❌ Willkommenskanal (${welcomeConfig.channel}) auf Server ${guildId} ist kein Textkanal.`);
        return;
    }
    
    const { embeds, files } = buildWelcomeEmbed(welcomeConfig, member, member.client, dataDir);
    
    await channel.send({ embeds, files }).catch(error => {
        console.error(`❌ Willkommensnachricht konnte nicht in Kanal ${channel.id} gesendet werden:`, error.message);
    });
}

// =====================================================
// SETUPS COMMAND (neu für Entertainment-System)
// =====================================================

async function handleSetupsCommand(message, args, dataDir, db) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ Du benötigst Administrator-Rechte für diesen Befehl.").catch(console.error);
    }
    
    const setupType = args[1]?.toLowerCase();
    
    if (!setupType) {
        // Alle Panels einrichten
        const embed = new EmbedBuilder()
            .setTitle("🎬 Entertainment-System Setups")
            .setDescription("Wähle aus, welche Panels du einrichten möchtest:")
            .setColor(ENT_COLOR_PRIMARY)
            .addFields(
                { name: "👋 Willkommen", value: "!setups willkommen", inline: true },
                { name: "🎬 Filme & Serien", value: "!setups filme", inline: true },
                { name: "📊 Umfragen", value: "!setups umfrage", inline: true },
                { name: "🎮 Spielkalender", value: "!setups spielkalender", inline: true },
                { name: "🏆 Highscores", value: "!setups highscores", inline: true },
                { name: "💡 Spiele-Vorschläge", value: "!setups spiele", inline: true },
                { name: "📢 Ankündigungen", value: "!setups ankuendigungen", inline: true },
                { name: "🎉 Event-Kalender", value: "!setups events", inline: true },
                { name: "🤖 Auto-Nachrichten", value: "!setups auto", inline: true },
                { name: "🍿 Filmabende", value: "!setups filmabend", inline: true },
                { name: "⭐ Bewertungen", value: "!setups bewertung", inline: true },
                { name: "🎬 Alle Panels", value: "!setups alle", inline: true }
            );
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("setups_all")
                    .setLabel("🎬 Alle einrichten")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("setups_welcome")
                    .setLabel("👋 Willkommen")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_filme")
                    .setLabel("🎬 Filme")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_umfrage")
                    .setLabel("📊 Umfragen")
                    .setStyle(ButtonStyle.Secondary)
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("setups_spielkalender")
                    .setLabel("🎮 Spielkalender")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_highscores")
                    .setLabel("🏆 Highscores")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_spiele")
                    .setLabel("💡 Spiele")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_ankuendigungen")
                    .setLabel("📢 Ankündigungen")
                    .setStyle(ButtonStyle.Secondary)
            );
        
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("setups_events")
                    .setLabel("🎉 Events")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_auto")
                    .setLabel("🤖 Auto-Nachrichten")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_filmabend")
                    .setLabel("🍿 Filmabende")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("setups_bewertung")
                    .setLabel("⭐ Bewertungen")
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return message.channel.send({ embeds: [embed], components: [row1, row2, row3] }).catch(console.error);
    }
    
    // Individuelle Setup-Handler
    switch (setupType) {
        case "willkommen":
            await handleWelcomePanel(message, dataDir, db);
            break;
        case "filme":
            await handleFilmPanel(message, dataDir, db);
            break;
        case "umfrage":
            await handleUmfragePanel(message, dataDir, db);
            break;
        case "spielkalender":
            await handleSpielkalenderPanel(message, dataDir, db);
            break;
        case "highscores":
            await handleHighscorePanel(message, dataDir, db);
            break;
        case "spiele":
            await handleSpieleVorschlaegePanel(message, dataDir, db);
            break;
        case "ankuendigungen":
            await handleAnkuendigungPanel(message, dataDir, db);
            break;
        case "events":
            await handleEventKalenderPanel(message, dataDir, db);
            break;
        case "auto":
            await handleAutoNachrichtenPanel(message, dataDir, db);
            break;
        case "filmabend":
            await handleFilmabendPanel(message, dataDir, db);
            break;
        case "bewertung":
            await handleBewertungPanel(message, dataDir, db);
            break;
        case "alle":
            await setupAllPanels(message, dataDir, db);
            break;
        default:
            message.reply("❌ Unbekanntes Setup. Verwende `!setups` ohne Argumente für eine Übersicht.").catch(console.error);
    }
}

async function setupAllPanels(interaction, dataDir, db) {
    const isInteraction = typeof interaction.isButton === "function"; // Interaction-Objekte haben isButton(), Message-Objekte nicht
    
    const replyMethod = isInteraction ? 
        (msg) => interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(console.error) :
        (msg) => interaction.reply(msg).catch(console.error);
    
    const sendMethod = isInteraction ?
        (msg) => interaction.channel.send(msg).catch(console.error) :
        (msg) => interaction.channel.send(msg).catch(console.error);
    
    await replyMethod("🎬 Richte alle Entertainment-Panels ein...");
    
    // Simuliere das Einrichten aller Panels
    const panels = [
        "👋 Willkommens-Panel",
        "🎬 Film- & Serien-Panel",
        "📊 Umfrage-Panel",
        "🎮 Spielkalender-Panel",
        "🏆 Highscore-Panel",
        "💡 Spiele-Vorschläge-Panel",
        "📢 Ankündigungs-Panel",
        "🎉 Event-Kalender-Panel",
        "🤖 Auto-Nachrichten-Panel",
        "🍿 Filmabend-Panel",
        "⭐ Filmbewertungs-Panel"
    ];
    
    for (const panel of panels) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await sendMethod(`✅ ${panel} eingerichtet`);
    }
    
    await sendMethod("🎉 **Alle Entertainment-Panels wurden erfolgreich eingerichtet!**");
    
    if (isInteraction) {
        await interaction.editReply({ content: "✅ Setup abgeschlossen!", components: [] }).catch(console.error);
    }
}

// =====================================================
// WILLKOMMENS-PANEL
// =====================================================

async function handleWelcomePanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const member = isInteraction ? messageOrInteraction.member : messageOrInteraction.member;
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const replyMethod = isInteraction ? 
            (msg) => messageOrInteraction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(console.error) :
            (msg) => messageOrInteraction.reply(msg).catch(console.error);
        return replyMethod("❌ Du benötigst Administrator-Rechte für diesen Befehl.");
    }
    
    const embed = new EmbedBuilder()
        .setTitle("👋 Willkommens-Panel Einrichtung")
        .setDescription("Richte die Willkommensnachricht für neue Mitglieder ein.")
        .setColor(ENT_COLOR_PRIMARY)
        .addFields(
            { name: "Aktuelle Einstellungen", value: "Noch nicht konfiguriert", inline: false }
        );
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("welcome_setup")
                .setLabel("⚙️ Einrichten")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("welcome_test")
                .setLabel("🧪 Testen")
                .setStyle(ButtonStyle.Secondary)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Willkommens-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// FILM- & SERIEN-PANEL
// =====================================================

async function handleFilmPanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("🎬 Film- & Serien-Panel")
        .setDescription("Schlage Filme oder Serien vor oder durchsuche die Datenbank.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("film_add_movie")
                .setLabel("🎬 Film vorschlagen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("film_add_series")
                .setLabel("📺 Serie vorschlagen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("film_list")
                .setLabel("📋 Liste anzeigen")
                .setStyle(ButtonStyle.Secondary)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Film-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// UMFRAGE-PANEL
// =====================================================

async function handleUmfragePanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("📊 Umfrage-Panel")
        .setDescription("Erstelle Umfragen für verschiedene Kategorien.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("umfrage_type_select")
                .setPlaceholder("Wähle die Umfrage-Kategorie")
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel("🎬 Film-Umfrage")
                        .setValue("film")
                        .setDescription("Umfrage über Filme"),
                    new StringSelectMenuOptionBuilder()
                        .setLabel("📺 Serien-Umfrage")
                        .setValue("serie")
                        .setDescription("Umfrage über Serien"),
                    new StringSelectMenuOptionBuilder()
                        .setLabel("🎮 Spiel-Umfrage")
                        .setValue("spiel")
                        .setDescription("Umfrage über Spiele"),
                    new StringSelectMenuOptionBuilder()
                        .setLabel("❓ Eigene Umfrage")
                        .setValue("custom")
                        .setDescription("Erstelle eine eigene Umfrage")
                )
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Umfrage-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// SPIELKALENDER-PANEL
// =====================================================

async function handleSpielkalenderPanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("🎮 Spielkalender-Panel")
        .setDescription("Plane gemeinsame Spieletermine mit Freunden.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("spielkalender_add")
                .setLabel("➕ Termin hinzufügen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("spielkalender_list")
                .setLabel("📋 Termine anzeigen")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("admin_open_gameSchedule")
                .setLabel("❗ Spielkalender Admin")
                .setStyle(ButtonStyle.Danger)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Spielkalender-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// HIGHSCORE-PANEL
// =====================================================

async function handleHighscorePanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("🏆 Highscore-Panel")
        .setDescription("Verwalte Highscores für verschiedene Spiele.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("highscore_add")
                .setLabel("➕ Highscore eintragen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("highscore_list")
                .setLabel("📋 Ranglisten anzeigen")
                .setStyle(ButtonStyle.Secondary)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Highscore-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// SPIELE-VORSCHLÄGE-PANEL
// =====================================================

async function handleSpieleVorschlaegePanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("💡 Spiele-Vorschläge-Panel")
        .setDescription("Schlage neue Spiele vor, die die Community spielen könnte.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("spiele_add")
                .setLabel("➕ Spiel vorschlagen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("spiele_list")
                .setLabel("📋 Vorschläge anzeigen")
                .setStyle(ButtonStyle.Secondary)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Spiele-Vorschläge-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// ANKÜNDIGUNGS-PANEL
// =====================================================

async function handleAnkuendigungPanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const member = isInteraction ? messageOrInteraction.member : messageOrInteraction.member;
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const replyMethod = isInteraction ? 
            (msg) => messageOrInteraction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(console.error) :
            (msg) => messageOrInteraction.reply(msg).catch(console.error);
        return replyMethod("❌ Du benötigst Administrator-Rechte für diesen Befehl.");
    }
    
    const embed = new EmbedBuilder()
        .setTitle("📢 Ankündigungs-Panel")
        .setDescription("Erstelle und versende Ankündigungen an verschiedene Kanäle.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("ankuendigung_create")
                .setLabel("📝 Ankündigung erstellen")
                .setStyle(ButtonStyle.Primary)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Ankündigungs-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// EVENT-KALENDER-PANEL
// =====================================================

async function handleEventKalenderPanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("🎉 Event-Kalender-Panel")
        .setDescription("Plane und verwalte Community-Events.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("event_add")
                .setLabel("➕ Event erstellen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("event_list")
                .setLabel("📋 Events anzeigen")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("admin_open_events")
                .setLabel("❗ Events Admin")
                .setStyle(ButtonStyle.Danger)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Event-Kalender-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// AUTO-NACHRICHTEN-PANEL
// =====================================================

async function handleAutoNachrichtenPanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const member = isInteraction ? messageOrInteraction.member : messageOrInteraction.member;
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const replyMethod = isInteraction ? 
            (msg) => messageOrInteraction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(console.error) :
            (msg) => messageOrInteraction.reply(msg).catch(console.error);
        return replyMethod("❌ Du benötigst Administrator-Rechte für diesen Befehl.");
    }
    
    const embed = new EmbedBuilder()
        .setTitle("🤖 Automatische Nachrichten")
        .setDescription("Richte automatische Nachrichten zu bestimmten Zeiten ein.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("auto_add")
                .setLabel("➕ Nachricht erstellen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("auto_list")
                .setLabel("📋 Nachrichten anzeigen")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("admin_open_autoMessages")
                .setLabel("❗ Autonachricht Admin")
                .setStyle(ButtonStyle.Danger)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Auto-Nachrichten-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// FILMABEND-PANEL
// =====================================================

async function handleFilmabendPanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("🍿 Filmabend-Panel")
        .setDescription("Plane gemeinsame Filmabende mit der Community.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("filmabend_add")
                .setLabel("➕ Filmabend planen")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("filmabend_list")
                .setLabel("📋 Filmabende anzeigen")
                .setStyle(ButtonStyle.Secondary)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Filmabend-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// BEWERTUNGS-PANEL
// =====================================================

async function handleBewertungPanel(messageOrInteraction, dataDir, db) {
    const isInteraction = typeof messageOrInteraction.isButton === "function";
    const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
    
    const embed = new EmbedBuilder()
        .setTitle("⭐ Filmbewertungs-Panel")
        .setDescription("Bewerte Filme und sieh die Bewertungen der Community.")
        .setColor(ENT_COLOR_PRIMARY);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("bewertung_add")
                .setLabel("⭐ Film bewerten")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("bewertung_list")
                .setLabel("📋 Bewertungen anzeigen")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("admin_open_ratings")
                .setLabel("❗ Bewertung Admin")
                .setStyle(ButtonStyle.Danger)
        );
    
    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    
    if (isInteraction) {
        await messageOrInteraction.reply({ content: "✅ Bewertungs-Panel wurde angezeigt!", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// BUTTON INTERACTION HANDLER
// =====================================================

async function handleButtonInteraction(interaction, dataDir, db) {
    const customId = interaction.customId;
    
    try {
        // Navigation innerhalb der einheitlichen, seitenbasierten
        // Kanal-Auswahl (◀ Zurück | Seite X/Y | Weiter ▶)
        if (customId.startsWith(CH_PAGE_PREFIX + CH_ID_SEP)) {
            await handleChannelSelectorPageButton(interaction, dataDir, db, customId);
            return;
        }
        
        // Umfrage-Voting (dynamische Custom-IDs: poll_vote_<pollId>_<optionIndex>)
        if (customId.startsWith("poll_vote_")) {
            await handlePollVote(interaction, dataDir, db);
            return;
        }
        
        // =====================================================
        // GENERISCHES PANEL-/ADMIN-SYSTEM
        // (Spielkalender, Bewertung, Events, Autonachricht)
        // =====================================================
        if (customId.startsWith("panel_post_")) {
            const { type, entryId } = parseTypeId(customId, "panel_post_");
            await showPanelPostChannelSelect(interaction, dataDir, db, type, entryId);
            return;
        }
        if (customId.startsWith("admin_open_")) {
            const { type } = parseTypeId(customId, "admin_open_");
            await showAdminEntryList(interaction, dataDir, db, type, { fresh: true });
            return;
        }
        if (customId.startsWith("admin_back_")) {
            const { type } = parseTypeId(customId, "admin_back_");
            await showAdminEntryList(interaction, dataDir, db, type, { fresh: false });
            return;
        }
        if (customId.startsWith("admin_toggle_lock_")) {
            const { type, entryId } = parseTypeId(customId, "admin_toggle_lock_");
            await handleAdminToggleLock(interaction, dataDir, db, type, entryId);
            return;
        }
        if (customId.startsWith("admin_delete_confirm_")) {
            const { type, entryId } = parseTypeId(customId, "admin_delete_confirm_");
            await handleAdminDeleteConfirm(interaction, dataDir, db, type, entryId);
            return;
        }
        if (customId.startsWith("admin_delete_cancel_")) {
            const { type, entryId } = parseTypeId(customId, "admin_delete_cancel_");
            await showAdminControlPanel(interaction, dataDir, db, type, entryId);
            return;
        }
        if (customId.startsWith("admin_delete_")) {
            const { type, entryId } = parseTypeId(customId, "admin_delete_");
            await showAdminDeleteConfirm(interaction, dataDir, db, type, entryId);
            return;
        }
        if (customId.startsWith("admin_edit_")) {
            const { type, entryId } = parseTypeId(customId, "admin_edit_");
            await showAdminEditModal(interaction, dataDir, db, type, entryId);
            return;
        }
        
        switch (customId) {
            case "setups_all":
                await setupAllPanels(interaction, dataDir, db);
                break;
            case "setups_welcome":
                await handleWelcomePanel(interaction, dataDir, db);
                break;
            case "setups_filme":
                await handleFilmPanel(interaction, dataDir, db);
                break;
            case "setups_umfrage":
                await handleUmfragePanel(interaction, dataDir, db);
                break;
            case "setups_spielkalender":
                await handleSpielkalenderPanel(interaction, dataDir, db);
                break;
            case "setups_highscores":
                await handleHighscorePanel(interaction, dataDir, db);
                break;
            case "setups_spiele":
                await handleSpieleVorschlaegePanel(interaction, dataDir, db);
                break;
            case "setups_ankuendigungen":
                await handleAnkuendigungPanel(interaction, dataDir, db);
                break;
            case "setups_events":
                await handleEventKalenderPanel(interaction, dataDir, db);
                break;
            case "setups_auto":
                await handleAutoNachrichtenPanel(interaction, dataDir, db);
                break;
            case "setups_filmabend":
                await handleFilmabendPanel(interaction, dataDir, db);
                break;
            case "setups_bewertung":
                await handleBewertungPanel(interaction, dataDir, db);
                break;
                
            // Welcome Panel Buttons
            case "welcome_setup":
                await showWelcomeSetupModal(interaction);
                break;
            case "welcome_test":
                await testWelcomeMessage(interaction, dataDir, db);
                break;
            case "welcome_image_yes":
                await handleWelcomeImageYes(interaction, dataDir, db);
                break;
            case "welcome_image_no":
                await handleWelcomeImageNo(interaction, dataDir, db);
                break;
                
            // Film Panel Buttons
            case "film_add_movie":
                await showFilmModal(interaction, "movie");
                break;
            case "film_add_series":
                await showFilmModal(interaction, "series");
                break;
            case "film_list":
                await showFilmList(interaction, dataDir, db);
                break;
                
            // Spielkalender Buttons
            case "spielkalender_add":
                await showSpielkalenderModal(interaction);
                break;
            case "spielkalender_list":
                await showSpielkalenderList(interaction, dataDir, db);
                break;
                
            // Highscore Buttons
            case "highscore_add":
                await showHighscoreModal(interaction);
                break;
            case "highscore_list":
                await showHighscoreList(interaction, dataDir, db);
                break;
                
            // Spiele Vorschläge Buttons
            case "spiele_add":
                await showSpieleVorschlagModal(interaction);
                break;
            case "spiele_list":
                await showSpieleList(interaction, dataDir, db);
                break;
                
            // Ankündigung Buttons
            case "ankuendigung_create":
                await showAnkuendigungModal(interaction);
                break;
            case "ankuendigung_skip_role":
                await handleAnkuendigungSkipRole(interaction, dataDir, db);
                break;
                
            // Event Buttons
            case "event_add":
                await showEventModal(interaction);
                break;
            case "event_list":
                await showEventList(interaction, dataDir, db);
                break;
                
            // Auto Nachrichten Buttons
            case "auto_add":
                await showAutoNachrichtModal(interaction);
                break;
            case "auto_list":
                await showAutoNachrichtList(interaction, dataDir, db);
                break;
                
            // Filmabend Buttons
            case "filmabend_add":
                await showFilmabendModal(interaction);
                break;
            case "filmabend_list":
                await showFilmabendList(interaction, dataDir, db);
                break;
                
            // Bewertung Buttons
            case "bewertung_add":
                await showBewertungModal(interaction);
                break;
            case "bewertung_list":
                await showBewertungList(interaction, dataDir, db);
                break;
                
            default:
                await interaction.reply({ content: "❌ Unbekannte Aktion", flags: MessageFlags.Ephemeral }).catch(console.error);
        }
    } catch (error) {
        console.error("❌ Fehler bei Button-Interaction:", error);
        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// SELECT MENU INTERACTION HANDLER
// =====================================================

async function handleSelectMenuInteraction(interaction, dataDir, db) {
    const customId = interaction.customId;
    const value = interaction.values[0];
    
    try {
        // Auswahl innerhalb der einheitlichen, seitenbasierten Kanal-Auswahl
        if (customId.startsWith(CH_SEL_PREFIX + CH_ID_SEP)) {
            await handleChannelSelectorPicked(interaction, dataDir, db, customId);
            return;
        }
        if (customId === "umfrage_type_select") {
            await showUmfrageModal(interaction, value);
        } else if (customId.startsWith("admin_pick_")) {
            const { type } = parseTypeId(customId, "admin_pick_");
            await showAdminControlPanel(interaction, dataDir, db, type, value);
        }
    } catch (error) {
        console.error("❌ Fehler bei SelectMenu-Interaction:", error);
        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// ROLE-SELECT INTERACTION HANDLER
// =====================================================

async function handleRoleSelectInteraction(interaction, dataDir, db) {
    const customId = interaction.customId;
    
    try {
        if (customId === "ankuendigung_role_select") {
            await handleAnkuendigungRoleSelect(interaction, dataDir, db);
        } else {
            await interaction.reply({ content: "❌ Unbekannte Rollen-Auswahl", flags: MessageFlags.Ephemeral }).catch(console.error);
        }
    } catch (error) {
        console.error("❌ Fehler bei Role-Select-Interaction:", error);
        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// MODAL SUBMIT HANDLER
// =====================================================

async function handleModalSubmit(interaction, dataDir, db) {
    const customId = interaction.customId;
    
    try {
        if (customId.startsWith("admin_edit_modal_")) {
            const { type, entryId } = parseTypeId(customId, "admin_edit_modal_");
            await handleAdminEditModalSubmit(interaction, dataDir, db, type, entryId);
            return;
        }
        
        switch (customId) {
            case "welcome_setup_modal":
                await handleWelcomeSetupSubmit(interaction, dataDir, db);
                break;
            case "film_modal":
                await handleFilmSubmit(interaction, dataDir, db);
                break;
            case "umfrage_modal":
                await handleUmfrageSubmit(interaction, dataDir, db);
                break;
            case "spielkalender_modal":
                await handleSpielkalenderSubmit(interaction, dataDir, db);
                break;
            case "highscore_modal":
                await handleHighscoreSubmit(interaction, dataDir, db);
                break;
            case "spiele_vorschlag_modal":
                await handleSpieleVorschlagSubmit(interaction, dataDir, db);
                break;
            case "ankuendigung_modal":
                await handleAnkuendigungSubmit(interaction, dataDir, db);
                break;
            case "event_modal":
                await handleEventSubmit(interaction, dataDir, db);
                break;
            case "auto_nachricht_modal":
                await handleAutoNachrichtSubmit(interaction, dataDir, db);
                break;
            case "filmabend_modal":
                await handleFilmabendSubmit(interaction, dataDir, db);
                break;
            case "bewertung_modal":
                await handleBewertungSubmit(interaction, dataDir, db);
                break;
            default:
                await interaction.reply({ content: "❌ Unbekanntes Modal", flags: MessageFlags.Ephemeral }).catch(console.error);
        }
    } catch (error) {
        console.error("❌ Fehler bei Modal-Submit:", error);
        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten", flags: MessageFlags.Ephemeral }).catch(console.error);
    }
}

// =====================================================
// MODAL FUNCTIONS
// =====================================================

async function showWelcomeSetupModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("welcome_setup_modal")
        .setTitle("Willkommensnachricht einrichten");
    
    const messageInput = new TextInputBuilder()
        .setCustomId("welcome_message")
        .setLabel("Willkommensnachricht")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Willkommen {user} auf dem Server!")
        .setRequired(true);
    
    // Der Zielkanal wird nach dem Absenden per nativer Kanal-Auswahl
    // festgelegt (siehe handleWelcomeSetupSubmit), nicht mehr per Texteingabe.
    modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
    
    await interaction.showModal(modal).catch(console.error);
}

// =====================================================
// EINHEITLICHES, SEITENBASIERTES KANAL-AUSWAHL-SYSTEM
// =====================================================
// Ersetzt das native ChannelSelectMenuBuilder (max. 25 wählbare
// Kanäle ohne Navigation) durch ein eigenes System mit
// ◀ Zurück | Seite X/Y | Weiter ▶ -Buttons, damit wirklich JEDER
// Kanal des Servers erreichbar ist, egal wie viele es gibt.
//
// Verwendung an jeder Stelle, an der bisher buildChannelSelectRow(...)
// aufgerufen wurde:
//   components: buildChannelSelectorComponents(interaction.guild, "<context>", 0)
//
// "<context>" identifiziert, WOFÜR der Kanal ausgewählt wird
// (z.B. "welcome", "ankuendigung", "auto" oder dynamisch
// "panel_post_<type>_<entryId>"). Die Auswahl/Navigation wird zentral
// in handleChannelSelectorPicked() / handleChannelSelectorPageButton()
// verarbeitet und über routeChannelSelected() an den passenden
// Handler weitergereicht.

const CH_SEL_PREFIX = "chsel";
const CH_PAGE_PREFIX = "chpg";
const CH_ID_SEP = "::";
const CHANNEL_SELECT_PAGE_SIZE = 25;

// Liefert alle Kanäle des Servers, in die eine Nachricht gesendet
// werden kann (Text-, Ankündigungs- und Sprachkanäle mit Textchat),
// sortiert nach Kategorie-Position und Name - Threads werden
// ausgeblendet, da sie für diese Einrichtungs-Dialoge nicht relevant sind.
function getSelectableGuildChannels(guild) {
    if (!guild) return [];
    return [...guild.channels.cache.values()]
        .filter(ch => typeof ch.isTextBased === "function" && ch.isTextBased() && !ch.isThread())
        .sort((a, b) => {
            const posA = typeof a.rawPosition === "number" ? a.rawPosition : 0;
            const posB = typeof b.rawPosition === "number" ? b.rawPosition : 0;
            if (a.parentId === b.parentId && posA !== posB) return posA - posB;
            return a.name.localeCompare(b.name, "de");
        });
}

function channelTypeEmoji(channel) {
    switch (channel.type) {
        case ChannelType.GuildAnnouncement: return "📢";
        case ChannelType.GuildVoice: return "🔊";
        case ChannelType.GuildStageVoice: return "🎙️";
        default: return "#";
    }
}

// Baut die Komponenten (Auswahl-Menü + Navigations-Buttons) für eine
// bestimmte Seite der Kanal-Auswahl eines bestimmten Kontexts.
function buildChannelSelectorComponents(guild, context, page) {
    const channels = getSelectableGuildChannels(guild);
    const totalPages = Math.max(1, Math.ceil(channels.length / CHANNEL_SELECT_PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const pageChannels = channels.slice(
        safePage * CHANNEL_SELECT_PAGE_SIZE,
        safePage * CHANNEL_SELECT_PAGE_SIZE + CHANNEL_SELECT_PAGE_SIZE
    );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${CH_SEL_PREFIX}${CH_ID_SEP}${context}${CH_ID_SEP}${safePage}`)
        .setPlaceholder(pageChannels.length ? "Kanal auswählen..." : "Keine Kanäle vorhanden")
        .setDisabled(pageChannels.length === 0)
        .addOptions(
            pageChannels.length
                ? pageChannels.map(ch =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${channelTypeEmoji(ch)} ${ch.name}`.slice(0, 100))
                        .setValue(ch.id)
                  )
                : [new StringSelectMenuOptionBuilder().setLabel("Keine Kanäle vorhanden").setValue("none")]
        );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${CH_PAGE_PREFIX}${CH_ID_SEP}${context}${CH_ID_SEP}${safePage}${CH_ID_SEP}prev`)
            .setLabel("◀ Zurück")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage <= 0),
        new ButtonBuilder()
            .setCustomId(`${CH_PAGE_PREFIX}${CH_ID_SEP}${context}${CH_ID_SEP}${safePage}${CH_ID_SEP}indicator`)
            .setLabel(`Seite ${safePage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`${CH_PAGE_PREFIX}${CH_ID_SEP}${context}${CH_ID_SEP}${safePage}${CH_ID_SEP}next`)
            .setLabel("Weiter ▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1)
    );

    return [new ActionRowBuilder().addComponents(selectMenu), buttonRow];
}

// Verarbeitet einen Klick auf "◀ Zurück" / "Weiter ▶" (blättert nur
// die Anzeige um, es wird noch kein Kanal übernommen).
async function handleChannelSelectorPageButton(interaction, dataDir, db, customId) {
    const rest = customId.slice((CH_PAGE_PREFIX + CH_ID_SEP).length);
    const parts = rest.split(CH_ID_SEP);
    const action = parts.pop();
    const pageStr = parts.pop();
    const context = parts.join(CH_ID_SEP);

    if (action === "indicator") {
        return interaction.deferUpdate().catch(console.error);
    }

    const currentPage = parseInt(pageStr, 10) || 0;
    const nextPage = action === "next" ? currentPage + 1 : currentPage - 1;

    const components = buildChannelSelectorComponents(interaction.guild, context, nextPage);
    await interaction.update({ components }).catch(console.error);
}

// Verarbeitet die eigentliche Kanal-Auswahl (Klick im Dropdown) und
// reicht sie an den für den Kontext zuständigen Handler weiter.
async function handleChannelSelectorPicked(interaction, dataDir, db, customId) {
    const rest = customId.slice((CH_SEL_PREFIX + CH_ID_SEP).length);
    const parts = rest.split(CH_ID_SEP);
    parts.pop(); // aktuelle Seite wird hier nicht mehr benötigt
    const context = parts.join(CH_ID_SEP);

    const channelId = interaction.values[0];
    if (!channelId || channelId === "none") {
        return interaction.deferUpdate().catch(console.error);
    }

    await routeChannelSelected(interaction, dataDir, db, context, channelId);
}

// Zentrales Routing: übergibt den ausgewählten Kanal an den
// passenden Flow (welcome / ankuendigung / auto / panel_post_*).
async function routeChannelSelected(interaction, dataDir, db, context, channelId) {
    const channel = interaction.guild?.channels.cache.get(channelId);

    if (!channel) {
        return interaction.update({
            content: "❌ Der ausgewählte Kanal wurde nicht gefunden.",
            embeds: [],
            components: []
        }).catch(console.error);
    }

    if (context.startsWith("panel_post_")) {
        const { type, entryId } = parseTypeId(context, "panel_post_");
        return handlePanelPostChannelSelect(interaction, dataDir, db, type, entryId, channel);
    }

    switch (context) {
        case "welcome":
            return handleWelcomeChannelSelect(interaction, dataDir, db, channel);
        case "ankuendigung":
            return handleAnkuendigungChannelSelect(interaction, dataDir, db, channel);
        case "auto":
            return handleAutoChannelSelect(interaction, dataDir, db, channel);
        default:
            return interaction.update({
                content: "❌ Unbekannte Kanal-Auswahl",
                embeds: [],
                components: []
            }).catch(console.error);
    }
}

async function showFilmModal(interaction, type) {
    const title = type === "movie" ? "Film vorschlagen" : "Serie vorschlagen";
    const modal = new ModalBuilder()
        .setCustomId("film_modal")
        .setTitle(title);
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("film_type")
                .setLabel("Typ")
                .setStyle(TextInputStyle.Short)
                .setValue(type)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("film_name")
                .setLabel("Name")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("film_genre")
                .setLabel("Genre")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("film_description")
                .setLabel("Beschreibung")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
        )
    );
    
    if (type === "movie") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("film_duration")
                    .setLabel("Länge (Minuten)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );
    } else {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("film_seasons")
                    .setLabel("Staffeln/Folgen")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );
    }
    
    await interaction.showModal(modal).catch(console.error);
}

async function showUmfrageModal(interaction, type) {
    const modal = new ModalBuilder()
        .setCustomId("umfrage_modal")
        .setTitle("Umfrage erstellen");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("umfrage_type")
                .setLabel("Typ")
                .setStyle(TextInputStyle.Short)
                .setValue(type)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("umfrage_question")
                .setLabel("Frage")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("umfrage_options")
                .setLabel("Antwortmöglichkeiten (mit Komma getrennt)")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Option 1, Option 2, Option 3")
                .setRequired(true)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showSpielkalenderModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("spielkalender_modal")
        .setTitle("Spieltermin hinzufügen");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiel_game")
                .setLabel("Spiel")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiel_datetime")
                .setLabel("Datum & Zeit (optional Ende mit ' - ')")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("07.08.2026 19:00 - 08.08.2026 22:00")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiel_players_info")
                .setLabel("Spieler & Infos")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Spieler: Mika, Lion, Niklas\nInfos: Voice Channel 3")
                .setRequired(false)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showHighscoreModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("highscore_modal")
        .setTitle("Highscore eintragen");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("highscore_game")
                .setLabel("Spiel")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("highscore_player")
                .setLabel("Spieler")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("highscore_score")
                .setLabel("Punkte")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showSpieleVorschlagModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("spiele_vorschlag_modal")
        .setTitle("Spiel vorschlagen");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiele_name")
                .setLabel("Spielname")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiele_link")
                .setLabel("Steam-Link")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiele_price")
                .setLabel("Preis")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiele_release")
                .setLabel("Release-Datum (DD.MM.YYYY oder 'erschienen')")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showAnkuendigungModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("ankuendigung_modal")
        .setTitle("Ankündigung erstellen");
    
    // Zielkanal und optionale Rolle werden im Anschluss per nativer
    // Discord-Auswahl festgelegt (siehe handleAnkuendigungSubmit).
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("ankuendigung_message")
                .setLabel("Nachricht")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showEventModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("event_modal")
        .setTitle("Event erstellen");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_name")
                .setLabel("Eventname")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_date")
                .setLabel("Datum (DD.MM.YYYY)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_time")
                .setLabel("Uhrzeit (HH:MM)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_location")
                .setLabel("Ort/Kanal")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_description")
                .setLabel("Beschreibung")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showAutoNachrichtModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("auto_nachricht_modal")
        .setTitle("Automatische Nachricht erstellen");
    
    // Der Zielkanal wird im Anschluss per nativer Kanal-Auswahl festgelegt
    // (siehe handleAutoNachrichtSubmit), nicht mehr per Texteingabe.
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("auto_message")
                .setLabel("Nachricht")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("auto_time")
                .setLabel("Zeitpunkt (HH:MM oder Intervall)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showFilmabendModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("filmabend_modal")
        .setTitle("Filmabend planen");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("filmabend_name")
                .setLabel("Filmname")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("filmabend_genre")
                .setLabel("Genre")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("filmabend_duration")
                .setLabel("Länge (Minuten)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("filmabend_datetime")
                .setLabel("Datum & Zeit (DD.MM.YYYY HH:MM)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("27.09.2026 19:00")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("filmabend_participants")
                .setLabel("Teilnehmer & Beschreibung")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Teilnehmer: Mika, Lion, Niklas\nBeschreibung: Snacks mitbringen")
                .setRequired(false)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

async function showBewertungModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("bewertung_modal")
        .setTitle("Film bewerten");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("bewertung_name")
                .setLabel("Filmname")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("bewertung_genre")
                .setLabel("Genre")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("bewertung_stars")
                .setLabel("Bewertung (1-5)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("5")
                .setRequired(true)
        )
    );
    
    await interaction.showModal(modal).catch(console.error);
}

// =====================================================
// SUBMIT HANDLERS
// =====================================================

async function handleWelcomeSetupSubmit(interaction, dataDir, db) {
    const message = interaction.fields.getTextInputValue("welcome_message");
    
    setPending(`welcome_${interaction.user.id}`, { message });
    
    await interaction.reply({
        content: "📍 Wähle jetzt den Kanal für die Willkommensnachricht aus:",
        components: buildChannelSelectorComponents(interaction.guild, "welcome", 0),
        flags: MessageFlags.Ephemeral
    }).catch(console.error);
}

async function handleWelcomeChannelSelect(interaction, dataDir, db, channel) {
    const key = `welcome_${interaction.user.id}`;
    const pending = getPending(key);
    
    if (!pending) {
        return interaction.update({
            content: "❌ Diese Einrichtung ist abgelaufen. Bitte starte `!willkommen-panel` erneut.",
            components: []
        }).catch(console.error);
    }
    
    setPending(key, { ...pending, channelId: channel.id });
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("welcome_image_yes")
            .setLabel("✅ Ja")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("welcome_image_no")
            .setLabel("❌ Nein")
            .setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({
        content: `📍 Kanal: ${channel}\n🖼️ Möchtest du ein eigenes Bild für die Willkommensnachricht hinzufügen?`,
        components: [row]
    }).catch(console.error);
}

async function handleWelcomeImageNo(interaction, dataDir, db) {
    const key = `welcome_${interaction.user.id}`;
    const pending = getPending(key);
    
    if (!pending || !pending.channelId) {
        return interaction.update({
            content: "❌ Diese Einrichtung ist abgelaufen. Bitte starte `!willkommen-panel` erneut.",
            components: []
        }).catch(console.error);
    }
    
    saveWelcomeConfig(dataDir, db, interaction.guildId, pending.message, pending.channelId, null);
    clearPending(key);
    
    await interaction.update({
        content: `✅ Willkommensnachricht wurde eingerichtet! Kanal: <#${pending.channelId}> (ohne eigenes Bild)`,
        components: []
    }).catch(console.error);
}

async function handleWelcomeImageYes(interaction, dataDir, db) {
    const key = `welcome_${interaction.user.id}`;
    const pending = getPending(key);
    
    if (!pending || !pending.channelId) {
        return interaction.update({
            content: "❌ Diese Einrichtung ist abgelaufen. Bitte starte `!willkommen-panel` erneut.",
            components: []
        }).catch(console.error);
    }
    
    // Setup-Daten auf einen eigenen Schlüssel umziehen, damit der spätere
    // Bild-Upload (ein normales messageCreate-Event) sie wiederfinden kann.
    setPending(`welcomeImageUpload_${interaction.guildId}_${interaction.user.id}`, {
        message: pending.message,
        channelId: pending.channelId,
        uploadChannelId: interaction.channelId
    });
    clearPending(key);
    
    await interaction.update({
        content: `📤 Bitte lade jetzt hier in diesem Kanal (<#${interaction.channelId}>) das gewünschte Bild hoch (als normaler Bild-Anhang). Ich erkenne es automatisch und speichere es als festes Willkommensbild.`,
        components: []
    }).catch(console.error);
}

function saveWelcomeConfig(dataDir, db, guildId, message, channelId, imageFilename) {
    db.welcome[guildId] = {
        message: message,
        channel: channelId,
        mention: message.includes("{user}"),
        image: imageFilename || null
    };
    saveDatabase(dataDir, db);
}

async function handlePendingWelcomeImageUpload(message, dataDir, db) {
    if (!message.guildId) return;
    
    const key = `welcomeImageUpload_${message.guildId}_${message.author.id}`;
    const pending = getPending(key);
    
    if (!pending) return;
    if (message.channel.id !== (pending.uploadChannelId || pending.channelId)) return;
    if (message.attachments.size === 0) return;
    
    const attachment = message.attachments.find(a => (a.contentType || "").startsWith("image/"))
        || message.attachments.find(a => /\.(png|jpe?g|gif|webp)$/i.test(a.name || a.url));
    
    if (!attachment) {
        return message.reply("❌ Das war keine Bilddatei. Bitte lade ein Bild (PNG, JPG, GIF oder WebP) hoch.").catch(console.error);
    }
    
    const ext = path.extname(attachment.name || new URL(attachment.url).pathname) || ".png";
    const filename = `welcome-${message.guildId}${ext}`;
    const imagesDir = getWelcomeImagesDir(dataDir);
    const destPath = path.join(imagesDir, filename);
    
    try {
        await downloadImage(attachment.url, destPath);
    } catch (error) {
        console.error("❌ Willkommensbild konnte nicht gespeichert werden:", error);
        return message.reply("❌ Das Bild konnte nicht gespeichert werden. Bitte versuche es erneut.").catch(console.error);
    }
    
    saveWelcomeConfig(dataDir, db, message.guildId, pending.message, pending.channelId, filename);
    clearPending(key);
    
    await message.reply("✅ Willkommensbild wurde gespeichert! Es wird ab sofort automatisch bei jeder neuen Willkommensnachricht verwendet.").catch(console.error);
}

function buildWelcomeEmbed(welcomeConfig, member, client, dataDir) {
    const description = renderWelcomeMessage(welcomeConfig, member);
    
    const embed = new EmbedBuilder()
        .setColor(ENT_COLOR_PRIMARY)
        .setDescription(description)
        .setThumbnail(client.user.displayAvatarURL({ size: 256 }));
    
    const files = [];
    
    if (welcomeConfig.image) {
        const imagePath = path.join(getWelcomeImagesDir(dataDir), welcomeConfig.image);
        if (fs.existsSync(imagePath)) {
            files.push(new AttachmentBuilder(imagePath, { name: welcomeConfig.image }));
            embed.setImage(`attachment://${welcomeConfig.image}`);
        }
    }
    
    return { embeds: [embed], files };
}

async function handleFilmSubmit(interaction, dataDir, db) {
    const type = interaction.fields.getTextInputValue("film_type");
    const name = interaction.fields.getTextInputValue("film_name");
    const genre = interaction.fields.getTextInputValue("film_genre");
    const description = interaction.fields.getTextInputValue("film_description");
    
    const entry = {
        id: generateId(),
        type: type,
        name: name,
        genre: genre,
        description: description,
        suggestedBy: interaction.user.id,
        suggestedByName: interaction.user.username,
        createdAt: new Date().toISOString()
    };
    
    if (type === "movie") {
        entry.duration = interaction.fields.getTextInputValue("film_duration");
        db.movies.push(entry);
    } else {
        entry.seasons = interaction.fields.getTextInputValue("film_seasons");
        db.series.push(entry);
    }
    
    saveDatabase(dataDir, db);
    
    await interaction.reply(successReply(`${type === "movie" ? "Film" : "Serie"} wurde vorgeschlagen!`)).catch(console.error);
}

async function handleUmfrageSubmit(interaction, dataDir, db) {
    const type = interaction.fields.getTextInputValue("umfrage_type");
    const question = interaction.fields.getTextInputValue("umfrage_question");
    const options = interaction.fields.getTextInputValue("umfrage_options").split(",").map(o => o.trim());
    
    const poll = {
        id: generateId(),
        type: type,
        question: question,
        options: options,
        votes: {},
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
    };
    
    db.polls.push(poll);
    saveDatabase(dataDir, db);
    
    // Create poll message
    const embed = new EmbedBuilder()
        .setTitle(`📊 ${type.charAt(0).toUpperCase() + type.slice(1)}-Umfrage`)
        .setDescription(question)
        .setColor(ENT_COLOR_PRIMARY);
    
    options.forEach((option, index) => {
        embed.addFields({ name: `${index + 1}. ${option}`, value: "0 Stimmen", inline: true });
    });
    
    const row = new ActionRowBuilder();
    options.forEach((option, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`poll_vote_${poll.id}_${index}`)
                .setLabel(`${index + 1}`)
                .setStyle(ButtonStyle.Primary)
        );
    });
    
    await interaction.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    await interaction.reply(successReply("Umfrage wurde erstellt!")).catch(console.error);
}

async function handlePollVote(interaction, dataDir, db) {
    // customId Format: poll_vote_<pollId>_<optionIndex>
    const parts = interaction.customId.split("_");
    const optionIndex = parseInt(parts[parts.length - 1]);
    const pollId = parts.slice(2, parts.length - 1).join("_");
    
    const poll = db.polls.find(p => p.id === pollId);
    
    if (!poll) {
        return interaction.reply(errorReply("Diese Umfrage existiert nicht mehr.")).catch(console.error);
    }
    
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
        return interaction.reply(errorReply("Ungültige Option.")).catch(console.error);
    }
    
    const userId = interaction.user.id;
    const previousVote = poll.votes[userId];
    
    if (previousVote === optionIndex) {
        return interaction.reply(errorReply("Du hast bereits für diese Option gestimmt.")).catch(console.error);
    }
    
    // Stimme setzen (überschreibt eine evtl. vorherige Stimme des Users)
    poll.votes[userId] = optionIndex;
    saveDatabase(dataDir, db);
    
    // Stimmen pro Option zählen
    const counts = new Array(poll.options.length).fill(0);
    Object.values(poll.votes).forEach(idx => {
        if (idx >= 0 && idx < counts.length) counts[idx]++;
    });
    
    // Embed mit aktualisierten Stimmenzahlen neu aufbauen
    const embed = new EmbedBuilder()
        .setTitle(`📊 ${poll.type.charAt(0).toUpperCase() + poll.type.slice(1)}-Umfrage`)
        .setDescription(poll.question)
        .setColor(ENT_COLOR_PRIMARY);
    
    poll.options.forEach((option, index) => {
        embed.addFields({ name: `${index + 1}. ${option}`, value: `${counts[index]} Stimme(n)`, inline: true });
    });
    
    await interaction.update({ embeds: [embed] }).catch(async (error) => {
        console.error("❌ Fehler beim Aktualisieren der Umfrage:", error);
        await interaction.reply(errorReply("Stimme gespeichert, Anzeige konnte aber nicht aktualisiert werden.")).catch(console.error);
    });
}

async function handleSpielkalenderSubmit(interaction, dataDir, db) {
    const { game, date, time, endDate, endTime, players, info } = parseSpielFields(interaction.fields);
    
    const entry = {
        id: generateId(),
        game: game,
        date: date,
        time: time,
        endDate: endDate,
        endTime: endTime,
        players: players,
        info: info,
        locked: false,
        panelChannelId: null,
        panelMessageId: null,
        guildId: interaction.guildId,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
    };
    
    db.gameSchedule.push(entry);
    saveDatabase(dataDir, db);
    
    await interaction.reply({
        content: "✅ Spieltermin wurde hinzugefügt! Möchtest du das Termin-Panel jetzt in einem Kanal für alle sichtbar posten?",
        embeds: [buildGameScheduleEmbed(entry)],
        components: [buildPostButtonRow("gameSchedule", entry.id)],
        flags: MessageFlags.Ephemeral
    }).catch(console.error);
}

async function handleHighscoreSubmit(interaction, dataDir, db) {
    const game = interaction.fields.getTextInputValue("highscore_game");
    const player = interaction.fields.getTextInputValue("highscore_player");
    const score = parseInt(interaction.fields.getTextInputValue("highscore_score"));
    
    const entry = {
        id: generateId(),
        game: game,
        player: player,
        score: score,
        submittedBy: interaction.user.id,
        submittedAt: new Date().toISOString()
    };
    
    db.highscores.push(entry);
    saveDatabase(dataDir, db);
    
    await interaction.reply(successReply("Highscore wurde eingetragen!")).catch(console.error);
}

async function handleSpieleVorschlagSubmit(interaction, dataDir, db) {
    const name = interaction.fields.getTextInputValue("spiele_name");
    const link = interaction.fields.getTextInputValue("spiele_link");
    const price = interaction.fields.getTextInputValue("spiele_price");
    const release = interaction.fields.getTextInputValue("spiele_release");
    
    const entry = {
        id: generateId(),
        name: name,
        link: link,
        price: price,
        release: release,
        released: release.toLowerCase() === "erschienen",
        suggestedBy: interaction.user.id,
        suggestedByName: interaction.user.username,
        createdAt: new Date().toISOString()
    };
    
    db.gameSuggestions.push(entry);
    saveDatabase(dataDir, db);
    
    await interaction.reply(successReply("Spielvorschlag wurde hinzugefügt!")).catch(console.error);
}

async function handleAnkuendigungSubmit(interaction, dataDir, db) {
    const message = interaction.fields.getTextInputValue("ankuendigung_message");
    
    setPending(`ankuendigung_${interaction.user.id}`, { message });
    
    await interaction.reply({
        content: "📍 Wähle jetzt den Zielkanal für die Ankündigung aus:",
        components: buildChannelSelectorComponents(interaction.guild, "ankuendigung", 0),
        flags: MessageFlags.Ephemeral
    }).catch(console.error);
}

async function handleAnkuendigungChannelSelect(interaction, dataDir, db, channel) {
    const key = `ankuendigung_${interaction.user.id}`;
    const pending = getPending(key);
    
    if (!pending) {
        return interaction.update({
            content: "❌ Diese Einrichtung ist abgelaufen. Bitte starte die Ankündigung erneut.",
            components: []
        }).catch(console.error);
    }
    
    setPending(key, { ...pending, channelId: channel.id });
    
    const roleRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId("ankuendigung_role_select")
            .setPlaceholder("Rolle erwähnen (optional)")
    );
    const skipRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ankuendigung_skip_role")
            .setLabel("➡️ Ohne Rolle senden")
            .setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({
        content: `📍 Kanal: ${channel}\nMöchtest du eine Rolle erwähnen?`,
        components: [roleRow, skipRow]
    }).catch(console.error);
}

async function handleAnkuendigungRoleSelect(interaction, dataDir, db) {
    const role = interaction.roles.first();
    await finalizeAnkuendigung(interaction, dataDir, db, role ? role.id : null);
}

async function handleAnkuendigungSkipRole(interaction, dataDir, db) {
    await finalizeAnkuendigung(interaction, dataDir, db, null);
}

async function finalizeAnkuendigung(interaction, dataDir, db, roleId) {
    const key = `ankuendigung_${interaction.user.id}`;
    const pending = getPending(key);
    
    if (!pending || !pending.channelId) {
        return interaction.update({
            content: "❌ Diese Einrichtung ist abgelaufen. Bitte starte die Ankündigung erneut.",
            components: []
        }).catch(console.error);
    }
    
    const targetChannel = interaction.guild.channels.cache.get(pending.channelId);
    
    if (!targetChannel) {
        clearPending(key);
        return interaction.update({
            content: "❌ Der ausgewählte Kanal wurde nicht gefunden.",
            components: []
        }).catch(console.error);
    }
    
    const finalMessage = roleId ? `<@&${roleId}> ${pending.message}` : pending.message;
    await targetChannel.send(finalMessage).catch(console.error);
    clearPending(key);
    
    await interaction.update({
        content: `✅ Ankündigung wurde in ${targetChannel} gesendet!`,
        components: []
    }).catch(console.error);
}

async function handleEventSubmit(interaction, dataDir, db) {
    const { name, date, time, location, description } = parseEventFields(interaction.fields);
    
    const entry = {
        id: generateId(),
        name: name,
        date: date,
        time: time,
        location: location,
        description: description,
        locked: false,
        panelChannelId: null,
        panelMessageId: null,
        guildId: interaction.guildId,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
    };
    
    db.events.push(entry);
    saveDatabase(dataDir, db);
    
    await interaction.reply({
        content: "✅ Event wurde erstellt! Möchtest du das Event-Panel jetzt in einem Kanal für alle sichtbar posten?",
        embeds: [buildEventEmbed(entry)],
        components: [buildPostButtonRow("events", entry.id)],
        flags: MessageFlags.Ephemeral
    }).catch(console.error);
}

async function handleAutoNachrichtSubmit(interaction, dataDir, db) {
    const message = interaction.fields.getTextInputValue("auto_message");
    const time = interaction.fields.getTextInputValue("auto_time");
    
    setPending(`auto_${interaction.user.id}`, { message, time });
    
    await interaction.reply({
        content: "📍 Wähle jetzt den Zielkanal für die automatische Nachricht aus:",
        components: buildChannelSelectorComponents(interaction.guild, "auto", 0),
        flags: MessageFlags.Ephemeral
    }).catch(console.error);
}

async function handleAutoChannelSelect(interaction, dataDir, db, channel) {
    const key = `auto_${interaction.user.id}`;
    const pending = getPending(key);
    
    if (!pending) {
        return interaction.update({
            content: "❌ Diese Einrichtung ist abgelaufen. Bitte starte die Einrichtung erneut.",
            components: []
        }).catch(console.error);
    }
    
    const entry = {
        id: generateId(),
        message: pending.message,
        channel: channel.id,
        time: pending.time,
        active: true,
        panelChannelId: null,
        panelMessageId: null,
        guildId: interaction.guildId,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
    };
    
    db.autoMessages.push(entry);
    saveDatabase(dataDir, db);
    clearPending(key);
    
    await interaction.update({
        content: `✅ Automatische Nachricht wurde eingerichtet! Kanal: ${channel}\nMöchtest du das Status-Panel jetzt für alle sichtbar posten?`,
        embeds: [buildAutoNachrichtEmbed(entry)],
        components: [buildPostButtonRow("autoMessages", entry.id)]
    }).catch(console.error);
}

async function handleFilmabendSubmit(interaction, dataDir, db) {
    const name = interaction.fields.getTextInputValue("filmabend_name");
    const genre = interaction.fields.getTextInputValue("filmabend_genre");
    const duration = interaction.fields.getTextInputValue("filmabend_duration");
    const datetime = interaction.fields.getTextInputValue("filmabend_datetime");
    const participantsDesc = interaction.fields.getTextInputValue("filmabend_participants");
    
    // Parse datetime (expected format: DD.MM.YYYY HH:MM)
    const datetimeParts = datetime.split(" ");
    const date = datetimeParts[0] || "";
    const time = datetimeParts[1] || "";
    
    // Parse participants and description from combined field
    let participants = [];
    let description = "";
    
    if (participantsDesc) {
        const lines = participantsDesc.split("\n");
        lines.forEach(line => {
            if (line.toLowerCase().startsWith("teilnehmer:") || line.toLowerCase().startsWith("participants:")) {
                const participantsText = line.split(":")[1].trim();
                participants = participantsText ? participantsText.split(",").map(p => p.trim()) : [];
            } else if (line.toLowerCase().startsWith("beschreibung:") || line.toLowerCase().startsWith("description:")) {
                description = line.split(":")[1].trim();
            } else if (!line.includes(":")) {
                // If no prefix, treat as participants
                participants = line ? line.split(",").map(p => p.trim()) : [];
            }
        });
    }
    
    const entry = {
        id: generateId(),
        name: name,
        genre: genre,
        duration: duration,
        date: date,
        time: time,
        participants: participants,
        description: description,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
    };
    
    db.movieNights.push(entry);
    saveDatabase(dataDir, db);
    
    await interaction.reply(successReply("Filmabend wurde geplant!")).catch(console.error);
}

async function handleBewertungSubmit(interaction, dataDir, db) {
    const name = interaction.fields.getTextInputValue("bewertung_name");
    const genre = interaction.fields.getTextInputValue("bewertung_genre");
    const stars = parseInt(interaction.fields.getTextInputValue("bewertung_stars"));
    
    if (isNaN(stars) || stars < 1 || stars > 5) {
        return interaction.reply(errorReply("Bewertung muss zwischen 1 und 5 liegen")).catch(console.error);
    }
    
    const entry = {
        id: generateId(),
        name: name,
        genre: genre,
        stars: stars,
        ratedBy: interaction.user.id,
        ratedByName: interaction.user.username,
        ratedAt: new Date().toISOString(),
        locked: false,
        panelChannelId: null,
        panelMessageId: null,
        guildId: interaction.guildId
    };
    
    db.ratings.push(entry);
    saveDatabase(dataDir, db);
    
    await interaction.reply({
        content: "✅ Bewertung wurde gespeichert! Möchtest du das Bewertungs-Panel jetzt in einem Kanal für alle sichtbar posten?",
        embeds: [buildBewertungEmbed(entry)],
        components: [buildPostButtonRow("ratings", entry.id)],
        flags: MessageFlags.Ephemeral
    }).catch(console.error);
}

// =====================================================
// LIST FUNCTIONS
// =====================================================

async function showFilmList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("🎬 Filme & Serien")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.movies.length === 0 && db.series.length === 0) {
        embed.setDescription("Noch keine Filme oder Serien vorgeschlagen.");
    } else {
        let description = "";
        
        if (db.movies.length > 0) {
            description += "**Filme:**\n";
            db.movies.slice(0, 10).forEach(movie => {
                description += `• ${movie.name} (${movie.genre})\n`;
            });
        }
        
        if (db.series.length > 0) {
            description += "\n**Serien:**\n";
            db.series.slice(0, 10).forEach(series => {
                description += `• ${series.name} (${series.genre})\n`;
            });
        }
        
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function showSpielkalenderList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("🎮 Spielkalender")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.gameSchedule.length === 0) {
        embed.setDescription("Noch keine Spieltermine geplant.");
    } else {
        let description = "";
        db.gameSchedule.slice(0, 10).forEach(entry => {
            description += `**${entry.game}**\n📅 ${entry.date} um ${entry.time}\n`;
            if (entry.players.length > 0) {
                description += `👥 ${entry.players.join(", ")}\n`;
            }
            description += "\n";
        });
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function showHighscoreList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("🏆 Highscores")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.highscores.length === 0) {
        embed.setDescription("Noch keine Highscores eingetragen.");
    } else {
        // Group by game
        const games = {};
        db.highscores.forEach(entry => {
            if (!games[entry.game]) {
                games[entry.game] = [];
            }
            games[entry.game].push(entry);
        });
        
        let description = "";
        Object.keys(games).forEach(game => {
            const sorted = games[game].sort((a, b) => b.score - a.score);
            description += `**${game}**\n`;
            sorted.slice(0, 3).forEach((entry, index) => {
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
                description += `${medal} ${entry.player} – ${entry.score.toLocaleString()} Punkte\n`;
            });
            description += "\n";
        });
        
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function showSpieleList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("💡 Spiele-Vorschläge")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.gameSuggestions.length === 0) {
        embed.setDescription("Noch keine Spiele vorgeschlagen.");
    } else {
        let description = "";
        db.gameSuggestions.slice(0, 10).forEach(entry => {
            const releaseStatus = entry.released ? "✅ Bereits erschienen" : `📅 Release: ${entry.release}`;
            description += `**${entry.name}**\n💰 ${entry.price}\n${releaseStatus}\n🔗 ${entry.link}\n\n`;
        });
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function showEventList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("🎉 Event-Kalender")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.events.length === 0) {
        embed.setDescription("Noch keine Events geplant.");
    } else {
        let description = "";
        db.events.slice(0, 10).forEach(entry => {
            description += `**${entry.name}**\n📅 ${entry.date} um ${entry.time}\n📍 ${entry.location}\n\n`;
        });
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function showAutoNachrichtList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("🤖 Automatische Nachrichten")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.autoMessages.length === 0) {
        embed.setDescription("Noch keine automatischen Nachrichten eingerichtet.");
    } else {
        let description = "";
        db.autoMessages.forEach(entry => {
            const status = entry.active ? "✅ Aktiv" : "❌ Inaktiv";
            description += `**${entry.message.substring(0, 30)}...**\n⏰ ${entry.time} | ${status}\n📁 <#${entry.channel}>\n\n`;
        });
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function showFilmabendList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("🍿 Filmabende")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.movieNights.length === 0) {
        embed.setDescription("Noch keine Filmabende geplant.");
    } else {
        let description = "";
        db.movieNights.slice(0, 10).forEach(entry => {
            description += `**${entry.name}** (${entry.genre})\n📅 ${entry.date} um ${entry.time}\n⏱️ ${entry.duration} Min\n`;
            if (entry.participants.length > 0) {
                description += `👥 ${entry.participants.join(", ")}\n`;
            }
            description += "\n";
        });
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function showBewertungList(interaction, dataDir, db) {
    const embed = new EmbedBuilder()
        .setTitle("⭐ Filmbewertungen")
        .setColor(ENT_COLOR_PRIMARY);
    
    if (db.ratings.length === 0) {
        embed.setDescription("Noch keine Bewertungen vorhanden.");
    } else {
        let description = "";
        db.ratings.slice(0, 10).forEach(entry => {
            const starString = "⭐".repeat(entry.stars);
            description += `**${entry.name}** (${entry.genre})\n${starString} (${entry.stars}/5) - von ${entry.ratedByName}\n\n`;
        });
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(console.error);
}

async function testWelcomeMessage(interaction, dataDir, db) {
    const guildId = interaction.guildId;
    const welcomeConfig = db.welcome[guildId];
    
    if (!welcomeConfig) {
        return interaction.reply(errorReply("Willkommensnachricht ist noch nicht eingerichtet")).catch(console.error);
    }
    
    const { embeds, files } = buildWelcomeEmbed(welcomeConfig, interaction.member, interaction.client, dataDir);
    
    await interaction.reply({ embeds, files, flags: MessageFlags.Ephemeral }).catch(console.error);
}

// =====================================================
// SPIELKALENDER – PARSE-/BUILD-HILFSFUNKTIONEN
// =====================================================

// Erlaubt sowohl "27.09.2026 19:00" als auch einen Zeitraum
// "07.08.2026 19:00 - 08.08.2026 22:00" (Ende optional).
function parseSpielDatumZeit(raw) {
    const parts = (raw || "").split("-").map(p => p.trim()).filter(Boolean);
    const startParts = (parts[0] || "").split(" ").filter(Boolean);
    const date = startParts[0] || "";
    const time = startParts[1] || "";
    let endDate = null;
    let endTime = null;
    
    if (parts[1]) {
        const endParts = parts[1].split(" ").filter(Boolean);
        if (endParts.length >= 2) {
            endDate = endParts[0];
            endTime = endParts[1];
        } else if (endParts.length === 1) {
            if (endParts[0].includes(":")) {
                endDate = date;
                endTime = endParts[0];
            } else {
                endDate = endParts[0];
                endTime = time || null;
            }
        }
    }
    
    return { date, time, endDate, endTime };
}

function parseSpielFields(fields) {
    const game = fields.getTextInputValue("spiel_game");
    const datetime = fields.getTextInputValue("spiel_datetime");
    const playersInfo = fields.getTextInputValue("spiel_players_info");
    
    const { date, time, endDate, endTime } = parseSpielDatumZeit(datetime);
    
    let players = [];
    let info = "";
    
    if (playersInfo) {
        const lines = playersInfo.split("\n");
        lines.forEach(line => {
            if (line.toLowerCase().startsWith("spieler:") || line.toLowerCase().startsWith("players:")) {
                const playersText = line.split(":").slice(1).join(":").trim();
                players = playersText ? playersText.split(",").map(p => p.trim()).filter(Boolean) : [];
            } else if (line.toLowerCase().startsWith("infos:") || line.toLowerCase().startsWith("info:")) {
                info = line.split(":").slice(1).join(":").trim();
            } else if (!line.includes(":") && line.trim()) {
                players = line.split(",").map(p => p.trim()).filter(Boolean);
            }
        });
    }
    
    return { game, date, time, endDate, endTime, players, info };
}

function formatSpielDatumZeitValue(entry) {
    let value = `${entry.date || ""} ${entry.time || ""}`.trim();
    if (entry.endDate || entry.endTime) {
        value += ` - ${entry.endDate || entry.date || ""} ${entry.endTime || entry.time || ""}`.trim();
    }
    return value;
}

function formatSpielPlayersInfoValue(entry) {
    const lines = [`Spieler: ${(entry.players || []).join(", ")}`];
    if (entry.info) lines.push(`Infos: ${entry.info}`);
    return lines.join("\n");
}

function buildGameScheduleEmbed(entry) {
    const locked = !!entry.locked;
    let zeitraum = `📅 ${entry.date || "–"}`;
    if (entry.endDate && entry.endDate !== entry.date) zeitraum += ` – ${entry.endDate}`;
    zeitraum += `\n🕐 ${entry.time || "–"}`;
    if (entry.endTime) zeitraum += ` – ${entry.endTime}`;
    zeitraum += " Uhr";
    
    const embed = new EmbedBuilder()
        .setTitle(`🎮 ${entry.game}`)
        .setColor(locked ? ENT_COLOR_DANGER : ENT_COLOR_PRIMARY)
        .addFields(
            { name: "Termin", value: zeitraum, inline: false },
            { name: "👥 Teilnehmer", value: (entry.players && entry.players.length) ? entry.players.join(", ") : "_Noch keine Teilnehmer_", inline: false }
        )
        .setFooter({ text: `Termin-ID: ${entry.id}` });
    
    if (entry.info) embed.addFields({ name: "📝 Info", value: entry.info, inline: false });
    if (locked) embed.setDescription("🔒 **Dieser Termin wurde vom Bot-Owner gesperrt.**");
    
    return embed;
}

function buildSpielEditModal(entry) {
    const modal = new ModalBuilder()
        .setCustomId(`admin_edit_modal_gameSchedule_${entry.id}`)
        .setTitle("Termin bearbeiten");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiel_game")
                .setLabel("Spiel")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.game || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiel_datetime")
                .setLabel("Datum & Zeit (optional Ende mit ' - ')")
                .setStyle(TextInputStyle.Short)
                .setValue(formatSpielDatumZeitValue(entry))
                .setPlaceholder("07.08.2026 19:00 - 08.08.2026 22:00")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("spiel_players_info")
                .setLabel("Spieler & Infos")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(formatSpielPlayersInfoValue(entry))
                .setRequired(false)
        )
    );
    
    return modal;
}

// =====================================================
// BEWERTUNG – PARSE-/BUILD-HILFSFUNKTIONEN
// =====================================================

function parseBewertungFields(fields) {
    const name = fields.getTextInputValue("bewertung_name");
    const genre = fields.getTextInputValue("bewertung_genre");
    let stars = parseInt(fields.getTextInputValue("bewertung_stars"));
    if (isNaN(stars)) stars = 1;
    stars = Math.min(5, Math.max(1, stars));
    return { name, genre, stars };
}

function buildBewertungEmbed(entry) {
    const locked = !!entry.locked;
    const starString = "⭐".repeat(entry.stars) + "☆".repeat(Math.max(0, 5 - entry.stars));
    
    const embed = new EmbedBuilder()
        .setTitle(`⭐ ${entry.name}`)
        .setColor(locked ? ENT_COLOR_DANGER : ENT_COLOR_PRIMARY)
        .addFields(
            { name: "Genre", value: entry.genre || "–", inline: true },
            { name: "Bewertung", value: `${starString} (${entry.stars}/5)`, inline: true }
        )
        .setFooter({ text: `Bewertung-ID: ${entry.id}` });
    
    if (entry.ratedByName) embed.addFields({ name: "Bewertet von", value: entry.ratedByName, inline: true });
    if (locked) embed.setDescription("🔒 **Diese Bewertung wurde vom Bot-Owner gesperrt.**");
    
    return embed;
}

function buildBewertungEditModal(entry) {
    const modal = new ModalBuilder()
        .setCustomId(`admin_edit_modal_ratings_${entry.id}`)
        .setTitle("Bewertung bearbeiten");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("bewertung_name")
                .setLabel("Filmname")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.name || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("bewertung_genre")
                .setLabel("Genre")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.genre || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("bewertung_stars")
                .setLabel("Bewertung (1-5)")
                .setStyle(TextInputStyle.Short)
                .setValue(String(entry.stars || 1))
                .setRequired(true)
        )
    );
    
    return modal;
}

// =====================================================
// EVENTS – PARSE-/BUILD-HILFSFUNKTIONEN
// =====================================================

function parseEventFields(fields) {
    return {
        name: fields.getTextInputValue("event_name"),
        date: fields.getTextInputValue("event_date"),
        time: fields.getTextInputValue("event_time"),
        location: fields.getTextInputValue("event_location"),
        description: fields.getTextInputValue("event_description")
    };
}

function buildEventEmbed(entry) {
    const locked = !!entry.locked;
    
    const embed = new EmbedBuilder()
        .setTitle(`🎉 ${entry.name}`)
        .setColor(locked ? ENT_COLOR_DANGER : ENT_COLOR_PRIMARY)
        .addFields(
            { name: "📅 Datum", value: entry.date || "–", inline: true },
            { name: "🕐 Uhrzeit", value: entry.time ? `${entry.time} Uhr` : "–", inline: true },
            { name: "📍 Ort", value: entry.location || "–", inline: true }
        )
        .setFooter({ text: `Event-ID: ${entry.id}` });
    
    if (entry.description) embed.addFields({ name: "📝 Beschreibung", value: entry.description, inline: false });
    if (locked) embed.setDescription("🔒 **Dieses Event wurde vom Bot-Owner gesperrt.**");
    
    return embed;
}

function buildEventEditModal(entry) {
    const modal = new ModalBuilder()
        .setCustomId(`admin_edit_modal_events_${entry.id}`)
        .setTitle("Event bearbeiten");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_name")
                .setLabel("Eventname")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.name || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_date")
                .setLabel("Datum (DD.MM.YYYY)")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.date || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_time")
                .setLabel("Uhrzeit (HH:MM)")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.time || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_location")
                .setLabel("Ort/Kanal")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.location || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("event_description")
                .setLabel("Beschreibung")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(entry.description || "")
                .setRequired(false)
        )
    );
    
    return modal;
}

// =====================================================
// AUTONACHRICHT – PARSE-/BUILD-HILFSFUNKTIONEN
// =====================================================

function parseAutoFields(fields) {
    return {
        message: fields.getTextInputValue("auto_message"),
        time: fields.getTextInputValue("auto_time")
    };
}

function buildAutoNachrichtEmbed(entry) {
    const active = entry.active !== false;
    
    const embed = new EmbedBuilder()
        .setTitle("🤖 Automatische Nachricht")
        .setDescription(entry.message || "–")
        .setColor(active ? ENT_COLOR_PRIMARY : ENT_COLOR_DANGER)
        .addFields(
            { name: "⏰ Zeitpunkt", value: entry.time || "–", inline: true },
            { name: "Status", value: active ? "✅ Aktiv" : "🔒 Gesperrt/Inaktiv", inline: true }
        )
        .setFooter({ text: `Nachricht-ID: ${entry.id}` });
    
    return embed;
}

function buildAutoEditModal(entry) {
    const modal = new ModalBuilder()
        .setCustomId(`admin_edit_modal_autoMessages_${entry.id}`)
        .setTitle("Autonachricht bearbeiten");
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("auto_message")
                .setLabel("Nachricht")
                .setStyle(TextInputStyle.Paragraph)
                .setValue(entry.message || "")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("auto_time")
                .setLabel("Zeitpunkt (HH:MM oder Intervall)")
                .setStyle(TextInputStyle.Short)
                .setValue(entry.time || "")
                .setRequired(true)
        )
    );
    
    return modal;
}

// =====================================================
// GENERISCHES PANEL-/ADMIN-SYSTEM
// =====================================================
// Ein "verwalteter Eintrag" (Termin, Bewertung, Event, Autonachricht) kann
// per "📢 Panel posten" öffentlich (für ALLE sichtbar, nicht ephemeral) in
// einem Kanal gepostet werden. Dabei werden panelChannelId/panelMessageId
// am Eintrag gespeichert. Jede spätere Änderung über den jeweiligen
// "❗ ... Admin"-Bereich (nur Bot-Owner) aktualisiert dieses bereits
// gepostete Panel automatisch per message.edit() - es wird NIE ein neues
// Panel erzeugt, solange das alte noch existiert.

function buildPostButtonRow(type, entryId, label) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`panel_post_${type}_${entryId}`)
            .setLabel(label || "📢 Panel posten")
            .setStyle(ButtonStyle.Primary)
    );
}

async function respondAdminAction(interaction, payload) {
    if (typeof interaction.isFromMessage === "function" && interaction.isFromMessage()) {
        return interaction.update(payload).catch(() => interaction.reply(payload).catch(console.error));
    }
    return interaction.reply(payload).catch(console.error);
}

async function updateManagedPanelMessage(client, config, entry) {
    if (!entry.panelChannelId || !entry.panelMessageId) return;
    
    try {
        const channel = await client.channels.fetch(entry.panelChannelId);
        if (!channel || !channel.isTextBased()) return;
        const message = await channel.messages.fetch(entry.panelMessageId);
        await message.edit({ embeds: [config.buildEmbed(entry)] });
    } catch (error) {
        console.error(`❌ Panel (${config.pluralLabel}) konnte nicht aktualisiert werden:`, error.message);
    }
}

async function deleteManagedPanelMessage(client, entry) {
    if (!entry.panelChannelId || !entry.panelMessageId) return;
    
    try {
        const channel = await client.channels.fetch(entry.panelChannelId);
        if (!channel || !channel.isTextBased()) return;
        const message = await channel.messages.fetch(entry.panelMessageId);
        await message.delete();
    } catch (error) {
        // Nachricht existiert evtl. bereits nicht mehr - kann ignoriert werden.
    }
}

async function showPanelPostChannelSelect(interaction, dataDir, db, type, entryId) {
    const config = MANAGED_TYPES[type];
    if (!config) return interaction.reply(errorReply("Unbekannter Bereich.")).catch(console.error);
    
    const list = db[config.dbKey] || [];
    const entry = list.find(e => e.id === entryId);
    
    if (!entry) {
        return interaction.reply(errorReply("Dieser Eintrag existiert nicht mehr.")).catch(console.error);
    }
    
    await interaction.update({
        content: `📍 Wähle den Kanal, in dem das ${config.singularLabel}-Panel für alle sichtbar gepostet werden soll:`,
        embeds: [],
        components: buildChannelSelectorComponents(interaction.guild, `panel_post_${type}_${entryId}`, 0)
    }).catch(console.error);
}

async function handlePanelPostChannelSelect(interaction, dataDir, db, type, entryId, channel) {
    const config = MANAGED_TYPES[type];
    if (!config) {
        return interaction.update({ content: "❌ Unbekannter Bereich.", embeds: [], components: [] }).catch(console.error);
    }
    
    const list = db[config.dbKey] || [];
    const entry = list.find(e => e.id === entryId);
    
    if (!entry) {
        return interaction.update({ content: "❌ Dieser Eintrag existiert nicht mehr.", embeds: [], components: [] }).catch(console.error);
    }
    
    if (!channel || !channel.isTextBased()) {
        return interaction.update({ content: "❌ Bitte wähle einen gültigen Textkanal.", embeds: [], components: [] }).catch(console.error);
    }
    
    let message;
    try {
        message = await channel.send({ embeds: [config.buildEmbed(entry)] });
    } catch (error) {
        console.error("❌ Panel konnte nicht gepostet werden:", error);
        return interaction.update({
            content: "❌ Panel konnte im gewählten Kanal nicht gepostet werden (Berechtigungen prüfen).",
            embeds: [],
            components: []
        }).catch(console.error);
    }
    
    entry.panelChannelId = channel.id;
    entry.panelMessageId = message.id;
    entry.guildId = interaction.guildId;
    saveDatabase(dataDir, db);
    
    await interaction.update({
        content: `✅ Panel wurde in ${channel} gepostet und wird ab jetzt bei jeder Änderung automatisch aktualisiert.`,
        embeds: [],
        components: []
    }).catch(console.error);
}

async function showAdminEntryList(interaction, dataDir, db, type, opts = {}) {
    if (!(await requireBotOwner(interaction))) return;
    
    const config = MANAGED_TYPES[type];
    if (!config) return interaction.reply(errorReply("Unbekannter Admin-Bereich.")).catch(console.error);
    
    const list = db[config.dbKey] || [];
    
    if (list.length === 0) {
        const payload = {
            content: `📭 Es sind noch keine Einträge (${config.pluralLabel}) vorhanden.`,
            embeds: [],
            components: [],
            flags: MessageFlags.Ephemeral
        };
        return (opts.fresh ? interaction.reply(payload) : interaction.update(payload)).catch(console.error);
    }
    
    const options = list.slice(-25).reverse().map(entry =>
        new StringSelectMenuOptionBuilder()
            .setLabel(config.buildSummary(entry).slice(0, 100))
            .setValue(entry.id)
    );
    
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`admin_pick_${type}`)
            .setPlaceholder(`${config.icon} Eintrag auswählen...`)
            .addOptions(options)
    );
    
    const embed = new EmbedBuilder()
        .setTitle(`❗ ${config.adminTitle}`)
        .setDescription(`Wähle einen Eintrag aus, um ihn zu verwalten.\nGefunden: ${list.length}`)
        .setColor(ENT_COLOR_DANGER);
    
    const payload = { content: null, embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
    
    await (opts.fresh ? interaction.reply(payload) : interaction.update(payload)).catch(console.error);
}

async function showAdminControlPanel(interaction, dataDir, db, type, entryId) {
    if (!(await requireBotOwner(interaction))) return;
    
    const config = MANAGED_TYPES[type];
    if (!config) return interaction.reply(errorReply("Unbekannter Admin-Bereich.")).catch(console.error);
    
    const list = db[config.dbKey] || [];
    const entry = list.find(e => e.id === entryId);
    
    const notFoundPayload = { content: "❌ Dieser Eintrag existiert nicht mehr.", embeds: [], components: [], flags: MessageFlags.Ephemeral };
    if (!entry) {
        if (interaction.isButton() || interaction.isStringSelectMenu()) return interaction.update(notFoundPayload).catch(console.error);
        return respondAdminAction(interaction, notFoundPayload);
    }
    
    const locked = config.isLocked(entry);
    const embed = config.buildEmbed(entry);
    embed.setFooter({ text: `${config.icon} Admin-Ansicht · ID: ${entry.id}` });
    
    let statusLine = locked ? "🔒 Gesperrt" : "🔓 Aktiv";
    statusLine += entry.panelChannelId ? ` · 📢 Panel in <#${entry.panelChannelId}>` : " · 📭 Noch kein Panel gepostet";
    
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`admin_edit_${type}_${entry.id}`).setLabel("✏️ Bearbeiten").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`admin_toggle_lock_${type}_${entry.id}`).setLabel(locked ? "🔓 Entsperren" : "🔒 Sperren").setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`admin_delete_${type}_${entry.id}`).setLabel("🗑️ Löschen").setStyle(ButtonStyle.Danger)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`panel_post_${type}_${entry.id}`).setLabel(entry.panelChannelId ? "📢 Panel neu posten" : "📢 Panel posten").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`admin_back_${type}`).setLabel("⬅️ Zurück zur Übersicht").setStyle(ButtonStyle.Secondary)
    );
    
    const payload = { content: statusLine, embeds: [embed], components: [row1, row2], flags: MessageFlags.Ephemeral };
    
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.update(payload).catch(console.error);
    } else {
        await respondAdminAction(interaction, payload);
    }
}

async function showAdminDeleteConfirm(interaction, dataDir, db, type, entryId) {
    if (!(await requireBotOwner(interaction))) return;
    
    const config = MANAGED_TYPES[type];
    const list = db[config.dbKey] || [];
    const entry = list.find(e => e.id === entryId);
    
    if (!entry) {
        return interaction.update({ content: "❌ Dieser Eintrag existiert nicht mehr.", embeds: [], components: [] }).catch(console.error);
    }
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`admin_delete_confirm_${type}_${entry.id}`).setLabel("🗑️ Ja, endgültig löschen").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`admin_delete_cancel_${type}_${entry.id}`).setLabel("↩️ Abbrechen").setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({
        content: `⚠️ Willst du **${config.buildSummary(entry)}** wirklich unwiderruflich löschen? Ein bereits gepostetes Panel wird dabei ebenfalls entfernt.`,
        embeds: [],
        components: [row]
    }).catch(console.error);
}

async function handleAdminDeleteConfirm(interaction, dataDir, db, type, entryId) {
    if (!(await requireBotOwner(interaction))) return;
    
    const config = MANAGED_TYPES[type];
    const list = db[config.dbKey] || [];
    const index = list.findIndex(e => e.id === entryId);
    
    if (index === -1) {
        return interaction.update({ content: "❌ Dieser Eintrag existiert nicht mehr.", embeds: [], components: [] }).catch(console.error);
    }
    
    const [entry] = list.splice(index, 1);
    saveDatabase(dataDir, db);
    
    await deleteManagedPanelMessage(interaction.client, entry);
    
    await interaction.update({
        content: `✅ **${config.buildSummary(entry)}** wurde gelöscht. Ein gepostetes Panel wurde ebenfalls entfernt.`,
        embeds: [],
        components: []
    }).catch(console.error);
}

async function handleAdminToggleLock(interaction, dataDir, db, type, entryId) {
    if (!(await requireBotOwner(interaction))) return;
    
    const config = MANAGED_TYPES[type];
    const list = db[config.dbKey] || [];
    const entry = list.find(e => e.id === entryId);
    
    if (!entry) {
        return interaction.update({ content: "❌ Dieser Eintrag existiert nicht mehr.", embeds: [], components: [] }).catch(console.error);
    }
    
    config.setLocked(entry, !config.isLocked(entry));
    entry.updatedAt = new Date().toISOString();
    saveDatabase(dataDir, db);
    
    await updateManagedPanelMessage(interaction.client, config, entry);
    await showAdminControlPanel(interaction, dataDir, db, type, entryId);
}

async function showAdminEditModal(interaction, dataDir, db, type, entryId) {
    if (!(await requireBotOwner(interaction))) return;
    
    const config = MANAGED_TYPES[type];
    if (!config) return interaction.reply(errorReply("Unbekannter Admin-Bereich.")).catch(console.error);
    
    const list = db[config.dbKey] || [];
    const entry = list.find(e => e.id === entryId);
    
    if (!entry) {
        return interaction.reply(errorReply("Dieser Eintrag existiert nicht mehr.")).catch(console.error);
    }
    
    await interaction.showModal(config.buildEditModal(entry)).catch(console.error);
}

async function handleAdminEditModalSubmit(interaction, dataDir, db, type, entryId) {
    if (!(await requireBotOwner(interaction))) return;
    
    const config = MANAGED_TYPES[type];
    if (!config) return interaction.reply(errorReply("Unbekannter Admin-Bereich.")).catch(console.error);
    
    const list = db[config.dbKey] || [];
    const entry = list.find(e => e.id === entryId);
    
    if (!entry) {
        return interaction.reply(errorReply("Dieser Eintrag existiert nicht mehr.")).catch(console.error);
    }
    
    const updates = config.parseEdit(interaction.fields);
    Object.assign(entry, updates);
    entry.updatedAt = new Date().toISOString();
    saveDatabase(dataDir, db);
    
    await updateManagedPanelMessage(interaction.client, config, entry);
    await showAdminControlPanel(interaction, dataDir, db, type, entryId);
}

// Registry: verknüpft jeden verwaltbaren Bereich mit seinen typ-spezifischen
// Embed-/Modal-/Parse-Funktionen. Wird von der generischen Panel-/Admin-Engine
// oben verwendet.
const MANAGED_TYPES = {
    gameSchedule: {
        dbKey: "gameSchedule",
        singularLabel: "Termin",
        pluralLabel: "Spieltermine",
        icon: "🎮",
        adminTitle: "Spielkalender Admin",
        buildEmbed: buildGameScheduleEmbed,
        buildEditModal: buildSpielEditModal,
        parseEdit: (fields) => parseSpielFields(fields),
        buildSummary: (entry) => `🎮 ${entry.game} – ${entry.date}${entry.locked ? " 🔒" : ""}`,
        isLocked: (entry) => !!entry.locked,
        setLocked: (entry, value) => { entry.locked = value; }
    },
    ratings: {
        dbKey: "ratings",
        singularLabel: "Bewertung",
        pluralLabel: "Bewertungen",
        icon: "⭐",
        adminTitle: "Bewertung Admin",
        buildEmbed: buildBewertungEmbed,
        buildEditModal: buildBewertungEditModal,
        parseEdit: (fields) => parseBewertungFields(fields),
        buildSummary: (entry) => `⭐ ${entry.name} (${entry.stars}/5)${entry.locked ? " 🔒" : ""}`,
        isLocked: (entry) => !!entry.locked,
        setLocked: (entry, value) => { entry.locked = value; }
    },
    events: {
        dbKey: "events",
        singularLabel: "Event",
        pluralLabel: "Events",
        icon: "🎉",
        adminTitle: "Events Admin",
        buildEmbed: buildEventEmbed,
        buildEditModal: buildEventEditModal,
        parseEdit: (fields) => parseEventFields(fields),
        buildSummary: (entry) => `🎉 ${entry.name} – ${entry.date}${entry.locked ? " 🔒" : ""}`,
        isLocked: (entry) => !!entry.locked,
        setLocked: (entry, value) => { entry.locked = value; }
    },
    autoMessages: {
        dbKey: "autoMessages",
        singularLabel: "Autonachricht",
        pluralLabel: "Automatische Nachrichten",
        icon: "🤖",
        adminTitle: "Autonachricht Admin",
        buildEmbed: buildAutoNachrichtEmbed,
        buildEditModal: buildAutoEditModal,
        parseEdit: (fields) => parseAutoFields(fields),
        buildSummary: (entry) => `🤖 ${(entry.message || "").slice(0, 40)}${entry.active === false ? " 🔒" : ""}`,
        isLocked: (entry) => entry.active === false,
        setLocked: (entry, value) => { entry.active = !value; }
    }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    initializeEntertainmentSystem
};