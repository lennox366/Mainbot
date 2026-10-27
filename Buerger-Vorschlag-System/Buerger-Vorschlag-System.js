// =====================================================
// 📋 NEXORACLOUD – BÜRGER-VORSCHLAG-SYSTEM
// =====================================================
//
// Vollständiges, professionelles Bürger-Vorschlagssystem für Discord-RP-Server
// 
// Features:
//  • !Vorschläge Bürger     -> Bürger-Vorschlags-Panel im aktuellen Kanal
//  • !Bürgertext            -> Bürger-Informationstext/Panel im aktuellen Kanal
//  • Modal-Formular für Vorschläge mit Titel, Beschreibung und Kategorie
//  • Automatische Vorschlags-ID generierung
//  • Moderne Embed-Karten für Vorschläge
//  • Status-Management (In Prüfung, Angenommen, Abgelehnt, In Bearbeitung)
//  • Team-Verwaltungsfunktionen (Bearbeiten, Löschen, Annehmen, Ablehnen, Team-Notizen)
//  • Automatische Benachrichtigung bei Statusänderungen
//  . Berechtigungsprüfung für Bürger und Teammitglieder
//  • Dauerhafte Speicherung in JSON-Datei
//
// Eigenständiges Modul – greift NICHT in bestehende Systeme ein.
// =====================================================

const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionsBitField
} = require("discord.js");

// =====================================================
// DATEI-KONFIGURATION
// =====================================================

const SUGGESTIONS_FILE = path.join(__dirname, "..", "data", "suggestions.json");
const SUGGESTION_PANELS_FILE = path.join(__dirname, "..", "data", "suggestion-panels.json");
const SUGGESTION_CHANNELS_FILE = path.join(__dirname, "..", "data", "suggestion-channels.json");

// =====================================================
// STATUS-KONFIGURATION
// =====================================================

const SUGGESTION_STATUS = {
    IN_REVIEW: "in_review",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    IN_PROGRESS: "in_progress"
};

const SUGGESTION_STATUS_LABELS = {
    [SUGGESTION_STATUS.IN_REVIEW]: "🟡 In Prüfung",
    [SUGGESTION_STATUS.ACCEPTED]: "🟢 Angenommen",
    [SUGGESTION_STATUS.REJECTED]: "🔴 Abgelehnt",
    [SUGGESTION_STATUS.IN_PROGRESS]: "🔵 In Bearbeitung"
};

const SUGGESTION_STATUS_COLORS = {
    [SUGGESTION_STATUS.IN_REVIEW]: 0xFEE75C,
    [SUGGESTION_STATUS.ACCEPTED]: 0x57F287,
    [SUGGESTION_STATUS.REJECTED]: 0xED4245,
    [SUGGESTION_STATUS.IN_PROGRESS]: 0x5865F2
};

// =====================================================
// KATEGORIEN-KONFIGURATION
// =====================================================

const SUGGESTION_CATEGORIES = {
    SERVER: { id: "server", emoji: "🏙️", label: "Server" },
    POLICE: { id: "police", emoji: "🚓", label: "Polizei" },
    EMS: { id: "ems", emoji: "🚑", label: "Rettungsdienst" },
    FIRE: { id: "fire", emoji: "🚒", label: "Feuerwehr" },
    GAMEPLAY: { id: "gameplay", emoji: "🎮", label: "Gameplay" },
    OTHER: { id: "other", emoji: "💬", label: "Sonstiges" }
};

// =====================================================
// TEXT-KONFIGURATION (anpassbar)
// =====================================================

const BURGER_PANEL_TEXT = {
    TITLE: "🏛️ Bürgerportal",
    DESCRIPTION: "Du hast eine Idee, einen Verbesserungsvorschlag oder möchtest etwas für den Server vorschlagen?\n\nNutze unser Bürger-Vorschlagssystem und teile deine Idee mit dem Serverteam.\nJeder Vorschlag wird vom Team geprüft.",
    BUTTON_LABEL: "Vorschlag erstellen",
    BUTTON_EMOJI: "💡"
};

const BURGER_SUGGESTION_PANEL_TEXT = {
    TITLE: "📋 Bürger-Vorschläge",
    DESCRIPTION: "Du hast eine Idee oder einen Verbesserungsvorschlag für unseren Server?\nDann kannst du hier deinen Vorschlag einreichen.\n\nDas Serverteam wird deinen Vorschlag anschließend prüfen.",
    BUTTON_LABEL: "Vorschlag erstellen",
    BUTTON_EMOJI: "💡"
};

// =====================================================
// SPEICHERUNG (JSON) — überlebt Bot-Neustarts
// =====================================================

function loadSuggestionsData() {
    try {
        if (!fs.existsSync(SUGGESTIONS_FILE)) {
            const initial = { 
                suggestions: {}, 
                counter: 0,
                lastSuggestionId: 0
            };
            fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(initial, null, 2), "utf8");
            return initial;
        }

        const data = JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, "utf8"));

        if (!data.suggestions || typeof data.suggestions !== "object") data.suggestions = {};
        if (typeof data.counter !== "number") data.counter = 0;
        if (typeof data.lastSuggestionId !== "number") data.lastSuggestionId = 0;

        return data;
    } catch (error) {
        console.error("❌ Fehler beim Laden der Vorschlags-Daten:", error);
        return { suggestions: {}, counter: 0, lastSuggestionId: 0 };
    }
}

function saveSuggestionsData(data) {
    try {
        fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Vorschlags-Daten:", error);
        return false;
    }
}

function loadSuggestionPanels() {
    try {
        if (!fs.existsSync(SUGGESTION_PANELS_FILE)) {
            const initial = { panels: {} };
            fs.writeFileSync(SUGGESTION_PANELS_FILE, JSON.stringify(initial, null, 2), "utf8");
            return initial;
        }

        const data = JSON.parse(fs.readFileSync(SUGGESTION_PANELS_FILE, "utf8"));

        if (!data.panels || typeof data.panels !== "object") data.panels = {};

        return data;
    } catch (error) {
        console.error("❌ Fehler beim Laden der Vorschlags-Panels:", error);
        return { panels: {} };
    }
}

function saveSuggestionPanels(data) {
    try {
        fs.writeFileSync(SUGGESTION_PANELS_FILE, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Vorschlags-Panels:", error);
        return false;
    }
}

function loadSuggestionChannels() {
    try {
        if (!fs.existsSync(SUGGESTION_CHANNELS_FILE)) {
            const initial = { channels: {} };
            fs.writeFileSync(SUGGESTION_CHANNELS_FILE, JSON.stringify(initial, null, 2), "utf8");
            return initial;
        }

        const data = JSON.parse(fs.readFileSync(SUGGESTION_CHANNELS_FILE, "utf8"));

        if (!data.channels || typeof data.channels !== "object") data.channels = {};

        return data;
    } catch (error) {
        console.error("❌ Fehler beim Laden der Vorschlags-Kanäle:", error);
        return { channels: {} };
    }
}

function saveSuggestionChannels(data) {
    try {
        fs.writeFileSync(SUGGESTION_CHANNELS_FILE, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Vorschlags-Kanäle:", error);
        return false;
    }
}

let SUGGESTIONS_DATA = loadSuggestionsData();
let SUGGESTION_PANELS = loadSuggestionPanels();
let SUGGESTION_CHANNELS = loadSuggestionChannels();

// =====================================================
// VORSCHLAG-FUNKTIONEN
// =====================================================

function generateSuggestionId() {
    SUGGESTIONS_DATA.lastSuggestionId++;
    saveSuggestionsData(SUGGESTIONS_DATA);
    return SUGGESTIONS_DATA.lastSuggestionId;
}

function createSuggestion(data) {
    const suggestionId = generateSuggestionId();
    const suggestion = {
        id: suggestionId,
        userId: data.userId,
        username: data.username,
        displayName: data.displayName,
        title: data.title,
        description: data.description,
        category: data.category,
        status: SUGGESTION_STATUS.IN_REVIEW,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        teamNotes: data.teamNotes || "",
        guildId: data.guildId,
        channelId: data.channelId || null,
        messageId: data.messageId || null
    };

    SUGGESTIONS_DATA.suggestions[suggestionId] = suggestion;
    saveSuggestionsData(SUGGESTIONS_DATA);
    
    return suggestion;
}

function getSuggestion(suggestionId) {
    return SUGGESTIONS_DATA.suggestions[suggestionId] || null;
}

function updateSuggestion(suggestionId, updates) {
    const suggestion = getSuggestion(suggestionId);
    if (!suggestion) return null;

    Object.assign(suggestion, updates);
    suggestion.lastModifiedAt = new Date().toISOString();
    
    SUGGESTIONS_DATA.suggestions[suggestionId] = suggestion;
    saveSuggestionsData(SUGGESTIONS_DATA);
    
    return suggestion;
}

function deleteSuggestion(suggestionId) {
    if (!SUGGESTIONS_DATA.suggestions[suggestionId]) {
        return false;
    }

    delete SUGGESTIONS_DATA.suggestions[suggestionId];
    return saveSuggestionsData(SUGGESTIONS_DATA);
}

function changeSuggestionStatus(suggestionId, newStatus) {
    const suggestion = updateSuggestion(suggestionId, { status: newStatus });
    return suggestion;
}

function addTeamNote(suggestionId, note) {
    const suggestion = getSuggestion(suggestionId);
    if (!suggestion) return null;

    const timestamp = new Date().toISOString();
    const newNote = `[${formatGermanTime(new Date(timestamp))}] ${note}`;
    
    const updatedNotes = suggestion.teamNotes 
        ? `${suggestion.teamNotes}\n\n${newNote}`
        : newNote;
    
    return updateSuggestion(suggestionId, { teamNotes: updatedNotes });
}

function getUserSuggestions(userId) {
    return Object.values(SUGGESTIONS_DATA.suggestions)
        .filter(suggestion => suggestion.userId === userId);
}

function getAllSuggestions() {
    return Object.values(SUGGESTIONS_DATA.suggestions);
}

function getSuggestionChannelId(guildId) {
    return SUGGESTION_CHANNELS.channels[guildId] || null;
}

function setSuggestionChannelId(guildId, channelId) {
    SUGGESTION_CHANNELS.channels[guildId] = channelId;
    saveSuggestionChannels(SUGGESTION_CHANNELS);
    return channelId;
}

// =====================================================
// BERECHTIGUNGS-PRÜFUNG
// =====================================================

function isSuggestionTeamMember(member, teamRoleIds) {
    if (!member || !teamRoleIds || teamRoleIds.length === 0) {
        return false;
    }

    return member.roles.cache.some(role => teamRoleIds.includes(role.id));
}

function isSuggestionOwner(suggestion, userId) {
    return suggestion && suggestion.userId === userId;
}

// =====================================================
// EMBED-ERSTELLUNG
// =====================================================

function createSuggestionEmbed(suggestion, showTeamNotes = false) {
    const category = Object.values(SUGGESTION_CATEGORIES).find(cat => cat.id === suggestion.category) || SUGGESTION_CATEGORIES.OTHER;
    const statusLabel = SUGGESTION_STATUS_LABELS[suggestion.status] || suggestion.status;
    const statusColor = SUGGESTION_STATUS_COLORS[suggestion.status] || 0x5865F2;

    const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`📋 Bürger-Vorschlag #${suggestion.id}`)
        .addFields(
            { name: "Titel", value: suggestion.title, inline: false },
            { name: "Beschreibung", value: suggestion.description, inline: false },
            { name: "Kategorie", value: `${category.emoji} ${category.label}`, inline: true },
            { name: "Status", value: statusLabel, inline: true },
            { name: "Eingereicht von", value: `<@${suggestion.userId}>`, inline: true },
            { name: "Eingereicht am", value: formatGermanTime(new Date(suggestion.createdAt)), inline: true },
            { name: "Letzte Änderung", value: formatGermanTime(new Date(suggestion.lastModifiedAt)), inline: true }
        )
        .setTimestamp(new Date(suggestion.createdAt))
        .setFooter({ text: "Bürger-Vorschlagssystem ✧ NoVex RP" });

    // Team-Notizen NUR für berechtigte Teammitglieder
    if (showTeamNotes && suggestion.teamNotes) {
        embed.addFields({ 
            name: "📝 Team-Notizen", 
            value: suggestion.teamNotes, 
            inline: false 
        });
    }

    return embed;
}

function createSuggestionPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(BURGER_SUGGESTION_PANEL_TEXT.TITLE)
        .setDescription(BURGER_SUGGESTION_PANEL_TEXT.DESCRIPTION)
        .setFooter({ text: "Bürger-Vorschlagssystem ✧ NoVex RP" });
}

function createBurgerPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(BURGER_PANEL_TEXT.TITLE)
        .setDescription(BURGER_PANEL_TEXT.DESCRIPTION)
        .setFooter({ text: "Bürger-Vorschlagssystem ✧ NoVex RP" });
}

// =====================================================
// MODAL-ERSTELLUNG
// =====================================================

function createSuggestionModal() {
    const modal = new ModalBuilder()
        .setCustomId("suggestion_create_modal")
        .setTitle("💡 Vorschlag erstellen");

    const titleInput = new TextInputBuilder()
        .setCustomId("suggestion_title")
        .setLabel("Titel")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Gib deinem Vorschlag einen kurzen Titel")
        .setMinLength(3)
        .setMaxLength(100)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId("suggestion_description")
        .setLabel("Beschreibung")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Beschreibe deinen Vorschlag ausführlich...")
        .setMinLength(10)
        .setMaxLength(2000)
        .setRequired(true);

    const categoryInput = new TextInputBuilder()
        .setCustomId("suggestion_category")
        .setLabel("Kategorie")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("server, police, ems, fire, gameplay oder other")
        .setMinLength(2)
        .setMaxLength(20)
        .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
    const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(categoryInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

    return modal;
}

function createTeamNoteModal(suggestionId) {
    const modal = new ModalBuilder()
        .setCustomId(`suggestion_team_note:${suggestionId}`)
        .setTitle("📝 Team-Notiz hinzufügen");

    const noteInput = new TextInputBuilder()
        .setCustomId("team_note")
        .setLabel("Team-Notiz")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Interne Notiz für das Team...")
        .setMinLength(1)
        .setMaxLength(1000)
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(noteInput);
    modal.addComponents(actionRow);

    return modal;
}

function createEditSuggestionModal(suggestionId) {
    const suggestion = getSuggestion(suggestionId);
    if (!suggestion) return null;

    const modal = new ModalBuilder()
        .setCustomId(`suggestion_edit:${suggestionId}`)
        .setTitle("✏️ Vorschlag bearbeiten");

    const titleInput = new TextInputBuilder()
        .setCustomId("edit_title")
        .setLabel("Titel")
        .setStyle(TextInputStyle.Short)
        .setValue(suggestion.title)
        .setMinLength(3)
        .setMaxLength(100)
        .setRequired(true);

    const descriptionInput = new TextInputBuilder()
        .setCustomId("edit_description")
        .setLabel("Beschreibung")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(suggestion.description)
        .setMinLength(10)
        .setMaxLength(2000)
        .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
    const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);

    modal.addComponents(firstActionRow, secondActionRow);

    return modal;
}

function createQuestionModal(suggestionId) {
    const modal = new ModalBuilder()
        .setCustomId(`suggestion_question_modal:${suggestionId}`)
        .setTitle("❓ Rückfrage stellen");

    const questionInput = new TextInputBuilder()
        .setCustomId("question_text")
        .setLabel("Deine Frage an den Ersteller")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Stelle eine Rückfrage an den Ersteller des Vorschlags...")
        .setMinLength(5)
        .setMaxLength(1000)
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(questionInput);
    modal.addComponents(actionRow);

    return modal;
}

function createAnswerModal(suggestionId) {
    const modal = new ModalBuilder()
        .setCustomId(`suggestion_answer_modal:${suggestionId}`)
        .setTitle("💬 Antwort schreiben");

    const answerInput = new TextInputBuilder()
        .setCustomId("answer_text")
        .setLabel("Deine Antwort")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Beantworte die Rückfrage...")
        .setMinLength(5)
        .setMaxLength(1000)
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(answerInput);
    modal.addComponents(actionRow);

    return modal;
}

// =====================================================
// BUTTON-ERSTELLUNG
// =====================================================

function createSuggestionButtons(suggestionId, isTeamMember, isOwner) {
    const buttons = [];

    // Bürger-Buttons (nur für eigene Vorschläge)
    if (isOwner) {
        // Bürger können ihre eigenen Vorschläge nur sehen, nicht bearbeiten
    }

    // Team-Buttons
    if (isTeamMember) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`suggestion_edit:${suggestionId}`)
                .setLabel("Bearbeiten")
                .setEmoji("✏️")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`suggestion_delete:${suggestionId}`)
                .setLabel("Löschen")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`suggestion_accept:${suggestionId}`)
                .setLabel("Annehmen")
                .setEmoji("🟢")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`suggestion_reject:${suggestionId}`)
                .setLabel("Ablehnen")
                .setEmoji("🔴")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`suggestion_question:${suggestionId}`)
                .setLabel("Rückfrage")
                .setEmoji("❓")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`suggestion_status:${suggestionId}`)
                .setLabel("Status ändern")
                .setEmoji("🟡")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`suggestion_team_note:${suggestionId}`)
                .setLabel("Team-Notiz")
                .setEmoji("📝")
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (buttons.length === 0) {
        return null;
    }

    // Buttons in mehrere Reihen aufteilen (max 5 pro Reihe)
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder();
        row.addComponents(buttons.slice(i, i + 5));
        rows.push(row);
    }

    return rows;
}

function createStatusSelectMenu(suggestionId) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`suggestion_status_select:${suggestionId}`)
        .setPlaceholder("Wähle einen neuen Status")
        .addOptions(
            Object.entries(SUGGESTION_STATUS_LABELS).map(([statusId, label]) => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setValue(statusId)
            )
        );

    return new ActionRowBuilder().addComponents(selectMenu);
}

function createCategorySelectMenu(suggestionId) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`suggestion_category_select:${suggestionId}`)
        .setPlaceholder("Wähle eine Kategorie")
        .addOptions(
            Object.values(SUGGESTION_CATEGORIES).map(category => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(category.label)
                    .setValue(category.id)
                    .setEmoji(category.emoji)
            )
        );

    return new ActionRowBuilder().addComponents(selectMenu);
}

function createPanelButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("suggestion_create_button")
            .setLabel(BURGER_SUGGESTION_PANEL_TEXT.BUTTON_LABEL)
            .setEmoji(BURGER_SUGGESTION_PANEL_TEXT.BUTTON_EMOJI)
            .setStyle(ButtonStyle.Primary)
    );
}

function createBurgerPanelButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("suggestion_create_button")
            .setLabel(BURGER_PANEL_TEXT.BUTTON_LABEL)
            .setEmoji(BURGER_PANEL_TEXT.BUTTON_EMOJI)
            .setStyle(ButtonStyle.Primary)
    );
}

// =====================================================
// BENACHRICHTIGUNGEN
// =====================================================

async function sendSuggestionNotification(client, suggestion, oldStatus) {
    try {
        const user = await client.users.fetch(suggestion.userId).catch(() => null);
        if (!user) return false;

        const newStatusLabel = SUGGESTION_STATUS_LABELS[suggestion.status] || suggestion.status;
        
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🔔 Update zu deinem Vorschlag #${suggestion.id}`)
            .setDescription(`Der Status deines Vorschlags wurde geändert.\n\n**Neuer Status:**\n${newStatusLabel}`)
            .addFields(
                { name: "Titel", value: suggestion.title, inline: false },
                { name: "Vorschlags-ID", value: `#${suggestion.id}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: "Bürger-Vorschlagssystem ✧ NoVex RP" });

        await user.send({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error(`❌ Konnte DM an Benutzer ${suggestion.userId} nicht senden:`, error);
        return false;
    }
}

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function formatGermanTime(date) {
    if (!date) return "Nicht verfügbar";
    
    const d = new Date(date);
    return d.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// =====================================================
// SYSTEM-INITIALISIERUNG
// =====================================================

function initializeBuergerVorschlagSystem(client, options = {}) {
    const {
        prefix = "!",
        botOwnerId = null,
        adminRoleIds = [],
        teamRoleIds = []
    } = options;

    // =====================================================
    // BERECHTIGUNGSPRÜFUNG
    // =====================================================

    function hasPanelPermission(member) {
        if (!member) return false;
        
        if (botOwnerId && member.id === botOwnerId) return true;
        if (adminRoleIds.length > 0 && member.roles.cache.some(role => adminRoleIds.includes(role.id))) return true;
        if (teamRoleIds.length > 0 && member.roles.cache.some(role => teamRoleIds.includes(role.id))) return true;
        
        return false;
    }

    // =====================================================
    // PANEL-VERWALTUNG
    // =====================================================

    function savePanel(guildId, channelId, messageId, panelType) {
        if (!SUGGESTION_PANELS.panels[guildId]) {
            SUGGESTION_PANELS.panels[guildId] = [];
        }

        const panelIndex = SUGGESTION_PANELS.panels[guildId].findIndex(
            p => p.channelId === channelId && p.panelType === panelType
        );

        const panelData = {
            channelId,
            messageId,
            panelType,
            createdAt: new Date().toISOString()
        };

        if (panelIndex >= 0) {
            SUGGESTION_PANELS.panels[guildId][panelIndex] = panelData;
        } else {
            SUGGESTION_PANELS.panels[guildId].push(panelData);
        }

        saveSuggestionPanels(SUGGESTION_PANELS);
    }

    // =====================================================
    // MESSAGE CREATE HANDLER (Prefix-Befehle)
    // =====================================================

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith(prefix)) return;
        if (!message.guild) return;

        const args = message.content.slice(prefix.length).trim().split(/\s+/);
        const command = args.shift()?.toLowerCase();

        // =====================================================
        // BEFEHL: !Vorschläge Bürger
        // =====================================================

        if (command === "vorschläge" && args[0]?.toLowerCase() === "bürger") {
            if (!hasPanelPermission(message.member)) {
                await message.reply({
                    content: "❌ Du hast keine Berechtigung, dieses Panel zu erstellen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            const embed = createSuggestionPanelEmbed();
            const components = [createPanelButtons()];

            const panelMessage = await message.channel.send({
                embeds: [embed],
                components: components
            });

            savePanel(message.guild.id, message.channel.id, panelMessage.id, "suggestion");

            await message.reply({
                content: "✅ Bürger-Vorschlags-Panel wurde erstellt!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // BEFEHL: !Bürgertext
        // =====================================================

        if (command === "bürgertext") {
            if (!hasPanelPermission(message.member)) {
                await message.reply({
                    content: "❌ Du hast keine Berechtigung, diesen Kanal als Vorschlags-Kanal festzulegen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            // Kanal als Vorschlags-Kanal festlegen
            setSuggestionChannelId(message.guild.id, message.channel.id);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("📋 Bürger-Vorschlags-Kanal")
                .setDescription(`Dieser Kanal wurde als Bürger-Vorschlags-Kanal festgelegt.\n\nAlle neuen Vorschläge werden automatisch in diesem Kanal gepostet.\nTeammitglieder können Vorschläge hier verwalten.`)
                .addFields(
                    { name: "Kanal", value: `<#${message.channel.id}>`, inline: true },
                    { name: "Server", value: message.guild.name, inline: true }
                )
                .setFooter({ text: "Bürger-Vorschlagssystem ✧ NoVex RP" });

            await message.channel.send({ embeds: [embed] });

            await message.reply({
                content: "✅ Dieser Kanal wurde als Bürger-Vorschlags-Kanal festgelegt!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }
    });

    // =====================================================
    // INTERACTION CREATE HANDLER
    // =====================================================

    client.on("interactionCreate", async (interaction) => {
        if (interaction.isChatInputCommand()) {
            try {
            if (interaction.__slashCommandPermissionDenied) return;
            if (!interaction.guild || !interaction.channel?.isTextBased()) {
                return interaction.reply({
                    content: "❌ Dieser Befehl funktioniert nur in einem Server-Textkanal.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.commandName === "vorschläge") {
                if (interaction.options.getString("typ") !== "bürger") {
                    return interaction.reply({
                        content: "❌ Bitte wähle als Typ „Bürger“ aus.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                if (!hasPanelPermission(interaction.member)) {
                    return interaction.reply({
                        content: "❌ Du hast keine Berechtigung, dieses Panel zu erstellen.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const panelMessage = await interaction.channel.send({
                    embeds: [createSuggestionPanelEmbed()],
                    components: [createPanelButtons()]
                });
                savePanel(interaction.guild.id, interaction.channel.id, panelMessage.id, "suggestion");
                return interaction.reply({
                    content: "✅ Bürger-Vorschlags-Panel wurde erstellt.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.commandName === "bürgertext") {
                if (!hasPanelPermission(interaction.member)) {
                    return interaction.reply({
                        content: "❌ Du hast keine Berechtigung, diesen Kanal als Vorschlags-Kanal festzulegen.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                setSuggestionChannelId(interaction.guild.id, interaction.channel.id);
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle("📋 Bürger-Vorschlags-Kanal")
                    .setDescription(
                        "Dieser Kanal wurde als Bürger-Vorschlags-Kanal festgelegt.\n\n" +
                        "Alle neuen Vorschläge werden automatisch hier veröffentlicht."
                    )
                    .addFields(
                        { name: "Kanal", value: `<#${interaction.channel.id}>`, inline: true },
                        { name: "Server", value: interaction.guild.name, inline: true }
                    )
                    .setFooter({ text: "Bürger-Vorschlagssystem ✧ NoVex RP" });

                await interaction.channel.send({ embeds: [embed] });
                return interaction.reply({
                    content: "✅ Dieser Kanal wurde als Bürger-Vorschlags-Kanal festgelegt.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
            } catch (error) {
                console.error("❌ Fehler bei Bürger-Vorschlag-Slash-Befehl:", error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "❌ Der Befehl konnte nicht abgeschlossen werden.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                return;
            }
        }

        if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;

        const guild = interaction.guild;
        const member = interaction.member;
        const userId = interaction.user.id;

        // =====================================================
        // BUTTON: Vorschlag erstellen (Panel)
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId === "suggestion_create_button") {
            await interaction.showModal(createSuggestionModal());
            return;
        }

        // =====================================================
        // MODAL: Vorschlag erstellen
        // =====================================================

        if (interaction.isModalSubmit() && interaction.customId === "suggestion_create_modal") {
            const title = interaction.fields.getTextInputValue("suggestion_title");
            const description = interaction.fields.getTextInputValue("suggestion_description");
            const categoryInput = interaction.fields.getTextInputValue("suggestion_category").toLowerCase().trim();

            // Kategorie validieren und mapping
            const categoryMap = {
                "server": "server",
                "polizei": "police",
                "police": "police",
                "rettungsdienst": "ems",
                "ems": "ems",
                "feuerwehr": "fire",
                "fire": "fire",
                "gameplay": "gameplay",
                "sonstiges": "other",
                "other": "other"
            };

            const category = categoryMap[categoryInput] || "other";

            if (!Object.values(SUGGESTION_CATEGORIES).find(cat => cat.id === category)) {
                await interaction.reply({
                    content: "❌ Bitte gib eine gültige Kategorie ein (server, police, ems, fire, gameplay oder other).",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            // Vorschlags-Kanal abrufen
            const suggestionChannelId = getSuggestionChannelId(guild.id);
            
            if (!suggestionChannelId) {
                await interaction.reply({
                    content: "❌ Es wurde noch kein Vorschlags-Kanal festgelegt. Bitte wende dich an das Team.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            const suggestionChannel = await guild.channels.fetch(suggestionChannelId).catch(() => null);
            
            if (!suggestionChannel || !suggestionChannel.isTextBased()) {
                await interaction.reply({
                    content: "❌ Der Vorschlags-Kanal konnte nicht gefunden werden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            const suggestion = createSuggestion({
                userId: userId,
                username: interaction.user.username,
                displayName: member.displayName,
                title: title,
                description: description,
                category: category,
                guildId: guild.id,
                channelId: suggestionChannelId
            });

            // Embed im Vorschlags-Kanal senden
            const embed = createSuggestionEmbed(suggestion, false);
            const buttons = createSuggestionButtons(suggestion.id, true, false); // Immer Team-Buttons anzeigen

            const suggestionMessage = await suggestionChannel.send({
                embeds: [embed],
                components: buttons || []
            });

            // Vorschlag aktualisieren mit Nachrichten-ID
            updateSuggestion(suggestion.id, {
                messageId: suggestionMessage.id,
                channelId: suggestionChannelId
            });

            await interaction.reply({
                content: `✅ Dein Vorschlag wurde erfolgreich eingereicht!\n\nVorschlags-ID: #${suggestion.id}\nStatus: ${SUGGESTION_STATUS_LABELS[SUGGESTION_STATUS.IN_REVIEW]}\n\nDas Serverteam wird deinen Vorschlag prüfen.`,
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // BUTTON: Bearbeiten
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_edit:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, diesen Vorschlag zu bearbeiten.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            await interaction.showModal(createEditSuggestionModal(suggestionId));
            return;
        }

        // =====================================================
        // MODAL: Bearbeiten
        // =====================================================

        if (interaction.isModalSubmit() && interaction.customId.startsWith("suggestion_edit:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, diesen Vorschlag zu bearbeiten.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            const newTitle = interaction.fields.getTextInputValue("edit_title");
            const newDescription = interaction.fields.getTextInputValue("edit_description");

            updateSuggestion(suggestionId, {
                title: newTitle,
                description: newDescription
            });

            // Embed aktualisieren
            const embed = createSuggestionEmbed(suggestion, true);
            const buttons = createSuggestionButtons(suggestionId, true, false);

            await interaction.message.edit({
                embeds: [embed],
                components: buttons || []
            });

            await interaction.reply({
                content: "✅ Vorschlag wurde erfolgreich bearbeitet!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // BUTTON: Löschen
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_delete:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, diesen Vorschlag zu löschen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            deleteSuggestion(suggestionId);

            await interaction.message.delete().catch(() => {});

            await interaction.reply({
                content: "✅ Vorschlag wurde erfolgreich gelöscht!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // BUTTON: Annehmen
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_accept:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, diesen Vorschlag anzunehmen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            const oldStatus = suggestion.status;
            changeSuggestionStatus(suggestionId, SUGGESTION_STATUS.ACCEPTED);

            // Embed aktualisieren
            const embed = createSuggestionEmbed(suggestion, true);
            const buttons = createSuggestionButtons(suggestionId, true, false);

            await interaction.message.edit({
                embeds: [embed],
                components: buttons || []
            });

            // Benachrichtigung senden
            await sendSuggestionNotification(client, suggestion, oldStatus);

            await interaction.reply({
                content: "✅ Vorschlag wurde angenommen!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // BUTTON: Ablehnen
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_reject:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, diesen Vorschlag abzulehnen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            const oldStatus = suggestion.status;
            changeSuggestionStatus(suggestionId, SUGGESTION_STATUS.REJECTED);

            // Embed aktualisieren
            const embed = createSuggestionEmbed(suggestion, true);
            const buttons = createSuggestionButtons(suggestionId, true, false);

            await interaction.message.edit({
                embeds: [embed],
                components: buttons || []
            });

            // Benachrichtigung senden
            await sendSuggestionNotification(client, suggestion, oldStatus);

            await interaction.reply({
                content: "✅ Vorschlag wurde abgelehnt!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // BUTTON: Status ändern
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_status:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, den Status zu ändern.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            await interaction.reply({
                content: "Wähle einen neuen Status aus:",
                components: [createStatusSelectMenu(suggestionId)],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // SELECT MENU: Status auswählen
        // =====================================================

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith("suggestion_status_select:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);
            const newStatus = interaction.values[0];

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, den Status zu ändern.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            const oldStatus = suggestion.status;
            changeSuggestionStatus(suggestionId, newStatus);

            // Embed aktualisieren
            const embed = createSuggestionEmbed(suggestion, true);
            const buttons = createSuggestionButtons(suggestionId, true, false);

            await interaction.message.edit({
                embeds: [embed],
                components: buttons || []
            });

            // Benachrichtigung senden
            await sendSuggestionNotification(client, suggestion, oldStatus);

            await interaction.update({
                content: `✅ Status wurde zu "${SUGGESTION_STATUS_LABELS[newStatus]}" geändert!`,
                components: []
            }).catch(() => {});

            return;
        }

        // =====================================================
        // BUTTON: Team-Notiz
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_team_note:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, Team-Notizen hinzuzufügen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            await interaction.showModal(createTeamNoteModal(suggestionId));
            return;
        }

        // =====================================================
        // BUTTON: Rückfrage
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_question:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, Rückfragen zu stellen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            await interaction.showModal(createQuestionModal(suggestionId));
            return;
        }

        // =====================================================
        // MODAL: Team-Notiz
        // =====================================================

        if (interaction.isModalSubmit() && interaction.customId.startsWith("suggestion_team_note:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);
            const note = interaction.fields.getTextInputValue("team_note");

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, Team-Notizen hinzuzufügen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            addTeamNote(suggestionId, note);

            // Embed aktualisieren
            const embed = createSuggestionEmbed(suggestion, true);
            const buttons = createSuggestionButtons(suggestionId, true, false);

            await interaction.message.edit({
                embeds: [embed],
                components: buttons || []
            });

            await interaction.reply({
                content: "✅ Team-Notiz wurde hinzugefügt!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }

        // =====================================================
        // MODAL: Rückfrage stellen
        // =====================================================

        if (interaction.isModalSubmit() && interaction.customId.startsWith("suggestion_question_modal:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);
            const question = interaction.fields.getTextInputValue("question_text");

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (!isSuggestionTeamMember(member, teamRoleIds)) {
                await interaction.reply({
                    content: "❌ Du hast keine Berechtigung, Rückfragen zu stellen.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            // DM an den Ersteller senden
            try {
                const user = await client.users.fetch(suggestion.userId).catch(() => null);
                if (!user) {
                    await interaction.reply({
                        content: "❌ Konnte den Benutzer nicht finden.",
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`❓ Rückfrage zu deinem Vorschlag #${suggestion.id}`)
                    .setDescription(`Das Serverteam hat eine Rückfrage zu deinem Vorschlag:\n\n**"${suggestion.title}"**\n\n**Rückfrage:**\n${question}`)
                    .addFields(
                        { name: "Vorschlags-ID", value: `#${suggestion.id}`, inline: true },
                        { name: "Von", value: `<@${member.id}>`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: "Bürger-Vorschlagssystem ✧ NoVex RP" });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`suggestion_answer:${suggestionId}`)
                        .setLabel("💬 Antworten")
                        .setStyle(ButtonStyle.Primary)
                );

                await user.send({ embeds: [embed], components: [row] });

                // Team-Notiz hinzufügen
                addTeamNote(suggestionId, `Rückfrage gestellt: ${question}`);

                await interaction.reply({
                    content: "✅ Rückfrage wurde an den Ersteller gesendet!",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});

            } catch (error) {
                console.error("❌ Konnte DM nicht senden:", error);
                await interaction.reply({
                    content: "❌ Konnte die Rückfrage nicht senden (DM deaktiviert).",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            return;
        }

        // =====================================================
        // BUTTON: Antworten (in DM)
        // =====================================================

        if (interaction.isMessageComponent() && interaction.customId.startsWith("suggestion_answer:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (interaction.user.id !== suggestion.userId) {
                await interaction.reply({
                    content: "❌ Du kannst nur auf deine eigenen Vorschläge antworten.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            await interaction.showModal(createAnswerModal(suggestionId));
            return;
        }

        // =====================================================
        // MODAL: Antwort schreiben
        // =====================================================

        if (interaction.isModalSubmit() && interaction.customId.startsWith("suggestion_answer_modal:")) {
            const suggestionId = parseInt(interaction.customId.split(":")[1]);
            const suggestion = getSuggestion(suggestionId);
            const answer = interaction.fields.getTextInputValue("answer_text");

            if (!suggestion) {
                await interaction.reply({
                    content: "❌ Vorschlag nicht gefunden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            if (interaction.user.id !== suggestion.userId) {
                await interaction.reply({
                    content: "❌ Du kannst nur auf deine eigenen Vorschläge antworten.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            // Guild abrufen
            const guild = client.guilds.cache.get(suggestion.guildId);
            if (!guild) {
                await interaction.reply({
                    content: "❌ Server konnte nicht gefunden werden.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
                return;
            }

            // Antwort als neuen Vorschlag mit Referenz erstellen
            const newSuggestion = createSuggestion({
                userId: suggestion.userId,
                username: interaction.user.username,
                displayName: interaction.user.displayName,
                title: `Antwort auf Vorschlag #${suggestion.id}`,
                description: `**Antwort auf Rückfrage:**\n\n${answer}\n\n---\n**Originaler Vorschlag:**\n${suggestion.title}\n\n${suggestion.description}`,
                category: suggestion.category,
                guildId: suggestion.guildId,
                channelId: suggestion.channelId
            });

            // Vorschlags-Kanal abrufen
            const suggestionChannelId = getSuggestionChannelId(suggestion.guildId);
            if (suggestionChannelId) {
                const suggestionChannel = await guild.channels.fetch(suggestionChannelId).catch(() => null);
                if (suggestionChannel && suggestionChannel.isTextBased()) {
                    const embed = createSuggestionEmbed(newSuggestion, false);
                    const buttons = createSuggestionButtons(newSuggestion.id, true, false); // Team-Buttons anzeigen

                    const suggestionMessage = await suggestionChannel.send({
                        embeds: [embed],
                        components: buttons || []
                    });

                    updateSuggestion(newSuggestion.id, {
                        messageId: suggestionMessage.id,
                        channelId: suggestionChannelId
                    });
                }
            }

            // Team-Notiz zum Original-Vorschlag hinzufügen
            addTeamNote(suggestion.id, `Antwort erhalten: ${answer}`);

            await interaction.reply({
                content: "✅ Deine Antwort wurde als neuer Vorschlag eingereicht!",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});

            return;
        }
    });

    console.log("✅ Bürger-Vorschlag-System wurde initialisiert.");
}

module.exports = {
    initializeBuergerVorschlagSystem,
    SUGGESTION_STATUS,
    SUGGESTION_STATUS_LABELS,
    SUGGESTION_CATEGORIES
};