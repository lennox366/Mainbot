
"use strict";

const {
    Events,
    EmbedBuilder,
    AuditLogEvent,
    PermissionFlagsBits
} = require("discord.js");

// =====================================================
// VEXO RP - DISCORD LOGGER
// Discord.js v14
// =====================================================

const CONFIG = {
    logChannelId: "1563981252565147880",
    footer: "Vexo RP • Discord Logging",
    queueDelay: 600,
    maxQueue: 500,
    auditMaxAge: 10000,

    colors: {
        success: 0x2ECC71,
        danger: 0xEB459E,
        warning: 0xF1C40F,
        info: 0x3498DB,
        purple: 0x9B59B6,
        voice: 0x5865F2,
        neutral: 0x95A5A6
    }
};

const registeredClients = new WeakSet();

function registerDiscordLogger(client) {
    if (!client || typeof client.on !== "function") {
        throw new Error(
            "[VEXO LOGGER] Ungültiger Discord-Client."
        );
    }

    if (registeredClients.has(client)) {
        return;
    }

    registeredClients.add(client);

    const queue = [];
    let processing = false;

    const wait = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    const limit = (value, max = 1024) => {
        const text = String(value ?? "Nicht verfügbar");

        return text.length > max
            ? text.slice(0, max - 1) + "…"
            : text;
    };

    const timestamp = date => {
        const ms = date instanceof Date
            ? date.getTime()
            : Number(date);

        if (!Number.isFinite(ms)) {
            return "Nicht verfügbar";
        }

        return `<t:${Math.floor(ms / 1000)}:F>`;
    };

    const userMention = user =>
        user?.id
            ? `<@${user.id}>`
            : "Unbekannt";

    const channelMention = channel =>
        channel?.id
            ? `<#${channel.id}>`
            : "Unbekannt";

    const roleMention = role =>
        role?.id
            ? `<@&${role.id}>`
            : "Unbekannt";

    const avatar = user => {
        try {
            return user?.displayAvatarURL?.({
                extension: "png",
                size: 256
            }) || null;
        } catch {
            return null;
        }
    };

    const field = (name, value, inline = false) => ({
        name: limit(name, 256),
        value: limit(value, 1024),
        inline
    });

    // =====================================================
    // EMBED DESIGN
    // =====================================================

    function makeEmbed({
        title,
        color = CONFIG.colors.info,
        description = null,
        user = null,
        fields = [],
        image = null
    }) {
        const embed = new EmbedBuilder()
            .setTitle(limit(title, 256))
            .setColor(color)
            .setTimestamp()
            .setFooter({
                text: CONFIG.footer
            });

        if (description) {
            embed.setDescription(
                limit(description, 4096)
            );
        }

        const userAvatar = avatar(user);

        if (userAvatar) {
            embed.setThumbnail(userAvatar);
        }

        if (image) {
            embed.setImage(image);
        }

        if (fields.length) {
            embed.addFields(
                fields.slice(0, 25).map(item => ({
                    name: limit(item.name, 256),
                    value: limit(item.value, 1024),
                    inline: Boolean(item.inline)
                }))
            );
        }

        return embed;
    }

    // =====================================================
    // WARTESCHLANGE
    // =====================================================

    function enqueue(guild, embed) {
        if (!guild?.id) return;

        if (queue.length >= CONFIG.maxQueue) {
            queue.shift();

            console.warn(
                "[VEXO LOGGER] Log-Warteschlange voll."
            );
        }

        queue.push({
            guildId: guild.id,
            embed
        });

        void processQueue();
    }

    async function processQueue() {
        if (processing) return;

        processing = true;

        try {
            while (queue.length > 0) {
                const item = queue.shift();

                try {
                    const guild =
                        client.guilds.cache.get(item.guildId);

                    if (!guild) continue;

                    const channel =
                        await guild.channels.fetch(
                            CONFIG.logChannelId
                        ).catch(() => null);

                    if (
                        !channel ||
                        typeof channel.send !== "function"
                    ) {
                        continue;
                    }

                    await channel.send({
                        embeds: [item.embed],
                        allowedMentions: {
                            parse: []
                        }
                    });
                } catch (error) {
                    console.error(
                        "[VEXO LOGGER] Log konnte nicht gesendet werden:",
                        error.message
                    );
                }

                await wait(CONFIG.queueDelay);
            }
        } finally {
            processing = false;
        }
    }

    function sendLog(guild, options) {
        if (!guild) return;

        try {
            enqueue(guild, makeEmbed(options));
        } catch (error) {
            console.error(
                "[VEXO LOGGER] Embed-Fehler:",
                error.message
            );
        }
    }

    // =====================================================
    // AUDIT LOGS
    // =====================================================

    async function getAudit(guild, type, targetId) {
        if (!guild || !type || !targetId) {
            return null;
        }

        try {
            const botMember =
                guild.members.me ||
                await guild.members.fetchMe();

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.ViewAuditLog
                )
            ) {
                return null;
            }

            const logs = await guild.fetchAuditLogs({
                type,
                limit: 8
            });

            const entry = logs.entries.find(entry => {
                const matchingTarget =
                    entry.target?.id === targetId;

                const recent =
                    Math.abs(
                        Date.now() - entry.createdTimestamp
                    ) <= CONFIG.auditMaxAge;

                return matchingTarget && recent;
            });

            if (!entry) return null;

            return {
                executor: entry.executor,
                reason: entry.reason || null
            };
        } catch {
            return null;
        }
    }

    function moderatorFields(auditData) {
        if (!auditData?.executor) {
            return [
                field(
                    "🛡️ Moderator",
                    "Nicht eindeutig ermittelbar"
                )
            ];
        }

        const fields = [
            field(
                "🛡️ Moderator",
                userMention(auditData.executor)
            )
        ];

        if (auditData.reason) {
            fields.push(
                field(
                    "📋 Grund",
                    auditData.reason
                )
            );
        }

        return fields;
    }

    // =====================================================
    // SICHERE EVENT-REGISTRIERUNG
    // =====================================================

    function on(event, callback) {
        client.on(event, (...args) => {
            Promise.resolve()
                .then(() => callback(...args))
                .catch(error => {
                    console.error(
                        `[VEXO LOGGER] Event-Fehler (${event}):`,
                        error
                    );
                });
        });
    }

    // =====================================================
    // NACHRICHTEN
    // =====================================================

    function messageText(message) {
        if (!message?.content) {
            return "Text nicht verfügbar";
        }

        return message.content;
    }

    function attachmentText(message) {
        if (!message?.attachments?.size) {
            return "Keine";
        }

        return [...message.attachments.values()]
            .slice(0, 8)
            .map(attachment =>
                attachment.name || "Unbenannte Datei"
            )
            .join("\n");
    }

    function splitText(text, maxLength = 1000) {
        const result = [];
        const content = String(text || "Kein Text");

        for (
            let index = 0;
            index < content.length;
            index += maxLength
        ) {
            result.push(
                content.slice(
                    index,
                    index + maxLength
                )
            );
        }

        return result.length
            ? result
            : ["Kein Text"];
    }

    on(Events.MessageCreate, message => {
        if (!message.guild) return;
        if (message.channelId === CONFIG.logChannelId) return;
        if (message.author?.bot) return;

        sendLog(message.guild, {
            title: "💬 Nachricht gesendet",
            color: CONFIG.colors.info,
            user: message.author,
            description:
                `**Kanal:** ${channelMention(message.channel)}\n` +
                `**Autor:** ${userMention(message.author)}\n` +
                `**Zeitpunkt:** ${timestamp(Date.now())}`,
            fields: [
                field(
                    "📝 Nachricht",
                    messageText(message)
                ),
                field(
                    "📎 Anhänge",
                    attachmentText(message)
                )
            ]
        });
    });

    on(Events.MessageDelete, message => {
        if (!message.guild) return;
        if (message.channelId === CONFIG.logChannelId) return;

        sendLog(message.guild, {
            title: "🗑️ Nachricht gelöscht",
            color: CONFIG.colors.danger,
            user: message.author,
            description:
                `**Kanal:** ${channelMention(message.channel)}\n` +
                `**Autor:** ${userMention(message.author)}\n` +
                `**Nachrichten-ID:** \`${message.id}\``,
            fields: [
                field(
                    "📄 Gelöschter Inhalt",
                    messageText(message)
                ),
                field(
                    "📎 Anhänge",
                    attachmentText(message)
                )
            ]
        });
    });

    on(Events.MessageUpdate, (oldMessage, newMessage) => {
        if (!newMessage.guild) return;
        if (newMessage.channelId === CONFIG.logChannelId) {
            return;
        }

        if (newMessage.author?.bot) return;

        const oldContent = oldMessage.content;
        const newContent = newMessage.content;

        if (
            oldContent === newContent &&
            oldMessage.attachments?.size ===
            newMessage.attachments?.size
        ) {
            return;
        }

        const before = splitText(
            messageText(oldMessage),
            950
        );

        const after = splitText(
            messageText(newMessage),
            950
        );

        const fields = [];

        before.slice(0, 5).forEach((part, index) => {
            fields.push(
                field(
                    index === 0
                        ? "🕘 Vorher"
                        : `🕘 Vorher (${index + 1})`,
                    part
                )
            );
        });

        after.slice(0, 5).forEach((part, index) => {
            fields.push(
                field(
                    index === 0
                        ? "💬 Nachher"
                        : `💬 Nachher (${index + 1})`,
                    part
                )
            );
        });

        sendLog(newMessage.guild, {
            title: "📝 Nachricht bearbeitet",
            color: CONFIG.colors.info,
            user:
                newMessage.author ||
                oldMessage.author,
            description:
                `**Kanal:** ${channelMention(newMessage.channel)}\n` +
                `**Autor:** ${userMention(newMessage.author)}\n` +
                `**Nachricht:** [Ansehen](${newMessage.url})`,
            fields
        });
    });

    on(Events.MessageBulkDelete, messages => {
        const first = messages.first();

        if (!first?.guild) return;
        if (first.channelId === CONFIG.logChannelId) {
            return;
        }

        sendLog(first.guild, {
            title: "🗑️ Mehrere Nachrichten gelöscht",
            color: CONFIG.colors.danger,
            description:
                `**Kanal:** ${channelMention(first.channel)}\n` +
                `**Anzahl:** ${messages.size}`,
            fields: [
                field(
                    "ℹ️ Hinweis",
                    "Einzelne Nachrichteninhalte sind " +
                    "nur verfügbar, wenn sie zuvor " +
                    "zwischengespeichert wurden."
                )
            ]
        });
    });

    // =====================================================
    // MITGLIEDER
    // =====================================================

    on(Events.GuildMemberAdd, member => {
        const accountAge = Math.floor(
            (Date.now() - member.user.createdTimestamp) /
            86400000
        );

        sendLog(member.guild, {
            title: "🟢 Mitglied beigetreten",
            color: CONFIG.colors.success,
            user: member.user,
            description:
                `**Mitglied:** ${userMention(member.user)}\n` +
                `**Account erstellt:** vor ${accountAge} Tagen\n` +
                `**Beigetreten:** ${timestamp(Date.now())}`,
            fields: [
                field(
                    "👤 Benutzer",
                    `${member.user.tag}\n` +
                    `\`${member.id}\``,
                    true
                ),
                field(
                    "📅 Account erstellt",
                    timestamp(
                        member.user.createdTimestamp
                    ),
                    true
                )
            ]
        });
    });

    on(Events.GuildMemberRemove, async member => {
        const auditData = await getAudit(
            member.guild,
            AuditLogEvent.MemberKick,
            member.id
        );

        const kicked = Boolean(auditData);

        sendLog(member.guild, {
            title: kicked
                ? "👢 Mitglied gekickt"
                : "🔴 Mitglied verlassen",
            color: kicked
                ? CONFIG.colors.danger
                : CONFIG.colors.warning,
            user: member.user,
            description:
                `**Mitglied:** ${userMention(member.user)}\n` +
                `**Zeitpunkt:** ${timestamp(Date.now())}`,
            fields: [
                field(
                    "👤 Benutzer",
                    `${member.user.tag}\n` +
                    `\`${member.id}\``
                ),
                ...(kicked
                    ? moderatorFields(auditData)
                    : [])
            ]
        });
    });

    on(Events.GuildBanAdd, async ban => {
        const auditData = await getAudit(
            ban.guild,
            AuditLogEvent.MemberBanAdd,
            ban.user.id
        );

        sendLog(ban.guild, {
            title: "🔨 Mitglied gebannt",
            color: CONFIG.colors.danger,
            user: ban.user,
            description:
                `**Mitglied:** ${userMention(ban.user)}\n` +
                `**Aktion:** Mitglied gebannt\n` +
                `**Zeitpunkt:** ${timestamp(Date.now())}`,
            fields: [
                field(
                    "👤 Benutzer",
                    `${ban.user.tag}\n` +
                    `\`${ban.user.id}\``
                ),
                ...moderatorFields(auditData)
            ]
        });
    });

    on(Events.GuildBanRemove, async ban => {
        const auditData = await getAudit(
            ban.guild,
            AuditLogEvent.MemberBanRemove,
            ban.user.id
        );

        sendLog(ban.guild, {
            title: "🟢 Mitglied entbannt",
            color: CONFIG.colors.success,
            user: ban.user,
            description:
                `**Mitglied:** ${userMention(ban.user)}\n` +
                `**Aktion:** Mitglied entbannt\n` +
                `**Zeitpunkt:** ${timestamp(Date.now())}`,
            fields: [
                field(
                    "👤 Benutzer",
                    `${ban.user.tag}\n` +
                    `\`${ban.user.id}\``
                ),
                ...moderatorFields(auditData)
            ]
        });
    });

    // =====================================================
    // ROLLEN, NICKNAME UND TIMEOUTS
    // =====================================================

    on(
        Events.GuildMemberUpdate,
        async (oldMember, newMember) => {
            const addedRoles =
                newMember.roles.cache.filter(
                    role =>
                        !oldMember.roles.cache.has(role.id)
                );

            const removedRoles =
                oldMember.roles.cache.filter(
                    role =>
                        !newMember.roles.cache.has(role.id)
                );

            if (
                addedRoles.size ||
                removedRoles.size
            ) {
                const auditData = await getAudit(
                    newMember.guild,
                    AuditLogEvent.MemberRoleUpdate,
                    newMember.id
                );

                sendLog(newMember.guild, {
                    title: "🟨 Mitgliedsrollen aktualisiert",
                    color: CONFIG.colors.warning,
                    user: newMember.user,
                    description:
                        `**Mitglied:** ${userMention(newMember.user)}\n` +
                        `**Zeitpunkt:** ${timestamp(Date.now())}`,
                    fields: [
                        field(
                            "➕ Hinzugefügt",
                            addedRoles.size
                                ? addedRoles.map(
                                    roleMention
                                ).join("\n")
                                : "Keine"
                        ),
                        field(
                            "➖ Entfernt",
                            removedRoles.size
                                ? removedRoles.map(
                                    roleMention
                                ).join("\n")
                                : "Keine"
                        ),
                        ...moderatorFields(auditData)
                    ]
                });
            }

            if (
                oldMember.nickname !==
                newMember.nickname
            ) {
                const auditData = await getAudit(
                    newMember.guild,
                    AuditLogEvent.MemberUpdate,
                    newMember.id
                );

                sendLog(newMember.guild, {
                    title: "✏️ Nickname geändert",
                    color: CONFIG.colors.warning,
                    user: newMember.user,
                    description:
                        `**Mitglied:** ${userMention(newMember.user)}`,
                    fields: [
                        field(
                            "Vorher",
                            oldMember.nickname ||
                            oldMember.user.username
                        ),
                        field(
                            "Nachher",
                            newMember.nickname ||
                            newMember.user.username
                        ),
                        ...moderatorFields(auditData)
                    ]
                });
            }

            const oldTimeout =
                oldMember.communicationDisabledUntilTimestamp ||
                null;

            const newTimeout =
                newMember.communicationDisabledUntilTimestamp ||
                null;

            if (oldTimeout !== newTimeout) {
                const auditData = await getAudit(
                    newMember.guild,
                    AuditLogEvent.MemberUpdate,
                    newMember.id
                );

                let title = "⏱️ Timeout verändert";

                if (!oldTimeout && newTimeout) {
                    title = "⏱️ Timeout vergeben";
                } else if (oldTimeout && !newTimeout) {
                    title = "✅ Timeout aufgehoben";
                }

                sendLog(newMember.guild, {
                    title,
                    color: CONFIG.colors.purple,
                    user: newMember.user,
                    description:
                        `**Mitglied:** ${userMention(newMember.user)}`,
                    fields: [
                        field(
                            "Vorher",
                            oldTimeout
                                ? timestamp(oldTimeout)
                                : "Keiner"
                        ),
                        field(
                            "Nachher",
                            newTimeout
                                ? timestamp(newTimeout)
                                : "Keiner"
                        ),
                        ...moderatorFields(auditData)
                    ]
                });
            }
        }
    );

    // =====================================================
    // VOICE LOGGING
    // =====================================================

    on(
        Events.VoiceStateUpdate,
        (oldState, newState) => {
            const member =
                newState.member ||
                oldState.member;

            const user = member?.user;
            const guild = newState.guild;

            if (
                oldState.channelId !==
                newState.channelId
            ) {
                let title = "🔊 Voice gewechselt";

                if (!oldState.channelId) {
                    title = "🔊 Voice betreten";
                } else if (!newState.channelId) {
                    title = "🔇 Voice verlassen";
                }

                sendLog(guild, {
                    title,
                    color: CONFIG.colors.voice,
                    user,
                    description:
                        `**Mitglied:** ${userMention(user)}\n` +
                        `**Von:** ${channelMention(oldState.channel)}\n` +
                        `**Nach:** ${channelMention(newState.channel)}\n` +
                        `**Zeitpunkt:** ${timestamp(Date.now())}`
                });
            }

            const voiceChanges = [
                [
                    "selfMute",
                    "🎙️ Mikrofon",
                    "Stummgeschaltet",
                    "Entstummt"
                ],
                [
                    "selfDeaf",
                    "🔇 Audio",
                    "Taubgeschaltet",
                    "Wieder hörend"
                ],
                [
                    "serverMute",
                    "🛡️ Server-Mute",
                    "Aktiviert",
                    "Deaktiviert"
                ],
                [
                    "serverDeaf",
                    "🛡️ Server-Deafen",
                    "Aktiviert",
                    "Deaktiviert"
                ],
                [
                    "streaming",
                    "🖥️ Bildschirmübertragung",
                    "Gestartet",
                    "Beendet"
                ],
                [
                    "selfVideo",
                    "📷 Kamera",
                    "Gestartet",
                    "Beendet"
                ]
            ];

            for (const [
                property,
                label,
                enabled,
                disabled
            ] of voiceChanges) {
                if (
                    oldState[property] ===
                    newState[property]
                ) {
                    continue;
                }

                sendLog(guild, {
                    title: label,
                    color: CONFIG.colors.voice,
                    user,
                    description:
                        `**Mitglied:** ${userMention(user)}\n` +
                        `**Kanal:** ${channelMention(
                            newState.channel ||
                            oldState.channel
                        )}`,
                    fields: [
                        field(
                            "Status",
                            newState[property]
                                ? enabled
                                : disabled
                        )
                    ]
                });
            }
        }
    );

    // =====================================================
    // KANÄLE
    // =====================================================

    on(Events.ChannelCreate, async channel => {
        if (!channel.guild) return;
        if (channel.id === CONFIG.logChannelId) return;

        const auditData = await getAudit(
            channel.guild,
            AuditLogEvent.ChannelCreate,
            channel.id
        );

        sendLog(channel.guild, {
            title: "🟢 Kanal erstellt",
            color: CONFIG.colors.success,
            description:
                `**Kanal:** ${channelMention(channel)}\n` +
                `**Typ:** ${channel.type}\n` +
                `**Zeitpunkt:** ${timestamp(Date.now())}`,
            fields: [
                field(
                    "📁 Kanal",
                    `${channel.name}\n\`${channel.id}\``
                ),
                ...moderatorFields(auditData)
            ]
        });
    });

    on(Events.ChannelDelete, async channel => {
        if (!channel.guild) return;
        if (channel.id === CONFIG.logChannelId) return;

        const auditData = await getAudit(
            channel.guild,
            AuditLogEvent.ChannelDelete,
            channel.id
        );

        sendLog(channel.guild, {
            title: "🔴 Kanal gelöscht",
            color: CONFIG.colors.danger,
            description:
                `**Kanal:** ${channel.name}\n` +
                `**Typ:** ${channel.type}\n` +
                `**Zeitpunkt:** ${timestamp(Date.now())}`,
            fields: [
                field("Kanal-ID", channel.id),
                ...moderatorFields(auditData)
            ]
        });
    });

    on(
        Events.ChannelUpdate,
        async (oldChannel, newChannel) => {
            if (!newChannel.guild) return;
            if (
                newChannel.id === CONFIG.logChannelId
            ) {
                return;
            }

            const changes = [];

            const properties = [
                ["name", "Name"],
                ["topic", "Thema"],
                ["nsfw", "NSFW"],
                ["rateLimitPerUser", "Slowmode"],
                ["parentId", "Kategorie"],
                ["bitrate", "Bitrate"],
                ["userLimit", "Benutzerlimit"]
            ];

            for (const [key, label] of properties) {
                if (
                    oldChannel[key] !==
                    newChannel[key]
                ) {
                    changes.push(
                        field(
                            label,
                            `${oldChannel[key] ?? "Keine"} → ` +
                            `${newChannel[key] ?? "Keine"}`
                        )
                    );
                }
            }

            const permissions = channel =>
                [...(
                    channel.permissionOverwrites
                        ?.cache?.values() || []
                )]
                    .map(overwrite =>
                        `${overwrite.id}:` +
                        `${overwrite.allow.bitfield}:` +
                        `${overwrite.deny.bitfield}`
                    )
                    .sort()
                    .join("|");

            if (
                permissions(oldChannel) !==
                permissions(newChannel)
            ) {
                changes.push(
                    field(
                        "🔐 Berechtigungen",
                        "Kanalberechtigungen verändert"
                    )
                );
            }

            if (!changes.length) return;

            const auditData = await getAudit(
                newChannel.guild,
                AuditLogEvent.ChannelUpdate,
                newChannel.id
            );

            sendLog(newChannel.guild, {
                title: "🟡 Kanal bearbeitet",
                color: CONFIG.colors.warning,
                description:
                    `**Kanal:** ${channelMention(newChannel)}`,
                fields: [
                    ...changes,
                    ...moderatorFields(auditData)
                ]
            });
        }
    );

    // =====================================================
    // ROLLEN
    // =====================================================

    on(Events.GuildRoleCreate, async role => {
        const auditData = await getAudit(
            role.guild,
            AuditLogEvent.RoleCreate,
            role.id
        );

        sendLog(role.guild, {
            title: "🟢 Rolle erstellt",
            color: CONFIG.colors.success,
            description:
                `**Rolle:** ${roleMention(role)}`,
            fields: [
                field("Rollen-ID", role.id),
                ...moderatorFields(auditData)
            ]
        });
    });

    on(Events.GuildRoleDelete, async role => {
        const auditData = await getAudit(
            role.guild,
            AuditLogEvent.RoleDelete,
            role.id
        );

        sendLog(role.guild, {
            title: "🔴 Rolle gelöscht",
            color: CONFIG.colors.danger,
            description:
                `**Rolle:** ${role.name}`,
            fields: [
                field("Rollen-ID", role.id),
                ...moderatorFields(auditData)
            ]
        });
    });

    on(
        Events.GuildRoleUpdate,
        async (oldRole, newRole) => {
            const changes = [];

            for (const property of [
                "name",
                "color",
                "hoist",
                "mentionable"
            ]) {
                if (
                    oldRole[property] !==
                    newRole[property]
                ) {
                    changes.push(
                        field(
                            property,
                            `${oldRole[property]} → ` +
                            `${newRole[property]}`
                        )
                    );
                }
            }

            if (
                oldRole.permissions.bitfield !==
                newRole.permissions.bitfield
            ) {
                changes.push(
                    field(
                        "🔐 Berechtigungen",
                        "Rollenberechtigungen geändert"
                    )
                );
            }

            if (!changes.length) return;

            const auditData = await getAudit(
                newRole.guild,
                AuditLogEvent.RoleUpdate,
                newRole.id
            );

            sendLog(newRole.guild, {
                title: "🟡 Rolle aktualisiert",
                color: CONFIG.colors.warning,
                description:
                    `**Rolle:** ${roleMention(newRole)}`,
                fields: [
                    ...changes,
                    ...moderatorFields(auditData)
                ]
            });
        }
    );

    // =====================================================
    // SERVER
    // =====================================================

    on(
        Events.GuildUpdate,
        (oldGuild, newGuild) => {
            const changes = [];

            for (const property of [
                "name",
                "description",
                "verificationLevel",
                "explicitContentFilter",
                "afkChannelId",
                "afkTimeout"
            ]) {
                if (
                    oldGuild[property] !==
                    newGuild[property]
                ) {
                    changes.push(
                        field(
                            property,
                            `${oldGuild[property] ?? "Keine"} → ` +
                            `${newGuild[property] ?? "Keine"}`
                        )
                    );
                }
            }

            if (!changes.length) return;

            sendLog(newGuild, {
                title: "⚙️ Server aktualisiert",
                color: CONFIG.colors.warning,
                fields: changes
            });
        }
    );

    // =====================================================
    // EINLADUNGEN
    // =====================================================

    on(Events.InviteCreate, invite => {
        sendLog(invite.guild, {
            title: "🔗 Einladung erstellt",
            color: CONFIG.colors.success,
            description:
                `**Code:** \`${invite.code}\`\n` +
                `**Kanal:** ${channelMention(invite.channel)}\n` +
                `**Ersteller:** ${userMention(invite.inviter)}`
        });
    });

    on(Events.InviteDelete, invite => {
        sendLog(invite.guild, {
            title: "🔗 Einladung gelöscht",
            color: CONFIG.colors.danger,
            description:
                `**Code:** \`${invite.code}\`\n` +
                `**Kanal:** ${channelMention(invite.channel)}`
        });
    });

    // =====================================================
    // WEBHOOKS
    // =====================================================

    on(Events.WebhooksUpdate, channel => {
        sendLog(channel.guild, {
            title: "🪝 Webhooks verändert",
            color: CONFIG.colors.purple,
            description:
                `**Kanal:** ${channelMention(channel)}\n` +
                `**Hinweis:** Discord liefert bei diesem ` +
                `Event keine genaue Änderung.`
        });
    });

    // =====================================================
    // EMOJIS UND STICKER
    // =====================================================

    const assetEvents = [
        [
            Events.GuildEmojiCreate,
            "🟢 Emoji erstellt",
            CONFIG.colors.success
        ],
        [
            Events.GuildEmojiDelete,
            "🔴 Emoji gelöscht",
            CONFIG.colors.danger
        ],
        [
            Events.GuildEmojiUpdate,
            "🟡 Emoji geändert",
            CONFIG.colors.warning
        ],
        [
            Events.GuildStickerCreate,
            "🟢 Sticker erstellt",
            CONFIG.colors.success
        ],
        [
            Events.GuildStickerDelete,
            "🔴 Sticker gelöscht",
            CONFIG.colors.danger
        ],
        [
            Events.GuildStickerUpdate,
            "🟡 Sticker geändert",
            CONFIG.colors.warning
        ]
    ];

    for (const [
        event,
        title,
        color
    ] of assetEvents) {
        on(event, (...args) => {
            const asset = args[args.length - 1];

            if (!asset?.guild) return;

            sendLog(asset.guild, {
                title,
                color,
                description:
                    `**Name:** ${asset.name}\n` +
                    `**ID:** \`${asset.id}\``
            });
        });
    }

    // =====================================================
    // THREADS
    // =====================================================

    on(
        Events.ThreadCreate,
        (thread, newlyCreated) => {
            if (!newlyCreated) return;

            sendLog(thread.guild, {
                title: "🟢 Thread erstellt",
                color: CONFIG.colors.success,
                description:
                    `**Thread:** ${channelMention(thread)}\n` +
                    `**Elternkanal:** <#${thread.parentId}>`
            });
        }
    );

    on(Events.ThreadDelete, thread => {
        sendLog(thread.guild, {
            title: "🔴 Thread gelöscht",
            color: CONFIG.colors.danger,
            description:
                `**Thread:** ${thread.name}\n` +
                `**ID:** \`${thread.id}\``
        });
    });

    on(
        Events.ThreadUpdate,
        (oldThread, newThread) => {
            if (
                oldThread.name === newThread.name &&
                oldThread.archived === newThread.archived &&
                oldThread.locked === newThread.locked
            ) {
                return;
            }

            sendLog(newThread.guild, {
                title: "🟡 Thread aktualisiert",
                color: CONFIG.colors.warning,
                description:
                    `**Thread:** ${channelMention(newThread)}`,
                fields: [
                    field(
                        "Name",
                        `${oldThread.name} → ${newThread.name}`
                    ),
                    field(
                        "Archiviert",
                        `${oldThread.archived} → ` +
                        `${newThread.archived}`
                    ),
                    field(
                        "Gesperrt",
                        `${oldThread.locked} → ` +
                        `${newThread.locked}`
                    )
                ]
            });
        }
    );

    // =====================================================
    // REAKTIONEN
    // =====================================================

    on(
        Events.MessageReactionAdd,
        (reaction, user) => {
            if (!reaction.message.guild) return;
            if (
                reaction.message.channelId ===
                CONFIG.logChannelId
            ) {
                return;
            }

            if (user.bot) return;

            sendLog(reaction.message.guild, {
                title: "➕ Reaktion hinzugefügt",
                color: CONFIG.colors.success,
                user,
                description:
                    `**Benutzer:** ${userMention(user)}\n` +
                    `**Kanal:** ${channelMention(
                        reaction.message.channel
                    )}\n` +
                    `**Emoji:** ${reaction.emoji.name || reaction.emoji.id}`
            });
        }
    );

    on(
        Events.MessageReactionRemove,
        (reaction, user) => {
            if (!reaction.message.guild) return;
            if (
                reaction.message.channelId ===
                CONFIG.logChannelId
            ) {
                return;
            }

            if (user.bot) return;

            sendLog(reaction.message.guild, {
                title: "➖ Reaktion entfernt",
                color: CONFIG.colors.danger,
                user,
                description:
                    `**Benutzer:** ${userMention(user)}\n` +
                    `**Kanal:** ${channelMention(
                        reaction.message.channel
                    )}\n` +
                    `**Emoji:** ${reaction.emoji.name || reaction.emoji.id}`
            });
        }
    );

    // =====================================================
    // GEPLANTE EVENTS
    // =====================================================

    on(
        Events.GuildScheduledEventCreate,
        event => {
            sendLog(event.guild, {
                title: "🟢 Event erstellt",
                color: CONFIG.colors.success,
                description:
                    `**Event:** ${event.name}\n` +
                    `**ID:** \`${event.id}\``
            });
        }
    );

    on(
        Events.GuildScheduledEventDelete,
        event => {
            sendLog(event.guild, {
                title: "🔴 Event gelöscht",
                color: CONFIG.colors.danger,
                description:
                    `**Event:** ${event.name}\n` +
                    `**ID:** \`${event.id}\``
            });
        }
    );

    on(
        Events.GuildScheduledEventUpdate,
        (oldEvent, newEvent) => {
            sendLog(newEvent.guild, {
                title: "🟡 Event aktualisiert",
                color: CONFIG.colors.warning,
                description:
                    `**Event:** ${newEvent.name}\n` +
                    `**Status:** ${oldEvent.status} → ` +
                    `${newEvent.status}`
            });
        }
    );

    console.log(
        "[VEXO LOGGER] Discord-Logging erfolgreich registriert."
    );
}

module.exports = {
    registerDiscordLogger
};