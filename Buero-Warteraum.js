
"use strict";

// =====================================================
// 🏢 NoVex RP | BÜRO-WARTERAUM-SYSTEM
// Discord.js v14
//
// Bürger betritt Warteraum
// -> Rollen werden angepingt
// -> Mitarbeiter übernimmt
// -> Bürger wird zum Mitarbeiter verschoben
// -> Mitarbeiter schließt den Fall
// -> Bürger wird aus dem Sprachkanal getrennt
// =====================================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionsBitField
} = require("discord.js");

// =====================================================
// KONFIGURATION
// =====================================================

const BUERO_VOICE_ID = "1559659273678622735";
const BUERO_TEXT_ID = "1559659273678622734";

const BUERO_ROLE_IDS = [
    "1559659267299217467",  // Eventleitung
    "1559659267307339839",  // Fraktionsverwaltung
    "1559659267307339843",  // Ausbilder
    "1559659267324256366",  // Teamleitung
    "1559659267349553265",  // Management
    "1559659267349553272",  // Direktor
    "1559659267378778221",  // Projektleitung
    "1559659267395428539",  // Development
    "1559659267408134198",  // Owner/Co-Owner
    "1561728076231086243",  // Founder/In
];

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || "";

const EXTRA_OWNER_IDS = (
    process.env.VEXO_BUERO_EXTRA_OWNERS || ""
)
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);

// =====================================================
// SPEICHER
// =====================================================

// Aktive Fälle pro Server und Bürger
const cases = new Map();

// Verhindert doppelte Event-Registrierung
const registeredClients = new WeakSet();

function caseKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

// =====================================================
// BERECHTIGUNGEN
// =====================================================

function isBueroOwner(member) {
    if (!member) return false;

    if (member.guild.ownerId === member.id) {
        return true;
    }

    if (BOT_OWNER_ID && member.id === BOT_OWNER_ID) {
        return true;
    }

    if (EXTRA_OWNER_IDS.includes(member.id)) {
        return true;
    }

    return false;
}

function canTakeBueroCase(member) {
    if (!member) return false;

    if (isBueroOwner(member)) {
        return true;
    }

    return BUERO_ROLE_IDS.some(roleId =>
        member.roles.cache.has(roleId)
    );
}

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function secondsBetween(start, end = Date.now()) {
    return Math.max(
        0,
        Math.floor((end - start) / 1000)
    );
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds} Sek.`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
        return `${minutes} Min. ${remainingSeconds} Sek.`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours} Std. ${remainingMinutes} Min.`;
}

function getRolePings() {
    return BUERO_ROLE_IDS
        .map(id => `<@&${id}>`)
        .join(" ");
}

async function getBueroTextChannel(guild) {
    const channel = await guild.channels
        .fetch(BUERO_TEXT_ID)
        .catch(() => null);

    if (!channel || !channel.isTextBased()) {
        return null;
    }

    if (typeof channel.send !== "function") {
        return null;
    }

    return channel;
}

async function getCaseMessage(guild, data) {
    if (!data.messageId) return null;

    const channel = await getBueroTextChannel(guild);

    if (!channel?.messages) return null;

    return channel.messages
        .fetch(data.messageId)
        .catch(() => null);
}

async function replyPrivate(interaction, content) {
    if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
            content
        });
    }

    return interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
    });
}

// =====================================================
// EMBED
// =====================================================

function buildBueroEmbed(data, status = "waiting") {
    const isClaimed = Boolean(data.claimedBy);

    let color = 0xF1C40F;
    let title = "🏢 VEXO RP • BÜRO";
    let statusText = "🟡 **NEUER BÜRO-FALL**";

    if (status === "claimed") {
        color = 0x2ECC71;
        statusText = "🟢 **BÜRO-FALL ÜBERNOMMEN**";
    }

    if (status === "closed") {
        color = 0x95A5A6;
        title = "🏢 VEXO RP • BÜRO-FALL GESCHLOSSEN";
        statusText = "🔒 **BÜRO-FALL ABGESCHLOSSEN**";
    }

    if (status === "left") {
        color = 0xE67E22;
        title = "🏢 VEXO RP • BÜRO-FALL BEENDET";
        statusText = "⚪ **BÜRGER HAT DEN WARTERAUM VERLASSEN**";
    }

    const waitSeconds = secondsBetween(
        data.createdAt,
        data.claimedAt || Date.now()
    );

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(
            "━━━━━━━━━━━━━━━━━━━━\n" +
            statusText +
            "\n━━━━━━━━━━━━━━━━━━━━"
        )
        .addFields(
            {
                name: "👤 Bürger",
                value: `<@${data.userId}>`,
                inline: false
            },
            {
                name: "🛠️ Büro-Mitarbeiter",
                value: isClaimed
                    ? `<@${data.claimedBy}>`
                    : "Noch nicht übernommen",
                inline: false
            },
            {
                name: "⏳ Wartezeit",
                value: isClaimed
                    ? formatDuration(waitSeconds)
                    : `<t:${Math.floor(data.createdAt / 1000)}:R>`,
                inline: false
            },
            {
                name: "🔊 Warteraum",
                value: `<#${BUERO_VOICE_ID}>`,
                inline: false
            }
        )
        .setFooter({
            text: "Vexo RP • Büro-Service"
        })
        .setTimestamp();

    if (data.staffVoiceId) {
        embed.addFields({
            name: "📞 Büro-Gespräch",
            value: `<#${data.staffVoiceId}>`,
            inline: false
        });
    }

    if (status === "closed" && data.closedBy) {
        embed.addFields({
            name: "🔒 Geschlossen von",
            value: `<@${data.closedBy}>`,
            inline: false
        });
    }

    return embed;
}

// =====================================================
// BUTTONS
// =====================================================

function buildButtons(data, status = "waiting") {
    let button;

    if (status === "waiting") {
        button = new ButtonBuilder()
            .setCustomId(
                `vexo_buero_claim:${data.userId}`
            )
            .setLabel("Übernehmen")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success);
    } else if (status === "claimed") {
        button = new ButtonBuilder()
            .setCustomId(
                `vexo_buero_close:${data.userId}`
            )
            .setLabel("Schließen")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger);
    } else {
        button = new ButtonBuilder()
            .setCustomId(
                `vexo_buero_done:${data.userId}`
            )
            .setLabel("Geschlossen")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
    }

    return [
        new ActionRowBuilder().addComponents(button)
    ];
}

// =====================================================
// BÜRO-FALL ERSTELLEN
// =====================================================

async function createBueroCase(member) {
    if (!member?.guild || member.user?.bot) {
        return;
    }

    const guild = member.guild;
    const key = caseKey(guild.id, member.id);

    if (cases.has(key)) {
        return;
    }

    const data = {
        guildId: guild.id,
        userId: member.id,
        createdAt: Date.now(),
        claimedBy: null,
        claimedAt: null,
        staffVoiceId: null,
        messageId: null,
        processing: true,
        status: "waiting"
    };

    // Sofort reservieren, damit kein zweiter Fall entsteht.
    cases.set(key, data);

    try {
        const channel = await getBueroTextChannel(guild);

        if (!channel) {
            throw new Error(
                "Büro-Ping-Textkanal nicht gefunden."
            );
        }

        // Falls der Bürger inzwischen gegangen ist,
        // keinen veralteten Fall mehr senden.
        const currentMember = await guild.members
            .fetch(member.id)
            .catch(() => null);

        if (
            !currentMember ||
            currentMember.voice.channelId !== BUERO_VOICE_ID
        ) {
            cases.delete(key);
            return;
        }

        const message = await channel.send({
            content:
                "🟢 **Büro-Team | Neuer Büro-Fall wartet!**\n" +
                getRolePings(),
            embeds: [
                buildBueroEmbed(data, "waiting")
            ],
            components: buildButtons(data, "waiting"),
            allowedMentions: {
                roles: BUERO_ROLE_IDS,
                users: [],
                parse: []
            }
        });

        data.messageId = message.id;
        data.processing = false;

        console.log(
            `[BÜRO] Neuer Fall für ${member.user.username}`
        );

        // Falls der Bürger während des Sendens
        // den Warteraum verlassen hat.
        const afterSend = await guild.members
            .fetch(member.id)
            .catch(() => null);

        if (
            !afterSend ||
            afterSend.voice.channelId !== BUERO_VOICE_ID
        ) {
            await finishBueroCase(
                guild,
                member.id,
                "left"
            );
        }

    } catch (error) {
        cases.delete(key);

        console.error(
            "[BÜRO] Nachricht konnte nicht gesendet werden:",
            error
        );
    }
}

// =====================================================
// FALL ALS BEENDET MARKIEREN
// =====================================================

async function finishBueroCase(
    guild,
    userId,
    status = "left"
) {
    const key = caseKey(guild.id, userId);
    const data = cases.get(key);

    if (!data) return;

    // Ein übernommener Fall darf nicht beim
    // Verschieben aus dem Warteraum beendet werden.
    if (status === "left" && data.status === "claimed") {
        return;
    }

    // Während einer Übernahme nicht schließen.
    if (status === "left" && data.processing) {
        return;
    }

    cases.delete(key);
    data.status = status;

    try {
        const message = await getCaseMessage(guild, data);

        if (!message) return;

        await message.edit({
            content:
                status === "closed"
                    ? "🔒 **Büro-Fall wurde geschlossen.**"
                    : "⚪ **Der Bürger hat den Warteraum verlassen.**",
            embeds: [
                buildBueroEmbed(data, status)
            ],
            components: buildButtons(data, "closed"),
            allowedMentions: {
                parse: []
            }
        });

    } catch (error) {
        console.error(
            "[BÜRO] Fehler beim Beenden:",
            error
        );
    }
}

// =====================================================
// BÜRO-FALL ÜBERNEHMEN
// =====================================================

async function claimBueroCase(interaction, data, member) {
    if (data.processing) {
        return replyPrivate(
            interaction,
            "⏳ Dieser Büro-Fall wird gerade bearbeitet."
        );
    }

    if (data.status !== "waiting" || data.claimedBy) {
        return replyPrivate(
            interaction,
            "❌ Dieser Büro-Fall wurde bereits übernommen."
        );
    }

    // Aktuellen Voice-Status des Mitarbeiters laden.
    const staff = await interaction.guild.members
        .fetch(member.id)
        .catch(() => null);

    const staffVoiceId = staff?.voice.channelId;

    if (!staffVoiceId) {
        return replyPrivate(
            interaction,
            "❌ Du musst zuerst in einem Sprachkanal sein."
        );
    }

    if (staffVoiceId === BUERO_VOICE_ID) {
        return replyPrivate(
            interaction,
            "❌ Du musst in einem anderen Sprachkanal " +
            "als dem Büro-Warteraum sein."
        );
    }

    const citizen = await interaction.guild.members
        .fetch(data.userId)
        .catch(() => null);

    if (
        !citizen ||
        citizen.voice.channelId !== BUERO_VOICE_ID
    ) {
        return replyPrivate(
            interaction,
            "❌ Der Bürger ist nicht mehr im Büro-Warteraum."
        );
    }

    const botMember = await interaction.guild.members
        .fetchMe()
        .catch(() => null);

    if (
        !botMember?.permissions.has(
            PermissionsBitField.Flags.MoveMembers
        )
    ) {
        return replyPrivate(
            interaction,
            "❌ Dem Bot fehlt die Berechtigung " +
            "**Mitglieder verschieben**."
        );
    }

    data.processing = true;

    try {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        // Bürger in den Sprachkanal des Mitarbeiters.
        await citizen.voice.setChannel(
            staffVoiceId,
            `Büro-Fall übernommen von ${interaction.user.username}`
        );

        data.claimedBy = interaction.user.id;
        data.claimedAt = Date.now();
        data.staffVoiceId = staffVoiceId;
        data.status = "claimed";

        // Übernehmen -> Schließen
        await interaction.message.edit({
            content: "🟢 **Büro-Fall wurde übernommen.**",
            embeds: [
                buildBueroEmbed(data, "claimed")
            ],
            components: buildButtons(data, "claimed"),
            allowedMentions: {
                parse: []
            }
        });

        await interaction.editReply({
            content:
                "✅ **Büro-Fall übernommen!**\n\n" +
                "Der Bürger wurde in deinen Sprachkanal verschoben.\n" +
                "Wenn das Gespräch beendet ist, " +
                "klicke auf **Schließen**."
        });

        console.log(
            `[BÜRO] Fall ${data.userId} übernommen von ` +
            interaction.user.username
        );

    } catch (error) {
        console.error(
            "[BÜRO] Übernahme fehlgeschlagen:",
            error
        );

        // Falls das Verschieben bereits erfolgreich war,
        // die Übernahme nicht fälschlich zurücksetzen.
        if (!data.claimedBy) {
            data.status = "waiting";
        }

        await interaction.editReply({
            content: data.claimedBy
                ? "⚠️ Der Bürger wurde verschoben, aber " +
                  "die Büro-Nachricht konnte nicht " +
                  "vollständig aktualisiert werden."
                : "❌ Der Bürger konnte nicht verschoben werden. " +
                  "Prüfe die Voice-Berechtigungen des Bots."
        }).catch(() => {});

    } finally {
        data.processing = false;
    }
}

// =====================================================
// BÜRO-FALL SCHLIESSEN
// =====================================================

async function closeClaimedBueroCase(
    interaction,
    data,
    member
) {
    if (data.processing) {
        return replyPrivate(
            interaction,
            "⏳ Dieser Büro-Fall wird gerade bearbeitet."
        );
    }

    if (data.status !== "claimed" || !data.claimedBy) {
        return replyPrivate(
            interaction,
            "❌ Dieser Büro-Fall ist nicht übernommen."
        );
    }

    // Nur zuständiger Mitarbeiter oder Owner.
    if (
        data.claimedBy !== interaction.user.id &&
        !isBueroOwner(member)
    ) {
        return replyPrivate(
            interaction,
            "❌ Nur der zuständige Büro-Mitarbeiter " +
            "oder ein Owner darf diesen Fall schließen."
        );
    }

    data.processing = true;

    try {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        const citizen = await interaction.guild.members
            .fetch(data.userId)
            .catch(() => null);

        let disconnected = false;

        // Sicherheitsregel:
        // Nur trennen, wenn der Bürger noch im
        // ursprünglich zugewiesenen Büro-Kanal ist.
        if (
            citizen?.voice.channelId &&
            citizen.voice.channelId === data.staffVoiceId
        ) {
            await citizen.voice.disconnect(
                `Büro-Fall geschlossen von ${interaction.user.username}`
            );

            disconnected = true;
        }

        data.closedBy = interaction.user.id;
        data.status = "closed";

        await interaction.message.edit({
            content: "🔒 **Büro-Fall wurde geschlossen.**",
            embeds: [
                buildBueroEmbed(data, "closed")
            ],
            components: buildButtons(data, "closed"),
            allowedMentions: {
                parse: []
            }
        });

        cases.delete(
            caseKey(data.guildId, data.userId)
        );

        await interaction.editReply({
            content: disconnected
                ? "✅ **Büro-Fall geschlossen!**\n" +
                  "Der Bürger wurde aus dem Sprachkanal getrennt."
                : "✅ **Büro-Fall geschlossen!**\n" +
                  "Der Bürger war nicht mehr im zugewiesenen " +
                  "Büro-Sprachkanal und wurde deshalb " +
                  "nicht getrennt."
        });

        console.log(
            `[BÜRO] Fall ${data.userId} geschlossen von ` +
            interaction.user.username
        );

    } catch (error) {
        console.error(
            "[BÜRO] Schließen fehlgeschlagen:",
            error
        );

        await interaction.editReply({
            content:
                "❌ Beim Schließen ist ein Fehler aufgetreten.\n" +
                "Prüfe die Bot-Berechtigungen und versuche es erneut."
        }).catch(() => {});

    } finally {
        data.processing = false;
    }
}

// =====================================================
// BUTTON-INTERAKTIONEN
// =====================================================

async function handleBueroInteraction(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    const isClaim = customId.startsWith(
        "vexo_buero_claim:"
    );

    const isClose = customId.startsWith(
        "vexo_buero_close:"
    );

    if (!isClaim && !isClose) {
        return;
    }

    if (
        !interaction.guild ||
        interaction.channelId !== BUERO_TEXT_ID
    ) {
        return replyPrivate(
            interaction,
            "❌ Dieser Button ist hier nicht verfügbar."
        );
    }

    const userId = customId.split(":")[1];

    if (!/^\d{17,20}$/.test(userId || "")) {
        return replyPrivate(
            interaction,
            "❌ Ungültiger Büro-Fall."
        );
    }

    const member = await interaction.guild.members
        .fetch(interaction.user.id)
        .catch(() => null);

    if (!canTakeBueroCase(member)) {
        return replyPrivate(
            interaction,
            "❌ Du hast keine Berechtigung, " +
            "Büro-Fälle zu bearbeiten."
        );
    }

    const data = cases.get(
        caseKey(interaction.guild.id, userId)
    );

    if (
        !data ||
        data.messageId !== interaction.message.id
    ) {
        return replyPrivate(
            interaction,
            "❌ Dieser Büro-Fall ist nicht mehr aktiv."
        );
    }

    if (isClaim) {
        await claimBueroCase(
            interaction,
            data,
            member
        );
        return;
    }

    if (isClose) {
        await closeClaimedBueroCase(
            interaction,
            data,
            member
        );
    }
}

// =====================================================
// VOICE-EVENTS
// =====================================================

async function handleBueroVoiceUpdate(
    oldState,
    newState
) {
    const entered =
        oldState.channelId !== BUERO_VOICE_ID &&
        newState.channelId === BUERO_VOICE_ID;

    const left =
        oldState.channelId === BUERO_VOICE_ID &&
        newState.channelId !== BUERO_VOICE_ID;

    if (entered) {
        const member = newState.member ||
            await newState.guild.members
                .fetch(newState.id)
                .catch(() => null);

        if (member && !member.user.bot) {
            await createBueroCase(member);
        }
    }

    if (left) {
        const key = caseKey(
            oldState.guild.id,
            oldState.id
        );

        const data = cases.get(key);

        if (!data) return;

        // Bei der Übernahme wird der Bürger
        // automatisch aus dem Warteraum verschoben.
        // Dies darf den Fall NICHT beenden.
        if (
            data.processing ||
            data.status === "claimed"
        ) {
            return;
        }

        await finishBueroCase(
            oldState.guild,
            oldState.id,
            "left"
        );
    }
}

// =====================================================
// SYSTEM INITIALISIEREN
// =====================================================

function initializeBueroWarteraum(client) {
    if (registeredClients.has(client)) {
        console.log(
            "[BÜRO] System wurde bereits registriert."
        );
        return;
    }

    registeredClients.add(client);

    client.on(
        "voiceStateUpdate",
        (oldState, newState) => {
            handleBueroVoiceUpdate(
                oldState,
                newState
            ).catch(error => {
                console.error(
                    "[BÜRO] Voice-Event-Fehler:",
                    error
                );
            });
        }
    );

    client.on("interactionCreate", interaction => {
        handleBueroInteraction(interaction).catch(
            async error => {
                console.error(
                    "[BÜRO] Button-Fehler:",
                    error
                );

                if (
                    interaction.isButton() &&
                    interaction.customId.startsWith(
                        "vexo_buero_"
                    )
                ) {
                    await replyPrivate(
                        interaction,
                        "❌ Beim Bearbeiten des Büro-Falls " +
                        "ist ein Fehler aufgetreten."
                    ).catch(() => {});
                }
            }
        );
    });

    console.log(
        "🏢 Vexo RP Büro-Warteraum-System aktiviert."
    );
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    initializeBueroWarteraum
};
