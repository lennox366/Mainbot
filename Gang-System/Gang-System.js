// =====================================================
// 🏴 GANG-SYSTEM (NoVex RP)
// =====================================================
//
// Eigenständiges, in sich geschlossenes Modul für das
// Gang-System. Wird über initializeGangSystem(client, options)
// in index.js eingebunden (siehe INTEGRATION.md).
//
// Enthält:
//   - !gang-panel   -> Verwaltungspanel (eintragen/ändern/löschen)
//   - !gang-liste   -> automatisch aktualisierende Gang-Liste
//   - Dauerhafte Speicherung in gangs.json / gang-lists.json
//   - Dauerhafte Speicherung der Gang-Logos in data/gang-images/
//   - Serverseitige Berechtigungsprüfung
//
// -----------------------------------------------------
// ℹ️ WICHTIGER HINWEIS ZUM BILD-UPLOAD
// -----------------------------------------------------
// Discord-Modals (ModalBuilder) unterstützen ausschließlich
// Text-Eingabefelder (TextInputBuilder). Ein natives
// "Datei auswählen"-Feld innerhalb eines Modals gibt es in
// der Discord-API NICHT – das ist eine Plattform-Beschränkung,
// die sich nicht per Code umgehen lässt.
//
// Die in der Praxis übliche und zuverlässigste Lösung (die hier
// umgesetzt ist): Nach dem Absenden des Modals (Name / Link /
// Beschreibung) fordert der Bot den Nutzer auf, das Bild einfach
// als ganz normalen Datei-Anhang in den Kanal zu senden. Der Bot
// fängt diese Nachricht automatisch ab, lädt die Datei herunter,
// prüft Format & Größe und speichert sie dauerhaft unter
// data/gang-images/<gangId>.<ext>. Alternativ kann der Nutzer per
// Button ohne Logo fortfahren bzw. beim Bearbeiten das bisherige
// Logo behalten.
//
// Für den Nutzer bedeutet das im Endeffekt exakt den gewünschten
// Ablauf: Gang eintragen -> Logo hochladen -> wird gespeichert ->
// erscheint automatisch im Gang-Embed. Es ist keine Bild-URL mehr
// notwendig.
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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField,
    MessageFlags,
    AttachmentBuilder
} = require("discord.js");

// =====================================================
// KONFIGURATION / FARBEN
// =====================================================

const GANG_COLOR_PRIMARY = 0x8b5cf6; // Lila – NoVex RP-Akzent
const GANG_COLOR_SUCCESS = 0x57F287;
const GANG_COLOR_DANGER  = 0xED4245;
const GANG_COLOR_WARNING = 0xFEE75C;

const MAX_GANG_NAME_LENGTH   = 64;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_EMBEDS_PER_MESSAGE = 10; // Discord-Limit

// =====================================================
// KONFIGURATION / GANG-LOGO-UPLOAD
// =====================================================

const ALLOWED_LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
const MAX_LOGO_FILE_SIZE      = 8 * 1024 * 1024; // 8 MB
const LOGO_UPLOAD_TIMEOUT_MS  = 120000;           // 2 Minuten Zeit zum Hochladen

// =====================================================
// DATEIPFADE
// =====================================================

function resolveDataDir(options) {
    const dir = options.dataDir || __dirname;

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

function resolveGangImagesDir(options, dataDir) {
    const dir = options.gangImagesDir || path.join(dataDir, "gang-images");

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

// =====================================================
// MODUL-EINSTIEGSPUNKT
// =====================================================

function initializeGangSystem(client, options = {}) {

    const PREFIX = options.prefix || "!";
    const DATA_DIR = resolveDataDir(options);
    const GANG_IMAGES_DIR = resolveGangImagesDir(options, DATA_DIR);

    const GANGS_FILE      = path.join(DATA_DIR, "gangs.json");
    const GANG_LISTS_FILE = path.join(DATA_DIR, "gang-lists.json");

    // -------------------------------------------------
    // BERECHTIGUNGSPRÜFUNG
    // -------------------------------------------------
    // Niemals Rollen/IDs aus Benutzereingaben vertrauen –
    // ausschließlich serverseitige member.permissions /
    // member.roles.cache Prüfung.

    function hasGangManagePermission(member) {

        if (!member) {
            return false;
        }

        if (typeof options.hasPermission === "function") {
            try {
                return Boolean(options.hasPermission(member));
            } catch (error) {
                console.error("❌ Fehler in benutzerdefinierter Gang-Berechtigungsprüfung:", error);
                return false;
            }
        }

        if (options.botOwnerId && member.id === options.botOwnerId) {
            return true;
        }

        if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
            return true;
        }

        if (Array.isArray(options.permissionRoleIds)) {
            return options.permissionRoleIds.some(roleId => member.roles.cache.has(roleId));
        }

        return false;
    }

    // -------------------------------------------------
    // SPEICHERUNG – GANGS
    // -------------------------------------------------
    // Struktur: { "<guildId>": [ { id, name, ownerId, discordLink,
    //             logoFile, logoUrl, description, createdAt, createdBy }, ... ] }
    //
    // logoFile -> Dateiname innerhalb von data/gang-images/ (NEU, per Upload)
    // logoUrl  -> Externe Bild-URL (LEGACY, nur noch für bereits bestehende
    //             Einträge relevant; wird nicht mehr über das Modal gesetzt)

    function loadAllGangs() {
        try {
            if (!fs.existsSync(GANGS_FILE)) {
                fs.writeFileSync(GANGS_FILE, JSON.stringify({}, null, 2), "utf8");
                return {};
            }

            const data = JSON.parse(fs.readFileSync(GANGS_FILE, "utf8"));
            return (data && typeof data === "object" && !Array.isArray(data)) ? data : {};

        } catch (error) {
            console.error("❌ Fehler beim Laden der Gangs:", error);
            return {};
        }
    }

    function saveAllGangs(data) {
        try {
            fs.writeFileSync(GANGS_FILE, JSON.stringify(data, null, 2), "utf8");
            return true;
        } catch (error) {
            console.error("❌ Fehler beim Speichern der Gangs:", error);
            return false;
        }
    }

    function getGuildGangs(guildId) {
        const data = loadAllGangs();
        return Array.isArray(data[guildId]) ? data[guildId] : [];
    }

    function setGuildGangs(guildId, gangs) {
        const data = loadAllGangs();
        data[guildId] = gangs;
        return saveAllGangs(data);
    }

    function findGang(guildId, gangId) {
        return getGuildGangs(guildId).find(gang => gang.id === gangId) || null;
    }

    // -------------------------------------------------
    // SPEICHERUNG – GANG-LISTEN-NACHRICHTEN
    // -------------------------------------------------
    // Struktur: { "<guildId>": { "<channelId>": "<messageId>" } }
    // Damit lässt sich jede bestehende Gang-Liste anhand von
    // Guild-ID + Message-ID wiederfinden und bearbeiten.

    function loadAllGangLists() {
        try {
            if (!fs.existsSync(GANG_LISTS_FILE)) {
                fs.writeFileSync(GANG_LISTS_FILE, JSON.stringify({}, null, 2), "utf8");
                return {};
            }

            const data = JSON.parse(fs.readFileSync(GANG_LISTS_FILE, "utf8"));
            return (data && typeof data === "object" && !Array.isArray(data)) ? data : {};

        } catch (error) {
            console.error("❌ Fehler beim Laden der Gang-Listen:", error);
            return {};
        }
    }

    function saveAllGangLists(data) {
        try {
            fs.writeFileSync(GANG_LISTS_FILE, JSON.stringify(data, null, 2), "utf8");
            return true;
        } catch (error) {
            console.error("❌ Fehler beim Speichern der Gang-Listen:", error);
            return false;
        }
    }

    function registerGangListMessage(guildId, channelId, messageId) {
        const data = loadAllGangLists();
        if (!data[guildId]) {
            data[guildId] = {};
        }
        data[guildId][channelId] = messageId;
        saveAllGangLists(data);
    }

    function removeGangListMessage(guildId, channelId) {
        const data = loadAllGangLists();
        if (data[guildId] && data[guildId][channelId]) {
            delete data[guildId][channelId];
            saveAllGangLists(data);
        }
    }

    // -------------------------------------------------
    // HILFSFUNKTIONEN
    // -------------------------------------------------

    function errorReply(text) {
        return {
            content: `❌ ${text}`,
            flags: MessageFlags.Ephemeral
        };
    }

    // Antwortet auf eine Interaktion unabhängig davon, ob sie bereits per
    // deferReply() "quittiert" wurde oder nicht. Wichtig für Handler, die vor
    // ihrer eigentlichen Antwort noch (potenziell langsame) awaits ausführen
    // (z. B. refreshAllGangLists) – ohne vorheriges deferReply() würde Discord
    // die Interaktion nach 3 Sekunden verwerfen ("Unknown interaction", 10062).
    async function respondOrEdit(interaction, payload) {
        if (interaction.deferred || interaction.replied) {
            const { flags, ...editablePayload } = payload;
            return interaction.editReply(editablePayload);
        }

        return interaction.reply(payload);
    }

    function successReply(text) {
        return {
            content: `✅ ${text}`,
            flags: MessageFlags.Ephemeral
        };
    }

    function isValidUrl(value) {
        if (!value) {
            return false;
        }

        try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }

    function truncate(text, max) {
        if (!text) {
            return text;
        }
        return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    }

    // -------------------------------------------------
    // GANG-LOGO – DATEIVERWALTUNG
    // -------------------------------------------------

    function deleteExistingGangLogoFiles(gangId) {
        try {
            const files = fs.readdirSync(GANG_IMAGES_DIR);
            for (const file of files) {
                if (file.startsWith(`${gangId}.`)) {
                    fs.unlinkSync(path.join(GANG_IMAGES_DIR, file));
                }
            }
        } catch (error) {
            console.error(`❌ Fehler beim Löschen alter Gang-Logo-Dateien (${gangId}):`, error);
        }
    }

    function deleteGangLogoFileIfUnused(gang) {
        if (!gang || !gang.logoFile) {
            return;
        }

        try {
            const allData = loadAllGangs();

            const stillUsedElsewhere = Object.values(allData).some(list =>
                Array.isArray(list) && list.some(other => other.id !== gang.id && other.logoFile === gang.logoFile)
            );

            if (stillUsedElsewhere) {
                return;
            }

            const filePath = path.join(GANG_IMAGES_DIR, gang.logoFile);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error(`❌ Fehler beim Löschen der Gang-Logo-Datei (${gang.logoFile}):`, error);
        }
    }

    function resolveExtensionFromAttachment(attachment) {
        const nameExt = (attachment.name || "").split(".").pop()?.toLowerCase();

        if (nameExt && ALLOWED_LOGO_EXTENSIONS.includes(nameExt)) {
            return nameExt;
        }

        const contentType = (attachment.contentType || "").toLowerCase();

        if (contentType.includes("png")) return "png";
        if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
        if (contentType.includes("webp")) return "webp";
        if (contentType.includes("gif")) return "gif";

        return null;
    }

    function downloadBuffer(url) {
        return new Promise((resolve, reject) => {
            https.get(url, res => {

                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    downloadBuffer(res.headers.location).then(resolve, reject);
                    return;
                }

                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`Unerwarteter Status-Code beim Download: ${res.statusCode}`));
                    return;
                }

                const chunks = [];
                res.on("data", chunk => chunks.push(chunk));
                res.on("end", () => resolve(Buffer.concat(chunks)));
                res.on("error", reject);

            }).on("error", reject);
        });
    }

    async function saveGangLogoAttachment(gangId, attachment) {

        const extension = resolveExtensionFromAttachment(attachment);

        if (!extension) {
            return { success: false, reason: "format" };
        }

        if (attachment.size && attachment.size > MAX_LOGO_FILE_SIZE) {
            return { success: false, reason: "size" };
        }

        let buffer;

        try {
            buffer = await downloadBuffer(attachment.url);
        } catch (error) {
            console.error("❌ Fehler beim Herunterladen des Gang-Logos:", error);
            return { success: false, reason: "download" };
        }

        // Alte Datei(en) dieser Gang entfernen, bevor die neue gespeichert wird
        // (z. B. falls sich die Dateiendung geändert hat).
        deleteExistingGangLogoFiles(gangId);

        const filename = `${gangId}.${extension}`;
        const filePath = path.join(GANG_IMAGES_DIR, filename);

        try {
            fs.writeFileSync(filePath, buffer);
        } catch (error) {
            console.error("❌ Fehler beim Speichern des Gang-Logos:", error);
            return { success: false, reason: "write" };
        }

        return { success: true, filename };
    }

    function buildGangLogoAttachment(gang) {

        if (gang.logoFile) {
            const filePath = path.join(GANG_IMAGES_DIR, gang.logoFile);

            if (fs.existsSync(filePath)) {
                return {
                    attachment: new AttachmentBuilder(filePath, { name: gang.logoFile }),
                    thumbnailUrl: `attachment://${gang.logoFile}`
                };
            }
        }

        // Legacy-Unterstützung: ältere Gangs, die noch über eine
        // externe Bild-URL verfügen (vor der Umstellung auf Datei-Upload).
        if (gang.logoUrl) {
            return { attachment: null, thumbnailUrl: gang.logoUrl };
        }

        return { attachment: null, thumbnailUrl: null };
    }

    function logoErrorReasonText(reason) {
        return {
            format: "Das Dateiformat wird nicht unterstützt (erlaubt: PNG, JPG, JPEG, WEBP, GIF).",
            size: "Die Datei war zu groß (maximal 8 MB erlaubt).",
            download: "Die Datei konnte nicht von Discord heruntergeladen werden.",
            write: "Die Datei konnte nicht gespeichert werden."
        }[reason] || "Unbekannter Fehler beim Hochladen des Logos.";
    }

    // -------------------------------------------------
    // GANG-LOGO – UPLOAD-DIALOG (ERSATZ FÜR BILD-URL-FELD)
    // -------------------------------------------------
    // Da Discord-Modals keine Datei-Uploads unterstützen, wird der
    // Nutzer nach dem Absenden des Text-Modals gebeten, das Bild
    // einfach als Anhang in den Kanal zu senden. Alternativ kann er
    // per Button ohne Logo fortfahren / das bisherige Logo behalten.

    function buildLogoSkipRow(customId, label) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel(label)
                .setEmoji("⏭️")
                .setStyle(ButtonStyle.Secondary)
        );
    }

    async function promptAndCollectGangLogo(interaction, { gangId, skipLabel, introContent }) {

        const skipCustomId = `gang_logo_skip_${gangId}_${Date.now()}`;

        await respondOrEdit(interaction, {
            content: introContent,
            components: [buildLogoSkipRow(skipCustomId, skipLabel)],
            flags: MessageFlags.Ephemeral
        });

        const promptMessage = await interaction.fetchReply();

        const messagePromise = interaction.channel.awaitMessages({
            filter: m => m.author.id === interaction.user.id && m.attachments.size > 0,
            max: 1,
            time: LOGO_UPLOAD_TIMEOUT_MS
        })
            .then(collected => collected.first() || null)
            .catch(() => null);

        const buttonPromise = promptMessage.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id && i.customId === skipCustomId,
            time: LOGO_UPLOAD_TIMEOUT_MS
        })
            .then(async btnInteraction => {
                await btnInteraction.deferUpdate().catch(() => {});
                return { skipped: true };
            })
            .catch(() => null);

        const result = await Promise.race([messagePromise, buttonPromise]);

        if (!result) {
            return { outcome: "timeout" };
        }

        if (result.skipped) {
            return { outcome: "skipped" };
        }

        // Ergebnis ist eine Nachricht mit mindestens einem Anhang
        const attachment = result.attachments.first();
        const saveResult = await saveGangLogoAttachment(gangId, attachment);

        // Nachricht des Nutzers nach Möglichkeit aufräumen (kein Fehler, falls Rechte fehlen).
        result.delete().catch(() => {});

        if (!saveResult.success) {
            return { outcome: "error", reason: saveResult.reason };
        }

        return { outcome: "uploaded", filename: saveResult.filename };
    }

    // -------------------------------------------------
    // EMBED / PANEL BAUEN
    // -------------------------------------------------

    function buildGangPanelPayload(guildId) {

        const gangs = getGuildGangs(guildId);

        const embed = new EmbedBuilder()
            .setColor(GANG_COLOR_PRIMARY)
            .setTitle("🏴 Gang-Verwaltung")
            .setDescription(
                "Verwalte hier die Gangs des Servers.\n\n" +
                `📋 **Eingetragene Gangs:** ${gangs.length}\n\n` +
                "➕ **Gang eintragen** – neue Gang registrieren\n" +
                "✏️ **Gang ändern** – bestehende Gang bearbeiten\n" +
                "🗑️ **Gang löschen** – bestehende Gang entfernen"
            )
            .setFooter({ text: "NoVex RP • Gang-System" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("gang_panel_add")
                .setLabel("Gang eintragen")
                .setEmoji("➕")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("gang_panel_edit")
                .setLabel("Gang ändern")
                .setEmoji("✏️")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("gang_panel_delete")
                .setLabel("Gang löschen")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        );

        return { embeds: [embed], components: [row] };
    }

    // Gibt { embed, attachment } zurück. "attachment" ist entweder ein
    // AttachmentBuilder (bei lokal gespeichertem Logo) oder null. Wird
    // ein attachment zurückgegeben, MUSS es im "files"-Array der
    // jeweiligen reply/update/send/edit-Payload mitgeschickt werden,
    // damit "attachment://..." im Embed aufgelöst werden kann.
    function buildSingleGangEmbed(gang) {

        const { attachment, thumbnailUrl } = buildGangLogoAttachment(gang);

        const embed = new EmbedBuilder()
            .setColor(GANG_COLOR_PRIMARY)
            .setTitle(`🏴 ${gang.name}`)
            .addFields(
                { name: "👑 Owner", value: `<@${gang.ownerId}>`, inline: true },
                { name: "🔗 Discord", value: `[Discord beitreten](${gang.discordLink})`, inline: true }
            );

        if (gang.description) {
            embed.addFields({ name: "📝 Beschreibung", value: gang.description, inline: false });
        }

        if (thumbnailUrl) {
            embed.setThumbnail(thumbnailUrl);
        }

        embed.setFooter({ text: `Gang-ID: ${gang.id}` });

        return { embed, attachment };
    }

    function buildGangListPayload(guild) {

        const gangs = getGuildGangs(guild.id);

        const headerEmbed = new EmbedBuilder()
            .setColor(GANG_COLOR_PRIMARY)
            .setTitle(`📋 Gang-Liste — ${guild.name}`)
            .setTimestamp();

        if (gangs.length === 0) {
            headerEmbed.setDescription("Aktuell sind noch keine Gangs eingetragen.");
            return { embeds: [headerEmbed], files: [] };
        }

        headerEmbed.setDescription(`🏴 Aktuell eingetragene Gangs: **${gangs.length}**`);

        const embeds = [headerEmbed];
        const files = [];

        const visibleGangs = gangs.slice(0, MAX_EMBEDS_PER_MESSAGE - 1);
        const remaining = gangs.length - visibleGangs.length;

        for (const gang of visibleGangs) {
            const { embed, attachment } = buildSingleGangEmbed(gang);
            embeds.push(embed);

            if (attachment) {
                files.push(attachment);
            }
        }

        if (remaining > 0) {
            headerEmbed.addFields({
                name: "ℹ️ Hinweis",
                value: `... und **${remaining}** weitere Gang(s). Bitte Gang-Liste-Kanal ggf. anpassen.`,
                inline: false
            });
        }

        return { embeds, files };
    }

    // -------------------------------------------------
    // GANG-LISTEN AUTOMATISCH AKTUALISIEREN
    // -------------------------------------------------

    async function refreshAllGangLists(guild) {

        const data = loadAllGangLists();
        const guildLists = data[guild.id];

        if (!guildLists) {
            return;
        }

        const payload = buildGangListPayload(guild);

        for (const channelId of Object.keys(guildLists)) {
            const messageId = guildLists[channelId];

            try {
                const channel = await guild.channels.fetch(channelId).catch(() => null);

                if (!channel || !channel.isTextBased?.()) {
                    removeGangListMessage(guild.id, channelId);
                    continue;
                }

                const message = await channel.messages.fetch(messageId).catch(() => null);

                if (!message) {
                    removeGangListMessage(guild.id, channelId);
                    continue;
                }

                await message.edit({
                    embeds: payload.embeds,
                    files: payload.files,
                    attachments: [] // alte Logo-Anhänge entfernen, damit nur aktuelle Bilder angezeigt werden
                });

            } catch (error) {
                console.error(`❌ Fehler beim Aktualisieren der Gang-Liste in Kanal ${channelId}:`, error);
            }
        }
    }

    // -------------------------------------------------
    // MODALS
    // -------------------------------------------------
    // Enthält nur noch Text-Felder. Das Gang-Logo wird NICHT mehr
    // über eine Bild-URL im Modal abgefragt, sondern im Anschluss
    // per Datei-Upload (siehe promptAndCollectGangLogo).

    function buildGangModal(customId, { title, name = "", link = "", description = "" }) {

        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle(title);

        const nameInput = new TextInputBuilder()
            .setCustomId("gang_name")
            .setLabel("Gang-Name")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(MAX_GANG_NAME_LENGTH)
            .setRequired(true);
        if (name) nameInput.setValue(name);

        const linkInput = new TextInputBuilder()
            .setCustomId("gang_link")
            .setLabel("Discord-Link der Gang")
            .setPlaceholder("https://discord.gg/...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        if (link) linkInput.setValue(link);

        const descriptionInput = new TextInputBuilder()
            .setCustomId("gang_description")
            .setLabel("Beschreibung der Gang (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
            .setRequired(false);
        if (description) descriptionInput.setValue(description);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(linkInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        return modal;
    }

    // -------------------------------------------------
    // BEFEHLE (PREFIX)
    // -------------------------------------------------

    client.on("messageCreate", async message => {
        try {

            if (message.author.bot || !message.guild) {
                return;
            }

            if (!message.content.startsWith(PREFIX)) {
                return;
            }

            const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
            const command = args.shift()?.toLowerCase();

            // =================================================
            // !GANG-PANEL
            // =================================================

            if (command === "gang-panel") {

                if (!hasGangManagePermission(message.member)) {
                    return message.reply(errorReply("Du hast keine Berechtigung, das Gang-Panel zu verwenden.").content);
                }

                await message.channel.send(buildGangPanelPayload(message.guild.id));
                return;
            }

            // =================================================
            // !GANG-LISTE
            // =================================================

            if (command === "gang-liste") {

                const payload = buildGangListPayload(message.guild);

                // Falls in diesem Kanal bereits eine Liste existiert,
                // alte Nachricht entfernen, damit kein Duplikat entsteht.
                const existing = loadAllGangLists()[message.guild.id]?.[message.channel.id];

                if (existing) {
                    const oldMessage = await message.channel.messages.fetch(existing).catch(() => null);
                    if (oldMessage) {
                        await oldMessage.delete().catch(() => null);
                    }
                    removeGangListMessage(message.guild.id, message.channel.id);
                }

                const sent = await message.channel.send({ embeds: payload.embeds, files: payload.files });
                registerGangListMessage(message.guild.id, message.channel.id, sent.id);
                return;
            }

        } catch (error) {
            console.error("❌ Fehler im Gang-System (messageCreate):", error);
        }
    });

    // -------------------------------------------------
    // INTERAKTIONEN (BUTTONS / SELECTS / MODALS)
    // -------------------------------------------------

    client.on("interactionCreate", async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                if (interaction.__slashCommandPermissionDenied) return;
                if (!interaction.guild || !interaction.channel?.isTextBased()) {
                    return interaction.reply({
                        content: "❌ Dieser Befehl funktioniert nur in einem Server-Textkanal.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.commandName === "gang-panel") {
                    if (!hasGangManagePermission(interaction.member)) {
                        return interaction.reply({
                            content: errorReply("Du hast keine Berechtigung, das Gang-Panel zu verwenden.").content,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.channel.send(buildGangPanelPayload(interaction.guild.id));
                    return interaction.reply({
                        content: "✅ Das Gang-Panel wurde erstellt.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.commandName === "gang-liste") {
                    const payload = buildGangListPayload(interaction.guild);
                    const existing = loadAllGangLists()[interaction.guild.id]?.[interaction.channel.id];

                    if (existing) {
                        const oldMessage = await interaction.channel.messages.fetch(existing).catch(() => null);
                        if (oldMessage) await oldMessage.delete().catch(() => null);
                        removeGangListMessage(interaction.guild.id, interaction.channel.id);
                    }

                    const sent = await interaction.channel.send({
                        embeds: payload.embeds,
                        files: payload.files
                    });
                    registerGangListMessage(interaction.guild.id, interaction.channel.id, sent.id);
                    return interaction.reply({
                        content: "✅ Die Gang-Liste wurde erstellt.",
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if (!interaction.guild) {
                return;
            }

            const guildId = interaction.guild.id;

            // =================================================
            // PANEL-BUTTONS
            // =================================================

            if (interaction.isButton() && interaction.customId === "gang_panel_add") {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs einzutragen."));
                }

                const row = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId("gang_add_owner_select")
                        .setPlaceholder("👑 Wähle den Owner der Gang aus")
                        .setMinValues(1)
                        .setMaxValues(1)
                );

                const cancelRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("gang_add_cancel")
                        .setLabel("Abbrechen")
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({
                    content: "🏴 **Neue Gang eintragen**\nWähle zunächst den Owner der Gang aus:",
                    components: [row, cancelRow],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.isButton() && interaction.customId === "gang_add_cancel") {
                return interaction.update({
                    content: "❌ Vorgang abgebrochen.",
                    embeds: [],
                    components: []
                });
            }

            if (interaction.isButton() && interaction.customId === "gang_panel_edit") {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu ändern."));
                }

                const gangs = getGuildGangs(guildId);

                if (gangs.length === 0) {
                    return interaction.reply(errorReply("Es sind aktuell keine Gangs eingetragen."));
                }

                const options = gangs.slice(0, 25).map(gang =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(truncate(gang.name, 100))
                        .setValue(gang.id)
                        .setEmoji("🏴")
                );

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("gang_edit_select")
                        .setPlaceholder("✏️ Wähle die Gang aus, die du ändern möchtest")
                        .addOptions(options)
                );

                return interaction.reply({
                    content: "✏️ **Gang ändern**\nWähle eine Gang aus der Liste:",
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.isButton() && interaction.customId === "gang_panel_delete") {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu löschen."));
                }

                const gangs = getGuildGangs(guildId);

                if (gangs.length === 0) {
                    return interaction.reply(errorReply("Es sind aktuell keine Gangs eingetragen."));
                }

                const options = gangs.slice(0, 25).map(gang =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(truncate(gang.name, 100))
                        .setValue(gang.id)
                        .setEmoji("🗑️")
                );

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("gang_delete_select")
                        .setPlaceholder("🗑️ Wähle die Gang aus, die du löschen möchtest")
                        .addOptions(options)
                );

                return interaction.reply({
                    content: "🗑️ **Gang löschen**\nWähle eine Gang aus der Liste:",
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
            }

            // =================================================
            // GANG HINZUFÜGEN – OWNER AUSGEWÄHLT -> MODAL
            // =================================================

            if (interaction.isUserSelectMenu() && interaction.customId === "gang_add_owner_select") {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs einzutragen."));
                }

                const ownerId = interaction.values[0];

                const modal = buildGangModal(`gang_add_modal_${ownerId}`, {
                    title: "🏴 Neue Gang eintragen"
                });

                return interaction.showModal(modal);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith("gang_add_modal_")) {

                // Sofort "quittieren": Die folgenden Schritte (Owner-Fetch,
                // refreshAllGangLists) machen mehrere sequenzielle Discord-API-
                // Aufrufe und können zusammen leicht länger als die von Discord
                // erlaubten 3 Sekunden dauern. Ohne deferReply() hier würde die
                // Interaktion in der Zwischenzeit ablaufen und jeder spätere
                // interaction.reply()/promptAndCollectGangLogo() würde mit
                // "Unknown interaction" (Fehlercode 10062) fehlschlagen.
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                if (!hasGangManagePermission(interaction.member)) {
                    return respondOrEdit(interaction, errorReply("Du hast keine Berechtigung, Gangs einzutragen."));
                }

                const ownerId = interaction.customId.replace("gang_add_modal_", "");

                const name = interaction.fields.getTextInputValue("gang_name").trim();
                const link = interaction.fields.getTextInputValue("gang_link").trim();
                const description = interaction.fields.getTextInputValue("gang_description").trim();

                if (!name) {
                    return respondOrEdit(interaction, errorReply("Der Gang-Name darf nicht leer sein."));
                }

                if (!isValidUrl(link)) {
                    return respondOrEdit(interaction, errorReply("Der Discord-Link ist ungültig. Er muss mit http:// oder https:// beginnen."));
                }

                const gangs = getGuildGangs(guildId);

                if (gangs.some(gang => gang.discordLink.toLowerCase() === link.toLowerCase())) {
                    return respondOrEdit(interaction, errorReply(`Eine Gang mit diesem Discord-Link existiert bereits.`));
                }

                const owner = await interaction.client.users.fetch(ownerId).catch(() => null);

                if (!owner) {
                    return respondOrEdit(interaction, errorReply("Der ausgewählte Owner konnte nicht gefunden werden."));
                }

                const newGang = {
                    id: crypto.randomUUID(),
                    name,
                    ownerId,
                    discordLink: link,
                    logoFile: null,
                    logoUrl: null,
                    description: description || null,
                    createdAt: new Date().toISOString(),
                    createdBy: interaction.user.id
                };

                gangs.push(newGang);

                if (!setGuildGangs(guildId, gangs)) {
                    return respondOrEdit(interaction, errorReply("Die Gang konnte nicht gespeichert werden."));
                }

                await refreshAllGangLists(interaction.guild);

                // -------------------------------------------------
                // Im Anschluss: optionaler Logo-Upload per Datei-Anhang
                // -------------------------------------------------

                const uploadResult = await promptAndCollectGangLogo(interaction, {
                    gangId: newGang.id,
                    skipLabel: "Kein Logo hochladen",
                    introContent:
                        `✅ Die Gang **${name}** wurde eingetragen.\n\n` +
                        "🖼️ **Gang-Logo (optional)**\n" +
                        "Lade jetzt einfach ein Bild (PNG, JPG, JPEG, WEBP oder GIF, max. 8 MB) hier in diesem Kanal hoch, " +
                        "um es als Gang-Logo zu verwenden.\n" +
                        "Du hast dafür 2 Minuten Zeit. Klicke alternativ auf **Kein Logo hochladen**, um ohne Logo fortzufahren."
                });

                if (uploadResult.outcome === "uploaded") {
                    const latestGangs = getGuildGangs(guildId);
                    const idx = latestGangs.findIndex(g => g.id === newGang.id);

                    if (idx !== -1) {
                        latestGangs[idx].logoFile = uploadResult.filename;
                        setGuildGangs(guildId, latestGangs);
                        await refreshAllGangLists(interaction.guild);
                    }

                    const { embed, attachment } = buildSingleGangEmbed(idx !== -1 ? latestGangs[idx] : newGang);

                    return interaction.editReply({
                        content: `✅ Die Gang **${name}** wurde eingetragen und das Logo wurde gespeichert.`,
                        embeds: [embed],
                        files: attachment ? [attachment] : [],
                        components: []
                    });
                }

                if (uploadResult.outcome === "skipped") {
                    return interaction.editReply({
                        content: `✅ Die Gang **${name}** wurde ohne Logo eingetragen. Du kannst später über "Gang ändern" ein Logo hinzufügen.`,
                        components: []
                    });
                }

                if (uploadResult.outcome === "timeout") {
                    return interaction.editReply({
                        content: `⏱️ Zeit abgelaufen. Die Gang **${name}** wurde ohne Logo eingetragen. Du kannst später über "Gang ändern" ein Logo hinzufügen.`,
                        components: []
                    });
                }

                // outcome === "error"
                return interaction.editReply({
                    content: `⚠️ Die Gang **${name}** wurde eingetragen, das Logo konnte aber nicht gespeichert werden: ${logoErrorReasonText(uploadResult.reason)}`,
                    components: []
                });
            }

            // =================================================
            // GANG ÄNDERN – AUSWAHL -> AKTIONEN
            // =================================================

            if (interaction.isStringSelectMenu() && interaction.customId === "gang_edit_select") {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu ändern."));
                }

                const gangId = interaction.values[0];
                const gang = findGang(guildId, gangId);

                if (!gang) {
                    return interaction.update({
                        content: "❌ Diese Gang existiert nicht mehr.",
                        embeds: [],
                        components: []
                    });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`gang_edit_fields_${gang.id}`)
                        .setLabel("Angaben bearbeiten")
                        .setEmoji("📝")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`gang_edit_owner_${gang.id}`)
                        .setLabel("Owner ändern")
                        .setEmoji("👑")
                        .setStyle(ButtonStyle.Secondary)
                );

                const { embed, attachment } = buildSingleGangEmbed(gang);

                return interaction.update({
                    content: `✏️ **${gang.name}** ausgewählt. Was möchtest du bearbeiten?`,
                    embeds: [embed],
                    files: attachment ? [attachment] : [],
                    components: [row]
                });
            }

            if (interaction.isButton() && interaction.customId.startsWith("gang_edit_fields_")) {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu ändern."));
                }

                const gangId = interaction.customId.replace("gang_edit_fields_", "");
                const gang = findGang(guildId, gangId);

                if (!gang) {
                    return interaction.reply(errorReply("Diese Gang existiert nicht mehr."));
                }

                const modal = buildGangModal(`gang_edit_modal_${gang.id}`, {
                    title: "✏️ Gang bearbeiten",
                    name: gang.name,
                    link: gang.discordLink,
                    description: gang.description || ""
                });

                return interaction.showModal(modal);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith("gang_edit_modal_")) {

                // Siehe Kommentar im "gang_add_modal_"-Handler: sofort
                // deferReply(), da refreshAllGangLists() u.U. länger als die
                // von Discord erlaubten 3 Sekunden braucht.
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                if (!hasGangManagePermission(interaction.member)) {
                    return respondOrEdit(interaction, errorReply("Du hast keine Berechtigung, Gangs zu ändern."));
                }

                const gangId = interaction.customId.replace("gang_edit_modal_", "");
                const gangs = getGuildGangs(guildId);
                const gangIndex = gangs.findIndex(gang => gang.id === gangId);

                if (gangIndex === -1) {
                    return respondOrEdit(interaction, errorReply("Diese Gang existiert nicht mehr."));
                }

                const name = interaction.fields.getTextInputValue("gang_name").trim();
                const link = interaction.fields.getTextInputValue("gang_link").trim();
                const description = interaction.fields.getTextInputValue("gang_description").trim();

                if (!name) {
                    return respondOrEdit(interaction, errorReply("Der Gang-Name darf nicht leer sein."));
                }

                if (!isValidUrl(link)) {
                    return respondOrEdit(interaction, errorReply("Der Discord-Link ist ungültig. Er muss mit http:// oder https:// beginnen."));
                }

                if (gangs.some((gang, index) => index !== gangIndex && gang.discordLink.toLowerCase() === link.toLowerCase())) {
                    return respondOrEdit(interaction, errorReply(`Eine andere Gang mit diesem Discord-Link existiert bereits.`));
                }

                gangs[gangIndex] = {
                    ...gangs[gangIndex],
                    name,
                    discordLink: link,
                    description: description || null
                };

                if (!setGuildGangs(guildId, gangs)) {
                    return respondOrEdit(interaction, errorReply("Die Änderungen konnten nicht gespeichert werden."));
                }

                await refreshAllGangLists(interaction.guild);

                // -------------------------------------------------
                // Im Anschluss: optionaler Logo-Upload (ersetzt bisheriges Logo)
                // -------------------------------------------------

                const uploadResult = await promptAndCollectGangLogo(interaction, {
                    gangId,
                    skipLabel: "Bisheriges Logo behalten",
                    introContent:
                        `✅ Die Angaben von **${name}** wurden aktualisiert.\n\n` +
                        "🖼️ **Gang-Logo (optional)**\n" +
                        "Lade jetzt einfach ein neues Bild (PNG, JPG, JPEG, WEBP oder GIF, max. 8 MB) hier in diesem Kanal hoch, " +
                        "um das bisherige Gang-Logo zu ersetzen.\n" +
                        "Du hast dafür 2 Minuten Zeit. Klicke alternativ auf **Bisheriges Logo behalten**, um das aktuelle Logo unverändert zu lassen."
                });

                const latestGangs = getGuildGangs(guildId);
                const idx = latestGangs.findIndex(g => g.id === gangId);
                const currentGang = idx !== -1 ? latestGangs[idx] : null;

                if (uploadResult.outcome === "uploaded" && currentGang) {
                    currentGang.logoFile = uploadResult.filename;
                    setGuildGangs(guildId, latestGangs);
                    await refreshAllGangLists(interaction.guild);

                    const { embed, attachment } = buildSingleGangEmbed(currentGang);

                    return interaction.editReply({
                        content: `✅ Die Gang **${name}** wurde aktualisiert und das neue Logo wurde gespeichert.`,
                        embeds: [embed],
                        files: attachment ? [attachment] : [],
                        components: []
                    });
                }

                if (uploadResult.outcome === "skipped" || uploadResult.outcome === "timeout") {
                    const noteText = uploadResult.outcome === "timeout"
                        ? "⏱️ Zeit abgelaufen – das bisherige Logo wurde beibehalten."
                        : "Das bisherige Logo wurde beibehalten.";

                    return interaction.editReply({
                        content: `✅ Die Gang **${name}** wurde aktualisiert. ${noteText}`,
                        components: []
                    });
                }

                // outcome === "error"
                return interaction.editReply({
                    content: `⚠️ Die Gang **${name}** wurde aktualisiert, das neue Logo konnte aber nicht gespeichert werden: ${logoErrorReasonText(uploadResult.reason)}. Das bisherige Logo wurde beibehalten.`,
                    components: []
                });
            }

            if (interaction.isButton() && interaction.customId.startsWith("gang_edit_owner_")) {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu ändern."));
                }

                const gangId = interaction.customId.replace("gang_edit_owner_", "");
                const gang = findGang(guildId, gangId);

                if (!gang) {
                    return interaction.reply(errorReply("Diese Gang existiert nicht mehr."));
                }

                const row = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId(`gang_edit_owner_select_${gang.id}`)
                        .setPlaceholder(`👑 Neuen Owner für "${truncate(gang.name, 50)}" auswählen`)
                        .setMinValues(1)
                        .setMaxValues(1)
                );

                return interaction.reply({
                    content: `👑 Wähle den neuen Owner für **${gang.name}** aus:`,
                    components: [row],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.isUserSelectMenu() && interaction.customId.startsWith("gang_edit_owner_select_")) {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu ändern."));
                }

                const gangId = interaction.customId.replace("gang_edit_owner_select_", "");
                const gangs = getGuildGangs(guildId);
                const gangIndex = gangs.findIndex(gang => gang.id === gangId);

                if (gangIndex === -1) {
                    return interaction.update({ content: "❌ Diese Gang existiert nicht mehr.", components: [] });
                }

                const newOwnerId = interaction.values[0];

                gangs[gangIndex] = {
                    ...gangs[gangIndex],
                    ownerId: newOwnerId
                };

                if (!setGuildGangs(guildId, gangs)) {
                    return interaction.update({ content: "❌ Der Owner konnte nicht gespeichert werden.", components: [] });
                }

                await refreshAllGangLists(interaction.guild);

                return interaction.update({
                    content: `✅ Der Owner von **${gangs[gangIndex].name}** wurde zu <@${newOwnerId}> geändert und die Gang-Liste wurde aktualisiert.`,
                    components: []
                });
            }

            // =================================================
            // GANG LÖSCHEN – AUSWAHL -> BESTÄTIGUNG -> LÖSCHEN
            // =================================================

            if (interaction.isStringSelectMenu() && interaction.customId === "gang_delete_select") {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu löschen."));
                }

                const gangId = interaction.values[0];
                const gang = findGang(guildId, gangId);

                if (!gang) {
                    return interaction.update({ content: "❌ Diese Gang existiert nicht mehr.", embeds: [], components: [] });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`gang_delete_confirm_${gang.id}`)
                        .setLabel("Ja, endgültig löschen")
                        .setEmoji("🗑️")
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId("gang_delete_cancel")
                        .setLabel("Abbrechen")
                        .setStyle(ButtonStyle.Secondary)
                );

                const { embed, attachment } = buildSingleGangEmbed(gang);

                return interaction.update({
                    content: `⚠️ Bist du sicher, dass du die Gang **${gang.name}** unwiderruflich löschen möchtest?`,
                    embeds: [embed],
                    files: attachment ? [attachment] : [],
                    components: [row]
                });
            }

            if (interaction.isButton() && interaction.customId === "gang_delete_cancel") {
                return interaction.update({
                    content: "❌ Löschvorgang abgebrochen.",
                    embeds: [],
                    components: []
                });
            }

            if (interaction.isButton() && interaction.customId.startsWith("gang_delete_confirm_")) {

                if (!hasGangManagePermission(interaction.member)) {
                    return interaction.reply(errorReply("Du hast keine Berechtigung, Gangs zu löschen."));
                }

                const gangId = interaction.customId.replace("gang_delete_confirm_", "");
                const gangs = getGuildGangs(guildId);
                const gang = gangs.find(g => g.id === gangId);

                if (!gang) {
                    return interaction.update({ content: "❌ Diese Gang wurde bereits gelöscht.", embeds: [], components: [] });
                }

                const updatedGangs = gangs.filter(g => g.id !== gangId);

                if (!setGuildGangs(guildId, updatedGangs)) {
                    return interaction.update({ content: "❌ Die Gang konnte nicht gelöscht werden.", embeds: [], components: [] });
                }

                // Zugehöriges Gang-Logo entfernen, sofern es nicht mehr
                // von einer anderen Gang verwendet wird.
                deleteGangLogoFileIfUnused(gang);

                await refreshAllGangLists(interaction.guild);

                return interaction.update({
                    content: `🗑️ Die Gang **${gang.name}** wurde gelöscht und die Gang-Liste wurde aktualisiert.`,
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            console.error("❌ Fehler im Gang-System (interactionCreate):", error);
            if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Der Gang-Befehl konnte nicht abgeschlossen werden.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const payload = errorReply("Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es erneut.");

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(payload);
                } else {
                    await interaction.reply(payload);
                }
            } catch {
                // Interaktion evtl. bereits abgelaufen – kein weiterer Handlungsbedarf.
            }
        }
    });

    // -------------------------------------------------
    // NACH NEUSTART: BESTEHENDE LISTEN EINMALIG SYNCHRONISIEREN
    // -------------------------------------------------

    client.once("clientReady", async () => {
        try {
            const data = loadAllGangLists();

            for (const guildId of Object.keys(data)) {
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (guild) {
                    await refreshAllGangLists(guild);
                }
            }
        } catch (error) {
            console.error("❌ Fehler beim Synchronisieren der Gang-Listen nach dem Neustart:", error);
        }
    });

    console.log("🏴 Gang-System wurde initialisiert.");
    console.log(`🖼️ Gang-Logos werden gespeichert in: ${GANG_IMAGES_DIR}`);
}

module.exports = { initializeGangSystem };