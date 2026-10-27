const {
    EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// =====================================================
// BOT-STATUS-SYSTEM
// =====================================================

const BOT_STATUS_FILE = path.join(__dirname, "bot-status.json");

// Bot-Status Konfiguration pro Server
let botStatusConfig = {
    statusByGuild: {}
};

// Shutdown-Flag um mehrfache Shutdowns zu verhindern
let isShuttingDown = false;

// =====================================================
// STATUS KONFIGURATION LADEN/SPEICHERN
// =====================================================

function loadBotStatusConfig() {
    try {
        if (!fs.existsSync(BOT_STATUS_FILE)) {
            return {
                statusByGuild: {}
            };
        }

        const data = JSON.parse(fs.readFileSync(BOT_STATUS_FILE, "utf8"));
        return {
            statusByGuild: data.statusByGuild || {}
        };
    } catch (error) {
        console.error("❌ Fehler beim Laden der Bot-Status-Konfiguration:", error);
        return {
            statusByGuild: {}
        };
    }
}

function saveBotStatusConfig() {
    try {
        fs.writeFileSync(BOT_STATUS_FILE, JSON.stringify(botStatusConfig, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Bot-Status-Konfiguration:", error);
        return false;
    }
}

function getGuildStatusConfig(guildId) {
    if (!botStatusConfig.statusByGuild[guildId]) {
        botStatusConfig.statusByGuild[guildId] = {
            channelId: null,
            messageId: null,
            currentStatus: "unknown",
            lastUpdated: null
        };
    }
    return botStatusConfig.statusByGuild[guildId];
}

function setGuildStatusChannel(guildId, channelId, messageId = null) {
    const config = getGuildStatusConfig(guildId);
    config.channelId = channelId;
    if (messageId) {
        config.messageId = messageId;
    }
    config.lastUpdated = new Date().toISOString();
    saveBotStatusConfig();
    return config;
}

// =====================================================
// STATUS-PANEL ERSTELLEN
// =====================================================

function createStatusPanelEmbed(status, reason = null, startTime = null) {
    const isOnline = status === "online";
    const isOffline = status === "offline" || status === "shutting_down";
    
    const now = new Date();
    const timeString = now.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    let embed = new EmbedBuilder();

    if (isOnline) {
        embed
            .setColor(0x57F287) // Grün
            .setTitle("🟢 BOT ONLINE")
            .setDescription("Der Bot ist aktuell online und läuft normal.")
            .addFields(
                {
                    name: "⏰ Zeitpunkt",
                    value: timeString,
                    inline: true
                }
            );
        
        if (startTime) {
            const uptime = Math.floor((now - new Date(startTime)) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            embed.addFields({
                name: "⏱️ Uptime",
                value: `${hours}h ${minutes}m ${seconds}s`,
                inline: true
            });
        }
    } else if (isOffline) {
        embed
            .setColor(0xED4245) // Rot
            .setTitle("🔴 BOT OFFLINE")
            .setDescription("Der Bot fährt gerade herunter.")
            .addFields(
                {
                    name: "⏰ Zeitpunkt",
                    value: timeString,
                    inline: true
                },
                {
                    name: "📌 Grund",
                    value: reason || "Unbekannt",
                    inline: true
                }
            );
    } else {
        embed
            .setColor(0x5865F2) // Blau
            .setTitle("🔄 BOT STATUS")
            .setDescription("Bot-Status wird geladen...");
    }

    embed.setFooter({ text: "NoVex RP Bot Status ✧ Automatisches Status-System" });
    embed.setTimestamp();

    return embed;
}

// =====================================================
// STATUS-PANEL SENDEN/AKTUALISIEREN
// =====================================================

async function updateStatusPanel(client, guildId, status, reason = null, startTime = null) {
    try {
        const config = getGuildStatusConfig(guildId);

        if (!config.channelId) {
            console.log(`ℹ️ Kein Status-Kanal für Guild ${guildId} konfiguriert.`);
            return false;
        }

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            console.warn(`⚠️ Guild ${guildId} nicht gefunden oder Bot ist nicht darauf. Entferne aus Konfiguration.`);
            delete botStatusConfig.statusByGuild[guildId];
            saveBotStatusConfig();
            return false;
        }

        const channel = await guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.warn(`⚠️ Kanal ${config.channelId} nicht gefunden oder kein Textkanal. Entferne aus Konfiguration.`);
            delete botStatusConfig.statusByGuild[guildId];
            saveBotStatusConfig();
            return false;
        }

        const embed = createStatusPanelEmbed(status, reason, startTime);

        // Wenn bereits eine Nachricht existiert, aktualisiere sie
        if (config.messageId) {
            try {
                const message = await channel.messages.fetch(config.messageId);
                await message.edit({ embeds: [embed] });
                console.log(`✅ Status-Panel für Guild ${guildId} aktualisiert (Status: ${status}).`);
                return true;
            } catch (error) {
                console.warn(`⚠️ Konnte Status-Nachricht ${config.messageId} nicht finden/aktualisieren:`, error.message);
                // Erstelle eine neue Nachricht
            }
        }

        // Erstelle eine neue Nachricht
        const message = await channel.send({ embeds: [embed] });
        config.messageId = message.id;
        config.currentStatus = status;
        config.lastUpdated = new Date().toISOString();
        saveBotStatusConfig();
        console.log(`✅ Neues Status-Panel für Guild ${guildId} erstellt (Status: ${status}).`);
        return true;

    } catch (error) {
        console.error(`❌ Fehler beim Aktualisieren des Status-Panels für Guild ${guildId}:`, error);
        return false;
    }
}

// =====================================================
// SHUTDOWN NOTIFICATION
// =====================================================

async function sendShutdownNotification(client, reason) {
    try {
        const botOwnerId = process.env.BOT_OWNER_ID || "1322191083303731201";
        
        // Versuche, den Bot-Owner zu finden und DM zu senden
        try {
            const owner = await client.users.fetch(botOwnerId).catch(() => null);
            if (owner) {
                const now = new Date();
                const timeString = now.toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                });

                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("⚠️ Bot wird heruntergefahren")
                    .setDescription("Der Bot fährt gerade herunter.")
                    .addFields(
                        {
                            name: "📌 Grund",
                            value: reason || "Unbekannt",
                            inline: true
                        },
                        {
                            name: "⏰ Zeitpunkt",
                            value: timeString,
                            inline: true
                        }
                    )
                    .setFooter({ text: "NoVex RP Bot Shutdown Notification" })
                    .setTimestamp();

                await owner.send({ embeds: [embed] });
                console.log(`✅ Shutdown-DM an Bot-Owner gesendet.`);
            } else {
                console.log("⚠️ Bot-Owner konnte nicht gefunden werden (Unknown User).");
            }
        } catch (dmError) {
            if (dmError.code === 10013) {
                console.log("⚠️ Bot-Owner existiert nicht (Unknown User).");
            } else {
                console.warn(`⚠️ Konnte keine DM an Bot-Owner senden:`, dmError.message);
            }
        }

        // Aktualisiere alle Status-Panels
        const config = loadBotStatusConfig();
        for (const guildId of Object.keys(config.statusByGuild)) {
            await updateStatusPanel(client, guildId, "shutting_down", reason);
        }

    } catch (error) {
        console.error("❌ Fehler beim Senden der Shutdown-Benachrichtigung:", error);
    }
}

// =====================================================
// SHUTDOWN HANDLER
// =====================================================

async function handleShutdown(client, reason) {
    if (isShuttingDown) {
        console.log("⚠️ Shutdown läuft bereits - überspringe doppelten Shutdown.");
        return true;
    }

    isShuttingDown = true;
    console.log(`🔴 Shutdown-Handler aktiviert: ${reason}`);

    try {
        // Sende Shutdown-Benachrichtigungen mit Timeout
        await Promise.race([
            sendShutdownNotification(client, reason),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 8000)
            )
        ]);
    } catch (error) {
        console.warn("⚠️ Shutdown-Benachrichtigungen konnten nicht vollständig gesendet werden:", error.message);
    }

    console.log("✅ Shutdown-Handler abgeschlossen.");
    return true;
}

// =====================================================
// INITIALIZIERUNG
// =====================================================

function initializeBotStatusSystem(client) {
    // Lade Konfiguration
    botStatusConfig = loadBotStatusConfig();

    // Shutdown-Handler werden jetzt in der index.js registriert,
    // um Konflikte mit dem Bot-Lock-System zu vermeiden.
    // Daher keine separate Registrierung hier mehr.

    // Registriere für "exit" Event (für alle anderen Shutdowns)
    process.on("exit", async () => {
        if (!isShuttingDown) {
            console.log("⚠️ Prozess wird beendet ohne vorherigen Shutdown-Handler.");
        }
    });

    console.log("✅ Bot-Status-System initialisiert (Shutdown-Handler in index.js integriert).");
}

// =====================================================
// PREFIX COMMAND HANDLER
// =====================================================

async function handleBotStatusCommand(message, client) {
    const { guild, channel, author } = message;

    if (!guild) {
        return message.reply("❌ Dieser Command kann nur in einem Server verwendet werden.");
    }

    const config = getGuildStatusConfig(guild.id);

    // Aktualisiere oder erstelle Status-Panel
    config.channelId = channel.id;
    config.lastUpdated = new Date().toISOString();
    saveBotStatusConfig();

    const embed = createStatusPanelEmbed("online", null, client.readyAt);

    if (config.messageId) {
        try {
            const messageToEdit = await channel.messages.fetch(config.messageId);
            await messageToEdit.edit({ embeds: [embed] });
            await message.reply("✅ Status-Panel wurde aktualisiert!");
        } catch (error) {
            // Nachricht nicht gefunden - erstelle neue
            const newMessage = await channel.send({ embeds: [embed] });
            config.messageId = newMessage.id;
            config.currentStatus = "online";
            saveBotStatusConfig();
            await message.reply("✅ Status-Panel wurde erstellt!");
        }
    } else {
        const newMessage = await channel.send({ embeds: [embed] });
        config.messageId = newMessage.id;
        config.currentStatus = "online";
        saveBotStatusConfig();
        await message.reply("✅ Status-Panel wurde erstellt!");
    }
}

// =====================================================
// READY HANDLER
// =====================================================

async function handleBotReady(client) {
    try {
        // Aktualisiere alle Status-Panels auf ONLINE
        const config = loadBotStatusConfig();
        
        for (const guildId of Object.keys(config.statusByGuild)) {
            const guildConfig = config.statusByGuild[guildId];
            
            // Wenn der vorherige Status noch ONLINE war, aktualisiere auf den neuen Start
            if (guildConfig.currentStatus === "online" && guildConfig.channelId) {
                await updateStatusPanel(client, guildId, "online", null, client.readyAt);
            }
        }
        
        console.log("✅ Bot-Status-Panels auf Online gesetzt.");
    } catch (error) {
        console.error("❌ Fehler beim Aktualisieren der Status-Panels beim Ready:", error);
    }
}

module.exports = {
    initializeBotStatusSystem,
    handleBotStatusCommand,
    handleBotReady,
    handleShutdown,
    getGuildStatusConfig,
    setGuildStatusChannel
};
