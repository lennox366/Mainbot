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
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const TEAM_ROLES_CONFIG = path.join(__dirname, "..", "team-roles-config.json");

let teamRolesConfig = null;

function loadTeamRolesConfig() {
    try {
        if (fs.existsSync(TEAM_ROLES_CONFIG)) {
            teamRolesConfig = JSON.parse(fs.readFileSync(TEAM_ROLES_CONFIG, "utf8"));
            console.log("✅ Team-Rollen-Konfiguration geladen.");
        } else {
            console.error("❌ Team-Rollen-Konfiguration nicht gefunden:", TEAM_ROLES_CONFIG);
        }
    } catch (error) {
        console.error("❌ Fehler beim Laden der Team-Rollen-Konfiguration:", error);
    }
}

function getAllRoles() {
    if (!teamRolesConfig) return [];
    const allRoles = [];
    for (const category of teamRolesConfig.roleHierarchy) {
        for (const role of category.roles) {
            if (!role.name.includes("━")) {
                allRoles.push(role);
            }
        }
    }
    return allRoles.sort((a, b) => a.position - b.position);
}

function findRoleById(roleId) {
    if (!teamRolesConfig) return null;
    for (const category of teamRolesConfig.roleHierarchy) {
        for (const role of category.roles) {
            if (role.id === roleId) return role;
        }
    }
    return null;
}

function findRoleByName(name) {
    if (!teamRolesConfig) return null;
    const allRoles = getAllRoles();
    return allRoles.find(role => role.name.toLowerCase().includes(name.toLowerCase()));
}

function isStaff(member) {
    if (!teamRolesConfig) return false;
    return member.roles.cache.has(teamRolesConfig.staffRoleId);
}

function canManageTeam(member) {
    if (!member) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;

    const authorizedRoleName = /founder|owner|developer|projektleitung|teamleitung|admin/i;
    return (teamRolesConfig?.roleHierarchy || []).some(category =>
        (category.roles || []).some(role =>
            !role.name.includes("━") &&
            authorizedRoleName.test(role.name || "") &&
            member.roles.cache.has(role.id)
        )
    );
}

// =====================================================
// ROLLE ÄNDERN
// =====================================================

async function applyRoleChange(interaction, member, newRole, action) {
    try {
        const guild = interaction.guild;
        const botMember = guild.members.me || await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            throw new Error("Dem Bot fehlt die Berechtigung „Rollen verwalten“.");
        }

        const assignableRole = await guild.roles.fetch(newRole.id).catch(() => null);
        if (!assignableRole || !findRoleById(assignableRole.id) || assignableRole.name.includes("━")) {
            throw new Error("Die ausgewählte Rolle ist keine gültige Teamrolle.");
        }

        const teamRolesToRemove = getAllRoles()
            .filter(role =>
                role.id !== "1559659267257270313" &&
                role.id !== assignableRole.id &&
                member.roles.cache.has(role.id)
            )
            .map(role => guild.roles.cache.get(role.id))
            .filter(Boolean);
        const managedRoles = [...teamRolesToRemove, assignableRole];
        const blockedRole = managedRoles.find(role =>
            botMember.roles.highest.position <= role.position
        );
        if (blockedRole) {
            throw new Error(`Die Teamrolle „${blockedRole.name}“ steht auf oder über der höchsten Bot-Rolle.`);
        }

        const alreadyHadRole = member.roles.cache.has(assignableRole.id);
        if (!alreadyHadRole) {
            await member.roles.add(assignableRole, `Team ${action}: Neue Rolle hinzugefügt`);
        }
        try {
            if (teamRolesToRemove.length > 0) {
                await member.roles.remove(teamRolesToRemove, `Team ${action}: Alte Teamrollen entfernt`);
            }
        } catch (error) {
            if (!alreadyHadRole) {
                await member.roles.remove(assignableRole, "Rangänderung fehlgeschlagen; Änderung zurückgerollt").catch(rollbackError =>
                    console.error("❌ Neue Teamrolle konnte nach fehlgeschlagener Rangänderung nicht zurückgerollt werden:", rollbackError)
                );
            }
            throw error;
        }

        const actionText = action === "uprank" ? "befördert" : "degradiert";

        await interaction.update({
            content: `✅ ${member.user.tag} wurde erfolgreich ${actionText} zu **${assignableRole.name}**!`,
            embeds: [],
            components: []
        });

        console.log(`✅ ${member.user.tag} wurde ${actionText} zu ${assignableRole.name}`);
    } catch (error) {
        console.error("❌ Fehler beim Ändern der Rolle:", error);
        await interaction.update({
            content: `❌ Ein Fehler ist beim Ändern der Rolle aufgetreten: ${error.message}`,
            embeds: [],
            components: []
        });
    }
}

// =====================================================
// TEAMLISTE ERSTELLEN
// =====================================================

async function createTeamListEmbed(guild) {
    try {
        await guild.members.fetch();
        const staffRoleId = teamRolesConfig?.staffRoleId;

        const teamMemberIds = new Set();
        const onlineMemberIds = new Set();
        const offlineMemberIds = new Set();

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("NoVex RP • TEAMLISTE")
            .setDescription("Alle Teammitglieder und ihre Rollen")
            .setFooter({ text: "NoVex RP" })
            .setTimestamp();

        for (const category of teamRolesConfig.roleHierarchy) {
            const categoryMembers = [];

            for (const role of category.roles.filter(item => !item.name.includes("━"))) {
                const members = guild.members.cache.filter(m => m.roles.cache.has(role.id));
                const memberList = members.map(m => {
                    teamMemberIds.add(m.id);
                    const status = m.presence?.status;
                    if (status === "online" || status === "idle" || status === "dnd") {
                        onlineMemberIds.add(m.id);
                    } else {
                        offlineMemberIds.add(m.id);
                    }
                    return `<@${m.id}>`;
                }).join("\n") || "— Keine Mitglieder —";

                categoryMembers.push(`**${role.name}** [${members.size}]\n${memberList}`);
            }

            embed.addFields({
                name: category.category,
                value: categoryMembers.join("\n\n") || "— Keine Rollen konfiguriert —",
                inline: false
            });
        }

        // Statistik
        const staffMembersCount = guild.members.cache.filter(m => m.roles.cache.has(staffRoleId)).size;
        const totalMembers = teamMemberIds.size;
        const onlineCount = onlineMemberIds.size;
        const offlineCount = Math.max(0, totalMembers - onlineCount);

        embed.addFields(
            { name: "📊 Statistik", value: `**Gesamt:** ${totalMembers}\n**Staff:** ${staffMembersCount}\n**Online:** ${onlineCount}\n**Offline:** ${offlineCount}`, inline: false },
            { name: "🕐 Letztes Update", value: new Date().toLocaleString("de-DE"), inline: false }
        );

        return embed;
    } catch (error) {
        console.error("❌ Fehler beim Erstellen der Teamliste:", error);
        return new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("❌ Fehler")
            .setDescription("Die Teamliste konnte nicht geladen werden.");
    }
}

// =====================================================
// TEAM-PANEL ERSTELLEN
// =====================================================

function createTeamPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("VEXO RP • TEAMVERWALTUNG")
        .setDescription("Verwalte Teammitglieder, Ränge und Warnungen")
        .addFields(
            { name: "📋 Teammitglied verwalten", value: "Uprank, Downrank, Warnen oder Kicken", inline: false },
            { name: "👥 Teamliste anzeigen", value: "Zeigt alle Teammitglieder", inline: false }
        )
        .setFooter({ text: "Vexo RP Team System" })
        .setTimestamp();
}

function createTeamPanelButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("legacy_team_member_manage")
            .setLabel("👤 Teammitglied verwalten")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("legacy_team_list_show")
            .setLabel("📋 Teamliste")
            .setStyle(ButtonStyle.Secondary)
    );
}

// =====================================================
// TEAMMITGLIED AUSWÄHLEN
// =====================================================

function createMemberSelectEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("TEAMMITGLIED AUSWÄHLEN")
        .setDescription("Wähle das Teammitglied aus, das du verwalten möchtest.\n\nDu kannst nach dem Namen suchen.")
        .setFooter({ text: "Vexo RP Team System" });
}

function createMemberSelectMenu() {
    return new UserSelectMenuBuilder()
        .setCustomId("legacy_team_member_select")
        .setPlaceholder("Teammitglied auswählen...")
        .setMinValues(1)
        .setMaxValues(1);
}

// =====================================================
// TEAMMITGLIED MANAGEMENT PANEL
// =====================================================

function createMemberManageEmbed(member) {
    const currentRole = getAllRoles().find(role => member.roles.cache.has(role.id));
    const roleName = currentRole ? currentRole.name : "Keine Teamrolle";

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("TEAMMITGLIED VERWALTEN")
        .setDescription(`Verwalte **${member.user.tag}**`)
        .addFields(
            { name: "👤 Mitglied", value: `<@${member.id}>`, inline: true },
            { name: "🎭 Aktuelle Rolle", value: roleName, inline: true }
        )
        .setFooter({ text: "Vexo RP Team System" })
        .setTimestamp();
}

function createMemberManageButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("legacy_team_uprank")
            .setLabel("⬆️ Uprank")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("legacy_team_downrank")
            .setLabel("⬇️ Downrank")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("legacy_team_warn_reset")
            .setLabel("🔄 Warn zurücksetzen")
            .setStyle(ButtonStyle.Secondary)
    );
}

// =====================================================
// UPRANK / DOWNRANK MODAL
// =====================================================

function createRoleSelectModal(action, member) {
    const modal = new ModalBuilder()
        .setCustomId(`legacy_team_${action}_modal`)
        .setTitle(`${action.toUpperCase()} - Rolle auswählen`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("role_search")
                    .setLabel("Rolle suchen (Name oder leer lassen für Dropdown)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("z.B. Administrator")
                    .setRequired(false)
            )
        );

    return modal;
}

// =====================================================
// ROLLE AUSWÄHLEN DROPDOWN
// =====================================================

function createRoleSelectEmbed(action, member) {
    const actionText = action === "uprank" ? "Befördern" : "Degradieren";
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`TEAM ${action.toUpperCase()}`)
        .setDescription(`Wähle die neue Rolle für **${member.user.tag}**`)
        .addFields(
            { name: "👤 Mitglied", value: `<@${member.id}>`, inline: true },
            { name: "🎭 Neue Rolle", value: "Wähle aus der Liste oder suche", inline: true }
        )
        .setFooter({ text: "Vexo RP Team System" })
        .setTimestamp();
}

function createRoleSelectMenu() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("legacy_team_role_select")
        .setPlaceholder("Teamrolle auswählen...")
        .setMinValues(1)
        .setMaxValues(1);

    const allRoles = getAllRoles();
    for (const role of allRoles) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(role.name)
                .setValue(role.id)
                .setDescription(`Position ${role.position}`)
        );
    }

    return menu;
}

// =====================================================
// INITIALIZE
// =====================================================

function initializeTeamManagement(client) {
    loadTeamRolesConfig();

    // MessageCreate Handler für !teampanel und !teamliste
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith("!")) return;

        const args = message.content.slice(1).split(" ");
        const command = args[0]?.toLowerCase();

        if (command === "teampanel") {
            if (!canManageTeam(message.member)) {
                return message.reply("❌ Nur Teamleitungen und Administratoren dürfen die Teamverwaltung öffnen.");
            }
            return message.reply("Die Teamverwaltung läuft über das Slash-Panel `/teampanel`.");
        }

        if (command === "teamliste") {
            if (!canManageTeam(message.member)) {
                return message.reply("❌ Nur Teamleitungen und Administratoren dürfen die Teamliste öffnen.");
            }
            try {
                await message.channel.send({ content: "⏳ Teamliste wird geladen..." });
                const listEmbed = await createTeamListEmbed(message.guild);
                await message.channel.send({ embeds: [listEmbed] });
            } catch (error) {
                console.error("❌ Fehler beim Erstellen der Teamliste:", error);
            }
        }
    });

    // InteractionCreate Handler für Buttons und Selects
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;
        if (!interaction.customId?.startsWith("legacy_team_")) return;

        if (!canManageTeam(interaction.member)) {
            return interaction.reply({
                content: "❌ Nur Teamleitungen und Administratoren dürfen Teamaktionen ausführen.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.customId !== "legacy_team_list_show") {
            return interaction.reply({
                content: "Dieses alte Team-Panel ist deaktiviert. Bitte verwende `/teampanel`.",
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const listEmbed = await createTeamListEmbed(interaction.guild);
            await interaction.editReply({ embeds: [listEmbed] });
        } catch (error) {
            console.error("❌ Fehler im Team-Management:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `❌ Teamliste konnte nicht geladen werden: ${error.message}`, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: `❌ Teamliste konnte nicht geladen werden: ${error.message}`, embeds: [] }).catch(editError =>
                    console.error("❌ Fehler beim Anzeigen des Teamlisten-Fehlers:", editError)
                );
            }
        }
    });

    console.log("✅ Team-Management-System wurde initialisiert.");
}

module.exports = {
    initializeTeamManagement,
    loadTeamRolesConfig,
    createTeamPanelEmbed,
    createTeamPanelButtons,
    createMemberSelectEmbed,
    createMemberSelectMenu,
    createMemberManageEmbed,
    createMemberManageButtons,
    createRoleSelectModal,
    createRoleSelectEmbed,
    createRoleSelectMenu,
    createTeamListEmbed
};
