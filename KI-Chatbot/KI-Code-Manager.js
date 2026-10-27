
'use strict';
// NoVex RP – KI-Code-Manager (Discord.js v14)
// Erst Vorschlag, dann "Okay, mach das", Button und privates Passwort.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder
} = require('discord.js');

const ROOT = path.resolve(__dirname, '..');
const sessions = new Map();
const MAX_AGE = 15 * 60 * 1000;
const MAX_FILE_BYTES = 850000;
const MAX_CHANGES = 4;
const MAX_RETRIES = 4;
const MAX_CONTEXT = 45000;
const MAX_NEW = 90000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const owner = () => process.env.KI_CODE_OWNER_ID;
const ignore = /(?:^|\/)(?:node_modules|\.git|\.env|\.ki-code-backups|backups|logs)(?:\/|$)/i;
const sensitive = /(?:cookie|token|secret|credential|password|lock|private|\.pem$|\.key$)/i;

function resolveTarget(name, allowNew = false) {
  if (typeof name !== 'string' || !name || name.length > 180 ||
      path.isAbsolute(name) || path.win32.isAbsolute(name) || name.includes('\\') ||
      name.split('/').some(p => !p || p === '.' || p === '..') ||
      !/\.(js|json)$/i.test(name) || ignore.test(name) || sensitive.test(name)) {
    throw Error('Dateipfad nicht erlaubt: ' + String(name).slice(0, 120));
  }
  const target = path.resolve(ROOT, name);
  if (!target.startsWith(ROOT + path.sep)) throw Error('Pfad außerhalb des Projekts');
  let current = ROOT;
  for (const part of name.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw Error('Symlinks nicht erlaubt');
    }
  }
  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw Error('Datei zu groß oder ungültig');
  } else if (!allowNew) {
    throw Error('Datei existiert nicht: ' + name);
  }
  return target;
}

function passwordOK(value) {
  const [salt, hex] = (process.env.KI_CODE_PASSWORD_HASH || '').split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(hex || '')) return false;
  const expected = Buffer.from(hex, 'hex');
  return crypto.timingSafeEqual(crypto.scryptSync(value, salt, 64), expected);
}

function check(file, code) {
  if (file.endsWith('.json')) {
    try { JSON.parse(code); } catch (e) { throw Error('JSON-Prüfung: ' + e.message); }
    return;
  }
  const temp = path.join(os.tmpdir(), 'vexo-check-' + crypto.randomUUID() + '.js');
  try {
    fs.writeFileSync(temp, code, { flag: 'wx' });
    const result = spawnSync(process.execPath, ['--check', temp], {
      encoding: 'utf8', timeout: 12000, windowsHide: true
    });
    if (result.error || result.status !== 0) {
      throw Error('Syntaxprüfung: ' + String(result.error?.message || result.stderr || 'Fehler').slice(0, 650));
    }
  } finally { try { fs.unlinkSync(temp); } catch {} }
}

function extract(raw) {
  if (typeof raw !== 'string') {
    if (typeof raw?.content === 'string') raw = raw.content;
    else if (typeof raw?.text === 'string') raw = raw.text;
    else throw Error('KI-Antwort ist kein Text');
  }
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw Error('KI hat kein JSON geliefert');
  const result = JSON.parse(raw.slice(start, end + 1));
  if (!result || !Array.isArray(result.changes)) throw Error('Ungültiges JSON-Format');
  return result;
}

function getSession(id) {
  const now = Date.now();
  for (const [key, session] of sessions) if (session.expires < now) sessions.delete(key);
  let session = sessions.get(id);
  if (!session) session = { history: [], expires: now + MAX_AGE };
  return session;
}
function keep(id, session) {
  session.expires = Date.now() + MAX_AGE;
  sessions.set(id, session);
}
function isApproval(text) {
  return /^(?:okay|ok|ja|bestätige|freigeben|mach das|bau(?:e)? (?:es|das) ein|installier(?:e)? (?:es|das)|übernimm(?: das)?)[.! ]*$/i.test(text.trim());
}
function isCancel(text) {
  return /^(?:abbrechen|verwerfen|stopp|stop|doch nicht)[.! ]*$/i.test(text.trim());
}
// Nur ausdrueckliche Projektaktionen werden vom Dateimanager abgefangen.
// Allgemeine Coding-Wuensche laufen ueber KI-Chat-Technik und erzeugen Code im Chat.
function isNoWriteIntent(text) {
  return /(?:nicht|nichts|noch nichts|keine|ohne)\s+(?:bearbeit|aender|änder|einbau|einbauen|installier|speicher|veränder)/i.test(text) ||
    /(?:bearbeite|ändere|aendere|baue|installiere)\s+(?:bitte\s+)?(?:noch\s+)?nicht/i.test(text) ||
    /(?:erst|zuerst|zunächst)\s+(?:nur\s+)?(?:lesen|prüfen|ansehen|zeigen)/i.test(text) ||
    /(?:nur|erstmal|zunächst)\s+(?:den\s+)?code\s+(?:zeigen|schreiben|erstellen|sehen)/i.test(text);
}
function isInstallIntent(text) {
  if (isNoWriteIntent(text)) return false;
  return /(?:bau(?:e)?|füg(?:e)?|integrier(?:e)?|installier(?:e)?|übernimm|spiel(?:e)?|speicher(?:e)?|wend(?:e)?|setz(?:e)?)\b[\s\S]{0,110}?(?:in\s+(?:mein|dein|unser)(?:em|en|es)?\s+(?:projekt|bot)|ins\s+projekt|in\s+die\s+datei|ein|im\s+projekt|änderungen)/i.test(text) ||
    /(?:ändere|aendere|bearbeite|repariere|fixe|ersetze|aktualisiere)\s+(?:bitte\s+)?(?:meine|die|diese|folgende)\s+(?:datei|projektdatei|\S+\.(?:js|json))/i.test(text) ||
    /(?:im|in meinem|in unser(?:em|en))\s+(?:bot|projekt)\s+(?:einbauen|installieren|ändern|bearbeiten)/i.test(text);
}
function isReadIntent(text) {
  return !isNoWriteIntent(text) && !isInstallIntent(text) &&
    /(?:such|find|zeig|lies|öffne|schick|sende|wo (?:ist|steht))/i.test(text) &&
    /(?:meine|meinem|projekt|vorhanden|aktuell|datei|\.js\b|\.json\b)/i.test(text);
}
function listFiles() {
  const result = [];
  function walk(dir, depth) {
    if (depth > 5 || result.length >= 1200) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ['node_modules', 'backups', 'logs'].includes(entry.name) || sensitive.test(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile() && /\.(js|json)$/i.test(entry.name)) {
        result.push(path.relative(ROOT, full).replace(/\\/g, '/'));
      }
    }
  }
  walk(ROOT, 0);
  return result;
}
function namedFiles(text) {
  return [...new Set((text.match(/(?:[\wÄÖÜäöüß-]+\/)*[\wÄÖÜäöüß-]+\.(?:js|json)/gi) || []).map(s => s.replace(/\\/g, '/')))];
}
function relevantFiles(request, files) {
  const terms = (request.toLowerCase().match(/[a-zäöüß][a-zäöüß0-9_-]{3,}/g) || [])
    .filter(x => !['code', 'datei', 'bitte', 'erstellen', 'funktion', 'zeige', 'neuen', 'neue', 'machen', 'programmieren'].includes(x));
  return files.map(file => ({ file, score: terms.reduce((n, t) => n + (file.toLowerCase().includes(t) ? 3 : 0), 0) + (request.toLowerCase().includes(file.toLowerCase()) ? 10 : 0) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.file);
}
function excerpt(file, request, hint = '') {
  const content = fs.readFileSync(resolveTarget(file), 'utf8');
  if (content.length <= 22000) return content;
  const lines = content.split('\n');
  const terms = ((request + ' ' + hint).toLowerCase().match(/[a-zäöüß][a-zäöüß0-9_]{4,}/g) || [])
    .filter(t => !['code', 'datei', 'bitte', 'ändern', 'einbauen', 'neuen', 'neue', 'erstellen', 'zeige'].includes(t));
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (terms.some(t => lines[i].toLowerCase().includes(t))) hits.push(i);
  }
  const indices = new Set();
  for (const index of hits.slice(0, 12)) {
    for (let j = Math.max(0, index - 10); j <= Math.min(lines.length - 1, index + 20); j++) indices.add(j);
  }
  if (!indices.size) for (let i = 0; i < Math.min(lines.length, 100); i++) indices.add(i);
  // Line numbers are only for navigation; old must contain original unnumbered text.
  return [...indices].sort((a, b) => a - b)
    .map(i => `${i + 1}: ${lines[i]}`).join('\n').slice(0, 24000);
}
async function ai(prompt, message) {
  const { generateAIResponse } = require('./KI-Chat-Technik');
  if (typeof generateAIResponse !== 'function') throw Error('generateAIResponse fehlt in KI-Chat-Technik.js');
  return generateAIResponse(prompt, {
    guildId: message.guild?.id, channelId: message.channel.id,
    userId: message.author.id, username: message.author.username,
    guild: message.guild, member: message.member
  });
}
function prepare(plan) {
  if (!Array.isArray(plan.changes) || !plan.changes.length || plan.changes.length > MAX_CHANGES) {
    throw Error('Vorschlag benötigt 1 bis 4 Änderungen');
  }
  const changes = new Map();
  for (const change of plan.changes) {
    if (!['create', 'replace'].includes(change.action) || typeof change.new !== 'string' || change.new.length > MAX_NEW) {
      throw Error('Ungültiger Änderungsvorschlag');
    }
    const target = resolveTarget(change.file, change.action === 'create');
    const relative = path.relative(ROOT, target).replace(/\\/g, '/');
    const previous = changes.get(relative);
    if (change.action === 'create') {
      if (fs.existsSync(target) || previous) throw Error('Datei existiert bereits: ' + relative + ' – verwende replace');
      changes.set(relative, { before: null, after: change.new, originalHash: null });
      continue;
    }
    if (!fs.existsSync(target)) throw Error('Datei existiert nicht: ' + relative + ' – verwende create');
    if (typeof change.old !== 'string' || !change.old || change.old.length > 20000) {
      throw Error('old fehlt oder ist zu lang: ' + relative);
    }
    const before = previous ? previous.before : fs.readFileSync(target, 'utf8');
    let after = previous ? previous.after : before;
    const position = after.indexOf(change.old);
    if (position < 0 || after.indexOf(change.old, position + 1) >= 0) {
      throw Error('Codestelle nicht eindeutig in ' + relative + ' (Treffer: ' + (position < 0 ? '0' : 'mehrere') + ')');
    }
    after = after.slice(0, position) + change.new + after.slice(position + change.old.length);
    changes.set(relative, { before, after, originalHash: hash(before) });
  }
  for (const [file, change] of changes) check(file, change.after);
  return changes;
}
function contextFor(files, request, hint = '') {
  return files.slice(0, 4).map(file => {
    try { return `DATEI ${file}\n${excerpt(file, request, hint)}`; }
    catch (e) { return `DATEI ${file}: ${e.message}`; }
  }).join('\n\n').slice(0, MAX_CONTEXT);
}
async function planWithRetries(request, attached, files, contextFiles, message) {
  let error = '';
  let hint = '';
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const snippets = contextFor(contextFiles, request, hint);
    const prompt = `Du bist ein vorsichtiger JavaScript-Entwickler für Vexo RP (Discord.js v14).
Gib NUR gültiges JSON aus, ohne Markdown. Schema:
{"summary":"Beschreibung","changes":[{"file":"relativer/pfad.js","action":"create","new":"vollständiger Inhalt"},{"file":"index.js","action":"replace","old":"EXAKTER ORIGINALCODE","new":"Ersatzcode"}]}
Regeln: Maximal 4 Änderungen. create nur wenn Datei fehlt; replace nur wenn Datei existiert. old muss EXAKT EINMAL vorkommen. Keine Zeilennummern in old. Wenn Ausschnitte Zeilennummern haben, diese nicht in old kopieren. Erfinde keine bestehenden Funktionen oder Imports. Verwende Discord.js v14, keinen zweiten Client, korrekte Events, await bei asynchronen Aufrufen. Verändere nur notwendige Stellen. Falls Kontext fehlt, changes: []. Keine Speicherung durch KI.
ANFRAGE: ${request.slice(0, 4000)}
${attached ? 'ANHANG:\n' + attached.slice(0, 16000) : ''}
DATEILISTE:\n${files.join(', ').slice(0, 8000)}
CODEKONTEXT:\n${snippets}
${error ? 'LETZTER PRÜFFEHLER (bitte korrigieren): ' + error : ''}`;
    try {
      const plan = extract(await ai(prompt, message));
      if (!plan.changes.length) throw Error('KI benötigt mehr Dateikontext oder kann die Änderung nicht sicher planen');
      const changes = prepare(plan);
      return { changes, summary: String(plan.summary || 'Codeänderung').slice(0, 1200) };
    } catch (e) {
      error = String(e.message).slice(0, 900);
      hint = error;
      const mentioned = namedFiles(error).filter(file => files.includes(file));
      contextFiles = [...new Set([...mentioned, ...contextFiles])].slice(0, 4);
    }
  }
  throw Error('Nach ' + MAX_RETRIES + ' Versuchen kein sicherer Vorschlag: ' + error);
}

async function handleCodeMessage(message) {
  if (!message?.author || message.author.bot || message.author.id !== owner()) return false;
  const text = (message.content || '').trim();
  if (!text && !message.attachments?.size) return false;
  const id = message.author.id;
  const session = getSession(id);
  if (isCancel(text) && session.pending) {
    delete session.pending;
    keep(id, session);
    await message.reply('🗑️ Änderung verworfen. Keine Datei verändert.');
    return true;
  }
  if (isApproval(text) && session.pending) {
    if (!process.env.KI_CODE_PASSWORD_HASH) {
      await message.reply('🔒 KI_CODE_PASSWORD_HASH fehlt. Ohne Passwort ist kein Einbau möglich.');
      return true;
    }
    const pending = session.pending;
    await message.reply({
      content: `🔐 **Freigabe erforderlich:** ${pending.summary.slice(0, 800)}\nErst nach privater Passwortbestätigung wird gespeichert.`,
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId('ki_code_confirm:' + pending.id)
        .setLabel('Privat mit Passwort bestätigen').setStyle(ButtonStyle.Danger))]
    });
    return true;
  }
  // Keine impliziten Dateiaenderungen aufgrund von Woertern wie
  // "Ticketsystem", "Code", "erstelle" oder "slash-commands.js".
  if (isNoWriteIntent(text)) return false;
  const wantsInstall = isInstallIntent(text);
  const wantsRead = isReadIntent(text);
  if (!wantsInstall && !wantsRead) return false;
  if (wantsInstall && !process.env.KI_CODE_PASSWORD_HASH) {
    await message.reply('🔒 Für den Projekteingriff fehlt KI_CODE_PASSWORD_HASH. Code im Chat kannst du trotzdem anfordern.');
    return true;
  }
  const files = listFiles();
  const named = namedFiles(text);
  const existingNamed = named.filter(file => files.includes(file));
  const chosen = existingNamed[0] || relevantFiles(text, files)[0] || session.activeFile;
  try {
    if (wantsRead) {
      if (!chosen) { await message.reply('🔎 Welche Datei soll ich suchen?'); return true; }
      session.activeFile = chosen;
      keep(id, session);
      const content = fs.readFileSync(resolveTarget(chosen), 'utf8');
      await message.reply({ content: `🔎 Gefunden: \`${chosen}\``, files: [new AttachmentBuilder(Buffer.from(content, 'utf8'), { name: path.basename(chosen) })] });
      return true;
    }
    if (!wantsInstall) return false;
    let attached = '';
    const attachment = message.attachments?.find(file => /\.(js|json|txt)$/i.test(file.name || '') && file.size < 100000);
    if (attachment) {
      const response = await fetch(attachment.url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('Anhang konnte nicht geladen werden');
      attached = (await response.text()).slice(0, 90000);
    }
    const contextFiles = [...new Set([...existingNamed, chosen, ...relevantFiles(text, files)].filter(file => files.includes(file)))].slice(0, 4);
    if (!contextFiles.length && !/(?:neue datei|neues modul|erstell|programmier|entwickel|einbau|einbauen|installier)/i.test(text)) {
      await message.reply('📂 Bitte schicke zuerst die betroffene .js/.json-Datei oder nenne ihren genauen Pfad. Ich ändere nichts ohne passenden Projektkontext.');
      return true;
    }
    await message.channel.sendTyping().catch(() => {});
    const result = await planWithRetries(text, attached, files, contextFiles, message);
    const pending = {
      id: crypto.randomUUID().slice(0, 12),
      changes: [...result.changes], summary: result.summary,
      expires: Date.now() + MAX_AGE, guild: message.guild?.id
    };
    session.pending = pending;
    session.activeFile = [...result.changes.keys()][0];
    keep(id, session);
    const report = `🧠 **Änderungsvorschlag – noch NICHT installiert**\n\n${pending.summary}\n\nDateien: ${[...result.changes.keys()].map(x => '`' + x + '`').join(', ')}\n\nSyntaxprüfung erfolgreich. Das garantiert keine fehlerfreie Laufzeit.\n\nSchreib **„Okay, mach das“**. Danach folgt die private Passwortabfrage.`;
    await message.reply({
      content: report.slice(0, 1900),
      files: [new AttachmentBuilder(Buffer.from([...result.changes].map(([file, change]) => `// ${file}\n${change.after}`).join('\n\n'), 'utf8'), { name: 'vorgeschlagener-code.txt' })]
    });
    return true;
  } catch (error) {
    await message.reply('❌ Keine Datei verändert: ' + String(error.message).slice(0, 900));
    return true;
  }
}

function registerCodeInteractions(client) {
  if (client.__vexoCodeInteractionsRegistered) return;
  client.__vexoCodeInteractionsRegistered = true;
  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith('ki_code_confirm:')) {
        const pending = getSession(interaction.user.id).pending;
        if (interaction.user.id !== owner() || !pending || pending.id !== interaction.customId.split(':')[1] || pending.expires < Date.now() || pending.guild !== interaction.guildId) {
          return interaction.reply({ content: '⛔ Keine gültige Freigabe.', flags: MessageFlags.Ephemeral });
        }
        return interaction.showModal(new ModalBuilder()
          .setCustomId('ki_code_password:' + pending.id).setTitle('Vexo Code-Freigabe')
          .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId('pw').setLabel('Dein geheimes Passwort')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(4000))));
      }
      if (!interaction.isModalSubmit() || !interaction.customId.startsWith('ki_code_password:')) return;
      const session = getSession(interaction.user.id);
      const pending = session.pending;
      if (interaction.user.id !== owner() || !pending || pending.id !== interaction.customId.split(':')[1] || pending.expires < Date.now() || pending.guild !== interaction.guildId) {
        return interaction.reply({ content: '⛔ Freigabe ungültig.', flags: MessageFlags.Ephemeral });
      }
      if (!passwordOK(interaction.fields.getTextInputValue('pw'))) {
        return interaction.reply({ content: '❌ Falsches Passwort. Nichts geändert.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      // Revalidate all files before writing.
      for (const [file, change] of pending.changes) {
        const target = resolveTarget(file, change.before === null);
        const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
        if ((change.before === null && current !== null) || (change.before !== null && (current === null || hash(current) !== change.originalHash))) {
          throw Error('Datei inzwischen verändert: ' + file);
        }
        check(file, change.after);
      }
      const backupDir = path.join(ROOT, '.ki-code-backups', new Date().toISOString().replace(/[:.]/g, '-') + '-' + pending.id);
      fs.mkdirSync(backupDir, { recursive: true });
      // Backup every original before writing any new content.
      for (const [file, change] of pending.changes) {
        if (change.before === null) continue;
        const destination = path.join(backupDir, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, change.before, { flag: 'wx' });
      }
      delete session.pending;
      keep(interaction.user.id, session);
      const written = [];
      try {
        for (const [file, change] of pending.changes) {
          const target = resolveTarget(file, change.before === null);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          const temp = target + '.tmp-' + crypto.randomUUID();
          try {
            fs.writeFileSync(temp, change.after, { flag: 'wx' });
            // Windows rename may not replace an existing destination; keep the original
            // in memory and restore it if the write operation fails.
            if (change.before !== null && process.platform === 'win32') {
              written.push([target, change]);
              fs.writeFileSync(target, change.after);
              fs.unlinkSync(temp);
            } else {
              fs.renameSync(temp, target);
            }
            if (!(change.before !== null && process.platform === 'win32')) written.push([target, change]);
          } finally { try { fs.unlinkSync(temp); } catch {} }
        }
      } catch (error) {
        const rollbackErrors = [];
        for (const [target, change] of written.reverse()) {
          try {
            if (change.before === null) fs.unlinkSync(target);
            else fs.writeFileSync(target, change.before);
          } catch (e) { rollbackErrors.push(target + ': ' + e.message); }
        }
        if (rollbackErrors.length) throw Error(error.message + ' | Rollback fehlgeschlagen: ' + rollbackErrors.join('; '));
        throw error;
      }
      const restart = process.env.KI_CODE_RESTART === 'supervisor' && process.env.VEXO_SUPERVISOR === '1';
      await interaction.editReply(`✅ Passwort bestätigt. ${written.length} Datei(en) eingebaut. Backup unter .ki-code-backups gespeichert.${restart ? ' Bot startet jetzt neu.' : ' Bitte Bot manuell neu starten.'}`);
      console.log('[KI-CODE] Änderungen:', written.map(([file]) => path.relative(ROOT, file)));
      if (restart) setTimeout(() => process.exit(75), 2500).unref();
    } catch (error) {
      console.error('[KI-CODE]', error);
      const content = '❌ ' + String(error.message).slice(0, 700);
      if (interaction.deferred) await interaction.editReply({ content }).catch(() => {});
      else if (interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
}
module.exports = { handleCodeMessage, registerCodeInteractions };
