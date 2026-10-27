
"use strict";

const {
    SlashCommandBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "vorlagen-daten");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Discord-ID des Bot-Owners
const BOT_OWNER_IDS = [
    "1322191083303731201"
];

// Verhindert doppelte Registrierung
const initializedClients = new WeakSet();

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function isAllowed(interaction) {
    if (BOT_OWNER_IDS.includes(interaction.user.id)) {
        return true;
    }

    return (
        interaction.guild &&
        interaction.user.id === interaction.guild.ownerId
    );
}

function getPendingFile(guildId) {
    return path.join(
        DATA_DIR,
        `pending-${guildId}.json`
    );
}

function getBackupFile(guildId) {
    return path.join(
        DATA_DIR,
        `backup-${guildId}.json`
    );
}

function getChannelTypeName(type) {
    const names = {
        [ChannelType.GuildCategory]: "Kategorie",
        [ChannelType.GuildText]: "Textkanal",
        [ChannelType.GuildVoice]: "Sprachkanal",
        [ChannelType.GuildStageVoice]: "Stage-Kanal",
        [ChannelType.GuildForum]: "Forum",
        [ChannelType.GuildAnnouncement]: "Ankündigung",
        [ChannelType.GuildMedia]: "Medienkanal"
    };

    return names[type] || `Typ ${type}`;
}

function sortChannels(a, b) {
    const aCategory =
        a.type === ChannelType.GuildCategory;

    const bCategory =
        b.type === ChannelType.GuildCategory;

    if (aCategory && !bCategory) return -1;
    if (!aCategory && bCategory) return 1;

    return a.rawPosition - b.rawPosition;
}

async function getServerChannels(guild) {
    const channels = await guild.channels.fetch();

    return [...channels.values()]
        .filter(channel => channel && channel.name)
        .sort(sortChannels)
        .map(channel => ({
            id: channel.id,
            type: getChannelTypeName(channel.type),
            parentId: channel.parentId || null,
            position: channel.rawPosition,
            oldName: channel.name,
            newName: channel.name
        }));
}

function validateTemplate(data, guildId) {
    if (
        !data ||
        typeof data !== "object" ||
        !Array.isArray(data.channels)
    ) {
        throw new Error(
            "Ungültige Vorlage: channels fehlt."
        );
    }

    if (data.guildId !== guildId) {
        throw new Error(
            "Diese Vorlage gehört zu einem anderen Server."
        );
    }

    if (data.channels.length > 500) {
        throw new Error(
            "Zu viele Einträge in der Vorlage."
        );
    }

    const ids = new Set();

    for (const channel of data.channels) {
        if (
            !channel ||
            typeof channel.id !== "string" ||
            !/^\d{17,20}$/.test(channel.id)
        ) {
            throw new Error(
                "Ungültige Kanal-ID gefunden."
            );
        }

        if (ids.has(channel.id)) {
            throw new Error(
                "Eine Kanal-ID kommt mehrfach vor."
            );
        }

        ids.add(channel.id);

        if (
            typeof channel.newName !== "string" ||
            !channel.newName.trim() ||
            channel.newName.length > 100
        ) {
            throw new Error(
                `Ungültiger neuer Name bei ${channel.id}.`
            );
        }
    }
}

async function safeReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(options);
        }

        return await interaction.reply({
            ...options,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error(
            "[VORLAGE] Antwort fehlgeschlagen:",
            error
        );
        return null;
    }
}

// =====================================================
// SLASH COMMAND
// =====================================================

const command = new SlashCommandBuilder()
    .setName("vorlage")
    .setDescription(
        "Discord-Kanalstruktur exportieren und umbenennen"
    )
    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageChannels
    )

    .addSubcommand(sub =>
        sub.setName("export")
            .setDescription(
                "Alle Serverkanäle als JSON exportieren"
            )
    )

    .addSubcommand(sub =>
        sub.setName("import")
            .setDescription(
                "Bearbeitete JSON-Vorlage hochladen"
            )
            .addAttachmentOption(option =>
                option.setName("datei")
                    .setDescription(
                        "Bearbeitete JSON-Datei"
                    )
                    .setRequired(true)
            )
    )

    .addSubcommand(sub =>
        sub.setName("vorschau")
            .setDescription(
                "Geplante Umbenennungen anzeigen"
            )
    )

    .addSubcommand(sub =>
        sub.setName("anwenden")
            .setDescription(
                "Importierte Vorlage anwenden"
            )
            .addStringOption(option =>
                option.setName("bestaetigung")
                    .setDescription(
                        "Zum Bestätigen ANWENDEN eingeben"
                    )
                    .setRequired(true)
            )
    )

    .addSubcommand(sub =>
        sub.setName("backup")
            .setDescription(
                "Letzte Sicherung herunterladen"
            )
    );

// =====================================================
// BEFEHL AUSFÜHREN
// =====================================================

async function handleVorlage(interaction) {
    if (
        !interaction.isChatInputCommand() ||
        interaction.commandName !== "vorlage"
    ) {
        return false;
    }

    // Die Interaktion möglichst sofort bestätigen.
    // Damit vermeiden wir das 3-Sekunden-Timeout.
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error(
            "[VORLAGE] deferReply fehlgeschlagen:",
            error
        );

        // Bei Unknown Interaction (10062) ist
        // diese Interaktion nicht mehr verwendbar.
        return true;
    }

    try {
        if (!interaction.guild) {
            await safeReply(interaction, {
                content:
                    "❌ Dieser Befehl funktioniert " +
                    "nur auf einem Discord-Server."
            });

            return true;
        }

        if (!isAllowed(interaction)) {
            await safeReply(interaction, {
                content:
                    "🔒 Nur der Serverbesitzer oder " +
                    "Bot-Owner darf diesen Befehl verwenden."
            });

            return true;
        }

        const guild = interaction.guild;
        const sub = interaction.options.getSubcommand();

        // =============================================
        // EXPORT
        // =============================================

        if (sub === "export") {
            const channels =
                await getServerChannels(guild);

            const template = {
                version: 1,
                guildId: guild.id,
                guildName: guild.name,
                exportedAt: new Date().toISOString(),
                channels
            };

            const buffer = Buffer.from(
                JSON.stringify(template, null, 2),
                "utf8"
            );

            const file = new AttachmentBuilder(buffer, {
                name: "vexo-server-vorlage.json"
            });

            await safeReply(interaction, {
                content:
                    "📦 **Servervorlage exportiert!**\n\n" +
                    `🏠 Server: **${guild.name}**\n` +
                    `📂 Kanäle und Kategorien: **${channels.length}**\n\n` +
                    "Lade die Datei herunter und " +
                    "bearbeite die `newName`-Werte.",
                files: [file]
            });

            return true;
        }

        // =============================================
        // IMPORT
        // =============================================

        if (sub === "import") {
            const attachment =
                interaction.options.getAttachment("datei");

            if (
                !attachment ||
                !attachment.name.toLowerCase().endsWith(".json")
            ) {
                throw new Error(
                    "Bitte eine JSON-Datei hochladen."
                );
            }

            if (attachment.size > 1024 * 1024) {
                throw new Error(
                    "Die Datei darf maximal 1 MB groß sein."
                );
            }

            const response = await fetch(attachment.url);

            if (!response.ok) {
                throw new Error(
                    "Die Datei konnte nicht geladen werden."
                );
            }

            const text = await response.text();
            const template = JSON.parse(text);

            validateTemplate(template, guild.id);

            const currentChannels =
                await getServerChannels(guild);

            const currentMap = new Map(
                currentChannels.map(channel => [
                    channel.id,
                    channel
                ])
            );

            const changes = [];

            for (const item of template.channels) {
                const current = currentMap.get(item.id);

                if (!current) continue;

                if (current.oldName !== item.newName) {
                    changes.push({
                        id: item.id,
                        oldName: current.oldName,
                        newName: item.newName
                    });
                }
            }

            const pending = {
                guildId: guild.id,
                importedBy: interaction.user.id,
                importedAt: Date.now(),
                changes
            };

            fs.writeFileSync(
                getPendingFile(guild.id),
                JSON.stringify(pending, null, 2),
                "utf8"
            );

            await safeReply(interaction, {
                content:
                    "✅ **Vorlage importiert!**\n\n" +
                    `📝 Geplante Umbenennungen: **${changes.length}**\n\n` +
                    "Benutze jetzt `/vorlage vorschau`, " +
                    "um die Änderungen zu prüfen.\n\n" +
                    "Es wurde noch kein Kanal geändert."
            });

            return true;
        }

        // =============================================
        // VORSCHAU
        // =============================================

        if (sub === "vorschau") {
            const file = getPendingFile(guild.id);

            if (!fs.existsSync(file)) {
                throw new Error(
                    "Keine Vorlage importiert. " +
                    "Benutze zuerst /vorlage import."
                );
            }

            const pending = JSON.parse(
                fs.readFileSync(file, "utf8")
            );

            const lines = pending.changes
                .slice(0, 15)
                .map(change =>
                    `**${change.oldName}**\n` +
                    `↳ ${change.newName}`
                );

            const embed = new EmbedBuilder()
                .setColor(0x8052FF)
                .setTitle(
                    "💫 NoVex RP • Vorlagen-Vorschau"
                )
                .setDescription(
                    lines.join("\n\n") ||
                    "Keine Änderungen vorhanden."
                )
                .addFields({
                    name: "Geplante Änderungen",
                    value: String(pending.changes.length),
                    inline: true
                })
                .setFooter({
                    text:
                        "Es wurde noch nichts verändert."
                });

            await safeReply(interaction, {
                embeds: [embed],
                content:
                    pending.changes.length > 15
                        ? "Es werden die ersten 15 Änderungen angezeigt."
                        : ""
            });

            return true;
        }

        // =============================================
        // ANWENDEN
        // =============================================

        if (sub === "anwenden") {
            const confirmation =
                interaction.options.getString(
                    "bestaetigung"
                );

            if (confirmation !== "ANWENDEN") {
                throw new Error(
                    "Bitte exakt ANWENDEN eingeben."
                );
            }

            const pendingFile =
                getPendingFile(guild.id);

            if (!fs.existsSync(pendingFile)) {
                throw new Error(
                    "Keine Vorlage importiert."
                );
            }

            const pending = JSON.parse(
                fs.readFileSync(pendingFile, "utf8")
            );

            if (
                pending.importedBy !== interaction.user.id
            ) {
                throw new Error(
                    "Nur die Person, die die Vorlage " +
                    "importiert hat, darf sie anwenden."
                );
            }

            // Backup vor jeder Änderung
            const before =
                await getServerChannels(guild);

            fs.writeFileSync(
                getBackupFile(guild.id),
                JSON.stringify({
                    guildId: guild.id,
                    createdAt: new Date().toISOString(),
                    channels: before
                }, null, 2),
                "utf8"
            );

            let success = 0;
            let failed = 0;
            const errors = [];

            for (const change of pending.changes) {
                try {
                    const channel =
                        await guild.channels.fetch(
                            change.id
                        );

                    if (!channel) {
                        failed++;
                        errors.push(
                            `${change.id}: Kanal nicht gefunden`
                        );
                        continue;
                    }

                    // Ausschließlich den Namen ändern.
                    // IDs, Positionen, Kategorien,
                    // Berechtigungen und Inhalte bleiben.
                    await channel.setName(
                        change.newName,
                        "NoVex RP Vorlagen-System"
                    );

                    success++;

                } catch (error) {
                    failed++;

                    errors.push(
                        `${change.id}: ${error.message}`
                    );
                }
            }

            if (failed === 0) {
                fs.unlinkSync(pendingFile);
            }

            await safeReply(interaction, {
                content:
                    "💫 **Vorlage verarbeitet!**\n\n" +
                    `✅ Erfolgreich: **${success}**\n` +
                    `❌ Fehlgeschlagen: **${failed}**\n\n` +
                    "📦 Eine Sicherung der vorherigen " +
                    "Kanalnamen wurde erstellt." +
                    (
                        errors.length
                            ? "\n\n**Fehler:**\n" +
                              errors.slice(0, 5).join("\n")
                            : ""
                    )
            });

            return true;
        }

        // =============================================
        // BACKUP
        // =============================================

        if (sub === "backup") {
            const file = getBackupFile(guild.id);

            if (!fs.existsSync(file)) {
                throw new Error(
                    "Noch keine Sicherung vorhanden."
                );
            }

            await safeReply(interaction, {
                content:
                    "📦 Hier ist die letzte Sicherung " +
                    "deiner Kanalnamen.",
                files: [
                    new AttachmentBuilder(file, {
                        name: "vexo-kanal-backup.json"
                    })
                ]
            });

            return true;
        }

        await safeReply(interaction, {
            content:
                `❌ Unbekannter Unterbefehl: ${sub}`
        });

        return true;

    } catch (error) {
        console.error(
            "[VORLAGE] Fehler:",
            error
        );

        await safeReply(interaction, {
            content:
                "❌ **Fehler:** " + error.message
        });

        return true;
    }
}

// =====================================================
// INITIALISIERUNG
// =====================================================

function initializeVorlagenSystem(client) {
    if (initializedClients.has(client)) {
        console.warn(
            "[VORLAGE] System wurde bereits registriert."
        );
        return;
    }

    initializedClients.add(client);

    client.on("interactionCreate", async interaction => {
        try {
            await handleVorlage(interaction);
        } catch (error) {
            console.error(
                "[VORLAGE] Unbehandelter Fehler:",
                error
            );
        }
    });

    console.log(
        "💫 NoVex RP Vorlagen-System geladen."
    );
}

module.exports = {
    command,
    initializeVorlagenSystem,
    handleVorlage
};
