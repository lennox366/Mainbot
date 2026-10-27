// =====================================================
// 🤖 ZENTRALES LOG-SYSTEM
// =====================================================
//
// Zentrales Log-System für den NoVex RP Bot
// Loggt alle wichtigen Aktionen, Commands, Events und Fehler
// =====================================================

const {
    EmbedBuilder,
    Colors
} = require("discord.js");

// =====================================================
// KONFIGURATION
// =====================================================

const LOG_CHANNEL_ID = process.env.BOT_LOG_CHANNEL_ID || null;
const BOT_USER_ID = process.env.DISCORD_CLIENT_ID || null;

// Symbole für verschiedene Log-Typen
const LOG_SYMBOLS = {
    COMMAND: "⚡",
    INTERACTION: "🖱️",
    BOT_ACTION: "🤖",
    MEMBER_JOIN: "📥",
    MEMBER_LEAVE: "📤",
    MODERATION: "🔨",
    ROLE: "🎭",
    CHANNEL: "📁",
    MESSAGE: "💬",
    VOICE: "🔊",
    TICKET: "🎫",
    APPLICATION: "📋",
    TEAM: "👥",
    HOUSE: "🏠",
    RP: "🟢",
    VERIFICATION: "🔐",
    KI: "🧠",
    ERROR: "❌",
    GUILD: "🏠",
    GUILD_MEMBER: "👤"
};

// Farben für verschiedene Log-Typen
const LOG_COLORS = {
    COMMAND: Colors.Blue,
    INTERACTION: Colors.Green,
    BOT_ACTION: Colors.Purple,
    MEMBER_JOIN: Colors.Green,
    MEMBER_LEAVE: Colors.Red,
    MODERATION: Colors.Orange,
    ROLE: Colors.Gold,
    CHANNEL: Colors.Blue,
    MESSAGE: Colors.Greyple,
    VOICE: Colors.Blurple,
    TICKET: Colors.LightGrey,
    APPLICATION: Colors.LightGrey,
    TEAM: Colors.DarkGreen,
    HOUSE: Colors.Orange,
    RP: Colors.DarkGreen,
    VERIFICATION: Colors.Green,
    KI: Colors.Purple,
    ERROR: Colors.Red,
    GUILD: Colors.Blue,
    GUILD_MEMBER: Colors.Green
};

// Cache für Log-Kanal
let logChannel = null;
let client = null;

// Funktion zum Aktualisieren des Log-Kanals
function updateLogChannel(channelId) {
    logChannel = null; // Cache leeren
    process.env.BOT_LOG_CHANNEL_ID = channelId;
    return getLogChannel();
}

// =====================================================
// INITIALISIERUNG
// =====================================================

function initializeLogger(botClient) {
    client = botClient;
    return getLogChannel();
}

// =====================================================
// LOG-KANAL ABFRUFEN
// =====================================================

async function getLogChannel() {
    if (!LOG_CHANNEL_ID) {
        console.error("❌ LOG-SYSTEM: BOT_LOG_CHANNEL_ID ist nicht konfiguriert.");
        return null;
    }

    if (logChannel) {
        return logChannel;
    }

    try {
        logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error(`❌ LOG-SYSTEM: Der konfigurierte Log-Kanal wurde nicht gefunden.`);
            console.error(`❌ BOT_LOG_CHANNEL_ID: ${LOG_CHANNEL_ID}`);
            return null;
        }
        return logChannel;
    } catch (error) {
        console.error("❌ LOG-SYSTEM: Fehler beim Abrufen des Log-Kanals:", error.message);
        console.error(`❌ BOT_LOG_CHANNEL_ID: ${LOG_CHANNEL_ID}`);
        return null;
    }
}

// =====================================================
// ZENTRALE LOG-FUNKTION
// =====================================================

async function log({
    type = "GENERAL",
    action = "Unbekannte Aktion",
    user = null,
    userId = null,
    channel = null,
    channelId = null,
    guild = null,
    guildId = null,
    details = null,
    status = "Erfolgreich",
    error = null,
    additionalFields = []
}) {
    try {
        const logChannel = await getLogChannel();
        if (!logChannel) {
            return false;
        }

        // Verhindere Endlosschleife: Logge keine Nachrichten des Bots selbst
        if (user && user.id === BOT_USER_ID) {
            return false;
        }

        // Symbole und Farben basierend auf Typ
        const symbol = LOG_SYMBOLS[type] || "📌";
        const color = LOG_COLORS[type] || Colors.Default;

        // Embed erstellen
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${symbol} ${action}`)
            .setTimestamp()
            .setFooter({ text: "NoVex RP Bot • Log-System" });

        // Felder hinzufügen
        const fields = [];

        // Benutzer
        if (user) {
            fields.push({
                name: "👤 Benutzer",
                value: `${user.tag} (${user.id})`,
                inline: true
            });
        } else if (userId) {
            fields.push({
                name: "👤 Benutzer-ID",
                value: userId,
                inline: true
            });
        }

        // Kanal
        if (channel) {
            fields.push({
                name: "📍 Kanal",
                value: `<#${channel.id}>`,
                inline: true
            });
        } else if (channelId) {
            fields.push({
                name: "📍 Kanal-ID",
                value: channelId,
                inline: true
            });
        }

        // Server
        if (guild) {
            fields.push({
                name: "🏠 Server",
                value: guild.name,
                inline: true
            });
        } else if (guildId) {
            fields.push({
                name: "🏠 Server-ID",
                value: guildId,
                inline: true
            });
        }

        // Details
        if (details) {
            fields.push({
                name: "📋 Details",
                value: details,
                inline: false
            });
        }

        // Status
        if (status) {
            const statusEmoji = status === "Erfolgreich" ? "✅" : "❌";
            fields.push({
                name: "📊 Status",
                value: `${statusEmoji} ${status}`,
                inline: true
            });
        }

        // Fehler
        if (error) {
            fields.push({
                name: "⚠️ Fehler",
                value: error,
                inline: false
            });
        }

        // Zusätzliche Felder
        if (Array.isArray(additionalFields) && additionalFields.length > 0) {
            fields.push(...additionalFields);
        }

        // Felder zum Embed hinzufügen
        if (fields.length > 0) {
            embed.addFields(fields);
        }

        // Embed senden
        await logChannel.send({ embeds: [embed] }).catch(err => {
            console.error("❌ LOG-SYSTEM: Fehler beim Senden des Logs:", err.message);
        });

        return true;
    } catch (error) {
        console.error("❌ LOG-SYSTEM: Unerwarteter Fehler beim Loggen:", error.message);
        return false;
    }
}

// =====================================================
// SPEZIFISCHE LOG-FUNKTIONEN
// =====================================================

async function logCommand(message, commandName, status = "Erfolgreich", error = null) {
    return log({
        type: "COMMAND",
        action: `Command ausgeführt: ${commandName}`,
        user: message.author,
        channel: message.channel,
        guild: message.guild,
        details: `Benutzer hat den Command ${commandName} verwendet`,
        status: status,
        error: error
    });
}

async function logInteraction(interaction, actionType, status = "Erfolgreich", error = null, details = null) {
    let type = "INTERACTION";
    
    if (interaction.isButton()) {
        type = "INTERACTION";
    } else if (interaction.isAnySelectMenu()) {
        type = "INTERACTION";
    } else if (interaction.isModalSubmit()) {
        type = "INTERACTION";
    }

    return log({
        type: type,
        action: actionType,
        user: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild,
        details: details,
        status: status,
        error: error
    });
}

async function logBotAction(action, user = null, targetUser = null, status = "Erfolgreich", error = null, details = null) {
    const additionalFields = [];
    
    if (targetUser) {
        additionalFields.push({
            name: "👤 Betroffener Benutzer",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
        });
    }

    return log({
        type: "BOT_ACTION",
        action: action,
        user: user,
        details: details,
        status: status,
        error: error,
        additionalFields: additionalFields
    });
}

async function logMemberJoin(member) {
    return log({
        type: "MEMBER_JOIN",
        action: "Member ist dem Server beigetreten",
        user: member.user,
        guild: member.guild,
        details: `Neuer Benutzer ist dem Server beigetreten`,
        status: "Erfolgreich"
    });
}

async function logMemberLeave(member) {
    return log({
        type: "MEMBER_LEAVE",
        action: "Member hat den Server verlassen",
        user: member.user,
        guild: member.guild,
        details: `Benutzer hat den Server verlassen`,
        status: "Erfolgreich"
    });
}

async function logError(error, context = "Unbekannt", user = null, channel = null) {
    // Sensible Daten aus Fehlermeldung entfernen
    let safeError = error.message || String(error);
    
    // Entferne potenziell sensible Daten
    safeError = safeError
        .replace(/BOT_TOKEN/g, "***")
        .replace(/API_KEY/g, "***")
        .replace(/PASSWORD/g, "***")
        .replace(/SECRET/g, "***")
        .replace(/token/g, "***")
        .replace(/key/g, "***");

    return log({
        type: "ERROR",
        action: `Bot-Fehler: ${context}`,
        user: user,
        channel: channel,
        details: `Ein Fehler ist aufgetreten`,
        status: "Fehlgeschlagen",
        error: safeError
    });
}

async function logTicketAction(action, user, channel, status = "Erfolgreich", error = null) {
    return log({
        type: "TICKET",
        action: action,
        user: user,
        channel: channel,
        guild: channel?.guild,
        details: `Ticket-Aktion: ${action}`,
        status: status,
        error: error
    });
}

async function logApplicationAction(action, user, channel, status = "Erfolgreich", error = null) {
    return log({
        type: "APPLICATION",
        action: action,
        user: user,
        channel: channel,
        guild: channel?.guild,
        details: `Bewerbungs-Aktion: ${action}`,
        status: status,
        error: error
    });
}

async function logTeamAction(action, executor, targetUser = null, status = "Erfolgreich", error = null, details = null) {
    const additionalFields = [];
    
    if (targetUser) {
        additionalFields.push({
            name: "👤 Betroffener Benutzer",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
        });
    }

    return log({
        type: "TEAM",
        action: action,
        user: executor,
        details: details,
        status: status,
        error: error,
        additionalFields: additionalFields
    });
}

async function logHouseAction(action, user, targetUser = null, houseName = null, status = "Erfolgreich", error = null) {
    const additionalFields = [];
    
    if (targetUser) {
        additionalFields.push({
            name: "👤 Betroffener Benutzer",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
        });
    }
    
    if (houseName) {
        additionalFields.push({
            name: "🏠 Haus",
            value: houseName,
            inline: true
        });
    }

    return log({
        type: "HOUSE",
        action: action,
        user: user,
        details: `Häuser-Aktion: ${action}`,
        status: status,
        error: error,
        additionalFields: additionalFields
    });
}

async function logRPAction(action, user, channel, status = "Erfolgreich", error = null) {
    return log({
        type: "RP",
        action: action,
        user: user,
        channel: channel,
        guild: channel?.guild,
        details: `RP-Aktion: ${action}`,
        status: status,
        error: error
    });
}

async function logVerificationAction(action, user, status = "Erfolgreich", error = null) {
    return log({
        type: "VERIFICATION",
        action: action,
        user: user,
        details: `Verifizierungs-Aktion: ${action}`,
        status: status,
        error: error
    });
}

async function logKIAction(action, user, channel, status = "Erfolgreich", error = null) {
    return log({
        type: "KI",
        action: action,
        user: user,
        channel: channel,
        guild: channel?.guild,
        details: `KI-Aktion: ${action}`,
        status: status,
        error: error
    });
}

async function logRoleAction(action, executor, role, targetUser = null, status = "Erfolgreich", error = null) {
    const additionalFields = [
        {
            name: "🎭 Rolle",
            value: `${role.name} (${role.id})`,
            inline: true
        }
    ];
    
    if (targetUser) {
        additionalFields.push({
            name: "👤 Betroffener Benutzer",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
        });
    }

    return log({
        type: "ROLE",
        action: action,
        user: executor,
        details: `Rollen-Aktion: ${action}`,
        status: status,
        error: error,
        additionalFields: additionalFields
    });
}

async function logChannelAction(action, executor, channel, status = "Erfolgreich", error = null) {
    return log({
        type: "CHANNEL",
        action: action,
        user: executor,
        channel: channel,
        guild: channel?.guild,
        details: `Channel-Aktion: ${action}`,
        status: status,
        error: error
    });
}

async function logVoiceAction(action, user, fromChannel = null, toChannel = null, status = "Erfolgreich", error = null) {
    const additionalFields = [];
    
    if (fromChannel) {
        additionalFields.push({
            name: "📍 Von",
            value: fromChannel.name,
            inline: true
        });
    }
    
    if (toChannel) {
        additionalFields.push({
            name: "📍 Nach",
            value: toChannel.name,
            inline: true
        });
    }

    return log({
        type: "VOICE",
        action: action,
        user: user,
        details: `Voice-Aktion: ${action}`,
        status: status,
        error: error,
        additionalFields: additionalFields
    });
}

async function logGuildAction(action, guild, status = "Erfolgreich", error = null) {
    return log({
        type: "GUILD",
        action: action,
        guild: guild,
        details: `Server-Aktion: ${action}`,
        status: status,
        error: error
    });
}

async function logModerationAction(action, executor, targetUser, reason = null, status = "Erfolgreich", error = null) {
    const additionalFields = [
        {
            name: "👤 Betroffener Benutzer",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
        }
    ];
    
    if (reason) {
        additionalFields.push({
            name: "📋 Grund",
            value: reason,
            inline: false
        });
    }

    return log({
        type: "MODERATION",
        action: action,
        user: executor,
        details: `Moderations-Aktion: ${action}`,
        status: status,
        error: error,
        additionalFields: additionalFields
    });
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
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
    logModerationAction,
    getLogChannel,
    updateLogChannel
};