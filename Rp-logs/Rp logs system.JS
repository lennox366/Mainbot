// =====================================================
// 📋 NEXORACLOUD – RP-WEB-LOGS-SYSTEM
// =====================================================
// Befehle:   !rp-logs-einstellungen   |   !web-logs
// Zweck:     Verwaltet Webhook + Log-Kanal pro Discord-Server
//            und protokolliert RP-Ereignisse aus Roblox
//            ("Notruf Hamburg") als moderne Discord-Embeds.
// =====================================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    WebhookClient,
    PermissionsBitField
} = require("discord.js");

const storage = require("./rp-logs-storage");
const { EVENT_TEMPLATES, GENERIC_FIELD_LABELS } = require("./rp-logs-templates");

const NEXORA_COLOR = 0x5865F2;

let CLIENT = null;
let SETTINGS = {
    prefix: "!",
    serverName: "Notruf Hamburg",
    botOwnerId: null,
    permissionRoleIds: []
};

const RP_EVENT_CATEGORIES = [
    "🔨 BANS", "🚫 KICKS", "⚠️ WARNS", "👮 TEAM-AKTIONEN",
    "🚔 FESTNAHMEN", "🚑 RETTUNGSEINSÄTZE", "🚒 FEUERWEHREINSÄTZE",
    "🚨 NOTRUFE", "🚗 VERKEHRSUNFÄLLE", "💰 GELDSTRAFEN",
    "🚘 FAHRZEUG-AKTIONEN", "🏥 KRANKENHAUS", "🔒 GEFÄNGNIS"
];

// =====================================================
// 🔐 BERECHTIGUNGEN
// =====================================================

function hasSettingsPermission(member) {
    if (!member) return false;
    if (SETTINGS.botOwnerId && member.id === SETTINGS.botOwnerId) return true;
    if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
    if (!SETTINGS.permissionRoleIds || SETTINGS.permissionRoleIds.length === 0) return false;
    return member.roles.cache.some(role => SETTINGS.permissionRoleIds.includes(role.id));
}

function formatTimestamp(date = new Date()) {
    const pad = n => String(n).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} – ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// =====================================================
// 🖼️ EINSTELLUNGS-PANEL
// =====================================================

function buildSettingsEmbed(guildId) {
    const config = storage.getGuildConfig(guildId);

    return new EmbedBuilder()
        .setColor(NEXORA_COLOR)
        .setTitle("⚙️ NoVex RP – RP-Logs Einstellungen")
        .setDescription(
            `Verwalte hier die RP-Web-Logs-Verbindung für **${SETTINGS.serverName}**.`
        )
        .addFields(
            {
                name: "🔗 Webhook",
                value: config.webhookUrl ? "🟢 Eingerichtet" : "🔴 Nicht eingerichtet",
                inline: true
            },
            {
                name: "📺 Log-Kanal",
                value: config.channelId ? `<#${config.channelId}>` : "Nicht eingestellt",
                inline: true
            }
        )
        .setFooter({ text: "NoVex RP • RP-Web-Logs-System" })
        .setTimestamp();
}

function buildSettingsComponents() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rplogs_webhook_set").setLabel("Webhook einstellen").setEmoji("🔗").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("rplogs_webhook_change").setLabel("Webhook ändern").setEmoji("🔄").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("rplogs_webhook_remove").setLabel("Webhook entfernen").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rplogs_channel_open").setLabel("Log-Kanal einstellen").setEmoji("📺").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rplogs_webhook_test").setLabel("Webhook testen").setEmoji("🧪").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rplogs_status").setLabel("Status anzeigen").setEmoji("📊").setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

function buildChannelSelectRow() {
    return new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId("rplogs_channel_select")
            .setPlaceholder("Wähle den Log-Kanal aus")
            .addChannelTypes(ChannelType.GuildText)
    );
}

function buildWebhookModal(existing) {
    const modal = new ModalBuilder()
        .setCustomId("rplogs_webhook_modal")
        .setTitle(existing ? "Webhook ändern" : "Webhook einstellen");

    const input = new TextInputBuilder()
        .setCustomId("rplogs_webhook_url")
        .setLabel("Discord-Webhook-URL")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://discord.com/api/webhooks/...")
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function buildStatusEmbed(guildId) {
    const config = storage.getGuildConfig(guildId);

    const embed = new EmbedBuilder()
        .setColor(config.webhookUrl ? 0x57F287 : 0xED4245)
        .setTitle("📊 NoVex RP – RP-Logs Status")
        .setTimestamp();

    if (!config.webhookUrl) {
        embed.addFields({ name: "🔴 Webhook", value: "Nicht eingerichtet", inline: false });
        return embed;
    }

    embed.addFields(
        { name: "🟢 Webhook", value: "Aktiv", inline: true },
        { name: "📺 Log-Kanal", value: config.channelId ? `<#${config.channelId}>` : "Nicht eingestellt", inline: true },
        { name: "📡 Verbindung", value: "Online", inline: true },
        { name: "📊 Gesendete Logs", value: String(config.logsSent || 0), inline: true },
        { name: "❌ Fehlgeschlagene Logs", value: String(config.failedLogs || 0), inline: true },
        { name: "🕐 Letzter Log", value: config.lastLog ? formatTimestamp(new Date(config.lastLog)) : "Noch keiner", inline: true }
    );

    return embed;
}

// =====================================================
// 🌐 WEB-LOGS PANEL (!web-logs)
// =====================================================

function buildWebLogsPanelEmbed() {
    return new EmbedBuilder()
        .setColor(NEXORA_COLOR)
        .setTitle(`🚨 ${SETTINGS.serverName.toUpperCase()}`)
        .setDescription(
            "📋 **RP-WEB-LOGS**\n\n" +
            "Hier werden alle wichtigen Ereignisse des RP-Servers automatisch protokolliert.\n\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            RP_EVENT_CATEGORIES.join("\n") +
            "\n\n━━━━━━━━━━━━━━━━━━"
        )
        .setFooter({ text: "NoVex RP • RP-Web-Logs-System" })
        .setTimestamp();
}

async function handleWebLogsCommand(message) {
    if (!hasSettingsPermission(message.member)) {
        return message.reply("❌ Du hast keine Berechtigung, diesen Befehl zu verwenden.");
    }

    const guildId = message.guild.id;
    const config = storage.getGuildConfig(guildId);
    const targetChannel = config.channelId
        ? message.guild.channels.cache.get(config.channelId)
        : message.channel;

    if (!targetChannel) {
        return message.reply("❌ Der eingestellte Log-Kanal wurde nicht gefunden. Bitte stelle ihn erneut über `!rp-logs-einstellungen` ein.");
    }

    // Bestehendes Panel wiederverwenden, falls vorhanden
    if (config.webPanelChannelId && config.webPanelMessageId) {
        try {
            const oldChannel = await message.guild.channels.fetch(config.webPanelChannelId);
            const oldMessage = await oldChannel.messages.fetch(config.webPanelMessageId);
            await oldMessage.edit({ embeds: [buildWebLogsPanelEmbed()] });
            return message.reply(`✅ Das bestehende RP-Web-Logs-Panel in <#${oldChannel.id}> wurde aktualisiert.`);
        } catch (error) {
            // Panel existiert nicht mehr -> neues erstellen
        }
    }

    const sent = await targetChannel.send({ embeds: [buildWebLogsPanelEmbed()] });
    storage.setWebPanel(guildId, targetChannel.id, sent.id);
    return message.reply(`✅ Das RP-Web-Logs-Panel wurde in <#${targetChannel.id}> erstellt.`);
}

// =====================================================
// ⚙️ EINSTELLUNGS-BEFEHL
// =====================================================

async function handleSettingsCommand(message) {
    if (!hasSettingsPermission(message.member)) {
        return message.reply("❌ Du hast keine Berechtigung, diesen Befehl zu verwenden.");
    }

    await message.reply({
        embeds: [buildSettingsEmbed(message.guild.id)],
        components: buildSettingsComponents()
    });
}

// =====================================================
// 🧩 INTERAKTIONEN (Buttons / Modals / Select-Menüs)
// =====================================================

async function handleInteraction(interaction) {
    if (!interaction.guild) return;
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isChannelSelectMenu()) return;

    const guildId = interaction.guild.id;
    const isRpLogsInteraction =
        (interaction.customId && interaction.customId.startsWith("rplogs_"));

    if (!isRpLogsInteraction) return;

    if (!hasSettingsPermission(interaction.member)) {
        return interaction.reply({
            content: "❌ Du hast keine Berechtigung, diese Einstellung zu verwenden.",
            ephemeral: true
        });
    }

    // ---------- Webhook einstellen / ändern ----------
    if (interaction.customId === "rplogs_webhook_set" || interaction.customId === "rplogs_webhook_change") {
        const existing = interaction.customId === "rplogs_webhook_change";
        return interaction.showModal(buildWebhookModal(existing));
    }

    if (interaction.customId === "rplogs_webhook_modal") {
        const url = interaction.fields.getTextInputValue("rplogs_webhook_url").trim();
        const validPattern = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

        if (!validPattern.test(url)) {
            return interaction.reply({
                content: "❌ Das ist keine gültige Discord-Webhook-URL.",
                ephemeral: true
            });
        }

        storage.setWebhook(guildId, url);
        return interaction.reply({
            content: "✅ Der Webhook wurde erfolgreich gespeichert und sicher hinterlegt.",
            ephemeral: true
        });
    }

    // ---------- Webhook entfernen ----------
    if (interaction.customId === "rplogs_webhook_remove") {
        storage.removeWebhook(guildId);
        return interaction.reply({ content: "🗑️ Der Webhook wurde entfernt.", ephemeral: true });
    }

    // ---------- Log-Kanal ----------
    if (interaction.customId === "rplogs_channel_open") {
        return interaction.reply({
            content: "📺 Wähle den Kanal für die RP-Logs aus:",
            components: [buildChannelSelectRow()],
            ephemeral: true
        });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === "rplogs_channel_select") {
        const channelId = interaction.values[0];
        storage.setLogChannel(guildId, channelId);
        return interaction.update({
            content: `✅ Log-Kanal wurde auf <#${channelId}> gesetzt.`,
            components: []
        });
    }

    // ---------- Webhook testen ----------
    if (interaction.customId === "rplogs_webhook_test") {
        const config = storage.getGuildConfig(guildId);

        if (!config.webhookUrl) {
            return interaction.reply({ content: "❌ Es ist noch kein Webhook eingerichtet.", ephemeral: true });
        }

        const testEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`🚨 ${SETTINGS.serverName.toUpperCase()} – RP LOG TEST`)
            .setDescription("━━━━━━━━━━━━━━━━━━")
            .addFields(
                { name: "✅ Status", value: "Webhook erfolgreich verbunden.", inline: false },
                { name: "🏙️ Server", value: SETTINGS.serverName, inline: true },
                { name: "🤖 System", value: "NoVex RP", inline: true },
                { name: "🕐 Zeitpunkt", value: formatTimestamp(), inline: true }
            )
            .setFooter({ text: "NoVex RP • RP-Web-Logs-System" });

        try {
            const webhookClient = new WebhookClient({ url: config.webhookUrl });
            await webhookClient.send({ embeds: [testEmbed] });
            return interaction.reply({ content: "✅ Testnachricht wurde erfolgreich gesendet.", ephemeral: true });
        } catch (error) {
            console.error("❌ [RP-Logs] Webhook-Test fehlgeschlagen:", error);
            return interaction.reply({ content: "❌ Der Webhook konnte nicht erreicht werden. Bitte überprüfe die URL.", ephemeral: true });
        }
    }

    // ---------- Status ----------
    if (interaction.customId === "rplogs_status") {
        return interaction.reply({ embeds: [buildStatusEmbed(guildId)], ephemeral: true });
    }
}

// =====================================================
// 📡 LOG-VERSAND (wird von der RP-Logs-API aufgerufen)
// =====================================================

function buildEventEmbed(type, data) {
    const template = EVENT_TEMPLATES[type];
    if (!template) return null;

    const embed = new EmbedBuilder()
        .setColor(template.color || NEXORA_COLOR)
        .setTitle(`${template.emoji} ${template.title}`)
        .setTimestamp();

    const fieldDefs = template.fields || Object.keys(data)
        .filter(key => GENERIC_FIELD_LABELS[key] && data[key] !== undefined && data[key] !== null && data[key] !== "")
        .map(key => ({ key, label: GENERIC_FIELD_LABELS[key] }));

    for (const field of fieldDefs) {
        const value = data[field.key];
        if (value === undefined || value === null || value === "") continue;
        embed.addFields({ name: field.label, value: String(value), inline: false });
    }

    embed.addFields(
        { name: "🕐 Zeitpunkt", value: formatTimestamp(), inline: true },
        { name: "🏙️ Server", value: data.server || SETTINGS.serverName, inline: true }
    );

    return embed;
}

/**
 * Sendet ein RP-Ereignis für einen Discord-Server an dessen gespeicherten Webhook.
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
async function dispatchRpLog(guildId, type, data) {
    const config = storage.getGuildConfig(guildId);

    if (!config.webhookUrl) {
        storage.registerLogFailure(guildId);
        return { success: false, reason: "no_webhook" };
    }

    const embed = buildEventEmbed(type, data);
    if (!embed) {
        storage.registerLogFailure(guildId);
        return { success: false, reason: "unknown_type" };
    }

    try {
        const webhookClient = new WebhookClient({ url: config.webhookUrl });
        await webhookClient.send({ embeds: [embed] });
        storage.registerLogSuccess(guildId);
        return { success: true };
    } catch (error) {
        console.error(`❌ [RP-Logs] Log konnte nicht gesendet werden (Guild ${guildId}):`, error);
        storage.registerLogFailure(guildId);
        return { success: false, reason: "webhook_error" };
    }
}

// =====================================================
// 🚀 INITIALISIERUNG
// =====================================================

function initializeRPLogsSystem(client, options = {}) {
    CLIENT = client;
    SETTINGS = {
        prefix: options.prefix || "!",
        serverName: options.serverName || "Notruf Hamburg",
        botOwnerId: options.botOwnerId || null,
        permissionRoleIds: options.permissionRoleIds || []
    };

    client.on("messageCreate", async message => {
        try {
            if (message.author.bot || !message.guild) return;
            if (!message.content.startsWith(SETTINGS.prefix)) return;

            const command = message.content
                .slice(SETTINGS.prefix.length)
                .trim()
                .split(/\s+/)[0]
                .toLowerCase();

            if (command === "rp-logs-einstellungen") {
                await handleSettingsCommand(message);
            } else if (command === "web-logs") {
                await handleWebLogsCommand(message);
            }
        } catch (error) {
            console.error("❌ [RP-Logs] Fehler bei messageCreate:", error);
        }
    });

    client.on("interactionCreate", async interaction => {
        try {
            await handleInteraction(interaction);
        } catch (error) {
            console.error("❌ [RP-Logs] Fehler bei interactionCreate:", error);
        }
    });

    console.log("✅ [RP-Logs] RP-Web-Logs-System wurde initialisiert.");
}

module.exports = {
    initializeRPLogsSystem,
    dispatchRpLog,
    getGuildConfig: storage.getGuildConfig
};