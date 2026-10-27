const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require("discord.js");

// =====================================================
// 👨‍💻 DEV-AUFGABEN-SYSTEM — NEXORACLOUD
// =====================================================
// Vollständiges, eigenständiges Modul:
//  • !dev-aufgaben        -> Spieler reichen Wünsche/Aufgaben ein
//  • !dev-aufgaben-panel  -> Erstellt ein dauerhaftes Panel mit Button
//  • !dev-antwort         -> Developer antworten auf offene Aufgaben
//  • !dev-kanal           -> Konfiguriert den Ziel-Kanal
//  • Buttons "✅ Erledigt" / "❌ Ablehnen" direkt an der Aufgabe
//  • Panel-Button "📋 Dev-Aufgabe senden" öffnet ein Modal und erstellt
//    eine Aufgabe auf demselben Weg wie !dev-aufgaben (keine Duplikate,
//    gemeinsame createAndPostTask()-Funktion). Der Button funktioniert
//    dauerhaft, auch nach einem Bot-Neustart, da die customId statisch
//    ist und keine Nachrichten-spezifischen Daten benötigt.
//
// Das Modul registriert eigene "messageCreate"- und
// "interactionCreate"-Listener und greift dabei nicht in
// die bestehenden Handler des Hauptsystems ein. Alle
// Daten werden dauerhaft in einer eigenen JSON-Datei
// gespeichert, damit sie einen Bot-Neustart überstehen.
// =====================================================

const DEV_TASKS_FILE = path.join(__dirname, "dev-tasks-data.json");

const DEFAULT_DEVELOPER_ROLE_ID = "1539991224071491584";

const TASK_COLLECT_TIMEOUT_MS = 5 * 60 * 1000; // 5 Minuten Zeit für die Aufgabenbeschreibung

const STATUS = {
    OPEN: "open",
    DONE: "done",
    REJECTED: "rejected"
};

const STATUS_LABELS = {
    [STATUS.OPEN]: "🟡 Offen",
    [STATUS.DONE]: "🟢 Erledigt",
    [STATUS.REJECTED]: "🔴 Abgelehnt"
};

const STATUS_COLORS = {
    [STATUS.OPEN]: 0xFEE75C,
    [STATUS.DONE]: 0x57F287,
    [STATUS.REJECTED]: 0xED4245
};

// =====================================================
// 💾 SPEICHERUNG (JSON) — überlebt Bot-Neustarts
// =====================================================

function loadDevTasksData() {
    try {
        if (!fs.existsSync(DEV_TASKS_FILE)) {
            const initial = { config: {}, tasks: {}, counter: 0 };
            fs.writeFileSync(DEV_TASKS_FILE, JSON.stringify(initial, null, 2), "utf8");
            return initial;
        }

        const data = JSON.parse(fs.readFileSync(DEV_TASKS_FILE, "utf8"));

        if (!data.config || typeof data.config !== "object") data.config = {};
        if (!data.tasks || typeof data.tasks !== "object") data.tasks = {};
        if (typeof data.counter !== "number") data.counter = 0;

        return data;
    } catch (error) {
        console.error("❌ Fehler beim Laden der Dev-Aufgaben-Daten:", error);
        return { config: {}, tasks: {}, counter: 0 };
    }
}

function saveDevTasksData(data) {
    try {
        fs.writeFileSync(DEV_TASKS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Dev-Aufgaben-Daten:", error);
    }
}

let DEV_TASKS_DATA = loadDevTasksData();

function getGuildChannelId(guildId) {
    return DEV_TASKS_DATA.config[guildId]?.channelId || null;
}

function setGuildChannelId(guildId, channelId) {
    DEV_TASKS_DATA.config[guildId] = { channelId };
    saveDevTasksData(DEV_TASKS_DATA);
}

function createTask({ guildId, userId, userTag, task }) {
    DEV_TASKS_DATA.counter += 1;
    const id = String(DEV_TASKS_DATA.counter);

    const record = {
        id,
        guildId,
        userId,
        userTag,
        task,
        status: STATUS.OPEN,
        developerResponse: null,
        rejectReason: null,
        channelId: null,
        messageId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    DEV_TASKS_DATA.tasks[id] = record;
    saveDevTasksData(DEV_TASKS_DATA);

    return record;
}

function getTask(id) {
    return DEV_TASKS_DATA.tasks[id] || null;
}

function updateTask(id, updates) {
    const task = DEV_TASKS_DATA.tasks[id];
    if (!task) return null;

    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    saveDevTasksData(DEV_TASKS_DATA);

    return task;
}

function getOpenTasks(guildId) {
    return Object.values(DEV_TASKS_DATA.tasks)
        .filter(t => t.guildId === guildId && t.status === STATUS.OPEN)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// =====================================================
// 🎨 EMBED & BUTTONS (NoVex RP-Design)
// =====================================================

function buildTaskEmbed(task) {
    const lines = [
        `👤 **User:** <@${task.userId}>`,
        `🆔 **User-ID:** ${task.userId}`,
        "",
        "📋 **Aufgabe:**",
        task.task,
        "",
        `📊 **Status:** ${STATUS_LABELS[task.status]}`
    ];

    if (task.developerResponse) {
        lines.push("", `💬 **Antwort:** ${task.developerResponse}`);
    }

    if (task.status === STATUS.REJECTED && task.rejectReason) {
        lines.push("", `📄 **Grund:** ${task.rejectReason}`);
    }

    return new EmbedBuilder()
        .setTitle("👨‍💻 Neue Dev-Aufgabe")
        .setDescription(lines.join("\n"))
        .setColor(STATUS_COLORS[task.status])
        .setFooter({ text: `NoVex RP • Dev-Aufgaben-System ✧ Aufgabe #${task.id}` })
        .setTimestamp(new Date(task.createdAt));
}

function buildTaskButtons(task) {
    const disabled = task.status !== STATUS.OPEN;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`devtask_done_${task.id}`)
            .setLabel("Erledigt")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`devtask_reject_${task.id}`)
            .setLabel("Ablehnen")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

function buildPanelEmbed() {
    return new EmbedBuilder()
        .setTitle("👨‍💻 Dev-Aufgaben")
        .setDescription(
            "Du hast einen Wunsch, eine Idee oder einen Fehler gefunden?\n" +
            "Klicke auf den Button unten und sende deine Dev-Aufgabe direkt an das Entwicklerteam."
        )
        .setColor(0x5865F2)
        .setFooter({ text: "NoVex RP • Dev-Aufgaben-System" });
}

function buildPanelButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("devtask_panel_open")
            .setLabel("Dev-Aufgabe senden")
            .setEmoji("📋")
            .setStyle(ButtonStyle.Primary)
    );
}

// =====================================================
// 📩 GEMEINSAME AUFGABEN-ERSTELLUNG
// =====================================================
// Wird sowohl von !dev-aufgaben als auch vom Panel-Modal
// verwendet, damit garantiert nur EINE Dev-Aufgabe-Nachricht
// pro Einreichung entsteht (keine doppelten Nachrichten).

async function createAndPostTask({ client, guild, developerRoleId, guildId, userId, userTag, rawText }) {
    const channelId = getGuildChannelId(guildId);

    if (!channelId) {
        return { ok: false, reason: "no-channel" };
    }

    const targetChannel = await guild.channels.fetch(channelId).catch(() => null);

    if (!targetChannel) {
        return { ok: false, reason: "channel-missing" };
    }

    const cleanText = (rawText || "").trim().slice(0, 1500);

    if (!cleanText) {
        return { ok: false, reason: "empty" };
    }

    const task = createTask({ guildId, userId, userTag, task: cleanText });

    const sentMessage = await targetChannel.send({
        content: `<@&${developerRoleId}>`,
        embeds: [buildTaskEmbed(task)],
        components: [buildTaskButtons(task)],
        allowedMentions: { roles: [developerRoleId] }
    });

    updateTask(task.id, { channelId: targetChannel.id, messageId: sentMessage.id });

    return { ok: true, task };
}

async function refreshTaskMessage(client, task) {
    try {
        if (!task.channelId || !task.messageId) return;

        const channel = await client.channels.fetch(task.channelId).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(task.messageId).catch(() => null);
        if (!message) return;

        await message.edit({
            content: message.content,
            embeds: [buildTaskEmbed(task)],
            components: [buildTaskButtons(task)]
        });
    } catch (error) {
        console.error("❌ Fehler beim Aktualisieren der Dev-Aufgabe-Nachricht:", error);
    }
}

// =====================================================
// 🔐 BERECHTIGUNGEN
// =====================================================

function isDeveloper(member, developerRoleId, botOwnerId) {
    if (!member) return false;
    if (botOwnerId && member.id === botOwnerId) return true;
    return member.roles?.cache?.has(developerRoleId) || false;
}

// =====================================================
// 📨 DM-BENACHRICHTIGUNGEN AN DEN SPIELER
// =====================================================

async function sendDoneDM(client, task) {
    try {
        const user = await client.users.fetch(task.userId);

        const embed = new EmbedBuilder()
            .setTitle("✅ Deine Dev-Aufgabe wurde erledigt!")
            .setDescription(
                `📝 **Deine Aufgabe:**\n${task.task}\n\nVielen Dank für deinen Vorschlag – er wurde erfolgreich umgesetzt! 🎉`
            )
            .setColor(STATUS_COLORS[STATUS.DONE])
            .setFooter({ text: "Vexo RP • Dev-Aufgaben-System" })
            .setTimestamp();

        await user.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ DM (erledigt) konnte nicht gesendet werden:", error?.message || error);
    }
}

async function sendRejectDM(client, task) {
    try {
        const user = await client.users.fetch(task.userId);

        const descriptionParts = [`📝 **Deine Aufgabe:**\n${task.task}`];

        if (task.rejectReason) {
            descriptionParts.push(`📄 **Grund:** ${task.rejectReason}`);
        }

        const embed = new EmbedBuilder()
            .setTitle("❌ Deine Dev-Aufgabe wurde abgelehnt")
            .setDescription(descriptionParts.join("\n\n"))
            .setColor(STATUS_COLORS[STATUS.REJECTED])
            .setFooter({ text: "Vexo RP • Dev-Aufgaben-System" })
            .setTimestamp();

        await user.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ DM (abgelehnt) konnte nicht gesendet werden:", error?.message || error);
    }
}

// =====================================================
// 🚀 INITIALISIERUNG
// =====================================================

function initializeDevTaskSystem(client, options = {}) {
    const PREFIX = options.prefix || "!";
    const DEVELOPER_ROLE_ID = options.developerRoleId || DEFAULT_DEVELOPER_ROLE_ID;
    const BOT_OWNER_ID = options.botOwnerId || null;

    // Verhindert, dass ein Spieler mehrfach gleichzeitig
    // einen offenen "Schreib deine Aufgabe"-Collector startet.
    const pendingSubmissions = new Set();

    // -------------------------------------------------
    // 📩 PREFIX-BEFEHLE
    // -------------------------------------------------
    client.on("messageCreate", async message => {
        try {
            if (message.author.bot) return;
            if (!message.guild) return;
            if (!message.content.startsWith(PREFIX)) return;

            const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
            const command = args.shift()?.toLowerCase();

            // =============================================
            // !DEV-KANAL — Konfiguriert den Ziel-Kanal
            // =============================================
            if (command === "dev-kanal") {
                if (!isDeveloper(message.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                    return message.reply("❌ Du hast keine Berechtigung, den Dev-Aufgaben-Kanal zu konfigurieren.");
                }

                setGuildChannelId(message.guild.id, message.channel.id);

                const embed = new EmbedBuilder()
                    .setTitle("⚙️ Dev-Aufgaben-Kanal festgelegt")
                    .setDescription(`Ab sofort werden alle neuen Dev-Aufgaben in ${message.channel} veröffentlicht.`)
                    .setColor(0x5865F2)
                    .setFooter({ text: "NoVex RP • Dev-Aufgaben-System" });

                return message.channel.send({ embeds: [embed] });
            }

            // =============================================
            // !DEV-AUFGABEN-PANEL — Erstellt ein dauerhaftes Panel
            // =============================================
            if (command === "dev-aufgaben-panel") {
                if (!isDeveloper(message.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                    return message.reply("❌ Du hast keine Berechtigung, ein Dev-Aufgaben-Panel zu erstellen.");
                }

                await message.channel.send({
                    embeds: [buildPanelEmbed()],
                    components: [buildPanelButtons()]
                });

                return message.reply("✅ Das Dev-Aufgaben-Panel wurde erstellt.").catch(() => {});
            }

            // =============================================
            // !DEV-AUFGABEN — Spieler reicht eine Aufgabe ein
            // =============================================
            if (command === "dev-aufgaben") {
                const channelId = getGuildChannelId(message.guild.id);

                if (!channelId) {
                    return message.reply(
                        "❌ Es wurde noch kein Dev-Aufgaben-Kanal konfiguriert. Ein Developer kann ihn mit `/dev-kanal` festlegen."
                    );
                }

                const targetChannel = await message.guild.channels.fetch(channelId).catch(() => null);

                if (!targetChannel) {
                    return message.reply(
                        "❌ Der konfigurierte Dev-Aufgaben-Kanal existiert nicht mehr. Bitte mit `/dev-kanal` neu einrichten."
                    );
                }

                const submitTask = async rawText => {
                    const result = await createAndPostTask({
                        client,
                        guild: message.guild,
                        developerRoleId: DEVELOPER_ROLE_ID,
                        guildId: message.guild.id,
                        userId: message.author.id,
                        userTag: message.author.tag,
                        rawText
                    });

                    if (!result.ok) {
                        if (result.reason === "empty") {
                            return message.reply("❌ Deine Aufgabe darf nicht leer sein.");
                        }
                        return message.reply("❌ Der Dev-Aufgaben-Kanal ist nicht mehr erreichbar. Bitte mit `/dev-kanal` neu einrichten.");
                    }

                    return message.reply(`✅ Deine Dev-Aufgabe wurde erfolgreich eingereicht! (Aufgabe #${result.task.id})`);
                };

                // Direkter Text nach dem Befehl -> sofort einreichen
                const inlineText = args.join(" ").trim();
                if (inlineText) {
                    return submitTask(inlineText);
                }

                if (pendingSubmissions.has(message.author.id)) {
                    return message.reply("⏳ Du schreibst bereits an einer Dev-Aufgabe. Bitte schließe diese zuerst ab.");
                }

                await message.reply(
                    "📝 Bitte schreibe jetzt **innerhalb von 5 Minuten** deine Aufgabe bzw. deinen Wunsch für die Developer in diesen Kanal."
                );

                pendingSubmissions.add(message.author.id);

                const collector = message.channel.createMessageCollector({
                    filter: m => m.author.id === message.author.id,
                    time: TASK_COLLECT_TIMEOUT_MS,
                    max: 1
                });

                collector.on("collect", async collected => {
                    pendingSubmissions.delete(message.author.id);
                    await submitTask(collected.content).catch(error => {
                        console.error("❌ Fehler beim Einreichen der Dev-Aufgabe:", error);
                    });
                });

                collector.on("end", collected => {
                    pendingSubmissions.delete(message.author.id);
                    if (collected.size === 0) {
                        message.reply("⏱️ Zeit abgelaufen. Bitte führe `/dev-aufgaben` erneut aus.").catch(() => {});
                    }
                });

                return;
            }

            // =============================================
            // !DEV-ANTWORT — Developer wählt offene Aufgabe aus
            // =============================================
            if (command === "dev-antwort") {
                if (!isDeveloper(message.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                    return message.reply("❌ Nur Developer dürfen auf Dev-Aufgaben antworten.");
                }

                const openTasks = getOpenTasks(message.guild.id);

                if (openTasks.length === 0) {
                    return message.reply("📭 Es gibt aktuell keine offenen Dev-Aufgaben.");
                }

                const selectOptions = openTasks.slice(0, 25).map(task => ({
                    label: `Aufgabe #${task.id} — ${task.userTag}`.slice(0, 100),
                    description: task.task.slice(0, 90),
                    value: task.id
                }));

                const select = new StringSelectMenuBuilder()
                    .setCustomId("devtask_answer_select")
                    .setPlaceholder("Wähle eine offene Dev-Aufgabe aus...")
                    .addOptions(selectOptions);

                const row = new ActionRowBuilder().addComponents(select);

                return message.reply({
                    content: "💬 Wähle die Dev-Aufgabe aus, auf die du antworten möchtest:",
                    components: [row]
                });
            }
        } catch (error) {
            console.error("❌ Fehler im Dev-Aufgaben-System (messageCreate):", error);
        }
    });

    // -------------------------------------------------
    // 🖱️ BUTTONS, SELECT-MENÜ & MODALS
    // -------------------------------------------------
    client.on("interactionCreate", async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                if (interaction.__slashCommandPermissionDenied) return;
                if (!interaction.guild) {
                    return interaction.reply({
                        content: "❌ Dieser Befehl funktioniert nur auf einem Server.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.commandName === "dev-kanal") {
                    if (!isDeveloper(interaction.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                        return interaction.reply({
                            content: "❌ Du hast keine Berechtigung, den Dev-Aufgaben-Kanal zu konfigurieren.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const channel = interaction.options.getChannel("kanal", true);
                    if (!channel.isTextBased() || !channel.guild) {
                        return interaction.reply({
                            content: "❌ Bitte wähle einen Textkanal auf diesem Server.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    setGuildChannelId(interaction.guild.id, channel.id);
                    return interaction.reply({
                        content: `✅ Dev-Aufgaben werden ab sofort in ${channel} veröffentlicht.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.commandName === "dev-aufgaben-panel") {
                    if (!isDeveloper(interaction.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                        return interaction.reply({
                            content: "❌ Du hast keine Berechtigung, ein Dev-Aufgaben-Panel zu erstellen.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.channel.send({
                        embeds: [buildPanelEmbed()],
                        components: [buildPanelButtons()]
                    });
                    return interaction.reply({
                        content: "✅ Das Dev-Aufgaben-Panel wurde erstellt.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.commandName === "dev-aufgaben") {
                    const result = await createAndPostTask({
                        client,
                        guild: interaction.guild,
                        developerRoleId: DEVELOPER_ROLE_ID,
                        guildId: interaction.guild.id,
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        rawText: interaction.options.getString("aufgabe", true)
                    });

                    if (!result.ok) {
                        const messages = {
                            "no-channel": "❌ Es wurde noch kein Dev-Aufgaben-Kanal konfiguriert. Ein Developer kann ihn mit `/dev-kanal` festlegen.",
                            "channel-missing": "❌ Der konfigurierte Dev-Aufgaben-Kanal existiert nicht mehr. Bitte mit `/dev-kanal` neu einrichten.",
                            empty: "❌ Deine Aufgabe darf nicht leer sein."
                        };
                        return interaction.reply({
                            content: messages[result.reason] || "❌ Die Dev-Aufgabe konnte nicht eingereicht werden.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content: `✅ Deine Dev-Aufgabe wurde eingereicht! (Aufgabe #${result.task.id})`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.commandName === "dev-antwort") {
                    if (!isDeveloper(interaction.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                        return interaction.reply({
                            content: "❌ Nur Developer dürfen auf Dev-Aufgaben antworten.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const openTasks = getOpenTasks(interaction.guild.id);
                    if (openTasks.length === 0) {
                        return interaction.reply({
                            content: "📭 Es gibt aktuell keine offenen Dev-Aufgaben.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId("devtask_answer_select")
                        .setPlaceholder("Wähle eine offene Dev-Aufgabe aus...")
                        .addOptions(openTasks.slice(0, 25).map(task => ({
                            label: `Aufgabe #${task.id} — ${task.userTag}`.slice(0, 100),
                            description: task.task.slice(0, 90),
                            value: task.id
                        })));

                    return interaction.reply({
                        content: "💬 Wähle die Dev-Aufgabe aus, auf die du antworten möchtest:",
                        components: [new ActionRowBuilder().addComponents(select)],
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // ============== BUTTON: ✅ ERLEDIGT ==============
            if (interaction.isButton() && interaction.customId.startsWith("devtask_done_")) {
                const taskId = interaction.customId.replace("devtask_done_", "");
                const task = getTask(taskId);

                if (!task) {
                    return interaction.reply({ content: "❌ Diese Dev-Aufgabe wurde nicht gefunden.", flags: MessageFlags.Ephemeral });
                }

                if (!isDeveloper(interaction.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                    return interaction.reply({ content: "❌ Nur Developer dürfen Dev-Aufgaben bearbeiten.", flags: MessageFlags.Ephemeral });
                }

                if (task.status !== STATUS.OPEN) {
                    return interaction.reply({ content: "⚠️ Diese Aufgabe wurde bereits bearbeitet.", flags: MessageFlags.Ephemeral });
                }

                const updated = updateTask(taskId, { status: STATUS.DONE });

                await interaction.update({
                    embeds: [buildTaskEmbed(updated)],
                    components: [buildTaskButtons(updated)]
                });

                await sendDoneDM(client, updated);
                return;
            }

            // ============== BUTTON: ❌ ABLEHNEN ==============
            if (interaction.isButton() && interaction.customId.startsWith("devtask_reject_")) {
                const taskId = interaction.customId.replace("devtask_reject_", "");
                const task = getTask(taskId);

                if (!task) {
                    return interaction.reply({ content: "❌ Diese Dev-Aufgabe wurde nicht gefunden.", flags: MessageFlags.Ephemeral });
                }

                if (!isDeveloper(interaction.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                    return interaction.reply({ content: "❌ Nur Developer dürfen Dev-Aufgaben bearbeiten.", flags: MessageFlags.Ephemeral });
                }

                if (task.status !== STATUS.OPEN) {
                    return interaction.reply({ content: "⚠️ Diese Aufgabe wurde bereits bearbeitet.", flags: MessageFlags.Ephemeral });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`devtask_reject_modal_${taskId}`)
                    .setTitle("❌ Aufgabe ablehnen");

                const reasonInput = new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel("Grund (optional)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("z. B. Nicht umsetzbar, bereits vorhanden, ...")
                    .setMaxLength(500)
                    .setRequired(false);

                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

                return interaction.showModal(modal);
            }

            // ============== BUTTON: 📋 DEV-AUFGABE SENDEN (PANEL) ==============
            if (interaction.isButton() && interaction.customId === "devtask_panel_open") {
                const modal = new ModalBuilder()
                    .setCustomId("devtask_panel_modal")
                    .setTitle("📋 Neue Dev-Aufgabe");

                const taskInput = new TextInputBuilder()
                    .setCustomId("task")
                    .setLabel("Beschreibe deine Dev-Aufgabe")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("z. B. Ich möchte gerne, dass ein Häusersystem kommt.")
                    .setMaxLength(1500)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(taskInput));

                return interaction.showModal(modal);
            }

            // ============== SELECT: AUFGABE FÜR ANTWORT WÄHLEN ==============
            if (interaction.isStringSelectMenu() && interaction.customId === "devtask_answer_select") {
                if (!isDeveloper(interaction.member, DEVELOPER_ROLE_ID, BOT_OWNER_ID)) {
                    return interaction.reply({ content: "❌ Nur Developer dürfen auf Dev-Aufgaben antworten.", flags: MessageFlags.Ephemeral });
                }

                const taskId = interaction.values[0];
                const task = getTask(taskId);

                if (!task) {
                    return interaction.reply({ content: "❌ Diese Dev-Aufgabe wurde nicht gefunden.", flags: MessageFlags.Ephemeral });
                }

                if (task.status !== STATUS.OPEN) {
                    return interaction.reply({ content: "⚠️ Diese Aufgabe wurde bereits bearbeitet.", flags: MessageFlags.Ephemeral });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`devtask_answer_modal_${taskId}`)
                    .setTitle(`💬 Antwort auf Aufgabe #${taskId}`);

                const answerInput = new TextInputBuilder()
                    .setCustomId("answer")
                    .setLabel("Deine Antwort")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("z. B. Wann soll das Häusersystem fertig sein?")
                    .setMaxLength(1000)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(answerInput));

                // Auswahl-Nachricht wird entfernt, damit sie nicht doppelt genutzt wird
                await interaction.message.delete().catch(() => {});

                return interaction.showModal(modal);
            }

            // ============== MODAL: NEUE DEV-AUFGABE (VOM PANEL) ==============
            if (interaction.isModalSubmit() && interaction.customId === "devtask_panel_modal") {
                if (!interaction.guild) {
                    return interaction.reply({
                        content: "❌ Dev-Aufgaben können nur auf einem Server eingereicht werden.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const rawText = interaction.fields.getTextInputValue("task");

                const result = await createAndPostTask({
                    client,
                    guild: interaction.guild,
                    developerRoleId: DEVELOPER_ROLE_ID,
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    rawText
                });

                if (!result.ok) {
                    if (result.reason === "no-channel") {
                        return interaction.reply({
                            content: "❌ Es wurde noch kein Dev-Aufgaben-Kanal konfiguriert. Bitte wende dich an das Team.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    if (result.reason === "channel-missing") {
                        return interaction.reply({
                            content: "❌ Der Dev-Aufgaben-Kanal ist nicht mehr erreichbar. Bitte wende dich an das Team.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    return interaction.reply({
                        content: "❌ Deine Aufgabe darf nicht leer sein.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    content: `✅ Deine Dev-Aufgabe wurde erfolgreich eingereicht! (Aufgabe #${result.task.id})`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // ============== MODAL: ABLEHNUNGSGRUND ==============
            if (interaction.isModalSubmit() && interaction.customId.startsWith("devtask_reject_modal_")) {
                const taskId = interaction.customId.replace("devtask_reject_modal_", "");
                const task = getTask(taskId);

                if (!task) {
                    return interaction.reply({ content: "❌ Diese Dev-Aufgabe wurde nicht gefunden.", flags: MessageFlags.Ephemeral });
                }

                if (task.status !== STATUS.OPEN) {
                    return interaction.reply({ content: "⚠️ Diese Aufgabe wurde bereits bearbeitet.", flags: MessageFlags.Ephemeral });
                }

                const reason = interaction.fields.getTextInputValue("reason")?.trim() || null;

                const updated = updateTask(taskId, { status: STATUS.REJECTED, rejectReason: reason });

                await refreshTaskMessage(client, updated);
                await sendRejectDM(client, updated);

                return interaction.reply({
                    content: "✅ Die Dev-Aufgabe wurde abgelehnt und der Spieler wurde per DM informiert.",
                    flags: MessageFlags.Ephemeral
                });
            }

            // ============== MODAL: DEVELOPER-ANTWORT ==============
            if (interaction.isModalSubmit() && interaction.customId.startsWith("devtask_answer_modal_")) {
                const taskId = interaction.customId.replace("devtask_answer_modal_", "");
                const task = getTask(taskId);

                if (!task) {
                    return interaction.reply({ content: "❌ Diese Dev-Aufgabe wurde nicht gefunden.", flags: MessageFlags.Ephemeral });
                }

                if (task.status !== STATUS.OPEN) {
                    return interaction.reply({ content: "⚠️ Diese Aufgabe wurde bereits bearbeitet.", flags: MessageFlags.Ephemeral });
                }

                const answer = interaction.fields.getTextInputValue("answer")?.trim();

                const updated = updateTask(taskId, { developerResponse: answer });

                await refreshTaskMessage(client, updated);

                return interaction.reply({
                    content: "✅ Deine Antwort wurde bei der Dev-Aufgabe im Kanal veröffentlicht.",
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error("❌ Fehler im Dev-Aufgaben-System (interactionCreate):", error);
            if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Der Dev-Aufgaben-Befehl konnte nicht abgeschlossen werden.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    });

    console.log("👨‍💻 Dev-Aufgaben-System wurde initialisiert.");
}

module.exports = { initializeDevTaskSystem };