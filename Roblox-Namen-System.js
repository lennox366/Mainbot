'use strict';
// NoVex RP | Discord.js v14 | Node.js 18+
// In index.js: const { registerRobloxSystem, robloxCommands } = require('./Roblox-Namen-System');
// Vor client.login(...): registerRobloxSystem(client);
// Slash-Definitionen robloxCommands zu deiner vorhandenen Slash-Registrierung hinzufügen.

const fs = require('node:fs');
const path = require('node:path');
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags, PermissionFlagsBits
} = require('discord.js');

const DB_FILE = path.join(__dirname, 'roblox-namen.json');
const PANEL_BUTTON = 'Novex_roblox_register';
const MODAL_ID = 'Novex_roblox_register_modal';
const INPUT_ID = 'Novex_roblox_username';
const LIMIT = 20;
const TIMEOUT = 12000;

const robloxCommands = [
  new SlashCommandBuilder().setName('roblox-panel')
    .setDescription('Erstellt das Roblox-Namen-Eintragungs-Panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('roblox-namen-liste')
    .setDescription('Erstellt die automatisch aktualisierte Roblox-Namen-Liste')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return { guilds: {} };
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return db && typeof db.guilds === 'object' && db.guilds ? db : { guilds: {} };
  } catch (error) {
    console.error('[ROBLOX] Datenbank konnte nicht gelesen werden:', error);
    throw new Error('Roblox-Datenbank ist nicht lesbar.');
  }
}
function saveDb(db) {
  const temp = DB_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temp, DB_FILE);
}
function guildData(db, guildId) {
  return db.guilds[guildId] ||= { users: {}, listChannelId: null, listMessageId: null };
}
function escapeText(value) {
  return String(value ?? '').replace(/([\\*_~`|>])/g, '\\$1').replace(/@/g, '@\u200b').slice(0, 150);
}
function listEmbed(guild) {
  const db = readDb();
  const data = guildData(db, guild.id);
  const entries = Object.entries(data.users || {}).sort((a, b) =>
    (a[1].discordName || '').localeCompare(b[1].discordName || '', 'de'));
  const blocks = entries.map(([discordId, user]) =>
    `**${escapeText(user.discordName || 'Mitglied')}**\n` +
    `Roblox-Anzeigename: ${escapeText(user.displayName)}\n` +
    `Roblox-Username: @${escapeText(user.username)}\n` +
    `Roblox-ID: \`${user.robloxId}\`\n` +
    `Discord: <@${discordId}>`);
  let description = entries.length ? '' : 'Noch niemand hat einen Roblox-Namen eingetragen.';
  let shown = 0;
  for (const block of blocks) {
    if (description.length + block.length + 2 > 3900) break;
    description += (description ? '\n\n' : '') + block;
    shown++;
  }
  if (shown < entries.length) description += `\n\n… und ${entries.length - shown} weitere Einträge.`;
  return new EmbedBuilder().setColor(0x5865F2)
    .setTitle('🎮 Novex RP | Roblox-Namen-Liste')
    .setDescription(description)
    .setFooter({ text: `${entries.length} registrierte Mitglieder • Automatische Aktualisierung` })
    .setTimestamp();
}
async function updateList(guild) {
  const db = readDb();
  const data = guildData(db, guild.id);
  if (!data.listChannelId || !data.listMessageId) return;
  try {
    const channel = await guild.channels.fetch(data.listChannelId);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(data.listMessageId);
    await message.edit({ embeds: [listEmbed(guild)], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('[ROBLOX] Liste konnte nicht aktualisiert werden:', error.message);
  }
}
async function robloxLookup(username) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Roblox API HTTP ${response.status}`);
    const result = await response.json();
    const user = result?.data?.[0];
    if (!user?.id) return null;
    // Das Detail-Endpunkt liefert den aktuellen Display Name und Username.
    const detailResponse = await fetch(`https://users.roblox.com/v1/users/${user.id}`, { signal: controller.signal });
    if (!detailResponse.ok) throw new Error(`Roblox Details HTTP ${detailResponse.status}`);
    const detail = await detailResponse.json();
    return { robloxId: String(detail.id), username: detail.name, displayName: detail.displayName };
  } finally {
    clearTimeout(timeout);
  }
}
function registerRobloxSystem(client) {
  if (client.__NovexRobloxSystemRegistered) return;
  client.__NovexRobloxSystemRegistered = true;
  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isChatInputCommand() && ['roblox-panel', 'roblox-namen-liste'].includes(interaction.commandName)) {
        if (!interaction.inGuild() || !interaction.guild) {
          return interaction.reply({ content: '❌ Nur auf einem Discord-Server möglich.', flags: MessageFlags.Ephemeral });
        }
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: '❌ Du benötigst „Server verwalten“.', flags: MessageFlags.Ephemeral });
        }
        if (interaction.commandName === 'roblox-panel') {
          const embed = new EmbedBuilder().setColor(0x00A2FF)
            .setTitle('🎮 NovexRP | Roblox-Namen eintragen')
            .setDescription('Klicke auf den Button und gib **deinen Roblox-Username** ein. Anzeigename und Roblox-ID werden automatisch über Roblox gesucht.');
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(PANEL_BUTTON).setLabel('Roblox-Namen eintragen')
              .setEmoji('🎮').setStyle(ButtonStyle.Primary));
          await interaction.reply({ content: '✅ Roblox-Panel wird erstellt.', flags: MessageFlags.Ephemeral });
          await interaction.channel.send({ embeds: [embed], components: [row] });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const msg = await interaction.channel.send({ embeds: [listEmbed(interaction.guild)], allowedMentions: { parse: [] } });
        const db = readDb();
        const data = guildData(db, interaction.guildId);
        data.listChannelId = msg.channel.id;
        data.listMessageId = msg.id;
        saveDb(db);
        return interaction.editReply('✅ Roblox-Liste erstellt. Sie aktualisiert sich bei neuen Einträgen automatisch.');
      }
      if (interaction.isButton() && interaction.customId === PANEL_BUTTON) {
        if (!interaction.inGuild()) return;
        const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('Roblox-Namen eintragen');
        const field = new TextInputBuilder().setCustomId(INPUT_ID).setLabel('Dein Roblox-Username (ohne @)')
          .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(3).setMaxLength(20)
          .setPlaceholder('z. B. Lennox123');
        modal.addComponents(new ActionRowBuilder().addComponents(field));
        return interaction.showModal(modal);
      }
      if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
        if (!interaction.inGuild() || !interaction.guild) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const username = interaction.fields.getTextInputValue(INPUT_ID).trim().replace(/^@/, '');
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
          return interaction.editReply('❌ Bitte gib einen gültigen Roblox-Username ein (3–20 Zeichen, Buchstaben, Zahlen, _).');
        }
        const roblox = await robloxLookup(username);
        if (!roblox) return interaction.editReply('❌ Roblox-Nutzer nicht gefunden. Prüfe deinen **Username**, nicht den Anzeigenamen.');
        const db = readDb();
        const data = guildData(db, interaction.guildId);
        data.users[interaction.user.id] = {
          ...roblox,
          discordName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
          updatedAt: new Date().toISOString()
        };
        saveDb(db);
        await updateList(interaction.guild);
        return interaction.editReply(`✅ Eingetragen!\n**Roblox-Anzeigename:** ${escapeText(roblox.displayName)}\n**Username:** @${escapeText(roblox.username)}\n**Roblox-ID:** \`${roblox.robloxId}\``);
      }
    } catch (error) {
      console.error('[ROBLOX] Fehler:', error);
      if (!interaction.isRepliable()) return;
      const content = '❌ Roblox-System: Ein Fehler ist aufgetreten. Bitte später erneut versuchen.';
      if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
}
module.exports = { registerRobloxSystem, robloxCommands };
