require("dotenv").config();

const fs = require("fs");

const path = require("path");

const { spawn } = require("child_process");

const { createCanvas } = require("canvas");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField,
    ChannelType,
    MessageFlags,
    AuditLogEvent
} = require("discord.js");

// =====================================================
// 💾 BACKUP / DASHBOARD / LOGGING (neue Module)
// =====================================================

const backupModule = require("./backup.js");
const dashboardModule = require("./dashboard.js");
const loggingModule = require("./logging.js");

// Neues Discord-Logging-System
const { registerDiscordLogger } = require("./Discord-Logger.js");

// =====================================================
// 💫 VEXO RP VORLAGEN-SYSTEM
// =====================================================

const {
    initializeVorlagenSystem
} = require("./Vorlagen-System");

// =====================================================
// 🌐 HEALTH-CHECK HTTP-SERVER (für Render Web Service)
// =====================================================
// Render erkennt einen "Web Service" nur, wenn innerhalb kurzer Zeit
// ein Port auf 0.0.0.0 geöffnet wird ("No open ports detected" / "Port
// scan timeout"). Dieser Server dient AUSSCHLIESSLICH dazu, Render einen
// offenen Port zu zeigen. Er greift nicht in den Discord-Bot ein und
// blockiert dessen Start (client.login weiter unten) nicht, da
// http.createServer/listen asynchron und nicht-blockierend arbeitet.

const http = require("http");

const HEALTH_CHECK_PORT = process.env.PORT || 3000;

// Wenn DASHBOARD_PASSWORD gesetzt ist, übernimmt dashboard.js den Port
// (die Startseite "/" antwortet ebenfalls mit 200 -> Render ist zufrieden).
// Zwei Server auf demselben Port würden sonst mit EADDRINUSE abstürzen.
if (!process.env.DASHBOARD_PASSWORD) {
    http
        .createServer((req, res) => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("OK - Bot läuft");
        })
        .listen(HEALTH_CHECK_PORT, "0.0.0.0", () => {
            console.log(`🌐 Health-Check-Server läuft auf 0.0.0.0:${HEALTH_CHECK_PORT}`);
        });
}

// =====================================================
// 🤖 KI-CHAT
// =====================================================

// Roblox-Namen-System (Panel, Liste und automatische Roblox-Abfrage)
const { registerRobloxSystem, robloxCommands } = require('./Roblox-Namen-System');
const { aktivCheckCommands, registerAktivCheckSystem, handleAktivCheckCommand } = require('./Aktiv-Check-System');

const {
    initializeKIChat
} = require("./KI-Chatbot/KI-Chat");

const {
    setKIChatChannel
} = require("./KI-Chatbot/KI-Chat-Setup");

// =====================================================
// 🏴 GANG-SYSTEM
// =====================================================

const {
    initializeGangSystem
} = require("./Gang-System/Gang-System");

// =====================================================
// 👨‍💻 DEV-AUFGABEN-SYSTEM
// =====================================================

const {
    initializeDevTaskSystem
} = require("./Dev-Aufgaben-System/Dev-Aufgaben-System");

// =====================================================
// 📋 RP-WEB-LOGS-SYSTEM
// =====================================================

const {
    initializeRPLogsSystem
} = require("./RP-Logs-System/RP-Logs-System");

// =====================================================
// 📩 PRIVATNACHRICHTEN-SYSTEM
// =====================================================

const {
    initializePrivatnachrichtSystem
} = require("./Privatnachricht-System/Privatnachricht-System");

// =====================================================
// 📋 SLASH COMMANDS
// =====================================================

const {
    slashCommands
} = require("./slash-commands");
const {
    musicCommandDefinitions
} = require("./Music-System/Music-System");

// =====================================================
// 📋 BÜRGER-VORSCHLAG-SYSTEM
// =====================================================

const {
    initializeBuergerVorschlagSystem
} = require("./Buerger-Vorschlag-System/Buerger-Vorschlag-System");

// =====================================================
// 🤖 BOT-STATUS-SYSTEM
// =====================================================

const {
    initializeBotStatusSystem,
    handleBotStatusCommand,
    handleBotReady,
    handleShutdown
} = require("./Bot-Status-System/Bot-Status-System");

// =====================================================
// 🤖 TEAM-MANAGEMENT
// =====================================================

const {
    initializeTeamManagement
} = require("./Team-Management/Team-Management");

const {
    initializeSupportSystem
} = require("./Support-System/Support-System");

// =====================================================
// 🤖 LOG-SYSTEM
// =====================================================

const {
    initializeLogger,
    log,
    logCommand,
    logInteraction,
    logBotAction,
    logMemberJoin,
    logMemberLeave,
    logError,
    logTicketAction,
    logApplicationAction,
    logTeamAction,
    logHouseAction,
    logRPAction,
    logVerificationAction,
    logKIAction,
    logRoleAction,
    logChannelAction,
    logVoiceAction,
    logGuildAction,
    logModerationAction
} = require("./logger");

// =====================================================
// GRUNDKONFIGURATION
// =====================================================

const PREFIX = "!";

const SERVER_NAME = "NoVex RP";

const BOT_SETTINGS_FILE =
    path.join(
        __dirname,
        "bot-settings.json"
    );

const BOT_STATS_FILE =
    path.join(
        __dirname,
        "bot-statistics.json"
    );

const VERIFICATION_TEXT = {
    TITLE: "🔐 Bestätige, dass du ein Mensch bist",
    DESCRIPTION: "Um zu überprüfen, dass du kein Roboter bist, löse bitte dieses Captcha, um vollen Zugriff auf den Server zu erhalten.",
    SELECT_PLACEHOLDER: "Bitte wähle das richtige Captcha aus.",
    SUCCESS: "✅ Du wurdest erfolgreich verifiziert!",
    WRONG_CAPTCHA: "❌ Falsches Captcha! Bitte versuche es erneut.",
    EXPIRED_CAPTCHA: "❌ **Captcha abgelaufen**\n\nBitte starte die Verifizierung erneut.",
    ALREADY_VERIFIED: "**ℹ️ Bereits verifiziert**\n\nDu bist bereits verifiziert und kannst diesen Vorgang nicht erneut durchführen.",
    NO_VERIFICATION_ROLE: "**❌ Keine Verifizierung möglich**\n\nDu hast nicht die benötigte Rolle für die Verifizierung oder bist bereits verifiziert."
};

// GUILD_ID wird jetzt server-spezifisch gespeichert
const DEFAULT_GUILD_ID = "1362117286512824321";
const CLIENT_ID_1 = "1540470358606610632";
const CLIENT_ID_2 = "1540470358606610632";


const ADMIN_USER_ID = "1559659267408134198";
const BOT_OWNER_ID = "1322191083303731201";

// =====================================================
// SLASH COMMAND PERMISSIONS - Nur Owner, Co-Owner und Dev
// =====================================================

const AUTHORIZED_ROLE_IDS = [
    "1559659267441819689", // 《 Server Founder
    "1559659267408134198", // ━━Owner/Co.Owner━━
    "1559659267395428539", // ━━Developement━━
    "1559659267378778221", // ━━Projektleitung━━
    "1559659267378778217", // ━━High-Ausbilder━━
    "1559659267349553272", // ━━Direktor━━
    "1559659267349553271", // ━━Leitung━━
    "1559659267349553265"  // ━━Managment━━
];

function hasSlashCommandPermission(member) {
    if (!member) return false;
    return member.roles.cache.some(role => AUTHORIZED_ROLE_IDS.includes(role.id));
}

// =====================================================
// RP STATUS SYSTEM
// =====================================================

const RP_STATUS_FILE = "./rp-status.json";
let rpStatus = {
    isRunning: false,
    startTime: null,
    channelId: null,
    messageId: null
};

function loadRPStatus() {
    try {
        if (fs.existsSync(RP_STATUS_FILE)) {
            rpStatus = JSON.parse(fs.readFileSync(RP_STATUS_FILE, "utf8"));
        }
    } catch (error) {
        console.error("❌ Fehler beim Laden des RP-Status:", error);
    }
}

function saveRPStatus() {
    try {
        fs.writeFileSync(RP_STATUS_FILE, JSON.stringify(rpStatus, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Fehler beim Speichern des RP-Status:", error);
    }
}

loadRPStatus();

function formatUptime(startTime) {
    const now = Date.now();
    const diff = now - startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

// =====================================================
// NAMETAG SYSTEM - Automatische Nickname-Änderung bei Rollen
// =====================================================

const NAMETAG_CONFIG_FILE = "./nametag-config.json";
let nametagConfig = {
    enabled: true,
    roleIdToTag: {} // roleId -> tagPrefix (z.B. "1559659267441819689": " Founder")
};

function loadNametagConfig() {
    try {
        if (fs.existsSync(NAMETAG_CONFIG_FILE)) {
            nametagConfig = JSON.parse(fs.readFileSync(NAMETAG_CONFIG_FILE, "utf8"));
        }
    } catch (error) {
        console.error("❌ Fehler beim Laden der Nametag-Konfiguration:", error);
    }
}

function saveNametagConfig() {
    try {
        fs.writeFileSync(NAMETAG_CONFIG_FILE, JSON.stringify(nametagConfig, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Nametag-Konfiguration:", error);
    }
}

loadNametagConfig();

// Lade Team-Rollen-Konfiguration für Nametags
function setupNametagsFromRoles() {
    try {
        const teamRolesConfig = require("./team-roles-config.json");
        for (const category of teamRolesConfig.roleHierarchy) {
            for (const role of category.roles) {
                // Erstelle Tag basierend auf der Kategorie
                const tagPrefix = category.category;
                nametagConfig.roleIdToTag[role.id] = tagPrefix;
            }
        }
        saveNametagConfig();
        console.log("✅ Nametags basierend auf Team-Rollen-Konfiguration eingerichtet.");
    } catch (error) {
        console.error("❌ Fehler beim Einrichten der Nametags:", error);
    }
}

// Rufe beim Start auf
setupNametagsFromRoles();

function updateMemberNametag(member) {
    if (!nametagConfig.enabled) return;

    try {
        // Finde die höchste Rolle mit einem Nametag
        let tagPrefix = "";
        let highestPosition = -1;

        for (const [roleId, prefix] of Object.entries(nametagConfig.roleIdToTag)) {
            const role = member.roles.cache.get(roleId);
            if (role && role.position > highestPosition) {
                highestPosition = role.position;
                tagPrefix = prefix;
            }
        }

        if (tagPrefix) {
            const originalName = member.user.username;
            const newNickname = tagPrefix + " " + originalName;

            if (member.nickname !== newNickname) {
                member.setNickname(newNickname).catch(error => {
                    if (error.code !== 50013) { // Ignore missing permissions
                        console.error(`❌ Fehler beim Setzen des Nametags für ${member.user.username}:`, error);
                    }
                });
            }

        }
    } catch (error) {
        console.error("❌ Fehler beim Aktualisieren des Nametags:", error);
    }
}

// =====================================================
// VERIFIZIERUNGSSYSTEM
// =====================================================

const UNVERIFIED_ROLE_ID = "1512180634016284763";
const VERIFIED_ROLE_ID = "1512164920853135430";
const VERIFICATION_COUNT_FILE = "./verification-count.json";
const VERIFICATION_PANEL_FILE = "./verification-panel.json";

// =====================================================
// VERIFIZIERUNGS-PANEL LIVE-STATISTIK KONFIGURATION
// =====================================================

// Diese Werte werden automatisch gespeichert und wiederhergestellt:
// - verificationChannelId: Der Discord-Kanal, in dem das Panel steht
// - verificationMessageId: Die Discord-Nachricht-ID des Panels
const VERIFICATION_LIVE_CONFIG = {
    channelId: null,
    messageId: null,
    guildId: null
};

// =====================================================
// SERVER-SPEZIFISCHE KONFIGURATION
// =====================================================

const serverConfigs = new Map(); // Speichert Konfigurationen pro Server

function getServerConfig(guildId) {
    if (!serverConfigs.has(guildId)) {
        serverConfigs.set(guildId, {
            rpStatusChannelId: null,
            teamLogChannelId: null,
            teamListAutoUpdateChannelId: null,
            teamListMessageId: null,
            statisticsLogChannelId: null,
            statisticsMessageId: null,
            guildId: guildId
        });
    }
    return serverConfigs.get(guildId);
}

function setServerConfig(guildId, key, value) {
    const config = getServerConfig(guildId);
    config[key] = value;
    return config;
}

function loadBotSettings() {
    try {
        if (!fs.existsSync(BOT_SETTINGS_FILE)) {
            return {
                serverName: SERVER_NAME,
                statisticsByGuild: {},
                teamManagementByGuild: {},
                verificationTexts: { ...VERIFICATION_TEXT }
            };
        }

        const data = JSON.parse(fs.readFileSync(BOT_SETTINGS_FILE, "utf8"));
        return {
            serverName: data.serverName || SERVER_NAME,
            statisticsByGuild: data.statisticsByGuild || {},
            teamManagementByGuild: data.teamManagementByGuild || {},
            verificationTexts: {
                ...VERIFICATION_TEXT,
                ...(data.verificationTexts || {})
            }
        };
    } catch (error) {
        console.error("❌ Fehler beim Laden der Bot-Einstellungen:", error);
        return {
            serverName: SERVER_NAME,
            statisticsByGuild: {},
            teamManagementByGuild: {},
            verificationTexts: { ...VERIFICATION_TEXT }
        };
    }
}

function saveBotSettings() {
    try {
        fs.writeFileSync(BOT_SETTINGS_FILE, JSON.stringify(BOT_SETTINGS, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Bot-Einstellungen:", error);
        return false;
    }
}

let BOT_SETTINGS = loadBotSettings();

function getGuildStatisticsConfig(guildId) {
    if (!BOT_SETTINGS.statisticsByGuild[guildId]) {
        BOT_SETTINGS.statisticsByGuild[guildId] = {
            channelId: null,
            messageId: null
        };
    }
    return BOT_SETTINGS.statisticsByGuild[guildId];
}

function saveGuildStatisticsChannel(guildId, channelId, messageId = null) {
    const config = getGuildStatisticsConfig(guildId);
    config.channelId = channelId;
    if (messageId) {
        config.messageId = messageId;
    }
    saveBotSettings();
    return config;
}

// =====================================================
// TEAMVERWALTUNG – KANAL-KONFIGURATION (persistent)
// =====================================================

// Für Up-Rank und Down-Rank wird derselbe Kanal verwendet (rankChannelId).
// Für Warnen und Warnen zurück wird derselbe Kanal verwendet (warnChannelId).
// Team-Kick bekommt einen eigenen Kanal (teamKickChannelId).
const TEAM_MANAGEMENT_TYPES = {
    rank: {
        configKey: "rankChannelId",
        label: "Rank-Kanal",
        emoji: "📊",
        description: "Für Up-Rank und Down-Rank"
    },
    warn: {
        configKey: "warnChannelId",
        label: "Warn-Kanal",
        emoji: "⚠️",
        description: "Für Warnen und Warnen zurück"
    },
    kick: {
        configKey: "teamKickChannelId",
        label: "Team-Kick-Kanal",
        emoji: "👢",
        description: "Für Team-Kick"
    }
};

function getTeamManagementConfig(guildId) {
    if (!BOT_SETTINGS.teamManagementByGuild[guildId]) {
        BOT_SETTINGS.teamManagementByGuild[guildId] = {
            rankChannelId: null,
            warnChannelId: null,
            teamKickChannelId: null
        };
    }
    return BOT_SETTINGS.teamManagementByGuild[guildId];
}

function setTeamManagementChannel(guildId, type, channelId) {
    const typeInfo = TEAM_MANAGEMENT_TYPES[type];
    if (!typeInfo) {
        return null;
    }
    const config = getTeamManagementConfig(guildId);
    config[typeInfo.configKey] = channelId;
    saveBotSettings();
    return config;
}

function getTeamManagementChannelId(guildId, type) {
    const typeInfo = TEAM_MANAGEMENT_TYPES[type];
    if (!typeInfo) {
        return null;
    }
    return getTeamManagementConfig(guildId)[typeInfo.configKey] || null;
}

// Nur der Bot-Owner darf die Teamverwaltung (Kanal-Einstellungen)
// ändern - sehr strikte Berechtigung für Konfiguration.
function hasTeamManagementPermission(member) {
    return Boolean(
        member &&
        isBotOwner(member)
    );
}

// Sendet einen Log-Embed in den für "type" (rank/warn/kick) konfigurierten
// Kanal. Ist kein Kanal gesetzt, wird nichts gesendet (kein Fehler).
async function sendTeamManagementLog(guild, type, embed) {
    const channelId = getTeamManagementChannelId(guild.id, type);
    if (!channelId) {
        return false;
    }
    return sendLog(guild, channelId, embed);
}

async function sendRequiredTeamManagementLog(guild, type, embed) {
    const sent = await sendTeamManagementLog(guild, type, embed);
    if (!sent) {
        throw new Error(`Der konfigurierte Team-Log-Kanal für „${type}“ ist nicht verfügbar oder der Bot darf dort nicht senden.`);
    }
}

// Sendet ein "🔄 Warnung geändert"-Log in den konfigurierten Warn-Kanal
// (verwendet für Entfernen/Verkürzen/Verlängern bestehender Warnungen).
async function sendWarnbackLog(guild, target, warnLabel, actionLabel, newDurationLabel, executorMember) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🔄 Warnung geändert")
        .addFields(
            {
                name: "👤 Mitglied",
                value: `${target}\n${target.user.tag}`,
                inline: true
            },
            {
                name: "🆔 ID",
                value: `\`${target.id}\``,
                inline: true
            },
            {
                name: "⚠️ Warn",
                value: warnLabel,
                inline: false
            },
            {
                name: "🔧 Aktion",
                value: actionLabel,
                inline: true
            },
            {
                name: "⏱️ Neue Dauer",
                value: newDurationLabel,
                inline: true
            },
            {
                name: "👮 Ausgeführt von",
                value: `${executorMember}\n${executorMember.user.tag}`,
                inline: false
            }
        )
        .setTimestamp();

    return sendTeamManagementLog(guild, "warn", embed);
}

function loadBotStats() {
    try {
        if (!fs.existsSync(BOT_STATS_FILE)) {
            return {
                commandsExecuted: 0,
                verificationsCompleted: 0,
                lastUpdated: new Date().toISOString()
            };
        }

        const data = JSON.parse(fs.readFileSync(BOT_STATS_FILE, "utf8"));
        return {
            commandsExecuted: Number(data.commandsExecuted || 0),
            verificationsCompleted: Number(data.verificationsCompleted || 0),
            lastUpdated: data.lastUpdated || new Date().toISOString()
        };
    } catch (error) {
        console.error("❌ Fehler beim Laden der Bot-Statistiken:", error);
        return {
            commandsExecuted: 0,
            verificationsCompleted: 0,
            lastUpdated: new Date().toISOString()
        };
    }
}

function saveBotStats() {
    try {
        fs.writeFileSync(BOT_STATS_FILE, JSON.stringify(BOT_STATS, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Bot-Statistiken:", error);
        return false;
    }
}

const BOT_STATS = loadBotStats();

function incrementBotStat(statName) {
    BOT_STATS[statName] = Number(BOT_STATS[statName] || 0) + 1;
    BOT_STATS.lastUpdated = new Date().toISOString();
    saveBotStats();
    return BOT_STATS[statName];
}

function setVerificationText(key, value) {
    VERIFICATION_TEXT[key] = value;
    BOT_SETTINGS.verificationTexts[key] = value;
    saveBotSettings();
    return value;
}

// =====================================================
// NEUSTART
// =====================================================

const RESTART_ROLE_ID = "1539991219034128535";
const RESTART_CHANNEL_FILE = "./restart-channel.json";
// =====================================================
// NEUSTART-DATEI
// =====================================================

function saveRestartChannelId(channelId) {
    try {
        fs.writeFileSync(
            RESTART_CHANNEL_FILE,
            JSON.stringify({
                channelId: channelId
            }, null, 2),
            "utf8"
        );

        return true;
    } catch (error) {
        console.error(
            "❌ Restart-Kanal konnte nicht gespeichert werden:",
            error
        );

        return false;
    }
}

function loadRestartChannelId() {
    try {
        if (!fs.existsSync(RESTART_CHANNEL_FILE)) {
            return null;
        }

        const data = JSON.parse(
            fs.readFileSync(
                RESTART_CHANNEL_FILE,
                "utf8"
            )
        );

        return data.channelId || null;

    } catch (error) {
        console.error(
            "❌ Restart-Kanal konnte nicht geladen werden:",
            error
        );

        return null;
    }
}

// =====================================================
// BOT NEUSTARTEN
// =====================================================
// (Die eigentliche restartBotProcess Funktion ist weiter unten definiert)

// =====================================================
// SERVER-PROFILBILD (Bot-Avatar pro Server)
// =====================================================
// Nutzt Discords server-spezifische Bot-Avatare
// (guild.members.editMe). Der GLOBALE Bot-Avatar wird
// dabei NIEMALS verändert - Discord speichert dieses
// Server-Profilbild direkt am Bot-Mitgliedskonto des
// jeweiligen Servers und stellt es nach einem Neustart
// automatisch wieder her. Zusätzlich speichern wir hier
// nur Metadaten (wer/wann geändert) für Log-Zwecke.

const SERVER_AVATARS_FILE =
    path.join(
        __dirname,
        "server-avatars.json"
    );

const BOT_AVATAR_MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const BOT_AVATAR_ALLOWED_CONTENT_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp"
];
const BOT_AVATAR_ALLOWED_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp"
];
const BOT_AVATAR_UPLOAD_TIMEOUT_MS = 60000; // 60 Sekunden

function loadServerAvatars() {
    try {
        if (!fs.existsSync(SERVER_AVATARS_FILE)) {
            return {};
        }

        const data = JSON.parse(
            fs.readFileSync(SERVER_AVATARS_FILE, "utf8")
        );

        return data && typeof data === "object" ? data : {};
    } catch (error) {
        console.error(
            "❌ Server-Profilbilder konnten nicht geladen werden:",
            error
        );
        return {};
    }
}

function saveServerAvatars() {
    try {
        fs.writeFileSync(
            SERVER_AVATARS_FILE,
            JSON.stringify(SERVER_AVATARS, null, 2),
            "utf8"
        );
        return true;
    } catch (error) {
        console.error(
            "❌ Server-Profilbilder konnten nicht gespeichert werden:",
            error
        );
        return false;
    }
}

let SERVER_AVATARS = loadServerAvatars();

function setServerAvatarState(guildId, state) {
    SERVER_AVATARS[guildId] = {
        active: Boolean(state.active),
        setBy: state.setBy || null,
        setAt: new Date().toISOString(),
        fileName: state.fileName || null
    };
    saveServerAvatars();
    return SERVER_AVATARS[guildId];
}

function getServerAvatarState(guildId) {
    return SERVER_AVATARS[guildId] || null;
}

function createBotAvatarPanel(guildId) {
    const state = getServerAvatarState(guildId);
    const statusText = state?.active
        ? `🖼️ Aktiv seit ${formatGermanTime(new Date(state.setAt))}${state.setBy ? ` (gesetzt von <@${state.setBy}>)` : ""}`
        : "🔄 Es wird aktuell das Standard-Profilbild des Bots verwendet.";

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🤖 Bot-Profilbild")
            .setDescription(
                "🖼️ **Server-Profilbild**\n\n" +
                "Wähle ein eigenes Profilbild für den Bot auf diesem Server aus.\n" +
                "Das globale Profilbild des Bots bleibt davon unberührt und gilt weiterhin auf allen anderen Servern.\n\n" +
                `**Status:** ${statusText}\n\n` +
                "Unterstützte Formate: PNG, JPG, JPEG, WEBP (max. 8 MB)."
            )
            .setFooter({ text: "Server-Profilbild ✧ nur für diesen Server gültig" });

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("botavatar_pick")
                    .setLabel("Profilbild aussuchen")
                    .setEmoji("🖼️")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("botavatar_reset")
                    .setLabel("Standardbild verwenden")
                    .setEmoji("🔄")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!state?.active)
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

// =====================================================
// LOG-KANÄLE
// =====================================================

const JOIN_LOG_CHANNEL_ID = "1539990032469991444";
const LEFT_LOG_CHANNEL_ID = "1539990033744789514";
const MODERATION_LOG_CHANNEL_ID = "1539990036945182810";
const BOT_LOG_CHANNEL_ID = "1539990045174267964";
const SECURITY_LOG_CHANNEL_ID = "1539990046705324052";
const EDIT_LOG_CHANNEL_ID = "1539990050962538657";
const WELCOME_CHANNEL_ID = "1559659268175826953";
const DISCORD_RULES_CHANNEL_ID = "1560736136304009257";
const IC_RULES_CHANNEL_ID = "1559659268494327931";

// =====================================================
// RP-PANEL
// =====================================================

const RP_PANEL_TITLE = "🚨┃RP-Leitstelle";

const RP_PANEL_DESCRIPTION =
    "Verwalte hier den aktuellen Roleplay-Status und starte oder beende das RP über die untenstehenden Buttons.";

// =====================================================
// RP START
// =====================================================


const RP_START_TITLE = "🚀 VEXO RP V1  •  CITY ONLINE";

const RP_START_DESCRIPTION = [
    "### 🟢 DIE STADT IST JETZT GEÖFFNET",
    "Willkommen zurück in **NoVex Roleplay**!",
    "Die Tore unserer Stadt sind geöffnet und ein neuer RP-Tag beginnt.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "### 📡 LIVE-SERVERSTATUS",
    "🟢 **Roleplay:** ONLINE",
    "🚓 **Polizei:** Einsatzbereit",
    "🚑 **Rettungsdienst:** Einsatzbereit",
    "🏙️ **Bürger:** Willkommen in der Stadt",
    "",
    "### 🔑 DEIN EINSTIEG",
    "🎮 **Servercode:** `83ej67c7`",
    "📜 **IC-Regeln:** <#1559659268494327931>",
    "🔗 **Server-Codes:** <#1559659269190586413>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "✨ Schreibt eure eigene Geschichte, bleibt fair und genießt das Roleplay!",
    "",
    "🟢 **VEXO RP IST JETZT LIVE!**"
].join("\n");

const RP_START_SUCCESS = "✅ Das Roleplay wurde gestartet!";

const RP_STOP_TITLE = "🌙 VEXO RP V1  •  CITY OFFLINE";

const RP_STOP_DESCRIPTION = [
    "### 🔴 DIE STADT SCHLIESST IHRE TORE",
    "Ein weiterer RP-Tag in **NoVex Roleplay** geht zu Ende.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "### 📡 LIVE-SERVERSTATUS",
    "🔴 **Roleplay:** OFFLINE",
    "🛑 **Neue RP-Situationen:** Nicht mehr starten",
    "📋 **Laufende Situationen:** Bitte geordnet beenden",
    "",
    "### 💙 DANKE, COMMUNITY!",
    "Ein großes Dankeschön an alle Bürger, Einsatzkräfte und Teammitglieder.",
    "Ihr habt unsere Stadt heute wieder lebendig gemacht!",
    "",
    "📢 Der nächste RP-Start wird rechtzeitig angekündigt.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🌙 Erholt euch gut. Wir sehen uns beim nächsten RP-Abenteuer!",
    "",
    "🔴 **VEXO RP IST JETZT OFFLINE!**"
].join("\n");

const RP_STOP_SUCCESS = "✅ Das Roleplay wurde beendet!";

// =====================================================
// TEAM
// =====================================================

const TEAM_PANEL_TITLE = "👥 Teamverwaltung";

const TEAM_PANEL_DESCRIPTION =
    "Wähle deine Teamverwaltungs-Aktion aus.\n\n" +
    "Verwalte hier schnell und übersichtlich deine Teammitglieder. Passe Ränge an, verwalte Verwarnungen oder entferne Teammitglieder aus dem Team.";

const TEXT_SENDE_TITLE = "📨 Text senden";

const TEXT_SENDE_DESCRIPTION =
    "Wähle einen Discord-Kanal aus und sende anschließend eine Nachricht.";


const TEAM_ROLE_IDS = ["1539991249254355014"];
const ADMIN_ROLE_IDS = [];

// =====================================================
// BÜRGER-VORSCHLAG-SYSTEM
// =====================================================

const SUGGESTION_TEAM_ROLE_IDS = ["1539991249254355014"]; // Rollen, die Zugriff auf Team-Funktionen haben

// =====================================================
// TEAM-BEWERBUNGEN
// =====================================================

const TEAM_APPLICATION_FILE = path.join(__dirname, "team-applications.json");
const TEAM_APPLICATION_QUESTIONS_FILE = path.join(__dirname, "team-application-questions.json");
const SERVER_CODES_CHANNEL_ID = "1559659269190586413";
const SERVER_CODES_MESSAGE_FILE = path.join(__dirname, "server-codes-message.json");
const APPLICATION_REVIEW_CHANNEL_ID = "1559659273351602287";
const APPLICATION_ACCEPTED_ROLE_ID = "1559659267269595146";
const APPLICATION_TEAM_ROLE_IDS = (process.env.APPLICATION_TEAM_ROLE_IDS || TEAM_ROLE_IDS.join(","))
    .split(",")
    .map(roleId => roleId.trim())
    .filter(Boolean);
const APPLICATION_UNLIMITED_USER_IDS = new Set([
    "1322191083303731201"
]);
const APPLICATION_REVIEW_ROLE_IDS = (process.env.APPLICATION_REVIEW_ROLE_IDS || "")
    .split(",")
    .map(roleId => roleId.trim())
    .filter(Boolean);
const APPLICATION_ORAL_ROLE_IDS = (process.env.APPLICATION_ORAL_ROLE_IDS || "")
    .split(",")
    .map(roleId => roleId.trim())
    .filter(Boolean);

function loadTeamApplicationQuestions() {
    const defaultQuestions = [
        "Wie heißt du?",
        "Wie alt bist du?",
        "Wie heißt du in Roblox?",
        "Auf welchem Gerät spielst du?",
        "Welche Altersgruppe in Roblox bist du eingestuft?",
        "Warum möchtest du ins Team?",
        "Welche Rolle passt zu dir und warum?",
        "Hast du Erfahrung als Teamler?",
        "Kennst du dich mit Discord aus?",
        "Wie viel Zeit kannst du täglich auf dem Server verbringen?",
        "Wie viel Zeit kannst du pro Woche auf dem Server verbringen, ohne dein Privatleben zu vernachlässigen?",
        "Was ist VDM?",
        "Was ist RDM?",
        "Wie gehst du mit Kritik um?",
        "Nenne zwei bis drei deiner Stärken.",
        "Nenne zwei bis drei deiner Schwächen."
    ];

    try {
        if (!fs.existsSync(TEAM_APPLICATION_QUESTIONS_FILE)) {
            fs.writeFileSync(TEAM_APPLICATION_QUESTIONS_FILE, JSON.stringify(defaultQuestions, null, 2), "utf8");
            return defaultQuestions;
        }

        const questions = JSON.parse(fs.readFileSync(TEAM_APPLICATION_QUESTIONS_FILE, "utf8"));
        if (!Array.isArray(questions) || questions.length === 0 || questions.some(question => typeof question !== "string" || !question.trim())) {
            throw new Error("Die Fragen-Datei muss ein nicht-leeres Array aus Texten enthalten.");
        }

        return questions.map(question => question.trim());
    } catch (error) {
        console.error("❌ Bewerbungsfragen konnten nicht geladen werden:", error);
        return defaultQuestions;
    }
}

const TEAM_APPLICATION_QUESTIONS = loadTeamApplicationQuestions();

function loadTeamApplications() {
    try {
        if (!fs.existsSync(TEAM_APPLICATION_FILE)) {
            console.log(`ℹ️ ${TEAM_APPLICATION_FILE} existiert noch nicht - starte mit leeren Bewerbungsdaten (kein teamApplicationChannelId gesetzt).`);
            return { applications: {}, panels: {}, teamApplicationChannelIds: {} };
        }

        const data = JSON.parse(fs.readFileSync(TEAM_APPLICATION_FILE, "utf8"));
        const panels = Object.fromEntries(
            Object.entries(data.panels || {}).map(([guildId, panelConfig]) => [
                guildId,
                Array.isArray(panelConfig) ? panelConfig : [panelConfig]
            ])
        );

        // Migration: ältere Dateien speicherten den Zielkanal noch
        // unter dem Namen "reviewChannels". Wird beim nächsten Speichern
        // automatisch unter dem neuen Namen "teamApplicationChannelIds"
        // abgelegt.
        const teamApplicationChannelIds = data.teamApplicationChannelIds || data.reviewChannels || {};
        console.log(`ℹ️ Bewerbungsdaten geladen aus ${TEAM_APPLICATION_FILE}. Gespeicherte teamApplicationChannelIds:`, teamApplicationChannelIds);

        return {
            applications: data.applications || {},
            panels,
            teamApplicationChannelIds
        };
    } catch (error) {
        console.error("❌ Bewerbungsdaten konnten nicht geladen werden:", error);
        return { applications: {}, panels: {}, teamApplicationChannelIds: {} };
    }
}

function saveTeamApplications() {
    try {
        fs.writeFileSync(TEAM_APPLICATION_FILE, JSON.stringify(TEAM_APPLICATIONS, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Bewerbungsdaten konnten nicht gespeichert werden:", error);
        return false;
    }
}

const TEAM_APPLICATIONS = loadTeamApplications();

function loadServerCodesMessageId() {
    if (!fs.existsSync(SERVER_CODES_MESSAGE_FILE)) {
        return null;
    }

    const data = JSON.parse(fs.readFileSync(SERVER_CODES_MESSAGE_FILE, "utf8"));
    if (typeof data.messageId !== "string" || !data.messageId) {
        throw new Error("server-codes-message.json enthält keine gültige messageId.");
    }
    return data.messageId;
}

function saveServerCodesMessageId(messageId) {
    fs.writeFileSync(
        SERVER_CODES_MESSAGE_FILE,
        JSON.stringify({ messageId }, null, 2),
        "utf8"
    );
}

function createTeamApplicationPanel() {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📋 Teambewerbung📋")
        .setDescription(
            "Du möchtest Teil unseres Teams werden?\n" +
            "Fülle das Bewerbungsformular vollständig und ehrlich aus.\n\n" +
            "Bitte beantworte alle Fragen sorgfältig."
        )
        .setFooter({ text: "NoVex RP System ✧ Team-System" });

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("team_application_start")
                    .setLabel("Teambewerbung")
                    .setEmoji("📋")
                    .setStyle(ButtonStyle.Primary)
            )
        ]
    };
}

function hasApplicationReviewPermission(member) {
    return Boolean(
        member &&
        (
            hasProtectedCommandPermission(member) ||
            APPLICATION_REVIEW_ROLE_IDS.some(roleId => member.roles.cache.has(roleId))
        )
    );
}

function getTeamApplication(userId, guildId) {
    return TEAM_APPLICATIONS.applications[`${guildId}:${userId}`] || null;
}

function setTeamApplication(application) {
    TEAM_APPLICATIONS.applications[`${application.guildId}:${application.userId}`] = application;
    saveTeamApplications();
}

function deleteTeamApplication(guildId, userId) {
    const applicationKey = `${guildId}:${userId}`;
    if (!TEAM_APPLICATIONS.applications[applicationKey]) {
        return false;
    }

    delete TEAM_APPLICATIONS.applications[applicationKey];
    return saveTeamApplications();
}

// -----------------------------------------------------
// BEWERBUNGS-ZIELKANAL
// -----------------------------------------------------
// Fertig abgeschickte Bewerbungen gehen in den festgelegten Review-Kanal.
//
// Panel und Review-Kanal sind standardmäßig getrennt. /teambewerbungtext
// setzt den Review-Kanal ausdrücklich auf den gewählten Kanal; die Einstellung
// wird separat gespeichert und nicht aus application.teamApplicationPanelChannelId
// abgeleitet.

function getTeamApplicationChannelId(guildId) {
    return TEAM_APPLICATIONS.teamApplicationChannelIds[guildId] || APPLICATION_REVIEW_CHANNEL_ID;
}

function splitApplicationText(text, maxLength = 1900) {
    const chunks = [];
    let remaining = String(text);

    while (remaining.length > maxLength) {
        chunks.push(remaining.slice(0, maxLength));
        remaining = remaining.slice(maxLength);
    }

    if (remaining || chunks.length === 0) {
        chunks.push(remaining);
    }

    return chunks;
}

function getTeamApplicationStatusLabel(status) {
    const labels = {
        awaiting_acceptance: "Warten auf Bestätigung",
        questioning: "Bewerbung läuft",
        submitted: "Eingegangen",
        accepted: "Angenommen",
        rejected: "Abgelehnt",
        cancelled: "Abgebrochen",
        dm_failed: "DM fehlgeschlagen",
        oral_successful: "Mündlich erfolgreich",
        oral_failed: "Mündlich fehlgeschlagen"
    };

    return labels[status] || status || "Unbekannt";
}

function createApplicationReviewButtons(guildId, userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`team_application_accept:${guildId}:${userId}`)
            .setLabel("Annehmen")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`team_application_reject:${guildId}:${userId}`)
            .setLabel("Ablehnen")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`team_application_oral_success:${guildId}:${userId}`)
            .setLabel("Mündlich erfolgreich")
            .setEmoji("🎙️")
            .setStyle(ButtonStyle.Secondary)
    );
}

function createApplicationManagementButtons(guildId, userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`team_application_delete:${guildId}:${userId}`)
            .setLabel("Bewerbung löschen")
            .setEmoji("🗑️")
            .setStyle(ButtonStyle.Danger)
    );
}

async function sendApplicationReview(guild, application) {
    // Ausschließlich den explizit konfigurierten Review-Kanal verwenden.
    // /teambewerbungtext kann ihn auf den Kanal des Panels setzen; der
    // Kanal aus der einzelnen Bewerbung dient nicht als impliziter Fallback.
    const teamApplicationChannelId = getTeamApplicationChannelId(guild?.id);

    if (!guild || !teamApplicationChannelId) {
        console.error(`❌ Kein Bewerbungs-Server oder Zielkanal ${teamApplicationChannelId} verfügbar.`);
        return false;
    }

    console.log(`📨 Sende Bewerbung von ${application.userId} an teamApplicationChannelId ${teamApplicationChannelId} (Server ${guild.id}).`);

    const reviewChannel = await guild.channels.fetch(teamApplicationChannelId).catch(() => null);

    if (!reviewChannel || !reviewChannel.isTextBased()) {
        console.error(`❌ teamApplicationChannelId zeigt auf einen nicht auffindbaren/ungültigen Kanal: ${teamApplicationChannelId}`);
        return false;
    }

    const applicant = await guild.members.fetch(application.userId).catch(() => null);
    const user = await client.users.fetch(application.userId).catch(() => null);
    const displayName = applicant?.displayName || user?.globalName || user?.username || application.userId;
    const username = user?.tag || user?.username || application.userId;
    const joinedAt = applicant?.joinedAt ? formatGermanTime(applicant.joinedAt) : "Nicht verfügbar";
    const avatarUrl = user?.displayAvatarURL({ size: 256 });
    const applicationFields = TEAM_APPLICATION_QUESTIONS.map((question, index) => ({
        name: `Frage ${index + 1}: ${question}`.slice(0, 256),
        value: `**Antwort:** ${(application.answers[index] || "Keine Antwort").slice(0, 1010)}`,
        inline: false
    }));

    const applicationEmbed = new EmbedBuilder()
        .setTitle("📋 Teambewerbung")
        .setColor(0xFF69B4)
        .setDescription(`👤 **${displayName}**\n\n**User-Informationen**\n**Name:** ${displayName}\n**Profil:** <@${application.userId}>\n**User-ID:** ${application.userId}\n**Username:** ${username}\n**Erwähnung:** <@${application.userId}>\n**Serverbeitritt:** ${joinedAt}\n**Bewerbung: **${formatGermanTime(new Date(application.submittedAt))}`)
        .addFields(applicationFields)
        .setTimestamp(new Date(application.submittedAt));

    if (avatarUrl) {
        applicationEmbed.setThumbnail(avatarUrl).setAuthor({ name: displayName, iconURL: avatarUrl });
    } else {
        applicationEmbed.setAuthor({ name: displayName });
    }

    const controlMessage = await reviewChannel.send({
        content: "<@&1559659267324256372>",
        allowedMentions: { roles: ["1559659267324256372"], users: [] },
        embeds: [applicationEmbed],
        components: [createApplicationReviewButtons(application.guildId, application.userId)]
    });

    application.reviewChannelId = reviewChannel.id;
    application.reviewMessageId = controlMessage.id;
    setTeamApplication(application);
    return true;
}

// Testbewerbung: absichtlich getrennt von echten Bewerbungen.
// Buttons simulieren Entscheidungen ohne Rollenvergabe oder DMs.
async function sendTeamApplicationTest(interaction) {
    if (!interaction.guild || !hasApplicationReviewPermission(interaction.member)) {
        return interaction.reply({ content: "❌ Nur berechtigte Teammitglieder dürfen Testbewerbungen senden.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channelId = getTeamApplicationChannelId(interaction.guild.id);
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || typeof channel.send !== "function") {
        return interaction.editReply({ content: "❌ Bewerbungskanal nicht gefunden. Richte ihn zuerst mit /teambewerbungtext ein." });
    }
    const testAnswers = TEAM_APPLICATION_QUESTIONS.map((_, i) => `Testantwort ${i + 1}: abcxyz`);
    const fields = TEAM_APPLICATION_QUESTIONS.map((question, i) => ({
        name: `Frage ${i + 1}: ${question}`.slice(0, 256),
        value: `**Antwort:** ${testAnswers[i]}`,
        inline: false
    }));
    const embed = new EmbedBuilder()
        .setTitle("🧪 TEST – Teambewerbung")
        .setColor(0xFF69B4)
        .setDescription("**Dies ist eine Testbewerbung – kein echter Bewerber.**\n\n👤 **Test-Bewerber**\n**Name:** Test-Bewerber\n**Username:** test_account\n**User-ID:** Keine (Test)\n**Bewerbung:** " + formatGermanTime(new Date()))
        .addFields(fields)
        .setFooter({ text: "NoVex RP • Testmodus: keine echten Rollen oder Nachrichten an Bewerber" })
        .setTimestamp();
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("team_application_test:accept").setLabel("Annehmen (Test)").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("team_application_test:reject").setLabel("Ablehnen (Test)").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("team_application_test:oral").setLabel("Mündlich erfolgreich (Test)").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("team_application_test:delete").setLabel("Löschen (Test)").setStyle(ButtonStyle.Secondary)
    );
    try {
        const sent = await channel.send({
            content: "🧪 **TESTBEWERBUNG** <@&1559659267324256372>",
            allowedMentions: { roles: ["1559659267324256372"], users: [] },
            embeds: [embed],
            components: [buttons]
        });
        return interaction.editReply({ content: `✅ Testbewerbung in <#${channel.id}> gesendet: ${sent.url}` });
    } catch (error) {
        console.error("❌ Testbewerbung konnte nicht gesendet werden:", error);
        return interaction.editReply({ content: "❌ Testbewerbung konnte nicht gesendet werden. Prüfe die Kanalrechte des Bots." });
    }
}

async function createTeamApplicationPanelForInteraction(interaction, configureReviewChannel = false) {
    if (!hasTeamPermission(interaction.member)) {
        return interaction.reply({
            content: errorMessage("Du hast keine Berechtigung, diesen Befehl zu verwenden."),
            flags: MessageFlags.Ephemeral
        });
    }

    if (!interaction.guild || !interaction.channel?.isTextBased()) {
        return interaction.reply({
            content: "❌ Das Bewerbungspanel kann nur in einem Server-Textkanal erstellt werden.",
            flags: MessageFlags.Ephemeral
        });
    }

    const targetChannel = configureReviewChannel
        ? (interaction.options.getChannel("kanal") || interaction.channel)
        : interaction.channel;

    if (
        !targetChannel.isTextBased() ||
        targetChannel.guildId !== interaction.guild.id
    ) {
        return interaction.reply({
            content: "❌ Bitte wähle einen Textkanal dieses Servers aus.",
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let panelMessage;
    try {
        panelMessage = await targetChannel.send(createTeamApplicationPanel());

        const panels = TEAM_APPLICATIONS.panels[interaction.guild.id] || [];
        const previousChannelId = TEAM_APPLICATIONS.teamApplicationChannelIds[interaction.guild.id];
        panels.push({
            channelId: panelMessage.channel.id,
            messageId: panelMessage.id
        });
        TEAM_APPLICATIONS.panels[interaction.guild.id] = panels;

        if (configureReviewChannel) {
            TEAM_APPLICATIONS.teamApplicationChannelIds[interaction.guild.id] = targetChannel.id;
        }

        if (!saveTeamApplications()) {
            panels.pop();
            if (panels.length === 0) {
                delete TEAM_APPLICATIONS.panels[interaction.guild.id];
            }
            if (configureReviewChannel) {
                if (previousChannelId) {
                    TEAM_APPLICATIONS.teamApplicationChannelIds[interaction.guild.id] = previousChannelId;
                } else {
                    delete TEAM_APPLICATIONS.teamApplicationChannelIds[interaction.guild.id];
                }
            }
            await panelMessage.delete().catch(error => {
                console.error("❌ Nicht gespeichertes Bewerbungspanel konnte nicht entfernt werden:", error);
            });
            throw new Error("Bewerbungspanel oder Bewerbungskanal konnte nicht gespeichert werden.");
        }

        const successText = configureReviewChannel
            ? `✅ Das Bewerbungspanel wurde in ${targetChannel} erstellt. Neue Bewerbungen werden ab jetzt dort eingereicht.`
            : "✅ Das Bewerbungspanel wurde erstellt. Bewerber können über den Button das Fragenformular starten.";
        return interaction.editReply({ content: successText });
    } catch (error) {
        console.error(`❌ Fehler bei /${interaction.commandName}:`, error);
        const response = { content: "❌ Das Bewerbungspanel oder der Bewerbungskanal konnte nicht eingerichtet werden. Prüfe meine Kanalberechtigungen und versuche es erneut." };
        if (panelMessage && !TEAM_APPLICATIONS.panels[interaction.guild.id]?.some(panel => panel.messageId === panelMessage.id)) {
            await panelMessage.delete().catch(deleteError => {
                console.error("❌ Teilweise erstelltes Bewerbungspanel konnte nicht entfernt werden:", deleteError);
            });
        }
        return interaction.editReply(response);
    }
}

async function assignApplicationRole(guild, userId, roleId) {
    const member = await guild.members.fetch(userId).catch(() => null);
    const role = guild.roles.cache.get(roleId);

    if (!member || !role) {
        console.error(`❌ Bewerbungsrolle oder Mitglied nicht gefunden: ${roleId}`);
        return false;
    }

    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles) || role.position >= guild.members.me.roles.highest.position) {
        console.error(`❌ Keine Berechtigung, Bewerbungsrolle ${roleId} zu vergeben.`);
        return false;
    }

    try {
        await member.roles.add(role);
        return true;
    } catch (error) {
        console.error(`❌ Bewerbungsrolle ${roleId} konnte nicht vergeben werden:`, error);
        return false;
    }
}

async function handleTeamApplicationDM(message) {
    if (message.author.bot || message.guild || !message.channel.isDMBased()) {
        return false;
    }

    const applications = Object.values(TEAM_APPLICATIONS.applications)
        .filter(application => application.userId === message.author.id && application.status === "questioning");
    const application = applications[0];

    if (!application) {
        return false;
    }

    const answer = message.content;
    application.answers[application.currentQuestion] = answer;
    application.currentQuestion += 1;

    if (application.currentQuestion < TEAM_APPLICATION_QUESTIONS.length) {
        setTeamApplication(application);
        await message.channel.send(`**${application.currentQuestion + 1}. ${TEAM_APPLICATION_QUESTIONS[application.currentQuestion]}**`);
        return true;
    }

    application.status = "submitted";
    application.submittedAt = new Date().toISOString();
    setTeamApplication(application);

    const guild = client.guilds.cache.get(application.guildId);
    const reviewSent = await sendApplicationReview(guild, application);
    await message.channel.send(
        reviewSent
            ? "Du hast alles ausgefüllt, deine Bewerbung wurde abgeschickt. Ein Teammitglied wird sich bald um deine Bewerbung kümmern."
            : "Deine Bewerbung wurde gespeichert, konnte aber nicht an das Team weitergeleitet werden. Bitte informiere die Serverleitung."
    );
    if (!guild) {
        console.error(`❌ Guild ${application.guildId} ist nach dem Neustart nicht verfügbar.`);
    }
    return true;
}

// =====================================================
// RP STATUS
// =====================================================

const RP_STATUS_CHANNEL_ID_1 = "1539989827099824188";
const RP_STATUS_CHANNEL_ID_2 = "1540668198985138247";

const RP_STATUS_FILE_1 = "./rp-status-1.json";
const RP_STATUS_FILE_2 = "./rp-status-2.json";

// Hilfsfunktion: RP-Kanal für einen Server holen
function getRPStatusChannelId(guildId) {
    const config = getServerConfig(guildId);
    return config.rpStatusChannelId || RP_STATUS_CHANNEL_ID_1; // Fallback auf Standard
}

// =====================================================
// EINZELNE BOT-INSTANZ
// =====================================================

const BOT_LOCK_FILE = "./bot-instance.lock";

function acquireBotInstanceLock() {
    try {
        if (fs.existsSync(BOT_LOCK_FILE)) {
            const oldPid = Number(
                fs.readFileSync(BOT_LOCK_FILE, "utf8").trim()
            );

            if (oldPid && oldPid !== process.pid) {
                try {
                    process.kill(oldPid, 0);
                    console.error(
                        `❌ Eine andere Bot-Instanz läuft bereits (PID ${oldPid}).`
                    );
                    process.exit(1);
                } catch (_) {
                    // Prozess existiert nicht mehr – alte Sperre entfernen.
                }
            }

            fs.unlinkSync(BOT_LOCK_FILE);
        }

        fs.writeFileSync(
            BOT_LOCK_FILE,
            String(process.pid),
            { flag: "wx" }
        );

        const cleanup = () => {
            try {
                if (fs.existsSync(BOT_LOCK_FILE)) {
                    const pid = Number(
                        fs.readFileSync(BOT_LOCK_FILE, "utf8").trim()
                    );
                    if (pid === process.pid) {
                        fs.unlinkSync(BOT_LOCK_FILE);
                    }
                }
            } catch (_) {}
        };

        process.once("exit", cleanup);
        
        // Shutdown-Handler mit Bot-Status-System Integration
        process.once("SIGINT", async () => { 
            cleanup(); 
            // Bot-Status-System Shutdown aufrufen
            try {
                await handleShutdown(client, "SIGINT Signal");
            } catch (error) {
                console.error("❌ Fehler beim Bot-Status-System Shutdown:", error);
            }
            process.exit(0); 
        });
        
        process.once("SIGTERM", async () => { 
            cleanup(); 
            // Bot-Status-System Shutdown aufrufen
            try {
                await handleShutdown(client, "SIGTERM Signal");
            } catch (error) {
                console.error("❌ Fehler beim Bot-Status-System Shutdown:", error);
            }
            process.exit(0); 
        });

        console.log(`🔒 Bot-Instanz gesperrt (PID ${process.pid}).`);
    } catch (error) {
        console.error("❌ Bot-Instanz konnte nicht gesperrt werden:", error);
        process.exit(1);
    }
}

acquireBotInstanceLock();

const RP_CITIZEN_ROLE_ID = "1559659267257270313";
const RP_ANNOUNCEMENT_CHANNEL_ID = "1559659269190586411"; // Kanal für RP-Start/Stop Nachrichten
let RP_PING_ROLE_ID = RP_CITIZEN_ROLE_ID;

// =====================================================
// TEAM-ROLLEN
// =====================================================

const TEAM_ONE_ROLE_ID = "1559659272009289798";
const TEAM_KICK_LOG_CHANNEL_ID = "1539999973220986961";

const PROTECTED_COMMAND_ROLES = [
    "1539991231919165460",
    "1539991224071491584",
    "1539991222750285925",
    "1539991219034128535"
];

const TEAM_ROLES = {
    "Founder": "1539991218065379400",
    "Owner": "1539991220787609681",
    "Co-Owner": "1539991221836058634",
    "Leitende Projektleitung": "1539991226584146162",
    "Projektleitung": "1539991229016572008",
    "Stellvertretende Projektleitung": "1539991230853812377",
    "Leitender Direktor": "1539991232858689556",
    "Direktor": "1539991233777238107",
    "Stellvertretender Direktor": "1539991234377027625",
    "Leitender Manager": "1539991238105768047",
    "Manager": "1539991240349851688",
    "Stellvertretender Manager": "1539991241880633344",
    "Leitende Teamleitung": "1539991243897962506",
    "Teamleitung": "1539991245160710174",
    "Stellvertretende Teamleitung": "1539991247094288405",
    "Fraktionsverwaltung": "1539991250005000286",
    "Stellvertretende Fraktionsverwaltung": "1539991251284135997",
    "Ausbilder": "1539991252957794415",
    "Stellvertretender Ausbilder": "1539991254719406170",
    "Eventleitung": "1539991257508618240",
    "Stellvertretende Eventleitung": "1539991258708320386",
    "Head of Admin": "1539991261468041277",
    "Senior Admin": "1539991263388897361",
    "Administrator": "1539991264718618705",
    "Junior Administrator": "1539991265901543577",
    "Head Mod": "1539991268615131217",
    "Senior Moderator": "1539991269911306271",
    "Moderator": "1539991270817271818",
    "Junior Moderator": "1539991271589019742",
    "Head Sub": "1539991274197614703",
    "Senior Sub": "1539991275439128616",
    "Sub": "1539991276588503160",
    "Test Sub": "1539991277226172447"
};

const TEAM_RANK_EMOJIS = {
    "Founder": "👑",
    "Owner": "⭐",
    "Co-Owner": "🛡️",
    "Leitende Projektleitung": "🎯",
    "Projektleitung": "📋",
    "Stellvertretende Projektleitung": "📊",
    "Leitender Direktor": "🏢",
    "Direktor": "💼",
    "Stellvertretender Direktor": "📈",
    "Leitender Manager": "👔",
    "Manager": "🗂️",
    "Stellvertretender Manager": "📁",
    "Leitende Teamleitung": "🎮",
    "Teamleitung": "🎯",
    "Stellvertretende Teamleitung": "📋",
    "Fraktionsverwaltung": "🚔",
    "Stellvertretende Fraktionsverwaltung": "👮",
    "Ausbilder": "🎓",
    "Stellvertretender Ausbilder": "📚",
    "Eventleitung": "🎉",
    "Stellvertretende Eventleitung": "🎊",
    "Head of Admin": "🔧",
    "Senior Admin": "⚙️",
    "Administrator": "🔨",
    "Junior Administrator": "🛠️",
    "Head Mod": "👑",
    "Senior Moderator": "⭐",
    "Moderator": "🛡️",
    "Junior Moderator": "🎯",
    "Head Sub": "🏢",
    "Senior Sub": "💼",
    "Sub": "📋",
    "Test Sub": "🧪"
};

// =====================================================
// TEAM-NAMETAG-SYSTEM (AUTOMATISCH)
// =====================================================
// - Teamrollen, Dev und die Sonderrollen Ultra VIP, VIP, Partner
//   und Bürger bekommen automatisch einen festen
//   Nickname. Hat ein User mehrere dieser Rollen, wird
//   ausschließlich die ranghöchste (= erste passende in der
//   kombinierten Liste, Teamrollen zuerst) verwendet.
// - Hat ein User keine dieser Rollen (mehr), wird ein zuvor von
//   diesem System gesetzter Nametag entfernt und der normale
//   Discord-Name wiederhergestellt.
// - Die frühere separate Bürger-Nickname-Logik (altes Format
//   "[Bürger] <Name>" inkl. eigener "hasHigherRole"-Prüfung) wurde
//   vollständig entfernt. Die Bürger-Rolle ist jetzt ganz normal
//   Teil dieses Systems (neues Format "ECRP ✘ Bürger ✗ <Name>").

const DEV_ROLE_ID = "1539991224071491584";

// Reihenfolge = Rang (ranghöchste Rolle zuerst)
const TEAM_NICKNAME_ROLES = [
    { roleId: "1559659267441819689", label: "Founder" },
    { roleId: "1559659267408134201", label: "Owner" },
    { roleId: "1559659267408134200", label: "Co.Owner" },
    { roleId: "1559659267395428541", label: "Dev" },
    { roleId: "1561119043983773696", label: "Stv.Dev" },
    { roleId: "1559659267395428537", label: "LPL" },
    { roleId: "1559659267395428536", label: "PL" },
    { roleId: "1559659267395428535", label: "Stv.PL" },
    { roleId: "1559659267378778220", label: "HAS" },
    { roleId: "1559659267378778219", label: "Stv.HAS" },
    { roleId: "1559659267378778216", label: "LDT" },
    { roleId: "1559659267378778215", label: "DT" },
    { roleId: "1559659267378778214", label: "Stv.DT" },
    { roleId: "1559659267349553269", label: "LMA" },
    { roleId: "1559659267349553268", label: "MA" },
    { roleId: "1559659267349553267", label: "Stv.MA" },
    { roleId: "1559659267349553264", label: "LSV" },
    { roleId: "1559659267349553263", label: "SV" },
    { roleId: "1559659267324256375", label: "Stv.SV" },
    { roleId: "1559659267324256370", label: "LTL" },
    { roleId: "1559659267324256369", label: "TL" },
    { roleId: "1559659267324256368", label: "Stv.TL" },
    { roleId: "1559659267307339846", label: "LAS" },
    { roleId: "1559659267307339845", label: "Stv.LAS" },
    { roleId: "1559659267307339842", label: "FV" },
    { roleId: "1559659267307339841", label: "Stv.FV" },
    { roleId: "1559659267307339838", label: "EL" },
    { roleId: "1559659267307339837", label: "Stv.EL" },
    { roleId: "1559659267299217466", label: "Head Admin" },
    { roleId: "1559659267299217465", label: "Sr.Admin" },
    { roleId: "1559659267299217464", label: "Admin" },
    { roleId: "1559659267299217463", label: "Jr.Admin" },
    { roleId: "1559659267299217461", label: "Head Mod" },
    { roleId: "1559659267299217460", label: "Sr.Mod" },
    { roleId: "1559659267299217459", label: "Mod" },
    { roleId: "1559659267269595155", label: "Jr.Mod" },
    { roleId: "1559659267269595153", label: "Head Sup" },
    { roleId: "1559659267269595152", label: "Sr.Sup" },
    { roleId: "1559659267269595151", label: "Sup" },
    { roleId: "1559659267269595150", label: "T-Sup" },
    { roleId: "1559659267257270321", label: "Helfer" },
    { roleId: "1559659267257270320", label: "TF" },
    { roleId: "1559659267257270314", label: "TS" }
];

function getConfiguredTeamNicknameRoles() {
    try {
        const configPath = path.join(__dirname, "team-roles-config.json");
        if (!fs.existsSync(configPath)) {
            return [];
        }

        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const categories = Array.isArray(config.roleHierarchy)
            ? config.roleHierarchy
            : [];

        return categories.flatMap(category =>
            (Array.isArray(category.roles) ? category.roles : [])
                .filter(role =>
                    typeof role.id === "string" &&
                    typeof role.name === "string" &&
                    !role.name.includes("━")
                )
                .map(role => ({
                    roleId: role.id,
                    label: role.name.match(/^\[([^\]]+)\]/)?.[1] ||
                        role.name.replace(/^[《\s]+|[》\s]+$/g, "").trim(),
                    roleName: role.name
                }))
        );
    } catch (error) {
        console.error("❌ Fehler beim Laden der Teamrollen-Konfiguration:", error);
        return [];
    }
}

const CONFIGURED_TEAM_NICKNAME_ROLES = getConfiguredTeamNicknameRoles();

function getAllTeamNicknameRoles() {
    const rolesById = new Map();

    for (const entry of [...TEAM_NICKNAME_ROLES, ...CONFIGURED_TEAM_NICKNAME_ROLES]) {
        if (!rolesById.has(entry.roleId)) {
            rolesById.set(entry.roleId, entry);
        }
    }

    return [...rolesById.values()];
}

// Zusätzliche Rollen, die ebenfalls automatisch einen festen
// Nickname bekommen (rangmäßig unterhalb der Teamrollen oben).
// Jeder Eintrag legt über buildNickname() das genaue Format fest.
// %USERNAME% wird dabei immer durch den aktuellen Discord-
// Benutzernamen ersetzt.
const BOOSTER_ROLE_ID = "1561371960884334683";
const VIP_PLUS_ROLE_ID = "1559659267257270319";
const VIP_ROLE_ID = "1559659267257270318";
const PARTNER_ROLE_ID = "1559659267257270317";
const BUERGER_ROLE_ID = "1559659267257270313";

const SPECIAL_NICKNAME_ROLES = [
    {
        roleId: BOOSTER_ROLE_ID,
        label: "Booster",
        buildNickname: username => `Booster x ${username}`
    },
    {
        roleId: VIP_PLUS_ROLE_ID,
        label: "VIP+",
        buildNickname: username => `VIP+ x ${username}`
    },
    {
        roleId: VIP_ROLE_ID,
        label: "VIP",
        buildNickname: username => `VIP x ${username}`
    },
    {
        roleId: PARTNER_ROLE_ID,
        label: "Partner",
        buildNickname: username => `Partner x ${username}`
    },
    {
        roleId: BUERGER_ROLE_ID,
        label: "V｜Bürger",
        buildNickname: username => `V｜Bürger x ${username}`
    }
];

// =====================================================
// WARN
// =====================================================

const WARN_LEVEL_ROLE_IDS = [
    "1559659267219390592",
    "1559659267219390591",
    "1559659267219390590"
];

// =====================================================
// WARN-SPEICHERSYSTEM (Team-Panel Erweiterung)
// =====================================================

const WARN_STORAGE_FILE = path.join(__dirname, "team-warns.json");

// Verfügbare Dauern beim Erstellen einer Warnung
const WARN_DURATION_OPTIONS = [
    { value: "1h", label: "1 Stunde", ms: 60 * 60 * 1000 },
    { value: "6h", label: "6 Stunden", ms: 6 * 60 * 60 * 1000 },
    { value: "12h", label: "12 Stunden", ms: 12 * 60 * 60 * 1000 },
    { value: "1d", label: "1 Tag", ms: 24 * 60 * 60 * 1000 },
    { value: "3d", label: "3 Tage", ms: 3 * 24 * 60 * 60 * 1000 },
    { value: "7d", label: "7 Tage", ms: 7 * 24 * 60 * 60 * 1000 },
    { value: "14d", label: "14 Tage", ms: 14 * 24 * 60 * 60 * 1000 },
    { value: "30d", label: "30 Tage", ms: 30 * 24 * 60 * 60 * 1000 },
    { value: "permanent", label: "Dauerhaft", ms: null }
];

// Verfügbare Schritte zum Verkürzen einer bestehenden Warnung
const WARN_SHORTEN_OPTIONS = WARN_DURATION_OPTIONS.filter(option =>
    ["1h", "6h", "12h", "1d", "3d", "7d"].includes(option.value)
);

// Verfügbare Schritte zum Verlängern einer bestehenden Warnung
const WARN_EXTEND_OPTIONS = WARN_DURATION_OPTIONS.filter(option =>
    ["1h", "6h", "12h", "1d", "3d", "7d", "30d"].includes(option.value)
);

function getWarnDurationOption(value) {
    return WARN_DURATION_OPTIONS.find(option => option.value === value) || null;
}

function loadWarnStorage() {
    try {
        if (!fs.existsSync(WARN_STORAGE_FILE)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(WARN_STORAGE_FILE, "utf8")) || {};
    } catch (error) {
        console.error("❌ Fehler beim Laden der Warn-Daten:", error);
        return {};
    }
}

function saveWarnStorage() {
    try {
        fs.writeFileSync(WARN_STORAGE_FILE, JSON.stringify(WARN_STORAGE, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Warn-Daten:", error);
        return false;
    }
}

let WARN_STORAGE = loadWarnStorage();

function getUserWarns(guildId, userId) {
    if (!WARN_STORAGE[guildId]) {
        WARN_STORAGE[guildId] = {};
    }
    if (!WARN_STORAGE[guildId][userId]) {
        WARN_STORAGE[guildId][userId] = [];
    }
    return WARN_STORAGE[guildId][userId];
}

function generateWarnId() {
    return require("crypto").randomBytes(4).toString("hex");
}

function addWarnEntry(guildId, userId, entry) {
    const warns = getUserWarns(guildId, userId);
    const warn = {
        id: generateWarnId(),
        ...entry
    };
    warns.push(warn);
    if (!saveWarnStorage()) {
        warns.pop();
        throw new Error("Die Verwarnung konnte nicht dauerhaft gespeichert werden.");
    }
    return warn;
}

function findWarnEntry(guildId, userId, warnId) {
    return getUserWarns(guildId, userId).find(warn => warn.id === warnId) || null;
}

function removeWarnEntry(guildId, userId, warnId) {
    const warns = getUserWarns(guildId, userId);
    const index = warns.findIndex(warn => warn.id === warnId);
    if (index === -1) {
        return null;
    }
    const [removed] = warns.splice(index, 1);
    saveWarnStorage();
    return removed;
}

// Liefert eine Anzeige-Nummer ("Warn #3") für eine Warnung anhand ihrer
// Position in der gespeicherten Liste - nur für Log-Zwecke.
function getWarnDisplayLabel(guildId, userId, warnId) {
    const warns = getUserWarns(guildId, userId);
    const index = warns.findIndex(entry => entry.id === warnId);
    return index === -1 ? `#${warnId}` : `#${index + 1}`;
}

function isWarnPermanent(warn) {
    return !warn.expiresAt;
}

function formatWarnExpiry(warn) {
    if (isWarnPermanent(warn)) {
        return "Dauerhaft";
    }
    return formatGermanTime(new Date(warn.expiresAt));
}

// Maximal erlaubte Anzahl gleichzeitig aktiver Warnungen pro Mitglied.
const MAX_ACTIVE_WARNS = 3;

// Liefert die aktuell aktiven (nicht abgelaufenen) Warnungen eines Mitglieds.
function getActiveWarns(guildId, userId) {
    return getUserWarns(guildId, userId).filter(warn =>
        isWarnPermanent(warn) || new Date(warn.expiresAt).getTime() > Date.now()
    );
}

// =====================================================
// TEAM-STATISTIK – KONFIGURATION & ZUSATZ-SPEICHER
// =====================================================
// Rolle, die alle Teammitglieder (unabhängig vom Rang) erhalten und
// die für die Zählung "Teammitglieder gesamt" in !teamstatistik
// verwendet wird.
const TEAMSTATISTIK_ROLE_ID = "1539991280396935219";

// Speichert den jeweils letzten Up-Rank pro Mitglied, damit dieser in
// !teamstatistik angezeigt werden kann. Wird ausschließlich beim
// tatsächlichen Bestätigen eines Up-Ranks im bereits bestehenden
// Teamverwaltungs-Ablauf befüllt (siehe "team_uprank_confirm_") -
// die bestehende Up-Rank-Logik selbst wird dabei nicht verändert.
const UPRANK_HISTORY_FILE = path.join(__dirname, "team-uprank-history.json");

function loadUprankHistory() {
    try {
        if (!fs.existsSync(UPRANK_HISTORY_FILE)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(UPRANK_HISTORY_FILE, "utf8")) || {};
    } catch (error) {
        console.error("❌ Fehler beim Laden der Uprank-Historie:", error);
        return {};
    }
}

function saveUprankHistory() {
    try {
        fs.writeFileSync(UPRANK_HISTORY_FILE, JSON.stringify(UPRANK_HISTORY, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Uprank-Historie:", error);
        return false;
    }
}

let UPRANK_HISTORY = loadUprankHistory();

function getLastUprank(guildId, userId) {
    return (UPRANK_HISTORY[guildId] && UPRANK_HISTORY[guildId][userId]) || null;
}

function setLastUprank(guildId, userId, entry) {
    if (!UPRANK_HISTORY[guildId]) {
        UPRANK_HISTORY[guildId] = {};
    }
    UPRANK_HISTORY[guildId][userId] = entry;
    saveUprankHistory();
    return entry;
}

// Speichert alle Team-Kicks pro Mitglied, damit in !teamstatistik
// erkennbar ist, ob bereits ein Team-Kick vorhanden ist. Wird
// ausschließlich beim tatsächlichen Ausführen eines Team-Kicks im
// bereits bestehenden Teamverwaltungs-Ablauf befüllt - die
// bestehende Kick-Logik selbst wird dabei nicht verändert.
const TEAM_KICK_HISTORY_FILE = path.join(__dirname, "team-kick-history.json");

function loadTeamKickHistory() {
    try {
        if (!fs.existsSync(TEAM_KICK_HISTORY_FILE)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(TEAM_KICK_HISTORY_FILE, "utf8")) || {};
    } catch (error) {
        console.error("❌ Fehler beim Laden der Team-Kick-Historie:", error);
        return {};
    }
}

function saveTeamKickHistory() {
    try {
        fs.writeFileSync(TEAM_KICK_HISTORY_FILE, JSON.stringify(TEAM_KICK_HISTORY, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Team-Kick-Historie:", error);
        return false;
    }
}

let TEAM_KICK_HISTORY = loadTeamKickHistory();

function getTeamKicks(guildId, userId) {
    if (!TEAM_KICK_HISTORY[guildId]) {
        TEAM_KICK_HISTORY[guildId] = {};
    }
    if (!TEAM_KICK_HISTORY[guildId][userId]) {
        TEAM_KICK_HISTORY[guildId][userId] = [];
    }
    return TEAM_KICK_HISTORY[guildId][userId];
}

function addTeamKickEntry(guildId, userId, entry) {
    const kicks = getTeamKicks(guildId, userId);
    kicks.push(entry);
    saveTeamKickHistory();
    return entry;
}

// Berechnet aus den bereits vorhandenen Warn-Feldern (createdAt/
// expiresAt) eine sprechende Dauer-Angabe für die Anzeige in
// !teamstatistik. Es werden dabei keine neuen/erfundenen Werte
// gespeichert - die Dauer ergibt sich rein rechnerisch aus den
// bereits vorhandenen, gespeicherten Warn-Daten.
function getWarnDurationLabel(warn) {
    if (isWarnPermanent(warn)) {
        return "Dauerhaft";
    }

    const diffMs = new Date(warn.expiresAt).getTime() - new Date(warn.createdAt).getTime();
    const matchingOption = WARN_DURATION_OPTIONS.find(option => option.ms === diffMs);

    if (matchingOption) {
        return matchingOption.label;
    }

    const diffHours = diffMs / (60 * 60 * 1000);

    if (diffHours < 24) {
        return `${Math.max(1, Math.round(diffHours))} Stunde(n)`;
    }

    return `${Math.round(diffHours / 24)} Tag(e)`;
}

// Baut das Detail-Embed für ein einzelnes Teammitglied in
// !teamstatistik: 👤 Mitglied, ⏫ letzter Uprank, ⚠️ Team-Warns
// insgesamt und ❌ ob bereits ein Team-Kick vorhanden ist. Nutzt
// dabei ausschließlich bereits vorhandene Team-/Warn-Daten.
function buildTeamStatistikMemberEmbed(guild, member) {
    const guildId = guild.id;
    const lastUprank = getLastUprank(guildId, member.id);
    const totalWarns = getUserWarns(guildId, member.id).length;
    const kicks = getTeamKicks(guildId, member.id);

    const lastUprankValue = lastUprank
        ? `**${lastUprank.roleName}**\n` +
          `Grund: \`${lastUprank.reason}\`\n` +
          `Durch: \`${lastUprank.moderatorTag}\`\n` +
          `Am: \`${formatGermanTime(new Date(lastUprank.timestamp))}\``
        : "Kein Up-Rank vorhanden.";

    const lastKick = kicks.length > 0 ? kicks[kicks.length - 1] : null;
    const teamKickValue = lastKick
        ? `Ja (${kicks.length}x)\n` +
          `Zuletzt am: \`${formatGermanTime(new Date(lastKick.timestamp))}\`\n` +
          `Durch: \`${lastKick.moderatorTag}\``
        : "Nein";

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📊 Team-Statistik – Mitgliedsdetails")
        .addFields(
            {
                name: "👤 Mitglied",
                value: `${member}`,
                inline: false
            },
            {
                name: "⏫ Letzter Uprank",
                value: lastUprankValue,
                inline: false
            },
            {
                name: "⚠️ Team-Warns insgesamt",
                value: `${totalWarns}`,
                inline: false
            },
            {
                name: "❌ Team-Kick vorhanden",
                value: teamKickValue,
                inline: false
            }
        )
        .setFooter({
            text: teamLogFooterText()
        })
        .setTimestamp();
}

// Speichert temporär den Grund einer Warnung zwischen Modal-Eingabe
// und finaler Bestätigung (Schlüssel: moderatorId_targetId)
const pendingWarnReasons = new Map();
const processedTeamActionInteractions = new Set();

function claimTeamActionInteraction(interaction) {
    if (processedTeamActionInteractions.has(interaction.id)) {
        return false;
    }
    processedTeamActionInteractions.add(interaction.id);
    const cleanupTimer = setTimeout(() => {
        processedTeamActionInteractions.delete(interaction.id);
    }, 5 * 60 * 1000);
    cleanupTimer.unref?.();
    return true;
}

// Speichert temporär den Grund eines Down-Ranks zwischen Modal-Eingabe
// und finaler Bestätigung (Schlüssel: moderatorId_targetId)
const pendingDegradeReasons = new Map();

// Speichert temporär den Grund eines Up-Ranks zwischen Modal-Eingabe
// und finaler Bestätigung (Schlüssel: moderatorId_targetId)
const pendingUprankReasons = new Map();

// =====================================================
// NUKE-BEFEHL ENTFERNT - Nicht benötigt für RP-Server
// =====================================================

async function syncWarnRoleForMember(member) {
    const activeWarnCount = Math.min(getActiveWarns(member.guild.id, member.id).length, MAX_ACTIVE_WARNS);
    const desiredRoleId = activeWarnCount > 0
        ? WARN_LEVEL_ROLE_IDS[activeWarnCount - 1]
        : null;
    const allWarnRoleIds = WARN_LEVEL_ROLE_IDS;
    const warnRole = desiredRoleId
        ? await member.guild.roles.fetch(desiredRoleId).catch(() => null)
        : null;
    if (desiredRoleId && !warnRole) {
        throw new Error(`Warnrolle ${desiredRoleId} wurde auf dem Server nicht gefunden.`);
    }

    const rolesToRemove = allWarnRoleIds.filter(roleId =>
        roleId !== desiredRoleId && member.roles.cache.has(roleId)
    );

    if (rolesToRemove.length > 0 || (warnRole && !member.roles.cache.has(warnRole.id))) {
        const botMember = member.guild.members.me || await member.guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            throw new Error("Dem Bot fehlt die Berechtigung „Rollen verwalten“.");
        }

        const managedRoles = rolesToRemove
            .map(roleId => member.guild.roles.cache.get(roleId))
            .filter(Boolean);
        if (warnRole) {
            managedRoles.push(warnRole);
        }
        const blockedRole = managedRoles.find(role =>
            botMember.roles.highest.position <= role.position
        );
        if (blockedRole) {
            throw new Error(`Die Warnrolle „${blockedRole.name}“ steht auf oder über der höchsten Bot-Rolle.`);
        }
    }

    if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove, "Warnstufe aktualisieren");
    }

    if (desiredRoleId && !member.roles.cache.has(desiredRoleId)) {
        await member.roles.add(warnRole, "Warnstufe aktualisieren");
    }
}

// =====================================================
// HÄUSER
// =====================================================

const HOUSES_PERMISSION_ROLE_ID = "1539991249254355014";

// =====================================================
// HÄUSER DATEIEN – CLIENT 1
// =====================================================

const HOUSES_FILE_1 =
    path.join(__dirname, "houses1.json");

const HOUSES_PANEL_FILE_1 =
    path.join(__dirname, "houses-panel1.json");

const HOUSES_LIST_FILE_1 =
    path.join(__dirname, "houses-list1.json");


// =====================================================
// HÄUSER DATEIEN – CLIENT 2
// =====================================================

const HOUSES_FILE_2 =
    path.join(__dirname, "houses2.json");

const HOUSES_PANEL_FILE_2 =
    path.join(__dirname, "houses-panel2.json");

const HOUSES_LIST_FILE_2 =
    path.join(__dirname, "houses-list2.json");


// =====================================================
// SERVER IDs FÜR DAS HÄUSERSYSTEM
// =====================================================

// NoVex RP
const HOUSE_SERVER_1_ID =
    "1510593847972073653";

// Vero RP-VC
const HOUSE_SERVER_2_ID =
    "1540470358606610632";


// =====================================================
// SERVER → CLIENT ERMITTELN
// =====================================================

function getHouseClientNumber(
    guildOrChannel
) {
    const guildId =
        guildOrChannel?.guild?.id ||
        guildOrChannel?.id;

    // Vero RP-VC bleibt Client 2, jeder andere Server
    // (egal welche Guild-ID) läuft automatisch als Client 1.
    // Dadurch funktioniert das Häuser-System auf jedem Server,
    // ohne dass die ID vorher manuell eingetragen werden muss.
    if (
        guildId === HOUSE_SERVER_2_ID
    ) {
        return 2;
    }

    return 1;
}

// =====================================================
// TEAM LOGS
// =====================================================

const TEAM_LOG_CHANNEL_ID = "TEAM_LOG_CHANNEL_ID";
const TEAMLIST_AUTO_UPDATE_CHANNEL_ID = "1539989948273401999";



// =====================================================
// CLIENT
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,

        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildScheduledEvents
    ]
});

// =====================================================
// 🎫 VEXO RP | TICKETSYSTEM STARTEN
// =====================================================

const {
    initializeTicketSystem
} = require("./Ticket-System.js");

initializeTicketSystem(client);

console.log("🎫 NoVex RP Ticketsystem wurde gestartet.");


 // =====================================================
// 📋 VEXO RP | DISCORD-LOGGING STARTEN
// =====================================================

registerDiscordLogger(client);

// =====================================================
// 🏢 VEXO RP | BÜRO-WARTERAUM STARTEN
// =====================================================

const {
    initializeBueroWarteraum
} = require("./Buero-Warteraum.js");

initializeBueroWarteraum(client);

// =====================================================
// 👋 VEXO RP | ÖFFENTLICHES AUSREISE-SYSTEM
// =====================================================

const VEXO_AUSREISE_KANAL = "1559659268494327929";

client.on("guildMemberRemove", async (member) => {
    try {
        const channel = await member.guild.channels
            .fetch(VEXO_AUSREISE_KANAL)
            .catch(() => null);

        if (!channel?.isTextBased()) return;

        const user = member.user;

        const embed = new EmbedBuilder()
            .setColor(0x00BFFF)
            .setTitle("👋 Tschüss! | NoVex RP")
            .setDescription(
                `🌙 **Auf Wiedersehen bei NoVex RP!**\n\n` +
                `👋 **${user.username}** hat unseren Server verlassen.\n\n` +
                `💔 Schade, dass du uns verlässt!\n` +
                `Wir bedanken uns für deine Zeit bei NoVex RP und hoffen, ` +
                `dass du eines Tages wieder zurückkommst.\n\n` +
                `🤝 Bis dahin wünschen wir dir alles Gute und viel Erfolg!\n\n` +
                `💙 **Dein NoVex-RP-Team sagt Tschüss!**`
            )
            .setThumbnail(
                user.displayAvatarURL({ size: 256 })
            )
            .setFooter({
                text: "💙 Vexo RP • Ausreise"
            })
            .setTimestamp();

        await channel.send({
            embeds: [embed],
            allowedMentions: { parse: [] }
        });

    } catch (error) {
        console.error("❌ Ausreise-System Fehler:", error);
    }
});

// =====================================================
// VEXO RP VORLAGEN-SYSTEM STARTEN
// =====================================================

initializeVorlagenSystem(client);

// =====================================================
// NEXORACLOUD DASHBOARD
// =====================================================

const startDashboard = require("./Dashboard/server");

startDashboard(client);

// =====================================================
// BERECHTIGUNGEN
// =====================================================

function isBotOwner(member) {
    return member?.id === BOT_OWNER_ID;
}

function hasSlashCommandPermission(interaction) {
    const roles = interaction.member?.roles;
    const hasRole = roleId =>
        roles?.cache?.has(roleId) === true ||
        (Array.isArray(roles) && roles.includes(roleId));

    return (
        interaction.user?.id === BOT_OWNER_ID ||
        interaction.user?.id === interaction.guild?.ownerId ||
        hasRole(TEAM_ROLES.Founder) ||
        hasRole(TEAM_ROLES.Owner) ||
        hasRole(TEAM_ROLES["Co-Owner"]) ||
        hasRole(DEV_ROLE_ID)
    );
}

function hasRestartPermission(member) {
    if (!member) {
        return false;
    }

    return (
        isBotOwner(member) ||
        member.roles.cache.has(RESTART_ROLE_ID)
    );
}

function hasNameTagSetPermission(member) {
    return Boolean(
        member &&
        member.id === BOT_OWNER_ID
    );
}

function hasUprankDownrankPermission(member) {
    return hasTeamPermission(member);
}

function hasProtectedCommandPermission(member) {
    return (
        isBotOwner(member) ||
        member?.permissions?.has(
            PermissionsBitField.Flags.Administrator
        )
    );
}

function hasTeamPermission(member) {
    if (!member) {
        return false;
    }

    if (
        isBotOwner(member) ||
        member.permissions?.has(PermissionsBitField.Flags.Administrator)
    ) {
        return true;
    }

    const authorizedRoleName = /founder|owner|developer|projektleitung|teamleitung|admin/i;
    return CONFIGURED_TEAM_NICKNAME_ROLES.some(entry =>
        authorizedRoleName.test(entry.roleName) &&
        member.roles?.cache?.has(entry.roleId)
    );
}

function hasConfiguredTeamRole(member) {
    return getAllTeamNicknameRoles().some(entry =>
        member?.roles?.cache?.has(entry.roleId)
    );
}

// =====================================================
// TEAM-PANEL: ROLLEN-HILFSFUNKTIONEN (Up-Rank/Degradieren/Kick)
// =====================================================

// Liefert konfigurierte und vorhandene Teamrollen unterhalb der höchsten
// Bot-Rolle. Die Rollen-Auswahl wird anschließend auf Discord-konforme
// Seiten mit maximal 25 Optionen aufgeteilt.
function getAssignableTeamRoles(guild) {
    const botHighestPosition = guild.members.me?.roles?.highest?.position;
    if (typeof botHighestPosition !== "number") {
        return [];
    }

    return getAllTeamNicknameRoles()
        .map(entry => ({
            ...entry,
            role: guild.roles.cache.get(entry.roleId)
        }))
        .filter(entry => entry.role && entry.role.position < botHighestPosition)
        .sort((a, b) => b.role.position - a.role.position);
}

async function refreshTeamRoleData(guild) {
    await guild.roles.fetch();
    if (!guild.members.me) {
        await guild.members.fetchMe();
    }
}

function getNoAssignableTeamRolesMessage(guild) {
    const configuredRoles = getAllTeamNicknameRoles();
    const existingRoles = configuredRoles
        .map(entry => guild.roles.cache.get(entry.roleId))
        .filter(Boolean);

    if (existingRoles.length === 0) {
        return `Keine der ${configuredRoles.length} konfigurierten Teamrollen wurde auf diesem Server gefunden. Prüfe team-roles-config.json.`;
    }

    const botHighestRole = guild.members.me?.roles?.highest;
    const blockedRoles = existingRoles.filter(role =>
        !botHighestRole || role.position >= botHighestRole.position
    );

    if (blockedRoles.length > 0) {
        const highestBlockedRole = blockedRoles.reduce((highest, role) =>
            role.position > highest.position ? role : highest
        );
        return `Die Teamrollen liegen über oder auf der Bot-Rolle. Verschiebe die Bot-Rolle in den Servereinstellungen über **${highestBlockedRole.name}** und versuche es erneut.`;
    }

    return "Keine vergebbaren Teamrollen gefunden. Prüfe die Teamrollen-Konfiguration und die Berechtigung „Rollen verwalten“ des Bots.";
}

function createTeamRoleSelectionPayload(guild, target, action, requestedPage = 0) {
    const roles = getAssignableTeamRoles(guild);
    const pageSize = 25;
    const pageCount = Math.max(1, Math.ceil(roles.length / pageSize));
    const page = Math.min(Math.max(requestedPage, 0), pageCount - 1);
    const prefix = action === "uprank" ? "team_uprank_role_" : "team_degrade_role_";
    const pagePrefix = action === "uprank" ? "team_uprank_page_" : "team_degrade_page_";
    const options = roles
        .slice(page * pageSize, (page + 1) * pageSize)
        .map(entry =>
            new StringSelectMenuOptionBuilder()
                .setLabel((entry.role.name || entry.roleName || entry.label).slice(0, 100))
                .setValue(entry.roleId)
        );

    const components = [];
    if (options.length > 0) {
        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`${prefix}${target.id}`)
                    .setPlaceholder("🎯 Rolle auswählen")
                    .addOptions(options)
            )
        );
    }

    if (pageCount > 1) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${pagePrefix}${target.id}_${page - 1}`)
                    .setLabel("Zurück")
                    .setEmoji("◀️")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`${pagePrefix}${target.id}_${page + 1}`)
                    .setLabel(`Seite ${page + 1}/${pageCount}`)
                    .setEmoji("▶️")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= pageCount - 1)
            )
        );
    }

    return {
        content: `**Welche Rolle soll ${target} bekommen?**` +
            (pageCount > 1 ? ` (Seite ${page + 1}/${pageCount})` : ""),
        components
    };
}

// Liefert die ranghöchste konfigurierte Teamrolle eines Mitglieds oder null.
function getMemberCurrentTeamRoleEntry(member) {
    for (const entry of getAllTeamNicknameRoles()) {
        if (member.roles.cache.has(entry.roleId)) {
            return entry;
        }
    }
    return null;
}

// Entfernt von einem Mitglied alle konfigurierten Team-/Rangrollen.
// Die Bürgerrolle wird dabei niemals angefasst.
async function removeAllTeamRoles(member, reason) {
    const rolesToRemove = getAllTeamNicknameRoles()
        .map(entry => entry.roleId)
        .filter(roleId => roleId !== BUERGER_ROLE_ID && member.roles.cache.has(roleId));

    if (rolesToRemove.length === 0) {
        return [];
    }

    await member.roles.remove(rolesToRemove, reason);
    return rolesToRemove;
}

function hasHousesPermission(member) {
    return Boolean(
        member &&
        (
            member.id === BOT_OWNER_ID ||
            member.roles.cache.has(
                HOUSES_PERMISSION_ROLE_ID
            )
        )
    );
}

function errorMessage(text) {
    return {
        content: `❌ ${text}`,
        flags: MessageFlags.Ephemeral
    };
}

// =====================================================
// ALLGEMEINE LOG-HILFSFUNKTIONEN
// =====================================================

function getChannelLink(
    guildId,
    channelId,
    messageId = null
) {
    if (!guildId || !channelId) {
        return null;
    }

    if (messageId) {
        return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
    }

    return `https://discord.com/channels/${guildId}/${channelId}`;
}

async function sendLog(
    guild,
    channelId,
    embed
) {
    try {
        const channel =
            await guild.channels.fetch(
                channelId
            ).catch(
                () => null
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return false;
        }

        await channel.send({
            embeds: [embed]
        });

        return true;

    } catch (error) {
        console.error(
            `❌ Fehler beim Loggen in Kanal ${channelId}:`,
            error
        );

        return false;
    }
}

function formatGermanTime(date = new Date()) {
    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }).format(date);
}

// =====================================================
// TEAMVERWALTUNG – EINHEITLICHES LOG-DESIGN (Uprank/
// Downrank/Warn/Kick)
// =====================================================

// Liefert "TT.MM.JJJJ • HH:MM Uhr" für das "🕐 Wann"-Feld der
// Teamverwaltungs-Logs.
function formatTeamLogTimestamp(date = new Date()) {
    const datePart = new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
    const timePart = new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
    return `${datePart} • ${timePart} Uhr`;
}

// Lange horizontale Trennlinie für das schmale, vertikale
// Teamverwaltungs-Log-Layout (wird als reiner Text in der
// Embed-Description verwendet, keine addFields()/inline-Fields).
const TEAM_LOG_DIVIDER = "──────────────────────────";

// Einheitlicher Footer für alle Teamverwaltungs-Logs - verwendet den
// vorhandenen Bot-/Systemnamen statt eines fest codierten Textes.
function teamLogFooterText() {
    return `${SERVER_NAME} System ✧ Team-System`;
}

async function logBotEvent(
    guild,
    title,
    fields = [],
    color = 0x5865F2,
    extra = {}
) {
    try {
        if (!guild) {
            return false;
        }

        const statsConfig = getGuildStatisticsConfig(guild.id);
        const targetChannelId = statsConfig.channelId || extra.channelId;

        if (!targetChannelId) {
            return false;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setTimestamp()
            .setFooter({
                text: `${SERVER_NAME} • Statistik & Logs`
            });

        if (fields.length > 0) {
            embed.addFields(
                fields.map(field => ({
                    name: field.name,
                    value: String(field.value),
                    inline: false
                }))
            );
        }

        const sent = await sendLog(guild, targetChannelId, embed);
        if (sent && extra.updatePanel !== false) {
            await updateStatisticsPanelForGuild(guild);
        }

        return sent;
    } catch (error) {
        console.error("❌ Fehler beim Bot-Event-Log:", error);
        return false;
    }
}

async function buildStatisticsEmbed(guild) {
    try {
        const verifiedRole = await guild.roles.fetch(VERIFIED_ROLE_ID).catch(() => null);
        const verifiedCount = verifiedRole ? verifiedRole.members.size : 0;
        const teamCount = guild.members.cache.filter(member => {
            return Object.values(TEAM_ROLES).some(roleId => member.roles.cache.has(roleId));
        }).size;
        const commandsExecuted = Number(BOT_STATS.commandsExecuted || 0);
        const verifications = Number(BOT_STATS.verificationsCompleted || 0);
        const memberCount = guild.memberCount || guild.members.cache.size || 0;

        return new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("📊 BOT-STATISTIK")
            .setDescription(`Automatische Statistik für ${SERVER_NAME}`)
            .addFields(
                {
                    name: "👥 Verifizierte Mitglieder",
                    value: `→ ${verifiedCount}`,
                    inline: false
                },
                {
                    name: "📋 Teammitglieder",
                    value: `→ ${teamCount}`,
                    inline: false
                },
                {
                    name: "🤖 Commands ausgeführt",
                    value: `→ ${commandsExecuted}`,
                    inline: false
                },
                {
                    name: "🛡️ Verifizierungen",
                    value: `→ ${verifications}`,
                    inline: false
                },
                {
                    name: "👥 Server-Mitglieder",
                    value: `→ ${memberCount}`,
                    inline: false
                },
                {
                    name: "⚡ Bot-Status",
                    value: "→ Online",
                    inline: false
                },
                {
                    name: "🕐 Letzte Aktualisierung",
                    value: `→ ${formatGermanTime(new Date(BOT_STATS.lastUpdated || Date.now()))}`,
                    inline: false
                }
            )
            .setTimestamp(new Date())
            .setFooter({
                text: `${SERVER_NAME} • Statistik & Log-System`
            });
    } catch (error) {
        console.error("❌ Fehler beim Erstellen des Statistik-Embeds:", error);
        return new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("📊 BOT-STATISTIK")
            .setDescription("Statistik konnte nicht geladen werden.")
            .setFooter({ text: `${SERVER_NAME} • Statistik & Log-System` });
    }
}

async function updateStatisticsPanelForGuild(guild) {
    try {
        const config = getGuildStatisticsConfig(guild.id);
        if (!config.channelId) {
            return null;
        }

        const channel = await guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return null;
        }

        const embed = await buildStatisticsEmbed(guild);

        if (config.messageId) {
            const existing = await channel.messages.fetch(config.messageId).catch(() => null);
            if (existing) {
                await existing.edit({ embeds: [embed] });
                return existing;
            }
        }

        const sent = await channel.send({ embeds: [embed] });
        config.messageId = sent.id;
        saveBotSettings();
        return sent;
    } catch (error) {
        console.error("❌ Fehler beim Aktualisieren des Statistik-Panels:", error);
        return null;
    }
}

async function getLatestAuditLog(
    guild,
    type,
    targetId
) {
    try {
        const logs =
            await guild.fetchAuditLogs({
                type,
                limit: 10
            });

        const entry =
            logs.entries.find(
                item =>
                    item.target?.id === targetId &&
                    Date.now() -
                        item.createdTimestamp <
                        10000
            );

        return entry || null;

    } catch (error) {
        console.error(
            "❌ Audit-Log konnte nicht gelesen werden:",
            error.message
        );

        return null;
    }
}

// =====================================================
// ADMIN BENACHRICHTIGUNG
// =====================================================

async function sendAdminNotification(
    user,
    command,
    channel,
    messageId = null
) {
    try {
        const adminUser =
            await client.users.fetch(
                ADMIN_USER_ID
            ).catch(() => null);

        if (!adminUser) {
            console.log("⚠️ Admin-User konnte nicht gefunden werden.");
            return;
        }

        const channelLink =
            getChannelLink(
                channel?.guild?.id ||
                DEFAULT_GUILD_ID,
                channel?.id,
                messageId
            );

        const embed =
            new EmbedBuilder()
                .setColor(
                    0x5865F2
                )
                .setTitle(
                    "🔔 Befehl ausgeführt"
                )
                .addFields(
                    {
                        name:
                            "👤 Benutzer",
                        value:
                            `${user}\n${user.tag}`,
                        inline:
                            false
                    },
                    {
                        name:
                            "📝 Befehl",
                        value:
                            `\`!${command}\``,
                        inline:
                            false
                    },
                    {
                        name:
                            "👮 Ausgeführt von",
                        value:
                            `${user}\n${user.tag}`,
                        inline:
                            false
                    },
                    {
                        name:
                            "📁 Kanal",
                        value:
                            channelLink
                                ? `[${channel.name}](${channelLink})`
                                : "Unbekannt",
                        inline:
                            false
                    },
                    {
                        name:
                            "🕐 Zeitpunkt",
                        value:
                            new Date().toLocaleString(
                                "de-DE"
                            ),
                        inline:
                            false
                    }
                )
                .setTimestamp();

        await adminUser.send({
            embeds: [embed]
        });

    } catch (error) {
        if (error.code === 10013) {
            console.log("⚠️ Admin-User existiert nicht (Unknown User).");
        } else {
            console.log(
                "⚠️ Admin-DM konnte nicht gesendet werden:",
                error.message
            );
        }
    }
}

// =====================================================
// BOT COMMAND LOG
// =====================================================

async function logBotCommand(
    message,
    commandName
) {
    try {
        const link =
            getChannelLink(
                message.guild.id,
                message.channel.id,
                message.id
            );

        const embed =
            new EmbedBuilder()
                .setColor(
                    0x5865F2
                )
                .setTitle(
                    "🤖 Bot-Befehl ausgeführt"
                )
                .addFields(
                    {
                        name:
                            "👤 Benutzer",
                        value:
                            `${message.author}\n${message.author.tag}`,
                        inline:
                            false
                    },
                    {
                        name:
                            "📝 Befehl",
                        value:
                            `\`!${commandName}\``,
                        inline:
                            false
                    },
                    {
                        name:
                            "👮 Ausgeführt von",
                        value:
                            `${message.author}\n${message.author.tag}`,
                        inline:
                            false
                    },
                    {
                        name:
                            "📁 Kanal",
                        value:
                            link
                                ? `[${message.channel.name}](${link})`
                                : "Unbekannt",
                        inline:
                            false
                    },
                    {
                        name:
                            "🕐 Zeitpunkt",
                        value:
                            new Date().toLocaleString(
                                "de-DE"
                            ),
                        inline:
                            false
                    }
                )
                .setTimestamp()
                .setFooter({
                    text:
                        "Vexo RP ✧ 𝙑𝘾 • Bot Logs"
                });

        await sendLog(
            message.guild,
            BOT_LOG_CHANNEL_ID,
            embed
        );

        await sendAdminNotification(
            message.author,
            commandName,
            message.channel,
            message.id
        );

    } catch (error) {
        console.error(
            "❌ Fehler beim Bot-Log:",
            error
        );
    }
}

// =====================================================
// RP STATUS
// =====================================================

function loadRPStatusMessageId() {
    try {
        if (
            !fs.existsSync(
                RP_STATUS_FILE_1
            )
        ) {
            return null;
        }

        const data =
            JSON.parse(
                fs.readFileSync(
                    RP_STATUS_FILE_1,
                    "utf8"
                )
            );

        return data.messageId || null;

    } catch (error) {
        console.error(
            "❌ Fehler beim Laden des RP-Status:",
            error
        );

        return null;
    }
}

function saveRPStatusMessageId(
    messageId
) {
    try {
        fs.writeFileSync(
            RP_STATUS_FILE_1,
            JSON.stringify(
                {
                    messageId
                },
                null,
                2
            )
        );

    } catch (error) {
        console.error(
            "❌ Fehler beim Speichern des RP-Status:",
            error
        );
    }
}

async function updateRPStatus(
    guild,
    status
) {
    try {

        const channelId = RP_ANNOUNCEMENT_CHANNEL_ID;

        if (!channelId) {
            throw new Error(
                "Kein RP-Kanal konfiguriert. Nutze !RP-Nachricht."
            );
        }

        let channel;

        try {
            channel =
                await guild.channels.fetch(
                    channelId
                );
        } catch (fetchError) {
            // Discord-Fehlercode 10003 = "Unknown Channel" (Kanal existiert
            // nicht mehr / wurde gelöscht). Sauber abfangen, damit ein
            // fehlender RP-Status-Kanal den Bot nicht beeinträchtigt.
            if (fetchError?.code === 10003) {
                console.log(
                    `⚠️ RP-Status: Konfigurierter Kanal (${channelId}) existiert nicht mehr (Unknown Channel). Bitte neuen Kanal mit !RP-Nachricht setzen.`
                );
                return false;
            }

            throw fetchError;
        }

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            throw new Error(
                "Der RP-Status-Kanal wurde nicht gefunden."
            );
        }

        // -------------------------------------------------
        // ALTE RP-STATUS-NACHRICHTEN LÖSCHEN
        // -------------------------------------------------

        try {

            const messages =
                await channel.messages.fetch({
                    limit: 100
                });

            const botUserId =
                client.user?.id;

            const oldStatusMessages =
                messages.filter(message => {

                    if (
                        botUserId &&
                        message.author.id !== botUserId
                    ) {
                        return false;
                    }

                    return message.embeds.some(
                        embed =>
                            embed.footer?.text ===
                            "Vexo RP ✧ 𝙑𝘾 • RP-Status"
                    );
                });

            for (
                const message
                of oldStatusMessages.values()
            ) {

                try {

                    await message.delete();

                    console.log(
                        `🗑️ Alte RP-Status-Nachricht gelöscht: ${message.id}`
                    );

                } catch (error) {

                    console.log(
                        "⚠️ Alte RP-Status-Nachricht konnte nicht gelöscht werden:",
                        error.message
                    );
                }
            }

        } catch (error) {

            console.log(
                "⚠️ RP-Status-Nachrichten konnten nicht durchsucht werden:",
                error.message
            );
        }

        // -------------------------------------------------
        // EMBED
        // -------------------------------------------------

        let embed;

        if (
            status === "start"
        ) {

            embed =
                new EmbedBuilder()
                    .setColor(
                        0x57F287
                    )
                    .setTitle(
                        RP_START_TITLE
                    )
                    .setDescription(
                        RP_START_DESCRIPTION
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • RP-Status"
                    });

        } else {

            embed =
                new EmbedBuilder()
                    .setColor(
                        0xED4245
                    )
                    .setTitle(
                        RP_STOP_TITLE
                    )
                    .setDescription(
                        RP_STOP_DESCRIPTION
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • RP-Status"
                    });
        }

        // -------------------------------------------------
        // RP PING
        // -------------------------------------------------

        const content = `<@&${RP_CITIZEN_ROLE_ID}>`;

        // -------------------------------------------------
        // NEUE STATUS-NACHRICHT
        // -------------------------------------------------

        const newMessage =
            await channel.send({
                content,
                embeds: [embed],
                allowedMentions: {
                    roles: [RP_CITIZEN_ROLE_ID]
                }
            });

        // -------------------------------------------------
        // MESSAGE-ID SPEICHERN
        // -------------------------------------------------

        saveRPStatusMessageId(
            newMessage.id
        );

        console.log(
            `✅ Genau eine RP-Status-Nachricht gesendet (${newMessage.id}).`
        );

        return true;

    } catch (error) {

        console.error(
            "❌ RP-Status Fehler:",
            error
        );

        return false;
    }
}
// =====================================================
// NICKNAME-SYSTEM (AUTOMATISCH ANHAND VON ROLLEN)
// =====================================================
// Ersetzt die frühere getrennte Bürger-Nickname-Logik und das alte
// Team-Nametag-System durch eine einzige, einheitliche Logik anhand
// von TEAM_NICKNAME_ROLES + SPECIAL_NICKNAME_ROLES weiter oben.

function nicknameHasManagedPrefix(nickname) {
    if (typeof nickname !== "string") {
        return false;
    }

    const managedLabels = [
        ...getAllTeamNicknameRoles().map(entry => entry.label),
        ...SPECIAL_NICKNAME_ROLES.map(entry => entry.label)
    ];
    if (managedLabels.some(label => nickname.startsWith(`${label} x `))) {
        return true;
    }

    // Frühere Formate bereinigen, die dieses System gesetzt hat.
    if (/^\[.+\] ✗ /.test(nickname)) {
        return true;
    }

    // Frühere Bürger- und Nametag-Formate ebenfalls bereinigen.
    if (/^ECRP ✘ .+ ✗ /.test(nickname)) {
        return true;
    }

    // Altes Bürger-Nickname-Format ("[Bürger] Name") wird ebenfalls
    // erkannt, damit es beim nächsten Sync automatisch bereinigt wird.
    if (nickname.startsWith("[Bürger] ")) {
        return true;
    }

    return false;
}

function getHighestNicknameRoleEntry(member) {
    for (const entry of getAllTeamNicknameRoles()) {
        if (
            member.roles.cache.has(
                entry.roleId
            )
        ) {
            return {
                roleId: entry.roleId,
                label: entry.label,
                buildNickname: username => `${entry.label} x ${username}`
            };
        }
    }

    for (const entry of SPECIAL_NICKNAME_ROLES) {
        if (
            member.roles.cache.has(
                entry.roleId
            )
        ) {
            return entry;
        }
    }

    return null;
}

async function syncNickname(
    member,
    onError
) {
    try {
        if (
            !member ||
            !member.guild ||
            !member.user
        ) {
            return false;
        }

        const matchedEntry =
            getHighestNicknameRoleEntry(
                member
            );

        if (matchedEntry) {
            const desiredNickname =
                matchedEntry.buildNickname(
                    member.user.username
                );
            const boundedNickname =
                Array.from(desiredNickname)
                    .slice(0, 32)
                    .join("");

            if (
                member.nickname ===
                boundedNickname
            ) {
                return false;
            }

            await member.setNickname(
                boundedNickname,
                `Nickname (${matchedEntry.label}) gesetzt`
            );

            return true;
        }

        // Keine der Rollen (mehr) vorhanden: alten, von diesem
        // System gesetzten Nametag wieder entfernen und normalen
        // Namen wiederherstellen.
        if (
            nicknameHasManagedPrefix(
                member.nickname
            )
        ) {
            await member.setNickname(
                null,
                "Nickname entfernt"
            );

            return true;
        }

        return false;

    } catch (error) {
        console.error(
            `❌ Nickname konnte für Mitglied ${member?.id || "unbekannt"} nicht aktualisiert werden:`,
            error
        );
        onError?.(error);
        return false;
    }
}

async function updateAllNicknames(
    guild
) {
    try {
        await guild.members.fetch();

        let updated = 0;
        let skipped = 0;
        let failed = 0;

        for (
            const [, member] of
            guild.members.cache
        ) {
            let memberFailed = false;
            const changed =
                await syncNickname(
                    member,
                    () => {
                        memberFailed = true;
                    }
                );

            if (changed) {
                updated++;
            } else if (memberFailed) {
                failed++;
            } else {
                skipped++;
            }
        }

        return {
            updated,
            skipped,
            failed
        };

    } catch (error) {
        console.error(
            "❌ Fehler beim Aktualisieren der Nicknames:",
            error
        );

        return {
            updated: 0,
            skipped: 0,
            failed: 0,
            error
        };
    }
}

// =====================================================
// SELBSTZERSTÖRUNG (!selbstzerstörung)
// =====================================================
// Entfernt beim Ausführen alle Rollen des Users (außer @everyone)
// nach einem Countdown und stellt sie automatisch nach 2 Minuten
// wieder her. Übersteht auch einen Bot-Neustart innerhalb der
// Wartezeit, da offene Wiederherstellungen in einer Datei
// gespeichert werden.

const SELFDESTRUCT_ROLE_RESTORE_DELAY_MS = 1 * 60 * 1000; // 1 Minute
const SELFDESTRUCT_COUNTDOWN_INTERVAL_MS = 1000; // 1 Sekunde pro Schritt

const SELFDESTRUCT_PENDING_FILE =
    path.join(
        __dirname,
        "selfdestruct-pending.json"
    );

function loadSelfDestructPending() {
    try {
        if (
            !fs.existsSync(
                SELFDESTRUCT_PENDING_FILE
            )
        ) {
            return {};
        }

        const data =
            JSON.parse(
                fs.readFileSync(
                    SELFDESTRUCT_PENDING_FILE,
                    "utf8"
                )
            );

        return data && typeof data === "object"
            ? data
            : {};

    } catch (error) {
        console.error(
            "❌ Fehler beim Laden der Selbstzerstörungs-Daten:",
            error
        );

        return {};
    }
}

function saveSelfDestructPending(data) {
    try {
        fs.writeFileSync(
            SELFDESTRUCT_PENDING_FILE,
            JSON.stringify(
                data,
                null,
                2
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Fehler beim Speichern der Selbstzerstörungs-Daten:",
            error
        );

        return false;
    }
}

let SELFDESTRUCT_PENDING =
    loadSelfDestructPending();

const selfDestructInProgress = new Set();

function selfDestructKey(
    guildId,
    memberId
) {
    return `${guildId}:${memberId}`;
}

async function restoreSelfDestructRoles(
    key
) {
    const entry =
        SELFDESTRUCT_PENDING[key];

    if (!entry) {
        selfDestructInProgress.delete(key);
        return;
    }

    delete SELFDESTRUCT_PENDING[key];
    saveSelfDestructPending(SELFDESTRUCT_PENDING);
    selfDestructInProgress.delete(key);

    try {
        const guild =
            await client.guilds.fetch(
                entry.guildId
            ).catch(() => null);

        if (!guild) {
            return;
        }

        const member =
            await guild.members.fetch(
                entry.memberId
            ).catch(() => null);

        if (!member) {
            return;
        }

        const validRoleIds =
            (entry.roleIds || []).filter(
                roleId =>
                    guild.roles.cache.has(
                        roleId
                    )
            );

        if (validRoleIds.length > 0) {
            await member.roles.add(
                validRoleIds,
                "Selbstzerstörung: Rollen wiederhergestellt"
            ).catch(error => {
                console.error(
                    "❌ Fehler beim Wiederherstellen der Rollen (Selbstzerstörung):",
                    error
                );
            });
        }

        if (entry.channelId) {
            const channel =
                await guild.channels.fetch(
                    entry.channelId
                ).catch(() => null);

            if (
                channel &&
                channel.isTextBased()
            ) {
                await channel.send(
                    `🔄 <@${entry.memberId}> deine Rollen wurden wiederhergestellt!`
                ).catch(() => {});
            }
        }

    } catch (error) {
        console.error(
            "❌ Fehler beim Wiederherstellen der Rollen nach Selbstzerstörung:",
            error
        );
    }
}

function scheduleSelfDestructRestore(
    key,
    delayMs
) {
    selfDestructInProgress.add(key);

    setTimeout(
        () => {
            restoreSelfDestructRoles(
                key
            );
        },
        Math.max(
            0,
            delayMs
        )
    );
}

function initializeSelfDestructRestoreOnStartup() {
    const now = Date.now();

    for (
        const key of
        Object.keys(
            SELFDESTRUCT_PENDING
        )
    ) {
        const entry =
            SELFDESTRUCT_PENDING[key];

        const remaining =
            (entry.restoreAt || now) - now;

        scheduleSelfDestructRestore(
            key,
            remaining
        );
    }
}

// =====================================================
// SELBSTZERSTÖRUNG – GEMEINSAME AUSFÜHRUNGSLOGIK
// =====================================================
// Diese Funktion enthält den kompletten, bereits vorhandenen
// Selbstzerstörungs-Ablauf (Countdown, Rollenentfernung, Ping,
// finale Nachricht, DM, automatische Wiederherstellung).
// Sowohl !Selbstzerstörung als auch das Selbstzerstörung-Panel
// rufen ausschließlich diese eine Funktion auf, damit der Ablauf
// in beiden Fällen garantiert identisch ist.

async function executeSelfDestruction(targetMember, channel) {
    if (!targetMember || !channel) {
        return { ok: false, reason: "invalid" };
    }

    const guildId = targetMember.guild.id;

    const key = selfDestructKey(guildId, targetMember.id);

    if (selfDestructInProgress.has(key)) {
        return { ok: false, reason: "in_progress" };
    }

    const rolesToRemove =
        targetMember.roles.cache.filter(
            role => role.id !== guildId
        );

    const roleCount = rolesToRemove.size;

    if (roleCount === 0) {
        return { ok: false, reason: "no_roles" };
    }

    const roleIdsToRemove = [...rolesToRemove.keys()];

    selfDestructInProgress.add(key);

    let countdownMessage;

    try {
        countdownMessage = await channel.send(
            `💥 **Selbstzerstörung wird eingeleitet...**\n⏳ ${roleCount}`
        );
    } catch (error) {
        selfDestructInProgress.delete(key);
        console.error(
            "❌ Fehler beim Senden der Selbstzerstörungs-Nachricht:",
            error
        );
        return { ok: false, reason: "send_failed" };
    }

    for (
        let remaining = roleCount - 1;
        remaining >= 0;
        remaining--
    ) {
        await new Promise(resolve =>
            setTimeout(resolve, SELFDESTRUCT_COUNTDOWN_INTERVAL_MS)
        );

        const roleIdToRemoveNow =
            roleIdsToRemove[roleCount - 1 - remaining];

        if (roleIdToRemoveNow) {
            try {
                await targetMember.roles.remove(
                    roleIdToRemoveNow,
                    "Selbstzerstörung: Rolle im Countdown entfernt"
                );
            } catch (error) {
                // Fehlerbehandlung für fehlende Berechtigungen - logge nur als Warnung
                if (error.code === 50013) {
                    console.warn(
                        `⚠️ Konnte Rolle ${roleIdToRemoveNow} nicht entfernen (fehlende Berechtigungen).`
                    );
                } else {
                    console.error(
                        "❌ Fehler beim Entfernen einer Rolle im Countdown (Selbstzerstörung):",
                        error
                    );
                }
            }
        }

        try {
            await countdownMessage.edit(
                `💥 **Selbstzerstörung wird eingeleitet...**\n⏳ ${remaining}`
            );
        } catch {}
    }

    try {
        await countdownMessage.edit(
            `<@${targetMember.id}>\n# ☠️ DU HAST JETZT ALLE ROLLEN VERLOREN! ☠️\n## HAHAHAHA 😈`
        );
    } catch {}

    // Zusätzlich zur Kanal-Nachricht sofort eine DM mit dem
    // gleichen Inhalt an genau diese Person senden. Schlägt
    // das fehl (z. B. weil die Person keine DMs vom Bot
    // empfangen kann), bleibt die bereits gesendete
    // Kanal-Nachricht davon unberührt.
    try {
        await targetMember.send(
            `<@${targetMember.id}>\n# ☠️ DU HAST JETZT ALLE ROLLEN VERLOREN! ☠️\n## HAHAHAHA 😈`
        );
    } catch (error) {
        console.log(
            "⚠️ Selbstzerstörungs-DM konnte nicht gesendet werden:",
            error.message
        );
    }

    const restoreAt = Date.now() + SELFDESTRUCT_ROLE_RESTORE_DELAY_MS;

    SELFDESTRUCT_PENDING[key] = {
        guildId: guildId,
        memberId: targetMember.id,
        channelId: channel.id,
        roleIds: roleIdsToRemove,
        restoreAt: restoreAt
    };

    saveSelfDestructPending(SELFDESTRUCT_PENDING);

    scheduleSelfDestructRestore(key, SELFDESTRUCT_ROLE_RESTORE_DELAY_MS);

    return { ok: true };
}

// =====================================================
// SELBSTZERSTÖRUNG-PANEL (NUR BOT-OWNER)
// =====================================================
// Das Panel ist lediglich eine alternative Möglichkeit, die oben
// stehende executeSelfDestruction()-Funktion gezielt für einen
// ausgewählten Benutzer auszulösen. Es gibt keine zweite/eigene
// Selbstzerstörungs-Logik.

const SELFDESTRUCT_PANEL_STATE = new Map(); // panelMessageId -> { mode, query, page, selectedUserId }
const SELFDESTRUCT_PANEL_PAGE_SIZE = 25;

function getSelfDestructPanelState(panelMessageId) {
    return SELFDESTRUCT_PANEL_STATE.get(panelMessageId) || null;
}

function setSelfDestructPanelState(panelMessageId, state) {
    SELFDESTRUCT_PANEL_STATE.set(panelMessageId, state);
    return state;
}

function deleteSelfDestructPanelState(panelMessageId) {
    SELFDESTRUCT_PANEL_STATE.delete(panelMessageId);
}

function buildSelfDestructStartPanel() {
    const embed =
        new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("💥 Selbstzerstörung-Panel")
            .setDescription(
                "Wähle einen Benutzer aus, für den die bestehende Selbstzerstörung ausgeführt werden soll."
            )
            .setFooter({ text: `${SERVER_NAME} ✧ Selbstzerstörung-Panel` });

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("selfdestruct_panel_search")
                    .setLabel("Benutzer suchen")
                    .setEmoji("🔎")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("selfdestruct_panel_id")
                    .setLabel("ID eingeben")
                    .setEmoji("🆔")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("selfdestruct_panel_list")
                    .setLabel("Mitglieder anzeigen")
                    .setEmoji("📋")
                    .setStyle(ButtonStyle.Secondary)
            );

    return { embeds: [embed], components: [row] };
}

async function fetchSelfDestructCandidateMembers(guild, query = null) {
    let members = [];

    try {
        if (query) {
            const normalizedQuery = query.trim();
            const normalizedLower = normalizedQuery.toLowerCase();

            // Discords eigene Mitglieder-Suche filtert serverseitig nach
            // Nutzername/Nickname, die mit der Eingabe BEGINNEN. Das läuft
            // über die REST-API und funktioniert zuverlässig, auch wenn der
            // komplette Server-Mitgliedercache (noch) nicht geladen ist.
            const searched = await guild.members.search({
                query: normalizedQuery,
                limit: 1000
            }).catch(error => {
                console.error(
                    "❌ Fehler bei guild.members.search() im Selbstzerstörung-Panel:",
                    error
                );
                return null;
            });

            members = searched ? Array.from(searched.values()) : [];

            // Zusätzlich als Fallback: Mitglieder finden, bei denen die
            // Eingabe irgendwo im Namen (nicht nur am Anfang) vorkommt,
            // sofern bereits Mitglieder im Cache liegen.
            const foundIds = new Set(members.map(member => member.id));

            const cacheMatches = Array.from(guild.members.cache.values()).filter(member =>
                member &&
                !foundIds.has(member.id) &&
                (
                    member.user.username.toLowerCase().includes(normalizedLower) ||
                    (member.nickname && member.nickname.toLowerCase().includes(normalizedLower)) ||
                    (member.displayName && member.displayName.toLowerCase().includes(normalizedLower)) ||
                    member.id === normalizedQuery
                )
            );

            members = [...members, ...cacheMatches];

        } else {
            const fetchedMembers = await guild.members.fetch();
            members = Array.from(fetchedMembers.values());
        }

        members = members.filter(member => member && member.id !== client.user.id);

        members.sort((a, b) => a.displayName.localeCompare(b.displayName));

    } catch (error) {
        console.error(
            "❌ Fehler beim Laden der Mitglieder für das Selbstzerstörung-Panel:",
            error
        );
        members = [];
    }

    return members;
}

async function buildSelfDestructMemberSelectPanel(guild, mode, query, page = 0) {
    const members = await fetchSelfDestructCandidateMembers(guild, query);

    const pageSize = SELFDESTRUCT_PANEL_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(members.length / pageSize));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = safePage * pageSize;
    const pageMembers = members.slice(start, start + pageSize);

    const title = mode === "search" ? "🔎 Benutzer suchen" : "📋 Mitgliederliste";

    const description =
        members.length === 0
            ? (
                mode === "search"
                    ? `❌ Es wurden keine Mitglieder gefunden, die zu \`${query}\` passen.`
                    : "❌ Es wurden keine Mitglieder auf diesem Server gefunden."
            )
            : (
                mode === "search"
                    ? `Suchergebnisse für \`${query}\`.\n\n**Seite ${safePage + 1}/${totalPages}**`
                    : `Wähle einen Benutzer aus der Liste aus.\n\n**Seite ${safePage + 1}/${totalPages}**`
            );

    const embed =
        new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: `${SERVER_NAME} ✧ Selbstzerstörung-Panel` });

    const components = [];

    if (pageMembers.length > 0) {
        const selectRow =
            new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("selfdestruct_panel_select")
                        .setPlaceholder("Benutzer auswählen...")
                        .addOptions(
                            pageMembers.map(member =>
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(member.displayName.slice(0, 100))
                                    .setDescription(`@${member.user.username}`.slice(0, 100))
                                    .setValue(member.id)
                            )
                        )
                );
        components.push(selectRow);
    }

    const prefix = mode === "search" ? "selfdestruct_panel_search" : "selfdestruct_panel_list";

    const navRow =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${prefix}_prev_${safePage}`)
                    .setLabel("Zurück")
                    .setEmoji("◀️")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage === 0),
                new ButtonBuilder()
                    .setCustomId(`${prefix}_next_${safePage}`)
                    .setLabel("Weiter")
                    .setEmoji("▶️")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId("selfdestruct_panel_back_start")
                    .setLabel("Zurück")
                    .setEmoji("↩️")
                    .setStyle(ButtonStyle.Primary)
            );
    components.push(navRow);

    return { embeds: [embed], components };
}

function buildSelfDestructTargetPanel(member) {
    const roleCount =
        member.roles.cache.filter(
            role => role.id !== member.guild.id
        ).size;

    const embed =
        new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("💥 Selbstzerstörung")
            .setDescription("> Ausgewählter Benutzer:")
            .addFields(
                { name: "👤 Benutzer", value: `${member}`, inline: false },
                { name: "🆔 ID", value: `\`${member.id}\``, inline: false },
                { name: "🎭 Rollen", value: `\`${roleCount}\``, inline: false }
            )
            .setFooter({ text: `${SERVER_NAME} ✧ Selbstzerstörung-Panel` });

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("selfdestruct_panel_start")
                    .setLabel("Selbstzerstörung starten")
                    .setEmoji("💥")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(roleCount === 0),
                new ButtonBuilder()
                    .setCustomId("selfdestruct_panel_change")
                    .setLabel("Benutzer wechseln")
                    .setEmoji("↩️")
                    .setStyle(ButtonStyle.Secondary)
            );

    return { embeds: [embed], components: [row] };
}

function createSelfDestructSearchModal() {
    const modal =
        new ModalBuilder()
            .setCustomId("selfdestruct_panel_search_modal")
            .setTitle("🔎 Benutzer suchen");

    const input =
        new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Name oder Benutzername")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("z.B. Max oder max_123")
            .setMaxLength(100)
            .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return modal;
}

function createSelfDestructIdModal() {
    const modal =
        new ModalBuilder()
            .setCustomId("selfdestruct_panel_id_modal")
            .setTitle("🆔 Discord-ID eingeben");

    const input =
        new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Discord-ID des Benutzers")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("z.B. 123456789012345678")
            .setMaxLength(25)
            .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return modal;
}

// =====================================================
// HÄUSER LADEN
// =====================================================

function loadHouses(
    clientNumber = 1
) {
    try {
        const file =
            clientNumber === 2
                ? HOUSES_FILE_2
                : HOUSES_FILE_1;

        if (
            !fs.existsSync(file)
        ) {
            fs.writeFileSync(
                file,
                JSON.stringify(
                    [],
                    null,
                    2
                )
            );

            return [];
        }

        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {
        console.error(
            `❌ Fehler beim Laden der Häuser für Client ${clientNumber}:`,
            error
        );

        return [];
    }
}

// =====================================================
// HÄUSER SPEICHERN
// =====================================================

function saveHouses(
    houses,
    clientNumber = 1
) {
    try {
        const file =
            clientNumber === 2
                ? HOUSES_FILE_2
                : HOUSES_FILE_1;

        fs.writeFileSync(
            file,
            JSON.stringify(
                houses,
                null,
                2
            )
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Fehler beim Speichern der Häuser für Client ${clientNumber}:`,
            error
        );

        return false;
    }
}

// =====================================================
// HÄUSERPANEL SPEICHERN
// =====================================================

function saveHousesPanelMessage(
    message
) {
    try {
        fs.writeFileSync(
            HOUSES_PANEL_FILE,
            JSON.stringify(
                {
                    channelId:
                        message.channel.id,
                    messageId:
                        message.id
                },
                null,
                2
            )
        );
    } catch (error) {
        console.error(
            "❌ Fehler beim Speichern des Häuserpanels:",
            error
        );
    }
}

// =====================================================
// HÄUSERPANEL LADEN
// =====================================================

function loadHousesPanelMessage() {
    try {
        if (
            !fs.existsSync(
                HOUSES_PANEL_FILE
            )
        ) {
            return null;
        }

        return JSON.parse(
            fs.readFileSync(
                HOUSES_PANEL_FILE,
                "utf8"
            )
        );

    } catch {
        return null;
    }
}

// =====================================================
// HÄUSERLISTEN LADEN
// =====================================================

function loadHousesListMessages(
    clientNumber = 1
) {
    try {

        const file =
            clientNumber === 2
                ? HOUSES_LIST_FILE_2
                : HOUSES_LIST_FILE_1;

        if (
            !fs.existsSync(
                file
            )
        ) {
            return {};
        }

        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );

        return (
            data &&
            typeof data === "object" &&
            !Array.isArray(data)
        )
            ? data
            : {};

    } catch (error) {

        console.error(
            "❌ Fehler beim Laden der Häuserlisten:",
            error
        );

        return {};
    }
}


// =====================================================
// HÄUSERLISTE SPEICHERN
// =====================================================

function saveHousesListMessage(
    message,
    clientNumber = 1
) {
    try {

        const file =
            clientNumber === 2
                ? HOUSES_LIST_FILE_2
                : HOUSES_LIST_FILE_1;

        const data =
            loadHousesListMessages(
                clientNumber
            );

        data[message.channel.id] = {
            channelId:
                message.channel.id,

            messageId:
                message.id
        };

        fs.writeFileSync(
            file,
            JSON.stringify(
                data,
                null,
                2
            )
        );

    } catch (error) {

        console.error(
            "❌ Fehler beim Speichern der Häuserliste:",
            error
        );
    }
}

// =====================================================
// FESTE HÄUSERLISTE
// =====================================================

const HOUSE_LIST_1 = [
    { number: "1", icon: "🏠", text: "💰 15.000 $" },

    { number: "2", icon: "🏠", text: "💰 100.000 $" },

    { number: "3", icon: "🏠", text: "💰 25.000 $" },

    { number: "4", icon: "🏠", text: "💰 24.000 $" },

    { number: "5", icon: "🏠", text: "💰 25.000 $" },

    { number: "6", icon: "🏠", text: "💰 25.000 $" },

    { number: "7", icon: "🏠", text: "💰 Gewerbe" },

    { number: "8", icon: "🏠", text: "💰 Gewerbe" },

    { number: "9", icon: "🏠", text: "💰 Gewerbe" },

    { number: "10", icon: "🏠", text: "💰 FFJ" },

    { number: "11", icon: "🏠", text: "💰 FFJ" },

    { number: "12", icon: "🚧", text: "💰 Gewerbe" },

    { number: "13", icon: "🏠", text: "💰 Gewerbe" },

    { number: "14", icon: "🏠", text: "💰 HARS" },

    { number: "15", icon: "🧰", text: "💰 30.000 $" },

    { number: "16", icon: "🏠", text: "💰 Gewerbe" },

    { number: "17", icon: "🏠", text: "💰 30.000 $" },

    { number: "18", icon: "🏎️", text: "💰 30.000 $" },

    { number: "19", icon: "🏠", text: "💰 50.000 $" },

    { number: "20", icon: "🏠", text: "💰 70.000 $" },

    { number: "21", icon: "🏠", text: "💰 70.000 $" },

    { number: "22", icon: "🏠", text: "💰 Gewerbe" },

    { number: "23", icon: "🏠", text: "💰 35.000 $" },

    { number: "24", icon: "🚗", text: "💰 14.000 $" },

    { number: "25", icon: "🏠", text: "💰 12.500 $" },

    { number: "26", icon: "🏠", text: "💰 14.000 $" },

    { number: "27", icon: "🏠", text: "💰 12.500 $" },

    { number: "28", icon: "🏠", text: "💰 12.500 $" },

    { number: "29", icon: "🏠", text: "💰 12.500 $" },

    { number: "30", icon: "⚽", text: "💰 10.000 $" },

    { number: "31", icon: "🏥", text: "nicht zu verkaufen❗" },
    
    { number: "32", icon: "⛽", text: "💰 8.000 $" },
    { number: "33", icon: "🛹", text: "nicht zu verkaufen❗" },
    { number: "34", icon: "🏗️", text: "💰 10.000 $" },
    { number: "35", icon: "🚛", text: "nicht zu verkaufen❗" },
    { number: "36", icon: "⛴️", text: "nicht zu verkaufen❗" },
    { number: "37", icon: "🚛", text: "LKW Fraktion" },
    { number: "38", icon: "🔒", text: "nicht zu verkaufen❗" },
    { number: "39", icon: "⛪", text: "nicht zu verkaufen❗" },
    { number: "40", icon: "🚓", text: "nicht zu verkaufen❗" },
    { number: "41 A", icon: "🏕️", text: "Anwalt Fraktion" },
    { number: "41 B", icon: "🏕️", text: "💰 8.000 $" },
    { number: "42", icon: "⛽", text: "💰 8.000 $" },
    { number: "43", icon: "🚒", text: "nicht zu verkaufen❗" },
    { number: "44", icon: "🏠", text: "💰 7.000 $" },
    { number: "45", icon: "👕", text: "💰 7.000 $" },
    { number: "46", icon: "💰", text: "💰 5.000 $" }
];
// =====================================================
// HÄUSERLISTE – CLIENT 2
// =====================================================

const HOUSE_LIST_2 = [
    { number: "1", icon: "🏠", text: "-" },
    { number: "2", icon: "🏠", text: "-" },
    { number: "3", icon: "🏠", text: "-" },
    { number: "4", icon: "🏠", text: "-" },
    { number: "5", icon: "🏠", text: "-" },
    { number: "6", icon: "🏠", text: "-" },
    { number: "7", icon: "🏠", text: "-" },
    { number: "8", icon: "🏠", text: "-" },
    { number: "9", icon: "🏠", text: "-" },
    { number: "10", icon: "🏠", text: "-" },
    { number: "11", icon: "🏠", text: "-" },
    { number: "12", icon: "🏠", text: "-" },
    { number: "13", icon: "🏠", text: "-" },
    { number: "14", icon: "🏠", text: "-" },
    { number: "15", icon: "🏠", text: "-" },
    { number: "16", icon: "🏠", text: "-" },
    { number: "17", icon: "🏠", text: "-" },
    { number: "18", icon: "🏠", text: "-" },
    { number: "19", icon: "🏠", text: "-" },
    { number: "20", icon: "🏠", text: "-" },
    { number: "21", icon: "🏠", text: "-" },
    { number: "22", icon: "🏠", text: "-" },
    { number: "23", icon: "🏠", text: "-" },
    { number: "24", icon: "🏠", text: "-" },
    { number: "25", icon: "🏠", text: "-" },
    { number: "26", icon: "🏠", text: "-" },
    { number: "27", icon: "🏠", text: "-" },
    { number: "28", icon: "🏠", text: "-" },
    { number: "29", icon: "🏠", text: "-" },
    { number: "30", icon: "🏠", text: "-" },
    { number: "31", icon: "🏠", text: "-" },
    { number: "32", icon: "🏠", text: "-" },
    { number: "33", icon: "🏠", text: "-" },
    { number: "34", icon: "🏠", text: "-" },
    { number: "35", icon: "🏠", text: "-" },
    { number: "36", icon: "🏠", text: "-" },
    { number: "37", icon: "🏠", text: "-" },
    { number: "38", icon: "🏠", text: "-" },
    { number: "39", icon: "🏠", text: "-" },
    { number: "40", icon: "🏠", text: "-" },
    { number: "41", icon: "🏠", text: "-" },
    { number: "42", icon: "🏠", text: "-" },
    { number: "43", icon: "🏠", text: "-" },
    { number: "44", icon: "🏠", text: "-" },
    { number: "45", icon: "🏠", text: "-" },
    { number: "46", icon: "🏠", text: "-" }
];
// =====================================================
// HÄUSERLISTE ERSTELLEN
// =====================================================

function createHousesListEmbeds(
    houseList = HOUSE_LIST_1,
    clientNumber = 1
) {
    const houses =
        loadHouses(
            clientNumber
        );

    const firstHalf =
        houseList.slice(
            0,
            23
        );

    const secondHalf =
        houseList.slice(
            23
        );

    function createEmbed(
        title,
        housePart
    ) {
        const embed =
            new EmbedBuilder()
                .setColor(
                    0x5865F2
                )
                .setTitle(
                    "🏠・𝑯𝒂𝒖𝒔𝒍𝒊𝒔𝒕𝒆"
                )
                .setTimestamp()
                .setFooter({
                    text:
                        "Vexo RP ✧ 𝙑𝘾 • Häuserliste"
                });

        let text = "";

        for (
            const house of housePart
        ) {
            const entry =
                houses.find(
                    savedHouse =>
                        String(
                            savedHouse.houseNumber
                        ) ===
                        String(
                            house.number
                        )
                );

            // Fancy Unicode-Zahlen konvertieren
            const fancyNumber = house.number.replace(/[0-9]/g, (digit) => {
                const fancyDigits = ['𝟎', '𝟏', '𝟐', '𝟑', '𝟒', '𝟓', '𝟔', '𝟕', '𝟖', '𝟗'];
                return fancyDigits[parseInt(digit)];
            });

            const isLast = house === housePart[housePart.length - 1];
            const treeSymbol = isLast ? "┗・" : "┣・";

            let line =
                `${treeSymbol}${house.icon}・𝑯𝒂𝒖𝒔 ${fancyNumber} ┃ ${house.text}`;

            if (
                entry?.userId
            ) {
                // Nur die Zahl durchgestrichen, wenn Haus gekauft ist, Emoji sichtbar lassen
                const priceMatch = house.text.match(/💰\s*([\d.,]+)/);
                if (priceMatch) {
                    const emoji = house.text.split(priceMatch[0])[0] || "💰";
                    const price = priceMatch[1];
                    const suffix = house.text.split(priceMatch[0])[1] || "";
                    line = line.replace(house.text, `${emoji} ~~${price}~~${suffix}`);
                } else {
                    // Fallback: Wenn kein Preis-Format erkannt, ganzen Text durchstreichen
                    line = line.replace(house.text, `~~${house.text}~~`);
                }
                
                // Pfeil und @-Mention des Besitzers hinzufügen
                line += `\n╰┈➤ <@${entry.userId}>`;
            }

            text += line + "\n";
        }

        embed.setDescription(text);

        return embed;
    }

    return [
        createEmbed(
            "HÄUSER 1–23",
            firstHalf
        ),

        createEmbed(
            "HÄUSER 24–46",
            secondHalf
        )
    ];
}
// =====================================================
// HÄUSERLISTEN AKTUALISIEREN
// =====================================================

async function updateHousesLists(
    guild,
    houseList = HOUSE_LIST_1
) {
    try {
        const listData =
            loadHousesListMessages();

        const embeds =
            createHousesListEmbeds(
                houseList
            );

        for (
            const [channelId, data]
            of Object.entries(
                listData
            )
        ) {
            const channel =
                await guild.channels
                    .fetch(
                        channelId
                    )
                    .catch(
                        () => null
                    );

            if (
                !channel ||
                !channel.isTextBased()
            ) {
                continue;
            }

            const message =
                await channel.messages
                    .fetch(
                        data.messageId
                    )
                    .catch(
                        () => null
                    );

            if (!message) {
                continue;
            }

            await message.edit({
                embeds
            });
        }

        return true;

    } catch (error) {
        console.error(
            "❌ Fehler beim Aktualisieren der Häuserlisten:",
            error
        );

        return false;
    }
}
// =====================================================
// HÄUSERLISTE IN EINEM KANAL
// =====================================================

async function sendOrUpdateHousesList(
    channel,
    houseList = HOUSE_LIST_1
) {
    const allLists =
        loadHousesListMessages();

    const existing =
        allLists[channel.id];

    const embeds =
        createHousesListEmbeds(
            houseList
        );

    if (
        existing?.messageId
    ) {
        const oldMessage =
            await channel.messages
                .fetch(
                    existing.messageId
                )
                .catch(
                    () => null
                );

        if (oldMessage) {
            await oldMessage.edit({
                embeds
            });

            return oldMessage;
        }
    }

    const newMessage =
        await channel.send({
            embeds
        });

    saveHousesListMessage(
        newMessage
    );

    return newMessage;
}
// =====================================================
// HÄUSERPANEL
// =====================================================

function createHousesPanelPayload(
    houseList = HOUSE_LIST_1
) {
    const houses =
        loadHouses();

    const embed =
        new EmbedBuilder()
            .setColor(
                0x5865F2
            )
            .setTitle(
                "🏠 Häuserverwaltung"
            )
            .setDescription(
                `Verwalte hier die Häuser des Servers.\n\n🏠 **Eingetragene Häuser:** ${houses.length}`
            )
            .setTimestamp()
            .setFooter({
                text:
                    "Vexo RP ✧ 𝙑𝘾 • Häuserverwaltung"
            });

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "houses_add"
                    )
                    .setLabel(
                        "Benutzer hinzufügen"
                    )
                    .setEmoji(
                        "➕"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "houses_edit"
                    )
                    .setLabel(
                        "Haus bearbeiten"
                    )
                    .setEmoji(
                        "✏️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "houses_remove"
                    )
                    .setLabel(
                        "Haus entfernen"
                    )
                    .setEmoji(
                        "🗑️"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "houses_refresh"
                    )
                    .setLabel(
                        "Liste aktualisieren"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

// =====================================================
// HÄUSERPANEL AKTUALISIEREN
// =====================================================

async function updateHousesPanel(
    guild
) {
    try {
        const panelData =
            loadHousesPanelMessage();

        if (!panelData) {
            return false;
        }

        const channel =
            await guild.channels
                .fetch(
                    panelData.channelId
                )
                .catch(
                    () => null
                );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return false;
        }

        const message =
            await channel.messages
                .fetch(
                    panelData.messageId
                )
                .catch(
                    () => null
                );

        if (!message) {
            return false;
        }

        await message.edit(
            createHousesPanelPayload()
        );

        return true;

    } catch {
        return false;
    }
}
// =====================================================
// HAUS AUSWÄHLEN
// =====================================================

function createHouseSelectRows(
    action,
    houseList = HOUSE_LIST_1
) {
    const houses =
        loadHouses();

    if (
        houses.length === 0
    ) {
        return [];
    }

    const rows = [];

    for (
        let start = 0;
        start < houses.length &&
        rows.length < 5;
        start += 25
    ) {
        const chunk =
            houses.slice(
                start,
                start + 25
            );

        const menu =
            new StringSelectMenuBuilder()
                .setCustomId(
                    `houses_${action}_select_${start}`
                )
                .setPlaceholder(
                    "🏠 Haus auswählen"
                )
                .setMinValues(
                    1
                )
                .setMaxValues(
                    1
                )
                .addOptions(
                    chunk.map(
                        house =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(
                                    `Haus #${house.houseNumber}`
                                )
                                .setDescription(
                                    house.username
                                        ? `Bewohner: ${house.username}`
                                        : "Kein Bewohner"
                                )
                                .setValue(
                                    String(
                                        house.houseNumber
                                    )
                                )
                    )
                );

        rows.push(
            new ActionRowBuilder()
                .addComponents(
                    menu
                )
        );
    }

    return rows;
}


// =====================================================
// HAUS FINDEN
// =====================================================

function findHouse(
    houseNumber,
    houseList = HOUSE_LIST_1
) {
    const houses =
        loadHouses();

    return houses.find(
        house =>
            String(
                house.houseNumber
            ) ===
            String(
                houseNumber
            )
    );
}

// =====================================================
// TEAMLISTE
// =====================================================

let autoUpdateInterval = null;
let teamListUpdateRunning = false;

async function createTeamListEmbeds(
    guild
) {
    const embeds = [];

    // BUGFIX: Vorher wurde direkt guild.members.cache gefiltert. Discord
    // liefert beim Verbinden aber nicht zwangsläufig ALLE Mitglieder eines
    // Servers aus (abhängig von Servergröße/Online-Status), wodurch der
    // Cache unvollständig sein kann. Dadurch wurden Team-Mitglieder mit
    // korrekt hinterlegter Rollen-ID nicht gefunden und fehlten in der
    // Teamliste/den Pings. Ein vollständiger Fetch vor dem Filtern stellt
    // sicher, dass der Cache alle aktuellen Serverm-Mitglieder enthält.
    try {
        await guild.members.fetch();
    } catch (error) {
        console.error("❌ Mitglieder konnten für die Teamliste nicht vollständig geladen werden (guild.members.fetch()):", error);
    }

    const { roleHierarchy } = require("./team-roles-config.json");
    if (!Array.isArray(roleHierarchy)) {
        throw new Error("team-roles-config.json enthält keine gültige roleHierarchy.");
    }

    const highTeamCategories = new Set([
        "Founder",
        "Owner",
        "Co.Owner",
        "Developer",
        "Projektleitung",
        "High-Ausbilder",
        "Direktor",
        "Management",
        "Supervisor",
        "Teamleitung"
    ]);
    const roleEmojis = {
        ...TEAM_RANK_EMOJIS,
        "Co-Owner": "🛡️",
        "Developer": "💻",
        "High Ausbilder": "🎓",
        "Leitender Supervisor": "🛡️",
        "Supervisor": "🛡️",
        "Stellvertretender Supervisor": "🛡️",
        "Low Ausbilder": "🎓",
        "Stellvertretender Low Ausbilder": "📚",
        "Head Supporter": "🎧",
        "Senior Supporter": "🎧",
        "Supporter": "🎧",
        "Test Supporter": "🧪"
    };
    const roleNameAliases = {
        "Co. Owner": "Co-Owner",
        "Stv. Projektleitung": "Stellvertretende Projektleitung",
        "Stv. High Ausbilder": "Stellvertretender High Ausbilder",
        "Stv. Direktor": "Stellvertretender Direktor",
        "Stv. Manager": "Stellvertretender Manager",
        "Stv. Supervisor": "Stellvertretender Supervisor",
        "Stv. Teamleitung": "Stellvertretende Teamleitung",
        "Stv. Low Ausbilder": "Stellvertretender Low Ausbilder",
        "Stv. Fraktionsverwaltung": "Stellvertretende Fraktionsverwaltung",
        "Stv. Eventleitung": "Stellvertretende Eventleitung",
        "Stv. Moderator": "Stellvertretender Moderator",
        "Stv. Supporter": "Stellvertretender Supporter"
    };
    const now = new Date();
    const updateTime = new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(now);
    const highTeamEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("👥 TEAMLISTE")
        .setDescription("Vexo RP ✧ 𝙑𝘾 RP-VC | HIGH TEAM")
        .setFooter({ text: `Teamliste • heute um ${updateTime} Uhr` })
        .setTimestamp(now);
    const lowTeamEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("👥 TEAMLISTE")
        .setDescription("Vexo RP ✧ 𝙑𝘾 RP-VC | LOW TEAM")
        .setFooter({ text: `Teamliste • heute um ${updateTime} Uhr` })
        .setTimestamp(now);

    for (const category of roleHierarchy) {
        const targetEmbed = highTeamCategories.has(category.category)
            ? highTeamEmbed
            : lowTeamEmbed;

        for (const role of category.roles || []) {
            if (!role.id || !role.name || role.name.includes("━")) {
                continue;
            }

            const configuredName = (role.name.includes("✗")
                ? role.name.split("✗").pop()
                : role.name)
                .trim()
                .replace(/^[^A-Za-zÀ-ÿ0-9]+/u, "")
                .replace(/^Server Founder$/i, "Founder");
            const displayName = roleNameAliases[configuredName] || configuredName;
            const members = guild.members.cache.filter(member =>
                member.roles.cache.has(role.id)
            );
            const memberList = members.size > 0
                ? [...members.values()].map(member => `<@${member.id}>`).join("\n")
                : "— Keine Mitglieder —";
            const emoji = roleEmojis[displayName] || "📋";

            targetEmbed.addFields({
                name: `${emoji} ${displayName} [${members.size}]`,
                value: memberList,
                inline: false
            });
        }
    }

    embeds.push(highTeamEmbed, lowTeamEmbed);

    return {
        embeds
    };
}

// =====================================================
// TEAMLISTE – LETZTE MIT !teamliste ERSTELLTE NACHRICHT
// (automatische Aktualisierung bei Rollenänderungen)
// =====================================================

const LAST_TEAMLIST_MESSAGE_FILE =
    path.join(
        __dirname,
        "teamlist-last-message.json"
    );

function loadLastTeamListMessages() {
    try {
        if (
            !fs.existsSync(
                LAST_TEAMLIST_MESSAGE_FILE
            )
        ) {
            return {};
        }

        const data =
            JSON.parse(
                fs.readFileSync(
                    LAST_TEAMLIST_MESSAGE_FILE,
                    "utf8"
                )
            );

        return (
            data &&
            typeof data ===
                "object"
        )
            ? data
            : {};

    } catch (error) {
        console.error(
            "❌ Fehler beim Laden der zuletzt erstellten Teamlisten-Nachricht:",
            error
        );

        return {};
    }
}

let LAST_TEAMLIST_MESSAGES =
    loadLastTeamListMessages();

function saveLastTeamListMessages() {
    try {
        fs.writeFileSync(
            LAST_TEAMLIST_MESSAGE_FILE,
            JSON.stringify(
                LAST_TEAMLIST_MESSAGES,
                null,
                2
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Fehler beim Speichern der zuletzt erstellten Teamlisten-Nachricht:",
            error
        );

        return false;
    }
}

// Wird nach jedem erfolgreichen !teamliste-Aufruf aufgerufen, damit die
// erstellte Nachricht dauerhaft (auch über Bot-Neustarts hinweg) wiedergefunden
// und bei Rollenänderungen automatisch bearbeitet werden kann.
function setLastTeamListMessage(
    guildId,
    channelId,
    messageId
) {
    LAST_TEAMLIST_MESSAGES[
        guildId
    ] = {
        channelId,
        messageId
    };

    saveLastTeamListMessages();
}

function getLastTeamListMessage(
    guildId
) {
    return (
        LAST_TEAMLIST_MESSAGES[
            guildId
        ] || null
    );
}

// Entfernt die gespeicherte Referenz sauber (z. B. wenn Kanal/Nachricht
// nicht mehr existieren), damit kein Fehler-Spam bei jeder Rollenänderung
// entsteht.
function clearLastTeamListMessage(
    guildId
) {
    if (
        LAST_TEAMLIST_MESSAGES[
            guildId
        ]
    ) {
        delete LAST_TEAMLIST_MESSAGES[
            guildId
        ];

        saveLastTeamListMessages();
    }
}

const lastTeamListUpdateRunning =
    new Set();

// Aktualisiert ausschließlich die zuletzt mit !teamliste erstellte Nachricht
// per message.edit() – es wird NIEMALS eine neue Nachricht gesendet.
// Formatierung/Design kommen unverändert aus createTeamListEmbeds().
async function updateLastTeamListMessage(
    guild
) {
    if (
        !guild
    ) {
        return;
    }

    const stored =
        getLastTeamListMessage(
            guild.id
        );

    if (
        !stored ||
        !stored.channelId ||
        !stored.messageId
    ) {
        // Es wurde noch keine Teamliste per !teamliste erstellt
        // (oder die Referenz wurde bereits zurückgesetzt) -> nichts zu tun.
        return;
    }

    if (
        lastTeamListUpdateRunning.has(
            guild.id
        )
    ) {
        return;
    }

    lastTeamListUpdateRunning.add(
        guild.id
    );

    try {
        let channel;

        try {
            channel =
                await guild.channels.fetch(
                    stored.channelId
                );
        } catch (error) {
            // Kanal existiert nicht mehr -> sauber zurücksetzen, kein Fehler-Spam
            clearLastTeamListMessage(
                guild.id
            );

            return;
        }

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            clearLastTeamListMessage(
                guild.id
            );

            return;
        }

        let targetMessage;

        try {
            targetMessage =
                await channel.messages.fetch(
                    stored.messageId
                );
        } catch (error) {
            // Nachricht existiert nicht mehr (z. B. gelöscht) ->
            // sauber zurücksetzen, kein Fehler-Spam.
            clearLastTeamListMessage(
                guild.id
            );

            return;
        }

        const { embeds } =
            await createTeamListEmbeds(
                guild
            );

        await targetMessage.edit({
            embeds,
            content: null
        });

    } catch (error) {
        console.error(
            "❌ Fehler beim automatischen Aktualisieren der zuletzt erstellten Teamliste:",
            error
        );

    } finally {
        lastTeamListUpdateRunning.delete(
            guild.id
        );
    }
}

async function updateTeamList(
    guild,
    channelId
) {
    if (
        teamListUpdateRunning
    ) {
        return;
    }

    teamListUpdateRunning =
        true;

    try {
        if (!channelId) {
            return;
        }

        const channel =
            await guild.channels.fetch(
                channelId
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return;
        }

        const { embeds } =
            await createTeamListEmbeds(
                guild
            );

        const messages =
            await channel.messages.fetch(
                {
                    limit:
                        100
                }
            );

        const botMessages =
            messages.filter(
                message =>
                    message.author.id ===
                    client.user.id
            );

        if (
            botMessages.size >
            0
        ) {
            const oldMessage =
                botMessages.first();

            await oldMessage.edit({
                embeds,
                content: null
            });

            const extraMessages =
                botMessages.filter(
                    message =>
                        message.id !==
                        oldMessage.id
                );

            for (
                const [, message] of
                extraMessages
            ) {
                try {
                    await message.delete();
                } catch {}
            }

        } else {
            await channel.send({
                embeds
            });
        }

    } catch (error) {
        console.error(
            "❌ Fehler beim Aktualisieren der Teamliste:",
            error
        );

    } finally {
        teamListUpdateRunning =
            false;
    }
}

function startAutoUpdate(
    guild,
    channelId
) {
    if (
        autoUpdateInterval
    ) {
        clearInterval(
            autoUpdateInterval
        );
    }

    updateTeamList(
        guild,
        channelId
    );

    autoUpdateInterval =
        setInterval(
            async () => {
                await updateTeamList(
                    guild,
                    channelId
                );
            },
            5 * 60 * 1000
        );
}

function stopAutoUpdate() {
    if (
        autoUpdateInterval
    ) {
        clearInterval(
            autoUpdateInterval
        );

        autoUpdateInterval =
            null;

        return true;
    }

    return false;
}

// =====================================================
// VERIFIZIERUNG ZÄHLER
// =====================================================

function getVerificationCount() {
    try {
        if (!fs.existsSync(VERIFICATION_COUNT_FILE)) {
            // Beim Bot-Start: Zähler basierend auf verifizierten Rolle wiederherstellen
            return 0; // Wird später beim Bot-Start aktualisiert
        }
        const data = JSON.parse(fs.readFileSync(VERIFICATION_COUNT_FILE, "utf8"));
        return data.count || 0;
    } catch (error) {
        console.error("❌ Fehler beim Laden des Verifizierungszählers:", error);
        return 0;
    }
}

function saveVerificationCount(count) {
    try {
        fs.writeFileSync(VERIFICATION_COUNT_FILE, JSON.stringify({ count }, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Fehler beim Speichern des Verifizierungszählers:", error);
    }
}

function incrementVerificationCount() {
    const currentCount = getVerificationCount();
    const newCount = currentCount + 1;
    saveVerificationCount(newCount);
    return newCount;
}

// =====================================================
// VERIFIZIERUNG PANEL SPEICHERN
// =====================================================

function saveVerificationPanel(channelId, messageId) {
    try {
        fs.writeFileSync(VERIFICATION_PANEL_FILE, JSON.stringify({ channelId, messageId }, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Fehler beim Speichern des Verifizierungs-Panels:", error);
    }
}

function loadVerificationPanel() {
    try {
        if (!fs.existsSync(VERIFICATION_PANEL_FILE)) {
            return null;
        }
        const data = JSON.parse(fs.readFileSync(VERIFICATION_PANEL_FILE, "utf8"));
        return data;
    } catch (error) {
        console.error("❌ Fehler beim Laden des Verifizierungs-Panels:", error);
        return null;
    }
}

// =====================================================
// VERIFIZIERUNGS-PANEL LIVE-STATISTIK ABRUFEN
// =====================================================

async function getVerificationPanelEmbed(guild) {
    try {
        // Echte Zahlen aus Discord abrufen
        const verifiedRole = await guild.roles.fetch(VERIFIED_ROLE_ID).catch(() => null);
        const verifiedCount = verifiedRole ? verifiedRole.members.size : 0;
        const totalMembers = guild.memberCount || guild.members.cache.size || 0;

        const embed = new EmbedBuilder()
            .setColor(0x1e1f22)
            .setTitle("🔐 Server-Verifizierung")
            .setDescription(`
> 👋 Willkommen auf dem Server
> 
> Bevor du den Server nutzen kannst, musst du dich kurz verifizieren.
> Löse dafür einfach das Captcha.

🛡️ Sicherer Server
Die Verifizierung schützt den Server vor Bots, Spam und unerwünschten Accounts.
`)
            .setFooter({
                text: "Vexo RP ✧ 𝙑𝘾 • Verifizierungssystem"
            })
            .setTimestamp();

        return { embed, verifiedCount, totalMembers };
    } catch (error) {
        console.error("❌ Fehler beim Abrufen der Verifizierungs-Statistiken:", error);
        return null;
    }
}

// =====================================================
// VERIFIZIERUNGS-PANEL LIVE AKTUALISIEREN
// =====================================================

async function updateVerificationPanelLive(guild) {
    try {
        const panelData = loadVerificationPanel();
        if (!panelData || !panelData.channelId || !panelData.messageId) {
            return null;
        }

        const channel = await guild.channels.fetch(panelData.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return null;
        }

        const message = await channel.messages.fetch(panelData.messageId).catch(() => null);
        if (!message) {
            return null;
        }

        const result = await getVerificationPanelEmbed(guild);
        if (!result) {
            return null;
        }

        const { embed, verifiedCount, totalMembers } = result;

        // Erstelle die Komponenten mit aktuellen Zahlen
        const verifyRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verify_start")
                    .setLabel("✅ Verifizieren")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("🔐")
            );

        const statsRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verify_count_verified")
                    .setLabel(`👥 Verifiziert: ${verifiedCount}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("verify_count_members")
                    .setLabel(`📊 Mitglieder: ${totalMembers}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("verify_count_security")
                    .setLabel("🛡️ Sicherheit: Aktiv")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

        // Nachricht mit message.edit() aktualisieren
        await message.edit({
            embeds: [embed],
            components: [verifyRow, statsRow]
        });

        return message;
    } catch (error) {
        console.error("❌ Fehler beim Aktualisieren des Live-Verifizierungs-Panels:", error);
        return null;
    }
}

// =====================================================
// VERIFIZIERUNGSPANEL ERSTMALS ERSTELLEN
// =====================================================

async function createVerificationPanel(guild) {
    try {
        // Existierendes Panel prüfen - wenn vorhanden, nicht erneut erstellen
        const existingPanel = loadVerificationPanel();
        if (existingPanel && existingPanel.messageId) {
            console.log("⚠️ Verifizierungs-Panel existiert bereits. Wird aktualisiert statt neu erstellt.");
            await updateVerificationPanelLive(guild);
            return null; // Keine neue Nachricht senden
        }

        const result = await getVerificationPanelEmbed(guild);
        if (!result) {
            return null;
        }

        const { embed, verifiedCount, totalMembers } = result;

        // Komponenten mit aktuellen Zahlen
        const verifyRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verify_start")
                    .setLabel("✅ Verifizieren")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("🔐")
            );

        const statsRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verify_count_verified")
                    .setLabel(`👥 Verifiziert: ${verifiedCount}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("verify_count_members")
                    .setLabel(`📊 Mitglieder: ${totalMembers}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("verify_count_security")
                    .setLabel("🛡️ Sicherheit: Aktiv")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

        return {
            embeds: [embed],
            components: [verifyRow, statsRow]
        };
    } catch (error) {
        console.error("❌ Fehler beim Erstellen des Verifizierungs-Panels:", error);
        return null;
    }
}

// =====================================================
// CAPCHA BILD ERSTELLEN
// =====================================================

function generateRandomString(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Keine ähnlichen Zeichen wie I,1,O,0
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function createCaptchaImage(text) {
    const width = 300;
    const height = 100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Hintergrund mit Grautönen und Rauschen
    for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 50 + 150}, ${Math.random() * 50 + 150}, ${Math.random() * 50 + 150}, ${Math.random() * 0.3})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 20 + 5, Math.random() * 20 + 5);
    }

    // Verzerrte Linien
    for (let i = 0; i < 15; i++) {
        ctx.strokeStyle = `rgba(0, 0, 0, ${Math.random() * 0.5})`;
        ctx.lineWidth = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
    }

    // Text mit Verzerrung
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startX = 30;
    const letterSpacing = 40;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const x = startX + i * letterSpacing;
        const y = height / 2 + (Math.random() - 0.5) * 20;
        const rotation = (Math.random() - 0.5) * 0.5;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        
        // Text Schatten
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillText(char, 2, 2);
        
        // Haupttext
        ctx.fillStyle = '#000000';
        ctx.fillText(char, 0, 0);
        
        ctx.restore();
    }

    // Zusätzliche Verzerrungslinien über dem Text
    for (let i = 0; i < 10; i++) {
        ctx.strokeStyle = `rgba(0, 0, 0, ${Math.random() * 0.3})`;
        ctx.lineWidth = Math.random() * 1.5 + 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
    }

    // Bild als Buffer speichern
    const buffer = canvas.toBuffer('image/png');
    return buffer;
}

function createCaptcha() {
    const correctAnswer = generateRandomString(6);
    const options = [correctAnswer];
    
    // 3 falsche Optionen generieren
    while (options.length < 4) {
        const randomString = generateRandomString(6);
        if (!options.includes(randomString)) {
            options.push(randomString);
        }
    }
    
    // Options mischen
    options.sort(() => Math.random() - 0.5);
    
    return {
        correctAnswer,
        options
    };
}

async function createCaptchaPanel(captcha) {
    // Captcha-Bild generieren
    const imageBuffer = await createCaptchaImage(captcha.correctAnswer);
    
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(VERIFICATION_TEXT.TITLE)
        .setDescription(`
🚨 **Captcha-Verifizierung**

${VERIFICATION_TEXT.DESCRIPTION}

> 📝 Der Code besteht aus **Großbuchstaben und Zahlen**
> ⏱️ Du hast **30 Sekunden** Zeit
> 🔄 Bei falscher Antwort wird ein neuer Code generiert
`)
        .setImage("attachment://captcha.png")
        .setFooter({
            text: `${SERVER_NAME} • Captcha-Verifizierung`
        })
        .setTimestamp();

    // String Select Menu erstellen
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("captcha_select")
        .setPlaceholder(VERIFICATION_TEXT.SELECT_PLACEHOLDER)
        .addOptions(
            captcha.options.map(option => ({
                label: option,
                value: option,
                emoji: { name: "✅" }
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return {
        embeds: [embed],
        components: [row],
        files: [{
            attachment: imageBuffer,
            name: 'captcha.png'
        }]
    };
}

// =====================================================
// RP PANEL
// =====================================================

function createRPPanel(guildId) {
    const currentChannel = `<#${RP_ANNOUNCEMENT_CHANNEL_ID}>`;

    const embed =
        new EmbedBuilder()
            .setColor(
                0x5865F2
            )
            .setTitle(
                RP_PANEL_TITLE
            )
            .setDescription(
                RP_PANEL_DESCRIPTION +
                `\n\n📁 **Aktueller RP-Kanal:** ${currentChannel}`
            )
            .setFooter({
                text:
                    "RP-Verwaltung"
            });

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "rp_start"
                    )
                    .setLabel(
                        "RP Start"
                    )
                    .setEmoji(
                        "🟢"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "rp_stop"
                    )
                    .setLabel(
                        "RP Stop"
                    )
                    .setEmoji(
                        "🔴"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

// =====================================================
// TEAM PANEL
// =====================================================

function createTeamPanel() {
    const embed =
        new EmbedBuilder()
            .setColor(
                0x5865F2
            )
            .setTitle(
                TEAM_PANEL_TITLE
            )
            .setDescription(
                TEAM_PANEL_DESCRIPTION
            )
            .setFooter({
                text:
                    "Teamverwaltung"
            });

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "team_uprank"
                    )
                    .setLabel(
                        "Up-Rank"
                    )
                    .setEmoji(
                        "⬆️"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "team_warn"
                    )
                    .setLabel(
                        "Warnen"
                    )
                    .setEmoji(
                        "⚠️"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "team_degrade"
                    )
                    .setLabel(
                        "Degradieren"
                    )
                    .setEmoji(
                        "📉"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "team_warnback"
                    )
                    .setLabel(
                        "Warnen zurück"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "team_kick"
                    )
                    .setLabel(
                        "Kick"
                    )
                    .setEmoji(
                        "👢"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "team_management"
                    )
                    .setLabel(
                        "Teamverwaltung"
                    )
                    .setEmoji(
                        "⚙️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    return {
        embeds: [embed],
        components: [
            row1,
            row2,
            row3
        ]
    };
}

// =====================================================
// TEAM-PANEL: TEAMVERWALTUNG (KANAL-EINSTELLUNGEN)
// =====================================================

// Hauptmenü der Teamverwaltung: zeigt die aktuell konfigurierten Kanäle
// für Rank-, Warn- und Team-Kick-Aktionen und erlaubt deren Änderung.
function createTeamManagementPanel(guild) {
    const config = getTeamManagementConfig(guild.id);

    const formatChannel = channelId =>
        channelId ? `<#${channelId}>` : "❌ Nicht konfiguriert";

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("⚙️ Teamverwaltung")
        .setDescription(
            "Lege hier die Kanäle fest, in denen die einzelnen Teamaktionen protokolliert werden."
        )
        .addFields(
            {
                name: "📊 Rank-Kanal (Up-Rank & Down-Rank)",
                value: formatChannel(config.rankChannelId),
                inline: false
            },
            {
                name: "⚠️ Warn-Kanal (Warnen & Warnen zurück)",
                value: formatChannel(config.warnChannelId),
                inline: false
            },
            {
                name: "👢 Team-Kick-Kanal",
                value: formatChannel(config.teamKickChannelId),
                inline: false
            }
        )
        .setFooter({ text: "Teamverwaltung" });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("team_mgmt_set_rank")
            .setLabel("Rank-Kanal festlegen")
            .setEmoji("📊")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("team_mgmt_set_warn")
            .setLabel("Warn-Kanal festlegen")
            .setEmoji("⚠️")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("team_mgmt_set_kick")
            .setLabel("Team-Kick-Kanal festlegen")
            .setEmoji("👢")
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("team_mgmt_back")
            .setLabel("Zurück")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [row1, row2]
    };
}

// Paginierte Kanalauswahl (Textkanäle) für einen Teamverwaltungs-Typ
// (rank/warn/kick). Nutzt dieselbe Kanalliste wie das Textsende-System.
function createTeamManagementChannelSelector(guild, page, type) {
    const typeInfo = TEAM_MANAGEMENT_TYPES[type];

    const channels = Array.from(getSendableTextChannels(guild).values());

    const totalPages = Math.max(
        1,
        Math.ceil(channels.length / TEXTSENDE_PER_PAGE)
    );

    page = Math.max(0, Math.min(page, totalPages - 1));

    const start = page * TEXTSENDE_PER_PAGE;
    const currentChannels = channels.slice(start, start + TEXTSENDE_PER_PAGE);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${typeInfo.emoji} ${typeInfo.label} festlegen`)
        .setDescription(
            `${typeInfo.description}.\n\nWähle unten einen Textkanal aus (Seite ${page + 1}/${totalPages}).`
        );

    const components = [];

    if (currentChannels.length > 0) {
        const options = currentChannels.map(channel =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`#${channel.name}`.slice(0, 100))
                .setValue(channel.id)
                .setDescription(
                    `${channel.parent?.name || "Ohne Kategorie"}`.slice(0, 100)
                )
                .setEmoji(
                    channel.type === ChannelType.GuildAnnouncement ? "📢" : "💬"
                )
        );

        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`team_mgmt_channel_select_${type}`)
                    .setPlaceholder("📂 Kanal auswählen...")
                    .addOptions(options)
            )
        );
    }

    components.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`team_mgmt_page_prev_${page}_${type}`)
                .setLabel("Zurück")
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`team_mgmt_page_back_${type}`)
                .setLabel("Zurück zur Teamverwaltung")
                .setEmoji("↩️")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`team_mgmt_page_next_${page}_${type}`)
                .setLabel("Weiter")
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        )
    );

    return {
        embeds: [embed],
        components
    };
}

// Zeigt den aktuell gesetzten Kanal für einen Typ (rank/warn/kick) mit
// der Möglichkeit, ihn erneut zu ändern oder zurückzugehen.
function createTeamManagementStatusScreen(guild, type) {
    const typeInfo = TEAM_MANAGEMENT_TYPES[type];
    const channelId = getTeamManagementChannelId(guild.id, type);

    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`${typeInfo.emoji} ${typeInfo.label}`)
        .setDescription(
            `Aktueller Kanal: ${channelId ? `<#${channelId}>` : "❌ Nicht konfiguriert"}`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`team_mgmt_change_${type}`)
            .setLabel("Kanal ändern")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("team_mgmt_status_back")
            .setLabel("Zurück")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [row]
    };
}

// =====================================================
// USER SELECTOR
// =====================================================

function createUserSelector(
    action
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                0x5865F2
            )
            .setTitle(
                "👤 Benutzer auswählen"
            )
            .setDescription(
                "Wähle den Benutzer aus, auf den die Aktion angewendet werden soll."
            );

    const row =
        new ActionRowBuilder()
            .addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(
                        `select_user_${action}`
                    )
                    .setPlaceholder(
                        "👤 Benutzer auswählen"
                    )
                    .setMinValues(
                        1
                    )
                    .setMaxValues(
                        1
                    )
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

// =====================================================
// TEAM LOG
// =====================================================

async function teamLog(
    guild,
    title,
    color,
    fields
) {
    try {
        if (
            TEAM_LOG_CHANNEL_ID ===
            "TEAM_LOG_CHANNEL_ID"
        ) {
            return;
        }

        const channel =
            await guild.channels.fetch(
                TEAM_LOG_CHANNEL_ID
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return;
        }

        const embed =
            new EmbedBuilder()
                .setColor(
                    color
                )
                .setTitle(
                    title
                )
                .addFields(
                    fields
                )
                .setTimestamp();

        await channel.send({
            embeds: [embed]
        });

    } catch {}
}

// =====================================================
// TEAM KICK LOG
// =====================================================

async function teamKickLog(
    guild,
    target,
    executor,
    reason =
        "Kein Grund angegeben",
    removedRoleNames = []
) {
    const channelId =
        getTeamManagementChannelId(guild.id, "kick") ||
        TEAM_KICK_LOG_CHANNEL_ID;
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
        throw new Error(`Team-Kick-Log-Kanal ${channelId} fehlt oder ist kein Textkanal.`);
    }

    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("❌ TEAM KICK")
        .setDescription([
            TEAM_LOG_DIVIDER,
            `👤 MITGLIED: ${target} | ${target.user.tag}`,
            TEAM_LOG_DIVIDER,
            `👮 DURCH: ${executor} | ${executor.user.tag}`,
            TEAM_LOG_DIVIDER,
            `📝 GRUND: > ${reason.slice(0, 900)}`,
            TEAM_LOG_DIVIDER,
            `🗑️ ENTFERNTE TEAMROLLEN: ${removedRoleNames.length ? removedRoleNames.join(", ").slice(0, 900) : "Keine"}`,
            TEAM_LOG_DIVIDER,
            `🕐 Wann: ${formatTeamLogTimestamp()}`,
            TEAM_LOG_DIVIDER
        ].join("\n"))
        .setFooter({ text: teamLogFooterText() })
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}

// =====================================================
// MEMBER JOIN
// =====================================================

client.on(
    "guildMemberAdd",
    async member => {

        // Keine Server-Beschränkung mehr - Bot geht auf allen Servern

        await syncNickname(
            member
        );

        // =========================================
        // VERIFIZIERUNGS-PANEL AKTUALISIEREN
        // =========================================
        try {
            await updateVerificationPanelLive(member.guild);
        } catch (error) {
            console.error("⚠️ Fehler beim Aktualisieren des Verifizierungs-Panels bei Member Join:", error);
        }

        // =========================================
        // LOG-SYSTEM
        // =========================================
        // Hinweis: Member-Join-Logging ist bewusst deaktiviert und darf
        // nicht wieder aktiviert werden. (Vorher: await logMemberJoin(member);)

        const memberCount =
            member.guild.memberCount;

        try {
            const welcomeChannel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
            if (!welcomeChannel?.isTextBased()) {
                console.warn(
                    `⚠️ Willkommenskanal ${WELCOME_CHANNEL_ID} fehlt auf ${member.guild.name}.`
                );
            } else {
                const joinedAt = member.joinedTimestamp || Date.now();
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x0893f3)
                    .setTitle("👋 W I L L K O M M E N")
                    .setDescription(
                        `Hey ${member}, willkommen bei **Vexo RP**! 💜\n\n` +
                        "Schön, dass du zu uns gefunden hast.\n" +
                        "Nimm dir bitte etwas Zeit und schau dich in Ruhe um.\n\n" +
                        "📌 **Wichtige Infos:**\n" +
                        `• Lies bitte die <#${DISCORD_RULES_CHANNEL_ID}> durch.\n` +
                        `• Lies bitte die IC-Regeln in <#${IC_RULES_CHANNEL_ID}> durch.\n\n` +
                        "Hab viel Spaß beim Roleplay! 💗"
                    )
                    .addFields(
                        {
                            name: "📅 Beigetreten am",
                            value: `<t:${Math.floor(joinedAt / 1000)}:F>`,
                            inline: true
                        },
                        {
                            name: "📊 Mitglieder jetzt",
                            value: memberCount.toLocaleString("de-DE"),
                            inline: true
                        }
                    )
                    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                    .setFooter({ text: "Vexo RP" })
                    .setTimestamp();

                await welcomeChannel.send({
                    content: `👋 Willkommen ${member} bei **Vexo RP**!`,
                    embeds: [welcomeEmbed],
                    allowedMentions: { users: [member.id] }
                });
            }
        } catch (error) {
            console.error(
                `❌ Willkommensnachricht für ${member.user.tag} konnte nicht gesendet werden:`,
                error
            );
        }

        const embed =
            new EmbedBuilder()
                .setColor(
                    0x0893f3
                )
                .setTitle(
                    "📥 Mitglied beigetreten"
                )
                .addFields(
                    {
                        name:
                            "👤 Mitglied",
                        value:
                            `${member}\n${member.user.tag}`,
                        inline:
                            false
                    },
                    {
                        name:
                            "👥 Mitglieder",
                        value:
                            memberCount.toString(),
                        inline:
                            true
                    },
                    {
                        name:
                            "🕐 Zeitpunkt",
                        value:
                            new Date().toLocaleString(
                                "de-DE"
                            ),
                        inline:
                            true
                    }
                )
                .setTimestamp()
                .setFooter({
                    text:
                        "Vexo RP ✧ 𝙑𝘾 • Join Logs"
                });

        await sendLog(
            member.guild,
            JOIN_LOG_CHANNEL_ID,
            embed
        );
    }
);

// =====================================================
// MEMBER LEAVE
// =====================================================

client.on(
    "guildMemberRemove",
    async member => {

        // Keine Server-Beschränkung mehr - Bot geht auf allen Servern

        // =========================================
        // VERIFIZIERUNGS-PANEL AKTUALISIEREN
        // =========================================
        try {
            await updateVerificationPanelLive(member.guild);
        } catch (error) {
            console.error("⚠️ Fehler beim Aktualisieren des Verifizierungs-Panels bei Member Leave:", error);
        }

        // =========================================
        // LOG-SYSTEM
        // =========================================
        // Hinweis: Member-Leave-Logging ist bewusst deaktiviert und darf
        // nicht wieder aktiviert werden. (Vorher: await logMemberLeave(member);)

        const entry =
            await getLatestAuditLog(
                member.guild,
                AuditLogEvent.MemberKick,
                member.id
            );

        const wasKicked =
            Boolean(entry);

        const memberCount =
            member.guild.memberCount;

        const embed =
            new EmbedBuilder()
                .setColor(
                    wasKicked
                        ? 0xED4245
                        : 0xFEE75C
                )
                .setTitle(
                    wasKicked
                        ? "👢 Mitglied gekickt"
                        : "📤 Mitglied verlassen"
                )
                .addFields(
                    {
                        name:
                            "👤 Mitglied",
                        value:
                            `${member.user?.tag || member.id}`,
                        inline:
                            false
                    },
                    {
                        name:
                            "👥 Mitglieder",
                        value:
                            memberCount.toString(),
                        inline:
                            true
                    },
                    {
                        name:
                            "👮 Ausgeführt von",
                        value:
                            wasKicked &&
                            entry?.executor
                                ? `${entry.executor}\n${entry.executor.tag}`
                                : "System / unbekannt",
                        inline:
                            false
                    },
                    {
                        name:
                            "📝 Grund",
                        value:
                            entry?.reason ||
                            (
                                wasKicked
                                    ? "Kein Grund angegeben"
                                    : "Mitglied hat den Server verlassen."
                            ),
                        inline:
                            false
                    }
                )
                .setTimestamp()
                .setFooter({
                    text:
                        "Vexo RP ✧ 𝙑𝘾 • Left Logs"
                });

        await sendLog(
            member.guild,
            LEFT_LOG_CHANNEL_ID,
            embed
        );

        if (
            wasKicked
        ) {
            await sendLog(
                member.guild,
                MODERATION_LOG_CHANNEL_ID,
                embed
            );

            await sendLog(
                member.guild,
                SECURITY_LOG_CHANNEL_ID,
                embed
            );
        }
    }
);

// =====================================================
// MEMBER UPDATE
// =====================================================

client.on(
    "guildMemberUpdate",
    async (
        oldMember,
        newMember
    ) => {

        // Keine Server-Beschränkung mehr - Bot geht auf allen Servern

        // =================================================
        // NICKNAME-SYSTEM → NUR BEI RELEVANTER ROLLENÄNDERUNG
        // =================================================

        const nicknameRelevantRolesChanged =
            oldMember.roles.cache.has(DEV_ROLE_ID) !==
                newMember.roles.cache.has(DEV_ROLE_ID) ||
            (
                getHighestNicknameRoleEntry(oldMember)?.roleId ||
                null
            ) !==
            (
                getHighestNicknameRoleEntry(newMember)?.roleId ||
                null
            );

        if (nicknameRelevantRolesChanged) {
            await syncNickname(
                newMember
            );
        }

        // =================================================
        // NICKNAME → EDIT LOGS
        // =================================================

        const nicknameChanged =
            oldMember.nickname !==
            newMember.nickname;

        if (
            nicknameChanged
        ) {

            const entry =
                await getLatestAuditLog(
                    newMember.guild,
                    AuditLogEvent.MemberUpdate,
                    newMember.id
                );

            const executor =
                entry?.executor
                    ? `${entry.executor}\n${entry.executor.tag}`
                    : "Unbekannt";

            const oldNickname =
                oldMember.nickname ||
                oldMember.user.username ||
                "Kein Nickname";

            const newNickname =
                newMember.nickname ||
                newMember.user.username ||
                "Kein Nickname";

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xFEE75C
                    )
                    .setTitle(
                        "✏️ Nickname geändert"
                    )
                    .addFields(
                        {
                            name:
                                "👤 Mitglied",
                            value:
                                `${newMember}\n${newMember.user.tag}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "📝 Alter Nickname",
                            value:
                                oldNickname,
                            inline:
                                false
                        },
                        {
                            name:
                                "📝 Neuer Nickname",
                            value:
                                newNickname,
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                executor,
                            inline:
                                false
                        },
                        {
                            name:
                                "🕐 Zeitpunkt",
                            value:
                                new Date().toLocaleString(
                                    "de-DE"
                                ),
                            inline:
                                false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • Edit Logs"
                    });

            await sendLog(
                newMember.guild,
                EDIT_LOG_CHANNEL_ID,
                embed
            );
        }

        // =================================================
        // TIMEOUT START
        // =================================================

        const oldTimeout =
            oldMember.communicationDisabledUntilTimestamp;

        const newTimeout =
            newMember.communicationDisabledUntilTimestamp;

        if (
            !oldTimeout &&
            newTimeout
        ) {

            const entry =
                await getLatestAuditLog(
                    newMember.guild,
                    AuditLogEvent.MemberUpdate,
                    newMember.id
                );

            const executor =
                entry?.executor
                    ? `${entry.executor}\n${entry.executor.tag}`
                    : "Unbekannt";

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xFEE75C
                    )
                    .setTitle(
                        "⏳ Mitglied getimeoutet"
                    )
                    .addFields(
                        {
                            name:
                                "👤 Mitglied",
                            value:
                                `${newMember}\n${newMember.user.tag}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                executor,
                            inline:
                                false
                        },
                        {
                            name:
                                "📝 Grund",
                            value:
                                entry?.reason ||
                                "Kein Grund angegeben",
                            inline:
                                false
                        },
                        {
                            name:
                                "🕐 Timeout bis",
                            value:
                                `<t:${Math.floor(
                                    newTimeout / 1000
                                )}:F>`,
                            inline:
                                false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • Moderation Logs"
                    });

            await sendLog(
                newMember.guild,
                MODERATION_LOG_CHANNEL_ID,
                embed
            );
        }

        // =================================================
        // TIMEOUT ENTFERNT
        // =================================================

        if (
            oldTimeout &&
            !newTimeout
        ) {

            const entry =
                await getLatestAuditLog(
                    newMember.guild,
                    AuditLogEvent.MemberUpdate,
                    newMember.id
                );

            const executor =
                entry?.executor
                    ? `${entry.executor}\n${entry.executor.tag}`
                    : "Unbekannt";

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0x57F287
                    )
                    .setTitle(
                        "✅ Timeout aufgehoben"
                    )
                    .addFields(
                        {
                            name:
                                "👤 Mitglied",
                            value:
                                `${newMember}\n${newMember.user.tag}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                executor,
                            inline:
                                false
                        },
                        {
                            name:
                                "📝 Grund",
                            value:
                                entry?.reason ||
                                "Kein Grund angegeben",
                            inline:
                                false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • Moderation Logs"
                    });

            await sendLog(
                newMember.guild,
                MODERATION_LOG_CHANNEL_ID,
                embed
            );
        }

        // =================================================
        // ROLLEN → MODERATION LOGS
        // =================================================

        const addedRoles =
            newMember.roles.cache.filter(
                role =>
                    !oldMember.roles.cache.has(
                        role.id
                    )
            );

        const removedRoles =
            oldMember.roles.cache.filter(
                role =>
                    !newMember.roles.cache.has(
                        role.id
                    )
            );

        addedRoles.delete(
            newMember.guild.id
        );

        removedRoles.delete(
            newMember.guild.id
        );

        // =========================================
        // VERIFIZIERUNGS-PANEL AKTUALISIEREN BEI ROLLEN-ÄNDERUNG
        // =========================================
        if (
            addedRoles.has(VERIFIED_ROLE_ID) ||
            removedRoles.has(VERIFIED_ROLE_ID)
        ) {
            try {
                await updateVerificationPanelLive(newMember.guild);
            } catch (error) {
                console.error("⚠️ Fehler beim Aktualisieren des Verifizierungs-Panels bei Rollen-Änderung:", error);
            }
        }

        if (
            addedRoles.size >
                0 ||
            removedRoles.size >
                0
        ) {

            const entry =
                await getLatestAuditLog(
                    newMember.guild,
                    AuditLogEvent.MemberRoleUpdate,
                    newMember.id
                );

            const executor =
                entry?.executor
                    ? `${entry.executor}\n${entry.executor.tag}`
                    : "Unbekannt";

            const changes = [];

            if (
                addedRoles.size >
                0
            ) {
                changes.push(
                    `🟢 **Rolle(n) hinzugefügt:**\n${addedRoles.map(
                        role =>
                            `• ${role.name}`
                    ).join("\n")}`
                );
            }

            if (
                removedRoles.size >
                0
            ) {
                changes.push(
                    `🔴 **Rolle(n) entfernt:**\n${removedRoles.map(
                        role =>
                            `• ${role.name}`
                    ).join("\n")}`
                );
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0x5865F2
                    )
                    .setTitle(
                        "🎭 Mitgliedsrollen geändert"
                    )
                    .addFields(
                        {
                            name:
                                "👤 Mitglied",
                            value:
                                `${newMember}\n${newMember.user.tag}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "📋 Änderung",
                            value:
                                                               changes.join(
                                    "\n\n"
                                ),
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                executor,
                            inline:
                                false
                        },
                        {
                            name:
                                "🕐 Zeitpunkt",
                            value:
                                new Date().toLocaleString(
                                    "de-DE"
                                ),
                            inline:
                                false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • Moderation Logs"
                    });

            await sendLog(
                newMember.guild,
                MODERATION_LOG_CHANNEL_ID,
                embed
            );
        }

        // =================================================
        // SECURITY LOG – ROLLENÄNDERUNG
        // =================================================

        if (
            addedRoles.size >
                0 ||
            removedRoles.size >
                0
        ) {

            const entry =
                await getLatestAuditLog(
                    newMember.guild,
                    AuditLogEvent.MemberRoleUpdate,
                    newMember.id
                );

            const executor =
                entry?.executor
                    ? `${entry.executor}\n${entry.executor.tag}`
                    : "Unbekannt";

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xED4245
                    )
                    .setTitle(
                        "🔐 Security – Rollenänderung"
                    )
                    .addFields(
                        {
                            name:
                                "👤 Mitglied",
                            value:
                                `${newMember}\n${newMember.user.tag}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "🟢 Hinzugefügt",
                            value:
                                addedRoles.size >
                                0
                                    ? addedRoles.map(
                                        role =>
                                            `• ${role.name}`
                                      ).join("\n")
                                    : "Keine",
                            inline:
                                false
                        },
                        {
                            name:
                                "🔴 Entfernt",
                            value:
                                removedRoles.size >
                                0
                                    ? removedRoles.map(
                                        role =>
                                            `• ${role.name}`
                                      ).join("\n")
                                    : "Keine",
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                executor,
                            inline:
                                false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • Security Logs"
                    });

            await sendLog(
                newMember.guild,
                SECURITY_LOG_CHANNEL_ID,
                embed
            );
        }

        // =================================================
        // TEAMLISTE
        // =================================================

        const oldTeamRoles =
            oldMember.roles.cache
                .filter(
                    role =>
                        Object.values(
                            TEAM_ROLES
                        ).includes(
                            role.id
                        )
                )
                .map(
                    role =>
                        role.id
                )
                .sort();

        const newTeamRoles =
            newMember.roles.cache
                .filter(
                    role =>
                        Object.values(
                            TEAM_ROLES
                        ).includes(
                            role.id
                        )
                )
                .map(
                    role =>
                        role.id
                )
                .sort();

        if (
            JSON.stringify(
                oldTeamRoles
            ) !==
            JSON.stringify(
                newTeamRoles
            )
        ) {

            await updateTeamList(
                newMember.guild,
                TEAMLIST_AUTO_UPDATE_CHANNEL_ID
            );

            // Zusätzlich die zuletzt mit !teamliste erstellte Nachricht
            // (unabhängig vom Auto-Update-Kanal) aktuell halten.
            await updateLastTeamListMessage(
                newMember.guild
            );
        }
    }
);

// =====================================================
// AUTO-KANAL-AUSWAHL BEIM SERVER-BEITRITT
// =====================================================
// Wenn der Bot neu zu einem Server eingeladen wird ("guildCreate"),
// wählt er automatisch einen passenden Textkanal aus, in dem er
// eine kurze Begrüßungsnachricht postet.
//
// Priorität der Auswahl:
//   1. Ein Textkanal, dessen Name "moderation only" enthält oder
//      exakt so lautet (bei mehreren: der oberste in der Kanalliste).
//   2. Falls keiner existiert: ein Textkanal, dessen Name "chat"
//      enthält oder exakt so lautet (bei mehreren: der oberste).
//   3. Falls auch das nicht existiert: der oberste verfügbare
//      normale Textkanal auf dem Server.
//
// In allen Fällen muss der Bot im jeweiligen Kanal Nachrichten
// senden und Embeds einbetten dürfen. Das Event "guildCreate"
// feuert ausschließlich, wenn der Bot tatsächlich neu zu einem
// Server hinzugefügt wird – nicht bei einem normalen Neustart, bei
// dem der Bot lediglich wieder mit bereits vorhandenen Servern
// verbunden wird. Es ist daher keine zusätzliche Speicherdatei
// nötig, um "neu" von "Neustart" zu unterscheiden.

// Fester Begrüßungstext, der NUR beim Server-Beitritt (guildCreate)
// gesendet wird. Der dynamische `!befehle`-Befehl (buildCommandOverviewMessage)
// bleibt davon komplett unberührt und unverändert.
const GUILD_JOIN_WELCOME_TEXT =
`🤖 **NEXORACLOUD**
*Mehr als nur ein Bot.*

🚀 **Willkommen bei Vexo RP!**
Ein leistungsstarker Discord-Bot für **Verwaltung, RP, Teamverwaltung und viele weitere Funktionen.**

━━━━━━━━━━━━━━━━━━━━

📋 **ALLGEMEIN**

\`!befehle\` → Zeigt alle verfügbaren Befehle
\`!statistik\` → Zeigt wichtige Statistiken an

🚨 **RP-SYSTEM**

\`/rppanel\` → Öffnet die RP-Verwaltung

👥 **TEAM-SYSTEM**

\`/teampanel\` → Öffnet die Teamverwaltung
\`/teamliste\` → Zeigt die aktuelle Teamliste
\`/teamliste-update-start\` → Startet automatische Teamlisten-Updates
\`/teamliste-update-stop\` → Stoppt automatische Teamlisten-Updates
\`/teamstatistik\` → Zeigt Teamstatistik und Mitgliedsdetails
\`/teambewerbung\` → Erstellt das Bewerbungspanel
\`/teambewerbungtext\` → Erstellt das Panel und setzt den Kanal für neue Bewerbungen
\`/team-bewerbungen\` → Zeigt gespeicherte Bewerbungen

🏠 **HÄUSER-SYSTEM**

\`!häuserpannel\` → Öffnet das Häuserpanel
\`!häuserliste\` → Zeigt die aktuelle Häuserliste

🏷️ **NAME-TAG-SYSTEM**

\`!name-tag-set\` → Aktualisiert die Bürger-Namens-Tags

📨 **NACHRICHTEN**

\`!text-sende\` → Öffnet das Nachrichtensystem

━━━━━━━━━━━━━━━━━━━━

💙 **NEXORACLOUD AUF DEINEM DISCORD?**

Du möchtest Vexo RP auf deinem eigenen Discord nutzen?

🔗 **Community & Support:**
https://discord.gg/yQvcUjeH8r

Dort findest du **Support, Informationen und Hilfe rund um Vexo RP.**

━━━━━━━━━━━━━━━━━━━━

🤖 **NEXORACLOUD**
*Modern • Schnell • Zuverlässig*`;

function channelNameMatches(channelName, keyword) {
    const normalizedName = (channelName || "").toLowerCase().trim();
    const normalizedKeyword = keyword.toLowerCase();

    return (
        normalizedName === normalizedKeyword ||
        normalizedName.includes(normalizedKeyword)
    );
}

function botCanUseChannel(channel, botMember) {
    if (!botMember) {
        return false;
    }

    const permissions = channel.permissionsFor(botMember);

    return Boolean(
        permissions &&
        permissions.has(PermissionsBitField.Flags.SendMessages) &&
        permissions.has(PermissionsBitField.Flags.EmbedLinks)
    );
}

function pickTopmostChannel(channels) {
    if (!channels.length) {
        return null;
    }

    return [...channels].sort(
        (a, b) => a.rawPosition - b.rawPosition
    )[0];
}

async function findAutoWelcomeChannel(guild) {
    const botMember =
        guild.members.me ||
        await guild.members.fetch(client.user.id).catch(() => null);

    const usableTextChannels = guild.channels.cache.filter(channel =>
        channel.type === ChannelType.GuildText &&
        botCanUseChannel(channel, botMember)
    );

    if (!usableTextChannels.size) {
        return null;
    }

    // 1. "Moderation Only"
    const moderationOnlyChannels = usableTextChannels.filter(channel =>
        channelNameMatches(channel.name, "moderation only")
    );

    if (moderationOnlyChannels.size) {
        return pickTopmostChannel([...moderationOnlyChannels.values()]);
    }

    // 2. "Chat"
    const chatChannels = usableTextChannels.filter(channel =>
        channelNameMatches(channel.name, "chat")
    );

    if (chatChannels.size) {
        return pickTopmostChannel([...chatChannels.values()]);
    }

    // 3. Fallback: oberster verfügbarer Textkanal
    return pickTopmostChannel([...usableTextChannels.values()]);
}

client.on(
    "guildCreate",
    async guild => {
        try {
            console.log(
                `➕ Bot wurde neu zum Server "${guild.name}" (${guild.id}) hinzugefügt.`
            );

            const welcomeChannel = await findAutoWelcomeChannel(guild);

            if (!welcomeChannel) {
                console.log(
                    `⚠️ Kein nutzbarer Textkanal auf "${guild.name}" gefunden – keine Begrüßungsnachricht gesendet.`
                );
                return;
            }

            await sendLongTextInChunks(
                welcomeChannel,
                GUILD_JOIN_WELCOME_TEXT
            );

            try {
                await logGuildAction(
                    `Bot neu hinzugefügt – automatischer Kanal gewählt: #${welcomeChannel.name}`,
                    client.user,
                    guild,
                    "Erfolgreich",
                    null
                );
            } catch (error) {
                console.error(
                    "❌ Fehler beim Loggen der Server-Beitritts-Aktion:",
                    error
                );
            }

        } catch (error) {
            console.error(
                `❌ Fehler bei der automatischen Kanal-Auswahl auf "${guild?.name}":`,
                error
            );
        }
    }
);

// =====================================================
// READY
// =====================================================

client.once(
    "clientReady",
    async () => {

        console.log(
            "===================================="
        );

        console.log(
            "🤖 BOT ONLINE\n\n Der Bot wurde erfolgreich gestartet und ist nun online.\n\n 🟢 Status: Online \n ⚡ System: Bereit"
        );

        console.log(
            "===================================="
        );

        console.log(
            `🤖 Bot: ${client.user.tag}`
        );

        // =========================================
        // LOG-SYSTEM INITIALISIEREN
        // =========================================
        try {
            await initializeLogger(client);
            console.log("📊 Log-System erfolgreich initialisiert");
        } catch (error) {
            console.error("❌ Fehler beim Initialisieren des Log-Systems:", error);
        }

        // =========================================
        // SELBSTZERSTÖRUNG → OFFENE WIEDERHERSTELLUNGEN
        // =========================================
        try {
            initializeSelfDestructRestoreOnStartup();
        } catch (error) {
            console.error(
                "❌ Fehler beim Wiederherstellen offener Selbstzerstörungen:",
                error
            );
        }

        try {

            const guild =
                await client.guilds.fetch(
                    DEFAULT_GUILD_ID
                ).catch(err => {
                    console.log("⚠️ DEFAULT_GUILD_ID konnte nicht geladen werden. Das ist optional.");
                    return null;
                });

            if (!guild) {
                console.log("ℹ️ Bot läuft, aber DEFAULT_GUILD_ID ist nicht erreichbar.");
                saveVerificationCount(0);
            } else {
                await updateAllNicknames(
                    guild
                );
                
                // Verifizierungszähler basierend auf verifizierten Rolle wiederherstellen
                try {
                    const verifiedRole = await guild.roles.fetch(VERIFIED_ROLE_ID).catch(() => null);
                    if (verifiedRole) {
                        const verifiedCount = verifiedRole.members.size;
                        saveVerificationCount(verifiedCount);
                        console.log(`📊 Verifizierungszähler wiederhergestellt: ${verifiedCount} Mitglieder`);
                    }
                } catch (error) {
                    console.log("⚠️ Fehler beim Wiederherstellen des Verifizierungszählers:", error.message);
                }

                // =========================================
                // VERIFIZIERUNGS-PANEL BEIM START AKTUALISIEREN
                // =========================================
                try {
                    await updateVerificationPanelLive(guild);
                    console.log("✅ Verifizierungs-Panel beim Start aktualisiert");
                } catch (error) {
                    console.log("⚠️ Fehler beim Aktualisieren des Verifizierungs-Panels beim Start:", error.message);
                }

                // =========================================
                // PERIODISCHE SYNCHRONISIERUNG (optional)
                // =========================================
                // Alle 5 Minuten die Panel-Statistiken aktualisieren
                if (!global.verificationPanelSyncInterval) {
                    global.verificationPanelSyncInterval = setInterval(async () => {
                        try {
                            for (const [, guild] of client.guilds.cache) {
                                await updateVerificationPanelLive(guild).catch(() => {});
                            }
                        } catch (error) {
                            console.log("⚠️ Fehler bei der periodischen Synchronisierung:", error.message);
                        }
                    }, 5 * 60 * 1000); // 5 Minuten
                }
            }

        } catch (error) {

            console.log(
                "⚠️ Fehler beim Bot-Start:",
                error.message
            );
            
            // Verifizierungszähler auf 0 setzen wenn Guild nicht gefunden
            saveVerificationCount(0);
        }

        const restartChannelId =
            loadRestartChannelId();

        if (
            restartChannelId
        ) {

            try {

                const guild =
                    await client.guilds.fetch(
                        DEFAULT_GUILD_ID
                    );

                const channel =
                    await guild.channels.fetch(
                        restartChannelId
                    );

                if (
                    channel &&
                    channel.isTextBased()
                ) {

                    await channel.send(
                        "✅ Der Bot ist wieder online!"
                    );
                }

                fs.unlinkSync(
                    RESTART_CHANNEL_FILE
                );

            } catch (error) {

                console.log(
                    "⚠️ Neustart-Nachricht konnte nicht gesendet werden:",
                    error.message
                );
            }
        }

        // =========================================
        // 🎉 GIVEAWAYS NACH NEUSTART WIEDERHERSTELLEN
        // =========================================
        try {
            initializeGiveawaySchedules(client);
            console.log("✅ Giveaway-Timer wiederhergestellt");
        } catch (error) {
            console.log(
                "⚠️ Fehler beim Wiederherstellen der Giveaway-Timer:",
                error.message
            );
        }

        // =========================================
        // 🤖 BOT-STATUS-SYSTEM INITIALISIEREN
        // =========================================
        try {
            initializeBotStatusSystem(client);
            console.log("✅ Bot-Status-System initialisiert");
        } catch (error) {
            console.error("❌ Fehler beim Initialisieren des Bot-Status-Systems:", error);
        }

        // =========================================
        // 🤖 BOT-STATUS-PANELS BEIM START AKTUALISIEREN
        // =========================================
        try {
            await handleBotReady(client);
            console.log("✅ Bot-Status-Panels beim Start aktualisiert");
        } catch (error) {
            console.log("⚠️ Fehler beim Aktualisieren der Bot-Status-Panels beim Start:", error.message);
        }
    }
);

// =====================================================
// HERUNTERFAHREN / NEUSTART
// =====================================================

async function restartBotProcess() {
    try {
        // Bot-Status-System Shutdown aufrufen
        try {
            await handleShutdown(client, "Manueller Neustart über !restart Command");
        } catch (error) {
            console.error("❌ Fehler beim Bot-Status-System Shutdown:", error);
        }

        const child = spawn(
            process.argv[0],
            process.argv.slice(1),
            {
                detached: true,
                stdio: "inherit"
            }
        );

        child.unref();

        setTimeout(() => {
            process.exit(0);
        }, 500);
    } catch (error) {
        console.error(
            "❌ Neustart konnte nicht ausgeführt werden:",
            error
        );
    }
}

async function shutdownBot(message) {
    try {
        await message.reply(
            "🔴 Der Bot wird heruntergefahren..."
        );
    } catch (_) {}

    // Bot-Status-System Shutdown aufrufen
    try {
        const { handleShutdown } = require("./Bot-Status-System/Bot-Status-System");
        await handleShutdown(client, "Manueller Shutdown über !shutdown Command");
    } catch (error) {
        console.error("❌ Fehler beim Bot-Status-System Shutdown:", error);
    }

    setTimeout(async () => {
        try {
            if (client.isReady()) {
                await client.destroy();
            }
        } catch (_) {}

        process.exit(0);
    }, 700);
}
// =====================================================
// 🎉 GIVEAWAY-SYSTEM
// =====================================================
// Vollständig modular gehalten. Persistenz über
// giveaways.json (aktive/abgeschlossene Giveaways) und
// eine In-Memory-Map für laufende Einrichtungs-Panels
// (Drafts, gehen bei Neustart verloren solange das
// Giveaway noch nicht gestartet wurde - das ist gewollt,
// bereits GESTARTETE Giveaways überleben einen Neustart).

const GIVEAWAYS_FILE =
    path.join(__dirname, "giveaways.json");

const GIVEAWAY_MIN_DURATION_MS = 30 * 1000; // 30 Sekunden
const GIVEAWAY_MAX_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 Tage
const GIVEAWAY_MAX_SETTIMEOUT_MS = 2147483647; // Node setTimeout-Obergrenze (~24,8 Tage)

const GIVEAWAY_TIMERS = new Map(); // messageId -> Timeout
const GIVEAWAY_DRAFTS = new Map(); // panelMessageId -> Draft-Objekt

function loadGiveaways() {
    try {
        if (!fs.existsSync(GIVEAWAYS_FILE)) {
            return {};
        }

        const data = JSON.parse(
            fs.readFileSync(GIVEAWAYS_FILE, "utf8")
        );

        return data && typeof data === "object" ? data : {};
    } catch (error) {
        console.error("❌ Giveaways konnten nicht geladen werden:", error);
        return {};
    }
}

let GIVEAWAYS = loadGiveaways();

function saveGiveaways() {
    try {
        fs.writeFileSync(
            GIVEAWAYS_FILE,
            JSON.stringify(GIVEAWAYS, null, 2),
            "utf8"
        );
        return true;
    } catch (error) {
        console.error("❌ Giveaways konnten nicht gespeichert werden:", error);
        return false;
    }
}

function getGiveawayRecord(messageId) {
    return GIVEAWAYS[messageId] || null;
}

function saveGiveawayRecord(record) {
    GIVEAWAYS[record.messageId] = record;
    saveGiveaways();
    return record;
}

// -----------------------------------------------------
// DRAFT-VERWALTUNG (Einrichtungs-Panel)
// -----------------------------------------------------

function createGiveawayDraft(guildId, creatorId) {
    return {
        guildId,
        creatorId,
        prize: null,
        durationRaw: null,
        durationMs: null,
        winnerCount: 1,
        channelId: null,
        description: null,
        requirements: null,
        maxParticipants: null,
        pingRoleId: null
    };
}

function getGiveawayDraft(panelMessageId) {
    return GIVEAWAY_DRAFTS.get(panelMessageId) || null;
}

function setGiveawayDraft(panelMessageId, draft) {
    GIVEAWAY_DRAFTS.set(panelMessageId, draft);
    return draft;
}

function deleteGiveawayDraft(panelMessageId) {
    GIVEAWAY_DRAFTS.delete(panelMessageId);
}

// -----------------------------------------------------
// DAUER PARSEN / FORMATIEREN
// -----------------------------------------------------
// Unterstützt Kombinationen wie "1d", "12h", "30m", "1d12h30m"

function parseDurationToMs(input) {
    if (!input || typeof input !== "string") {
        return null;
    }

    const cleaned = input.trim().toLowerCase().replace(/\s+/g, "");
    const regex = /(\d+)(w|d|h|m|s)/g;
    const unitMs = {
        w: 7 * 24 * 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        h: 60 * 60 * 1000,
        m: 60 * 1000,
        s: 1000
    };

    let match;
    let totalMs = 0;
    let matchedAny = false;
    let consumedLength = 0;

    while ((match = regex.exec(cleaned)) !== null) {
        matchedAny = true;
        consumedLength += match[0].length;
        totalMs += parseInt(match[1], 10) * unitMs[match[2]];
    }

    // Wenn Teile der Eingabe nicht erkannt wurden (z.B. Tippfehler), ablehnen
    if (!matchedAny || consumedLength !== cleaned.length) {
        return null;
    }

    return totalMs;
}

function formatDurationMs(ms) {
    if (!ms || ms <= 0) {
        return "0s";
    }

    const units = [
        ["d", 24 * 60 * 60 * 1000],
        ["h", 60 * 60 * 1000],
        ["m", 60 * 1000],
        ["s", 1000]
    ];

    let remaining = ms;
    const parts = [];

    for (const [label, unitMs] of units) {
        const value = Math.floor(remaining / unitMs);
        if (value > 0) {
            parts.push(`${value}${label}`);
            remaining -= value * unitMs;
        }
    }

    return parts.length > 0 ? parts.join(" ") : "0s";
}

// -----------------------------------------------------
// GEPINGTE ROLLE VALIDIEREN
// -----------------------------------------------------
// Prüft, ob die Rolle auf dem Server existiert und ob der
// Bot sie erwähnen darf (entweder ist die Rolle selbst
// "mentionable" oder der Bot hat die Berechtigung
// "Mention @everyone, @here und alle Rollen").

async function validateGiveawayPingRole(guild, roleId) {
    if (!roleId) {
        return { ok: true, role: null };
    }

    let role = null;
    try {
        role = await guild.roles.fetch(roleId);
    } catch (_) {
        role = null;
    }

    if (!role) {
        return {
            ok: false,
            error: "❌ Es wurde keine Rolle mit dieser ID auf diesem Server gefunden. Bitte überprüfe die Rollen-ID."
        };
    }

    const botMember = guild.members.me;
    const canMentionEveryone =
        botMember && botMember.permissions.has(PermissionsBitField.Flags.MentionEveryone);

    if (!role.mentionable && !canMentionEveryone) {
        return {
            ok: false,
            error: `❌ Der Bot darf die Rolle ${role} nicht erwähnen. Mache die Rolle „erwähnbar" oder gib dem Bot die Berechtigung „Mention @everyone, @here und alle Rollen".`
        };
    }

    return { ok: true, role };
}

// -----------------------------------------------------
// EINRICHTUNGS-PANEL (EMBED + BUTTONS)
// -----------------------------------------------------

function createGiveawayConfigPanel(draft) {
    const canStart = Boolean(
        draft.prize && draft.durationMs && draft.channelId
    );

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🎉 Giveaway-Verwaltung")
            .setDescription(
                "Richte hier dein Giveaway ein. Sobald **🎁 Gewinn**, **⏱️ Dauer** und **📢 Kanal** " +
                "ausgefüllt sind, kannst du es über „🚀 Giveaway starten“ veröffentlichen."
            )
            .addFields(
                { name: "🎁 Gewinn", value: draft.prize || "*Nicht gesetzt*", inline: true },
                { name: "⏱️ Dauer", value: draft.durationMs ? formatDurationMs(draft.durationMs) : "*Nicht gesetzt*", inline: true },
                { name: "🏆 Gewinneranzahl", value: String(draft.winnerCount || 1), inline: true },
                { name: "📢 Kanal", value: draft.channelId ? `<#${draft.channelId}>` : "*Nicht gesetzt*", inline: true },
                { name: "👥 Max. Teilnehmer", value: draft.maxParticipants ? String(draft.maxParticipants) : "Unbegrenzt", inline: true },
                { name: "🔔 Gepingte Rolle", value: draft.pingRoleId ? `<@&${draft.pingRoleId}>` : "*Keine*", inline: true },
                { name: "\u200b", value: "\u200b", inline: true },
                { name: "📝 Beschreibung", value: draft.description || "*Keine*", inline: false },
                { name: "📋 Voraussetzungen", value: draft.requirements || "*Keine*", inline: false }
            )
            .setFooter({ text: "Vexo RP System ✧ Giveaway-System" });

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId("giveaway_edit_prize").setLabel("Gewinn").setEmoji("🎁").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("giveaway_edit_duration").setLabel("Dauer").setEmoji("⏱️").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("giveaway_edit_winners").setLabel("Gewinneranzahl").setEmoji("🏆").setStyle(ButtonStyle.Primary)
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId("giveaway_edit_description").setLabel("Beschreibung").setEmoji("📝").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("giveaway_edit_requirements").setLabel("Voraussetzungen").setEmoji("📋").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("giveaway_edit_maxparticipants").setLabel("Max. Teilnehmer").setEmoji("👥").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("giveaway_edit_pingrole").setLabel("Gepingte Rolle").setEmoji("🔔").setStyle(ButtonStyle.Secondary)
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId("giveaway_channel_open").setLabel("Kanal auswählen").setEmoji("📢").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("giveaway_start").setLabel("Giveaway starten").setEmoji("🚀").setStyle(ButtonStyle.Success).setDisabled(!canStart),
                new ButtonBuilder().setCustomId("giveaway_cancel").setLabel("Abbrechen").setEmoji("❌").setStyle(ButtonStyle.Danger)
            );

    return { embeds: [embed], components: [row1, row2, row3] };
}

// -----------------------------------------------------
// KANALAUSWAHL-PANEL (immer live vom Server geladen)
// -----------------------------------------------------

async function createGiveawayChannelSelectPanel(guild, page = 0) {
    let channels = [];

    try {
        // Kanäle immer frisch über die API laden (kein Cache/keine festen IDs),
        // damit neu erstellte Kanäle sofort und gelöschte Kanäle nie erscheinen.
        const fetchedChannels = await guild.channels.fetch();
        channels = Array.from(fetchedChannels.values())
            .filter(channel =>
                channel &&
                channel.id &&
                channel.name &&
                (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
            )
            .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0));
    } catch (error) {
        console.error("❌ Fehler beim Laden der Kanäle für das Giveaway-Panel:", error);
        channels = [];
    }

    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(channels.length / pageSize));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = safePage * pageSize;
    const pageChannels = channels.slice(start, start + pageSize);

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("📢 Giveaway-Kanal auswählen")
            .setDescription(
                channels.length === 0
                    ? "❌ Es wurden keine Textkanäle auf diesem Server gefunden."
                    : `Wähle den Kanal aus, in dem das Giveaway veröffentlicht werden soll.\n\n**Seite ${safePage + 1}/${totalPages}**`
            )
            .setFooter({ text: "Vexo RP System ✧ Giveaway-System" });

    const components = [];

    if (pageChannels.length > 0) {
        const selectRow =
            new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("giveaway_channel_select")
                        .setPlaceholder("Kanal auswählen...")
                        .addOptions(
                            pageChannels.map(channel =>
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(channel.name)
                                    .setDescription(channel.parent ? channel.parent.name : "Keine Kategorie")
                                    .setValue(channel.id)
                            )
                        )
                );
        components.push(selectRow);
    }

    const navRow =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_channel_prev_${safePage}`)
                    .setLabel("◀ Zurück")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage === 0),
                new ButtonBuilder()
                    .setCustomId(`giveaway_channel_next_${safePage}`)
                    .setLabel("Weiter ▶")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId("giveaway_channel_back")
                    .setLabel("↩ Zurück zum Panel")
                    .setStyle(ButtonStyle.Primary)
            );
    components.push(navRow);

    return { embeds: [embed], components };
}

// -----------------------------------------------------
// MODALS FÜR TEXT-EINGABEN
// -----------------------------------------------------

function createGiveawayModal(field, draft) {
    const configs = {
        prize: {
            customId: "giveaway_modal_prize",
            title: "🎁 Gewinn festlegen",
            label: "Was wird verlost?",
            style: TextInputStyle.Short,
            placeholder: "z.B. Discord Nitro, 50€ Gutschein...",
            maxLength: 200,
            required: true,
            value: draft.prize
        },
        duration: {
            customId: "giveaway_modal_duration",
            title: "⏱️ Dauer festlegen",
            label: "Dauer (z.B. 1d, 12h, 30m, 1d12h)",
            style: TextInputStyle.Short,
            placeholder: "1d / 12h / 30m / 1d12h",
            maxLength: 50,
            required: true,
            value: draft.durationRaw
        },
        winners: {
            customId: "giveaway_modal_winners",
            title: "🏆 Anzahl der Gewinner",
            label: "Wie viele Gewinner soll es geben?",
            style: TextInputStyle.Short,
            placeholder: "z.B. 1",
            maxLength: 5,
            required: true,
            value: draft.winnerCount ? String(draft.winnerCount) : "1"
        },
        description: {
            customId: "giveaway_modal_description",
            title: "📝 Beschreibung",
            label: "Beschreibung (optional)",
            style: TextInputStyle.Paragraph,
            placeholder: "Zusätzliche Informationen zum Giveaway...",
            maxLength: 1000,
            required: false,
            value: draft.description
        },
        requirements: {
            customId: "giveaway_modal_requirements",
            title: "📋 Voraussetzungen",
            label: "Voraussetzungen (optional)",
            style: TextInputStyle.Paragraph,
            placeholder: "z.B. Rolle @Mitglied, Server-Boost...",
            maxLength: 1000,
            required: false,
            value: draft.requirements
        },
        maxparticipants: {
            customId: "giveaway_modal_maxparticipants",
            title: "👥 Maximale Teilnehmerzahl",
            label: "Max. Teilnehmer (leer = unbegrenzt)",
            style: TextInputStyle.Short,
            placeholder: "z.B. 100",
            maxLength: 10,
            required: false,
            value: draft.maxParticipants ? String(draft.maxParticipants) : ""
        },
        pingrole: {
            customId: "giveaway_modal_pingrole",
            title: "🔔 Gepingte Rolle",
            label: "Rollen-ID (leer = kein Ping)",
            style: TextInputStyle.Short,
            placeholder: "z.B. 123456789012345678",
            maxLength: 30,
            required: false,
            value: draft.pingRoleId ? String(draft.pingRoleId) : ""
        }
    };

    const config = configs[field];

    const modal =
        new ModalBuilder()
            .setCustomId(config.customId)
            .setTitle(config.title);

    const input =
        new TextInputBuilder()
            .setCustomId("value")
            .setLabel(config.label)
            .setStyle(config.style)
            .setPlaceholder(config.placeholder)
            .setMaxLength(config.maxLength)
            .setRequired(config.required);

    if (config.value) {
        input.setValue(String(config.value));
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return modal;
}

// -----------------------------------------------------
// ÖFFENTLICHE GIVEAWAY-NACHRICHT
// -----------------------------------------------------

function buildGiveawayJoinRow(messageId, participantCount = 0, maxParticipants = null, disabled = false) {
    const label =
        maxParticipants
            ? `Teilnehmen (${participantCount}/${maxParticipants})`
            : `Teilnehmen (${participantCount})`;

    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_join_${messageId}`)
                .setLabel(disabled ? "Giveaway beendet" : label)
                .setEmoji("🎉")
                .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
                .setDisabled(disabled)
        );
}

function buildGiveawayEmbed(record) {
    const endTimestamp = Math.floor(record.endsAt / 1000);

    const descriptionParts = [
        `🎁 **Gewinn:** ${record.prize}`
    ];

    if (record.description) {
        descriptionParts.push(`\n${record.description}`);
    }

    descriptionParts.push(
        `\n⏱️ **Endet:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)`,
        `🏆 **Gewinneranzahl:** ${record.winnerCount}`
    );

    if (record.requirements) {
        descriptionParts.push(`📋 **Voraussetzungen:** ${record.requirements}`);
    }

    descriptionParts.push(
        `👥 **Teilnehmer:** ${record.participants.length}${record.maxParticipants ? ` / ${record.maxParticipants}` : ""}`
    );

    const embed =
        new EmbedBuilder()
            .setColor(record.ended ? 0x2F3136 : 0x57F287)
            .setTitle(record.ended ? "🎉 Giveaway beendet" : "🎉 Giveaway")
            .setDescription(descriptionParts.join("\n"))
            .setFooter({ text: `Gehostet von ${record.hostTag || "Team"}` })
            .setTimestamp(record.endsAt);

    if (record.ended) {
        embed.addFields({
            name: "🏆 Gewinner",
            value:
                record.winners && record.winners.length > 0
                    ? record.winners.map(id => `<@${id}>`).join(", ")
                    : "Niemand hat teilgenommen."
        });
    }

    return embed;
}

// -----------------------------------------------------
// GIVEAWAY BEENDEN / AUSLOSEN
// -----------------------------------------------------

function clearGiveawayTimer(messageId) {
    const existing = GIVEAWAY_TIMERS.get(messageId);
    if (existing) {
        clearTimeout(existing);
        GIVEAWAY_TIMERS.delete(messageId);
    }
}

function scheduleGiveawayEnd(clientRef, messageId, delayMs) {
    clearGiveawayTimer(messageId);

    if (delayMs <= 0) {
        setImmediate(() => {
            endGiveaway(clientRef, messageId).catch(error =>
                console.error("❌ Fehler beim Beenden des Giveaways:", error)
            );
        });
        return;
    }

    // Node erlaubt maximal ~24,8 Tage pro setTimeout - bei längeren
    // Giveaways wird der Timer entsprechend mehrfach neu gesetzt.
    const nextDelay = Math.min(delayMs, GIVEAWAY_MAX_SETTIMEOUT_MS);

    const timer = setTimeout(() => {
        const record = getGiveawayRecord(messageId);

        if (!record || record.ended) {
            return;
        }

        const remaining = record.endsAt - Date.now();

        if (remaining <= 0) {
            endGiveaway(clientRef, messageId).catch(error =>
                console.error("❌ Fehler beim Beenden des Giveaways:", error)
            );
        } else {
            scheduleGiveawayEnd(clientRef, messageId, remaining);
        }
    }, nextDelay);

    GIVEAWAY_TIMERS.set(messageId, timer);
}

async function endGiveaway(clientRef, messageId) {
    const record = getGiveawayRecord(messageId);

    if (!record || record.ended) {
        return;
    }

    // Sofort als beendet markieren und speichern, damit das Giveaway
    // bei parallelen Aufrufen (z.B. nach Neustart) nicht doppelt ausgelost wird.
    record.ended = true;
    record.endedAt = Date.now();

    const pool = [...new Set(record.participants)];
    let winners = [];

    if (pool.length > 0) {
        const shuffled = pool
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);

        winners = shuffled.slice(0, Math.min(record.winnerCount, pool.length));
    }

    record.winners = winners;
    saveGiveawayRecord(record);
    clearGiveawayTimer(messageId);

    try {
        const guild = await clientRef.guilds.fetch(record.guildId).catch(() => null);
        if (!guild) {
            return;
        }

        const channel = await guild.channels.fetch(record.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return;
        }

        const message = await channel.messages.fetch(record.messageId).catch(() => null);

        if (message) {
            await message.edit({
                embeds: [buildGiveawayEmbed(record)],
                components: [buildGiveawayJoinRow(record.messageId, record.participants.length, record.maxParticipants, true)]
            }).catch(() => {});
        }

        if (winners.length > 0) {
            await channel.send({
                content: `🎉 Herzlichen Glückwunsch ${winners.map(id => `<@${id}>`).join(", ")}! Ihr habt **${record.prize}** gewonnen! 🎁`,
                allowedMentions: { users: winners }
            }).catch(() => {});
        } else {
            await channel.send({
                content: `😢 Niemand hat am Giveaway für **${record.prize}** teilgenommen. Es gibt keinen Gewinner.`
            }).catch(() => {});
        }
    } catch (error) {
        console.error("❌ Fehler beim Abschließen des Giveaways:", error);
    }
}

function initializeGiveawaySchedules(clientRef) {
    const all = loadGiveaways();

    for (const messageId of Object.keys(all)) {
        const record = all[messageId];

        if (!record || record.ended) {
            continue;
        }

        const remaining = record.endsAt - Date.now();
        scheduleGiveawayEnd(clientRef, messageId, remaining);
    }
}

// =====================================================
// 🗂️ BEFEHLS-REGISTRY (für automatische !befehle-Übersicht)
// =====================================================
// Diese Registry ist die EINZIGE Stelle, aus der `!befehle` seine
// Übersicht erzeugt. Es gibt bewusst keine zweite, separat gepflegte
// Textliste mehr – die alte, fest eingetippte Übersicht wurde entfernt.
//
// Jeder tatsächlich vorhandene Befehl wird hier über registerCommand()
// mit Name/Kategorie/Beschreibung eingetragen. `!befehle` liest diese
// Registry bei JEDEM Aufruf frisch aus und baut die Nachricht live
// zusammen – es wird also nie eine veraltete, hart codierte Nachricht
// angezeigt.
//
// WICHTIG FÜR KÜNFTIGE BEFEHLE:
// - Neuer Befehl hinzugefügt (neuer if-Block im Dispatcher unten)
//   -> hier eine Zeile registerCommand(...) ergänzen, dann erscheint
//      er automatisch in !befehle.
// - Befehl entfernt -> die zugehörige registerCommand(...)-Zeile
//   ebenfalls entfernen, dann verschwindet er automatisch aus !befehle.
// - Ohne Beschreibung/Kategorie wird automatisch ein sinnvoller
//   Standardwert verwendet bzw. eine neue Kategorie angelegt.
//
// (Hinweis: Eine wirklich blinde Text-Analyse des kompletten Quellcodes
// zur Laufzeit ist in reinem JavaScript nicht zuverlässig möglich, ohne
// einen vollwertigen Code-Parser einzubinden und Beschreibungen zu
// erraten. Diese Registry erreicht das gewünschte Ergebnis – eine
// garantiert aktuelle, nie doppelte, nie manuell nachzupflegende
// Übersicht – auf robustem Weg, ohne bestehende Befehle zu verändern.)

const COMMAND_REGISTRY = new Map();

// Bevorzugte Reihenfolge bekannter Kategorien. Kategorien, die hier
// nicht auftauchen (weil ein neuer Befehl eine neue Kategorie nutzt),
// werden automatisch angelegt und alphabetisch dahinter einsortiert.
const COMMAND_CATEGORY_ORDER = [
    "RP-System",
    "Team-System",
    "Haus-System",
    "Text-System",
    "Giveaway-System",
    "KI-Chat-System",
    "Nickname-System",
    "Verifizierung",
    "Bot-Verwaltung",
    "Übersicht"
];

const COMMAND_CATEGORY_EMOJIS = {
    "RP-System": "🎭",
    "Team-System": "👥",
    "Haus-System": "🏠",
    "Text-System": "📨",
    "Giveaway-System": "🎉",
    "KI-Chat-System": "🤖",
    "Nickname-System": "🏷️",
    "Verifizierung": "🔐",
    "Bot-Verwaltung": "⚙️",
    "Übersicht": "📋"
};

function registerCommand(name, category, description) {
    if (!name || typeof name !== "string") {
        return;
    }

    const key = name.trim().toLowerCase();

    if (!key || COMMAND_REGISTRY.has(key)) {
        // Bereits registriert -> keine doppelten Einträge in !befehle.
        return;
    }

    COMMAND_REGISTRY.set(key, {
        name: key,
        category:
            category && String(category).trim()
                ? String(category).trim()
                : "Sonstige Befehle",
        description:
            description && String(description).trim()
                ? String(description).trim()
                : "Keine Beschreibung hinterlegt."
    });
}

// -----------------------------------------------------
// TATSÄCHLICH VORHANDENE BEFEHLE REGISTRIEREN
// -----------------------------------------------------
// Ein Eintrag pro Befehl, der weiter unten im Dispatcher auch wirklich
// per `command === "..."` behandelt wird.

registerCommand("rp-panel", "RP-System", "RP-Verwaltungspanel zum Starten und Beenden des RP");
registerCommand("rp-nachricht", "RP-System", "RP-Kanal konfigurieren");

registerCommand("/teambewerbung", "Team-System", "Bewerbungspanel erstellen; eingereichte Bewerbungen gehen in den konfigurierten Bewerbungskanal");
registerCommand("/teambewerbungtext", "Team-System", "Bewerbungspanel und Zielkanal für neue Bewerbungen festlegen");
registerCommand("/team-bewerbungen", "Team-System", "Gespeicherte Teambewerbungen anzeigen");
registerCommand("/teampanel", "Team-System", "Teamverwaltungspanel öffnen");
registerCommand("/teamliste", "Team-System", "Teammitglieder anzeigen");
registerCommand("/teamliste-update-start", "Team-System", "Automatische Teamlisten-Updates starten");
registerCommand("/teamliste-update-stop", "Team-System", "Automatische Teamlisten-Updates stoppen");
registerCommand("/teamstatistik", "Team-System", "Team-Statistik und Mitgliedsdetails anzeigen");

registerCommand("häuser-panel", "Haus-System", "Hausverwaltungspanel öffnen");
registerCommand("häuserliste", "Haus-System", "Häuser anzeigen");

registerCommand("gang-panel", "Gang-System", "Gangverwaltungspanel öffnen (eintragen/ändern/löschen)");
registerCommand("gang-liste", "Gang-System", "Automatisch aktualisierende Gang-Liste anzeigen");

registerCommand("text-sende", "Text-System", "Ausführliche Nachricht senden");

registerCommand("giveaway", "Giveaway-System", "Giveaway-Einrichtungspanel öffnen");

registerCommand("ki-chat", "KI-Chat-System", "Aktuellen Kanal als KI-Chat-Kanal festlegen");

registerCommand("name-tag-set", "Nickname-System", "Nicknames für passende Mitglieder aktualisieren (Legacy-Alias von !nickname-aktualisieren)");
registerCommand("nickname-aktualisieren", "Nickname-System", "Alle Mitglieder-Nicknames anhand ihrer aktuell vorhandenen Rollen (Team, Ultra VIP, VIP, Partner, Bürger) aktualisieren");

registerCommand("selbstzerstörung", "Spaß-System", "Entfernt alle eigenen Rollen nacheinander im Countdown, stellt sie nach 1 Minute automatisch wieder her");

registerCommand("verify", "Verifizierung", "Verifizierungs-Panel erstellen");

registerCommand("vorschläge", "Bürger-Vorschlag-System", "Bürger-Vorschlags-Panel im aktuellen Kanal erstellen (mit Argument: bürger)");
registerCommand("bürgertext", "Bürger-Vorschlag-System", "Aktuellen Kanal als Bürger-Vorschlags-Kanal festlegen");

registerCommand("profilbild-bot", "Bot-Verwaltung", "Panel zum Ändern des Bot-Profilbilds öffnen");
registerCommand("neustart", "Bot-Verwaltung", "Bot neu starten");
registerCommand("herunterfahren", "Bot-Verwaltung", "Bot herunterfahren");
registerCommand("statistik", "Bot-Verwaltung", "Aktuellen Kanal als Statistik-/Log-Kanal speichern");

registerCommand("befehle", "Übersicht", "Alle verfügbaren Befehle anzeigen");

// Befehle, die zu einem komplett separaten Bot-Prozess gehören (nicht
// Teil dieser index.js) und daher hier nicht automatisch im Code
// gefunden werden können. Bewusst als einzige Ausnahme klar markiert.
const EXTERNAL_COMMAND_REGISTRY = [
    {
        name: "bot-panel",
        category: "Bot-Verwaltung",
        description: "Bot-Control-Panel zum Starten und Stoppen des Hauptbots (separater Control-Bot, nicht Teil dieses Codes)"
    }
];

// -----------------------------------------------------
// !BEFEHLE-NACHRICHT AUS DER REGISTRY ERZEUGEN
// -----------------------------------------------------

function buildCommandOverviewMessage() {
    const lines = ["# 📋 Verfügbare Slash-Befehle"];
    const commands = slashCommands
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "de"));

    for (const command of commands) {
        lines.push(`\`/${command.name}\` – ${command.description}`);
    }

    lines.push("---");
    lines.push("Befehle mit zusätzlichen Optionen zeigen diese direkt in Discord an.");
    return lines.join("\n");
}

// -----------------------------------------------------
// LANGE NACHRICHTEN AUFTEILEN (DISCORD-LIMIT: 2000 ZEICHEN)
// -----------------------------------------------------
// Teilt Text zeilenweise in mehrere Nachrichten auf, falls er das
// Discord-Zeichenlimit überschreitet (z. B. wenn durch neue Befehle
// die Befehlsübersicht zu lang wird). Bricht dabei nie mitten in
// einer Zeile/einem Befehl ab, außer eine einzelne Zeile ist selbst
// länger als das Limit.

async function sendLongTextInChunks(
    channel,
    text,
    maxLength = 2000
) {
    if (text.length <= maxLength) {
        await channel.send(text);
        return;
    }

    const lines = text.split("\n");
    let chunk = "";

    for (const line of lines) {

        if (line.length > maxLength) {
            if (chunk.length > 0) {
                await channel.send(chunk);
                chunk = "";
            }

            for (
                let i = 0;
                i < line.length;
                i += maxLength
            ) {
                await channel.send(
                    line.slice(i, i + maxLength)
                );
            }

            continue;
        }

        const candidate =
            chunk.length === 0
                ? line
                : `${chunk}\n${line}`;

        if (candidate.length > maxLength) {
            await channel.send(chunk);
            chunk = line;
        } else {
            chunk = candidate;
        }
    }

    if (chunk.length > 0) {
        await channel.send(chunk);
    }
}

// =====================================================
// OWNER-DM-SYSTEM
// =====================================================

async function handleOwnerDMCommand(message, client) {
    try {
        const args = message.content
            .slice(PREFIX.length)
            .trim()
            .split(/\s+/);

        const command = args.shift()?.toLowerCase();

        console.log(`📩 Owner-DM-Command: !${command}`);

        // Commands, die DM-kompatibel sind
        const dmCompatibleCommands = [
            "bot-status",
            "befehle",
            "statistik",
            "teamliste",
            "teamstatistik",
            "häuserliste",
            "gang-liste"
        ];

        // !rollen - Alle Rollen eines Servers auflisten
        if (command === "rollen" || command === "listroles") {
            try {
                const guildId = args[0] || DEFAULT_GUILD_ID;

                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) {
                    await message.reply(`❌ Server mit ID ${guildId} nicht gefunden.`);
                    return;
                }

                const roles = await guild.roles.fetch();
                const roleList = roles
                    .filter(role => role.name !== "@everyone")
                    .sort((a, b) => b.position - a.position)
                    .map(role => `\`${role.id}\` - ${role.name}`)
                    .join("\n");

                // Aufteilen in mehrere Nachrichten, falls zu lang
                const maxLength = 1900;
                if (roleList.length <= maxLength) {
                    await message.reply(
                        `📋 **Alle Rollen auf ${guild.name}**\n\n${roleList}`
                    );
                } else {
                    const chunks = [];
                    let currentChunk = "📋 **Alle Rollen auf " + guild.name + "**\n\n";
                    const lines = roleList.split("\n");

                    for (const line of lines) {
                        if (currentChunk.length + line.length > maxLength) {
                            chunks.push(currentChunk);
                            currentChunk = line;
                        } else {
                            currentChunk += "\n" + line;
                        }
                    }
                    chunks.push(currentChunk);

                    for (const chunk of chunks) {
                        await message.reply(chunk);
                    }
                }

                console.log(`✅ Owner-DM-Command !rollen für Server ${guildId} ausgeführt.`);
            } catch (error) {
                console.error("❌ Fehler bei !rollen in DM:", error);
                await message.reply("❌ Ein Fehler ist aufgetreten.");
            }
            return;
        }

        // Bot-Status-Command (spezielle Behandlung)
        if (command === "bot-status") {
            try {
                const fs = require("fs");
                const path = require("path");
                const BOT_STATUS_FILE = path.join(__dirname, "Bot-Status-System", "bot-status.json");
                
                let statusInfo = "Keine Status-Informationen verfügbar.";
                let statusEmoji = "🟢";
                
                try {
                    if (fs.existsSync(BOT_STATUS_FILE)) {
                        const statusData = JSON.parse(fs.readFileSync(BOT_STATUS_FILE, "utf8"));
                        const guildCount = Object.keys(statusData.statusByGuild || {}).length;
                        if (guildCount > 0) {
                            statusInfo = `${guildCount} Server(s) mit Status-Panel`;
                        }
                    }
                } catch (error) {
                    console.log("ℹ️ Konnte Status-Datei nicht lesen:", error.message);
                }

                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle("🤖 BOT STATUS")
                    .setDescription("Der Bot ist aktuell online und läuft normal.")
                    .addFields(
                        {
                            name: "🟢 Status",
                            value: "Online",
                            inline: true
                        },
                        {
                            name: "⏱️ Uptime",
                            value: client.readyAt ? `${Math.floor((Date.now() - client.readyAt) / 1000)}s` : "Unbekannt",
                            inline: true
                        },
                        {
                            name: "📡 Verbindung",
                            value: "Aktiv",
                            inline: true
                        },
                        {
                            name: "📊 Status-Panels",
                            value: statusInfo,
                            inline: false
                        }
                    )
                    .setFooter({ text: "Vexo RP Bot Status ✧ Owner-DM" })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });
                console.log(`✅ Owner-DM-Command !bot-status ausgeführt.`);
            } catch (error) {
                console.error("❌ Fehler bei !bot-status in DM:", error);
                await message.reply("❌ Ein Fehler ist aufgetreten.");
            }
            return;
        }

        // Befehle-Command
        if (command === "befehle") {
            try {
                const commandOverview = buildCommandOverviewMessage();
                await message.reply(commandOverview);
                console.log(`✅ Owner-DM-Command !befehle ausgeführt.`);
            } catch (error) {
                console.error("❌ Fehler bei !befehle in DM:", error);
                await message.reply("❌ Ein Fehler ist aufgetreten.");
            }
            return;
        }

        // DM-kompatible Commands
        if (dmCompatibleCommands.includes(command)) {
            await message.reply(
                "⚠️ Dieser Befehl kann nicht per DM ausgeführt werden.\n\n" +
                "Grund: Dieser Befehl benötigt einen Discord-Server-Kontext."
            );
            console.log(`⚠️ Owner-DM-Command !${command} abgelehnt (benötigt Server-Kontext).`);
            return;
        }

        // Alle anderen Commands
        await message.reply(
            "⚠️ Dieser Befehl kann nicht per DM ausgeführt werden.\n\n" +
            "Grund: Dieser Befehl benötigt einen Discord-Server-Kontext."
        );
        console.log(`⚠️ Owner-DM-Command !${command} abgelehnt (benötigt Server-Kontext).`);

    } catch (error) {
        console.error("❌ Fehler bei Owner-DM-Command:", error);
        await message.reply("❌ Ein Fehler ist aufgetreten.");
    }
}

// =====================================================
// PREFIX BEFEHLE
// =====================================================

client.on(
    "messageCreate",
    async message => {

        try {

            if (
                message.author.bot
            ) {
                return;
            }

            if (
                await handleTeamApplicationDM(message)
            ) {
                return;
            }

            // =========================================
            // OWNER-DM-SYSTEM
            // =========================================
            // Erlaubt dem Bot-Owner, Commands per DM auszuführen
            if (!message.guild) {
                console.log(`📩 DM-Nachricht von ${message.author.id} (${message.author.tag}): ${message.content}`);
                
                // Prüfe, ob es sich um den Bot-Owner handelt
                if (message.author.id === BOT_OWNER_ID) {
                    console.log(`✅ DM von Bot-Owner erkannt`);
                    
                    if (message.content.startsWith(PREFIX)) {
                        console.log(`✅ Prefix-Command in DM erkannt`);
                        // Owner-DM-Command verarbeiten
                        await handleOwnerDMCommand(message, client);
                    } else {
                        console.log(`ℹ️ Kein Prefix-Command in DM`);
                    }
                } else {
                    console.log(`⚠️ DM nicht von Bot-Owner (ID: ${message.author.id}, Expected: ${BOT_OWNER_ID})`);
                }
                return;
            }

            if (
                !message.content.startsWith(
                    PREFIX
                )
            ) {
                return;
            }

            const args =
                message.content
                    .slice(
                        PREFIX.length
                    )
                    .trim()
                    .split(
                        /\s+/
                    );

            const command =
                args.shift()
                    ?.toLowerCase();

            // =========================================
            // LOG-SYSTEM: COMMAND LOGGING
            // =========================================
            try {
                await logCommand(message, `!${command}`);
            } catch (error) {
                console.error("❌ Fehler beim Loggen von Command:", error);
            }

            // =================================================
            // !ROLLEN - Alle Rollen eines Servers auflisten (nur Bot-Owner)
            // =================================================
            if (command === "rollen" || command === "listroles") {
                if (!isBotOwner(message.member)) {
                    return message.reply("❌ Dieser Befehl kann nur vom Bot-Owner verwendet werden.");
                }

                try {
                    const guildId = args[0] || message.guild.id;

                    const guild = await client.guilds.fetch(guildId).catch(() => null);
                    if (!guild) {
                        return message.reply(`❌ Server mit ID ${guildId} nicht gefunden.`);
                    }

                    const roles = await guild.roles.fetch();
                    const roleList = roles
                        .filter(role => role.name !== "@everyone")
                        .sort((a, b) => b.position - a.position)
                        .map(role => `\`${role.id}\` - ${role.name}`)
                        .join("\n");

                    // Aufteilen in mehrere Nachrichten, falls zu lang
                    const maxLength = 1900;
                    if (roleList.length <= maxLength) {
                        await message.reply(
                            `📋 **Alle Rollen auf ${guild.name}**\n\n${roleList}`
                        );
                    } else {
                        const chunks = [];
                        let currentChunk = "📋 **Alle Rollen auf " + guild.name + "**\n\n";
                        const lines = roleList.split("\n");

                        for (const line of lines) {
                            if (currentChunk.length + line.length > maxLength) {
                                chunks.push(currentChunk);
                                currentChunk = line;
                            } else {
                                currentChunk += "\n" + line;
                            }
                        }
                        chunks.push(currentChunk);

                        for (const chunk of chunks) {
                            await message.reply(chunk);
                        }
                    }

                    console.log(`✅ !rollen Befehl für Server ${guildId} ausgeführt.`);
                } catch (error) {
                    console.error("❌ Fehler bei !rollen:", error);
                    await message.reply("❌ Ein Fehler ist aufgetreten.");
                }
                return;
            }

            // =================================================
            // !SELBSTZERSTÖRUNG
            // =================================================
            // Entfernt alle Rollen des ausführenden Mitglieds (außer
            // @everyone) nach einem Countdown, der bei der Anzahl der
            // Rollen startet, und stellt sie automatisch nach 2
            // Minuten wieder her.

            if (command === "selbstzerstörung") {

                const selfDestructMember =
                    message.member;

                if (!selfDestructMember) {
                    return;
                }

                const result =
                    await executeSelfDestruction(
                        selfDestructMember,
                        message.channel
                    );

                if (!result.ok) {
                    if (result.reason === "in_progress") {
                        return message.reply(
                            errorMessage(
                                "Deine Selbstzerstörung läuft bereits oder deine Rollen werden gerade noch wiederhergestellt."
                            )
                        );
                    }

                    if (result.reason === "no_roles") {
                        return message.reply(
                            errorMessage(
                                "Du hast keine Rollen, die entfernt werden könnten."
                            )
                        );
                    }
                }

                return;
            }

            // =================================================
            // !SELBSTZERSTÖRUNG-PANEL
            // =================================================
            // Bietet dem Bot-Owner eine alternative Möglichkeit, die
            // exakt gleiche Selbstzerstörung wie oben gezielt für
            // einen ausgewählten Benutzer zu starten. Es wird dabei
            // ausschließlich executeSelfDestruction() verwendet, es
            // gibt keine zweite/eigene Selbstzerstörungs-Logik.

            if (command === "selbstzerstörung-panel") {

                if (!isBotOwner(message.member)) {
                    return message.reply(
                        errorMessage(
                            "Nur der Bot-Owner darf das Selbstzerstörung-Panel verwenden."
                        )
                    );
                }

                const panelMessage =
                    await message.channel.send(
                        buildSelfDestructStartPanel()
                    );

                setSelfDestructPanelState(
                    panelMessage.id,
                    {
                        mode: null,
                        query: null,
                        page: 0,
                        selectedUserId: null
                    }
                );

                return;
            }

            // =================================================
            // !BOT-STATUS
            // =================================================
            // Erstellt oder aktualisiert ein Bot-Status-Panel im aktuellen Kanal.
            // Nur der Bot-Owner darf diesen Command verwenden.

            if (command === "bot-status") {
                if (!isBotOwner(message.member)) {
                    return message.reply(
                        errorMessage(
                            "Nur der Bot-Owner darf den bot-status Command verwenden."
                        )
                    );
                }

                try {
                    await handleBotStatusCommand(message, client);
                } catch (error) {
                    console.error("❌ Fehler beim Ausführen des bot-status Commands:", error);
                    await message.reply(
                        errorMessage(
                            "Ein Fehler ist aufgetreten beim Ausführen des Commands."
                        )
                    );
                }

                return;
            }

            // =================================================
            // !ENTFERNE-VERIFIZIERE
            // =================================================
            // Entfernt die Verifizierungsrolle (1539991296297533510)
            // serverweit bei allen Mitgliedern, die sie besitzen.

            if (command === "entferne-verifiziere") {
                if (!hasProtectedCommandPermission(message.member)) {
                    return message.reply(errorMessage("Du hast keine Berechtigung, diesen Befehl zu verwenden."));
                }

                const REMOVE_VERIFY_ROLE_ID = "1539991296297533510";

                const guild = message.guild;
                const role = await guild.roles.fetch(REMOVE_VERIFY_ROLE_ID).catch(() => null);

                if (!role) {
                    return message.reply(
                        errorMessage(`Die Verifizierungsrolle mit der ID ${REMOVE_VERIFY_ROLE_ID} wurde nicht gefunden.`)
                    );
                }

                const statusMessage = await message.channel.send("⏳ Lade alle Mitglieder und entferne die Verifizierungsrolle...");

                let members;
                try {
                    members = await guild.members.fetch();
                } catch (error) {
                    console.error("❌ Fehler beim Laden aller Mitglieder (!entferne-verifiziere):", error);
                    return statusMessage.edit(
                        errorMessage("Die Mitglieder des Servers konnten nicht vollständig geladen werden. Bitte versuche es erneut.")
                    );
                }

                let removedCount = 0;
                let skippedCount = 0;
                let errorCount = 0;

                for (const [, member] of members) {
                    try {
                        if (!member.roles.cache.has(REMOVE_VERIFY_ROLE_ID)) {
                            skippedCount++;
                            continue;
                        }

                        await member.roles.remove(REMOVE_VERIFY_ROLE_ID, "Verifizierungsrolle serverweit entfernt (!entferne-verifiziere)");
                        removedCount++;
                    } catch (error) {
                        console.error(`❌ Rolle konnte bei ${member.id} nicht entfernt werden:`, error?.message || error);
                        errorCount++;
                    }
                }

                const processedCount = removedCount + skippedCount + errorCount;

                const resultEmbed = new EmbedBuilder()
                    .setTitle("✅ Verifizierungsrolle entfernt")
                    .setDescription(`Die Rolle <@&${REMOVE_VERIFY_ROLE_ID}> wurde bei allen möglichen Mitgliedern entfernt.`)
                    .addFields(
                        { name: "👥 Bearbeitet", value: `${processedCount}`, inline: true },
                        { name: "🗑️ Rolle entfernt", value: `${removedCount}`, inline: true },
                        { name: "⏭️ Übersprungen", value: `${skippedCount}`, inline: true },
                        { name: "❌ Fehler", value: `${errorCount}`, inline: true }
                    )
                    .setColor(0x57F287)
                    .setFooter({ text: "Vexo RP • Verifizierungssystem" })
                    .setTimestamp();

                return statusMessage.edit({ content: null, embeds: [resultEmbed] });
            }

            // =================================================
            // !TEAMBEWERBUNG TEXT
            // =================================================
            // Erstellt AUSSCHLIESSLICH das Bewerbungs-Panel.
            // Setzt KEINEN Ziel-Kanal und sendet keine alten Inhalte.

            if (
                command === "teambewerbung" &&
                args[0]?.toLowerCase() === "text"
            ) {
                if (!hasProtectedCommandPermission(message.member)) {
                    return message.reply("❌ Du hast dafür keine Berechtigung.");
                }

                const panelMessage = await message.channel.send(createTeamApplicationPanel());
                const guildPanels = TEAM_APPLICATIONS.panels[message.guild.id] || [];
                guildPanels.push({
                    channelId: panelMessage.channel.id,
                    messageId: panelMessage.id
                });
                TEAM_APPLICATIONS.panels[message.guild.id] = guildPanels;
                saveTeamApplications();
                return message.reply("✅ Das Bewerbungspanel wurde erstellt.");
            }

            // =================================================
            // !TEAMBEWERBUNG
            // =================================================
            // Zeigt den festgelegten Ziel-Kanal für eingehende
            // Bewerbungen an; das Panel wird separat erstellt.

            if (
                command === "teambewerbung"
            ) {
                if (!hasProtectedCommandPermission(message.member)) {
                    return message.reply("❌ Du hast dafür keine Berechtigung.");
                }

                return message.reply(
                    `📋 Neue Teambewerbungen werden an <#${APPLICATION_REVIEW_CHANNEL_ID}> gesendet.`
                );
            }

            // =================================================
            // !TEAM BEWERBUNG / !TEAMBEWERBUNG (ALTE SCHREIBWEISE)
            // =================================================
            // Bleibt als bestehende, bereits eingespielte Schreibweise
            // erhalten (mit Leerzeichen: "!team bewerbung text").
            // Unverändert zur alten Funktionsweise.

            if (
                command === "team" &&
                args[0]?.toLowerCase() === "bewerbung" &&
                args[1]?.toLowerCase() === "text"
            ) {
                if (!hasProtectedCommandPermission(message.member)) {
                    return message.reply("❌ Du hast dafür keine Berechtigung.");
                }

                const panelMessage = await message.channel.send(createTeamApplicationPanel());
                const guildPanels = TEAM_APPLICATIONS.panels[message.guild.id] || [];
                guildPanels.push({
                    channelId: panelMessage.channel.id,
                    messageId: panelMessage.id
                });
                TEAM_APPLICATIONS.panels[message.guild.id] = guildPanels;
                saveTeamApplications();
                return message.reply("✅ Das Bewerbungspanel wurde erstellt.");
            }

            if (
                command === "team" &&
                args[0]?.toLowerCase() === "bewerbungen"
            ) {
                if (!hasProtectedCommandPermission(message.member)) {
                    return message.reply("❌ Du hast dafür keine Berechtigung.");
                }

                const guildApplications = Object.values(TEAM_APPLICATIONS.applications)
                    .filter(application => application.guildId === message.guild.id)
                    .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));

                if (guildApplications.length === 0) {
                    return message.reply("📭 Es gibt keine gespeicherten Bewerbungen für diesen Server.");
                }

                await message.channel.send(`📋 **Alle Bewerbungen (${guildApplications.length})**`);
                for (const [index, application] of guildApplications.entries()) {
                    const answerCount = Array.isArray(application.answers) ? application.answers.filter(Boolean).length : 0;
                    const submittedAt = application.submittedAt ? formatGermanTime(new Date(application.submittedAt)) : "Noch nicht eingegangen";
                    const answers = TEAM_APPLICATION_QUESTIONS
                        .map((question, questionIndex) => `**${questionIndex + 1}. ${question}**\nAntwort: ${application.answers?.[questionIndex] || "Keine Antwort"}`)
                        .join("\n\n");
                    const applicationText = `## ${index + 1}. Bewerbung von <@${application.userId}>\nStatus: ${getTeamApplicationStatusLabel(application.status)} | Antworten: ${answerCount}/${TEAM_APPLICATION_QUESTIONS.length} | ${submittedAt}\n\n${answers}`;
                    const chunks = splitApplicationText(applicationText, 1800);

                    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
                        await message.channel.send({
                            content: chunks[chunkIndex],
                            components: chunkIndex === chunks.length - 1
                                ? [createApplicationManagementButtons(application.guildId, application.userId)]
                                : []
                        });
                    }
                }

                return;
            }

            // =================================================
            // !KI-CHAT
            // =================================================

            if (
                command ===
                "ki-chat"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast keine Berechtigung, den KI-Chat einzurichten."
                    );
                }

                const success =
                    setKIChatChannel(
                        message.guild.id,
                        message.channel.id
                    );

                if (!success) {
                    return message.reply(
                        "❌ Der KI-Chat konnte nicht eingerichtet werden."
                    );
                }

                return message.reply(
                    `✅ Dieser Kanal wurde als KI-Chat festgelegt!\n\n` +
                    `🤖 Schreibe hier einfach eine Nachricht, und die KI antwortet.`
                );
            }

            // =================================================
            // BOT LOG FÜR JEDEN PREFIX-BEFEHL
            // =================================================

            await logBotCommand(
                message,
                command || "unbekannt"
            );

            // =================================================
            // !RP-PANEL
            // =================================================

            if (
                command ===
                "rp-panel"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                await message.channel.send(
                    createRPPanel(
                        message.guild.id
                    )
                );

                return;
            }

 // =================================================
// !PROFILBILD-BOT
// =================================================

if (
    command === "profilbild-bot"
) {

    if (!message.guild) {
        return message.reply(
            "❌ Dieser Befehl funktioniert nur auf einem Server."
        );
    }

    if (
        !hasProtectedCommandPermission(
            message.member
        )
    ) {
        return message.reply(
            "❌ Du hast dafür keine Berechtigung."
        );
    }

    try {

        await message.channel.send(
            createBotAvatarPanel(
                message.guild.id
            )
        );

    } catch (error) {

        console.error(
            "❌ Fehler beim Öffnen des Bot-Profilbild-Panels:",
            error
        );

        return message.reply(
            "❌ Das Bot-Profilbild-Menü konnte nicht geöffnet werden."
        );
    }

    return;
}

            // =================================================
            // !GIVEAWAY
            // =================================================

            if (
                command ===
                "giveaway"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                const draft =
                    createGiveawayDraft(
                        message.guild.id,
                        message.author.id
                    );

                const panelMessage =
                    await message.channel.send(
                        createGiveawayConfigPanel(draft)
                    );

                setGiveawayDraft(
                    panelMessage.id,
                    draft
                );

                return;
            }

            // =================================================
            // !TEAM-PANEL
            // =================================================

            if (
                command ===
                "team-panel"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                await message.channel.send(
                    createTeamPanel()
                );

                return;
            }

            // =================================================
            // !NAME-TAG-SET
            // =================================================

            if (
                command ===
                "name-tag-set"
            ) {

                if (
                    !hasNameTagSetPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast keine Berechtigung, diesen Befehl auszuführen."
                    );
                }

                await message.reply(
                    "🔄 Die Nicknames werden für alle passenden Mitglieder aktualisiert..."
                );

                const result =
                    await updateAllNicknames(
                        message.guild
                    );

                return message.reply(
                    {
                        content:
                            `${result.error || result.failed ? "⚠️ Nicknames wurden nicht vollständig aktualisiert." : "✅ Nicknames wurden aktualisiert!"}\n\n` +
                            `👤 Geändert: **${result.updated}**\n` +
                            `⏭️ Übersprungen: **${result.skipped}**\n` +
                            `❌ Fehlgeschlagen: **${result.failed}**` +
                            (result.error ? `\n⚠️ Mitglieder konnten nicht vollständig geladen werden: ${result.error.message}` : "")
                    }
                );
            }

            // =================================================
            // !NICKNAME-AKTUALISIEREN
            // =================================================

            if (
                command ===
                "nickname-aktualisieren"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                await message.reply(
                    "🔄 Alle Mitglieder werden überprüft und die Nicknames anhand ihrer aktuellen Rollen aktualisiert..."
                );

                const nicknameUpdateResult =
                    await updateAllNicknames(
                        message.guild
                    );

                return message.reply(
                    {
                        content:
                            `${nicknameUpdateResult.error || nicknameUpdateResult.failed ? "⚠️ Nicknames wurden nicht vollständig aktualisiert." : "✅ Nicknames wurden für alle Mitglieder aktualisiert!"}\n\n` +
                            `👤 Geändert: **${nicknameUpdateResult.updated}**\n` +
                            `⏭️ Übersprungen: **${nicknameUpdateResult.skipped}**\n` +
                            `❌ Fehlgeschlagen: **${nicknameUpdateResult.failed}**` +
                            (nicknameUpdateResult.error ? `\n⚠️ Mitglieder konnten nicht vollständig geladen werden: ${nicknameUpdateResult.error.message}` : "")
                    }
                );
            }

            // =================================================
            // !LOGS
            // =================================================

            if (command === "logs") {

                if (!hasProtectedCommandPermission(message.member)) {
                    return message.reply("❌ Du hast keine Berechtigung, diesen Befehl zu verwenden.");
                }

                const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
                const subCommand = args[1]?.toLowerCase();

                if (!subCommand) {
                    // Zeige Hilfe für !logs
                    const helpEmbed = new EmbedBuilder()
                        .setColor(0x8B5CF6)
                        .setTitle("📊 Log-System Befehle")
                        .setDescription("Verwende `/logs` und wähle eine Aktion aus.")
                        .addFields(
                            {
                                name: "`!logs set <kanal>`",
                                value: "Setzt den Log-Kanal auf den angegebenen Kanal",
                                inline: false
                            },
                            {
                                name: "`!logs channel`",
                                value: "Zeigt den aktuellen Log-Kanal an",
                                inline: false
                            },
                            {
                                name: "`!logs test`",
                                value: "Sendet einen Test-Log in den aktuellen Log-Kanal",
                                inline: false
                            },
                            {
                                name: "`!logs reset`",
                                value: "Setzt den Log-Kanal auf den Standardwert zurück",
                                inline: false
                            }
                        )
                        .setFooter({ text: "Vexo RP Bot • Log-System" })
                        .setTimestamp();

                    return message.reply({ embeds: [helpEmbed] });
                }

                if (subCommand === "set") {
                    const mentionedChannel = message.mentions.channels.first();
                    
                    if (!mentionedChannel) {
                        return message.reply("❌ Bitte erwähne einen Kanal mit `!logs set #kanal`");
                    }

                    // Speichere die neue Channel-ID
                    process.env.BOT_LOG_CHANNEL_ID = mentionedChannel.id;

                    // Versuche einen Test-Log zu senden
                    try {
                        await log({
                            type: "COMMAND",
                            action: "Log-Kanal geändert",
                            user: message.author,
                            channel: mentionedChannel,
                            guild: message.guild,
                            details: `Log-Kanal wurde auf <#${mentionedChannel.id}> gesetzt`,
                            status: "Erfolgreich"
                        });

                        return message.reply(
                            `✅ Log-Kanal wurde erfolgreich auf <#${mentionedChannel.id}> gesetzt!\n\n` +
                            `📊 Ein Test-Log wurde gesendet, um zu überprüfen, ob der Bot Zugriff hat.`
                        );
                    } catch (error) {
                        return message.reply(
                            `❌ Log-Kanal wurde auf <#${mentionedChannel.id}> gesetzt, aber der Test-Log schlug fehl.\n\n` +
                            `⚠️ Fehler: ${error.message}\n\n` +
                            `💡 Bitte überprüfe, ob der Bot die Berechtigungen "Nachrichten senden" und "Embeds senden" in diesem Kanal hat.`
                        );
                    }
                }

                if (subCommand === "channel") {
                    const currentChannelId = process.env.BOT_LOG_CHANNEL_ID;
                    
                    if (!currentChannelId) {
                        return message.reply("❌ Es ist kein Log-Kanal konfiguriert.");
                    }

                    try {
                        const logChannel = await client.channels.fetch(currentChannelId);
                        if (!logChannel) {
                            return message.reply(`❌ Der konfigurierte Log-Kanal (ID: ${currentChannelId}) konnte nicht gefunden werden.`);
                        }

                        return message.reply(
                            `📊 Aktueller Log-Kanal: <#${currentChannelId}> (${logChannel.name})`
                        );
                    } catch (error) {
                        return message.reply(`❌ Fehler beim Abrufen des Log-Kanals: ${error.message}`);
                    }
                }

                if (subCommand === "test") {
                    try {
                        await log({
                            type: "COMMAND",
                            action: "Log-Test",
                            user: message.author,
                            channel: message.channel,
                            guild: message.guild,
                            details: "Dies ist ein Test-Log, um zu überprüfen, ob das Log-System funktioniert",
                            status: "Erfolgreich"
                        });

                        return message.reply("✅ Test-Log wurde erfolgreich gesendet!");
                    } catch (error) {
                        return message.reply(`❌ Test-Log konnte nicht gesendet werden: ${error.message}`);
                    }
                }

                if (subCommand === "reset") {
                    const defaultChannelId = "1546543785322872885";
                    process.env.BOT_LOG_CHANNEL_ID = defaultChannelId;

                    try {
                        await log({
                            type: "COMMAND",
                            action: "Log-Kanal zurückgesetzt",
                            user: message.author,
                            channel: message.channel,
                            guild: message.guild,
                            details: `Log-Kanal wurde auf den Standardwert zurückgesetzt`,
                            status: "Erfolgreich"
                        });

                        return message.reply(
                            `✅ Log-Kanal wurde auf den Standardwert zurückgesetzt: <#${defaultChannelId}>`
                        );
                    } catch (error) {
                        return message.reply(`❌ Fehler beim Zurücksetzen des Log-Kanals: ${error.message}`);
                    }
                }

                return message.reply("❌ Unbekannte Aktion. Verwende `/logs` und wähle eine Aktion aus.");
            }

            // =================================================
            // !JUCK  –  Server-Reset (nur Bot-Owner, nur dieser Server)
            // =================================================
            // Löscht ALLE Kanäle und ALLE Rollen (außer @everyone, die
            // lässt Discord nicht löschen) NUR auf dem Server, auf dem
            // der Befehl ausgeführt wurde. Erfordert eine Bestätigung
            // per Reaction, damit nichts aus Versehen passiert.

            if (
                command ===
                "juck"
            ) {

                if (
                    message.author.id !==
                    BOT_OWNER_ID
                ) {
                    return message.reply(
                        "❌ Nur der Bot-Owner darf diesen Befehl verwenden."
                    );
                }

                if (
                    !message.guild
                ) {
                    return message.reply(
                        "❌ Dieser Befehl funktioniert nur auf einem Server, nicht per DM."
                    );
                }

                const targetGuild = message.guild;

                const confirmMsg = await message.reply(
                    `⚠️ **ACHTUNG:** Dies löscht **ALLE Kanäle** und **ALLE Rollen** auf **${targetGuild.name}** unwiderruflich.\n` +
                    `Reagiere innerhalb von 15 Sekunden mit ✅, um zu bestätigen.`
                );

                await confirmMsg.react("✅");
                await confirmMsg.react("❌");

                const filter = (reaction, user) =>
                    ["✅", "❌"].includes(reaction.emoji.name) &&
                    user.id === BOT_OWNER_ID;

                let collected;
                try {
                    collected = await confirmMsg.awaitReactions({
                        filter,
                        max: 1,
                        time: 15000,
                        errors: ["time"]
                    });
                } catch (error) {
                    return message.reply(
                        "⏱️ Zeit abgelaufen. Vorgang abgebrochen."
                    );
                }

                const reactionResult = collected.first();

                if (
                    reactionResult.emoji.name ===
                    "❌"
                ) {
                    return message.reply(
                        "🚫 Vorgang abgebrochen."
                    );
                }

                const statusMsg = await message.reply(
                    "⏳ Server wird zurückgesetzt..."
                );

                let deletedChannels = 0;
                let failedChannels = 0;
                let deletedRoles = 0;
                let failedRoles = 0;

                // ---- Kanäle löschen ----
                const channels = await targetGuild.channels.fetch();
                for (const [, channel] of channels) {
                    if (!channel) continue;
                    try {
                        await channel.delete("Server-Reset (!juck) durch Bot-Owner");
                        deletedChannels++;
                    } catch (error) {
                        failedChannels++;
                        console.error(`❌ Kanal konnte nicht gelöscht werden (${channel.id}):`, error.message);
                    }
                }

                // ---- Rollen löschen ----
                const roles = await targetGuild.roles.fetch();
                for (const [, role] of roles) {
                    if (!role) continue;
                    if (role.id === targetGuild.id) continue; // @everyone kann nicht gelöscht werden
                    if (role.managed) continue; // Bot-/Integrations-Rollen überspringen
                    try {
                        await role.delete("Server-Reset (!juck) durch Bot-Owner");
                        deletedRoles++;
                    } catch (error) {
                        failedRoles++;
                        console.error(`❌ Rolle konnte nicht gelöscht werden (${role.id}):`, error.message);
                    }
                }

                try {
                    await logGuildAction(
                        `Server-Reset ausgeführt: ${deletedChannels} Kanäle gelöscht, ${deletedRoles} Rollen gelöscht`,
                        message.author,
                        targetGuild,
                        "Erfolgreich",
                        null
                    );
                } catch (error) {
                    console.error("❌ Fehler beim Loggen des Server-Resets:", error);
                }

                try {
                    await statusMsg.edit(
                        `✅ **Server-Reset abgeschlossen** auf **${targetGuild.name}**\n\n` +
                        `📁 Kanäle gelöscht: ${deletedChannels}${failedChannels ? ` (⚠️ ${failedChannels} fehlgeschlagen)` : ""}\n` +
                        `🎭 Rollen gelöscht: ${deletedRoles}${failedRoles ? ` (⚠️ ${failedRoles} fehlgeschlagen)` : ""}`
                    );
                } catch (error) {
                    // Der Status-Kanal könnte selbst gelöscht worden sein – das ist normal.
                    console.log("ℹ️ Status-Nachricht konnte nicht editiert werden (Kanal vermutlich gelöscht).");
                }

                return;
            }

            // =================================================
            // !HERUNTERFAHREN
            // =================================================

            if (
                command ===
                "herunterfahren"
            ) {

                if (
                    message.author.id !==
                    BOT_OWNER_ID
                ) {
                    return message.reply(
                        "❌ Nur der Bot-Owner darf den Bot herunterfahren."
                    );
                }

                await shutdownBot(
                    message
                );

                return;
            }

            // =================================================
            // !NEUSTART
            // =================================================

            if (
                command ===
                "neustart"
            ) {

                if (
                    !hasRestartPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast keine Berechtigung, diesen Befehl auszuführen."
                    );
                }

                await message.reply(
                    "🔄 Der Bot wird neu gestartet..."
                );

                saveRestartChannelId(
                    message.channel.id
                );

                setTimeout(
                    () => {
                        restartBotProcess();
                    },
                    1000
                );

                return;
            }

            // =================================================
            // !STATISTIK
            // =================================================

            if (
                command ===
                "statistik"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                saveGuildStatisticsChannel(
                    message.guild.id,
                    message.channel.id
                );

                await updateStatisticsPanelForGuild(
                    message.guild
                );

                await logBotEvent(
                    message.guild,
                    "📊 STATISTIK-KANAL GESETZT",
                    [
                        {
                            name: "👤 Ausgeführt von",
                            value: `${message.author}`
                        },
                        {
                            name: "📁 Kanal",
                            value: `${message.channel}`
                        },
                        {
                            name: "🕐 Zeitpunkt",
                            value: formatGermanTime(
                                new Date()
                            )
                        }
                    ],
                    0x5865F2,
                    {
                        updatePanel: true
                    }
                );

                return message.reply(
                    `✅ Der Statistik-/Log-Kanal wurde auf ${message.channel} gesetzt.`
                );
            }

            // =================================================
// !HÄUSER-PANEL
// =================================================
// BUGFIX: Der Befehl wurde zuvor fälschlicherweise als
// "häuserpannel" (Tippfehler, ohne Bindestrich) registriert.
// Dadurch hat "!häuser-panel" nie ausgelöst. Zusätzlich bleibt
// die alte Schreibweise als Alias erhalten, falls sie bereits
// irgendwo in Gebrauch war.

if (
    command === "häuser-panel" ||
    command === "häuserpannel"
) {

    if (
        !hasHousesPermission(
            message.member
        )
    ) {
        return message.reply(
            "❌ Du hast dafür keine Berechtigung."
        );
    }

    // =================================================
    // SERVER / CLIENT ERMITTELN
    // =================================================

    const houseClientNumber =
        getHouseClientNumber(
            message.guild
        );

    if (
        !houseClientNumber
    ) {
        return message.reply(
            "❌ Dieser Server ist für das Häuser-System nicht eingerichtet."
        );
    }

    const houseList =
        houseClientNumber === 2
            ? HOUSE_LIST_2
            : HOUSE_LIST_1;

    try {

        // =================================================
        // PANEL ERSTELLEN
        // =================================================

        const panelMessage =
            await message.channel.send(
                createHousesPanelPayload(
                    houseList,
                    houseClientNumber
                )
            );

        // =================================================
        // PANEL SEPARAT FÜR SERVER SPEICHERN
        // =================================================

        const panelFile =
            houseClientNumber === 2
                ? HOUSES_PANEL_FILE_2
                : HOUSES_PANEL_FILE_1;

        fs.writeFileSync(
            panelFile,
            JSON.stringify(
                {
                    channelId:
                        panelMessage.channel.id,

                    messageId:
                        panelMessage.id
                },
                null,
                2
            )
        );

        console.log(
            `✅ Häuserpanel für Client ${houseClientNumber} gespeichert.`
        );

    } catch (
        error
    ) {

        console.error(
            "❌ Fehler beim Erstellen des Häuserpanels:",
            error
        );

        await message.reply(
            "❌ Das Häuserpanel konnte nicht erstellt werden."
        );
    }

    return;
}
            // =================================================
            // !HÄUSERLISTE
            // =================================================

            if (
                command ===
                "häuserliste"
            ) {

                if (
                    !hasHousesPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                try {

                    await sendOrUpdateHousesList(
                        message.channel
                    );

                } catch (
                    error
                ) {

                    console.error(
                        "❌ Fehler bei Häuserliste:",
                        error
                    );

                    await message.reply(
                        "❌ Die Häuserliste konnte nicht erstellt werden."
                    );
                }

                return;
            }

            // =================================================
            // !TEAMLISTE
            // =================================================

            if (
                command ===
                "teamliste"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                const { embeds } =
                    await createTeamListEmbeds(
                        message.guild
                    );

                const teamListMessage =
                    await message.channel.send({
                        embeds
                    });

                // Diese Nachricht als "zuletzt erstellte Teamliste" merken,
                // damit sie bei Rollenänderungen automatisch per
                // message.edit() aktualisiert wird (dauerhaft gespeichert,
                // übersteht auch einen Bot-Neustart).
                setLastTeamListMessage(
                    message.guild.id,
                    message.channel.id,
                    teamListMessage.id
                );

                return;
            }

            // =================================================
            // !TEAMLISTE-UPDATE-START
            // =================================================

            if (
                command ===
                "teamliste-update-start"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                startAutoUpdate(
                    message.guild,
                    TEAMLIST_AUTO_UPDATE_CHANNEL_ID
                );

                await message.reply(
                    "✅ Automatisches Teamlisten-Update gestartet."
                );

                return;
            }

            // =================================================
            // !TEAMLISTE-UPDATE-STOP
            // =================================================

            if (
                command ===
                "teamliste-update-stop"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                stopAutoUpdate();

                await message.reply(
                    "✅ Automatisches Teamlisten-Update gestoppt."
                );

                return;
            }

            // =================================================
            // !TEAMSTATISTIK
            // =================================================

            if (
                command ===
                "teamstatistik"
            ) {

                if (
                    !hasProtectedCommandPermission(
                        message.member
                    )
                ) {
                    return message.reply(
                        "❌ Du hast dafür keine Berechtigung."
                    );
                }

                try {
                    await message.guild.members.fetch();
                } catch (error) {
                    console.error("❌ Mitglieder konnten für die Teamstatistik nicht vollständig geladen werden:", error);
                }

                const teamRole = message.guild.roles.cache.get(TEAMSTATISTIK_ROLE_ID);

                if (!teamRole) {
                    return message.reply(
                        "❌ Die konfigurierte Teammitglieder-Rolle wurde auf diesem Server nicht gefunden."
                    );
                }

                const teamMembers = message.guild.members.cache
                    .filter(member => member.roles.cache.has(TEAMSTATISTIK_ROLE_ID))
                    .sort((a, b) => a.user.tag.localeCompare(b.user.tag));

                const statsEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle("📊 Team-Statistik")
                    .setDescription(
                        `👥 **Teammitglieder:** ${teamMembers.size} (Rolle: ${teamRole})`
                    )
                    .setFooter({
                        text: teamLogFooterText()
                    })
                    .setTimestamp();

                const statsComponents = [];

                if (teamMembers.size > 0) {
                    const memberOptions = teamMembers
                        .first(25)
                        .map(member =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(member.user.tag.slice(0, 100))
                                .setDescription(`ID: ${member.id}`)
                                .setValue(member.id)
                        );

                    if (teamMembers.size > 25) {
                        statsEmbed.addFields({
                            name: "ℹ️ Hinweis",
                            value: `Das Auswahlmenü zeigt aufgrund einer Discord-Begrenzung nur die ersten 25 von ${teamMembers.size} Teammitgliedern (alphabetisch).`,
                            inline: false
                        });
                    }

                    statsComponents.push(
                        new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId("teamstatistik_select")
                                .setPlaceholder("👤 Teammitglied auswählen")
                                .addOptions(memberOptions)
                        )
                    );
                }

                return message.channel.send({
                    embeds: [statsEmbed],
                    components: statsComponents
                });
            }

// =================================================
// !TEXT-SENDE
// =================================================

if (
    command ===
    "text-sende"
) {

    if (
        !hasProtectedCommandPermission(
            message.member
        )
    ) {
        return message.reply(
            "❌ Du hast dafür keine Berechtigung."
        );
    }

    await message.channel.send(
        createTextSendeMainPanel()
    );

    return;
}

// =====================================================
// !VERIFY
// =====================================================

if (
    command ===
    "verify"
) {

    try {
        const result = await getVerificationPanelEmbed(message.guild);
        if (!result) {
            return message.reply("❌ Verifizierungs-Panel konnte nicht erstellt werden.");
        }

        const { embed, verifiedCount, totalMembers } = result;

        // Komponenten mit aktuellen Zahlen
        const verifyRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verify_start")
                    .setLabel("✅ Verifizieren")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("🔐")
            );

        const statsRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verify_count_verified")
                    .setLabel(`👥 Verifiziert: ${verifiedCount}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("verify_count_members")
                    .setLabel(`📊 Mitglieder: ${totalMembers}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("verify_count_security")
                    .setLabel("🛡️ Sicherheit: Aktiv")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

        // Panel direkt als Nachricht senden
        const panelMessage = await message.channel.send({
            embeds: [embed],
            components: [verifyRow, statsRow]
        });

        // Panel-ID speichern für Live-Updates
        saveVerificationPanel(panelMessage.channel.id, panelMessage.id);

    } catch (error) {
        console.error("❌ Fehler beim Verifizierungs-Panel:", error);
        return message.reply("❌ Das Verifizierungs-Panel konnte nicht erstellt werden.");
    }

    return;
}

// =====================================================
// RP-NACHRICHT
// =====================================================

if (
    command ===
    "rp-nachricht"
) {

    if (
        !hasProtectedCommandPermission(
            message.member
        )
    ) {
        return message.reply(
            "❌ Du hat dafür keine Berechtigung."
        );
    }

    try {
        const panel = await createRPChannelPanel(
            message.guild
        );
        await message.channel.send(panel);
    } catch (error) {
        console.error("❌ Fehler beim Senden des RP-Kanal-Panels:", error);
        return message.reply(
            "❌ Fehler beim Senden des Panels. Bitte versuche es erneut."
        );
    }

    return;
}

// =====================================================
// BEFEHLE
// =====================================================

if (
    command ===
    "befehle"
) {

    const commandsMessage = buildCommandOverviewMessage();

    await sendLongTextInChunks(
        message.channel,
        commandsMessage
    );

    return;
}

        } catch (
            error
        ) {

            console.error(
                "❌ Fehler bei messageCreate:",
                error
            );
        }
    }
);

// =====================================================
// RP-NACHRICHT KANALPANEL
// =====================================================

async function createRPChannelPanel(
    guild,
    page = 0
) {

    // Kanäle direkt über API abrufen statt Cache
    let channels = [];
    try {
        const fetchedChannels = await guild.channels.fetch();
        channels = Array.from(fetchedChannels.values())
            .filter(channel => {
                try {
                    return channel &&
                           channel.id &&
                           channel.name &&
                           (channel.type === ChannelType.GuildText ||
                            channel.type === ChannelType.GuildAnnouncement);
                } catch (error) {
                    return false;
                }
            })
            .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0));
    } catch (error) {
        console.error("❌ Fehler beim Laden der Kanäle:", error);
        channels = [];
    }

    console.log(`📊 Gefundene Kanäle: ${channels.length}`);

    // Debug: Prüfe die Kanal-Struktur
    if (channels.length > 0) {
        console.log("🔍 Beispiel-Kanal:", {
            id: channels[0].id,
            name: channels[0].name,
            type: channels[0].type,
            rawPosition: channels[0].rawPosition
        });
    }

    const pageSize = 25;
    const totalPages = Math.ceil(
        channels.length / pageSize
    );

    const start = page * pageSize;
    const end = Math.min(start + pageSize, channels.length);
    const pageChannels = channels.slice(
        start,
        end
    );

    console.log(`📊 Seite ${page + 1}/${totalPages || 1}: ${pageChannels.length} Kanäle (Start: ${start}, End: ${end})`);

    if (channels.length === 0) {
        return {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(
                        "❌ Keine Kanäle gefunden"
                    )
                    .setDescription(
                        "Keine Textkanäle auf diesem Server gefunden."
                    )
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • RP-System"
                    })
            ],
            components: []
        };
    }

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(
                "🚨・RP-Nachricht Kanal auswählen"
            )
            .setDescription(
                "Wähle den Kanal aus, in dem **RP-Start und RP-Stopp** gesendet werden sollen.\n\n" +
                `**Seite ${page + 1}/${totalPages || 1}**`
            )
            .setFooter({
                text:
                    "Vexo RP ✧ 𝙑𝘾 • RP-System"
            });

    // Debug: Kanal-Struktur prüfen
    console.log("🔍 Erster Kanal in pageChannels:", pageChannels[0] ? {
        id: pageChannels[0].id,
        name: pageChannels[0].name,
        type: pageChannels[0].type
    } : "Kein Kanal");

    const channelOptions =
        pageChannels
            .filter(channel => {
                const hasValidId = channel && channel.id && typeof channel.id === 'string' && channel.id.length > 0;
                const hasValidName = channel && channel.name && typeof channel.name === 'string' && channel.name.length > 0;
                const isValid = hasValidId && hasValidName;
                if (!isValid && channel) {
                    console.log("⚠️ Ungültiger Kanal:", { id: channel.id, name: channel.name, hasValidId, hasValidName });
                }
                return isValid;
            })
            .slice(0, 25) // Maximal 25 Optionen pro Seite
            .map(channel =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        channel.name
                    )
                    .setDescription(
                        channel.parent ?
                            `${channel.parent.name}` :
                            "Keine Kategorie"
                    )
                    .setValue(channel.id)
            );

    console.log(`📨 Seite ${page + 1}: ${channelOptions.length} Kanal-Optionen (vorher: ${pageChannels.length})`);

    if (channelOptions.length === 0) {
        return {
            embeds: [
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(
                        "❌ Keine Kanäle auf dieser Seite"
                    )
                    .setDescription(
                        "Keine Kanäle auf dieser Seite gefunden."
                    )
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • RP-System"
                    })
            ],
            components: []
        };
    }

    const row =
        new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(
                        "rp_channel_select"
                    )
                    .setPlaceholder(
                        "Kanal auswählen..."
                    )
                    .addOptions(
                        channelOptions
                    )
            );

    const buttonRow =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `rp_channel_prev_${page}`
                    )
                    .setLabel(
                        "◀ Zurück"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        page === 0
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        `rp_channel_next_${page}`
                    )
                    .setLabel(
                        "Weiter ▶"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        page >=
                        totalPages - 1
                    )
            );

    return {
        embeds: [embed],
        components: [row, buttonRow]
    };
}

// =====================================================
// AUSFÜHRLICHES TEXT SENDEN
// =====================================================

const TEXTSENDE_PER_PAGE = 20;

// -----------------------------------------------------
// SENDEN-KANÄLE LADEN
// -----------------------------------------------------

function getSendableTextChannels(guild) {
    return guild.channels.cache
        .filter(channel => {
            try {
                return (
                    channel &&
                    channel.id &&
                    channel.name &&
                    (
                        channel.type === ChannelType.GuildText ||
                        channel.type === ChannelType.GuildAnnouncement
                    )
                );
            } catch (error) {
                return false;
            }
        })
        .sort(
            (a, b) =>
                (a.rawPosition || 0) - (b.rawPosition || 0)
        );
}

// -----------------------------------------------------
// HAUPTPANEL
// -----------------------------------------------------

function createTextSendeMainPanel() {

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(
                "📨・Ausführliches Text senden"
            )
            .setDescription(
                "Wähle zuerst aus, **wie der Bot deine Nachricht schreiben soll.**\n\n" +
                "📝 **Normal**\n" +
                "Die Nachricht wird ganz normal als Bot-Nachricht gesendet.\n\n" +
                "🚨 **RP-Stil**\n" +
                "Die Nachricht wird im gleichen Stil wie dein **RP-Start / RP-Stopp** als Embed gesendet."
            )
            .setFooter({
                text:
                    "Vexo RP ✧ 𝙑𝘾 • Textsystem"
            });

    const row =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "textsende_style_normal"
                    )
                    .setLabel(
                        "Normal"
                    )
                    .setEmoji(
                        "📝"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "textsende_style_rp"
                    )
                    .setLabel(
                        "RP-Stil"
                    )
                    .setEmoji(
                        "🚨"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

// -----------------------------------------------------
// KANALPANEL
// -----------------------------------------------------

function createTextSendeChannelPanel(
    guild,
    page = 0,
    style = "normal"
) {

    const channels = Array.from(
    getSendableTextChannels(
        guild
    ).values()
);

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                channels.length /
                TEXTSENDE_PER_PAGE
            )
        );

    page = Math.max(
        0,
        Math.min(
            page,
            totalPages - 1
        )
    );

    const start =
        page *
        TEXTSENDE_PER_PAGE;

    const currentChannels =
        channels.slice(
            start,
            start +
            TEXTSENDE_PER_PAGE
        );

    const options =
        currentChannels.map(
            channel =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        `#${channel.name}`.slice(
                            0,
                            100
                        )
                    )
                    .setValue(
                        channel.id
                    )
                    .setDescription(
                        `${channel.parent?.name || "Ohne Kategorie"}`.slice(
                            0,
                            100
                        )
                    )
                    .setEmoji(
                        channel.type ===
                            ChannelType.GuildAnnouncement
                            ? "📢"
                            : "💬"
                    )
        );

    const components = [];

    if (options.length > 0) {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(
                            `textsende_channel_select_${style}`
                        )
                        .setPlaceholder(
                            "📂 Kanal auswählen..."
                        )
                        .addOptions(
                            options
                        )
                )
        );
    }

    const navigationRow =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `textsende_page_prev_${page}_${style}`
                    )
                    .setLabel(
                        "Zurück"
                    )
                    .setEmoji(
                        "⬅️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        page === 0
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "textsende_back_style"
                    )
                    .setLabel(
                        "Stil ändern"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `textsende_page_next_${page}_${style}`
                    )
                    .setLabel(
                        "Weiter"
                    )
                    .setEmoji(
                        "➡️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        page >=
                        totalPages - 1
                    )
            );

    components.push(
        navigationRow
    );

    const styleText =
        style === "rp"
            ? "🚨 RP-Stil"
            : "📝 Normal";

    const embed =
        new EmbedBuilder()
            .setColor(
                style === "rp"
                    ? 0x57F287
                    : 0x5865F2
            )
            .setTitle(
                "📨・Kanal auswählen"
            )
            .setDescription(
                `**Schreibstil:** ${styleText}\n\n` +
                "Wähle den Kanal aus, in den die Nachricht gesendet werden soll.\n\n" +
                `📄 **Seite ${page + 1} von ${totalPages}**\n` +
                `📁 **${channels.length} sendbare Kanäle insgesamt**`
            )
            .setFooter({
                text:
                    `Vexo RP ✧ 𝙑𝘾 • Textsystem • Seite ${page + 1}/${totalPages}`
            });

    return {
        embeds: [embed],
        components
    };
}

// -----------------------------------------------------
// NACHRICHT-MODAL
// -----------------------------------------------------

function createTextSendeModal(
    channelId,
    style
) {

    const modal =
        new ModalBuilder()
            .setCustomId(
                `textsende_modal_${style}_${channelId}`
            )
            .setTitle(
                style === "rp"
                    ? "🚨 Bot Nachicht Nachricht"
                    : "📝 Normale Nachricht"
            );

    const input =
        new TextInputBuilder()
            .setCustomId(
                "message_text"
            )
            .setLabel(
                "Nachricht"
            )
            .setPlaceholder(
                style === "rp"
                    ? "Schreibe hier deine RP-Nachricht..."
                    : "Schreibe hier deine Nachricht..."
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(
                true
            )
            .setMaxLength(
                4000
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                input
            )
    );

    return modal;
}

// =====================================================
// INTERACTIONS
// =====================================================

// =====================================================
// 🧞 VEXO AKINATOR – /akinator start | stop
// Öffentlicher Start-Button, privates Spiel, öffentliche Erfolge
// =====================================================
const AKINATOR_FILE = path.join(__dirname, "akinator-data.json");
let akinatorData = {};
try {
    if (fs.existsSync(AKINATOR_FILE)) {
        akinatorData = JSON.parse(fs.readFileSync(AKINATOR_FILE, "utf8"));
    }
} catch (error) {
    console.error("Akinator-Daten konnten nicht geladen werden:", error);
}
function saveAkinator() {
    const temp = AKINATOR_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(akinatorData, null, 2), "utf8");
    fs.renameSync(temp, AKINATOR_FILE);
}
function akinatorState(guildId) {
    if (!akinatorData[guildId]) akinatorData[guildId] = { panelChannelId: null, panelMessageId: null, scores: {} };
    if (!akinatorData[guildId].scores) akinatorData[guildId].scores = {};
    return akinatorData[guildId];
}
const akinatorGames = new Map();
const akinatorCommand = {
    name: "akinator",
    description: "Akinator-Panel verwalten",
    options: [
        { type: 1, name: "start", description: "Akinator-Panel in diesem Kanal erstellen" },
        { type: 1, name: "stop", description: "Akinator-Panel deaktivieren" }
    ]
};
function akinatorPanel() {
    return {
        embeds: [new EmbedBuilder().setColor(0x0893F3)
            .setTitle("🧞 𝐕𝐄𝐗𝐎 𝐀𝐊𝐈𝐍𝐀𝐓𝐎𝐑")
            .setDescription("**Denk an eine echte oder erfundene Figur!**\n\nIch stelle dir Fragen und versuche sie zu erraten. Deine Antworten siehst nur du.\n\n*Hinweis: Ich kenne derzeit eine Auswahl bekannter Figuren.*\n\n🏆 Für eine bestätigte Vermutung erhältst du Punkte auf dem gemeinsamen Leaderboard.")
            .setFooter({ text: "💫 Vexo RP | Akinator" })],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vexo_akinator:begin").setLabel("Akinator spielen").setEmoji("🧞").setStyle(ButtonStyle.Primary)
        )]
    };
}
function akinatorQuestionButtons() {
    const options = [
        ["Ja", "✅", ButtonStyle.Success],
        ["Nein", "❌", ButtonStyle.Danger],
        ["Weiß nicht", "❔", ButtonStyle.Secondary],
        ["Wahrscheinlich", "🤔", ButtonStyle.Primary],
        ["Wahrscheinlich nicht", "🙅", ButtonStyle.Secondary]
    ];
    return [
        new ActionRowBuilder().addComponents(options.map(([label, emoji, style], i) =>
            new ButtonBuilder().setCustomId(`vexo_akinator:answer:${i}`).setLabel(label).setEmoji(emoji).setStyle(style)
        )),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vexo_akinator:quit").setLabel("Beenden").setEmoji("🛑").setStyle(ButtonStyle.Danger)
        )
    ];
}
function akinatorGuessButtons() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("vexo_akinator:correct").setLabel("Ja, richtig!").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("vexo_akinator:wrong").setLabel("Nein, weiterraten!").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("vexo_akinator:quit").setLabel("Beenden").setStyle(ButtonStyle.Danger)
    )];
}
// Lokale Wissensbasis: keine externe Akinator-API, kein API-Key notwendig.
// Jede Figur besitzt Eigenschaften; die nächste Frage wird anhand der bisherigen
// Antworten so gewählt, dass sie möglichst viele Kandidaten unterscheidet.
const VEXO_AKI_QUESTIONS = [
    ["real", "Ist deine Figur eine echte Person?"],
    ["male", "Ist deine Figur männlich?"],
    ["alive", "Lebt diese Person heute noch?"],
    ["music", "Ist die Figur für Musik bekannt?"],
    ["sport", "Ist die Figur für Sport bekannt?"],
    ["football", "Hat die Figur etwas mit Fußball zu tun?"],
    ["actor", "Ist die Figur für Filme oder Serien bekannt?"],
    ["politics", "Ist die Figur aus der Politik bekannt?"],
    ["creator", "Ist die Figur durch YouTube, Streaming oder Internet bekannt?"],
    ["german", "Kommt die Figur aus Deutschland?"],
    ["american", "Kommt die Figur aus den USA?"],
    ["fiction", "Stammt die Figur aus einer erfundenen Geschichte?"],
    ["anime", "Kommt die Figur aus einem Anime oder Manga?"],
    ["game", "Kommt die Figur aus einem Videospiel?"],
    ["movie", "Kommt die Figur aus einem Kinofilm?"],
    ["series", "Kommt die Figur aus einer Fernseh- oder Streamingserie?"],
    ["cartoon", "Ist die Figur gezeichnet oder animiert?"],
    ["superhero", "Ist die Figur ein Superheld oder eine Superheldin?"],
    ["villain", "Ist die Figur eher ein Bösewicht?"],
    ["magic", "Hat die Figur magische oder übernatürliche Fähigkeiten?"],
    ["animal", "Ist die Figur ein Tier oder tierähnliches Wesen?"],
    ["robot", "Ist die Figur ein Roboter oder eine künstliche Maschine?"],
    ["yellow", "Ist die Figur hauptsächlich gelb?"],
    ["red", "Trägt die Figur auffällig rote Kleidung?"],
    ["blue", "Ist Blau eine typische Farbe der Figur?"],
    ["mask", "Trägt die Figur häufig eine Maske?"],
    ["cape", "Trägt die Figur einen Umhang?"],
    ["weapon", "Benutzt die Figur häufig eine Waffe?"],
    ["space", "Hat die Figur etwas mit dem Weltraum zu tun?"],
    ["school", "Spielt die Geschichte der Figur oft an einer Schule?"],
    ["royal", "Ist die Figur eine Prinzessin, ein Prinz oder königlich?"],
    ["old", "Wurde die Figur bereits vor dem Jahr 2000 berühmt?"],
    ["minecraft", "Hat die Figur etwas mit Minecraft zu tun?"],
    ["nintendo", "Gehört die Figur zu einem Nintendo-Spiel?"],
    ["disney", "Gehört die Figur zu Disney?"],
    ["marvel", "Gehört die Figur zu Marvel?"],
    ["dc", "Gehört die Figur zu DC Comics?"],
    ["pokemon", "Gehört die Figur zu Pokémon?"],
    ["dragonball", "Gehört die Figur zu Dragon Ball?"],
    ["naruto", "Gehört die Figur zu Naruto?"],
    ["onepiece", "Gehört die Figur zu One Piece?"],
    ["harrypotter", "Gehört die Figur zu Harry Potter?"],
    ["starwars", "Gehört die Figur zu Star Wars?"],
    ["spongebob", "Gehört die Figur zu SpongeBob Schwammkopf?"],
    ["simpsons", "Gehört die Figur zu Die Simpsons?"],
    ["gta", "Gehört die Figur zu Grand Theft Auto?"],
    ["fortnite", "Gehört die Figur zu Fortnite?"],
    ["fnaf", "Gehört die Figur zu Five Nights at Freddy's?"],
    ["horror", "Kommt die Figur aus einem Horror-Spiel oder Horror-Film?"],
    ["speed", "Ist die Figur für besonders hohe Geschwindigkeit bekannt?"],
    ["strong", "Ist die Figur für außergewöhnliche Stärke bekannt?"]
];
// Syntax: [Name, "kommagetrennte zutreffende Merkmale", Wikipedia-Suchbegriff (optional)]
const VEXO_AKI_PEOPLE = [
    ["Michael Jackson", "real,male,music,american,old", "Michael_Jackson"],
    ["Taylor Swift", "real,alive,music,american", "Taylor_Swift"],
    ["Elvis Presley", "real,male,music,american,old", "Elvis_Presley"],
    ["Billie Eilish", "real,alive,music,american", "Billie_Eilish"],
    ["Eminem", "real,male,alive,music,american,old", "Eminem"],
    ["Ariana Grande", "real,alive,music,actor,american", "Ariana_Grande"],
    ["Cristiano Ronaldo", "real,male,alive,sport,football", "Cristiano_Ronaldo"],
    ["Lionel Messi", "real,male,alive,sport,football", "Lionel_Messi"],
    ["Neymar", "real,male,alive,sport,football", "Neymar"],
    ["Kylian Mbappé", "real,male,alive,sport,football", "Kylian_Mbappé"],
    ["Thomas Müller", "real,male,alive,sport,football,german", "Thomas_Müller"],
    ["Manuel Neuer", "real,male,alive,sport,football,german", "Manuel_Neuer"],
    ["LeBron James", "real,male,alive,sport,american", "LeBron_James"],
    ["Michael Jordan", "real,male,alive,sport,american,old", "Michael_Jordan"],
    ["Albert Einstein", "real,male,german,old", "Albert_Einstein"],
    ["Elon Musk", "real,male,alive,creator", "Elon_Musk"],
    ["Donald Trump", "real,male,alive,politics,american", "Donald_Trump"],
    ["Barack Obama", "real,male,alive,politics,american", "Barack_Obama"],
    ["Angela Merkel", "real,alive,politics,german", "Angela_Merkel"],
    ["MrBeast", "real,male,alive,creator,american", "MrBeast"],
    ["MontanaBlack", "real,male,alive,creator,german", "MontanaBlack"],
    ["Gronkh", "real,male,alive,creator,german,minecraft", "Gronkh"],
    ["Rezo", "real,male,alive,creator,music,german", "Rezo"],
    ["Paluten", "real,male,alive,creator,german,minecraft", "Paluten"],
    ["Knossi", "real,male,alive,creator,german", "Jens_Knossalla"],
    ["Dwayne Johnson", "real,male,alive,actor,sport,american", "Dwayne_Johnson"],
    ["Leonardo DiCaprio", "real,male,alive,actor,american", "Leonardo_DiCaprio"],
    ["Tom Holland", "real,male,alive,actor", "Tom_Holland"],
    ["Jenna Ortega", "real,alive,actor,american", "Jenna_Ortega"],
    ["Johnny Depp", "real,male,alive,actor,american", "Johnny_Depp"],
    ["Harry Potter", "fiction,male,movie,magic,school,harrypotter,old", "Harry_Potter_(character)"],
    ["Hermine Granger", "fiction,movie,magic,school,harrypotter,old", "Hermione_Granger"],
    ["Lord Voldemort", "fiction,male,movie,magic,villain,harrypotter,old", "Lord_Voldemort"],
    ["Darth Vader", "fiction,male,movie,villain,mask,cape,weapon,space,starwars,old", "Darth_Vader"],
    ["Yoda", "fiction,male,movie,magic,weapon,space,starwars,old", "Yoda"],
    ["Luke Skywalker", "fiction,male,movie,weapon,space,starwars,old", "Luke_Skywalker"],
    ["Spider-Man", "fiction,male,movie,superhero,mask,red,blue,marvel", "Spider-Man"],
    ["Iron Man", "fiction,male,movie,superhero,mask,red,robot,marvel", "Iron_Man"],
    ["Hulk", "fiction,male,movie,superhero,strong,marvel", "Hulk"],
    ["Thor", "fiction,male,movie,superhero,magic,weapon,cape,strong,marvel", "Thor_(Marvel_Comics)"],
    ["Captain America", "fiction,male,movie,superhero,mask,blue,red,weapon,marvel", "Captain_America"],
    ["Thanos", "fiction,male,movie,villain,magic,space,strong,marvel", "Thanos"],
    ["Batman", "fiction,male,movie,superhero,mask,cape,weapon,dc,old", "Batman"],
    ["Superman", "fiction,male,movie,superhero,cape,red,blue,strong,dc,old", "Superman"],
    ["Joker", "fiction,male,movie,villain,dc,old", "Joker_(character)"],
    ["Wonder Woman", "fiction,movie,superhero,weapon,strong,dc", "Wonder_Woman"],
    ["SpongeBob Schwammkopf", "fiction,male,series,cartoon,animal,yellow,spongebob", "SpongeBob_SquarePants_(character)"],
    ["Patrick Star", "fiction,male,series,cartoon,animal,spongebob", "Patrick_Star"],
    ["Thaddäus Tentakel", "fiction,male,series,cartoon,animal,spongebob", "Squidward_Tentacles"],
    ["Homer Simpson", "fiction,male,series,cartoon,yellow,simpsons,old", "Homer_Simpson"],
    ["Bart Simpson", "fiction,male,series,cartoon,yellow,simpsons,old", "Bart_Simpson"],
    ["Lisa Simpson", "fiction,series,cartoon,yellow,simpsons,old", "Lisa_Simpson"],
    ["Micky Maus", "fiction,male,cartoon,animal,disney,old", "Mickey_Mouse"],
    ["Donald Duck", "fiction,male,cartoon,animal,disney,old", "Donald_Duck"],
    ["Elsa", "fiction,movie,cartoon,magic,royal,disney", "Elsa_(Frozen)"],
    ["Anna (Die Eiskönigin)", "fiction,movie,cartoon,royal,disney", "Anna_(Frozen)"],
    ["Simba", "fiction,male,movie,cartoon,animal,royal,disney,old", "Simba"],
    ["Shrek", "fiction,male,movie,cartoon,strong", "Shrek_(character)"],
    ["Gru", "fiction,male,movie,cartoon,villain", "Felonius_Gru"],
    ["Mario", "fiction,male,game,red,nintendo,old", "Mario"],
    ["Luigi", "fiction,male,game,nintendo,old", "Luigi"],
    ["Prinzessin Peach", "fiction,game,royal,nintendo,old", "Princess_Peach"],
    ["Bowser", "fiction,male,game,animal,villain,strong,nintendo,old", "Bowser"],
    ["Link", "fiction,male,game,weapon,magic,nintendo,old", "Link_(The_Legend_of_Zelda)"],
    ["Pikachu", "fiction,game,cartoon,animal,yellow,pokemon,nintendo,old", "Pikachu"],
    ["Glurak", "fiction,game,cartoon,animal,pokemon,nintendo,old", "Charizard"],
    ["Ash Ketchum", "fiction,male,anime,series,cartoon,pokemon,old", "Ash_Ketchum"],
    ["Sonic", "fiction,male,game,cartoon,animal,blue,speed,old", "Sonic_the_Hedgehog"],
    ["Steve (Minecraft)", "fiction,male,game,weapon,minecraft", "Steve_(Minecraft)"],
    ["Herobrine", "fiction,male,game,villain,minecraft", "Herobrine"],
    ["Creeper", "fiction,game,animal,villain,minecraft", "Creeper_(Minecraft)"],
    ["Enderman", "fiction,game,animal,minecraft", "Enderman"],
    ["Lara Croft", "fiction,game,weapon,old", "Lara_Croft"],
    ["Kratos", "fiction,male,game,weapon,strong,magic", "Kratos_(God_of_War)"],
    ["Freddy Fazbear", "fiction,male,game,animal,robot,horror,fnaf", "Freddy_Fazbear"],
    ["Springtrap", "fiction,male,game,animal,robot,villain,horror,fnaf", "Springtrap"],
    ["Michael De Santa", "fiction,male,game,weapon,gta", "Michael_De_Santa"],
    ["Franklin Clinton", "fiction,male,game,weapon,gta", "Franklin_Clinton"],
    ["Trevor Philips", "fiction,male,game,weapon,villain,gta", "Trevor_Philips"],
    ["Goku", "fiction,male,anime,series,cartoon,magic,strong,dragonball,old", "Goku"],
    ["Vegeta", "fiction,male,anime,series,cartoon,magic,strong,dragonball,old", "Vegeta"],
    ["Naruto Uzumaki", "fiction,male,anime,series,cartoon,magic,weapon,naruto", "Naruto_Uzumaki"],
    ["Sasuke Uchiha", "fiction,male,anime,series,cartoon,magic,weapon,naruto", "Sasuke_Uchiha"],
    ["Monkey D. Ruffy", "fiction,male,anime,series,cartoon,magic,strong,onepiece", "Monkey_D._Luffy"],
    ["Roronoa Zoro", "fiction,male,anime,series,cartoon,weapon,strong,onepiece", "Roronoa_Zoro"],
    ["Wednesday Addams", "fiction,series,magic,school,horror", "Wednesday_Addams"],
    ["Eleven (Stranger Things)", "fiction,series,magic", "Eleven_(Stranger_Things)"],
    ["Rick Sanchez", "fiction,male,series,cartoon,space", "Rick_Sanchez"],
    ["Morty Smith", "fiction,male,series,cartoon,space", "Morty_Smith"]
].map(([name, tags, wiki]) => ({ name, tags: new Set(tags.split(",")), wiki }));

function vexoAkiRank(game) {
    return VEXO_AKI_PEOPLE.map((person, index) => {
        let score = 0;
        for (const [trait, answer] of Object.entries(game.answers)) {
            const expected = person.tags.has(trait) ? 1 : 0;
            // Antworten 0=Ja, 1=Nein, 2=Unbekannt, 3=Wahrscheinlich, 4=Wahrscheinlich nicht
            const strength = answer === 0 ? 2.2 : answer === 1 ? -2.2 : answer === 3 ? 1 : answer === 4 ? -1 : 0;
            score += expected ? strength : -strength;
        }
        return { person, score, index };
    }).filter(x => !game.rejected.includes(x.index)).sort((a,b) => b.score - a.score);
}
function vexoAkiNext(game) {
    const ranked = vexoAkiRank(game);
    const pool = ranked.slice(0, Math.min(18, ranked.length));
    if (!pool.length) return null;
    let best = null, bestValue = -Infinity;
    for (const [trait, question] of VEXO_AKI_QUESTIONS) {
        if (Object.hasOwn(game.answers, trait)) continue;
        let yes = 0, total = 0;
        for (const item of pool) {
            const weight = Math.exp(Math.max(-20, item.score - pool[0].score) * 0.42);
            total += weight;
            if (item.person.tags.has(trait)) yes += weight;
        }
        const balance = total ? Math.min(yes / total, 1 - yes / total) : 0;
        if (balance > bestValue) { bestValue = balance; best = { trait, question }; }
    }
    return best;
}
function vexoAkiAdvance(game) {
    const ranked = vexoAkiRank(game);
    if (!ranked.length) return { type: "end" };
    const next = vexoAkiNext(game);
    const answered = Object.keys(game.answers).length;
    // Nach ausreichend Information vermuten; nie eine Endlosschleife erzeugen.
    if (!next || answered >= 38 || (answered >= 7 && (ranked.length === 1 || ranked[0].score - (ranked[1]?.score ?? -100) >= 6))) {
        game.guessing = true;
        game.guess = ranked[0].person;
        return { type: "guess" };
    }
    game.currentQuestion = next;
    game.currentStep = answered;
    return { type: "question" };
}
function akinatorQuestionEmbed(game) {
    return new EmbedBuilder().setColor(0x0893F3)
        .setTitle("🧞 𝐕𝐄𝐗𝐎 𝐀𝐊𝐈𝐍𝐀𝐓𝐎𝐑")
        .setDescription(`**Frage ${game.currentStep + 1}**\n\n${game.currentQuestion.question}`)
        .setFooter({ text: `Eigener Figuren-Rater • ${VEXO_AKI_PEOPLE.length} bekannte Figuren` });
}
async function vexoAkiPicture(guess) {
    if (!guess?.wiki || typeof fetch !== "function") return null;
    try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(guess.wiki)}`;
        const response = await fetch(url, { headers: { "User-Agent": "VexoRP-DiscordBot/1.0 (character-game)" }, signal: AbortSignal.timeout(3500) });
        if (!response.ok) return null;
        const data = await response.json();
        const image = data?.thumbnail?.source;
        return typeof image === "string" && /^https:\/\//i.test(image) ? image : null;
    } catch { return null; }
}
function akinatorGuessEmbed(guess) {
    return new EmbedBuilder().setColor(0x0893F3).setTitle("🧞 Ich habe eine Vermutung!")
        .setDescription(`**${guess.name}**\n\n**Habe ich richtig geraten?**`);
}
function akinatorPoints(game) {
    const steps = Number(game.currentStep) || 0;
    const minutes = (Date.now() - game.startedAt) / 60000;
    const difficulty = steps >= 30 ? 10 : steps >= 20 ? 7 : steps >= 10 ? 5 : 3;
    const speed = minutes <= 2 ? 5 : minutes <= 5 ? 3 : minutes <= 10 ? 1 : 0;
    return { points: difficulty + speed, steps, minutes: Math.max(1, Math.ceil(minutes)) };
}
async function handleAkinatorSetup(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "❌ Du benötigst **Server verwalten**.", flags: MessageFlags.Ephemeral });
    }
    const action = interaction.options.getSubcommand();
    const state = akinatorState(interaction.guildId);
    if (action === "stop") {
        if (state.panelChannelId && state.panelMessageId) {
            const channel = await interaction.guild.channels.fetch(state.panelChannelId).catch(() => null);
            const old = await channel?.messages?.fetch(state.panelMessageId).catch(() => null);
            await old?.delete().catch(() => {});
        }
        state.panelChannelId = null;
        state.panelMessageId = null;
        saveAkinator();
        return interaction.reply({ content: "🛑 Akinator-Panel deaktiviert. Punkte bleiben erhalten.", flags: MessageFlags.Ephemeral });
    }
    if (interaction.channel?.type !== ChannelType.GuildText) {
        return interaction.reply({ content: "❌ Bitte einen normalen Textkanal verwenden.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const panel = await interaction.channel.send(akinatorPanel());
        if (state.panelChannelId && state.panelMessageId) {
            const oldChannel = await interaction.guild.channels.fetch(state.panelChannelId).catch(() => null);
            const oldPanel = await oldChannel?.messages?.fetch(state.panelMessageId).catch(() => null);
            await oldPanel?.delete().catch(() => {});
        }
        state.panelChannelId = interaction.channelId;
        state.panelMessageId = panel.id;
        saveAkinator();
        return interaction.editReply("✅ Akinator-Panel erstellt! Spieler starten mit dem Button ein privates Spiel.");
    } catch (error) {
        console.error("Akinator Panel:", error);
        return interaction.editReply("❌ Panel konnte nicht erstellt werden. Prüfe meine Kanalberechtigungen.");
    }
}
async function handleAkinatorButton(interaction) {
    const state = akinatorState(interaction.guildId);
    const action = interaction.customId.split(":")[1];
    const key = `${interaction.guildId}:${interaction.user.id}`;
    if (action === "begin") {
        if (state.panelChannelId !== interaction.channelId || state.panelMessageId !== interaction.message.id) {
            return interaction.reply({ content: "❌ Dieses Akinator-Panel ist nicht mehr aktiv.", flags: MessageFlags.Ephemeral });
        }
        if (akinatorGames.has(key)) {
            return interaction.reply({ content: "❌ Du hast bereits ein Spiel. Beende es zuerst.", flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const game = { answers: {}, rejected: [], currentQuestion: null, currentStep: 0,
            startedAt: Date.now(), lastActivity: Date.now(), busy: false,
            guessing: false, guess: null, messageId: null };
        vexoAkiAdvance(game);
        akinatorGames.set(key, game);
        try {
            await interaction.editReply({ embeds: [akinatorQuestionEmbed(game)], components: akinatorQuestionButtons() });
            const reply = await interaction.fetchReply();
            game.messageId = reply.id;
        } catch (error) {
            akinatorGames.delete(key);
            console.error("Akinator Spielstart:", error.message);
        }
        return;
    }
    const game = akinatorGames.get(key);
    if (!game || game.messageId !== interaction.message.id) {
        return interaction.reply({ content: "❌ Dieses Spiel gehört nicht dir oder ist abgelaufen.", flags: MessageFlags.Ephemeral });
    }
    if (game.busy) return interaction.reply({ content: "⏳ Bitte kurz warten.", flags: MessageFlags.Ephemeral });
    game.busy = true;
    game.lastActivity = Date.now();
    try {
        await interaction.deferUpdate();
        if (action === "quit") {
            akinatorGames.delete(key);
            return interaction.editReply({ content: "🛑 Spiel beendet.", embeds: [], components: [] });
        }
        if (action === "correct" && game.guessing && game.guess) {
            // Zuerst öffentliches Ergebnis senden; erst danach Punkte vergeben.
            const award = akinatorPoints(game);
            const guess = game.guess;
            const embed = new EmbedBuilder().setColor(0x0893F3)
                .setTitle("🏆 Akinator hat richtig geraten!")
                .setDescription(`<@${interaction.user.id}> hat an **${String(guess.name).slice(0, 200)}** gedacht!\n\n🧞 Fragen: **${award.steps}**\n⏱️ Dauer: **${award.minutes} Min.**\n⭐ Erhaltene Punkte: **+${award.points}**`)
                .setTimestamp();
            const picture = await vexoAkiPicture(guess);
            if (picture) embed.setImage(picture);
            const resultChannel = await interaction.guild.channels.fetch(state.panelChannelId).catch(() => null);
            if (!resultChannel?.isTextBased()) {
                return interaction.editReply({ content: "❌ Ergebnis-Kanal nicht erreichbar. Bitte später erneut versuchen.", embeds: [], components: [] });
            }
            await resultChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], allowedMentions: { users: [interaction.user.id] } });
            state.scores[interaction.user.id] = (state.scores[interaction.user.id] || 0) + award.points;
            saveAkinator();
            akinatorGames.delete(key);
            await interaction.editReply({ content: `🎉 Richtig geraten! **+${award.points} Punkte**. Dein Ergebnis steht jetzt öffentlich im Akinator-Kanal.`, embeds: [], components: [] });
            await updateCountingLeaderboard(interaction.guildId).catch(error => console.error("Akinator Leaderboard:", error));
            return;
        }
        if (action === "wrong" && game.guessing) {
            const rejectedGuess = game.guess;
            game.guessing = false;
            game.guess = null;
            game.rejected.push(VEXO_AKI_PEOPLE.indexOf(rejectedGuess));
            const next = vexoAkiAdvance(game);
            if (next.type === "end") {
                akinatorGames.delete(key);
                return interaction.editReply({ content: "🤷 Ich kenne deine Figur leider noch nicht. Versuche eine andere!", embeds: [], components: [] });
            }
            return interaction.editReply({ embeds: [next.type === "guess" ? akinatorGuessEmbed(game.guess) : akinatorQuestionEmbed(game)], components: next.type === "guess" ? akinatorGuessButtons() : akinatorQuestionButtons() });
        }
        if (action !== "answer" || game.guessing) return;
        const answer = Number(interaction.customId.split(":")[2]);
        if (!Number.isInteger(answer) || answer < 0 || answer > 4) return;
        game.answers[game.currentQuestion.trait] = answer;
        const next = vexoAkiAdvance(game);
        if (next.type === "end") {
            akinatorGames.delete(key);
            return interaction.editReply({ content: "🤷 Diese Figur kenne ich noch nicht. Versuche eine andere!", embeds: [], components: [] });
        }
        await interaction.editReply({ embeds: [next.type === "guess" ? akinatorGuessEmbed(game.guess) : akinatorQuestionEmbed(game)], components: next.type === "guess" ? akinatorGuessButtons() : akinatorQuestionButtons() });
    } catch (error) {
        console.error("Akinator Spielfehler:", error);
        akinatorGames.delete(key);
        await interaction.editReply({ content: "❌ Beim Figuren-Raten ist ein Fehler aufgetreten. Starte bitte ein neues Spiel.", embeds: [], components: [] }).catch(() => {});
    } finally {
        game.busy = false;
    }
}
setInterval(() => {
    for (const [key, game] of akinatorGames) {
        if (Date.now() - game.lastActivity > 20 * 60 * 1000) akinatorGames.delete(key);
    }
}, 60_000).unref?.();

// =====================================================
// 🔢 VEXO COUNTING - /counting start | stop | status
// =====================================================
const COUNTING_FILE = path.join(__dirname, "counting-data.json");
let countingData = {};
try {
    if (fs.existsSync(COUNTING_FILE)) {
        countingData = JSON.parse(fs.readFileSync(COUNTING_FILE, "utf8"));
    }
} catch (error) {
    console.error("Counting-Daten konnten nicht geladen werden:", error);
}
function saveCounting() {
    const temp = COUNTING_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(countingData, null, 2), "utf8");
    fs.renameSync(temp, COUNTING_FILE);
}
const leaderboardCommand = {
    name: "leaderboard",
    description: "Erstellt oder aktualisiert das Counting-Leaderboard in diesem Kanal"
};

function countingPoints(number) {
    if (number % 1000n === 0n) return 100;
    if (number % 100n === 0n) return 50;
    if (number % 30n === 0n) return 20;
    if (number % 10n === 0n) return 5;
    return 1;
}

function leaderboardPages(state) {
    const combined = { ...(state.scores || {}) };
    for (const [id, points] of Object.entries(akinatorState(state.guildId).scores)) {
        combined[id] = (combined[id] || 0) + points;
    }
    const scores = Object.entries(combined)
        .filter(([, points]) => Number.isSafeInteger(points) && points > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const lines = scores.map(([id, points], index) =>
        `**${index + 1}.** <@${id}> — **${points.toLocaleString("de-DE")} Punkte**`
    );
    if (!lines.length) lines.push("Noch keine Punkte vergeben. Schreibt die **1**!");
    const pages = [];
    let current = [];
    let length = 0;
    for (const line of lines) {
        if (current.length >= 30 || length + line.length + 1 > 3500) {
            pages.push(current.join("\n")); current = []; length = 0;
        }
        current.push(line); length += line.length + 1;
    }
    if (current.length) pages.push(current.join("\n"));
    return pages;
}

async function updateCountingLeaderboard(guildId) {
    const state = countingData[guildId];
    if (!state?.leaderboardChannelId) return;
    const channel = await client.channels.fetch(state.leaderboardChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    state.guildId = guildId;
    const pages = leaderboardPages(state);
    const ids = state.leaderboardMessageIds || [];
    const nextIds = [];
    for (let i = 0; i < pages.length; i++) {
        const payload = {
            embeds: [new EmbedBuilder()
                .setColor(0x0893F3)
                .setTitle(`🏆 𝐕𝐄𝐗𝐎 𝐑𝐏 — 𝐋𝐄𝐀𝐃𝐄𝐑𝐁𝐎𝐀𝐑𝐃${pages.length > 1 ? ` (${i + 1}/${pages.length})` : ""}`)
                .setDescription(pages[i])
                .setFooter({ text: `Counting + Akinator • Aktuelle Zahl: ${state.number}` })
                .setTimestamp()],
            allowedMentions: { parse: [] }
        };
        let msg = ids[i] ? await channel.messages.fetch(ids[i]).catch(() => null) : null;
        if (msg) await msg.edit(payload);
        else msg = await channel.send(payload);
        nextIds.push(msg.id);
    }
    for (const oldId of ids.slice(pages.length)) {
        const old = await channel.messages.fetch(oldId).catch(() => null);
        if (old) await old.delete().catch(() => {});
    }
    state.leaderboardMessageIds = nextIds;
    saveCounting();
}

async function handleLeaderboardCommand(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "❌ Du benötigst **Server verwalten**.", flags: MessageFlags.Ephemeral });
    }
    if (interaction.channel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: "❌ Bitte einen normalen Textkanal verwenden.", flags: MessageFlags.Ephemeral });
    }
    const state = countingData[interaction.guildId] || (countingData[interaction.guildId] = { channelId: null, number: "0", lastUserId: null, scores: {} });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Vorherige Leaderboard-Nachrichten werden im alten Kanal nicht automatisch gelöscht.
    if (state.leaderboardChannelId !== interaction.channelId) state.leaderboardMessageIds = [];
    state.leaderboardChannelId = interaction.channelId;
    saveCounting();
    try {
        await updateCountingLeaderboard(interaction.guildId);
        return interaction.editReply("✅ Das Live-Leaderboard wurde in diesem Kanal eingerichtet.");
    } catch (error) {
        console.error("Leaderboard-Fehler:", error);
        return interaction.editReply("❌ Leaderboard konnte nicht erstellt werden. Prüfe die Bot-Berechtigungen.");
    }
}

const countingCommand = {
    name: "counting",
    description: "Counting-Kanal verwalten",
    options: [
        { type: 1, name: "start", description: "Counting in diesem Kanal starten" },
        { type: 1, name: "stop", description: "Counting deaktivieren" },
        { type: 1, name: "status", description: "Aktuellen Zählerstand anzeigen" }
    ]
};

// Nachrichten werden pro Kanal nacheinander verarbeitet.
const countingQueues = new Map();
client.on("messageCreate", message => {
    if (!message.guild || message.author.bot) return;
    const state = countingData[message.guild.id];
    if (!state || state.channelId !== message.channel.id) return;

    const previous = countingQueues.get(message.channel.id) || Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
        const current = countingData[message.guild.id];
        if (!current || current.channelId !== message.channel.id) return;
        const content = message.content.trim();
        if (!/^\d+$/.test(content)) return;

        const expected = BigInt(current.number || "0") + 1n;
        const validNumber = BigInt(content) === expected;
        const samePerson = current.lastUserId === message.author.id;
        if (validNumber && !samePerson) {
            current.number = expected.toString();
            current.lastUserId = message.author.id;
            current.scores ||= {};
            current.scores[message.author.id] = (current.scores[message.author.id] || 0) + countingPoints(expected);
            saveCounting();
            await updateCountingLeaderboard(message.guild.id).catch(error => console.error("Leaderboard-Update:", error));
            await message.react("✅").catch(() => {});
            return;
        }

        // Jeder falsche Zahleneintrag setzt die Runde zurück.
        current.number = "0";
        current.lastUserId = null;
        saveCounting();
        await message.react("❌").catch(() => {});
        await message.channel.send({
            content: samePerson
                ? `❌ ${message.author}, du hast zweimal hintereinander gezählt!\n🔄 **Neustart:** Beginnt wieder mit **1**. Danach muss eine andere Person die **2** schreiben.`
                : `❌ ${message.author}, falsche Zahl! Erwartet wurde **${expected.toString()}**.\n🔄 Wir beginnen wieder bei **1**.`,
            allowedMentions: { users: [message.author.id] }
        });
    });
    countingQueues.set(message.channel.id, next);
    void next.finally(() => {
        if (countingQueues.get(message.channel.id) === next) countingQueues.delete(message.channel.id);
    }).catch(error => console.error("Counting-Fehler:", error));
});

async function handleCountingCommand(interaction) {
    const sub = interaction.options.getSubcommand();
    const state = countingData[interaction.guildId];
    if (sub === "status") {
        return interaction.reply({
            content: state?.channelId
                ? `🔢 Counting läuft in <#${state.channelId}>. Letzte Zahl: **${state.number}**. Nächste Zahl: **${(BigInt(state.number) + 1n).toString()}**.`
                : "ℹ️ Counting ist noch nicht aktiviert.",
            flags: MessageFlags.Ephemeral
        });
    }
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "❌ Du benötigst die Berechtigung **Server verwalten**.", flags: MessageFlags.Ephemeral });
    }
    if (sub === "stop") {
        if (!state?.channelId) return interaction.reply({ content: "ℹ️ Counting ist nicht aktiv.", flags: MessageFlags.Ephemeral });
        // Punkte und Leaderboard beim Stoppen behalten.
        state.channelId = null;
        state.number = "0";
        state.lastUserId = null;
        saveCounting();
        return interaction.reply({ content: "🛑 Counting wurde deaktiviert." });
    }
    if (sub === "start") {
        if (interaction.channel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: "❌ Bitte in einem normalen Textkanal starten.", flags: MessageFlags.Ephemeral });
        }
        countingData[interaction.guildId] = {
            ...(state || {}),
            channelId: interaction.channelId,
            number: "0",
            lastUserId: null,
            scores: state?.scores || {}
        };
        saveCounting();
        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x0893F3)
                .setTitle("🔢 𝐕𝐄𝐗𝐎 𝐂𝐎𝐔𝐍𝐓𝐈𝐍𝐆")
                .setDescription("Das Counting ist gestartet!\n\n✅ Zählt **1, 2, 3 ...** so weit ihr könnt.\n🚫 Niemand darf zweimal hintereinander zählen.\n❌ Bei einem Fehler beginnt alles wieder bei **1**.\n\n**Los geht's: Schreibt die 1!**")]
        });
    }
}

// =====================================================
// 🎧 SUPPORT-PING LEADERBOARD (persistente Statistik)
// Support-System ruft global.recordSupportPingTakeover(guildId, userId, pingId)
// NUR nach einer erfolgreich übernommenen Support-Anfrage auf.
// =====================================================
const SUPPORT_PING_STATS_FILE = path.join(__dirname, "support-ping-statistics.json");
function readSupportPingStats() {
    try {
        return JSON.parse(fs.readFileSync(SUPPORT_PING_STATS_FILE, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") console.error("Support-Statistik konnte nicht geladen werden:", error);
        return { guilds: {} };
    }
}
const SUPPORT_PING_STATS = readSupportPingStats();
SUPPORT_PING_STATS.guilds ||= {};
function saveSupportPingStats() {
    const tempFile = SUPPORT_PING_STATS_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(SUPPORT_PING_STATS, null, 2), "utf8");
    fs.renameSync(tempFile, SUPPORT_PING_STATS_FILE);
}
function recordSupportPingTakeover(guildId, userId, pingId) {
    if (!guildId || !userId || !pingId) return false;
    const guildStats = SUPPORT_PING_STATS.guilds[guildId] ||= { counts: {}, recordedPings: {} };
    if (guildStats.recordedPings[pingId]) return false;
    guildStats.recordedPings[pingId] = userId;
    guildStats.counts[userId] = (guildStats.counts[userId] || 0) + 1;
    saveSupportPingStats();
    return true;
}
global.recordSupportPingTakeover = recordSupportPingTakeover;
const supportLeaderboardCommand = {
    name: "support-leaderboard",
    description: "Zeigt, wer wie viele Support-Pings übernommen hat"
};
async function handleSupportLeaderboard(interaction) {
    const guildStats = SUPPORT_PING_STATS.guilds[interaction.guildId];
    const entries = Object.entries(guildStats?.counts || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 20);
    if (!entries.length) {
        return interaction.reply({
            content: "📊 Noch keine übernommenen Support-Pings erfasst. Die Zählung muss mit dem Support-System verbunden werden.",
            flags: MessageFlags.Ephemeral
        });
    }
    await interaction.deferReply();
    const lines = await Promise.all(entries.map(async ([id, count], i) => {
        const user = await client.users.fetch(id).catch(() => null);
        const name = (user?.username || id).replace(/[`*_|~]/g, "");
        return `**${i + 1}.** ${name} — **${count}** übernommene Support-Pings`;
    }));
    return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(0x2787ff)
        .setTitle("🎧 Vexo RP | Support-Leaderboard")
        .setDescription(lines.join("\n"))
        .setTimestamp()] });
}

const processedInteractions = new Set();

client.on(
    "interactionCreate",
    async interaction => {

        try {

            if (await handleAktivCheckCommand(interaction)) return;
            if (interaction.isChatInputCommand() && interaction.commandName === "support-leaderboard") {
                return await handleSupportLeaderboard(interaction);
            }

            if (interaction.isChatInputCommand() && interaction.commandName === "akinator") {
                return await handleAkinatorSetup(interaction);
            }
            if (interaction.isButton() && interaction.customId.startsWith("vexo_akinator:")) {
                return await handleAkinatorButton(interaction);
            }
            if (interaction.isChatInputCommand() && interaction.commandName === "leaderboard") {
                return await handleLeaderboardCommand(interaction);
            }
            if (interaction.isChatInputCommand() && interaction.commandName === "counting") {
                return await handleCountingCommand(interaction);
            }

            // Roblox-Commands werden vom Roblox-Modul selbst mit ManageGuild geprüft.
            if (interaction.isChatInputCommand() && robloxCommands.some(command => command.name === interaction.commandName)) {
                return;
            }

            // Permission-Check für Slash-Commands (nur autorisierte Rollen)
            if (interaction.isChatInputCommand()) {
                const member = interaction.member;
                if (!hasSlashCommandPermission(member)) {
                    return interaction.reply({
                        content: "❌ Nur autorisierte Rollen dürfen Slash-Commands verwenden.",
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

           
            // =====================================================
            // 🚀 VEXO RP | RP-START
            // =====================================================

            if (interaction.isButton() && interaction.customId === "rp_start") {
                if (!hasSlashCommandPermission(interaction.member)) {
                    return interaction.reply({
                        content: "❌ Nur autorisierte Rollen dürfen RP starten.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                rpStatus.isRunning = true;
                rpStatus.startTime = Date.now();
                saveRPStatus();

                // Neue RP-Start-Ankündigung mit Embed und Rollen-Ping
                const rpAnnouncementSent = await updateRPStatus(
                    interaction.guild,
                    "start"
                );

                if (!rpAnnouncementSent) {
                    console.error(
                        "❌ RP-Start-Ankündigung konnte nicht gesendet werden."
                    );
                }

                // RP-Status-Panel aktualisieren
                const embed = new EmbedBuilder()
                    .setColor(0x22C55E)
                    .setTitle("🎮 VEXO RP V1 | RP-STATUS")
                    .setDescription(
                        "🟢 **ROLEPLAY IST GEÖFFNET**\n\n" +
                        `🕒 **Startzeit:** <t:${Math.floor(rpStatus.startTime / 1000)}:F>\n` +
                        `⏳ **Laufzeit:** ${formatUptime(rpStatus.startTime)}\n\n` +
                        "🌆 Die Stadt ist jetzt für alle Bürger geöffnet."
                    )
                    .setFooter({ text: "Vexo RP V1 • Roleplay-Verwaltung" })
                    .setTimestamp();

                const startButton = new ButtonBuilder()
                    .setCustomId("rp_start")
                    .setLabel("▶️ RP Starten")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true);

                const stopButton = new ButtonBuilder()
                    .setCustomId("rp_stop")
                    .setLabel("⏹️ RP Stoppen")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(false);

                const row = new ActionRowBuilder()
                    .addComponents(startButton, stopButton);

                await interaction.update({
                    embeds: [embed],
                    components: [row]
                });

                console.log("✅ RP gestartet.");
                return;
            }

            // =====================================================
            // 🌙 VEXO RP | RP-STOP
            // =====================================================

            if (interaction.isButton() && interaction.customId === "rp_stop") {
                if (!hasSlashCommandPermission(interaction.member)) {
                    return interaction.reply({
                        content: "❌ Nur autorisierte Rollen dürfen RP stoppen.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                rpStatus.isRunning = false;
                rpStatus.startTime = null;
                saveRPStatus();

                // Neue RP-Stop-Ankündigung mit Embed und Rollen-Ping
                const rpStopAnnouncementSent = await updateRPStatus(
                    interaction.guild,
                    "stop"
                );

                if (!rpStopAnnouncementSent) {
                    console.error(
                        "❌ RP-Stop-Ankündigung konnte nicht gesendet werden."
                    );
                }

                // RP-Status-Panel aktualisieren
                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setTitle("🎮 VEXO RP V1 | RP-STATUS")
                    .setDescription(
                        "🔴 **ROLEPLAY IST GESCHLOSSEN**\n\n" +
                        "🌙 Der heutige RP-Betrieb wurde offiziell beendet.\n" +
                        "🛑 Bitte startet keine neuen RP-Situationen.\n\n" +
                        "💙 Vielen Dank an unsere Community!"
                    )
                    .setFooter({ text: "Vexo RP V1 • Roleplay-Verwaltung" })
                    .setTimestamp();

                const startButton = new ButtonBuilder()
                    .setCustomId("rp_start")
                    .setLabel("▶️ RP Starten")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(false);

                const stopButton = new ButtonBuilder()
                    .setCustomId("rp_stop")
                    .setLabel("⏹️ RP Stoppen")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true);

                const row = new ActionRowBuilder()
                    .addComponents(startButton, stopButton);

                await interaction.update({
                    embeds: [embed],
                    components: [row]
                });

                console.log("✅ RP gestoppt.");
                return;
            }

            if (
                (interaction.isButton() || interaction.isModalSubmit()) &&
                interaction.customId?.startsWith("rp_edit_")
            ) {
                if (!hasSlashCommandPermission(interaction)) {
                    return interaction.reply({
                        content: "❌ Nur autorisierte Rollen dürfen das RP-Panel bearbeiten.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    content: "ℹ️ Die Bearbeitung von RP-Texten ist deaktiviert.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (
                interaction.isModalSubmit() &&
                interaction.customId === "server_codes_modal"
            ) {
                if (!hasSlashCommandPermission(interaction)) {
                    return interaction.reply({
                        content: "❌ Nur autorisierte Rollen dürfen die Server-Codes ändern.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                try {
                    const server1Code = interaction.fields.getTextInputValue("server_1_code").trim();
                    const server2Code = interaction.fields.getTextInputValue("server_2_code").trim();
                    if (!server1Code || !server2Code) {
                        return interaction.editReply({
                            content: "❌ Bitte trage beide Server-Codes ein."
                        });
                    }

                    const channel = await client.channels.fetch(SERVER_CODES_CHANNEL_ID);
                    if (
                        !channel?.isTextBased() ||
                        channel.guildId !== interaction.guildId
                    ) {
                        return interaction.editReply({
                            content: "❌ Der konfigurierte Server-Codes-Kanal ist nicht verfügbar oder gehört zu einem anderen Server."
                        });
                    }

                    const formatCode = code =>
                        `\`\`\`\n${code.replace(/```/g, "ˋˋˋ")}\n\`\`\``;
                    const displayName =
                        interaction.member?.displayName ||
                        interaction.user.globalName ||
                        interaction.user.username;
                    const embed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle("🔑 SERVER-CODES")
                        .setDescription(
                            "📺 **Server 1**\n" +
                            `${formatCode(server1Code)}\n` +
                            "📺 **Server 2**\n" +
                            formatCode(server2Code) +
                            "\n\n" +
                            "📌 **So kopierst du den Code:**\n" +
                            "• Fahre mit der Maus über den Code\n" +
                            "• Klicke auf das Kopier-Symbol 📋\n" +
                            "• Füge den Code im Spiel ein"
                        )
                        .setFooter({ text: `Zuletzt geändert von ${displayName}` })
                        .setTimestamp();

                    const savedMessageId = loadServerCodesMessageId();
                    let codesMessage = null;
                    if (savedMessageId) {
                        try {
                            codesMessage = await channel.messages.fetch(savedMessageId);
                        } catch (error) {
                            if (error.code !== 10008) {
                                throw error;
                            }
                        }
                    }

                    if (codesMessage) {
                        await codesMessage.edit({ embeds: [embed], content: "" });
                    } else {
                        codesMessage = await channel.send({ embeds: [embed] });
                        saveServerCodesMessageId(codesMessage.id);
                    }

                    console.log(`✅ Server-Codes aktualisiert von ${interaction.user.tag}.`);
                    return interaction.editReply({
                        content: "✅ Die Server-Codes wurden aktualisiert."
                    });
                } catch (error) {
                    console.error("❌ Fehler beim Aktualisieren der Server-Codes:", error);
                    return interaction.editReply({
                        content: "❌ Die Server-Codes konnten nicht aktualisiert werden. Prüfe die Bot-Berechtigungen im Codes-Kanal."
                    });
                }
            }

            // =====================================================
            // SLASH COMMANDS
            // =====================================================
            if (interaction.isChatInputCommand()) {
                if (!hasSlashCommandPermission(interaction)) {
                    interaction.__slashCommandPermissionDenied = true;
                    return interaction.reply({
                        content: "❌ Slash-Commands können nur autorisierte Rollen verwenden.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const commandName = interaction.commandName;
                console.log(`📝 Slash-Command ausgeführt: /${commandName}`);

                // /codes
                if (commandName === "codes") {
                    const modal = new ModalBuilder()
                        .setCustomId("server_codes_modal")
                        .setTitle("🔑 Server-Codes bearbeiten")
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId("server_1_code")
                                    .setLabel("Server 1 – Code")
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true)
                                    .setMaxLength(100)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId("server_2_code")
                                    .setLabel("Server 2 – Code")
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true)
                                    .setMaxLength(100)
                            )
                        );
                    return interaction.showModal(modal);
                }

                // /rppanel
                if (commandName === "rppanel") {
                    try {
                        const embed = new EmbedBuilder()
                            .setColor(rpStatus.isRunning ? 0x00FF00 : 0xFF0000)
                            .setTitle("🎮 RP STATUS PANEL")
                            .setDescription(
                                rpStatus.isRunning
                                    ? "🟢 **RP läuft**\n\n" +
                                      `⏱️ Startzeit: ${rpStatus.startTime ? new Date(rpStatus.startTime).toLocaleString('de-DE') : 'Unbekannt'}\n` +
                                      `⏳ Laufzeit: ${rpStatus.startTime ? formatUptime(rpStatus.startTime) : 'Unbekannt'}`
                                    : "🔴 **RP gestoppt**\n\n" +
                                      "⏹️ RP ist derzeit nicht aktiv."
                            )
                            .setFooter({ text: "Wexo-RP" })
                            .setTimestamp();

                        const startButton = new ButtonBuilder()
                            .setCustomId("rp_start")
                            .setLabel("▶️ RP Starten")
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(rpStatus.isRunning);

                        const stopButton = new ButtonBuilder()
                            .setCustomId("rp_stop")
                            .setLabel("⏹️ RP Stopen")
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(!rpStatus.isRunning);

                        const row = new ActionRowBuilder()
                            .addComponents(startButton, stopButton);

                        await interaction.reply({ embeds: [embed], components: [row] });

                        // Speichere die Message-ID für Updates
                        const message = await interaction.fetchReply();
                        rpStatus.channelId = message.channelId;
                        rpStatus.messageId = message.id;
                        saveRPStatus();

                        console.log("✅ /rppanel ausgeführt.");
                    } catch (error) {
                        console.error("❌ Fehler beim Ausführen von /rppanel:", error);
                        return interaction.reply({
                            content: "❌ Das RP-Panel konnte nicht erstellt werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                // /nimm-rolle
                if (commandName === "nimm-rolle") {
                    try {
                        const role = interaction.options.getRole("rolle");
                        const guild = interaction.guild;

                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                        const members = await guild.members.fetch();
                        let count = 0;

                        for (const member of members.values()) {
                            if (member.roles.cache.has(role.id)) {
                                try {
                                    await member.roles.remove(role);
                                    count++;
                                } catch (err) {
                                    console.error(`❌ Fehler beim Entfernen der Rolle von ${member.user.tag}:`, err.message);
                                }
                            }
                        }

                        await interaction.editReply({
                            content: `✅ Die Rolle **${role.name}** wurde von **${count} Mitgliedern** entfernt.`
                        });

                    } catch (error) {
                        console.error("❌ Fehler bei /nimm-rolle:", error);
                        await interaction.editReply({ content: "❌ Ein Fehler ist aufgetreten." });
                    }
                }

                // /gib-rolle
                // Mit Benutzer-Option: Rolle an diesen Benutzer. Ohne: an alle Mitglieder (Gegenstück zu /nimm-rolle).
                if (commandName === "gib-rolle") {
                    try {
                        const role = interaction.options.getRole("rolle");
                        const guild = interaction.guild;

                        if (!guild || !role) {
                            return interaction.reply({
                                content: "❌ Bitte wähle eine Rolle auf einem Server.",
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        const botTop = guild.members.me?.roles?.highest;
                        if (role.managed || role.id === guild.id || (botTop && role.position >= botTop.position)) {
                            return interaction.reply({
                                content: "❌ Diese Rolle kann ich nicht vergeben (zu hoch in der Rollenliste, verwaltet oder @everyone). Ziehe die Bot-Rolle in den Servereinstellungen über diese Rolle.",
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                        const userOption = interaction.options.data.find(option => option.type === 6);

                        if (userOption) {
                            const target = await guild.members.fetch(userOption.value).catch(() => null);
                            if (!target) {
                                return interaction.editReply({ content: "❌ Dieser Benutzer ist nicht auf dem Server." });
                            }

                            await target.roles.add(role);
                            return interaction.editReply({
                                content: `✅ Die Rolle **${role.name}** wurde an ${target} vergeben.`
                            });
                        }

                        const members = await guild.members.fetch();
                        let count = 0;
                        let failed = 0;

                        for (const member of members.values()) {
                            if (member.user.bot || member.roles.cache.has(role.id)) continue;
                            try {
                                await member.roles.add(role);
                                count++;
                            } catch (err) {
                                failed++;
                                console.error(`❌ Fehler beim Vergeben der Rolle an ${member.user.tag}:`, err.message);
                            }
                        }

                        await interaction.editReply({
                            content: `✅ Die Rolle **${role.name}** wurde an **${count} Mitglieder** vergeben.` +
                                (failed ? ` (${failed} fehlgeschlagen)` : "")
                        });

                    } catch (error) {
                        console.error("❌ Fehler bei /gib-rolle:", error);
                        const msg = { content: "❌ Ein Fehler ist aufgetreten." };
                        if (interaction.deferred || interaction.replied) {
                            await interaction.editReply(msg).catch(() => {});
                        } else {
                            await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral }).catch(() => {});
                        }
                    }
                    return;
                }

                // /clear
                if (commandName === "clear") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                        return interaction.reply({ content: "❌ Du hast keine Berechtigung, Nachrichten zu löschen.", flags: MessageFlags.Ephemeral });
                    }

                    const amount = interaction.options.getInteger("anzahl");
                    try {
                        await interaction.channel.bulkDelete(amount, true);
                        return interaction.reply({ content: `✅ **${amount} Nachrichten** wurden gelöscht.`, flags: MessageFlags.Ephemeral });
                    } catch (error) {
                        console.error("❌ Fehler bei /clear:", error);
                        return interaction.reply({ content: "❌ Nachrichten konnten nicht gelöscht werden. (Nachrichten, die älter als 14 Tage sind, können nicht gelöscht werden)", flags: MessageFlags.Ephemeral });
                    }
                }

                // /userinfo
                if (commandName === "userinfo") {
                    const target = interaction.options.getUser("nutzer") || interaction.user;
                    const member = await interaction.guild.members.fetch(target.id);

                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(`👤 Nutzerinformationen für ${target.tag}`)
                        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: "🆔 ID", value: target.id, inline: true },
                            { name: "📅 Beigetreten am", value: member.joinedAt.toLocaleDateString("de-DE"), inline: true },
                            { name: "🚀 Account erstellt", value: target.createdAt.toLocaleDateString("de-DE"), inline: true },
                            { name: "🎭 Rollen", value: member.roles.cache.map(r => r.name).join(", ") || "Keine" }
                        )
                        .setFooter({ text: "NeoCity • Utility" })
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed] });
                }

                // /serverinfo
                if (commandName === "serverinfo") {
                    const { guild } = interaction;
                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(`🏰 Serverinformationen: ${guild.name}`)
                        .setThumbnail(guild.iconURL({ dynamic: true }))
                        .addFields(
                            { name: "🆔 ID", value: guild.id, inline: true },
                            { name: "👑 Inhaber", value: `<@${guild.ownerId}>`, inline: true },
                            { name: "👥 Mitglieder", value: `${guild.memberCount}`, inline: true },
                            { name: "🌍 Region", value: guild.preferredLocale, inline: true },
                            { name: "📅 Erstellt am", value: guild.createdAt.toLocaleDateString("de-DE"), inline: true },
                            { name: "🛡️ Verifizierungslevel", value: `${guild.verificationLevel}`, inline: true }
                        )
                        .setFooter({ text: "NeoCity • Utility" })
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed] });
                }

                // /kick
                if (commandName === "kick") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                        return interaction.reply({ content: "❌ Du hast keine Berechtigung, Mitglieder zu kicken.", flags: MessageFlags.Ephemeral });
                    }

                    const target = interaction.options.getMember("nutzer");
                    const reason = interaction.options.getString("grund") || "Kein Grund angegeben";

                    if (!target.kickable) {
                        return interaction.reply({ content: "❌ Dieses Mitglied kann nicht gekickt werden.", flags: MessageFlags.Ephemeral });
                    }

                    try {
                        await target.kick(reason);
                        return interaction.reply({ content: `✅ **${target.user.tag}** wurde gekickt. Grund: ${reason}` });
                    } catch (error) {
                        console.error("❌ Fehler bei /kick:", error);
                        return interaction.reply({ content: "❌ Fehler beim Kicken des Mitglieds.", flags: MessageFlags.Ephemeral });
                    }
                }

                // /ban
                if (commandName === "ban") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                        return interaction.reply({ content: "❌ Du hast keine Berechtigung, Mitglieder zu bannen.", flags: MessageFlags.Ephemeral });
                    }

                    const target = interaction.options.getMember("nutzer");
                    const reason = interaction.options.getString("grund") || "Kein Grund angegeben";

                    if (!target.bannable) {
                        return interaction.reply({ content: "❌ Dieses Mitglied kann nicht gebannt werden.", flags: MessageFlags.Ephemeral });
                    }

                    try {
                        await target.ban({ reason });
                        return interaction.reply({ content: `✅ **${target.user.tag}** wurde gebannt. Grund: ${reason}` });
                    } catch (error) {
                        console.error("❌ Fehler bei /ban:", error);
                        return interaction.reply({ content: "❌ Fehler beim Bannen des Mitglieds.", flags: MessageFlags.Ephemeral });
                    }
                }

                // /rollen
                if (commandName === "rollen") {
                    if (!isBotOwner(interaction.member)) {
                        return interaction.reply({ content: "❌ Dieser Befehl kann nur vom Bot-Owner verwendet werden.", flags: MessageFlags.Ephemeral });
                    }

                    try {
                        const guildId = interaction.options.getString("server") || interaction.guild.id;
                        const guild = await client.guilds.fetch(guildId).catch(() => null);

                        if (!guild) {
                            return interaction.reply({ content: `❌ Server mit ID ${guildId} nicht gefunden.`, flags: MessageFlags.Ephemeral });
                        }

                        const roles = await guild.roles.fetch();
                        const roleList = roles
                            .filter(role => role.name !== "@everyone")
                            .sort((a, b) => b.position - a.position)
                            .map(role => `\`${role.id}\` - ${role.name}`)
                            .join("\n");

                        const maxLength = 1900;
                        if (roleList.length <= maxLength) {
                            await interaction.reply(
                                `📋 **Alle Rollen auf ${guild.name}**\n\n${roleList}`
                            );
                        } else {
                            await interaction.reply({ content: "📋 Die Rollenliste ist zu lang, wird in mehrere Nachrichten aufgeteilt...", flags: MessageFlags.Ephemeral });
                            const chunks = [];
                            let currentChunk = "📋 **Alle Rollen auf " + guild.name + "**\n\n";
                            const lines = roleList.split("\n");

                            for (const line of lines) {
                                if (currentChunk.length + line.length > maxLength) {
                                    chunks.push(currentChunk);
                                    currentChunk = line;
                                } else {
                                    currentChunk += "\n" + line;
                                }
                            }
                            chunks.push(currentChunk);

                            for (const chunk of chunks) {
                                await interaction.followUp(chunk);
                            }
                        }

                        console.log(`✅ /rollen für Server ${guildId} ausgeführt.`);
                    } catch (error) {
                        console.error("❌ Fehler bei /rollen:", error);
                        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // /bot-status
                if (commandName === "bot-status") {
                    if (!isBotOwner(interaction.member)) {
                        return interaction.reply({ content: "❌ Dieser Befehl kann nur vom Bot-Owner verwendet werden.", flags: MessageFlags.Ephemeral });
                    }

                    try {
                        const { handleBotStatusCommand } = require("./Bot-Status-System/Bot-Status-System");
                        await handleBotStatusCommand(interaction, client);
                    } catch (error) {
                        console.error("❌ Fehler bei /bot-status:", error);
                        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // /selbstzerstörung
                if (commandName === "selbstzerstörung") {
                    try {
                        const selfDestructMember = interaction.member;
                        if (!selfDestructMember) {
                            return interaction.reply({ content: "❌ Du musst dich auf einem Server befinden.", flags: MessageFlags.Ephemeral });
                        }

                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        const result = await executeSelfDestruction(selfDestructMember, interaction.channel);
                        if (result.ok) {
                            await interaction.editReply({ content: "✅ Selbstzerstörung eingeleitet!" });
                        } else {
                            let errorMessage = "❌ Selbstzerstörung konnte nicht eingeleitet werden.";
                            if (result.reason === "in_progress") {
                                errorMessage = "⚠️ Eine Selbstzerstörung läuft bereits für diesen Benutzer.";
                            } else if (result.reason === "no_roles") {
                                errorMessage = "⚠️ Du hast keine Rollen, die entfernt werden könnten.";
                            }
                            await interaction.editReply({ content: errorMessage });
                        }
                    } catch (error) {
                        console.error("❌ Fehler bei /selbstzerstörung:", error);
                        if (interaction.deferred || interaction.replied) {
                            await interaction.editReply({ content: "❌ Ein Fehler ist aufgetreten." });
                        } else {
                            await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
                        }
                    }
                    return;
                }

                // /selbstzerstörung-panel
                if (commandName === "selbstzerstörung-panel") {
                    if (!isBotOwner(interaction.member)) {
                        return interaction.reply({ content: "❌ Dieser Befehl kann nur vom Bot-Owner verwendet werden.", flags: MessageFlags.Ephemeral });
                    }

                    try {
                        const panelMessage = await interaction.channel.send(
                            buildSelfDestructStartPanel()
                        );

                        setSelfDestructPanelState(
                            panelMessage.id,
                            {
                                mode: "start",
                                query: null,
                                page: 0,
                                selectedUserId: null
                            }
                        );

                        await interaction.reply({ content: "✅ Selbstzerstörungs-Panel erstellt.", flags: MessageFlags.Ephemeral });
                    } catch (error) {
                        console.error("❌ Fehler bei /selbstzerstörung-panel:", error);
                        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // /entferne-verifiziere
                if (commandName === "entferne-verifiziere") {
                    if (!hasProtectedCommandPermission(interaction.member)) {
                        return interaction.reply({ content: errorMessage("Du hast keine Berechtigung, diesen Befehl zu verwenden."), flags: MessageFlags.Ephemeral });
                    }

                    try {
                        const roleId = interaction.options.getString("rolle");
                        const guild = interaction.guild;

                        const role = await guild.roles.fetch(roleId).catch(() => null);
                        if (!role) {
                            return interaction.reply({ content: errorMessage(`Die Rolle mit der ID ${roleId} wurde nicht gefunden.`), flags: MessageFlags.Ephemeral });
                        }

                        const statusMessage = await interaction.reply({ content: "⏳ Lade alle Mitglieder und entferne die Verifizierungsrolle...", fetchReply: true });

                        let members;
                        try {
                            members = await guild.members.fetch();
                        } catch (error) {
                            await interaction.editReply({ content: errorMessage("Konnte die Mitgliederliste nicht laden.") });
                            return;
                        }

                        let removedCount = 0;
                        for (const member of members.values()) {
                            if (member.roles.cache.has(roleId)) {
                                try {
                                    await member.roles.remove(roleId, "Verifizierungsrolle serverweit entfernt");
                                    removedCount++;
                                } catch (error) {
                                    console.error(`❌ Konnte Rolle ${roleId} nicht von ${member.user.tag} entfernen:`, error);
                                }
                            }
                        }

                        await interaction.editReply({
                            content: `✅ Die Rolle **${role.name}** wurde von **${removedCount} Mitgliedern** entfernt.`
                        });
                    } catch (error) {
                        console.error("❌ Fehler bei /entferne-verifiziere:", error);
                        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // /teambewerbung-test: komplett ausgefüllte Testbewerbung senden
                if (commandName === "teambewerbung-test") {
                    return sendTeamApplicationTest(interaction);
                }

                // /teambewerbung
                if (commandName === "teambewerbung") {
                    return createTeamApplicationPanelForInteraction(interaction);
                }

                // /teambewerbungtext
                if (commandName === "teambewerbungtext") {
                    return createTeamApplicationPanelForInteraction(interaction, true);
                }

                if (commandName === "team-bewerbungen") {
                    if (!hasTeamPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Du hast dafür keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }

                    const guildApplications = Object.values(TEAM_APPLICATIONS.applications)
                        .filter(application => application.guildId === interaction.guildId)
                        .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
                    if (guildApplications.length === 0) {
                        return interaction.reply({ content: "📭 Es gibt keine gespeicherten Bewerbungen für diesen Server.", flags: MessageFlags.Ephemeral });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    await interaction.editReply({ content: `📋 **Alle Bewerbungen (${guildApplications.length})**` });
                    for (const [index, application] of guildApplications.entries()) {
                        const answerCount = Array.isArray(application.answers) ? application.answers.filter(Boolean).length : 0;
                        const submittedAt = application.submittedAt
                            ? formatGermanTime(new Date(application.submittedAt))
                            : "Noch nicht eingegangen";
                        const answers = TEAM_APPLICATION_QUESTIONS
                            .map((question, questionIndex) =>
                                `**${questionIndex + 1}. ${question}**\nAntwort: ${application.answers?.[questionIndex] || "Keine Antwort"}`
                            )
                            .join("\n\n");
                        const applicationText =
                            `## ${index + 1}. Bewerbung von <@${application.userId}>\n` +
                            `Status: ${getTeamApplicationStatusLabel(application.status)} | ` +
                            `Antworten: ${answerCount}/${TEAM_APPLICATION_QUESTIONS.length} | ${submittedAt}\n\n${answers}`;
                        const chunks = splitApplicationText(applicationText, 1800);

                        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
                            await interaction.followUp({
                                content: chunks[chunkIndex],
                                components: chunkIndex === chunks.length - 1
                                    ? [createApplicationManagementButtons(application.guildId, application.userId)]
                                    : [],
                                flags: MessageFlags.Ephemeral
                            });
                        }
                    }
                    return;
                }

                // /profilbild-bot
                if (commandName === "profilbild-bot") {
                    try {
                        const guild = interaction.guild;
                        const panelMessage = await interaction.channel.send(
                            createBotAvatarPanel(guild.id)
                        );

                        await interaction.reply({ content: "✅ Bot-Profilbild-Panel erstellt.", flags: MessageFlags.Ephemeral });
                    } catch (error) {
                        console.error("❌ Fehler bei /profilbild-bot:", error);
                        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // /logs
                if (commandName === "logs") {
                    if (!hasProtectedCommandPermission(interaction.member)) {
                        return interaction.reply({ content: errorMessage("Du hast keine Berechtigung, diesen Befehl zu verwenden."), flags: MessageFlags.Ephemeral });
                    }

                    const action = interaction.options.getString("aktion");
                    const selectedChannel = interaction.options.getChannel("kanal");
                    try {
                        if (!action) {
                            const helpEmbed = new EmbedBuilder()
                                .setColor(0x8B5CF6)
                                .setTitle("📊 Log-System")
                                .setDescription("Wähle eine Aktion über die Slash-Option `aktion`.")
                                .addFields(
                                    { name: "Kanal setzen", value: "`/logs aktion:Kanal setzen kanal:#kanal`" },
                                    { name: "Kanal anzeigen", value: "`/logs aktion:Aktuellen Kanal anzeigen`" },
                                    { name: "Test-Log", value: "`/logs aktion:Test-Log senden`" },
                                    { name: "Zurücksetzen", value: "`/logs aktion:Auf Standard zurücksetzen`" }
                                )
                                .setTimestamp();
                            return interaction.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
                        }

                        if (action === "set") {
                            if (!selectedChannel?.isTextBased() || selectedChannel.guildId !== interaction.guildId) {
                                return interaction.reply({
                                    content: "❌ Bitte wähle für diese Aktion einen Textkanal dieses Servers.",
                                    flags: MessageFlags.Ephemeral
                                });
                            }

                            process.env.BOT_LOG_CHANNEL_ID = selectedChannel.id;
                            await log({
                                type: "COMMAND",
                                action: "Log-Kanal geändert",
                                user: interaction.user,
                                channel: selectedChannel,
                                guild: interaction.guild,
                                details: `Log-Kanal wurde auf <#${selectedChannel.id}> gesetzt`,
                                status: "Erfolgreich"
                            });
                            return interaction.reply({
                                content: `✅ Log-Kanal wurde auf ${selectedChannel} gesetzt. Ein Test-Log wurde gesendet.`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        if (action === "channel") {
                            const channelId = process.env.BOT_LOG_CHANNEL_ID;
                            if (!channelId) {
                                return interaction.reply({
                                    content: "❌ Es ist kein Log-Kanal konfiguriert.",
                                    flags: MessageFlags.Ephemeral
                                });
                            }
                            const channel = await client.channels.fetch(channelId).catch(() => null);
                            if (!channel) {
                                return interaction.reply({
                                    content: `❌ Der konfigurierte Log-Kanal (${channelId}) konnte nicht gefunden werden.`,
                                    flags: MessageFlags.Ephemeral
                                });
                            }
                            return interaction.reply({
                                content: `📊 Aktueller Log-Kanal: <#${channelId}> (${channel.name})`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        if (action === "test") {
                            await log({
                                type: "COMMAND",
                                action: "Log-Test",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: "Test-Log über den Slash-Befehl",
                                status: "Erfolgreich"
                            });
                            return interaction.reply({
                                content: "✅ Test-Log wurde gesendet.",
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        if (action === "reset") {
                            const defaultChannelId = "1546543785322872885";
                            process.env.BOT_LOG_CHANNEL_ID = defaultChannelId;
                            await log({
                                type: "COMMAND",
                                action: "Log-Kanal zurückgesetzt",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: `Log-Kanal wurde auf ${defaultChannelId} zurückgesetzt`,
                                status: "Erfolgreich"
                            });
                            return interaction.reply({
                                content: `✅ Log-Kanal wurde auf <#${defaultChannelId}> zurückgesetzt.`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        return interaction.reply({
                            content: "❌ Unbekannte Log-Aktion.",
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (error) {
                        console.error("❌ Fehler bei /logs:", error);
                        const payload = {
                            content: `❌ Die Log-Aktion ist fehlgeschlagen: ${error.message}`,
                            flags: MessageFlags.Ephemeral
                        };
                        if (interaction.deferred || interaction.replied) {
                            await interaction.followUp(payload);
                        } else {
                            await interaction.reply(payload);
                        }
                    }
                    return;
                }

                // /häuser-panel
                if (commandName === "häuser-panel") {
                    if (!hasHousesPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Du hast dafür keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }

                    try {
                        const houseClientNumber = getHouseClientNumber(interaction.guild);
                        if (!houseClientNumber) {
                            return interaction.reply({ content: "❌ Dieser Server ist für das Häuser-System nicht eingerichtet.", flags: MessageFlags.Ephemeral });
                        }

                        const houseList = houseClientNumber === 2 ? HOUSE_LIST_2 : HOUSE_LIST_1;

                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                        const panelMessage = await interaction.channel.send(
                            createHousesPanelPayload(houseList, houseClientNumber)
                        );

                        const panelFile = houseClientNumber === 2 ? HOUSES_PANEL_FILE_2 : HOUSES_PANEL_FILE_1;
                        fs.writeFileSync(panelFile, JSON.stringify({
                            channelId: panelMessage.channel.id,
                            messageId: panelMessage.id
                        }, null, 2));

                        console.log(`✅ Häuserpanel für Client ${houseClientNumber} gespeichert.`);

                        await interaction.editReply({ content: "✅ Häuser-Panel wurde erstellt." });
                    } catch (error) {
                        console.error("❌ Fehler bei /häuser-panel:", error);
                        await interaction.reply({ content: "❌ Das Häuserpanel konnte nicht erstellt werden.", flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                if (commandName === "häuserliste") {
                    if (!hasHousesPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast dafür keine Berechtigung.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    try {
                        await sendOrUpdateHousesList(interaction.channel);
                        return interaction.reply({
                            content: "✅ Die Häuserliste wurde aktualisiert.",
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (error) {
                        console.error("❌ Fehler bei /häuserliste:", error);
                        return interaction.reply({
                            content: "❌ Die Häuserliste konnte nicht erstellt werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                if (commandName === "giveaway") {
                    if (!hasProtectedCommandPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast dafür keine Berechtigung.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    try {
                        const draft = createGiveawayDraft(interaction.guild.id, interaction.user.id);
                        const panelMessage = await interaction.channel.send(createGiveawayConfigPanel(draft));
                        setGiveawayDraft(panelMessage.id, draft);
                        return interaction.reply({
                            content: "✅ Giveaway-Einrichtungspanel erstellt.",
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (error) {
                        console.error("❌ Fehler bei /giveaway:", error);
                        return interaction.reply({
                            content: "❌ Das Giveaway-Panel konnte nicht erstellt werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                if (commandName === "team-panel") {
                    if (!hasProtectedCommandPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast dafür keine Berechtigung.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    await interaction.channel.send(createTeamPanel());
                    return interaction.reply({
                        content: "✅ Das Team-Panel wurde erstellt.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (commandName === "name-tag-set" || commandName === "nickname-aktualisieren") {
                    const canUpdateNicknames = commandName === "name-tag-set"
                        ? hasNameTagSetPermission(interaction.member)
                        : hasProtectedCommandPermission(interaction.member);
                    if (!canUpdateNicknames) {
                        return interaction.reply({
                            content: "❌ Du hast dafür keine Berechtigung.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    try {
                        const result = await updateAllNicknames(interaction.guild);
                        return interaction.editReply({
                            content: `${result.error || result.failed ? "⚠️ Nicknames wurden nicht vollständig aktualisiert." : "✅ Nicknames wurden aktualisiert."}\n\n👤 Geändert: **${result.updated}**\n⏭️ Übersprungen: **${result.skipped}**\n❌ Fehlgeschlagen: **${result.failed}**${result.error ? `\nFehler: ${result.error.message}` : ""}`
                        });
                    } catch (error) {
                        console.error(`❌ Fehler bei /${commandName}:`, error);
                        return interaction.editReply({
                            content: "❌ Die Nicknames konnten nicht aktualisiert werden."
                        });
                    }
                }

                if (commandName === "text-sende") {
                    if (!hasProtectedCommandPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast dafür keine Berechtigung.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    await interaction.channel.send(createTextSendeMainPanel());
                    return interaction.reply({
                        content: "✅ Das Nachrichten-Panel wurde erstellt.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (commandName === "verify") {
                    try {
                        const result = await getVerificationPanelEmbed(interaction.guild);
                        if (!result) {
                            return interaction.reply({
                                content: "❌ Verifizierungs-Panel konnte nicht erstellt werden.",
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        const verifyRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("verify_start")
                                .setLabel("✅ Verifizieren")
                                .setStyle(ButtonStyle.Success)
                                .setEmoji("🔐")
                        );
                        const statsRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("verify_count_verified")
                                .setLabel(`👥 Verifiziert: ${result.verifiedCount}`)
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId("verify_count_members")
                                .setLabel(`📊 Mitglieder: ${result.totalMembers}`)
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId("verify_count_security")
                                .setLabel("🛡️ Sicherheit: Aktiv")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                        const panelMessage = await interaction.channel.send({
                            embeds: [result.embed],
                            components: [verifyRow, statsRow]
                        });
                        saveVerificationPanel(panelMessage.channel.id, panelMessage.id);
                        return interaction.reply({
                            content: "✅ Verifizierungs-Panel wurde erstellt.",
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (error) {
                        console.error("❌ Fehler bei /verify:", error);
                        return interaction.reply({
                            content: "❌ Das Verifizierungs-Panel konnte nicht erstellt werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                if (commandName === "rp-nachricht") {
                    if (!hasProtectedCommandPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast dafür keine Berechtigung.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    try {
                        await interaction.channel.send(await createRPChannelPanel(interaction.guild));
                        return interaction.reply({
                            content: "✅ RP-Kanal-Panel wurde erstellt.",
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (error) {
                        console.error("❌ Fehler bei /rp-nachricht:", error);
                        return interaction.reply({
                            content: "❌ Das RP-Kanal-Panel konnte nicht erstellt werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                if (commandName === "befehle") {
                    const commandList = slashCommands
                        .map(command => `/${command.name} — ${command.description}`)
                        .join("\n");
                    const chunks = [];
                    let currentChunk = "";
                    for (const line of commandList.split("\n")) {
                        if (currentChunk && currentChunk.length + line.length + 1 > 1900) {
                            chunks.push(currentChunk);
                            currentChunk = line;
                        } else {
                            currentChunk += `${currentChunk ? "\n" : ""}${line}`;
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);

                    await interaction.reply({
                        content: chunks[0] || "Es sind keine Slash-Befehle registriert.",
                        flags: MessageFlags.Ephemeral
                    });
                    for (const chunk of chunks.slice(1)) {
                        await interaction.followUp({
                            content: chunk,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    return;
                }

                if (commandName === "neustart") {
                    if (!hasRestartPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast keine Berechtigung, den Bot neu zu starten.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    if (!saveRestartChannelId(interaction.channelId)) {
                        return interaction.reply({
                            content: "❌ Der Neustart-Kanal konnte nicht gespeichert werden. Neustart abgebrochen.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    await interaction.reply({
                        content: "🔄 Der Bot wird neu gestartet.",
                        flags: MessageFlags.Ephemeral
                    });
                    setTimeout(() => {
                        restartBotProcess();
                    }, 1000);
                    return;
                }

                if (commandName === "herunterfahren") {
                    if (interaction.user.id !== BOT_OWNER_ID) {
                        return interaction.reply({
                            content: "❌ Nur der Bot-Owner darf den Bot herunterfahren.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    await interaction.reply({
                        content: "🔴 Der Bot wird heruntergefahren.",
                        flags: MessageFlags.Ephemeral
                    });
                    await shutdownBot({ reply: async () => undefined });
                    return;
                }

                // /teampanel
                if (commandName === "teampanel") {
                    if (!hasTeamPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Du hast dafür keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }
                    try {
                        await interaction.reply(createTeamPanel());
                    } catch (error) {
                        console.error("❌ Fehler bei /teampanel:", error);
                        await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // /teamliste
                if (commandName === "teamliste") {
                    if (!hasTeamPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Du hast dafür keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }
                    try {
                        await interaction.deferReply();
                        const { embeds } = await createTeamListEmbeds(interaction.guild);
                        const teamListMessage = await interaction.editReply({ embeds });
                        setLastTeamListMessage(interaction.guild.id, teamListMessage.channel.id, teamListMessage.id);
                    } catch (error) {
                        console.error("❌ Fehler bei /teamliste:", error);
                        const errorContent = `❌ Die Teamliste konnte nicht geladen werden: ${error.message}`;
                        if (interaction.deferred || interaction.replied) {
                            await interaction.editReply({ content: errorContent, embeds: [] }).catch(editError =>
                                console.error("❌ Fehler beim Anzeigen des Teamlisten-Fehlers:", editError)
                            );
                        } else {
                            await interaction.reply({ content: errorContent, flags: MessageFlags.Ephemeral });
                        }
                    }
                    return;
                }

                if (
                    commandName === "teamliste-update-start" ||
                    commandName === "teamliste-update-stop"
                ) {
                    if (!hasTeamPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Du hast dafür keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }

                    if (commandName === "teamliste-update-start") {
                        startAutoUpdate(interaction.guild, TEAMLIST_AUTO_UPDATE_CHANNEL_ID);
                        return interaction.reply({ content: "✅ Automatisches Teamlisten-Update gestartet.", flags: MessageFlags.Ephemeral });
                    }

                    stopAutoUpdate();
                    return interaction.reply({ content: "✅ Automatisches Teamlisten-Update gestoppt.", flags: MessageFlags.Ephemeral });
                }

                if (commandName === "teamstatistik") {
                    if (!hasTeamPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Du hast dafür keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    try {
                        await interaction.guild.members.fetch();
                    } catch (error) {
                        console.error("❌ Mitglieder konnten für die Teamstatistik nicht vollständig geladen werden:", error);
                        return interaction.editReply({ content: "❌ Die Teammitglieder konnten für die Statistik nicht vollständig geladen werden." });
                    }

                    const teamRole = await interaction.guild.roles.fetch(TEAMSTATISTIK_ROLE_ID).catch(() => null);
                    if (!teamRole) {
                        return interaction.editReply({ content: "❌ Die konfigurierte Teammitglieder-Rolle wurde auf diesem Server nicht gefunden." });
                    }

                    const teamMembers = interaction.guild.members.cache
                        .filter(member => member.roles.cache.has(TEAMSTATISTIK_ROLE_ID))
                        .sort((a, b) => a.user.tag.localeCompare(b.user.tag));
                    const statsEmbed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle("📊 Team-Statistik")
                        .setDescription(`👥 **Teammitglieder:** ${teamMembers.size} (Rolle: ${teamRole})`)
                        .setFooter({ text: teamLogFooterText() })
                        .setTimestamp();
                    const statsComponents = [];

                    if (teamMembers.size > 0) {
                        const memberOptions = teamMembers.first(25).map(member =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(member.user.tag.slice(0, 100))
                                .setDescription(`ID: ${member.id}`)
                                .setValue(member.id)
                        );
                        if (teamMembers.size > 25) {
                            statsEmbed.addFields({
                                name: "ℹ️ Hinweis",
                                value: `Das Auswahlmenü zeigt die ersten 25 von ${teamMembers.size} Teammitgliedern (alphabetisch).`,
                                inline: false
                            });
                        }
                        statsComponents.push(
                            new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId("teamstatistik_select")
                                    .setPlaceholder("👤 Teammitglied auswählen")
                                    .addOptions(memberOptions)
                            )
                        );
                    }

                    return interaction.editReply({ embeds: [statsEmbed], components: statsComponents });
                }

                // /gang-panel
                if (commandName === "gang-panel") {
                    return;
                }

                // /gang-liste
                if (commandName === "gang-liste") {
                    return;
                }

                // /vorschläge
                if (commandName === "vorschläge") {
                    return;
                }

                // /bürgertext
                if (commandName === "bürgertext") {
                    return;
                }

                // /dev-kanal
                if (commandName === "dev-kanal") {
                    return;
                }

                // /dev-aufgaben-panel
                if (commandName === "dev-aufgaben-panel") {
                    return;
                }

                // /dev-aufgaben
                if (commandName === "dev-aufgaben") {
                    return;
                }

                // /dev-antwort
                if (commandName === "dev-antwort") {
                    return;
                }

                // Entertainment-System Commands - werden vom Entertainment-System selbst gehandelt
                // Wir leiten diese nicht weiter, da das Entertainment-System seinen eigenen Handler hat
                const entertainmentCommands = [
                    "setups", "willkommen-panel", "film-panel", "umfrage-panel",
                    "spielkalender-panel", "highscore-panel", "spiele-vorschlaege-panel",
                    "ankuendigung-panel", "event-kalender-panel", "auto-nachrichten-panel",
                    "filmabend-panel", "bewertung-panel"
                ];

                if (entertainmentCommands.includes(commandName)) {
                    // Wird vom Entertainment-System selbst gehandelt
                    return;
                }

                // RP-Logs Commands
                const rpLogsCommands = ["rp-logs-einstellungen", "web-logs", "rp-logs-test"];

                if (rpLogsCommands.includes(commandName)) {
                    return;
                }

                // /privatnachricht
                if (commandName === "privatnachricht") {
                    return;
                }

                // /ki-chat und der bisherige /ki-chat-setup Alias
                if (commandName === "ki-chat" || commandName === "ki-chat-setup") {
                    if (!interaction.guild) {
                        return interaction.reply({
                            content: "❌ Der KI-Chat kann nur auf einem Server eingerichtet werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const channel = interaction.options.getChannel("kanal") || interaction.channel;
                    if (!channel?.isTextBased() || channel.guildId !== interaction.guild.id) {
                        return interaction.reply({
                            content: "❌ Bitte wähle einen Textkanal auf diesem Server.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const success = setKIChatChannel(interaction.guild.id, channel.id);
                    return interaction.reply({
                        content: success
                            ? `✅ ${channel} wurde als KI-Chat festgelegt. Schreibe dort eine Nachricht, damit die KI antwortet.`
                            : "❌ Der KI-Chat konnte nicht eingerichtet werden.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (musicCommandDefinitions.some(command => command.name === commandName)) {
                    return;
                }

                // /backup wird komplett von backup.js behandelt
                if (commandName === "backup") {
                    return;
                }
                // /vorlage wird komplett von Vorlagen-System.js behandelt
                if (commandName === "vorlage") {
                    return;
                }
                // =====================================================
// 🎫 VEXO RP | TICKETSYSTEM
// Der Slash-Command wird bereits in Ticket-System.js
// verarbeitet. Hier keine zweite Antwort senden.
// =====================================================

if (commandName === "ticketsystem") {
    return;
}
                console.log(`⚠️ Unbekannter Slash-Command: /${commandName}`);
                await interaction.reply({ content: "❌ Unbekannter Befehl.", flags: MessageFlags.Ephemeral });
                return;
            }

            // =====================================================
            // BESTEHENDE INTERACTION HANDLER (BUTTONS, MODALS, ETC.)
            // =====================================================

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                console.log("⚠️ Interaction bereits bestätigt:", interaction.customId);
                return;
            }

            // Zusätzliche Prüfung für Button-Interaktionen
            if (interaction.isButton()) {
                const handlerProcessed = processedInteractions.has(interaction.id);
                if (handlerProcessed) {
                    console.log("⚠️ Interaction bereits verarbeitet:", interaction.customId);
                    return;
                }
                processedInteractions.add(interaction.id);
                setTimeout(() => processedInteractions.delete(interaction.id), 3000);
            }

            // =========================================
            // LOG-SYSTEM: INTERACTION LOGGING
            // =========================================
            try {
                let actionType = "Unbekannte Interaktion";

                if (interaction.isButton()) {
                    actionType = `Button geklickt: ${interaction.customId}`;
                } else if (interaction.isAnySelectMenu()) {
                    actionType = `Select-Menü: ${interaction.customId}`;
                } else if (interaction.isModalSubmit()) {
                    actionType = `Modal abgeschickt: ${interaction.customId}`;
                } else if (interaction.isChatInputCommand()) {
                    actionType = `Slash-Command: ${interaction.commandName}`;
                }

                await logInteraction(interaction, actionType);
            } catch (error) {
                console.error("❌ Fehler beim Loggen von Interaction:", error);
            }

// =====================================================
// BOT-PROFILBILD (SERVER-SPEZIFISCH)
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId === "botavatar_pick"
) {

    if (!interaction.guild) {
        return interaction.reply(
            errorMessage(
                "Dieser Befehl funktioniert nur auf einem Server."
            )
        );
    }

    if (
        !hasProtectedCommandPermission(
            interaction.member
        )
    ) {
        return interaction.reply(
            errorMessage(
                "Du hast keine Berechtigung, das Bot-Profilbild zu ändern."
            )
        );
    }

    await interaction.reply({
        content:
            "📤 Bitte sende jetzt **innerhalb von 60 Sekunden** ein Bild (PNG, JPG, JPEG oder WEBP, max. 8 MB) " +
            "als Anhang in diesen Kanal. Es wird als Server-Profilbild des Bots für **diesen Server** gesetzt.",
        flags: MessageFlags.Ephemeral
    });

    const guildId =
        interaction.guild.id;

    const channel =
        interaction.channel;

    const collector =
        channel.createMessageCollector({
            filter: message =>
                message.author.id ===
                interaction.user.id,
            time:
                BOT_AVATAR_UPLOAD_TIMEOUT_MS,
            max: 1
        });

    collector.on(
        "collect",
        async collectedMessage => {

            try {

                const attachment =
                    collectedMessage.attachments.first();

                if (!attachment) {

                    return interaction.followUp(
                        errorMessage(
                            "❌ Es wurde keine Bilddatei erkannt. Bitte führe !profilbild-bot erneut aus."
                        )
                    );
                }

                const extension =
                    path.extname(
                        attachment.name || ""
                    ).toLowerCase();

                const contentType =
                    (
                        attachment.contentType ||
                        ""
                    ).toLowerCase();

                const isAllowedType =
                    BOT_AVATAR_ALLOWED_CONTENT_TYPES.includes(
                        contentType
                    ) ||
                    BOT_AVATAR_ALLOWED_EXTENSIONS.includes(
                        extension
                    );

                if (!isAllowedType) {

                    return interaction.followUp(
                        errorMessage(
                            "❌ Ungültiges Dateiformat. Erlaubt sind nur PNG, JPG, JPEG und WEBP."
                        )
                    );
                }

                if (
                    attachment.size >
                    BOT_AVATAR_MAX_SIZE_BYTES
                ) {

                    return interaction.followUp(
                        errorMessage(
                            `❌ Die Datei ist zu groß. Maximal erlaubt sind ${(BOT_AVATAR_MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB.`
                        )
                    );
                }

                let imageBuffer;

                try {

                    const response =
                        await fetch(
                            attachment.url
                        );

                    if (!response.ok) {

                        throw new Error(
                            `Download fehlgeschlagen (HTTP ${response.status})`
                        );
                    }

                    imageBuffer =
                        Buffer.from(
                            await response.arrayBuffer()
                        );

                } catch (downloadError) {

                    console.error(
                        "❌ Fehler beim Herunterladen des Bot-Profilbilds:",
                        downloadError
                    );

                    return interaction.followUp(
                        errorMessage(
                            "❌ Das Bild konnte nicht heruntergeladen werden. Bitte versuche es erneut."
                        )
                    );
                }

                try {

                    await interaction.guild.members.editMe({
                        avatar: imageBuffer,
                        reason:
                            `Server-Profilbild geändert von ${collectedMessage.author.tag}`
                    });

                } catch (apiError) {

                    console.error(
                        "❌ Discord API Fehler beim Setzen des Server-Profilbilds:",
                        apiError
                    );

                    if (
                        apiError?.code === 50013
                    ) {

                        return interaction.followUp(
                            errorMessage(
                                "❌ Der Bot hat nicht die benötigten Berechtigungen, um sein Profilbild auf diesem Server zu ändern."
                            )
                        );
                    }

                    return interaction.followUp(
                        errorMessage(
                            `❌ Discord API Fehler: ${apiError?.message || "Unbekannter Fehler"}`
                        )
                    );
                }

                setServerAvatarState(
                    guildId,
                    {
                        active: true,
                        setBy:
                            collectedMessage.author.id,
                        fileName:
                            attachment.name
                    }
                );

                try {

                    await collectedMessage.delete();

                } catch (_) {}

                await interaction.followUp({
                    content:
                        "✅ Das Server-Profilbild des Bots wurde erfolgreich geändert! Es gilt ausschließlich auf diesem Server.",
                    flags:
                        MessageFlags.Ephemeral
                });

                await interaction.message
                    .edit(
                        createBotAvatarPanel(
                            guildId
                        )
                    )
                    .catch(() => {});

            } catch (error) {

                console.error(
                    "❌ Fehler beim Setzen des Bot-Profilbilds:",
                    error
                );

                try {

                    await interaction.followUp(
                        errorMessage(
                            "❌ Es ist ein unerwarteter Fehler aufgetreten."
                        )
                    );

                } catch (_) {}
            }
        }
    );

    collector.on(
        "end",
        collected => {

            if (
                collected.size === 0
            ) {

                interaction
                    .followUp(
                        errorMessage(
                            "⏱️ Zeit abgelaufen. Es wurde kein Bild gesendet. Bitte führe !profilbild-bot erneut aus."
                        )
                    )
                    .catch(() => {});
            }
        }
    );

    return;
}


// =====================================================
// STANDARD-PROFILBILD VERWENDEN
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId === "botavatar_reset"
) {

    if (!interaction.guild) {
        return interaction.reply(
            errorMessage(
                "Dieser Befehl funktioniert nur auf einem Server."
            )
        );
    }

    if (
        !hasProtectedCommandPermission(
            interaction.member
        )
    ) {
        return interaction.reply(
            errorMessage(
                "Du hast keine Berechtigung, das Bot-Profilbild zu ändern."
            )
        );
    }

    // Interaction EINMALIG bestätigen.
    // Danach ausschließlich editReply() verwenden.
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    try {

        await interaction.guild.members.editMe({
            avatar: null,
            reason:
                `Server-Profilbild zurückgesetzt von ${interaction.user.tag}`
        });

    } catch (apiError) {

        console.error(
            "❌ Discord API Fehler beim Zurücksetzen des Server-Profilbilds:",
            apiError
        );

        if (
            apiError?.code === 50013
        ) {

            return interaction.editReply(
                errorMessage(
                    "❌ Der Bot hat nicht die benötigten Berechtigungen, um sein Profilbild auf diesem Server zu ändern."
                )
            );
        }

        return interaction.editReply(
            errorMessage(
                `❌ Discord API Fehler: ${apiError?.message || "Unbekannter Fehler"}`
            )
        );
    }

    setServerAvatarState(
        interaction.guild.id,
        {
            active: false,
            setBy:
                interaction.user.id
        }
    );

    await interaction.editReply({
        content:
            "✅ Das Standard-Profilbild des Bots wird auf diesem Server wieder verwendet."
    });

    await interaction.message
        .edit(
            createBotAvatarPanel(
                interaction.guild.id
            )
        )
        .catch(() => {});

    return;
}

// =====================================================
// 🎉 GIVEAWAY-SYSTEM
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId.startsWith("giveaway_edit_")
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    const draft = getGiveawayDraft(interaction.message.id);

    if (!draft) {
        return interaction.reply(errorMessage("Dieses Giveaway-Setup ist nicht mehr gültig. Bitte führe !giveaway erneut aus."));
    }

    const field = interaction.customId.replace("giveaway_edit_", "");

    return interaction.showModal(
        createGiveawayModal(field, draft)
    );
}

if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith("giveaway_modal_")
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    if (!interaction.message) {
        return interaction.reply(errorMessage("Dieses Giveaway-Setup ist nicht mehr gültig. Bitte führe !giveaway erneut aus."));
    }

    const draft = getGiveawayDraft(interaction.message.id);

    if (!draft) {
        return interaction.reply(errorMessage("Dieses Giveaway-Setup ist nicht mehr gültig. Bitte führe !giveaway erneut aus."));
    }

    const field = interaction.customId.replace("giveaway_modal_", "");
    const rawValue = interaction.fields.getTextInputValue("value").trim();

    if (field === "prize") {
        if (!rawValue) {
            return interaction.reply(errorMessage("❌ Der Gewinn darf nicht leer sein."));
        }
        draft.prize = rawValue;

    } else if (field === "duration") {
        const parsedMs = parseDurationToMs(rawValue);

        if (!parsedMs) {
            return interaction.reply(errorMessage("❌ Ungültiges Dauer-Format. Nutze z.B. 1d, 12h, 30m oder 1d12h."));
        }
        if (parsedMs < GIVEAWAY_MIN_DURATION_MS) {
            return interaction.reply(errorMessage("❌ Die Dauer muss mindestens 30 Sekunden betragen."));
        }
        if (parsedMs > GIVEAWAY_MAX_DURATION_MS) {
            return interaction.reply(errorMessage("❌ Die Dauer darf maximal 90 Tage betragen."));
        }

        draft.durationRaw = rawValue;
        draft.durationMs = parsedMs;

    } else if (field === "winners") {
        const parsedCount = parseInt(rawValue, 10);

        if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 50) {
            return interaction.reply(errorMessage("❌ Bitte gib eine gültige Zahl zwischen 1 und 50 ein."));
        }

        draft.winnerCount = parsedCount;

    } else if (field === "description") {
        draft.description = rawValue || null;

    } else if (field === "requirements") {
        draft.requirements = rawValue || null;

    } else if (field === "maxparticipants") {
        if (!rawValue) {
            draft.maxParticipants = null;
        } else {
            const parsedMax = parseInt(rawValue, 10);

            if (!Number.isInteger(parsedMax) || parsedMax < 1) {
                return interaction.reply(errorMessage("❌ Bitte gib eine gültige positive Zahl ein oder lasse das Feld leer."));
            }

            draft.maxParticipants = parsedMax;
        }
    } else if (field === "pingrole") {
        if (!rawValue) {
            draft.pingRoleId = null;
        } else {
            const roleIdMatch = rawValue.match(/\d{15,25}/);
            const roleId = roleIdMatch ? roleIdMatch[0] : rawValue;

            const validation = await validateGiveawayPingRole(interaction.guild, roleId);

            if (!validation.ok) {
                return interaction.reply(errorMessage(validation.error));
            }

            draft.pingRoleId = roleId;
        }
    }

    setGiveawayDraft(interaction.message.id, draft);

    return interaction.update(
        createGiveawayConfigPanel(draft)
    );
}

if (
    interaction.isButton() &&
    interaction.customId === "giveaway_channel_open"
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    return interaction.update(
        await createGiveawayChannelSelectPanel(interaction.guild, 0)
    );
}

if (
    interaction.isButton() &&
    interaction.customId.startsWith("giveaway_channel_prev_")
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    const currentPage = parseInt(interaction.customId.replace("giveaway_channel_prev_", ""), 10) || 0;

    return interaction.update(
        await createGiveawayChannelSelectPanel(interaction.guild, Math.max(0, currentPage - 1))
    );
}

if (
    interaction.isButton() &&
    interaction.customId.startsWith("giveaway_channel_next_")
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    const currentPage = parseInt(interaction.customId.replace("giveaway_channel_next_", ""), 10) || 0;

    return interaction.update(
        await createGiveawayChannelSelectPanel(interaction.guild, currentPage + 1)
    );
}

if (
    interaction.isButton() &&
    interaction.customId === "giveaway_channel_back"
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    const draft = getGiveawayDraft(interaction.message.id);

    if (!draft) {
        return interaction.reply(errorMessage("Dieses Giveaway-Setup ist nicht mehr gültig. Bitte führe !giveaway erneut aus."));
    }

    return interaction.update(
        createGiveawayConfigPanel(draft)
    );
}

if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "giveaway_channel_select"
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    const draft = getGiveawayDraft(interaction.message.id);

    if (!draft) {
        return interaction.reply(errorMessage("Dieses Giveaway-Setup ist nicht mehr gültig. Bitte führe !giveaway erneut aus."));
    }

    draft.channelId = interaction.values[0];
    setGiveawayDraft(interaction.message.id, draft);

    return interaction.update(
        createGiveawayConfigPanel(draft)
    );
}

if (
    interaction.isButton() &&
    interaction.customId === "giveaway_cancel"
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu bearbeiten."));
    }

    deleteGiveawayDraft(interaction.message.id);

    return interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("❌ Abgebrochen")
                .setDescription("Die Giveaway-Einrichtung wurde abgebrochen.")
        ],
        components: []
    });
}

if (
    interaction.isButton() &&
    interaction.customId === "giveaway_start"
) {

    if (!hasProtectedCommandPermission(interaction.member)) {
        return interaction.reply(errorMessage("Du hast keine Berechtigung, dieses Giveaway zu starten."));
    }

    const draft = getGiveawayDraft(interaction.message.id);

    if (!draft) {
        return interaction.reply(errorMessage("Dieses Giveaway-Setup ist nicht mehr gültig. Bitte führe !giveaway erneut aus."));
    }

    if (!draft.prize || !draft.durationMs || !draft.channelId) {
        return interaction.reply(errorMessage("❌ Bitte fülle mindestens 🎁 Gewinn, ⏱️ Dauer und 📢 Kanal aus, bevor du startest."));
    }

    const targetChannel = await interaction.guild.channels.fetch(draft.channelId).catch(() => null);

    if (!targetChannel || !targetChannel.isTextBased()) {
        return interaction.reply(errorMessage("❌ Der ausgewählte Kanal wurde nicht gefunden. Bitte wähle über „Kanal auswählen“ einen anderen Kanal aus."));
    }

    const botMember = interaction.guild.members.me;
    const channelPerms = botMember ? targetChannel.permissionsFor(botMember) : null;

    if (
        !channelPerms ||
        !channelPerms.has(PermissionsBitField.Flags.ViewChannel) ||
        !channelPerms.has(PermissionsBitField.Flags.SendMessages) ||
        !channelPerms.has(PermissionsBitField.Flags.EmbedLinks)
    ) {
        return interaction.reply(errorMessage(`❌ Dem Bot fehlen benötigte Berechtigungen (Kanal ansehen / Nachrichten senden / Embeds einbetten) in ${targetChannel}.`));
    }

    // Gepingte Rolle direkt vor dem Start erneut prüfen (Rolle könnte
    // zwischenzeitlich gelöscht oder die Berechtigung geändert worden sein).
    let pingRoleId = null;
    if (draft.pingRoleId) {
        const pingValidation = await validateGiveawayPingRole(interaction.guild, draft.pingRoleId);

        if (!pingValidation.ok) {
            return interaction.reply(errorMessage(
                `${pingValidation.error}\nBitte korrigiere die 🔔 Gepingte Rolle oder entferne sie (leeres Feld speichern), bevor du das Giveaway startest.`
            ));
        }

        pingRoleId = draft.pingRoleId;
    }

    const endsAt = Date.now() + draft.durationMs;

    const record = {
        guildId: interaction.guild.id,
        channelId: draft.channelId,
        messageId: null,
        prize: draft.prize,
        description: draft.description || null,
        requirements: draft.requirements || null,
        winnerCount: draft.winnerCount || 1,
        maxParticipants: draft.maxParticipants || null,
        pingRoleId: pingRoleId,
        participants: [],
        hostId: interaction.user.id,
        hostTag: interaction.user.tag,
        createdAt: Date.now(),
        endsAt,
        ended: false,
        winners: []
    };

    // Der Rollen-Ping wird als normaler Nachrichteninhalt (außerhalb des
    // Embeds) gesendet, damit Discord die Rolle tatsächlich benachrichtigt.
    const pingContent = record.pingRoleId ? `<@&${record.pingRoleId}>` : undefined;
    const pingAllowedMentions = { roles: record.pingRoleId ? [record.pingRoleId] : [] };

    let giveawayMessage;
    try {
        giveawayMessage = await targetChannel.send({
            content: pingContent,
            embeds: [buildGiveawayEmbed(record)],
            components: [buildGiveawayJoinRow("pending", 0, record.maxParticipants, false)],
            allowedMentions: pingAllowedMentions
        });
    } catch (sendError) {
        console.error("❌ Fehler beim Senden des Giveaways:", sendError);
        return interaction.reply(errorMessage("❌ Das Giveaway konnte nicht im ausgewählten Kanal gesendet werden. (Discord API Fehler)"));
    }

    record.messageId = giveawayMessage.id;
    saveGiveawayRecord(record);

    try {
        await giveawayMessage.edit({
            content: pingContent,
            embeds: [buildGiveawayEmbed(record)],
            components: [buildGiveawayJoinRow(record.messageId, 0, record.maxParticipants, false)],
            allowedMentions: pingAllowedMentions
        });
    } catch (_) {}

    scheduleGiveawayEnd(client, record.messageId, draft.durationMs);

    deleteGiveawayDraft(interaction.message.id);

    return interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("✅ Giveaway gestartet!")
                .setDescription(`Das Giveaway für **${record.prize}** wurde erfolgreich in ${targetChannel} veröffentlicht und endet <t:${Math.floor(endsAt / 1000)}:R>.`)
        ],
        components: []
    });
}

if (
    interaction.isButton() &&
    interaction.customId.startsWith("giveaway_join_")
) {

    const messageId = interaction.customId.replace("giveaway_join_", "");
    const record = getGiveawayRecord(messageId);

    if (!record || record.ended) {
        return interaction.reply(errorMessage("❌ Dieses Giveaway ist nicht mehr aktiv."));
    }

    if (record.participants.includes(interaction.user.id)) {
        return interaction.reply({
            content: "ℹ️ Du nimmst bereits an diesem Giveaway teil.",
            flags: MessageFlags.Ephemeral
        });
    }

    if (record.maxParticipants && record.participants.length >= record.maxParticipants) {
        return interaction.reply(errorMessage("❌ Die maximale Teilnehmerzahl für dieses Giveaway wurde bereits erreicht."));
    }

    record.participants.push(interaction.user.id);
    saveGiveawayRecord(record);

    try {
        await interaction.deferUpdate();

        await interaction.message.edit({
            embeds: [buildGiveawayEmbed(record)],
            components: [buildGiveawayJoinRow(record.messageId, record.participants.length, record.maxParticipants, false)]
        });

        await interaction.followUp({
            content: "✅ Du nimmst jetzt am Giveaway teil! Viel Glück 🍀",
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error("❌ Fehler bei der Giveaway-Teilnahme:", error);
    }

    return;
}

// =====================================================
// TEXTSENDE – STIL AUSWÄHLEN
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId === "textsende_style_normal"
) {

    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            0,
            "normal"
        )
    );
}

if (
    interaction.isButton() &&
    interaction.customId === "textsende_style_rp"
) {

    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            0,
            "rp"
        )
    );
}

// =====================================================
// RP-NACHRICHT – KANAL AUSWÄHLEN
// =====================================================

if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "rp_channel_select"
) {

    const channelId =
        interaction.values[0];
    const guildId =
        interaction.guild.id;

    // Server-Konfiguration speichern
    setServerConfig(
        guildId,
        "rpStatusChannelId",
        channelId
    );

    return interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(
                    "✅ RP-Kanal gespeichert"
                )
                .setDescription(
                    `RP-Start und RP-Stopp werden jetzt in <#${channelId}> gesendet.`
                )
                .setFooter({
                    text:
                        "Vexo RP ✧ 𝙑𝘾 • RP-System"
                })
        ],
        components: []
    });
}

if (
    interaction.isButton() &&
    interaction.customId.startsWith("rp_channel_prev_")
) {

    try {
        if (interaction.deferred || interaction.replied) {
            return;
        }

        const currentPage = parseInt(
            interaction.customId.replace(
                "rp_channel_prev_",
                ""
            )
        );
        const newPage =
            Math.max(0, currentPage - 1);

        const panel = await createRPChannelPanel(
            interaction.guild,
            newPage
        );

        return interaction.update(panel);
    } catch (error) {
        console.error("❌ Fehler bei rp_channel_prev:", error);
        return;
    }
}

if (
    interaction.isButton() &&
    interaction.customId.startsWith("rp_channel_next_")
) {

    try {
        if (interaction.deferred || interaction.replied) {
            return;
        }

        const currentPage = parseInt(
            interaction.customId.replace(
                "rp_channel_next_",
                ""
            )
        );
        const newPage = currentPage + 1;

        const panel = await createRPChannelPanel(
            interaction.guild,
            newPage
        );

        return interaction.update(panel);
    } catch (error) {
        console.error("❌ Fehler bei rp_channel_next:", error);
        return;
    }
}


// =====================================================
// TEXTSENDE – ZURÜCK ZUR STILAUSWAHL
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId === "textsende_back_style"
) {

    return interaction.update(
        createTextSendeMainPanel()
    );
}


// =====================================================
// TEXTSENDE – SEITE ZURÜCK
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId.startsWith(
        "textsende_page_prev_"
    )
) {

    const parts =
        interaction.customId.split("_");

    const currentPage =
        Number(parts[3]);

    const style =
        parts[4] || "normal";

    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            currentPage - 1,
            style
        )
    );
}


// =====================================================
// TEXTSENDE – SEITE WEITER
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId.startsWith(
        "textsende_page_next_"
    )
) {

    const parts =
        interaction.customId.split("_");

    const currentPage =
        Number(parts[3]);

    const style =
        parts[4] || "normal";

    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            currentPage + 1,
            style
        )
    );
}


// =====================================================
// TEXTSENDE – KANAL AUSWÄHLEN
// =====================================================

if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith(
        "textsende_channel_select_"
    )
) {

    const style =
        interaction.customId.replace(
            "textsende_channel_select_",
            ""
        );

    const channelId =
        interaction.values[0];

    return interaction.showModal(
        createTextSendeModal(
            channelId,
            style
        )
    );
}


// =====================================================
// TEXTSENDE – NACHRICHT SENDEN
// =====================================================

if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith(
        "textsende_modal_"
    )
) {

    const parts =
        interaction.customId.split("_");

    const style =
        parts[2];

    const channelId =
        parts.slice(3).join("_");

    const text =
        interaction.fields.getTextInputValue(
            "message_text"
        );

    const channel =
        await interaction.guild.channels
            .fetch(
                channelId
            )
            .catch(
                () => null
            );

    if (
        !channel ||
        !channel.isTextBased()
    ) {

        return interaction.reply({
            content:
                "❌ Der ausgewählte Kanal wurde nicht gefunden.",
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // NORMALER STIL
    // =================================================

    if (
        style === "normal"
    ) {

        await channel.send({
            content:
                text,

            allowedMentions: {
                parse: [
                    "users",
                    "roles",
                    "everyone"
                ]
            }
        });

        return interaction.reply({
            content:
                `✅ Die Nachricht wurde normal in ${channel} gesendet.`,
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // RP-STIL
    // =================================================

    const embed =
        new EmbedBuilder()
            .setColor(
                0x57F287
            )
        
        
            .setDescription(
                text
            )
            .setTimestamp()
            .setFooter({
    text:
        `Vexo RP • Geschrieben von ${interaction.user.tag}`
});

    await channel.send({
        embeds: [
            embed
        ],
        allowedMentions: {
            parse: [
                "users",
                "roles",
                "everyone"
            ]
        }
    });

    return interaction.reply({
        content:
            `✅ Die RP-Nachricht wurde in ${channel} gesendet.`,
        flags:
            MessageFlags.Ephemeral
    });
}

// =====================================================
// TEXTSENDE – STIL AUSWÄHLEN
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId === "textsende_style_normal"
) {
    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            0,
            "normal"
        )
    );
}

if (
    interaction.isButton() &&
    interaction.customId === "textsende_style_rp"
) {
    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            0,
            "rp"
        )
    );
}


// =====================================================
// TEXTSENDE – ZURÜCK ZUR STILAUSWAHL
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId === "textsende_back_style"
) {
    return interaction.update(
        createTextSendeMainPanel()
    );
}


// =====================================================
// TEXTSENDE – SEITE ZURÜCK
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId.startsWith(
        "textsende_page_prev_"
    )
) {

    const parts =
        interaction.customId.split("_");

    const currentPage =
        Number(parts[3]);

    const style =
        parts[4] || "normal";

    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            currentPage - 1,
            style
        )
    );
}


// =====================================================
// TEXTSENDE – SEITE WEITER
// =====================================================

if (
    interaction.isButton() &&
    interaction.customId.startsWith(
        "textsende_page_next_"
    )
) {

    const parts =
        interaction.customId.split("_");

    const currentPage =
        Number(parts[3]);

    const style =
        parts[4] || "normal";

    return interaction.update(
        createTextSendeChannelPanel(
            interaction.guild,
            currentPage + 1,
            style
        )
    );
}


// =====================================================
// TEXTSENDE – KANAL AUSWÄHLEN
// =====================================================

if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith(
        "textsende_channel_select_"
    )
) {

    const style =
        interaction.customId.replace(
            "textsende_channel_select_",
            ""
        );

    const channelId =
        interaction.values[0];

    return interaction.showModal(
        createTextSendeModal(
            channelId,
            style
        )
    );
}


// =====================================================
// TEXTSENDE – NACHRICHT SENDEN
// =====================================================

if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith(
        "textsende_modal_"
    )
) {

    const parts =
        interaction.customId.split("_");

    const style =
        parts[2];

    const channelId =
        parts.slice(3).join("_");

    const text =
        interaction.fields.getTextInputValue(
            "message_text"
        );

    const channel =
        await interaction.guild.channels
            .fetch(
                channelId
            )
            .catch(
                () => null
            );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return interaction.reply({
            content:
                "❌ Der ausgewählte Kanal wurde nicht gefunden.",
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // NORMALER STIL
    // =================================================

    if (
        style === "normal"
    ) {

        await channel.send({
            content:
                text,

            allowedMentions: {
                parse: [
                    "users",
                    "roles",
                    "everyone"
                ]
            }
        });

        return interaction.reply({
            content:
                `✅ Die Nachricht wurde normal in ${channel} gesendet.`,
            flags:
                MessageFlags.Ephemeral
        });
    }


    // =================================================
    // RP-STIL
    // =================================================

    const embed =
        new EmbedBuilder()
            .setColor(
                0x57F287
            )
            .setTitle(
                "🚨・𝐁𝐑𝐀𝐍𝐃𝐄𝐍𝐁𝐔𝐑𝐆 𝐑𝐏𝐕𝐂"
            )
            .setDescription(
                text
            )
            .setTimestamp()
           .setFooter({
    text:
        `Vexo RP • Geschrieben von ${interaction.user.tag}`
});

    await channel.send({
        embeds: [
            embed
        ],
        allowedMentions: {
            parse: [
                "users",
                "roles",
                "everyone"
            ]
        }
    });

    return interaction.reply({
        content:
            `✅ Die RP-Nachricht wurde in ${channel} gesendet.`,
        flags:
            MessageFlags.Ephemeral
    });
}

            // =================================================
            // HÄUSER
            // =================================================

            if (
                (
                    interaction.isButton() &&
                    interaction.customId.startsWith(
                        "houses_"
                    )
                ) ||
                (
                    interaction.isStringSelectMenu() &&
                    interaction.customId.startsWith(
                        "houses_"
                    )
                ) ||
                (
                    interaction.isUserSelectMenu() &&
                    interaction.customId.startsWith(
                        "houses_"
                    )
                ) ||
                (
                    interaction.isModalSubmit() &&
                    interaction.customId.startsWith(
                        "houses_"
                    )
                )
            ) {

                if (
                    !hasHousesPermission(
                        interaction.member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Du hast dafür keine Berechtigung.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // SERVER / CLIENT ERMITTELN
                // =================================================

                const houseClientNumber =
                    getHouseClientNumber(
                        interaction.guild
                    );

                if (
                    !houseClientNumber
                ) {
                    return interaction.reply({
                        content:
                            "❌ Dieser Server ist für das Häuser-System nicht eingerichtet.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const houseList =
                    houseClientNumber === 2
                        ? HOUSE_LIST_2
                        : HOUSE_LIST_1;


                // =================================================
                // HILFSFUNKTION:
                // HÄUSERLISTE SOFORT AKTUALISIEREN
                // =================================================

                async function refreshHouseList() {

                    try {

                        await updateHousesLists(
                            interaction.guild,
                            houseList,
                            houseClientNumber
                        );

                    } catch (error) {

                        console.error(
                            "❌ Fehler beim Aktualisieren der Häuserliste:",
                            error
                        );

                    }
                }


                // =================================================
                // HILFSFUNKTION:
                // HÄUSERPANEL AKTUALISIEREN
                // =================================================

                async function refreshHousePanel() {

                    try {

                        const panelFile =
                            houseClientNumber === 2
                                ? HOUSES_PANEL_FILE_2
                                : HOUSES_PANEL_FILE_1;

                        if (
                            !fs.existsSync(
                                panelFile
                            )
                        ) {
                            return;
                        }

                        const panelData =
                            JSON.parse(
                                fs.readFileSync(
                                    panelFile,
                                    "utf8"
                                )
                            );

                        if (
                            !panelData?.channelId ||
                            !panelData?.messageId
                        ) {
                            return;
                        }

                        const panelChannel =
                            await interaction.guild.channels
                                .fetch(
                                    panelData.channelId
                                )
                                .catch(
                                    () => null
                                );

                        if (
                            !panelChannel ||
                            !panelChannel.isTextBased()
                        ) {
                            return;
                        }

                        const panelMessage =
                            await panelChannel.messages
                                .fetch(
                                    panelData.messageId
                                )
                                .catch(
                                    () => null
                                );

                        if (
                            !panelMessage
                        ) {
                            return;
                        }

                        const panelHouses =
                            loadHouses(
                                houseClientNumber
                            );

                        const panelEmbed =
                            new EmbedBuilder()
                                .setColor(
                                    0x5865F2
                                )
                                .setTitle(
                                    "🏠 Häuserverwaltung"
                                )
                                .setDescription(
                                    `Verwalte hier die Häuser des Servers.\n\n🏠 **Eingetragene Häuser:** ${panelHouses.length}`
                                )
                                .setTimestamp()
                                .setFooter({
                                    text:
                                        "RP-VC • Häuserverwaltung"
                                });

                        const panelRow =
                            new ActionRowBuilder()
                                .addComponents(

                                    new ButtonBuilder()
                                        .setCustomId(
                                            "houses_add"
                                        )
                                        .setLabel(
                                            "Benutzer hinzufügen"
                                        )
                                        .setEmoji(
                                            "➕"
                                        )
                                        .setStyle(
                                            ButtonStyle.Success
                                        ),

                                    new ButtonBuilder()
                                        .setCustomId(
                                            "houses_edit"
                                        )
                                        .setLabel(
                                            "Haus bearbeiten"
                                        )
                                        .setEmoji(
                                            "✏️"
                                        )
                                        .setStyle(
                                            ButtonStyle.Primary
                                        ),

                                    new ButtonBuilder()
                                        .setCustomId(
                                            "houses_remove"
                                        )
                                        .setLabel(
                                            "Haus entfernen"
                                        )
                                        .setEmoji(
                                            "🗑️"
                                        )
                                        .setStyle(
                                            ButtonStyle.Danger
                                        ),

                                    new ButtonBuilder()
                                        .setCustomId(
                                            "houses_refresh"
                                        )
                                        .setLabel(
                                            "Liste aktualisieren"
                                        )
                                        .setEmoji(
                                            "🔄"
                                        )
                                        .setStyle(
                                            ButtonStyle.Secondary
                                        )
                                );

                        await panelMessage.edit({
                            embeds: [
                                panelEmbed
                            ],
                            components: [
                                panelRow
                            ]
                        });

                    } catch (error) {

                        console.error(
                            "❌ Fehler beim Aktualisieren des Häuserpanels:",
                            error
                        );

                    }
                }


                // =================================================
                // HÄUSER REFRESH
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "houses_refresh"
                ) {

                    await refreshHouseList();

                    await refreshHousePanel();

                    return interaction.reply({
                        content:
                            "✅ Häuserpanel und Häuserliste wurden aktualisiert.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // BENUTZER HINZUFÜGEN
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "houses_add"
                ) {

                    const row =
                        new ActionRowBuilder()
                            .addComponents(
                                new UserSelectMenuBuilder()
                                    .setCustomId(
                                        "houses_add_user"
                                    )
                                    .setPlaceholder(
                                        "👤 Bewohner auswählen"
                                    )
                                    .setMinValues(
                                        1
                                    )
                                    .setMaxValues(
                                        1
                                    )
                            );

                    return interaction.reply({
                        content:
                            "👤 **Wähle den Bewohner aus.**",
                        components:
                            [row],
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // BENUTZER AUSWÄHLEN
                // =================================================

                if (
                    interaction.isUserSelectMenu() &&
                    interaction.customId ===
                        "houses_add_user"
                ) {

                    const userId =
                        interaction.values[0];

                    const user =
                        await client.users
                            .fetch(
                                userId
                            )
                            .catch(
                                () => null
                            );

                    if (!user) {
                        return interaction.reply({
                            content:
                                "❌ Benutzer konnte nicht gefunden werden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                `houses_add_modal_${userId}`
                            )
                            .setTitle(
                                "🏠 Haus hinzufügen"
                            );

                    const input =
                        new TextInputBuilder()
                            .setCustomId(
                                "house_number"
                            )
                            .setLabel(
                                "Hausnummer"
                            )
                            .setPlaceholder(
                                "z. B. 2"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(
                                true
                            )
                            .setMaxLength(
                                10
                            );

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                input
                            )
                    );

                    return interaction.showModal(
                        modal
                    );
                }


                // =================================================
                // HAUS HINZUFÜGEN - MODAL
                // =================================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId.startsWith(
                        "houses_add_modal_"
                    )
                ) {

                    const userId =
                        interaction.customId.replace(
                            "houses_add_modal_",
                            ""
                        );

                    const houseNumber =
                        interaction.fields
                            .getTextInputValue(
                                "house_number"
                            )
                            .trim();

                    if (
                        !/^\d+$/.test(
                            houseNumber
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Die Hausnummer darf nur aus Zahlen bestehen.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const number =
                        Number(
                            houseNumber
                        );

                    if (
                        number < 1 ||
                        number > 46
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Die Hausnummer muss zwischen **1 und 46** liegen.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    if (
                        houses.some(
                            house =>
                                String(
                                    house.houseNumber
                                ) ===
                                String(
                                    houseNumber
                                )
                        )
                    ) {
                        return interaction.reply({
                            content:
                                `❌ **Haus #${houseNumber}** ist bereits eingetragen.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const user =
                        await client.users
                            .fetch(
                                userId
                            )
                            .catch(
                                () => null
                            );

                    if (!user) {
                        return interaction.reply({
                            content:
                                "❌ Bewohner wurde nicht gefunden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    houses.push({
                        houseNumber,
                        userId,
                        username:
                            user.username,
                        ownerName:
                            user.globalName || user.username,
                        createdAt:
                            new Date().toISOString(),
                        createdBy:
                            interaction.user.id
                    });

                    houses.sort(
                        (
                            a,
                            b
                        ) =>
                            Number(
                                a.houseNumber
                            ) -
                            Number(
                                b.houseNumber
                            )
                    );

                    if (
                        !saveHouses(
                            houses,
                            houseClientNumber
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Das Haus konnte nicht gespeichert werden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // SOFORT LISTE AKTUALISIEREN
                    await refreshHouseList();

                    // SOFORT PANEL AKTUALISIEREN
                    await refreshHousePanel();

                    return interaction.reply({
                        content:
                            `✅ **Haus #${houseNumber}** wurde für <@${userId}> eingetragen und die Häuserliste wurde sofort aktualisiert.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // HAUS BEARBEITEN
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "houses_edit"
                ) {

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    if (
                        houses.length === 0
                    ) {
                        return interaction.reply({
                            content:
                                "ℹ️ Es sind noch keine Häuser eingetragen.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const rows =
                        createHouseSelectRows(
                            "edit",
                            houseList,
                            houseClientNumber
                        );

                    return interaction.reply({
                        content:
                            "✏️ **Wähle das Haus aus, das du bearbeiten möchtest.**",
                        components:
                            rows,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // HAUS ZUM BEARBEITEN AUSWÄHLEN
                // =================================================

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId.startsWith(
                        "houses_edit_select_"
                    )
                ) {

                    const houseNumber =
                        interaction.values[0];

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    const house =
                        houses.find(
                            item =>
                                String(
                                    item.houseNumber
                                ) ===
                                String(
                                    houseNumber
                                )
                        );

                    if (!house) {
                        return interaction.reply({
                            content:
                                "❌ Haus wurde nicht gefunden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const row =
                        new ActionRowBuilder()
                            .addComponents(

                                new ButtonBuilder()
                                    .setCustomId(
                                        `houses_edit_resident_${houseNumber}`
                                    )
                                    .setLabel(
                                        "Bewohner ändern"
                                    )
                                    .setEmoji(
                                        "👤"
                                    )
                                    .setStyle(
                                        ButtonStyle.Primary
                                    ),

                                new ButtonBuilder()
                                    .setCustomId(
                                        `houses_edit_number_${houseNumber}`
                                    )
                                    .setLabel(
                                        "Hausnummer ändern"
                                    )
                                    .setEmoji(
                                        "🏠"
                                    )
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                            );

                    return interaction.reply({
                        content:
                            `✏️ **Haus #${houseNumber}**\n\n👤 Aktueller Bewohner: <@${house.userId}>`,
                        components:
                            [row],
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // BEWOHNER ÄNDERN
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId.startsWith(
                        "houses_edit_resident_"
                    )
                ) {

                    const houseNumber =
                        interaction.customId.replace(
                            "houses_edit_resident_",
                            ""
                        );

                    const row =
                        new ActionRowBuilder()
                            .addComponents(
                                new UserSelectMenuBuilder()
                                    .setCustomId(
                                        `houses_change_resident_${houseNumber}`
                                    )
                                    .setPlaceholder(
                                        "👤 Neuen Bewohner auswählen"
                                    )
                                    .setMinValues(
                                        1
                                    )
                                    .setMaxValues(
                                        1
                                    )
                            );

                    return interaction.reply({
                        content:
                            `👤 Wähle den neuen Bewohner für **Haus #${houseNumber}** aus.`,
                        components:
                            [row],
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // NEUEN BEWOHNER SPEICHERN
                // =================================================

                if (
                    interaction.isUserSelectMenu() &&
                    interaction.customId.startsWith(
                        "houses_change_resident_"
                    )
                ) {

                    const houseNumber =
                        interaction.customId.replace(
                            "houses_change_resident_",
                            ""
                        );

                    const newUserId =
                        interaction.values[0];

                    const user =
                        await client.users
                            .fetch(
                                newUserId
                            )
                            .catch(
                                () => null
                            );

                    if (!user) {
                        return interaction.reply({
                            content:
                                "❌ Benutzer wurde nicht gefunden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    const house =
                        houses.find(
                            item =>
                                String(
                                    item.houseNumber
                                ) ===
                                String(
                                    houseNumber
                                )
                        );

                    if (!house) {
                        return interaction.reply({
                            content:
                                "❌ Haus wurde nicht gefunden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    house.userId =
                        newUserId;

                    house.username =
                        user.username;

                    house.updatedAt =
                        new Date().toISOString();

                    house.updatedBy =
                        interaction.user.id;

                    if (
                        !saveHouses(
                            houses,
                            houseClientNumber
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Die Änderung konnte nicht gespeichert werden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // SOFORT AKTUALISIEREN
                    await refreshHouseList();

                    await refreshHousePanel();

                    return interaction.reply({
                        content:
                            `✅ Der Bewohner von **Haus #${houseNumber}** wurde geändert und die Häuserliste wurde sofort aktualisiert.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // HAUSNUMMER ÄNDERN
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId.startsWith(
                        "houses_edit_number_"
                    )
                ) {

                    const oldHouseNumber =
                        interaction.customId.replace(
                            "houses_edit_number_",
                            ""
                        );

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                `houses_edit_number_modal_${oldHouseNumber}`
                            )
                            .setTitle(
                                "🏠 Hausnummer ändern"
                            );

                    const input =
                        new TextInputBuilder()
                            .setCustomId(
                                "new_house_number"
                            )
                            .setLabel(
                                "Neue Hausnummer"
                            )
                            .setPlaceholder(
                                "z. B. 9"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(
                                true
                            )
                            .setMaxLength(
                                10
                            );

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                input
                            )
                    );

                    return interaction.showModal(
                        modal
                    );
                }


                // =================================================
                // HAUSNUMMER ÄNDERN - MODAL
                // =================================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId.startsWith(
                        "houses_edit_number_modal_"
                    )
                ) {

                    const oldHouseNumber =
                        interaction.customId.replace(
                            "houses_edit_number_modal_",
                            ""
                        );

                    const newHouseNumber =
                        interaction.fields
                            .getTextInputValue(
                                "new_house_number"
                            )
                            .trim();

                    if (
                        !/^\d+$/.test(
                            newHouseNumber
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Die Hausnummer darf nur aus Zahlen bestehen.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const newNumber =
                        Number(
                            newHouseNumber
                        );

                    if (
                        newNumber < 1 ||
                        newNumber > 46
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Die Hausnummer muss zwischen **1 und 46** liegen.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    const duplicate =
                        houses.some(
                            house =>
                                String(
                                    house.houseNumber
                                ) ===
                                    String(
                                        newHouseNumber
                                    ) &&
                                String(
                                    house.houseNumber
                                ) !==
                                    String(
                                        oldHouseNumber
                                    )
                        );

                    if (
                        duplicate
                    ) {
                        return interaction.reply({
                            content:
                                `❌ **Haus #${newHouseNumber}** existiert bereits.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const house =
                        houses.find(
                            item =>
                                String(
                                    item.houseNumber
                                ) ===
                                String(
                                    oldHouseNumber
                                )
                        );

                    if (!house) {
                        return interaction.reply({
                            content:
                                "❌ Das alte Haus wurde nicht gefunden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    house.houseNumber =
                        newHouseNumber;

                    house.updatedAt =
                        new Date().toISOString();

                    house.updatedBy =
                        interaction.user.id;

                    houses.sort(
                        (
                            a,
                            b
                        ) =>
                            Number(
                                a.houseNumber
                            ) -
                            Number(
                                b.houseNumber
                            )
                    );

                    // WICHTIG:
                    // Hier war vorher saveHouses(!houses)
                    if (
                        !saveHouses(
                            houses,
                            houseClientNumber
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Die Hausnummer konnte nicht gespeichert werden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // SOFORT AKTUALISIEREN
                    await refreshHouseList();

                    await refreshHousePanel();

                    return interaction.reply({
                        content:
                            `✅ **Haus #${oldHouseNumber}** wurde zu **Haus #${newHouseNumber}** geändert und die Häuserliste wurde sofort aktualisiert.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // HAUS ENTFERNEN
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "houses_remove"
                ) {

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    if (
                        houses.length === 0
                    ) {
                        return interaction.reply({
                            content:
                                "ℹ️ Es sind noch keine Häuser eingetragen.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const rows =
                        createHouseSelectRows(
                            "remove",
                            houseList,
                            houseClientNumber
                        );

                    return interaction.reply({
                        content:
                            "🗑️ **Wähle das Haus aus, das du entfernen möchtest.**",
                        components:
                            rows,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // HAUS ZUM LÖSCHEN AUSWÄHLEN
                // =================================================

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId.startsWith(
                        "houses_remove_select_"
                    )
                ) {

                    const houseNumber =
                        interaction.values[0];

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    const house =
                        houses.find(
                            item =>
                                String(
                                    item.houseNumber
                                ) ===
                                String(
                                    houseNumber
                                )
                        );

                    if (!house) {
                        return interaction.reply({
                            content:
                                "❌ Haus wurde nicht gefunden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const row =
                        new ActionRowBuilder()
                            .addComponents(

                                new ButtonBuilder()
                                    .setCustomId(
                                        `houses_confirm_remove_${houseNumber}`
                                    )
                                    .setLabel(
                                        "Ja, löschen"
                                    )
                                    .setEmoji(
                                        "✅"
                                    )
                                    .setStyle(
                                        ButtonStyle.Danger
                                    ),

                                new ButtonBuilder()
                                    .setCustomId(
                                        "houses_cancel_remove"
                                    )
                                    .setLabel(
                                        "Abbrechen"
                                    )
                                    .setEmoji(
                                        "❌"
                                    )
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                            );

                    return interaction.reply({
                        content:
                            `⚠️ **Möchtest du Haus #${houseNumber} wirklich löschen?**\n\n👤 Bewohner: <@${house.userId}>`,
                        components:
                            [row],
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // HAUS LÖSCHEN
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId.startsWith(
                        "houses_confirm_remove_"
                    )
                ) {

                    const houseNumber =
                        interaction.customId.replace(
                            "houses_confirm_remove_",
                            ""
                        );

                    const houses =
                        loadHouses(
                            houseClientNumber
                        );

                    const index =
                        houses.findIndex(
                            house =>
                                String(
                                    house.houseNumber
                                ) ===
                                String(
                                    houseNumber
                                )
                        );

                    if (
                        index ===
                        -1
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Dieses Haus existiert nicht mehr.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const removedHouse =
                        houses.splice(
                            index,
                            1
                        )[0];

                    if (
                        !saveHouses(
                            houses,
                            houseClientNumber
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Das Haus konnte nicht gelöscht werden.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // SOFORT AKTUALISIEREN
                    await refreshHouseList();

                    await refreshHousePanel();

                    return interaction.reply({
                        content:
                            `✅ **Haus #${removedHouse.houseNumber}** wurde gelöscht und die Häuserliste sofort aktualisiert.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }


                // =================================================
                // LÖSCHEN ABBRECHEN
                // =================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "houses_cancel_remove"
                ) {

                    return interaction.reply({
                        content:
                            "❌ Die Löschung wurde abgebrochen.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return;
            }

           

            // =================================================
            // RP TEXT ÄNDERN START
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "rp_edit_start_text"
            ) {

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            "rp_edit_start_modal"
                        )
                        .setTitle(
                            "RP Start Text ändern"
                        );

                const titleInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_start_title"
                        )
                        .setLabel(
                            "Titel"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setValue(
                            RP_START_TITLE
                        )
                        .setRequired(true);

                const descriptionInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_start_description"
                        )
                        .setLabel(
                            "Beschreibung"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setValue(
                            RP_START_DESCRIPTION
                        )
                        .setRequired(true);

                const successInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_start_success"
                        )
                        .setLabel(
                            "Erfolgsnachricht"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setValue(
                            RP_START_SUCCESS
                        )
                        .setRequired(true);

                const rolePingInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_start_role_ping"
                        )
                        .setLabel(
                            "Rollen-ID für Ping (optional)"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setValue(
                            RP_PING_ROLE_ID || ""
                        )
                        .setRequired(false)
                        .setPlaceholder(
                            "z.B. 1234567890123456789 oder leer lassen"
                        );

                const firstRow =
                    new ActionRowBuilder()
                        .addComponents(
                            titleInput
                        );

                const secondRow =
                    new ActionRowBuilder()
                        .addComponents(
                            descriptionInput
                        );

                const thirdRow =
                    new ActionRowBuilder()
                        .addComponents(
                            successInput
                        );

                const fourthRow =
                    new ActionRowBuilder()
                        .addComponents(
                            rolePingInput
                        );

                modal.addComponents(
                    firstRow,
                    secondRow,
                    thirdRow,
                    fourthRow
                );

                return interaction.showModal(
                    modal
                );
            }

            // =================================================
            // RP TEXT ÄNDERN STOPP
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "rp_edit_stop_text"
            ) {

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            "rp_edit_stop_modal"
                        )
                        .setTitle(
                            "RP Stop Text ändern"
                        );

                const titleInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_stop_title"
                        )
                        .setLabel(
                            "Titel"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setValue(
                            RP_STOP_TITLE
                        )
                        .setRequired(true);

                const descriptionInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_stop_description"
                        )
                        .setLabel(
                            "Beschreibung"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setValue(
                            RP_STOP_DESCRIPTION
                        )
                        .setRequired(true);

                const successInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_stop_success"
                        )
                        .setLabel(
                            "Erfolgsnachricht"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setValue(
                            RP_STOP_SUCCESS
                        )
                        .setRequired(true);

                const rolePingInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "rp_stop_role_ping"
                        )
                        .setLabel(
                            "Rollen-ID für Ping (optional)"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setValue(
                            RP_PING_ROLE_ID || ""
                        )
                        .setRequired(false)
                        .setPlaceholder(
                            "z.B. 1234567890123456789 oder leer lassen"
                        );

                const firstRow =
                    new ActionRowBuilder()
                        .addComponents(
                            titleInput
                        );

                const secondRow =
                    new ActionRowBuilder()
                        .addComponents(
                            descriptionInput
                        );

                const thirdRow =
                    new ActionRowBuilder()
                        .addComponents(
                            successInput
                        );

                const fourthRow =
                    new ActionRowBuilder()
                        .addComponents(
                            rolePingInput
                        );

                modal.addComponents(
                    firstRow,
                    secondRow,
                    thirdRow,
                    fourthRow
                );

                return interaction.showModal(
                    modal
                );
            }

            // =================================================
            // TEAM BUTTONS
            // =================================================

            if (
                interaction.isButton()
            ) {

                if (interaction.customId === "team_application_start") {
                    const existingApplication = getTeamApplication(interaction.user.id, interaction.guild.id);
                    const activeStatuses = ["awaiting_acceptance", "questioning", "submitted"];

                    if (
                        existingApplication &&
                        activeStatuses.includes(existingApplication.status) &&
                        !APPLICATION_UNLIMITED_USER_IDS.has(interaction.user.id)
                    ) {
                        return interaction.reply({
                            content: "ℹ️ Du hast bereits eine aktive Bewerbung.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const application = {
                        guildId: interaction.guild.id,
                        userId: interaction.user.id,
                        // Hält fest, in welchem Kanal das Panel lag. Der Review-Kanal wird
                        // separat pro Server konfiguriert und nicht aus diesem Feld abgeleitet.
                        teamApplicationPanelChannelId: interaction.channel.id,
                        status: "awaiting_acceptance",
                        currentQuestion: 0,
                        answers: [],
                        startedAt: new Date().toISOString(),
                        submittedAt: null,
                        decision: null,
                    };
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    setTeamApplication(application);

                    try {
                        await interaction.user.send({
                            content: "📋 Deine Teambewerbung wird jetzt gestartet. Bitte bestätige, dass du beginnen möchtest.",
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("team_application_accept")
                                        .setLabel("Akzeptieren")
                                        .setEmoji("✅")
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId("team_application_decline")
                                        .setLabel("Ablehnen")
                                        .setEmoji("❌")
                                        .setStyle(ButtonStyle.Danger)
                                )
                            ]
                        });
                        return interaction.editReply({
                            content: "✅ Ich habe dir eine DM für die Bewerbung geschickt."
                        });
                    } catch (error) {
                        application.status = "dm_failed";
                        setTeamApplication(application);
                        console.error("❌ Bewerbungs-DM konnte nicht gesendet werden:", error);
                        return interaction.editReply({
                            content: "❌ Ich konnte dir keine DM schicken. Bitte aktiviere deine Direktnachrichten und versuche es erneut."
                        });
                    }
                }

                if (interaction.customId === "team_application_accept") {
                    const application = Object.values(TEAM_APPLICATIONS.applications)
                        .find(item => item.userId === interaction.user.id && item.status === "awaiting_acceptance");

                    if (!application) {
                        return interaction.reply({
                            content: "❌ Es wurde keine wartende Bewerbung gefunden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    application.status = "questioning";
                    application.currentQuestion = 0;
                    setTeamApplication(application);
                    return interaction.update({
                        content: `✅ Bewerbung gestartet.\n\n**1. ${TEAM_APPLICATION_QUESTIONS[0]}**`,
                        components: []
                    });
                }

                if (interaction.customId === "team_application_decline") {
                    const application = Object.values(TEAM_APPLICATIONS.applications)
                        .find(item => item.userId === interaction.user.id && item.status === "awaiting_acceptance");

                    if (!application) {
                        return interaction.reply({
                            content: "❌ Es wurde keine wartende Bewerbung gefunden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    application.status = "cancelled";
                    application.finishedAt = new Date().toISOString();
                    setTeamApplication(application);
                    return interaction.update({
                        content: "❌ Deine Teambewerbung wurde beendet.",
                        components: []
                    });
                }

                if (interaction.customId.startsWith("team_application_test:")) {
                    if (!hasApplicationReviewPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Du darfst keine Testbewerbungen bearbeiten.", flags: MessageFlags.Ephemeral });
                    }
                    const action = interaction.customId.split(":")[1];
                    const labels = { accept: "✅ Testbewerbung angenommen", reject: "❌ Testbewerbung abgelehnt", oral: "🎙️ Mündliche Testbewerbung erfolgreich", delete: "🗑️ Testbewerbung gelöscht" };
                    if (!labels[action]) return interaction.reply({ content: "❌ Unbekannte Testaktion.", flags: MessageFlags.Ephemeral });
                    const updatedEmbeds = interaction.message.embeds.map(embed => EmbedBuilder.from(embed).setColor(action === "accept" ? 0x2ecc71 : 0xed4245));
                    return interaction.update({
                        content: `${interaction.message.content}\n\n${labels[action]} von <@${interaction.user.id}> (nur Simulation – keine echten Rollen/DMs)`,
                        allowedMentions: { parse: [] },
                        embeds: updatedEmbeds,
                        components: []
                    });
                }

                if (interaction.customId.startsWith("team_application_delete:")) {
                    if (!hasApplicationReviewPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast keine Berechtigung, Bewerbungen zu löschen.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const [, guildId, userId] = interaction.customId.split(":");
                    const application = getTeamApplication(userId, guildId);
                    if (!application) {
                        return interaction.reply({
                            content: "ℹ️ Diese Bewerbung wurde bereits gelöscht.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (!deleteTeamApplication(guildId, userId)) {
                        return interaction.reply({
                            content: "❌ Die Bewerbung konnte nicht gelöscht werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const guild = await client.guilds.fetch(guildId).catch(() => null);
                    if (guild) {
                        const applicant = await guild.members.fetch(userId).catch(() => null);
                        if (applicant) {
                            const applicationRoleIds = [
                                ...APPLICATION_TEAM_ROLE_IDS
                            ].filter(Boolean);
                            await Promise.all(applicationRoleIds.map(roleId => (
                                applicant.roles.cache.has(roleId)
                                    ? applicant.roles.remove(roleId)
                                    : Promise.resolve()
                            ))).catch(error => {
                                console.error("❌ Bewerbungsrollen konnten nicht entfernt werden:", error);
                            });
                        }
                    }

                    return interaction.update({
                        content: `${interaction.message.content}\n\n🗑️ Diese Bewerbung wurde von <@${interaction.user.id}> gelöscht. Der Nutzer kann sich jetzt erneut bewerben.`,
                        components: []
                    });
                }

                if (interaction.customId.startsWith("team_application_accept:") || interaction.customId.startsWith("team_application_reject:") || interaction.customId.startsWith("team_application_oral_success:")) {
                    if (!hasApplicationReviewPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ Du hast keine Berechtigung, Bewerbungen zu bearbeiten.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const [action, guildId, userId] = interaction.customId.split(":");
                    const application = getTeamApplication(userId, guildId);
                    if (!application || application.status === "rejected") {
                        return interaction.reply({
                            content: "❌ Diese Bewerbung wurde nicht gefunden oder bereits abgelehnt.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const applicant = await client.users.fetch(userId).catch(() => null);
                    const guild = await client.guilds.fetch(guildId).catch(() => null);

                    if (action === "team_application_accept" && (!guild || !APPLICATION_ACCEPTED_ROLE_ID)) {
                        return interaction.reply({
                            content: "❌ Es ist keine Annahme-Rolle konfiguriert.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (action === "team_application_oral_success") {
                        if (!guild || APPLICATION_ORAL_ROLE_IDS.length === 0) {
                            return interaction.reply({
                                content: "❌ Für die mündliche Bewerbung sind noch keine Rollen konfiguriert.",
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        const results = await Promise.all(APPLICATION_ORAL_ROLE_IDS.map(roleId => assignApplicationRole(guild, userId, roleId)));
                        application.oralStatus = results.every(Boolean) ? "successful" : "role_error";
                        application.oralCompletedAt = new Date().toISOString();
                        setTeamApplication(application);
                        if (applicant) {
                            await applicant.send("✅ Deine mündliche Bewerbung wurde erfolgreich abgeschlossen.").catch(error => console.error("❌ DM zur mündlichen Bewerbung fehlgeschlagen:", error));
                        }
                        return interaction.reply({ content: "✅ Die mündliche Bewerbung wurde gespeichert.", flags: MessageFlags.Ephemeral });
                    }

                    if (action === "team_application_accept" && guild) {
                        // Nur beim Annehmen wird die konfigurierte Annahme-Rolle vergeben.
                        const roleAssigned = await assignApplicationRole(guild, userId, APPLICATION_ACCEPTED_ROLE_ID);
                        if (!roleAssigned) {
                            return interaction.reply({
                                content: "❌ Die Annahme-Rolle konnte nicht vergeben werden. Die Bewerbung bleibt offen.",
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        application.teamRolesAssigned = true;
                    }

                    application.status = action === "team_application_accept" ? "accepted" : "rejected";
                    application.decision = application.status;
                    application.decisionBy = interaction.user.id;
                    application.decidedAt = new Date().toISOString();

                    setTeamApplication(application);

                    const decisionText = application.status === "accepted"
                        ? "✅ Bewerbung angenommen"
                        : "❌ Bewerbung abgelehnt";
                    const decisionColor = application.status === "accepted"
                        ? 0x2ecc71
                        : 0xed4245;
                    const updatedEmbeds = interaction.message.embeds.map(embed =>
                        EmbedBuilder.from(embed).setColor(decisionColor)
                    );
                    await interaction.update({
                        content: `${interaction.message.content}\n\n${decisionText} von <@${interaction.user.id}> am ${formatGermanTime(new Date())}`,
                        embeds: updatedEmbeds,
                        components: []
                    });
                    if (applicant) {
                        await applicant.send(
                            application.status === "accepted"
                                ? "Deine Teambewerbung wurde angenommen. Wir freuen uns auf dich!"
                                : "Deine Teambewerbung wurde abgelehnt."
                        ).catch(error => console.error("❌ Bewerbungsentscheidung konnte nicht per DM gesendet werden:", error));
                    }
                    return;
                }

                // =============================================
                // TEAMVERWALTUNG – KANAL-EINSTELLUNGEN
                // =============================================

                if (interaction.customId === "team_management") {
                    // Bot-Owner Prüfung
                    if (!isBotOwner(interaction.member)) {
                        // Logge den verweigerten Zugriff
                        try {
                            await log({
                                type: "TEAM",
                                action: "Teamverwaltung Zugriff verweigert",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: "Versuchter Zugriff auf Teamverwaltung ohne Bot-Owner-Berechtigung",
                                status: "Fehlgeschlagen"
                            });
                        } catch (error) {
                            console.error("❌ Fehler beim Loggen von verweigertem Teamverwaltung-Zugriff:", error);
                        }

                        return interaction.reply({
                            content: "🔒 **Keine Berechtigung**\nDie Teamverwaltung kann ausschließlich vom Bot-Owner verwendet werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Logge den erfolgreichen Zugriff
                    try {
                        await log({
                            type: "TEAM",
                            action: "Teamverwaltung geöffnet",
                            user: interaction.user,
                            channel: interaction.channel,
                            guild: interaction.guild,
                            details: "Bot-Owner hat Teamverwaltung geöffnet",
                            status: "Erfolgreich"
                        });
                    } catch (error) {
                        console.error("❌ Fehler beim Loggen von Teamverwaltung-Zugriff:", error);
                    }

                    return interaction.reply({
                        ...createTeamManagementPanel(interaction.guild),
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.customId === "team_mgmt_back") {
                    if (!hasTeamPermission(interaction.member)) {
                        return interaction.update({ content: "❌ Du hast dafür keine Berechtigung.", components: [] });
                    }

                    return interaction.update(createTeamPanel());
                }

                if (
                    interaction.customId === "team_mgmt_set_rank" ||
                    interaction.customId === "team_mgmt_set_warn" ||
                    interaction.customId === "team_mgmt_set_kick"
                ) {
                    if (!hasTeamManagementPermission(interaction.member)) {
                        // Logge den verweigerten Zugriff
                        try {
                            await log({
                                type: "TEAM",
                                action: "Teamverwaltung Zugriff verweigert",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: `Versuchter Zugriff auf ${interaction.customId} ohne Bot-Owner-Berechtigung`,
                                status: "Fehlgeschlagen"
                            });
                        } catch (error) {
                            console.error("❌ Fehler beim Loggen von verweigertem Teamverwaltung-Zugriff:", error);
                        }

                        return interaction.update({ content: "🔒 **Keine Berechtigung**\nDie Teamverwaltung kann ausschließlich vom Bot-Owner verwendet werden.", components: [] });
                    }

                    const type = interaction.customId.replace("team_mgmt_set_", "");

                    return interaction.update(
                        createTeamManagementChannelSelector(interaction.guild, 0, type)
                    );
                }

                if (interaction.customId.startsWith("team_mgmt_page_prev_") || interaction.customId.startsWith("team_mgmt_page_next_")) {
                    if (!hasTeamManagementPermission(interaction.member)) {
                        // Logge den verweigerten Zugriff
                        try {
                            await log({
                                type: "TEAM",
                                action: "Teamverwaltung Zugriff verweigert",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: `Versuchter Zugriff auf ${interaction.customId} ohne Bot-Owner-Berechtigung`,
                                status: "Fehlgeschlagen"
                            });
                        } catch (error) {
                            console.error("❌ Fehler beim Loggen von verweigertem Teamverwaltung-Zugriff:", error);
                        }

                        return interaction.update({ content: "🔒 **Keine Berechtigung**\nDie Teamverwaltung kann ausschließlich vom Bot-Owner verwendet werden.", components: [] });
                    }

                    const isPrev = interaction.customId.startsWith("team_mgmt_page_prev_");
                    const prefix = isPrev ? "team_mgmt_page_prev_" : "team_mgmt_page_next_";
                    const [pageStr, type] = interaction.customId.replace(prefix, "").split("_");
                    const currentPage = Number(pageStr) || 0;
                    const newPage = isPrev ? currentPage - 1 : currentPage + 1;

                    return interaction.update(
                        createTeamManagementChannelSelector(interaction.guild, newPage, type)
                    );
                }

                if (interaction.customId.startsWith("team_mgmt_page_back_")) {
                    if (!hasTeamManagementPermission(interaction.member)) {
                        // Logge den verweigerten Zugriff
                        try {
                            await log({
                                type: "TEAM",
                                action: "Teamverwaltung Zugriff verweigert",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: `Versuchter Zugriff auf ${interaction.customId} ohne Bot-Owner-Berechtigung`,
                                status: "Fehlgeschlagen"
                            });
                        } catch (error) {
                            console.error("❌ Fehler beim Loggen von verweigertem Teamverwaltung-Zugriff:", error);
                        }

                        return interaction.update({ content: "🔒 **Keine Berechtigung**\nDie Teamverwaltung kann ausschließlich vom Bot-Owner verwendet werden.", components: [] });
                    }

                    return interaction.update(createTeamManagementPanel(interaction.guild));
                }

                if (interaction.customId.startsWith("team_mgmt_change_")) {
                    if (!hasTeamManagementPermission(interaction.member)) {
                        // Logge den verweigerten Zugriff
                        try {
                            await log({
                                type: "TEAM",
                                action: "Teamverwaltung Zugriff verweigert",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: `Versuchter Zugriff auf ${interaction.customId} ohne Bot-Owner-Berechtigung`,
                                status: "Fehlgeschlagen"
                            });
                        } catch (error) {
                            console.error("❌ Fehler beim Loggen von verweigertem Teamverwaltung-Zugriff:", error);
                        }

                        return interaction.update({ content: "🔒 **Keine Berechtigung**\nDie Teamverwaltung kann ausschließlich vom Bot-Owner verwendet werden.", components: [] });
                    }

                    const type = interaction.customId.replace("team_mgmt_change_", "");

                    return interaction.update(
                        createTeamManagementChannelSelector(interaction.guild, 0, type)
                    );
                }

                if (interaction.customId === "team_mgmt_status_back") {
                    if (!hasTeamManagementPermission(interaction.member)) {
                        // Logge den verweigerten Zugriff
                        try {
                            await log({
                                type: "TEAM",
                                action: "Teamverwaltung Zugriff verweigert",
                                user: interaction.user,
                                channel: interaction.channel,
                                guild: interaction.guild,
                                details: `Versuchter Zugriff auf ${interaction.customId} ohne Bot-Owner-Berechtigung`,
                                status: "Fehlgeschlagen"
                            });
                        } catch (error) {
                            console.error("❌ Fehler beim Loggen von verweigertem Teamverwaltung-Zugriff:", error);
                        }

                        return interaction.update({ content: "🔒 **Keine Berechtigung**\nDie Teamverwaltung kann ausschließlich vom Bot-Owner verwendet werden.", components: [] });
                    }

                    return interaction.update(createTeamManagementPanel(interaction.guild));
                }

                if (
                    interaction.isButton() &&
                    (
                        interaction.customId.startsWith("team_uprank_page_") ||
                        interaction.customId.startsWith("team_degrade_page_")
                    )
                ) {
                    const isUprank = interaction.customId.startsWith("team_uprank_page_");
                    const prefix = isUprank ? "team_uprank_page_" : "team_degrade_page_";
                    const pageData = interaction.customId.slice(prefix.length);
                    const separatorIndex = pageData.lastIndexOf("_");
                    if (separatorIndex <= 0) {
                        return interaction.reply(
                            errorMessage("Die Rollenauswahl ist ungültig. Bitte öffne sie erneut.")
                        );
                    }

                    const targetId = pageData.slice(0, separatorIndex);
                    const page = Number(pageData.slice(separatorIndex + 1));
                    const action = isUprank ? "uprank" : "degrade";

                    if (
                        !Number.isInteger(page) ||
                        page < 0 ||
                        !hasUprankDownrankPermission(interaction.member)
                    ) {
                        return interaction.reply(
                            errorMessage("Du hast dafür keine Berechtigung oder die Auswahlseite ist ungültig.")
                        );
                    }

                    const target = await interaction.guild.members.fetch(targetId).catch(() => null);
                    if (!target) {
                        return interaction.reply(
                            errorMessage("Das ausgewählte Mitglied wurde nicht gefunden.")
                        );
                    }

                    await refreshTeamRoleData(interaction.guild);
                    return interaction.update(
                        createTeamRoleSelectionPayload(interaction.guild, target, action, page)
                    );
                }

                const actions = {
                    team_uprank:
                        "uprank",
                    team_warn:
                        "warn",
                    team_degrade:
                        "degrade",
                    team_warnback:
                        "warnback",
                    team_kick:
                        "kick"
                };

                const action =
                    actions[
                        interaction.customId
                    ];

                if (
                    action
                ) {

                    if (
                        !hasTeamPermission(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Du hast dafür keine Berechtigung.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        (
                            action ===
                                "uprank" ||
                            action ===
                                "degrade"
                        ) &&
                        !hasUprankDownrankPermission(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Du hast dafür keine Berechtigung.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        ...createUserSelector(
                            action
                        ),
                        flags:
                            MessageFlags.Ephemeral
                    });
                }
            }

            // =================================================
            // TEAM USER SELECT
            // =================================================

            if (
                interaction.isUserSelectMenu()
            ) {

                if (
                    !interaction.customId.startsWith(
                        "select_user_"
                    )
                ) {
                    return;
                }

                const action =
                    interaction.customId.replace(
                        "select_user_",
                        ""
                    );

                const userId =
                    interaction.values[0];

                if (action === "uprank" || action === "degrade") {
                    if (!hasUprankDownrankPermission(interaction.member)) {
                        return interaction.reply(
                            errorMessage("Du hast dafür keine Berechtigung.")
                        );
                    }

                    const target = await interaction.guild.members.fetch(userId).catch(() => null);
                    if (!target) {
                        return interaction.reply(errorMessage("Das ausgewählte Mitglied wurde nicht gefunden."));
                    }
                    if (!hasConfiguredTeamRole(target)) {
                        return interaction.reply(errorMessage("Uprank und Degradierung sind nur für Mitglieder mit einer konfigurierten Teamrolle möglich."));
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    try {
                        await refreshTeamRoleData(interaction.guild);
                        const assignableRoles = getAssignableTeamRoles(interaction.guild);

                        if (assignableRoles.length === 0) {
                            return interaction.editReply({
                                content: `❌ ${getNoAssignableTeamRolesMessage(interaction.guild)}`,
                                embeds: [],
                                components: []
                            });
                        }

                        return interaction.editReply(
                            createTeamRoleSelectionPayload(
                                interaction.guild,
                                target,
                                action
                            )
                        );
                    } catch (error) {
                        console.error("❌ Fehler beim Laden der Teamrollen-Auswahl:", error);
                        return interaction.editReply({
                            content: "❌ Die Teamrollen konnten nicht geladen werden. Bitte versuche es erneut.",
                            embeds: [],
                            components: []
                        });
                    }
                }

                const target =
                    await interaction.guild.members
                        .fetch(
                            userId
                        )
                        .catch(
                            () => null
                        );

                if (!target) {
                    return interaction.reply({
                        content:
                            "❌ Benutzer wurde nicht gefunden.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (!claimTeamActionInteraction(interaction)) {
                    return;
                }

                // =============================================
                // KICK (entfernt Team-/höhere Rollen, kickt NICHT
                // mehr vom Discord-Server)
                // =============================================

                if (action === "kick") {

                    if (target.id === interaction.user.id) {
                        return interaction.reply(
                            errorMessage("Du kannst diese Aktion nicht auf dich selbst anwenden.")
                        );
                    }

                    if (target.id === interaction.guild.ownerId) {
                        return interaction.reply(
                            errorMessage("Der Serverbesitzer kann nicht bearbeitet werden.")
                        );
                    }

                    await refreshTeamRoleData(interaction.guild);
                    const botMember = interaction.guild.members.me;
                    if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                        return interaction.reply(
                            errorMessage("Dem Bot fehlt die Berechtigung „Rollen verwalten“.")
                        );
                    }

                    const teamRolesToRemove = getAllTeamNicknameRoles()
                        .map(entry => interaction.guild.roles.cache.get(entry.roleId))
                        .filter(role =>
                            role &&
                            role.id !== BUERGER_ROLE_ID &&
                            target.roles.cache.has(role.id)
                        );
                    if (teamRolesToRemove.length === 0) {
                        return interaction.reply(
                            errorMessage("Dieses Mitglied besitzt keine Teamrollen, die entfernt werden könnten.")
                        );
                    }

                    const blockedTeamRole = teamRolesToRemove.find(role =>
                        botMember.roles.highest.position <= role.position
                    );
                    if (blockedTeamRole) {
                        return interaction.reply(
                            errorMessage(`Die Teamrolle „${blockedTeamRole.name}“ steht auf oder über der höchsten Bot-Rolle.`)
                        );
                    }

                    const removedRoleIds = await removeAllTeamRoles(
                        target,
                        `Team-Kick durch ${interaction.user.tag}`
                    ).catch(error => {
                        console.error("❌ Fehler beim Entfernen der Teamrollen (Kick):", error);
                        return null;
                    });

                    if (removedRoleIds === null) {
                        return interaction.reply(
                            errorMessage("Beim Entfernen der Rollen ist ein Fehler aufgetreten.")
                        );
                    }

                    if (removedRoleIds.length === 0) {
                        return interaction.reply(
                            errorMessage("Dieses Mitglied besitzt keine Team-/höheren Rollen, die entfernt werden könnten.")
                        );
                    }

                    const removedRoleNames = removedRoleIds
                        .map(roleId => interaction.guild.roles.cache.get(roleId)?.name)
                        .filter(Boolean);

                    let kickLogError = null;
                    await teamKickLog(
                        interaction.guild,
                        target,
                        interaction.member,
                        `Team-Kick (Rollenentzug) durch ${interaction.user.tag}`,
                        removedRoleNames
                    ).catch(error => {
                        kickLogError = error;
                        console.error("❌ Team-Kick wurde ausgeführt, aber das Log konnte nicht gesendet werden:", error);
                    });

                    // Zusätzliche, rein additive Speicherung für !teamstatistik:
                    // merkt sich, dass bei diesem Mitglied bereits ein
                    // Team-Kick durchgeführt wurde, ohne die bestehende
                    // Kick-Logik oben zu verändern.
                    addTeamKickEntry(interaction.guild.id, target.id, {
                        moderatorId: interaction.user.id,
                        moderatorTag: interaction.user.tag,
                        removedRoles: removedRoleNames,
                        timestamp: new Date().toISOString()
                    });

                    await updateTeamList(
                        interaction.guild,
                        TEAMLIST_AUTO_UPDATE_CHANNEL_ID
                    ).catch(() => {});

                    return interaction.reply({
                        content:
                            `✅ **${target.user.tag}** wurde aus dem Team entfernt. Alle Teamrollen wurden entzogen, die Bürgerrolle und sonstige Rollen bleiben erhalten.` +
                            (kickLogError ? `\n⚠️ Der Vorgang wurde ausgeführt, aber das Log konnte nicht gesendet werden: ${kickLogError.message}` : ""),
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =============================================
                // WARN – Schritt 1: Grund per Modal abfragen
                // =============================================

                if (action === "warn") {
                    if (!hasConfiguredTeamRole(target)) {
                        return interaction.reply(errorMessage("Verwarnungen über dieses Panel sind nur für Mitglieder mit einer konfigurierten Teamrolle möglich."));
                    }

                    const activeWarnCount = getActiveWarns(interaction.guild.id, target.id).length;

                    if (activeWarnCount >= MAX_ACTIVE_WARNS) {
                        return interaction.reply(
                            errorMessage(`Dieses Mitglied hat bereits ${MAX_ACTIVE_WARNS}/${MAX_ACTIVE_WARNS} aktive Warnungen. Es können keine weiteren Warnungen vergeben werden.`)
                        );
                    }

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                `team_warn_reason_modal_${target.id}`
                            )
                            .setTitle(
                                "Verwarnung – Grund"
                            );

                    const reasonInput =
                        new TextInputBuilder()
                            .setCustomId(
                                "team_warn_reason_input"
                            )
                            .setLabel(
                                "Grund der Verwarnung"
                            )
                            .setStyle(
                                TextInputStyle.Paragraph
                            )
                            .setRequired(true)
                            .setMaxLength(1000);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(reasonInput)
                    );

                    return interaction.showModal(modal);
                }

                // =============================================
                // WARNEN ZURÜCK – Schritt 1: Warns des Mitglieds
                // anzeigen
                // =============================================

                if (action === "warnback") {
                    const warns = getUserWarns(interaction.guild.id, target.id);
                    const previousWarns = [...warns];
                    warns.length = 0;
                    if (!saveWarnStorage()) {
                        warns.push(...previousWarns);
                        return interaction.reply(errorMessage("Die gespeicherten Warnungen konnten nicht zurückgesetzt werden."));
                    }

                    let roleSyncError = null;
                    try {
                        await syncWarnRoleForMember(target);
                    } catch (error) {
                        roleSyncError = error;
                        console.error("❌ Warnungen wurden zurückgesetzt, Warnrollen konnten aber nicht vollständig entfernt werden:", error);
                    }

                    const resetEmbed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle("✅ TEAM-WARNUNGEN ZURÜCKGESETZT")
                        .addFields(
                            { name: "Mitglied", value: `${target}\n${target.user.tag}`, inline: true },
                            { name: "Ausgeführt von", value: `${interaction.user}\n${interaction.user.tag}`, inline: true },
                            { name: "Entfernte Verwarnungen", value: String(previousWarns.length), inline: true },
                            { name: "Zeitpunkt", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                        )
                        .setFooter({ text: teamLogFooterText() })
                        .setTimestamp();
                    let resetLogError = null;
                    try {
                        await sendRequiredTeamManagementLog(interaction.guild, "warn", resetEmbed);
                    } catch (error) {
                        resetLogError = error;
                        console.error("❌ Warnungen wurden zurückgesetzt, aber das Team-Updates-Log konnte nicht gesendet werden:", error);
                    }

                    return interaction.reply({
                        content: `✅ Alle ${previousWarns.length} gespeicherten Warnungen von **${target.user.tag}** wurden zurückgesetzt.` +
                            (roleSyncError ? `\n⚠️ Warnrollen konnten nicht vollständig entfernt werden: ${roleSyncError.message}` : "") +
                            (resetLogError ? `\n⚠️ Das Team-Updates-Log konnte nicht gesendet werden: ${resetLogError.message}` : ""),
                        flags: MessageFlags.Ephemeral
                    });
                }

            }

            // =================================================
            // TEAMVERWALTUNG – Kanal wurde ausgewählt
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId.startsWith("team_mgmt_channel_select_")
            ) {

                if (!hasTeamManagementPermission(interaction.member)) {
                    // Logge den verweigerten Zugriff
                    try {
                        await log({
                            type: "TEAM",
                            action: "Teamverwaltung Zugriff verweigert",
                            user: interaction.user,
                            channel: interaction.channel,
                            guild: interaction.guild,
                            details: `Versuchter Zugriff auf ${interaction.customId} ohne Bot-Owner-Berechtigung`,
                            status: "Fehlgeschlagen"
                        });
                    } catch (error) {
                        console.error("❌ Fehler beim Loggen von verweigertem Teamverwaltung-Zugriff:", error);
                    }

                    return interaction.update({ content: "🔒 **Keine Berechtigung**\nDie Teamverwaltung kann ausschließlich vom Bot-Owner verwendet werden.", components: [] });
                }

                const type = interaction.customId.replace("team_mgmt_channel_select_", "");
                const channelId = interaction.values[0];

                if (!TEAM_MANAGEMENT_TYPES[type]) {
                    return interaction.update({ content: "❌ Ungültiger Teamverwaltungs-Typ.", components: [] });
                }

                setTeamManagementChannel(interaction.guild.id, type, channelId);

                return interaction.update(
                    createTeamManagementStatusScreen(interaction.guild, type)
                );
            }

            // =================================================
            // UP-RANK / DEGRADIEREN – Schritt 2: Rolle gewählt,
            // Bestätigung anzeigen
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                (
                    interaction.customId.startsWith("team_uprank_role_") ||
                    interaction.customId.startsWith("team_degrade_role_")
                )
            ) {
                if (!claimTeamActionInteraction(interaction)) {
                    return;
                }

                const isUprank = interaction.customId.startsWith("team_uprank_role_");
                const prefix = isUprank ? "team_uprank_role_" : "team_degrade_role_";
                const targetId = interaction.customId.replace(prefix, "");
                const roleId = interaction.values[0];

                if (
                    !hasUprankDownrankPermission(interaction.member)
                ) {
                    return interaction.reply(
                        errorMessage("Du hast dafür keine Berechtigung.")
                    );
                }

                const target = await interaction.guild.members.fetch(targetId).catch(() => null);
                const role = interaction.guild.roles.cache.get(roleId);

                if (!target || !role) {
                    return interaction.reply(
                        errorMessage("Mitglied oder Rolle wurde nicht gefunden.")
                    );
                }

                if (!hasConfiguredTeamRole(target)) {
                    return interaction.reply(errorMessage("Das ausgewählte Mitglied hat keine konfigurierte Teamrolle mehr."));
                }

                if (!getAllTeamNicknameRoles().some(entry => entry.roleId === role.id)) {
                    return interaction.reply(errorMessage("Diese Rolle ist nicht als Teamrolle konfiguriert."));
                }

                if (target.id === interaction.user.id || target.id === interaction.guild.ownerId) {
                    return interaction.reply(errorMessage("Du kannst diese Person nicht bearbeiten."));
                }

                await interaction.deferUpdate();
                try {
                    await refreshTeamRoleData(interaction.guild);
                    const botMember = interaction.guild.members.me;
                    if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                        throw new Error("Dem Bot fehlt die Berechtigung „Rollen verwalten“.");
                    }
                    if (botMember.roles.highest.position <= role.position) {
                        throw new Error("Die neue Teamrolle steht auf oder über der höchsten Bot-Rolle.");
                    }

                    const currentTeamRoles = getAllTeamNicknameRoles()
                        .map(entry => interaction.guild.roles.cache.get(entry.roleId))
                        .filter(currentRole =>
                            currentRole &&
                            currentRole.id !== role.id &&
                            target.roles.cache.has(currentRole.id)
                        );
                    if (currentTeamRoles.some(currentRole =>
                        botMember.roles.highest.position <= currentRole.position
                    )) {
                        throw new Error("Mindestens eine bisherige Teamrolle steht auf oder über der höchsten Bot-Rolle.");
                    }

                    const currentRole = currentTeamRoles
                        .sort((first, second) => second.position - first.position)[0];
                    const reason = `Rangänderung über Team-Panel durch ${interaction.user.tag}`;
                    const alreadyHadRole = target.roles.cache.has(role.id);

                    if (!alreadyHadRole) {
                        await target.roles.add(role, reason);
                    }
                    try {
                        if (currentTeamRoles.length > 0) {
                            await target.roles.remove(currentTeamRoles, reason);
                        }
                    } catch (error) {
                        if (!alreadyHadRole) {
                            await target.roles.remove(role, "Rangänderung fehlgeschlagen; Änderung zurückgerollt").catch(rollbackError =>
                                console.error("❌ Neue Teamrolle konnte nach fehlgeschlagener Rangänderung nicht zurückgerollt werden:", rollbackError)
                            );
                        }
                        throw error;
                    }

                    const oldRoleName = currentRole?.name || "Keine bisherige Teamrolle";
                    if (isUprank) {
                        setLastUprank(interaction.guild.id, target.id, {
                            roleId: role.id,
                            roleName: role.name,
                            reason,
                            moderatorId: interaction.user.id,
                            moderatorTag: interaction.user.tag,
                            timestamp: new Date().toISOString()
                        });
                    }

                    const logEmbed = new EmbedBuilder()
                        .setColor(isUprank ? 0x57F287 : 0xED4245)
                        .setTitle(isUprank ? "⏫ TEAM UPRANK" : "⏬ TEAM DEGRADIERUNG")
                        .setDescription([
                            TEAM_LOG_DIVIDER,
                            `👤 MITGLIED: ${target}`,
                            TEAM_LOG_DIVIDER,
                            `👮 DURCH: ${interaction.user}`,
                            TEAM_LOG_DIVIDER,
                            "📝 RANGÄNDERUNG:",
                            `⬇️ Von: ${currentRole ? `<@&${currentRole.id}>` : oldRoleName}`,
                            `⬆️ Auf: <@&${role.id}>`,
                            TEAM_LOG_DIVIDER,
                            `📝 GRUND: > ${reason}`,
                            TEAM_LOG_DIVIDER,
                            `🕐 Wann: ${formatTeamLogTimestamp()}`,
                            TEAM_LOG_DIVIDER
                        ].join("\n"))
                        .setFooter({ text: teamLogFooterText() })
                        .setTimestamp();

                    let rankLogError = null;
                    try {
                        await sendRequiredTeamManagementLog(interaction.guild, "rank", logEmbed);
                    } catch (logError) {
                        rankLogError = logError;
                        console.error("❌ Rangänderung wurde durchgeführt, aber der Team-Updates-Log konnte nicht gesendet werden:", logError);
                    }

                    await updateTeamList(interaction.guild, TEAMLIST_AUTO_UPDATE_CHANNEL_ID).catch(error =>
                        console.error("❌ Teamliste konnte nach Rangänderung nicht aktualisiert werden:", error)
                    );
                    return interaction.editReply({
                        content: `✅ **${target.user.tag}** hat jetzt die Team-Hauptrolle **${role.name}**.` +
                            (rankLogError ? `\n⚠️ Das Log konnte nicht gesendet werden: ${rankLogError.message}` : ""),
                        components: []
                    });
                } catch (error) {
                    console.error("❌ Fehler bei Uprank/Degradierung:", error);
                    return interaction.editReply({
                        content: `❌ Rangänderung fehlgeschlagen: ${error.message}`,
                        components: []
                    });
                }
            }

            // =================================================
            // DOWN-RANK – Modal abgeschickt, Bestätigung anzeigen
            // =================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith("team_degrade_reason_modal_")
            ) {

                if (!hasUprankDownrankPermission(interaction.member)) {
                    return interaction.reply(
                        errorMessage("Du hast dafür keine Berechtigung.")
                    );
                }

                const [targetId, roleId] = interaction.customId
                    .replace("team_degrade_reason_modal_", "")
                    .split("_");

                const reason = interaction.fields.getTextInputValue("team_degrade_reason_input");

                const target = await interaction.guild.members.fetch(targetId).catch(() => null);
                const role = interaction.guild.roles.cache.get(roleId);

                if (!target || !role) {
                    return interaction.reply(
                        errorMessage("Mitglied oder Rolle wurde nicht gefunden.")
                    );
                }

                pendingDegradeReasons.set(`${interaction.user.id}_${targetId}`, {
                    reason,
                    roleId
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`team_degrade_confirm_${target.id}_${role.id}`)
                        .setLabel("Bestätigen")
                        .setEmoji("✅")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`team_degrade_cancel_${target.id}`)
                        .setLabel("Abbrechen")
                        .setEmoji("❌")
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({
                    content:
                        `**Down-Rank bestätigen**\n` +
                        `Mitglied: **${target.user.tag}**\n` +
                        `Neue Rolle: **${role.name}**\n` +
                        `Grund: \`${reason}\``,
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
            }

            // =================================================
            // UP-RANK – Modal abgeschickt, Bestätigung anzeigen
            // =================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith("team_uprank_reason_modal_")
            ) {

                if (!hasUprankDownrankPermission(interaction.member)) {
                    return interaction.reply(
                        errorMessage("Du hast dafür keine Berechtigung.")
                    );
                }

                const [targetId, roleId] = interaction.customId
                    .replace("team_uprank_reason_modal_", "")
                    .split("_");

                const reason = interaction.fields.getTextInputValue("team_uprank_reason_input");

                const target = await interaction.guild.members.fetch(targetId).catch(() => null);
                const role = interaction.guild.roles.cache.get(roleId);

                if (!target || !role) {
                    return interaction.reply(
                        errorMessage("Mitglied oder Rolle wurde nicht gefunden.")
                    );
                }

                pendingUprankReasons.set(`${interaction.user.id}_${targetId}`, {
                    reason,
                    roleId
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`team_uprank_confirm_${target.id}_${role.id}`)
                        .setLabel("Bestätigen")
                        .setEmoji("✅")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`team_uprank_cancel_${target.id}`)
                        .setLabel("Abbrechen")
                        .setEmoji("❌")
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({
                    content:
                        `**Up-Rank bestätigen**\n` +
                        `Mitglied: **${target.user.tag}**\n` +
                        `Neue Rolle: **${role.name}**\n` +
                        `Grund: \`${reason}\``,
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
            }

            // =================================================
            // UP-RANK / DEGRADIEREN – Schritt 3: Bestätigung
            // =================================================

            if (
                interaction.isButton() &&
                (
                    interaction.customId.startsWith("team_uprank_confirm_") ||
                    interaction.customId.startsWith("team_degrade_confirm_")
                )
            ) {

                const isUprank = interaction.customId.startsWith("team_uprank_confirm_");
                const prefix = isUprank ? "team_uprank_confirm_" : "team_degrade_confirm_";
                const [targetId, roleId] = interaction.customId.replace(prefix, "").split("_");

                if (
                    !hasUprankDownrankPermission(interaction.member)
                ) {
                    return interaction.reply(
                        errorMessage("Du hast dafür keine Berechtigung.")
                    );
                }

                const target = await interaction.guild.members.fetch(targetId).catch(() => null);
                const newRole = interaction.guild.roles.cache.get(roleId);

                if (!target || !newRole) {
                    return interaction.update({
                        content: "❌ Mitglied oder Rolle wurde nicht gefunden.",
                        components: []
                    });
                }

                // Sowohl Up-Rank als auch Down-Rank benötigen zwingend den
                // zuvor per Modal erfassten Grund - ohne gültige (nicht
                // abgelaufene) Sitzung wird abgebrochen.
                const pendingKey = `${interaction.user.id}_${targetId}`;
                const pendingReasonMap = isUprank ? pendingUprankReasons : pendingDegradeReasons;
                const pendingReasonEntry = pendingReasonMap.get(pendingKey);

                if (!pendingReasonEntry || pendingReasonEntry.roleId !== roleId) {
                    return interaction.update({
                        content: `❌ Die Sitzung ist abgelaufen. Bitte starte den ${isUprank ? "Up-Rank" : "Down-Rank"} erneut.`,
                        components: []
                    });
                }

                const rankChangeReason = pendingReasonEntry.reason;

                const botHighestPosition = interaction.guild.members.me.roles.highest.position;

                if (botHighestPosition <= newRole.position) {
                    return interaction.update({
                        content: "❌ Meine Bot-Rolle muss über der Zielrolle stehen.",
                        components: []
                    });
                }

                try {
                    const currentEntry = getMemberCurrentTeamRoleEntry(target);
                    const oldRole = currentEntry ? interaction.guild.roles.cache.get(currentEntry.roleId) : null;
                    const oldRoleName = oldRole ? oldRole.name : "—";

                    if (currentEntry && currentEntry.roleId !== newRole.id) {
                        await target.roles.remove(currentEntry.roleId, `Teamverwaltung: ${interaction.user.tag}`);
                    }

                    if (!target.roles.cache.has(newRole.id)) {
                        await target.roles.add(newRole, `Teamverwaltung: ${interaction.user.tag}`);
                    }

                    await updateTeamList(
                        interaction.guild,
                        TEAMLIST_AUTO_UPDATE_CHANNEL_ID
                    ).catch(() => {});

                    pendingReasonMap.delete(pendingKey);

                    // Zusätzliche, rein additive Speicherung für !teamstatistik:
                    // merkt sich ausschließlich bei einem tatsächlichen Up-Rank
                    // (nicht bei Down-Rank) die zuletzt vergebene Rolle, ohne die
                    // bestehende Up-/Down-Rank-Logik oben zu verändern.
                    if (isUprank) {
                        setLastUprank(interaction.guild.id, target.id, {
                            roleId: newRole.id,
                            roleName: newRole.name,
                            reason: rankChangeReason,
                            moderatorId: interaction.user.id,
                            moderatorTag: interaction.user.tag,
                            timestamp: new Date().toISOString()
                        });
                    }

                    const logDescription = [
                        TEAM_LOG_DIVIDER,
                        `👤 MITGLIED: ${target} | ${target.user.tag}`,
                        TEAM_LOG_DIVIDER,
                        `👮 DURCH: ${interaction.user}`,
                        TEAM_LOG_DIVIDER,
                        `📝 RANGÄNDERUNG:`,
                        `⬇️ Von: ${oldRole ? `<@&${oldRole.id}>` : oldRoleName}`,
                        `⬆️ Auf: <@&${newRole.id}>`,
                        TEAM_LOG_DIVIDER,
                        `📝 GRUND: > ${rankChangeReason}`,
                        TEAM_LOG_DIVIDER,
                        `🕐 Wann: ${formatTeamLogTimestamp()}`,
                        TEAM_LOG_DIVIDER
                    ].join("\n");

                    const logEmbed = new EmbedBuilder()
                        .setColor(isUprank ? 0x57F287 : 0xED4245)
                        .setTitle(isUprank ? "⏫ TEAM UPRANK" : "⏬ TEAM DOWNRANK")
                        .setDescription(logDescription)
                        .setFooter({
                            text: teamLogFooterText()
                        });

                    await sendTeamManagementLog(interaction.guild, "rank", logEmbed).catch(() => {});

                    return interaction.update({
                        content:
                            `✅ **${target.user.tag}** wurde ${isUprank ? "hochgestuft" : "degradiert"} auf **${newRole.name}**.`,
                        components: []
                    });

                } catch (error) {
                    console.error("❌ Fehler bei Uprank/Degradieren:", error);
                    return interaction.update({
                        content: "❌ Fehler beim Ändern der Rolle.",
                        components: []
                    });
                }
            }

            if (
                interaction.isButton() &&
                (
                    interaction.customId.startsWith("team_uprank_cancel_") ||
                    interaction.customId.startsWith("team_degrade_cancel_")
                )
            ) {
                if (interaction.customId.startsWith("team_degrade_cancel_")) {
                    const targetId = interaction.customId.replace("team_degrade_cancel_", "");
                    pendingDegradeReasons.delete(`${interaction.user.id}_${targetId}`);
                } else {
                    const targetId = interaction.customId.replace("team_uprank_cancel_", "");
                    pendingUprankReasons.delete(`${interaction.user.id}_${targetId}`);
                }

                return interaction.update({
                    content: "❌ Vorgang abgebrochen.",
                    components: []
                });
            }

            // =================================================
            // WARN – Schritt 2: Modal abgeschickt, Dauer auswählen
            // =================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith("team_warn_reason_modal_")
            ) {

                const targetId = interaction.customId.replace("team_warn_reason_modal_", "");

                if (!hasTeamPermission(interaction.member)) {
                    return interaction.reply(errorMessage("Du hast dafür keine Berechtigung."));
                }

                const reason = interaction.fields.getTextInputValue("team_warn_reason_input");

                pendingWarnReasons.set(`${interaction.user.id}_${targetId}`, {
                    reason,
                    moderatorTag: interaction.user.tag
                });

                const options = WARN_DURATION_OPTIONS.map(option =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(option.label)
                        .setValue(option.value)
                );

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`team_warn_duration_${targetId}`)
                        .setPlaceholder("⏱️ Dauer der Verwarnung auswählen")
                        .addOptions(options)
                );

                return interaction.reply({
                    content: "**Wie lange soll die Verwarnung gültig sein?**",
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
            }

            // =================================================
            // WARN – Schritt 3: Dauer gewählt, Bestätigung anzeigen
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId.startsWith("team_warn_duration_")
            ) {
                if (!claimTeamActionInteraction(interaction)) {
                    return;
                }

                const targetId = interaction.customId.replace("team_warn_duration_", "");

                if (!hasTeamPermission(interaction.member)) {
                    return interaction.update({ content: "❌ Du hast dafür keine Berechtigung.", components: [] });
                }

                const durationValue = interaction.values[0];
                const pending = pendingWarnReasons.get(`${interaction.user.id}_${targetId}`);

                if (!pending) {
                    return interaction.update({
                        content: "❌ Die Sitzung ist abgelaufen. Bitte starte die Verwarnung erneut.",
                        components: []
                    });
                }

                const durationOption = getWarnDurationOption(durationValue);

                if (!durationOption) {
                    return interaction.update({
                        content: "❌ Ungültige Dauer ausgewählt.",
                        components: []
                    });
                }

                const target = await interaction.guild.members.fetch(targetId).catch(() => null);

                if (!target) {
                    pendingWarnReasons.delete(`${interaction.user.id}_${targetId}`);
                    return interaction.update({
                        content: "❌ Benutzer wurde nicht gefunden.",
                        components: []
                    });
                }
                if (!hasConfiguredTeamRole(target)) {
                    pendingWarnReasons.delete(`${interaction.user.id}_${targetId}`);
                    return interaction.update({
                        content: "❌ Das ausgewählte Mitglied hat keine konfigurierte Teamrolle mehr.",
                        components: []
                    });
                }

                const pendingKey = `${interaction.user.id}_${targetId}`;
                if (getActiveWarns(interaction.guild.id, target.id).length >= MAX_ACTIVE_WARNS) {
                    pendingWarnReasons.delete(pendingKey);
                    return interaction.update({
                        content: `❌ Dieses Mitglied hat bereits ${MAX_ACTIVE_WARNS}/${MAX_ACTIVE_WARNS} aktive Warnungen.`,
                        components: []
                    });
                }

                const now = Date.now();
                const expiresAt = durationOption.ms === null
                    ? null
                    : new Date(now + durationOption.ms).toISOString();
                let warn;
                try {
                    warn = addWarnEntry(interaction.guild.id, target.id, {
                        userTag: target.user.tag,
                        discordId: target.id,
                        reason: pending.reason,
                        createdAt: new Date(now).toISOString(),
                        expiresAt,
                        moderatorId: interaction.user.id,
                        moderatorTag: interaction.user.tag
                    });
                } catch (error) {
                    console.error("❌ Warnung konnte nicht gespeichert werden:", error);
                    return interaction.update({
                        content: `❌ Die Verwarnung konnte nicht gespeichert werden: ${error.message}`,
                        components: []
                    });
                }

                pendingWarnReasons.delete(pendingKey);
                const activeWarnCount = Math.min(
                    getActiveWarns(interaction.guild.id, target.id).length,
                    MAX_ACTIVE_WARNS
                );
                let roleSyncError = null;
                try {
                    await syncWarnRoleForMember(target);
                } catch (error) {
                    roleSyncError = error;
                    console.error("❌ Verwarnung gespeichert, aber Warnrolle konnte nicht synchronisiert werden:", error);
                }

                const warnLogEmbed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle("⚠️ TEAM WARN")
                    .setDescription([
                        TEAM_LOG_DIVIDER,
                        `👤 MITGLIED: ${target}`,
                        TEAM_LOG_DIVIDER,
                        `👮 DURCH: ${interaction.user}`,
                        TEAM_LOG_DIVIDER,
                        `📊 WARNUNGEN: ${activeWarnCount}/${MAX_ACTIVE_WARNS}`,
                        TEAM_LOG_DIVIDER,
                        `⏳ DAUER: ${durationOption.label}`,
                        TEAM_LOG_DIVIDER,
                        `📝 GRUND: > ${warn.reason.slice(0, 900)}`,
                        TEAM_LOG_DIVIDER,
                        `🕐 Wann: ${formatTeamLogTimestamp(new Date(now))}`,
                        TEAM_LOG_DIVIDER
                    ].join("\n"))
                    .setFooter({ text: teamLogFooterText() })
                    .setTimestamp(new Date(now));
                let warnLogError = null;
                try {
                    await sendRequiredTeamManagementLog(interaction.guild, "warn", warnLogEmbed);
                } catch (error) {
                    warnLogError = error;
                    console.error("❌ Warnung wurde gespeichert, aber das Warn-Log konnte nicht gesendet werden:", error);
                }

                return interaction.update({
                    content:
                        `✅ **${target.user.tag}** wurde verwarnt (${activeWarnCount}/${MAX_ACTIVE_WARNS}).\n` +
                        `Grund: \`${warn.reason}\`\n` +
                        `Ablauf: \`${formatWarnExpiry(warn)}\`` +
                        (roleSyncError ? `\n⚠️ Die Warnung ist gespeichert, aber die Warnrolle konnte nicht vergeben werden: ${roleSyncError.message}` : "") +
                        (warnLogError ? `\n⚠️ Das Warn-Log konnte nicht gesendet werden: ${warnLogError.message}` : ""),
                    components: []
                });
            }

            // =================================================
            // WARN – Schritt 4: Bestätigung
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith("team_warn_confirm_")
            ) {

                if (!hasTeamPermission(interaction.member)) {
                    return interaction.update({ content: "❌ Du hast dafür keine Berechtigung.", components: [] });
                }

                const rest = interaction.customId.replace("team_warn_confirm_", "");
                const lastUnderscore = rest.lastIndexOf("_");
                const targetId = rest.slice(0, lastUnderscore);
                const durationValue = rest.slice(lastUnderscore + 1);

                const pendingKey = `${interaction.user.id}_${targetId}`;
                const pending = pendingWarnReasons.get(pendingKey);

                if (!pending) {
                    return interaction.update({
                        content: "❌ Die Sitzung ist abgelaufen. Bitte starte die Verwarnung erneut.",
                        components: []
                    });
                }

                const durationOption = getWarnDurationOption(durationValue);
                const target = await interaction.guild.members.fetch(targetId).catch(() => null);

                if (!target || !durationOption) {
                    pendingWarnReasons.delete(pendingKey);
                    return interaction.update({
                        content: "❌ Mitglied oder Dauer ungültig.",
                        components: []
                    });
                }
                if (!hasConfiguredTeamRole(target)) {
                    pendingWarnReasons.delete(pendingKey);
                    return interaction.update({
                        content: "❌ Das ausgewählte Mitglied hat keine konfigurierte Teamrolle mehr.",
                        components: []
                    });
                }

                // Sicherheitsprüfung gegen die Obergrenze aktiver Warnungen,
                // falls sich der Bestand zwischen Schritt 1 und der
                // Bestätigung geändert hat.
                if (getActiveWarns(interaction.guild.id, target.id).length >= MAX_ACTIVE_WARNS) {
                    pendingWarnReasons.delete(pendingKey);
                    return interaction.update({
                        content: `❌ Dieses Mitglied hat bereits ${MAX_ACTIVE_WARNS}/${MAX_ACTIVE_WARNS} aktive Warnungen.`,
                        components: []
                    });
                }

                const now = Date.now();
                const expiresAt = durationOption.ms === null ? null : new Date(now + durationOption.ms).toISOString();

                const warn = addWarnEntry(interaction.guild.id, target.id, {
                    userTag: target.user.tag,
                    discordId: target.id,
                    reason: pending.reason,
                    createdAt: new Date(now).toISOString(),
                    expiresAt,
                    moderatorId: interaction.user.id,
                    moderatorTag: interaction.user.tag
                });

                pendingWarnReasons.delete(pendingKey);

                await syncWarnRoleForMember(target).catch(() => {});

                const activeWarnCount = Math.min(
                    getActiveWarns(interaction.guild.id, target.id).length,
                    MAX_ACTIVE_WARNS
                );

                const warnLogDescription = [
                    TEAM_LOG_DIVIDER,
                    `👤 MITGLIED: ${target} | ${target.user.tag}`,
                    TEAM_LOG_DIVIDER,
                    `👮 DURCH: ${interaction.user}`,
                    TEAM_LOG_DIVIDER,
                    ` ⚠️ WARNUNGEN: ${activeWarnCount}/${MAX_ACTIVE_WARNS}`,
                    TEAM_LOG_DIVIDER,
                    ` ⏳ DAUER: ${durationOption.label}`,
                    TEAM_LOG_DIVIDER,
                    ` 📝 GRUND: > ${warn.reason}`,
                    TEAM_LOG_DIVIDER,
                    ` 🕐 Wann: ${formatTeamLogTimestamp()}`,
                    TEAM_LOG_DIVIDER
                ].join("\n");

                const warnLogEmbed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle("⚠️ TEAM WARN")
                    .setDescription(warnLogDescription)
                    .setFooter({
                        text: teamLogFooterText()
                    });

                await sendTeamManagementLog(interaction.guild, "warn", warnLogEmbed).catch(() => {});

                return interaction.update({
                    content:
                        `⚠️ **${target.user.tag}** wurde verwarnt.\n` +
                        `Grund: \`${warn.reason}\`\n` +
                        `Ablauf: \`${formatWarnExpiry(warn)}\``,
                    components: []
                });
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith("team_warn_cancel_")
            ) {
                const targetId = interaction.customId.replace("team_warn_cancel_", "");
                pendingWarnReasons.delete(`${interaction.user.id}_${targetId}`);
                return interaction.update({
                    content: "❌ Verwarnung abgebrochen.",
                    components: []
                });
            }

            // =================================================
            // WARNEN ZURÜCK – Schritt 2: Warn gewählt, Aktionen
            // anzeigen
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId.startsWith("team_warnback_select_")
            ) {

                if (!hasTeamPermission(interaction.member)) {
                    return interaction.update({ content: "❌ Du hast dafür keine Berechtigung.", components: [] });
                }

                const targetId = interaction.customId.replace("team_warnback_select_", "");
                const warnId = interaction.values[0];
                const warn = findWarnEntry(interaction.guild.id, targetId, warnId);

                if (!warn) {
                    return interaction.update({
                        content: "❌ Diese Warnung wurde nicht gefunden (evtl. bereits entfernt).",
                        components: []
                    });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`team_warnback_remove_${targetId}_${warnId}`)
                        .setLabel("Komplett entfernen")
                        .setEmoji("🗑️")
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`team_warnback_shorten_${targetId}_${warnId}`)
                        .setLabel("Verkürzen")
                        .setEmoji("⏱️")
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`team_warnback_extend_${targetId}_${warnId}`)
                        .setLabel("Verlängern")
                        .setEmoji("⏳")
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.update({
                    content:
                        `**⚠️ Ausgewählte Warnung**\n` +
                        `Grund: \`${warn.reason}\`\n` +
                        `Erstellt: \`${formatGermanTime(new Date(warn.createdAt))}\`\n` +
                        `Ablauf: \`${formatWarnExpiry(warn)}\`\n` +
                        `Ausgeführt von: \`${warn.moderatorTag}\``,
                    components: [row]
                });
            }

            // =================================================
            // WARNEN ZURÜCK – Komplett entfernen
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith("team_warnback_remove_")
            ) {

                if (!hasTeamPermission(interaction.member)) {
                    return interaction.update({ content: "❌ Du hast dafür keine Berechtigung.", components: [] });
                }

                const [targetId, warnId] = interaction.customId
                    .replace("team_warnback_remove_", "")
                    .split("_");

                // Anzeige-Nummer VOR dem Entfernen ermitteln, damit sie im
                // Log noch der Position entspricht, die der Teamler sah.
                const warnLabel = getWarnDisplayLabel(interaction.guild.id, targetId, warnId);

                const removed = removeWarnEntry(interaction.guild.id, targetId, warnId);

                if (!removed) {
                    return interaction.update({
                        content: "❌ Diese Warnung wurde nicht gefunden (evtl. bereits entfernt).",
                        components: []
                    });
                }

                const target = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (target) {
                    await syncWarnRoleForMember(target).catch(() => {});
                    await sendWarnbackLog(
                        interaction.guild,
                        target,
                        warnLabel,
                        "Komplett entfernt",
                        "—",
                        interaction.member
                    ).catch(() => {});
                }

                return interaction.update({
                    content: `✅ Die Warnung wurde vollständig entfernt.`,
                    components: []
                });
            }

            // =================================================
            // WARNEN ZURÜCK – Verkürzen/Verlängern: Dauer auswählen
            // =================================================

            if (
                interaction.isButton() &&
                (
                    interaction.customId.startsWith("team_warnback_shorten_") ||
                    interaction.customId.startsWith("team_warnback_extend_")
                )
            ) {

                if (!hasTeamPermission(interaction.member)) {
                    return interaction.update({ content: "❌ Du hast dafür keine Berechtigung.", components: [] });
                }

                const isShorten = interaction.customId.startsWith("team_warnback_shorten_");
                const prefix = isShorten ? "team_warnback_shorten_" : "team_warnback_extend_";
                const [targetId, warnId] = interaction.customId.replace(prefix, "").split("_");

                const warn = findWarnEntry(interaction.guild.id, targetId, warnId);

                if (!warn) {
                    return interaction.update({
                        content: "❌ Diese Warnung wurde nicht gefunden (evtl. bereits entfernt).",
                        components: []
                    });
                }

                if (isWarnPermanent(warn)) {
                    return interaction.update({
                        content:
                            isShorten
                                ? "❌ Eine dauerhafte Warnung kann nicht verkürzt werden – nutze stattdessen \"Komplett entfernen\"."
                                : "ℹ️ Diese Warnung ist bereits dauerhaft.",
                        components: []
                    });
                }

                const optionsList = isShorten ? WARN_SHORTEN_OPTIONS : WARN_EXTEND_OPTIONS;
                const durationPrefix = isShorten
                    ? "team_warnback_duration_shorten_"
                    : "team_warnback_duration_extend_";

                const options = optionsList.map(option =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(option.label)
                        .setValue(option.value)
                );

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`${durationPrefix}${targetId}_${warnId}`)
                        .setPlaceholder(isShorten ? "⏱️ Um wie viel verkürzen?" : "⏳ Um wie viel verlängern?")
                        .addOptions(options)
                );

                return interaction.update({
                    content: `**Um wie viel soll die Warnung ${isShorten ? "verkürzt" : "verlängert"} werden?**`,
                    components: [row]
                });
            }

            // =================================================
            // WARNEN ZURÜCK – Verkürzen/Verlängern: anwenden
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                (
                    interaction.customId.startsWith("team_warnback_duration_shorten_") ||
                    interaction.customId.startsWith("team_warnback_duration_extend_")
                )
            ) {

                if (!hasTeamPermission(interaction.member)) {
                    return interaction.update({ content: "❌ Du hast dafür keine Berechtigung.", components: [] });
                }

                const isShorten = interaction.customId.startsWith("team_warnback_duration_shorten_");
                const prefix = isShorten ? "team_warnback_duration_shorten_" : "team_warnback_duration_extend_";
                const [targetId, warnId] = interaction.customId.replace(prefix, "").split("_");
                const durationValue = interaction.values[0];

                const warn = findWarnEntry(interaction.guild.id, targetId, warnId);
                const durationOption = getWarnDurationOption(durationValue);

                if (!warn || !durationOption) {
                    return interaction.update({
                        content: "❌ Warnung oder Dauer ungültig.",
                        components: []
                    });
                }

                const now = Date.now();
                const currentExpiry = new Date(warn.expiresAt).getTime();
                const baseTime = Math.max(currentExpiry, now);

                const newExpiry = isShorten
                    ? Math.max(now, currentExpiry - durationOption.ms)
                    : baseTime + durationOption.ms;

                warn.expiresAt = new Date(newExpiry).toISOString();
                saveWarnStorage();

                const target = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (target) {
                    await syncWarnRoleForMember(target).catch(() => {});
                    await sendWarnbackLog(
                        interaction.guild,
                        target,
                        getWarnDisplayLabel(interaction.guild.id, targetId, warnId),
                        isShorten ? "Verkürzt" : "Verlängert",
                        formatWarnExpiry(warn),
                        interaction.member
                    ).catch(() => {});
                }

                return interaction.update({
                    content:
                        `✅ Die Warnung wurde ${isShorten ? "verkürzt" : "verlängert"}.\n` +
                        `Neue Ablaufzeit: \`${formatWarnExpiry(warn)}\``,
                    components: []
                });
            }

            // =================================================
            // TEAMSTATISTIK – MITGLIED AUSGEWÄHLT
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId === "teamstatistik_select"
            ) {

                if (!hasProtectedCommandPermission(interaction.member)) {
                    return interaction.reply(errorMessage("Du hast dafür keine Berechtigung."));
                }

                const targetId = interaction.values[0];
                const target = await interaction.guild.members.fetch(targetId).catch(() => null);

                if (!target) {
                    return interaction.reply(errorMessage("Dieses Mitglied wurde nicht gefunden."));
                }

                const memberEmbed = buildTeamStatistikMemberEmbed(interaction.guild, target);
                const totalWarns = getUserWarns(interaction.guild.id, target.id).length;

                const warnsButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`teamstatistik_warns_${target.id}`)
                        .setLabel("Team-Warns ansehen")
                        .setEmoji("⚠️")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(totalWarns === 0)
                );

                return interaction.reply({
                    embeds: [memberEmbed],
                    components: [warnsButtonRow],
                    flags: MessageFlags.Ephemeral
                });
            }

            // =================================================
            // TEAMSTATISTIK – WARN-LISTE ANZEIGEN
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith("teamstatistik_warns_")
            ) {

                if (!hasProtectedCommandPermission(interaction.member)) {
                    return interaction.update({
                        content: "❌ Du hast dafür keine Berechtigung.",
                        embeds: [],
                        components: []
                    });
                }

                const targetId = interaction.customId.replace("teamstatistik_warns_", "");
                const target = await interaction.guild.members.fetch(targetId).catch(() => null);

                if (!target) {
                    return interaction.update({
                        content: "❌ Dieses Mitglied wurde nicht gefunden.",
                        embeds: [],
                        components: []
                    });
                }

                const memberWarns = getUserWarns(interaction.guild.id, target.id);

                if (memberWarns.length === 0) {
                    return interaction.update({
                        content: `⚠️ **${target.user.tag}** hat keine gespeicherten Team-Warns.`,
                        embeds: [],
                        components: []
                    });
                }

                const warnOptions = memberWarns.slice(0, 25).map((warn, index) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`Warn #${index + 1} – ${warn.reason.slice(0, 80)}`)
                        .setDescription(`Erstellt: ${formatGermanTime(new Date(warn.createdAt))}`.slice(0, 100))
                        .setValue(warn.id)
                );

                const warnSelectRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`teamstatistik_warn_select_${target.id}`)
                        .setPlaceholder("⚠️ Warnung auswählen")
                        .addOptions(warnOptions)
                );

                return interaction.update({
                    content: `**⚠️ Team-Warns von ${target.user.tag} (${memberWarns.length})**\nWähle eine Warnung aus, um Details zu sehen.`,
                    embeds: [],
                    components: [warnSelectRow]
                });
            }

            // =================================================
            // TEAMSTATISTIK – EINZELNE WARNUNG ANZEIGEN
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId.startsWith("teamstatistik_warn_select_")
            ) {

                if (!hasProtectedCommandPermission(interaction.member)) {
                    return interaction.update({
                        content: "❌ Du hast dafür keine Berechtigung.",
                        embeds: [],
                        components: []
                    });
                }

                const targetId = interaction.customId.replace("teamstatistik_warn_select_", "");
                const warnId = interaction.values[0];
                const warn = findWarnEntry(interaction.guild.id, targetId, warnId);

                if (!warn) {
                    return interaction.update({
                        content: "❌ Diese Warnung wurde nicht gefunden (evtl. bereits entfernt).",
                        embeds: [],
                        components: []
                    });
                }

                return interaction.update({
                    content:
                        `**⚠️ Warnungsdetails**\n` +
                        `📅 Datum: \`${formatGermanTime(new Date(warn.createdAt))}\`\n` +
                        `⏳ Dauer: \`${getWarnDurationLabel(warn)}\`\n` +
                        `📝 Grund: \`${warn.reason}\`\n` +
                        `👮 Ausgeführt von: \`${warn.moderatorTag}\``,
                    embeds: [],
                    components: []
                });
            }

            // =================================================
            // TEXTSENDE – KANAL
            // =================================================

            if (
                interaction.isChannelSelectMenu() &&
                interaction.customId ===
                    "textsende_channel"
            ) {

                const channelId =
                    interaction.values[0];

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            `textsende_modal_${channelId}`
                        )
                        .setTitle(
                            "📨 Nachricht senden"
                        );

                const input =
                    new TextInputBuilder()
                        .setCustomId(
                            "message_text"
                        )
                        .setLabel(
                            "Nachricht"
                        )
                        .setPlaceholder(
                            "Gib hier deine Nachricht ein..."
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            4000
                        );

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            input
                        )
                );

                return interaction.showModal(
                    modal
                );
            }

            // =================================================
            // RP TEXT ÄNDERN – MODAL START
            // =================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "rp_edit_start_modal"
            ) {

                const title =
                    interaction.fields.getTextInputValue(
                        "rp_start_title"
                    );
                const description =
                    interaction.fields.getTextInputValue(
                        "rp_start_description"
                    );
                const success =
                    interaction.fields.getTextInputValue(
                        "rp_start_success"
                    );
                const rolePing =
                    interaction.fields.getTextInputValue(
                        "rp_start_role_ping"
                    );

                // Aktualisiere die Konfiguration
                RP_START_TITLE = title;
                RP_START_DESCRIPTION = description;
                RP_START_SUCCESS = success;
                RP_PING_ROLE_ID = rolePing || null;

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x57F287)
                            .setTitle(
                                "✅ RP Start Text aktualisiert"
                            )
                            .setDescription(
                                "Der Text für RP Start wurde erfolgreich geändert."
                            )
                            .addFields(
                                {
                                    name:
                                        "📝 Titel",
                                    value: title,
                                    inline: false
                                },
                                {
                                    name:
                                        "📄 Beschreibung",
                                    value: description,
                                    inline: false
                                },
                                {
                                    name:
                                        "✅ Erfolg",
                                    value: success,
                                    inline: false
                                },
                                {
                                    name:
                                        "🔔 Rollen-Ping",
                                    value: rolePing ?
                                        `<@&${rolePing}>` :
                                        "Keine Rolle konfiguriert",
                                    inline: false
                                }
                            )
                            .setFooter({
                                text:
                                    "Vexo RP ✧ 𝙑𝘾 • RP-System"
                            })
                    ],
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // =================================================
            // RP TEXT ÄNDERN – MODAL STOPP
            // =================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "rp_edit_stop_modal"
            ) {

                const title =
                    interaction.fields.getTextInputValue(
                        "rp_stop_title"
                    );
                const description =
                    interaction.fields.getTextInputValue(
                        "rp_stop_description"
                    );
                const success =
                    interaction.fields.getTextInputValue(
                        "rp_stop_success"
                    );
                const rolePing =
                    interaction.fields.getTextInputValue(
                        "rp_stop_role_ping"
                    );

                // Aktualisiere die Konfiguration
                RP_STOP_TITLE = title;
                RP_STOP_DESCRIPTION = description;
                RP_STOP_SUCCESS = success;
                RP_PING_ROLE_ID = rolePing || null;

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x57F287)
                            .setTitle(
                                "✅ RP Stop Text aktualisiert"
                            )
                            .setDescription(
                                "Der Text für RP Stop wurde erfolgreich geändert."
                            )
                            .addFields(
                                {
                                    name:
                                        "📝 Titel",
                                    value: title,
                                    inline: false
                                },
                                {
                                    name:
                                        "📄 Beschreibung",
                                    value: description,
                                    inline: false
                                },
                                {
                                    name:
                                        "✅ Erfolg",
                                    value: success,
                                    inline: false
                                },
                                {
                                    name:
                                        "🔔 Rollen-Ping",
                                    value: rolePing ?
                                        `<@&${rolePing}>` :
                                        "Keine Rolle konfiguriert",
                                    inline: false
                                }
                            )
                            .addFields(
                                {
                                    name:
                                        "📝 Titel",
                                    value: title,
                                    inline: false
                                },
                                {
                                    name:
                                        "📄 Beschreibung",
                                    value: description,
                                    inline: false
                                },
                                {
                                    name:
                                        "✅ Erfolg",
                                    value: success,
                                    inline: false
                                }
                            )
                            .setFooter({
                                text:
                                    "Vexo RP ✧ 𝙑𝘾 • RP-System"
                            })
                    ],
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // =================================================
            // TEXTSENDE – MODAL
            // =================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith(
                    "textsende_modal_"
                )
            ) {

                const channelId =
                    interaction.customId.replace(
                        "textsende_modal_",
                        ""
                    );

                const text =
                    interaction.fields.getTextInputValue(
                        "message_text"
                    );

                const channel =
                    await interaction.guild.channels
                        .fetch(
                            channelId
                        )
                        .catch(
                            () => null
                        );

                if (
                    !channel ||
                    !channel.isTextBased()
                ) {
                    return interaction.reply(
                        errorMessage(
                            "Der ausgewählte Kanal wurde nicht gefunden."
                        )
                    );
                }

                await channel.send({
                    content:
                        text,
                    allowedMentions: {
                        parse: [
                            "users",
                            "roles",
                            "everyone"
                        ]
                    }
                });

                return interaction.reply({
                    content:
                        `✅ Nachricht wurde erfolgreich in ${channel} gesendet.`,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // =================================================
            // VERIFIZIERUNG - START
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId === "verify_start"
            ) {

                const member = interaction.member;
                
                // Prüfen ob bereits verifiziert
                if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    return interaction.reply({
                        content: "**ℹ️ Bereits verifiziert**\n\nDu bist bereits verifiziert und kannst diesen Vorgang nicht erneut durchführen.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                // Prüfen ob Benutzer die unverifizierte Rolle hat
                if (!member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                    return interaction.reply({
                        content: "**❌ Keine Verifizierung möglich**\n\nDu hast nicht die benötigte Rolle für die Verifizierung oder bist bereits verifiziert.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                // Captcha erstellen
                const captcha = createCaptcha();
                
                // Captcha-Antwort serverseitig speichern (in Map mit UserID)
                if (!global.captchaAnswers) {
                    global.captchaAnswers = new Map();
                }
                global.captchaAnswers.set(interaction.user.id, {
                    correctAnswer: captcha.correctAnswer,
                    timestamp: Date.now()
                });
                
                // Captcha nach 30 Sekunden löschen
                setTimeout(() => {
                    global.captchaAnswers.delete(interaction.user.id);
                }, 30000);
                
                return interaction.reply({
                    ...await createCaptchaPanel(captcha),
                    flags: MessageFlags.Ephemeral
                });
            }

            // =================================================
            // VERIFIZIERUNG - CAPTCHA ANTWORT
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId === "captcha_select"
            ) {

                const userAnswer = interaction.values[0];
                const userId = interaction.user.id;
                
                // Prüfen ob Captcha noch gültig
                if (!global.captchaAnswers || !global.captchaAnswers.has(userId)) {
                    return interaction.reply({
                        content: VERIFICATION_TEXT.EXPIRED_CAPTCHA,
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                const captchaData = global.captchaAnswers.get(userId);
                
                // Prüfen ob Antwort korrekt
                if (userAnswer !== captchaData.correctAnswer) {
                    global.captchaAnswers.delete(userId);
                    return interaction.reply({
                        content: VERIFICATION_TEXT.WRONG_CAPTCHA,
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                // Verifizierung erfolgreich
                const member = interaction.member;
                
                try {
                    // Unverifizierte Rolle entfernen
                    await member.roles.remove(UNVERIFIED_ROLE_ID, "Erfolgreiche Verifizierung");
                    
                    // Verifizierte Rolle hinzufügen
                    await member.roles.add(VERIFIED_ROLE_ID, "Erfolgreiche Verifizierung");
                    
                    // Captcha-Daten löschen
                    global.captchaAnswers.delete(userId);
                    
                    // Zähler erhöhen (für Backup)
                    incrementVerificationCount();
                    
                    // ===== LIVE-PANEL AKTUALISIEREN =====
                    // Das Panel wird mit echten Discord-Zahlen aktualisiert, nicht mit Zählern
                    await updateVerificationPanelLive(interaction.guild);
                    
                    await logBotEvent(
                        interaction.guild,
                        "🛡️ VERIFIZIERUNG",
                        [
                            { name: "👤 Benutzer", value: `${interaction.user}` },
                            { name: "🆔 ID", value: interaction.user.id },
                            { name: "✅ Status", value: "Erfolgreich" },
                            { name: "🕐 Zeitpunkt", value: formatGermanTime(new Date()) }
                        ],
                        0x57F287,
                        { updatePanel: true }
                    );

                    incrementBotStat("verificationsCompleted");
                    await updateStatisticsPanelForGuild(interaction.guild);

                    return interaction.reply({
                        content: VERIFICATION_TEXT.SUCCESS,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error("❌ Fehler bei der Verifizierung:", error);
                    return interaction.reply({
                        content: "❌ Ein Fehler ist aufgetreten. Bitte versuche es später erneut.",
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            // =================================================
            // SELBSTZERSTÖRUNG-PANEL (NUR BOT-OWNER)
            // =================================================
            // Alle Interaktionen dieses Panels rufen ausschließlich
            // executeSelfDestruction() auf (siehe oben) – es gibt
            // keine eigene/zweite Selbstzerstörungs-Logik. Die
            // Owner-Prüfung erfolgt serverseitig bei JEDER
            // einzelnen Interaktion, damit niemand außer dem
            // Bot-Owner das Panel öffnen oder die Selbstzerstörung
            // darüber auslösen kann.

            const isSelfDestructPanelInteraction =
                (
                    interaction.isButton() ||
                    interaction.isStringSelectMenu() ||
                    interaction.isModalSubmit()
                ) &&
                typeof interaction.customId === "string" &&
                interaction.customId.startsWith("selfdestruct_panel_");

            if (isSelfDestructPanelInteraction) {

                if (!isBotOwner(interaction.member)) {
                    return interaction.reply(
                        errorMessage(
                            "Nur der Bot-Owner darf das Selbstzerstörung-Panel verwenden."
                        )
                    );
                }

                if (!interaction.guild) {
                    return interaction.reply(
                        errorMessage(
                            "Dieses Panel funktioniert nur auf einem Server."
                        )
                    );
                }

                const panelMessageId = interaction.message?.id;

                if (!panelMessageId) {
                    return interaction.reply(
                        errorMessage(
                            "Dieses Panel ist nicht mehr gültig. Bitte führe !Selbstzerstörung-Panel erneut aus."
                        )
                    );
                }

                if (interaction.customId === "selfdestruct_panel_search") {
                    return interaction.showModal(
                        createSelfDestructSearchModal()
                    );
                }

                if (interaction.customId === "selfdestruct_panel_id") {
                    return interaction.showModal(
                        createSelfDestructIdModal()
                    );
                }

                if (interaction.customId === "selfdestruct_panel_list") {
                    setSelfDestructPanelState(panelMessageId, {
                        mode: "list",
                        query: null,
                        page: 0,
                        selectedUserId: null
                    });

                    return interaction.update(
                        await buildSelfDestructMemberSelectPanel(
                            interaction.guild,
                            "list",
                            null,
                            0
                        )
                    );
                }

                if (interaction.customId === "selfdestruct_panel_back_start") {
                    setSelfDestructPanelState(panelMessageId, {
                        mode: null,
                        query: null,
                        page: 0,
                        selectedUserId: null
                    });

                    return interaction.update(
                        buildSelfDestructStartPanel()
                    );
                }

                if (interaction.customId === "selfdestruct_panel_change") {
                    setSelfDestructPanelState(panelMessageId, {
                        mode: null,
                        query: null,
                        page: 0,
                        selectedUserId: null
                    });

                    return interaction.update(
                        buildSelfDestructStartPanel()
                    );
                }

                if (
                    interaction.customId.startsWith("selfdestruct_panel_list_prev_") ||
                    interaction.customId.startsWith("selfdestruct_panel_list_next_")
                ) {
                    const isNext = interaction.customId.startsWith("selfdestruct_panel_list_next_");
                    const currentPage =
                        parseInt(
                            interaction.customId.replace(
                                isNext ? "selfdestruct_panel_list_next_" : "selfdestruct_panel_list_prev_",
                                ""
                            ),
                            10
                        ) || 0;

                    const newPage = isNext ? currentPage + 1 : Math.max(0, currentPage - 1);

                    setSelfDestructPanelState(panelMessageId, {
                        mode: "list",
                        query: null,
                        page: newPage,
                        selectedUserId: null
                    });

                    return interaction.update(
                        await buildSelfDestructMemberSelectPanel(
                            interaction.guild,
                            "list",
                            null,
                            newPage
                        )
                    );
                }

                if (
                    interaction.customId.startsWith("selfdestruct_panel_search_prev_") ||
                    interaction.customId.startsWith("selfdestruct_panel_search_next_")
                ) {
                    const state = getSelfDestructPanelState(panelMessageId);

                    if (!state || !state.query) {
                        return interaction.reply(
                            errorMessage(
                                "Diese Suche ist nicht mehr gültig. Bitte starte eine neue Suche."
                            )
                        );
                    }

                    const isNext = interaction.customId.startsWith("selfdestruct_panel_search_next_");
                    const currentPage =
                        parseInt(
                            interaction.customId.replace(
                                isNext ? "selfdestruct_panel_search_next_" : "selfdestruct_panel_search_prev_",
                                ""
                            ),
                            10
                        ) || 0;

                    const newPage = isNext ? currentPage + 1 : Math.max(0, currentPage - 1);

                    setSelfDestructPanelState(panelMessageId, {
                        mode: "search",
                        query: state.query,
                        page: newPage,
                        selectedUserId: null
                    });

                    return interaction.update(
                        await buildSelfDestructMemberSelectPanel(
                            interaction.guild,
                            "search",
                            state.query,
                            newPage
                        )
                    );
                }

                if (interaction.customId === "selfdestruct_panel_search_modal") {
                    const query = interaction.fields.getTextInputValue("value").trim();

                    if (!query) {
                        return interaction.reply(
                            errorMessage("Die Suche darf nicht leer sein.")
                        );
                    }

                    setSelfDestructPanelState(panelMessageId, {
                        mode: "search",
                        query: query,
                        page: 0,
                        selectedUserId: null
                    });

                    return interaction.update(
                        await buildSelfDestructMemberSelectPanel(
                            interaction.guild,
                            "search",
                            query,
                            0
                        )
                    );
                }

                if (interaction.customId === "selfdestruct_panel_id_modal") {
                    const rawValue = interaction.fields.getTextInputValue("value").trim();
                    const idMatch = rawValue.match(/\d{15,25}/);
                    const targetId = idMatch ? idMatch[0] : rawValue;

                    const targetMember =
                        await interaction.guild.members.fetch(targetId).catch(() => null);

                    if (!targetMember) {
                        return interaction.reply(
                            errorMessage(
                                "Es wurde kein Mitglied mit dieser ID auf diesem Server gefunden."
                            )
                        );
                    }

                    setSelfDestructPanelState(panelMessageId, {
                        mode: getSelfDestructPanelState(panelMessageId)?.mode || null,
                        query: getSelfDestructPanelState(panelMessageId)?.query || null,
                        page: 0,
                        selectedUserId: targetMember.id
                    });

                    return interaction.update(
                        buildSelfDestructTargetPanel(targetMember)
                    );
                }

                if (interaction.customId === "selfdestruct_panel_select") {
                    const selectedMember =
                        await interaction.guild.members.fetch(interaction.values[0]).catch(() => null);

                    if (!selectedMember) {
                        return interaction.reply(
                            errorMessage(
                                "Dieser Benutzer konnte nicht gefunden werden. Er hat den Server möglicherweise verlassen."
                            )
                        );
                    }

                    const previousState = getSelfDestructPanelState(panelMessageId);

                    setSelfDestructPanelState(panelMessageId, {
                        mode: previousState?.mode || null,
                        query: previousState?.query || null,
                        page: previousState?.page || 0,
                        selectedUserId: selectedMember.id
                    });

                    return interaction.update(
                        buildSelfDestructTargetPanel(selectedMember)
                    );
                }

                if (interaction.customId === "selfdestruct_panel_start") {
                    const state = getSelfDestructPanelState(panelMessageId);

                    if (!state || !state.selectedUserId) {
                        return interaction.reply(
                            errorMessage(
                                "Es ist kein Benutzer ausgewählt. Bitte wähle zuerst einen Benutzer aus."
                            )
                        );
                    }

                    const targetMember =
                        await interaction.guild.members.fetch(state.selectedUserId).catch(() => null);

                    if (!targetMember) {
                        deleteSelfDestructPanelState(panelMessageId);

                        return interaction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xED4245)
                                    .setTitle("❌ Fehler")
                                    .setDescription(
                                        "Dieser Benutzer konnte nicht gefunden werden. Er hat den Server möglicherweise verlassen."
                                    )
                            ],
                            components: []
                        });
                    }

                    // Ab hier läuft exakt der bereits vorhandene
                    // Selbstzerstörungs-Ablauf für den ausgewählten
                    // Benutzer (Countdown, Ping, Rollenentfernung,
                    // finale Nachricht, DM) – identisch zu !Selbstzerstörung.
                    await interaction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle("💥 Selbstzerstörung wird ausgeführt...")
                                .setDescription(
                                    `Die Selbstzerstörung für ${targetMember} läuft jetzt in diesem Kanal.`
                                )
                        ],
                        components: []
                    });

                    const result =
                        await executeSelfDestruction(
                            targetMember,
                            interaction.channel
                        );

                    if (!result.ok) {
                        const reasonText =
                            result.reason === "in_progress"
                                ? "Für diesen Benutzer läuft bereits eine Selbstzerstörung oder seine Rollen werden gerade noch wiederhergestellt."
                                : result.reason === "no_roles"
                                    ? "Dieser Benutzer hat keine Rollen, die entfernt werden könnten."
                                    : "Die Selbstzerstörung konnte nicht gestartet werden.";

                        await interaction.followUp(
                            errorMessage(reasonText)
                        ).catch(() => {});
                    }

                    deleteSelfDestructPanelState(panelMessageId);
            return;
          }
    }

} catch (error) {
    console.error("❌ Fehler in interactionCreate:", error);
}
});
// =====================================================
// SECURITY – NACHRICHT GELÖSCHT
// =====================================================

client.on(
    "messageDelete",
    async message => {

        try {

            if (
                !message.guild ||
                message.author?.bot
            ) {
                return;
            }

            // =========================================
            // LOG-SYSTEM: MESSAGE DELETE
            // =========================================
            try {
                await log({
                    type: "MESSAGE",
                    action: "Nachricht gelöscht",
                    user: message.author,
                    channel: message.channel,
                    guild: message.guild,
                    details: "Nachricht wurde gelöscht",
                    status: "Erfolgreich"
                });
            } catch (error) {
                console.error("❌ Fehler beim Loggen von Message Delete:", error);
            }

            const executor =
                await getLatestAuditLog(
                    message.guild,
                    AuditLogEvent.MessageDelete,
                    message.author.id
                );

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xED4245
                    )
                    .setTitle(
                        "🗑️ Nachricht gelöscht"
                    )
                    .addFields(
                        {
                            name:
                                "👤 Autor",
                            value:
                                `${message.author}\n${message.author.tag}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "📁 Kanal",
                            value:
                                message.channel
                                    ? `[${message.channel.name}](${getChannelLink(
                                        message.guild.id,
                                        message.channel.id
                                    )})`
                                    : "Unbekannt",
                            inline:
                                false
                        },
                        {
                            name:
                                "📝 Inhalt",
                            value:
                                message.content
                                    ? message.content.slice(
                                        0,
                                        1000
                                    )
                                    : "Nicht verfügbar",
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                executor?.executor
                                    ? `${executor.executor}\n${executor.executor.tag}`
                                    : "Unbekannt",
                            inline:
                                false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾 • Security Logs"
                    });

            await sendLog(
                message.guild,
                SECURITY_LOG_CHANNEL_ID,
                embed
            );

        } catch {}
    }
);

// =====================================================
// SECURITY – NACHRICHT EDITIERT
// =====================================================

client.on(
    "messageUpdate",
    async (
        oldMessage,
        newMessage
    ) => {

        try {

            if (
                !newMessage.guild ||
                newMessage.author?.bot ||
                oldMessage.content ===
                    newMessage.content
            ) {
                return;
            }

            // =========================================
            // LOG-SYSTEM: MESSAGE UPDATE
            // =========================================
            try {
                await log({
                    type: "MESSAGE",
                    action: "Nachricht bearbeitet",
                    user: newMessage.author,
                    channel: newMessage.channel,
                    guild: newMessage.guild,
                    details: "Nachricht wurde bearbeitet",
                    status: "Erfolgreich"
                });
            } catch (error) {
                console.error("❌ Fehler beim Loggen von Message Update:", error);
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xFEE75C
                    )
                    .setTitle(
                        "✏️ Nachricht bearbeitet"
                    )
                    .addFields(
                        {
                            name:
                                "👤 Benutzer",
                            value:
                                `${newMessage.author}\n${newMessage.author.tag}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "📁 Kanal",
                            value:
                                `[${newMessage.channel.name}](${getChannelLink(
                                    newMessage.guild.id,
                                    newMessage.channel.id,
                                    newMessage.id
                                )})`,
                            inline:
                                false
                        },
                        {
                            name:
                                "📝 Vorher",
                            value:
                                oldMessage.content
                                    ? oldMessage.content.slice(
                                        0,
                                        1000
                                    )
                                    : "Leer",
                            inline:
                                false
                        },
                        {
                            name:
                                "📝 Nachher",
                            value:
                                newMessage.content
                                    ? newMessage.content.slice(
                                        0,
                                        1000
                                    )
                                    : "Leer",
                            inline:
                                false
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text:
                            "Vexo RP ✧ 𝙑𝘾• Security Logs"
                    });

            await sendLog(
                newMessage.guild,
                SECURITY_LOG_CHANNEL_ID,
                embed
            );

        } catch {}
    }
);

// =====================================================
// SECURITY – ROLE CREATE
// =====================================================

client.on(
    "roleCreate",
    async role => {

        // =========================================
        // LOG-SYSTEM: ROLE CREATE
        // (komplett try/catch-abgesichert, damit dieses
        // Event den Bot-Prozess niemals zum Absturz bringt)
        // =========================================
        try {
            const entry =
                await getLatestAuditLog(
                    role.guild,
                    AuditLogEvent.RoleCreate,
                    role.id
                );

            if (typeof logRoleAction === "function") {
                await logRoleAction(
                    "Rolle erstellt",
                    entry?.executor || role.guild.client.user,
                    role,
                    null,
                    "Erfolgreich",
                    null
                );
            } else {
                console.error("❌ logRoleAction ist keine Funktion (Import/Export von logger.js prüfen) - Logging übersprungen.");
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0x57F287
                    )
                    .setTitle(
                        "🎭 Rolle erstellt"
                    )
                    .addFields(
                        {
                            name:
                                "🎭 Rolle",
                            value:
                                `${role}\n${role.name}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                entry?.executor
                                    ? `${entry.executor}\n${entry.executor.tag}`
                                    : "Unbekannt",
                            inline:
                                false
                        }
                    )
                    .setTimestamp();

            await sendLog(
                role.guild,
                SECURITY_LOG_CHANNEL_ID,
                embed
            );
        } catch (error) {
            console.error("❌ Fehler beim Loggen von Role Create:", error);
        }
    }
);

// =====================================================
// SECURITY – ROLE DELETE
// =====================================================

client.on(
    "roleDelete",
    async role => {

        // =========================================
        // LOG-SYSTEM: ROLE DELETE
        // (komplett try/catch-abgesichert, damit dieses
        // Event den Bot-Prozess niemals zum Absturz bringt)
        // =========================================
        try {
            const entry =
                await getLatestAuditLog(
                    role.guild,
                    AuditLogEvent.RoleDelete,
                    role.id
                );

            if (typeof logRoleAction === "function") {
                await logRoleAction(
                    "Rolle gelöscht",
                    entry?.executor || role.guild.client.user,
                    role,
                    null,
                    "Erfolgreich",
                    null
                );
            } else {
                console.error("❌ logRoleAction ist keine Funktion (Import/Export von logger.js prüfen) - Logging übersprungen.");
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xED4245
                    )
                    .setTitle(
                        "🗑️ Rolle gelöscht"
                    )
                    .addFields(
                        {
                            name:
                                "🎭 Rolle",
                            value:
                                role.name,
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                entry?.executor
                                    ? `${entry.executor}\n${entry.executor.tag}`
                                    : "Unbekannt",
                            inline:
                                false
                        }
                    )
                    .setTimestamp();

            await sendLog(
                role.guild,
                SECURITY_LOG_CHANNEL_ID,
                embed
            );
        } catch (error) {
            console.error("❌ Fehler beim Loggen von Role Delete:", error);
        }
    }
);

// =====================================================
// SECURITY – ROLE UPDATE
// =====================================================

client.on(
    "roleUpdate",
    async (
        oldRole,
        newRole
    ) => {

        // =========================================
        // LOG-SYSTEM: ROLE UPDATE
        // (komplett try/catch-abgesichert, damit dieses
        // Event den Bot-Prozess niemals zum Absturz bringt)
        // =========================================
        try {
            const changes = [];

            if (
                oldRole.name !==
                newRole.name
            ) {
                changes.push(
                    `**Name:** ${oldRole.name} → ${newRole.name}`
                );
            }

            if (
                oldRole.color !==
                newRole.color
            ) {
                changes.push(
                    `**Farbe:** ${oldRole.hexColor} → ${newRole.hexColor}`
                );
            }

            if (
                oldRole.position !==
                newRole.position
            ) {
                changes.push(
                    `**Position:** ${oldRole.position} → ${newRole.position}`
                );
            }

            if (changes.length === 0) {
                return;
            }

            if (typeof logRoleAction === "function") {
                await logRoleAction(
                    `Rolle bearbeitet: ${changes.join(", ")}`,
                    newRole.guild.client.user,
                    newRole,
                    null,
                    "Erfolgreich",
                    null
                );
            } else {
                console.error("❌ logRoleAction ist keine Funktion (Import/Export von logger.js prüfen) - Logging übersprungen.");
            }

            const entry =
                await getLatestAuditLog(
                    newRole.guild,
                    AuditLogEvent.RoleUpdate,
                    newRole.id
                );

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xFEE75C
                    )
                    .setTitle(
                        "✏️ Rolle geändert"
                    )
                    .addFields(
                        {
                            name:
                                "🎭 Rolle",
                            value:
                                `${newRole}\n${newRole.name}`,
                            inline:
                                false
                        },
                        {
                            name:
                                "📋 Änderungen",
                            value:
                                changes.join(
                                    "\n"
                                ),
                            inline:
                                false
                        },
                        {
                            name:
                                "👮 Ausgeführt von",
                            value:
                                entry?.executor
                                    ? `${entry.executor}\n${entry.executor.tag}`
                                    : "Unbekannt",
                            inline:
                                false
                        }
                    )
                    .setTimestamp();

            await sendLog(
                newRole.guild,
                SECURITY_LOG_CHANNEL_ID,
                embed
            );
        } catch (error) {
            console.error("❌ Fehler beim Loggen von Role Update:", error);
        }
    }
);

// =====================================================
// SECURITY – CHANNEL CREATE
// =====================================================

client.on(
    "channelCreate",
    async channel => {

        // =========================================
        // LOG-SYSTEM: CHANNEL CREATE
        // =========================================
        try {
            if (channel.guild) {
                const entry =
                    await getLatestAuditLog(
                        channel.guild,
                        AuditLogEvent.ChannelCreate,
                        channel.id
                    );

                await logChannelAction(
                    "Channel erstellt",
                    entry?.executor || channel.guild.client.user,
                    channel,
                    "Erfolgreich",
                    null
                );
            }
        } catch (error) {
            console.error("❌ Fehler beim Loggen von Channel Create:", error);
        }

        if (
            !channel.guild
        ) {
            return;
        }

        const entry =
            await getLatestAuditLog(
                channel.guild,
                AuditLogEvent.ChannelCreate,
                channel.id
            );

        const embed =
            new EmbedBuilder()
                .setColor(
                    0x57F287
                )
                .setTitle(
                    "📁 Kanal erstellt"
                )
                .addFields(
                    {
                        name:
                            "📁 Kanal",
                        value:
                            `${channel.name}\n<#${channel.id}>`,
                        inline:
                            false
                    },
                    {
                        name:
                            "👮 Ausgeführt von",
                        value:
                            entry?.executor
                                ? `${entry.executor}\n${entry.executor.tag}`
                                : "Unbekannt",
                        inline:
                            false
                    }
                )
                .setTimestamp();

        await sendLog(
            channel.guild,
            SECURITY_LOG_CHANNEL_ID,
            embed
        );
    }
);

// =====================================================
// SECURITY – CHANNEL DELETE
// =====================================================

client.on(
    "channelDelete",
    async channel => {

        if (
            !channel.guild
        ) {
            return;
        }

        // =========================================
        // LOG-SYSTEM: CHANNEL DELETE
        // =========================================
        try {
            const entry =
                await getLatestAuditLog(
                    channel.guild,
                    AuditLogEvent.ChannelDelete,
                    channel.id
                );

            await logChannelAction(
                "Channel gelöscht",
                entry?.executor || channel.guild.client.user,
                channel,
                "Erfolgreich",
                null
            );
        } catch (error) {
            console.error("❌ Fehler beim Loggen von Channel Delete:", error);
        }

        const entry =
            await getLatestAuditLog(
                channel.guild,
                AuditLogEvent.ChannelDelete,
                channel.id
            );

        const embed =
            new EmbedBuilder()
                .setColor(
                    0xED4245
                )
                .setTitle(
                    "🗑️ Kanal gelöscht"
                )
                .addFields(
                    {
                        name:
                            "📁 Kanal",
                        value:
                            channel.name,
                        inline:
                            false
                    },
                    {
                        name:
                            "👮 Ausgeführt von",
                        value:
                            entry?.executor
                                ? `${entry.executor}\n${entry.executor.tag}`
                                : "Unbekannt",
                        inline:
                            false
                    }
                )
                .setTimestamp();

        await sendLog(
            channel.guild,
            SECURITY_LOG_CHANNEL_ID,
            embed
        );
    }
);

// =====================================================
// SECURITY – CHANNEL UPDATE
// =====================================================

client.on(
    "channelUpdate",
    async (
        oldChannel,
        newChannel
    ) => {

        if (
            !newChannel.guild
        ) {
            return;
        }

        const changes = [];

        if (
            oldChannel.name !==
            newChannel.name
        ) {
            changes.push(
                `**Name:** ${oldChannel.name} → ${newChannel.name}`
            );
        }

        if (
            oldChannel.parentId !==
            newChannel.parentId
        ) {
            changes.push(
                `**Kategorie geändert**`
            );
        }

        if (
            changes.length ===
            0
        ) {
            return;
        }

        // =========================================
        // LOG-SYSTEM: CHANNEL UPDATE
        // =========================================
        try {
            await logChannelAction(
                `Channel bearbeitet: ${changes.join(", ")}`,
                newChannel.guild.client.user,
                newChannel,
                "Erfolgreich",
                null
            );
        } catch (error) {
            console.error("❌ Fehler beim Loggen von Channel Update:", error);
        }

        const entry =
            await getLatestAuditLog(
                newChannel.guild,
                AuditLogEvent.ChannelUpdate,
                newChannel.id
            );

        const embed =
            new EmbedBuilder()
                .setColor(
                    0xFEE75C
                )
                .setTitle(
                    "✏️ Kanal geändert"
                )
                .addFields(
                    {
                        name:
                            "📁 Kanal",
                        value:
                            `<#${newChannel.id}>`,
                        inline:
                            false
                    },
                    {
                        name:
                            "📋 Änderungen",
                        value:
                            changes.join(
                                "\n"
                            ),
                        inline:
                            false
                    },
                    {
                        name:
                            "👮 Ausgeführt von",
                        value:
                            entry?.executor
                                ? `${entry.executor}\n${entry.executor.tag}`
                                : "Unbekannt",
                        inline:
                            false
                    }
                )
                .setTimestamp();

        await sendLog(
            newChannel.guild,
            SECURITY_LOG_CHANNEL_ID,
            embed
        );
    }
);

// =====================================================
// FEHLERBEHANDLUNG
// =====================================================

process.on(
    "unhandledRejection",
    async error => {
        console.error(
            "❌ Unhandled Rejection:",
            error
        );

        // =========================================
        // LOG-SYSTEM: UNHANDLED REJECTION
        // =========================================
        try {
            await logError(error, "Unhandled Rejection");
        } catch (logError) {
            console.error("❌ Fehler beim Loggen von Unhandled Rejection:", logError);
        }
    }
);

process.on(
    "uncaughtException",
    async error => {
        console.error(
            "❌ Uncaught Exception:",
            error
        );

        // =========================================
        // LOG-SYSTEM: UNCAUGHT EXCEPTION
        // =========================================
        try {
            await logError(error, "Uncaught Exception");
        } catch (logError) {
            console.error("❌ Fehler beim Loggen von Uncaught Exception:", logError);
        }
    }
);

// =====================================================
// 🤖 KI-CHAT
// =====================================================

initializeKIChat(client);

registerRobloxSystem(client);
registerAktivCheckSystem(client);

// =====================================================
// 🏴 GANG-SYSTEM
// =====================================================

initializeGangSystem(client, {
    prefix: PREFIX,
    botOwnerId: BOT_OWNER_ID,
    permissionRoleIds: [
        ...TEAM_ROLE_IDS,
        ...ADMIN_ROLE_IDS
    ]
});

// =====================================================
// 👥 TEAM-MANAGEMENT
// =====================================================

initializeTeamManagement(client);
initializeSupportSystem(client);

// =====================================================
// 👨‍💻 DEV-AUFGABEN-SYSTEM
// =====================================================

initializeDevTaskSystem(client, {
    prefix: PREFIX,
    developerRoleId: "1539991224071491584",
    botOwnerId: BOT_OWNER_ID
});

// =====================================================
// 📋 RP-WEB-LOGS-SYSTEM
// =====================================================

initializeRPLogsSystem(client, {
    prefix: PREFIX,
    serverName: "Notruf Hamburg",
    botOwnerId: BOT_OWNER_ID,
    permissionRoleIds: [
        ...TEAM_ROLE_IDS,
        ...ADMIN_ROLE_IDS
    ]
});

// =====================================================
// 📩 PRIVATNACHRICHTEN-SYSTEM
// =====================================================

initializePrivatnachrichtSystem(client, {
    prefix: PREFIX,
    botOwnerId: BOT_OWNER_ID,
    permissionRoleIds: [
        ...TEAM_ROLE_IDS,
        ...ADMIN_ROLE_IDS
    ]
});

// =====================================================
// 📋 BÜRGER-VORSCHLAG-SYSTEM
// =====================================================

initializeBuergerVorschlagSystem(client, {
    prefix: PREFIX,
    botOwnerId: BOT_OWNER_ID,
    adminRoleIds: ADMIN_ROLE_IDS,
    teamRoleIds: SUGGESTION_TEAM_ROLE_IDS
});

// =====================================================
// 🎵 MUSIC-SYSTEM
// =====================================================

const {
    initializeMusicSystem
} = require("./Music-System/Music-System");

initializeMusicSystem(client);

// =====================================================
// SLASH COMMANDS REGISTRIEREN
// =====================================================

client.once("clientReady", async () => {
    // --- NEU: Backup-, Dashboard- und Logging-Modul starten ---
    // Die /backup-Befehle werden unten zusammen mit den eigenen Commands pro
    // Server registriert (NICHT global, sonst erscheinen sie doppelt).
    const allSlashCommands = [...slashCommands, ...robloxCommands, ...aktivCheckCommands, { name: "teambewerbung-test", description: "Fertige Testbewerbung mit Rollenping und Testbuttons senden" }, ...backupModule.commands, countingCommand, leaderboardCommand, supportLeaderboardCommand, akinatorCommand];

    try {
        global.__botCommandList = backupModule.commands.flatMap(c =>
            (c.options || []).filter(o => o.type === 1).map(sub => ({
                name: `backup ${sub.name}`,
                description: sub.description
            }))
        );
        backupModule.setup(client);
        dashboardModule.setup(client);
        loggingModule.setup(client);
    } catch (error) {
        console.error("❌ Fehler beim Starten von Backup/Dashboard/Logging:", error);
    }
    // --- ENDE NEU ---

    try {
        console.log("📝 Registriere Slash-Commands...");

        const commandNames = allSlashCommands.map(command => command.name);
        const duplicateNames = commandNames.filter(
            (name, index) => commandNames.indexOf(name) !== index
        );

        if (duplicateNames.length > 0) {
            throw new Error(
                `Doppelte Slash-Commands: ${[...new Set(duplicateNames)].join(", ")}`
            );
        }

        // Nur Guild-Commands verwenden. Eine gleichzeitige globale und
        // serverbezogene Registrierung lässt Discord dieselben Befehle
        // doppelt anzeigen.
        await client.application.commands.set([]);
        console.log("✅ Alte globale Slash-Commands zur Entfernung vorgemerkt.");

        for (const guild of client.guilds.cache.values()) {
            try {
                await guild.commands.set(allSlashCommands);
                console.log(
                    `✅ ${allSlashCommands.length} Slash-Commands für ${guild.name} (${guild.id}) registriert.`
                );
            } catch (error) {
                console.error(
                    `❌ Slash-Commands konnten für ${guild.name} (${guild.id}) nicht registriert werden:`,
                    error
                );
            }
        }
    } catch (error) {
        console.error("❌ Fehler beim Registrieren der Slash-Commands:", error);
    }
});

// =====================================================
// LOGIN
// =====================================================

if (!process.env.BOT_TOKEN) {
    console.error(
        "❌ BOT_TOKEN fehlt in den Environment Variables!"
    );

    process.exit(1);
}

// =====================================================
// NAMETAG EVENT HANDLER
// =====================================================

// Role Add Event - Wenn jemand eine Rolle bekommt
client.on("guildMemberUpdate", (oldMember, newMember) => {
    try {
        // Prüfe ob Rollen hinzugefügt wurden
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size > 0) {
            updateMemberNametag(newMember);
        }
    } catch (error) {
        console.error("❌ Fehler im guildMemberUpdate Event:", error);
    }
});

client.login(
    process.env.BOT_TOKEN
);

// =====================================================
// VEXO RP | LIVE SERVER-STATISTIK-KANÄLE
// =====================================================
const VEXO_STATS_GUILD_ID = "1559659266737176699";
const VEXO_STATS_STAFF_ROLE_ID = "1559659267269595147";
const VEXO_STATS_CHANNELS = {
    members: "1560755261172482079",
    boosts: "1560755267724124271",
    bots: "1560755275818868866",
    roles: "1561290265589710879",
    team: "1563148080965226576"
};
let vexoStatsRunning = false;
let vexoStatsPending = null;

async function updateVexoStatChannels() {
    if (vexoStatsRunning || !client.isReady()) return;
    vexoStatsRunning = true;
    try {
        const guild = await client.guilds.fetch(VEXO_STATS_GUILD_ID);
        // GuildMembers-Intent ist bereits im Client aktiviert.
        await guild.members.fetch();
        await guild.fetch();
        const members = guild.memberCount;
        const boosts = guild.premiumSubscriptionCount ?? 0;
        const bots = guild.members.cache.filter(member => member.user.bot).size;
        const roles = guild.roles.cache.size;
        const team = guild.members.cache.filter(member => member.roles.cache.has(VEXO_STATS_STAFF_ROLE_ID)).size;
        const names = {
            members: `『🧑』〆 ${members} Members`,
            boosts: `『💎』〆 ${boosts} Boosts`,
            bots: `『🤖』〆 ${bots} Bots`,
            roles: `『💂』 〆 ${roles} Roles`,
            team: `『🧑』〆 ${team} Teamlar`
        };
        for (const [key, id] of Object.entries(VEXO_STATS_CHANNELS)) {
            try {
                const channel = await guild.channels.fetch(id);
                if (channel && channel.name !== names[key]) await channel.setName(names[key], "Vexo RP Live-Statistiken");
            } catch (error) {
                console.warn(`[VEXO-STATS] Kanal ${key} (${id}):`, error.message);
            }
        }
    } catch (error) {
        console.warn("[VEXO-STATS] Aktualisierung fehlgeschlagen:", error.message);
    } finally {
        vexoStatsRunning = false;
    }
}
function scheduleVexoStatsUpdate() {
    if (vexoStatsPending) clearTimeout(vexoStatsPending);
    vexoStatsPending = setTimeout(() => {
        vexoStatsPending = null;
        updateVexoStatChannels().catch(console.error);
    }, 20000);
}
client.once("ready", () => {
    scheduleVexoStatsUpdate();
    setInterval(() => updateVexoStatChannels().catch(console.error), 10 * 60 * 1000);
});
for (const event of ["guildMemberAdd", "guildMemberRemove", "guildMemberUpdate", "roleCreate", "roleDelete", "guildUpdate"]) {
    client.on(event, (...args) => {
        const guild = args[args.length - 1]?.guild || args[0]?.guild || args[0];
        if (guild?.id === VEXO_STATS_GUILD_ID) scheduleVexoStatsUpdate();
    });
}
