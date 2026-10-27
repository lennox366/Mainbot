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
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelType,
    WebhookClient,
    PermissionsBitField,
    MessageFlags
} = require("discord.js");

const storage = require("./Rp-logs-storage");
const { EVENT_TEMPLATES, GENERIC_FIELD_LABELS } = require("./Rp-logs-templates");

const NEXORA_COLOR = 0x5865F2;
const CHANNEL_PAGE_SIZE = 25; // Discord-Limit pro Dropdown

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
                name: "🔗 RP-Webhook",
                value: storage.hasRpWebhook(guildId) ? "🟢 Aktiv" : "🔴 Nicht eingerichtet",
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

function buildSettingsComponents(guildId) {
    const hasWebhook = storage.hasRpWebhook(guildId);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("rplogs_webhook_create")
            .setLabel(hasWebhook ? "RP-Webhook aktiv" : "RP-Webhook erstellen")
            .setEmoji(hasWebhook ? "🟢" : "🔗")
            .setStyle(hasWebhook ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("rplogs_webhook_show")
            .setLabel("Webhook-URL anzeigen")
            .setEmoji("👁️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasWebhook),
        new ButtonBuilder()
            .setCustomId("rplogs_webhook_remove")
            .setLabel("RP-Webhook entfernen")
            .setEmoji("🗑️")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!hasWebhook)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rplogs_channel_open").setLabel("Log-Kanal einstellen").setEmoji("📺").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("rplogs_webhook_test")
            .setLabel("RP-Webhook testen")
            .setEmoji("🧪")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasWebhook),
        new ButtonBuilder().setCustomId("rplogs_status").setLabel("Status anzeigen").setEmoji("📊").setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

// =====================================================
// 📺 LOG-KANAL – PAGINIERTE AUSWAHL
// =====================================================
// Discord erlaubt max. 25 Optionen pro Dropdown, daher werden ALLE
// Textkanäle des Servers geladen, nach Kategorie/Server-Reihenfolge
// sortiert und über eine Seiten-Navigation erreichbar gemacht.

function getSortedTextChannels(guild) {
    const categories = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);

    const textChannels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText);

    const groups = [];

    const uncategorized = textChannels
        .filter(c => !c.parentId)
        .sort((a, b) => a.position - b.position);

    if (uncategorized.size > 0) {
        groups.push({ categoryName: null, channels: [...uncategorized.values()] });
    }

    for (const category of categories.values()) {
        const children = textChannels
            .filter(c => c.parentId === category.id)
            .sort((a, b) => a.position - b.position);

        if (children.size > 0) {
            groups.push({ categoryName: category.name, channels: [...children.values()] });
        }
    }

    const flat = [];
    for (const group of groups) {
        for (const channel of group.channels) {
            flat.push({ channel, categoryName: group.categoryName });
        }
    }

    return flat;
}

async function loadAllTextChannels(guild) {
    // Stellt sicher, dass wirklich ALLE Kanäle geladen sind (nicht nur der Cache).
    try {
        await guild.channels.fetch();
    } catch (error) {
        console.error("❌ [RP-Logs] Kanäle konnten nicht vollständig geladen werden:", error);
    }
    return getSortedTextChannels(guild);
}

function paginateChannels(sortedChannels, page) {
    const totalPages = Math.max(1, Math.ceil(sortedChannels.length / CHANNEL_PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = safePage * CHANNEL_PAGE_SIZE;
    const items = sortedChannels.slice(start, start + CHANNEL_PAGE_SIZE);
    return { items, page: safePage, totalPages };
}

function parsePageFromCustomId(customId) {
    const page = parseInt(customId.split("_").pop(), 10);
    return Number.isNaN(page) ? 0 : page;
}

function buildChannelPageEmbed(guildId, pageItems, page, totalPages) {
    const config = storage.getGuildConfig(guildId);

    let description = "";
    let lastCategory = "__unset__";

    if (pageItems.length === 0) {
        description = "Keine Textkanäle gefunden.";
    }

    for (const { channel, categoryName } of pageItems) {
        if (categoryName !== lastCategory) {
            description += `\n📁 **${categoryName || "Ohne Kategorie"}**\n`;
            lastCategory = categoryName;
        }
        const marker = channel.id === config.channelId ? " ✅ **Aktueller Log-Kanal**" : "";
        description += `#・${channel.name}${marker}\n`;
    }

    return new EmbedBuilder()
        .setColor(NEXORA_COLOR)
        .setTitle("📺 Log-Kanal auswählen")
        .setDescription(description.trim())
        .setFooter({ text: `NoVex RP • RP-Web-Logs-System • Seite ${page + 1} / ${totalPages}` })
        .setTimestamp();
}

function buildChannelPageComponents(guildId, pageItems, page, totalPages) {
    const config = storage.getGuildConfig(guildId);

    const rows = [];

    if (pageItems.length > 0) {
        const options = pageItems.map(({ channel, categoryName }) => {
            const isCurrent = channel.id === config.channelId;

            return new StringSelectMenuOptionBuilder()
                .setLabel(`#・${channel.name}`.slice(0, 100))
                .setValue(channel.id)
                .setDescription(
                    (isCurrent ? "✅ Aktueller Log-Kanal • " : "") + (categoryName || "Ohne Kategorie")
                    .slice(0, 100)
                )
                .setEmoji(isCurrent ? "✅" : "📺")
                .setDefault(isCurrent);
        });

        rows.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`rplogs_channelpage_select_${page}`)
                    .setPlaceholder("Wähle den Log-Kanal aus")
                    .addOptions(options)
            )
        );
    }

    rows.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rplogs_channelpage_prev_${page}`)
                .setLabel("Zurück")
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId("rplogs_channelpage_indicator")
                .setLabel(`Seite ${page + 1} / ${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`rplogs_channelpage_next_${page}`)
                .setLabel("Weiter")
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        )
    );

    return rows;
}

async function renderChannelPage(interaction, page, options = {}) {
    const sortedChannels = await loadAllTextChannels(interaction.guild);
    const { items, page: safePage, totalPages } = paginateChannels(sortedChannels, page);

    const embed = buildChannelPageEmbed(interaction.guild.id, items, safePage, totalPages);

    if (options.noteDescription) {
        embed.setDescription(`${options.noteDescription}\n${embed.data.description || ""}`.trim());
    }

    const components = buildChannelPageComponents(interaction.guild.id, items, safePage, totalPages);

    const payload = { embeds: [embed], components };

    if (options.asReply) {
        return interaction.reply({ ...payload, ephemeral: true });
    }

    return interaction.update(payload);
}

function buildStatusEmbed(guildId) {
    const config = storage.getGuildConfig(guildId);
    const hasWebhook = storage.hasRpWebhook(guildId);

    const embed = new EmbedBuilder()
        .setColor(hasWebhook ? 0x57F287 : 0xED4245)
        .setTitle("📊 NoVex RP – RP-Logs Status")
        .setTimestamp();

    if (!hasWebhook) {
        embed.addFields({
            name: "🔴 RP-Webhook",
            value: "Nicht eingerichtet – erstelle ihn über `/rp-logs-einstellungen` → „RP-Webhook erstellen“.",
            inline: false
        });
        return embed;
    }

    embed.addFields(
        { name: "🟢 RP-Webhook", value: "Aktiv (von NoVex RP verwaltet)", inline: true },
        { name: "📺 Log-Kanal", value: config.webhookChannelId ? `<#${config.webhookChannelId}>` : "Nicht eingestellt", inline: true },
        { name: "📡 Verbindung", value: "Online", inline: true },
        { name: "🕐 Webhook erstellt", value: config.webhookCreatedAt ? formatTimestamp(new Date(config.webhookCreatedAt)) : "Unbekannt", inline: true },
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
        return message.reply("❌ Der eingestellte Log-Kanal wurde nicht gefunden. Bitte stelle ihn erneut über `/rp-logs-einstellungen` ein.");
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
        components: buildSettingsComponents(message.guild.id)
    });
}

// =====================================================
// 🧩 INTERAKTIONEN (Buttons / Modals / Select-Menüs)
// =====================================================

async function handleInteraction(interaction) {
    if (!interaction.guild) return;
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

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

    // ---------- RP-Webhook automatisch erstellen ----------
    // Der Webhook wird von NoVex RP selbst über die Discord-API erstellt.
    // Es wird NIEMALS eine Webhook-URL manuell abgefragt oder angezeigt.
    if (interaction.customId === "rplogs_webhook_create") {
        if (storage.hasRpWebhook(guildId)) {
            return interaction.reply({ content: "🟢 Es existiert bereits ein aktiver RP-Webhook.", ephemeral: true });
        }

        const config = storage.getGuildConfig(guildId);
        if (!config.channelId) {
            return interaction.reply({
                content: "❌ Stelle zuerst über \"Log-Kanal einstellen\" fest, in welchem Kanal die RP-Logs erscheinen sollen.",
                ephemeral: true
            });
        }

        try {
            const targetChannel = await interaction.guild.channels.fetch(config.channelId);
            if (!targetChannel) {
                return interaction.reply({ content: "❌ Der eingestellte Log-Kanal wurde nicht gefunden.", ephemeral: true });
            }

            const webhook = await targetChannel.createWebhook({
                name: "NoVex RP RP-Logs",
                reason: `RP-Logs-Webhook erstellt von ${interaction.user.tag}`
            });

            storage.setRpWebhook(guildId, {
                id: webhook.id,
                token: webhook.token,
                channelId: targetChannel.id
            });

            const webhookUrl = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;

            return interaction.reply({
                content:
                    `✅ Eigener RP-Webhook wurde in <#${targetChannel.id}> erstellt.\n\n` +
                    `🔗 **Webhook-URL** (für dein Roblox-Script):\n\`\`\`${webhookUrl}\`\`\`\n` +
                    `⚠️ Diese URL erlaubt jedem, der sie kennt, Nachrichten in <#${targetChannel.id}> zu posten. ` +
                    `Teile sie nur mit deinem Roblox-Script/Server und niemals öffentlich.`,
                ephemeral: true
            });
        } catch (error) {
            console.error(`❌ [RP-Logs] RP-Webhook konnte nicht erstellt werden (Guild ${guildId}):`, error);
            return interaction.reply({
                content: "❌ Der RP-Webhook konnte nicht erstellt werden. Hat der Bot die Berechtigung \"Webhooks verwalten\" im Log-Kanal?",
                ephemeral: true
            });
        }
    }

    // ---------- RP-Webhook-URL erneut anzeigen ----------
    if (interaction.customId === "rplogs_webhook_show") {
        const config = storage.getGuildConfig(guildId);

        if (!storage.hasRpWebhook(guildId)) {
            return interaction.reply({ content: "❌ Es ist noch kein RP-Webhook eingerichtet.", ephemeral: true });
        }

        const webhookUrl = `https://discord.com/api/webhooks/${config.webhookId}/${config.webhookToken}`;

        return interaction.reply({
            content:
                `🔗 **Webhook-URL** (für dein Roblox-Script):\n\`\`\`${webhookUrl}\`\`\`\n` +
                `⚠️ Nur mit deinem Roblox-Script/Server teilen, niemals öffentlich posten.`,
            ephemeral: true
        });
    }

    // ---------- RP-Webhook entfernen ----------
    if (interaction.customId === "rplogs_webhook_remove") {
        const config = storage.getGuildConfig(guildId);

        if (!storage.hasRpWebhook(guildId)) {
            return interaction.reply({ content: "❌ Es ist kein RP-Webhook eingerichtet.", ephemeral: true });
        }

        try {
            const webhookClient = new WebhookClient({ id: config.webhookId, token: config.webhookToken });
            await webhookClient.delete("RP-Webhook über Einstellungen entfernt");
        } catch (error) {
            // Webhook existiert bei Discord evtl. nicht mehr (z.B. Kanal gelöscht) -> trotzdem lokal bereinigen
            console.error(`❌ [RP-Logs] RP-Webhook konnte bei Discord nicht gelöscht werden (Guild ${guildId}):`, error);
        }

        storage.removeRpWebhook(guildId);
        return interaction.reply({ content: "🗑️ Der RP-Webhook wurde entfernt.", ephemeral: true });
    }

    // ---------- Log-Kanal: Öffnen (Seite 1) ----------
    if (interaction.customId === "rplogs_channel_open") {
        return renderChannelPage(interaction, 0, { asReply: true });
    }

    // ---------- Log-Kanal: Zurück ----------
    if (interaction.customId.startsWith("rplogs_channelpage_prev_")) {
        const currentPage = parsePageFromCustomId(interaction.customId);
        return renderChannelPage(interaction, currentPage - 1);
    }

    // ---------- Log-Kanal: Weiter ----------
    if (interaction.customId.startsWith("rplogs_channelpage_next_")) {
        const currentPage = parsePageFromCustomId(interaction.customId);
        return renderChannelPage(interaction, currentPage + 1);
    }

    // ---------- Log-Kanal: Auswahl getroffen ----------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("rplogs_channelpage_select_")) {
        const currentPage = parsePageFromCustomId(interaction.customId);
        const channelId = interaction.values[0];
        const config = storage.getGuildConfig(guildId);

        storage.setLogChannel(guildId, channelId);

        let note = `✅ Log-Kanal wurde auf <#${channelId}> gesetzt.\n`;

        // Existiert bereits ein RP-Webhook und der Kanal ändert sich, darf der
        // ALTE Webhook NICHT im neuen Kanal weiterverwendet werden: erst
        // sauber entfernen, dann im neuen Kanal automatisch neu erstellen.
        if (storage.hasRpWebhook(guildId) && config.webhookChannelId !== channelId) {
            try {
                const oldWebhookClient = new WebhookClient({ id: config.webhookId, token: config.webhookToken });
                await oldWebhookClient.delete("RP-Log-Kanal wurde geändert");
            } catch (error) {
                console.error(`❌ [RP-Logs] Alter RP-Webhook konnte nicht gelöscht werden (Guild ${guildId}):`, error);
            }

            try {
                const newChannel = await interaction.guild.channels.fetch(channelId);
                const webhook = await newChannel.createWebhook({
                    name: "NoVex RP RP-Logs",
                    reason: `RP-Log-Kanal geändert von ${interaction.user.tag}`
                });

                storage.setRpWebhook(guildId, {
                    id: webhook.id,
                    token: webhook.token,
                    channelId: newChannel.id
                });

                note += `🔄 Der RP-Webhook wurde automatisch in den neuen Kanal umgezogen.\n`;
            } catch (error) {
                console.error(`❌ [RP-Logs] RP-Webhook konnte nicht im neuen Kanal erstellt werden (Guild ${guildId}):`, error);
                storage.removeRpWebhook(guildId);
                note += `❌ Der RP-Webhook konnte im neuen Kanal nicht neu erstellt werden. Bitte über "RP-Webhook erstellen" erneut einrichten.\n`;
            }
        }

        return renderChannelPage(interaction, currentPage, { noteDescription: note });
    }

    // ---------- RP-Webhook testen ----------
    if (interaction.customId === "rplogs_webhook_test") {
        const config = storage.getGuildConfig(guildId);

        if (!storage.hasRpWebhook(guildId)) {
            return interaction.reply({ content: "❌ Es ist noch kein RP-Webhook eingerichtet.", ephemeral: true });
        }

        try {
            const webhookClient = new WebhookClient({ id: config.webhookId, token: config.webhookToken });
            await webhookClient.send({ embeds: [buildTestEmbed(guildId)] });
            return interaction.reply({ content: "✅ Testnachricht wurde erfolgreich über den RP-Webhook gesendet.", ephemeral: true });
        } catch (error) {
            console.error(`❌ [RP-Logs] RP-Webhook-Test fehlgeschlagen (Guild ${guildId}):`, error);
            return interaction.reply({
                content: "❌ Der RP-Webhook konnte nicht erreicht werden. Möglicherweise wurde er außerhalb von NoVex RP gelöscht – versuche \"RP-Webhook entfernen\" und dann \"RP-Webhook erstellen\".",
                ephemeral: true
            });
        }
    }

    // ---------- Status ----------
    if (interaction.customId === "rplogs_status") {
        return interaction.reply({ embeds: [buildStatusEmbed(guildId)], ephemeral: true });
    }
}

// =====================================================
// 🧪 TEST-BEFEHL (!rp-logs-test)
// =====================================================
// Sendet einen Test-Log DIREKT über den eingerichteten RP-Log-Webhook
// (unabhängig von der Roblox-API). Funktioniert dieser Test, aber ein
// echtes Roblox-Event kommt nicht an, liegt der Fehler garantiert an
// der Roblox → NoVex RP-API-Verbindung (Secret-Key/URL), nicht am Bot.

function buildTestEmbed(guildId) {
    const config = storage.getGuildConfig(guildId);

    return new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("🧪 NoVex RP RP-Logs")
        .setDescription("✅ Eigener RP-Webhook funktioniert.")
        .addFields(
            { name: "📡 System", value: "NoVex RP RP-Logs", inline: true },
            { name: "📺 Kanal", value: config.webhookChannelId ? `<#${config.webhookChannelId}>` : "Nicht eingestellt", inline: true },
            { name: "🕐 Zeitpunkt", value: formatTimestamp(), inline: true }
        )
        .setFooter({ text: "NoVex RP • RP-Web-Logs-System" });
}

async function handleTestCommand(message) {
    if (!hasSettingsPermission(message.member)) {
        return message.reply("❌ Du hast keine Berechtigung, diesen Befehl zu verwenden.");
    }

    const guildId = message.guild.id;
    const config = storage.getGuildConfig(guildId);

    if (!storage.hasRpWebhook(guildId)) {
        return message.reply(
            "❌ Es ist noch kein eigener RP-Webhook eingerichtet. " +
            "Erstelle ihn zuerst über `/rp-logs-einstellungen` → „RP-Webhook erstellen“."
        );
    }

    try {
        const webhookClient = new WebhookClient({ id: config.webhookId, token: config.webhookToken });
        await webhookClient.send({ embeds: [buildTestEmbed(guildId)] });
        return message.reply(
            "✅ Test-Log wurde erfolgreich über den eigenen RP-Webhook gesendet.\n" +
            "ℹ️ Kommt später ein echtes Roblox-Event nicht an, liegt der Fehler an der " +
            "**Roblox → NoVex RP-API-Verbindung** (z. B. falscher Secret-Key) " +
            "– nicht am RP-Webhook selbst, denn der wurde gerade erfolgreich getestet."
        );
    } catch (error) {
        console.error(`❌ [RP-Logs] Test-Log fehlgeschlagen (Guild ${guildId}):`, error);
        return message.reply(
            "❌ Der Test-Log konnte nicht gesendet werden. Bitte überprüfe den RP-Webhook über " +
            "`/rp-logs-einstellungen` (ggf. „RP-Webhook entfernen“ und neu erstellen)."
        );
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

    if (!storage.hasRpWebhook(guildId)) {
        storage.registerLogFailure(guildId);
        return { success: false, reason: "no_webhook" };
    }

    const embed = buildEventEmbed(type, data);
    if (!embed) {
        storage.registerLogFailure(guildId);
        return { success: false, reason: "unknown_type" };
    }

    try {
        const webhookClient = new WebhookClient({ id: config.webhookId, token: config.webhookToken });
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
            } else if (command === "rp-logs-test") {
                await handleTestCommand(message);
            }
        } catch (error) {
            console.error("❌ [RP-Logs] Fehler bei messageCreate:", error);
        }
    });

    client.on("interactionCreate", async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                if (interaction.__slashCommandPermissionDenied) return;
                if (interaction.__slashCommandPermissionDenied) return;
                if (!interaction.guild) {
                    return interaction.reply({
                        content: "❌ Dieser Befehl funktioniert nur auf einem Server.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const commandHandlers = {
                    "rp-logs-einstellungen": handleSettingsCommand,
                    "web-logs": handleWebLogsCommand,
                    "rp-logs-test": handleTestCommand
                };
                const handler = commandHandlers[interaction.commandName];
                if (!handler) return;

                const messageAdapter = {
                    guild: interaction.guild,
                    member: interaction.member,
                    channel: interaction.channel,
                    reply: payload => interaction.reply(
                        typeof payload === "string"
                            ? { content: payload, flags: MessageFlags.Ephemeral }
                            : { ...payload, flags: payload.flags ?? MessageFlags.Ephemeral }
                    )
                };
                await handler(messageAdapter);
                return;
            }

            await handleInteraction(interaction);
        } catch (error) {
            console.error("❌ [RP-Logs] Fehler bei interactionCreate:", error);
            if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Der RP-Logs-Befehl konnte nicht abgeschlossen werden.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    });

    console.log("✅ [RP-Logs] RP-Web-Logs-System wurde initialisiert.");
}

module.exports = {
    initializeRPLogsSystem,
    dispatchRpLog,
    getGuildConfig: storage.getGuildConfig
};