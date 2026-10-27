// =====================================================
// 📩 NEXORACLOUD – PRIVATNACHRICHTEN-SYSTEM
// =====================================================
//
// Ermöglicht Team-/Administrator-Mitgliedern, über den Befehl
// !privatnachricht einem beliebigen Server-Mitglied eine private
// Discord-DM im NoVex RP-Design zu senden.
//
// Eigenständiges Modul – greift NICHT in bestehende Systeme
// (Gang-System, Dev-Aufgaben-System, RP-Logs-System, etc.) ein.
//
// =====================================================

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
    MessageFlags
} = require("discord.js");

const MEMBERS_PER_PAGE = 25; // Discord-Limit für Select-Menu-Optionen
const MEMBER_CACHE_TTL_MS = 30_000; // Verhindert wiederholte volle Server-Fetches bei schnellem Blättern
const SESSION_TTL_MS = 15 * 60 * 1000; // Aufräumen alter Sitzungen (15 Minuten Inaktivität)
const DISCORD_ID_REGEX = /^\d{17,20}$/;

function initializePrivatnachrichtSystem(client, options = {}) {

    const {
        prefix = "!",
        botOwnerId = null,
        permissionRoleIds = []
    } = options;

    // =====================================================
    // BERECHTIGUNGSPRÜFUNG (immer serverseitig, bei jedem Schritt)
    // =====================================================

    function hasPermission(member) {
        if (!member) {
            return false;
        }

        if (botOwnerId && member.id === botOwnerId) {
            return true;
        }

        if (
            permissionRoleIds.length > 0 &&
            member.roles.cache.some(role => permissionRoleIds.includes(role.id))
        ) {
            return true;
        }

        return false;
    }

    // Prüft Autor + Berechtigung in einem Schritt und antwortet bei
    // Fehlschlag selbst (ephemeral). Muss VOR jedem defer/showModal
    // aufgerufen werden, solange die Interaction noch unbeantwortet ist.
    async function verifyAccess(interaction, authorId) {
        if (interaction.user.id !== authorId) {
            await interaction.reply({
                content: "❌ Dieses Panel wurde nicht von dir gestartet.",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return false;
        }

        if (!hasPermission(interaction.member)) {
            await interaction.reply({
                content: "❌ Du hast keine Berechtigung, dieses System zu verwenden.",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return false;
        }

        return true;
    }

    // =====================================================
    // MITGLIEDERLISTE (mit kurzem Cache pro Server)
    // =====================================================
    //
    // Ohne Cache wurde bei JEDER Seitennavigation die komplette
    // Mitgliederliste erneut vom Discord-Server geladen. Bei größeren
    // Servern dauerte das teils länger als die 3-Sekunden-Frist von
    // Discord für die erste Antwort auf eine Interaction – die Buttons
    // reagierten dann scheinbar nicht mehr (meist ab Seite 3, weil sich
    // die Verzögerung über mehrere Fetches aufsummiert hat). Der Cache
    // hält die Liste kurz vor, sodass Blättern sofort reagiert. Beim
    // Öffnen des Panels (!privatnachricht) wird trotzdem immer frisch
    // vom Server geladen.

    const memberListCache = new Map(); // guildId -> { members, fetchedAt }

    async function getGuildMembers(guild, { forceRefresh = false } = {}) {
        const cached = memberListCache.get(guild.id);

        if (!forceRefresh && cached && Date.now() - cached.fetchedAt < MEMBER_CACHE_TTL_MS) {
            return cached.members;
        }

        const fetched = await guild.members.fetch();

        const sorted = [...fetched.values()].sort((a, b) =>
            a.displayName.localeCompare(b.displayName, "de", { sensitivity: "base" })
        );

        memberListCache.set(guild.id, { members: sorted, fetchedAt: Date.now() });

        return sorted;
    }

    function matchesQuery(member, query) {
        const q = query.toLowerCase();

        return (
            member.displayName.toLowerCase().includes(q) ||
            member.user.username.toLowerCase().includes(q) ||
            (member.user.globalName && member.user.globalName.toLowerCase().includes(q))
        );
    }

    // =====================================================
    // SITZUNGEN (Auswahl-Status pro Absender)
    // =====================================================
    //
    // Speichert pro Admin, ob gerade die volle Liste oder eine Suche
    // durchblättert wird, sowie die aktuelle Seite. So muss die Seite
    // nicht mehr fehleranfällig im customId codiert werden.

    const sessions = new Map(); // authorId -> { mode, query, page, updatedAt }

    function getSession(authorId) {
        let session = sessions.get(authorId);

        if (!session) {
            session = { mode: "all", query: null, page: 0, updatedAt: Date.now() };
            sessions.set(authorId, session);
        }

        session.updatedAt = Date.now();
        return session;
    }

    function resetSession(authorId) {
        const session = { mode: "all", query: null, page: 0, updatedAt: Date.now() };
        sessions.set(authorId, session);
        return session;
    }

    setInterval(() => {
        const now = Date.now();
        for (const [authorId, session] of sessions.entries()) {
            if (now - session.updatedAt > SESSION_TTL_MS) {
                sessions.delete(authorId);
            }
        }
    }, 5 * 60 * 1000).unref();

    // =====================================================
    // UI-BAUSTEINE
    // =====================================================

    function paginate(list, page) {
        const totalPages = Math.max(1, Math.ceil(list.length / MEMBERS_PER_PAGE));
        const safePage = Math.min(Math.max(page, 0), totalPages - 1);

        const pageItems = list.slice(
            safePage * MEMBERS_PER_PAGE,
            safePage * MEMBERS_PER_PAGE + MEMBERS_PER_PAGE
        );

        return { pageItems, safePage, totalPages };
    }

    function buildMemberSelectMenu(pageMembers, authorId) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`pn_member_select:${authorId}`)
            .setPlaceholder("👤 Mitglied auswählen")
            .addOptions(
                pageMembers.map(member =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(member.displayName.slice(0, 100))
                        .setDescription(
                            `@${member.user.username} • ID: ${member.id}`.slice(0, 100)
                        )
                        .setValue(member.id)
                        .setEmoji("👤")
                )
            );

        return new ActionRowBuilder().addComponents(selectMenu);
    }

    function buildNavRow(authorId, safePage, totalPages) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pn_page_prev:${authorId}`)
                .setLabel("◀️ Zurück")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId("pn_page_indicator")
                .setLabel(`📄 Seite ${safePage + 1} / ${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`pn_page_next:${authorId}`)
                .setLabel("▶️ Weiter")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        );
    }

    function buildActionRow(authorId, mode) {
        const buttons = [
            new ButtonBuilder()
                .setCustomId(`pn_search_open:${authorId}`)
                .setLabel("🔎 Mitglied suchen")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`pn_id_open:${authorId}`)
                .setLabel("🆔 User-ID eingeben")
                .setStyle(ButtonStyle.Secondary)
        ];

        if (mode === "search") {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`pn_back_list:${authorId}`)
                    .setLabel("🔙 Alle Mitglieder")
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        return new ActionRowBuilder().addComponents(buttons);
    }

    // Rendert das aktuelle Auswahl-Panel (volle Liste ODER Suchergebnis)
    // anhand der gespeicherten Sitzung. Erwartet, dass die Interaction
    // bereits deferred wurde (deferUpdate) – editReply schließt die
    // Antwort ab, unabhängig davon, wie lange getGuildMembers braucht.
    async function renderSelectionPanel(interaction, guild, authorId) {
        const session = getSession(authorId);

        const allMembers = await getGuildMembers(guild);

        const list = session.mode === "search"
            ? allMembers.filter(member => matchesQuery(member, session.query))
            : allMembers;

        if (list.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("❌ Keine Treffer")
                .setDescription(
                    session.mode === "search"
                        ? `Es wurden keine Mitglieder für „${session.query}" gefunden.`
                        : "Es konnten keine Server-Mitglieder geladen werden."
                );

            return interaction.editReply({
                embeds: [embed],
                components: [buildActionRow(authorId, session.mode)]
            });
        }

        const { pageItems, safePage, totalPages } = paginate(list, session.page);
        session.page = safePage; // Seite in der Sitzung synchron halten (z. B. nach Filterwechsel)

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(
                session.mode === "search"
                    ? `🔎 Suchergebnisse für „${session.query}"`
                    : "📩 NoVex RP – Mitglied auswählen"
            )
            .setDescription(
                session.mode === "search"
                    ? `${list.length} Treffer gefunden. Wähle das gewünschte Mitglied aus.`
                    : "Wähle das Server-Mitglied aus, dem du eine private Nachricht senden möchtest."
            );

        return interaction.editReply({
            embeds: [embed],
            components: [
                buildMemberSelectMenu(pageItems, authorId),
                buildNavRow(authorId, safePage, totalPages),
                buildActionRow(authorId, session.mode)
            ]
        });
    }

    function buildMessageModal(authorId, targetUserId) {
        const modal = new ModalBuilder()
            .setCustomId(`pn_modal:${authorId}:${targetUserId}`)
            .setTitle("📩 Nachricht senden");

        const textInput = new TextInputBuilder()
            .setCustomId("pn_message_content")
            .setLabel("Nachricht")
            .setPlaceholder("Schreibe hier deine Nachricht...")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(1)
            .setMaxLength(3000)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
        return modal;
    }

    async function sendPrivateMessagePanel(channel, userId) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("📩 NoVex RP – Privatnachricht")
            .setDescription(
                "Hier kannst du einem Server-Mitglied eine private Nachricht senden.\n\n" +
                "🔹 Mitglied auswählen\n" +
                "🔹 Nachricht schreiben\n" +
                "🔹 Nachricht wird anschließend per DM versendet"
            )
            .setFooter({ text: "NoVex RP" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pn_open:${userId}`)
                .setLabel("👤 Mitglied auswählen")
                .setStyle(ButtonStyle.Primary)
        );

        return channel.send({ embeds: [embed], components: [row] });
    }

    // =====================================================
    // BEFEHL: privatnachricht
    // =====================================================

    client.on("messageCreate", async message => {
        try {
            if (message.author.bot || !message.guild) {
                return;
            }

            if (!message.content.toLowerCase().startsWith(`${prefix}privatnachricht`)) {
                return;
            }

            const member = message.member;

            if (!hasPermission(member)) {
                return message.reply({
                    content: "❌ Du hast keine Berechtigung, dieses System zu verwenden."
                });
            }

            await sendPrivateMessagePanel(message.channel, message.author.id);
        } catch (error) {
            console.error("❌ Fehler im Privatnachrichten-System (messageCreate):", error);
        }
    });

    // =====================================================
    // INTERAKTIONEN
    // =====================================================

    client.on("interactionCreate", async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                if (interaction.commandName !== "privatnachricht") return;
                if (interaction.__slashCommandPermissionDenied) return;
                if (!interaction.guild || !interaction.channel?.isTextBased()) {
                    return interaction.reply({
                        content: "❌ Dieser Befehl funktioniert nur in einem Server-Textkanal.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                if (!hasPermission(interaction.member)) {
                    return interaction.reply({
                        content: "❌ Du hast keine Berechtigung, dieses System zu verwenden.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await sendPrivateMessagePanel(interaction.channel, interaction.user.id);
                return interaction.reply({
                    content: "✅ Das Privatnachrichten-Panel wurde erstellt.",
                    flags: MessageFlags.Ephemeral
                });
            }

            // ---------------------------------------------------
            // 👤 Mitglied-auswählen-Button (Panel öffnen)
            // ---------------------------------------------------
            if (interaction.isButton() && interaction.customId.startsWith("pn_open:")) {
                const [, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                resetSession(authorId);

                // Beim Öffnen des Panels IMMER frisch vom Server laden.
                await interaction.deferUpdate();
                await getGuildMembers(interaction.guild, { forceRefresh: true });
                return renderSelectionPanel(interaction, interaction.guild, authorId);
            }

            // ---------------------------------------------------
            // ◀️ / ▶️ Seitennavigation (funktioniert auf jeder Seite)
            // ---------------------------------------------------
            if (
                interaction.isButton() &&
                (interaction.customId.startsWith("pn_page_prev:") ||
                    interaction.customId.startsWith("pn_page_next:"))
            ) {
                const [action, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                await interaction.deferUpdate();

                const session = getSession(authorId);
                session.page += action === "pn_page_prev" ? -1 : 1;

                return renderSelectionPanel(interaction, interaction.guild, authorId);
            }

            // ---------------------------------------------------
            // 🔙 Zurück zur vollständigen Mitgliederliste
            // ---------------------------------------------------
            if (interaction.isButton() && interaction.customId.startsWith("pn_back_list:")) {
                const [, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                await interaction.deferUpdate();

                const session = getSession(authorId);
                session.mode = "all";
                session.query = null;
                session.page = 0;

                return renderSelectionPanel(interaction, interaction.guild, authorId);
            }

            // ---------------------------------------------------
            // 🔎 "Mitglied suchen" -> Such-Modal öffnen
            // ---------------------------------------------------
            if (interaction.isButton() && interaction.customId.startsWith("pn_search_open:")) {
                const [, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`pn_search_modal:${authorId}`)
                    .setTitle("🔎 Mitglied suchen");

                const textInput = new TextInputBuilder()
                    .setCustomId("pn_search_query")
                    .setLabel("Name oder Username")
                    .setPlaceholder("z. B. MaxMustermann")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(textInput));

                return interaction.showModal(modal);
            }

            // ---------------------------------------------------
            // 🔎 Such-Modal wurde abgeschickt -> gefilterte Liste zeigen
            // ---------------------------------------------------
            if (interaction.isModalSubmit() && interaction.customId.startsWith("pn_search_modal:")) {
                const [, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                await interaction.deferUpdate();

                const query = interaction.fields.getTextInputValue("pn_search_query").trim();

                const session = getSession(authorId);
                session.mode = "search";
                session.query = query;
                session.page = 0;

                return renderSelectionPanel(interaction, interaction.guild, authorId);
            }

            // ---------------------------------------------------
            // 🆔 "User-ID eingeben" -> ID-Modal öffnen
            // ---------------------------------------------------
            if (interaction.isButton() && interaction.customId.startsWith("pn_id_open:")) {
                const [, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`pn_id_modal:${authorId}`)
                    .setTitle("🆔 User-ID eingeben");

                const textInput = new TextInputBuilder()
                    .setCustomId("pn_id_value")
                    .setLabel("Discord User-ID")
                    .setPlaceholder("z. B. 123456789012345678")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(17)
                    .setMaxLength(20)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(textInput));

                return interaction.showModal(modal);
            }

            // ---------------------------------------------------
            // 🆔 ID-Modal wurde abgeschickt -> User prüfen
            // ---------------------------------------------------
            if (interaction.isModalSubmit() && interaction.customId.startsWith("pn_id_modal:")) {
                const [, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                const rawId = interaction.fields.getTextInputValue("pn_id_value").trim();

                if (!DISCORD_ID_REGEX.test(rawId)) {
                    await interaction.deferUpdate();
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle("❌ Ungültige User-ID")
                                .setDescription(
                                    "Die eingegebene ID hat kein gültiges Format. Eine Discord User-ID besteht aus 17–20 Ziffern."
                                )
                        ],
                        components: [buildActionRow(authorId, getSession(authorId).mode)]
                    });
                }

                // WICHTIG: Hier NICHT vorher deferUpdate() aufrufen, da wir bei
                // Erfolg direkt showModal() als erste Antwort senden müssen.
                let targetMember;
                try {
                    targetMember = await interaction.guild.members.fetch(rawId);
                } catch (error) {
                    await interaction.deferUpdate();
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle("❌ Mitglied nicht gefunden")
                                .setDescription(
                                    `Es wurde kein Mitglied mit der ID \`${rawId}\` auf diesem Server gefunden.`
                                )
                        ],
                        components: [buildActionRow(authorId, getSession(authorId).mode)]
                    });
                }

                return interaction.showModal(buildMessageModal(authorId, targetMember.id));
            }

            // ---------------------------------------------------
            // 👤 Mitglied wurde im Select-Menu gewählt
            // ---------------------------------------------------
            if (
                interaction.isStringSelectMenu() &&
                interaction.customId.startsWith("pn_member_select:")
            ) {
                const [, authorId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                const targetUserId = interaction.values[0];
                return interaction.showModal(buildMessageModal(authorId, targetUserId));
            }

            // ---------------------------------------------------
            // ✍️ Nachrichten-Modal wurde abgeschickt -> DM versenden
            // ---------------------------------------------------
            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith("pn_modal:")
            ) {
                const [, authorId, targetUserId] = interaction.customId.split(":");

                if (!(await verifyAccess(interaction, authorId))) {
                    return;
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const nachricht = interaction.fields.getTextInputValue("pn_message_content");

                let targetMember;
                try {
                    targetMember = await interaction.guild.members.fetch(targetUserId);
                } catch (error) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle("❌ Nachricht konnte nicht gesendet werden")
                                .addFields(
                                    { name: "👤 Empfänger", value: `<@${targetUserId}>`, inline: false },
                                    { name: "Grund", value: "Das Mitglied konnte nicht mehr auf dem Server gefunden werden.", inline: false }
                                )
                        ]
                    });
                }

                const dmEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle("📩 Private Nachricht")
                    .setDescription(
                        `Du hast eine private Nachricht von **NoVex RP** erhalten, ${targetMember}.`
                    )
                    .addFields(
                        { name: "👤 Von", value: "Team / Administration", inline: false },
                        { name: "💬 Nachricht", value: nachricht, inline: false }
                    )
                    .setFooter({ text: "NoVex RP" })
                    .setTimestamp();

                try {
                    await targetMember.send({
                        content: `${targetMember}`,
                        embeds: [dmEmbed]
                    });

                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x57F287)
                                .setTitle("✅ Nachricht erfolgreich gesendet")
                                .addFields(
                                    { name: "👤 Empfänger", value: `<@${targetMember.id}>`, inline: false },
                                    { name: "📨 Status", value: "DM erfolgreich zugestellt", inline: false }
                                )
                        ]
                    });
                } catch (dmError) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle("❌ Nachricht konnte nicht gesendet werden")
                                .addFields(
                                    { name: "👤 Empfänger", value: `<@${targetMember.id}>`, inline: false },
                                    { name: "Grund", value: "Die DM konnte nicht zugestellt werden.", inline: false }
                                )
                        ]
                    });
                }
            }
        } catch (error) {
            console.error("❌ Fehler im Privatnachrichten-System (interactionCreate):", error);
            if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Das Privatnachrichten-Panel konnte nicht erstellt werden.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    });
}

module.exports = { initializePrivatnachrichtSystem };