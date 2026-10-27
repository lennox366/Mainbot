"use strict";

// =====================================================
// 🎵 NEXORACLOUD MUSIC-SYSTEM
// =====================================================
//
// Eigenständiges Modul – wird per initializeMusicSystem(client)
// aus der index.js eingebunden. Registriert einen EIGENEN
// "interactionCreate"-Listener, der ausschließlich auf die
// Musik-Slash-Commands reagiert (/play, /pause, /resume,
// /skip, /stop, /queue) und alle anderen Interaktionen sofort
// ignoriert. Dadurch werden bestehende Handler in der index.js
// nicht beeinflusst oder überschrieben.
//
// Benötigte npm-Pakete (siehe README-Hinweise im Chat):
//   npm install distube @distube/yt-dlp @discordjs/voice @discordjs/opus libsodium-wrappers ffmpeg-static
//
// Slash-Commands müssen einmalig registriert werden, siehe
// Music-System/deploy-music-commands.js
// =====================================================

const {
    EmbedBuilder,
    SlashCommandBuilder,
    PermissionsBitField,
    MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// libsodium wird für die Verschlüsselung der Audio-Pakete benötigt.
// Auf Windows hilft es oft, es explizit zu laden.
try {
    require("libsodium-wrappers");
} catch (e) {
    // Ignorieren, falls nicht vorhanden
}

const { DisTube, Events: DisTubeEvents, Playlist, Song } = require("distube");

// yt-dlp übernimmt sowohl die YouTube-Suche als auch die Stream-Auflösung.
// Der Wrapper-Plugin-Typ von @distube/yt-dlp kann standardmäßig nicht suchen;
// SearchableYtDlpPlugin ergänzt die Suche über yt-dlp selbst.
const { YtDlpPlugin, json: ytDlpJson } = require("@distube/yt-dlp");

// ffmpeg-static liefert einen fertigen ffmpeg-Binary-Pfad mit. DisTube
// liest diesen NICHT automatisch aus process.env.FFMPEG_PATH, sondern
// nur aus der eigenen "ffmpeg.path"-Option im DisTube-Konstruktor
// (siehe createDisTubeInstance unten) - ohne die Angabe sucht DisTube
// standardmäßig nach "ffmpeg" im System-PATH und bricht mit
// FFMPEG_NOT_INSTALLED ab, selbst wenn ffmpeg-static per npm installiert ist.
const ffmpegStaticPath = require("ffmpeg-static");

// =====================================================
// KONFIGURATION
// =====================================================

// Wartezeit (ms), bevor der Bot den Sprachkanal verlässt,
// nachdem die Warteschlange komplett abgespielt wurde.
// Über Umgebungsvariable konfigurierbar.
const MUSIC_IDLE_LEAVE_MS =
    Number(process.env.MUSIC_IDLE_LEAVE_MS) > 0
        ? Number(process.env.MUSIC_IDLE_LEAVE_MS)
        : 120_000; // Standard: 2 Minuten

// Wartezeit (Sekunden), bevor der Bot den Kanal verlässt,
// wenn der Sprachkanal komplett leer ist (alle Nutzer weg).
const MUSIC_EMPTY_COOLDOWN_SECONDS =
    Number(process.env.MUSIC_EMPTY_COOLDOWN_SECONDS) > 0
        ? Number(process.env.MUSIC_EMPTY_COOLDOWN_SECONDS)
        : 60;

const YTDLP_OPERATION_TIMEOUT_MS = 30_000;

// Pfad zur optionalen cookies.txt Datei im Hauptverzeichnis des Bots.
// Wird benötigt, wenn YouTube den Bot als "Bot" erkennt und eine Anmeldung fordert.
const YTDLP_COOKIES_PATH = path.join(__dirname, "..", "cookies.txt");

// Maximale Anzahl an Songs, die im /queue-Embed aufgelistet werden.
const QUEUE_DISPLAY_LIMIT = 10;

const NEXORA_COLOR = 0x8B5CF6;
const NEXORA_ERROR_COLOR = 0xED4245;
const NEXORA_FOOTER = "NoVex RP • Music System";

const MUSIC_COMMAND_NAMES = new Set([
    "play",
    "pause",
    "resume",
    "skip",
    "stop",
    "queue"
]);

// Pro Server ein Timer für das automatische Verlassen bei leerer Warteschlange.
const idleLeaveTimers = new Map();

// =====================================================
// SLASH-COMMAND DEFINITIONEN (für die Registrierung)
// =====================================================

const musicCommandDefinitions = [
    new SlashCommandBuilder()
        .setName("play")
        .setDescription("Spielt einen Song/Sound im Sprachkanal ab oder fügt ihn der Warteschlange hinzu.")
        .addStringOption(option =>
            option
                .setName("query")
                .setDescription("Suchbegriff oder Link (z. B. WAD)")
                .setMinLength(1)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("pause")
        .setDescription("Pausiert den aktuell abgespielten Song."),

    new SlashCommandBuilder()
        .setName("resume")
        .setDescription("Setzt einen pausierten Song fort."),

    new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Überspringt den aktuellen Song."),

    new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stoppt die Wiedergabe, leert die Warteschlange und verlässt den Kanal."),

    new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Zeigt die aktuelle Warteschlange an.")
].map(command => command.toJSON());

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function formatDuration(seconds) {
    if (!seconds || Number.isNaN(seconds)) {
        return "🔴 Live";
    }

    const totalSeconds = Math.floor(seconds);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = value => String(value).padStart(2, "0");

    return hrs > 0
        ? `${hrs}:${pad(mins)}:${pad(secs)}`
        : `${mins}:${pad(secs)}`;
}

function buildNexoraEmbed({ title, description, fields, thumbnail, color }) {
    const embed = new EmbedBuilder()
        .setColor(color || NEXORA_COLOR)
        .setTitle(title)
        .setFooter({ text: NEXORA_FOOTER })
        .setTimestamp();

    if (description) {
        embed.setDescription(description);
    }

    if (Array.isArray(fields) && fields.length > 0) {
        embed.addFields(fields);
    }

    if (thumbnail) {
        embed.setThumbnail(thumbnail);
    }

    return embed;
}

function buildErrorEmbed(message) {
    return buildNexoraEmbed({
        title: "❌ Fehler",
        description: message,
        color: NEXORA_ERROR_COLOR
    });
}

async function replyError(interaction, message) {
    const payload = {
        embeds: [buildErrorEmbed(message)],
        flags: MessageFlags.Ephemeral
    };

    if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
    }

    return interaction.reply(payload);
}

function clearIdleTimer(guildId) {
    const timer = idleLeaveTimers.get(guildId);
    if (timer) {
        clearTimeout(timer);
        idleLeaveTimers.delete(guildId);
    }
}

function scheduleIdleLeave(distube, guildId) {
    clearIdleTimer(guildId);

    const timer = setTimeout(() => {
        idleLeaveTimers.delete(guildId);

        const queue = distube.getQueue(guildId);

        // Nur verlassen, wenn zwischenzeitlich nichts Neues gestartet wurde.
        if (!queue || !queue.songs || queue.songs.length === 0) {
            try {
                distube.voices.leave(guildId);
            } catch (error) {
                console.error("❌ [Music-System] Fehler beim automatischen Verlassen:", error);
            }
        }
    }, MUSIC_IDLE_LEAVE_MS);

    idleLeaveTimers.set(guildId, timer);
}

async function runYtDlpJson(url, flags, operation) {
    const startedAt = Date.now();

    // Automatisch Cookies hinzufügen, falls die Datei existiert
    if (fs.existsSync(YTDLP_COOKIES_PATH)) {
        flags = { ...flags, cookies: YTDLP_COOKIES_PATH };
    }

    try {
        const result = await ytDlpJson(url, flags, {
            timeout: YTDLP_OPERATION_TIMEOUT_MS
        });
        console.log(`✅ [Music-System] yt-dlp ${operation} abgeschlossen nach ${Date.now() - startedAt}ms.`);
        return result;
    } catch (error) {
        const elapsed = Date.now() - startedAt;
        const timedOut = elapsed >= YTDLP_OPERATION_TIMEOUT_MS - 1_000;
        let details = error instanceof Error && error.message
            ? error.message.slice(0, 500)
            : "Keine weiteren Details verfügbar.";

        if (details.includes("Sign in to confirm you") || details.includes("confirm you're not a bot")) {
            details += "\n\n💡 **Lösung:** YouTube blockiert den Bot. Bitte erstelle eine `cookies.txt` im Hauptverzeichnis des Bots.";
        }

        throw new Error(
            `yt-dlp ${operation} ${timedOut ? `nach ${Math.round(elapsed / 1_000)} Sekunden abgebrochen (Timeout)` : "fehlgeschlagen"}: ${details}`,
            { cause: error }
        );
    }
}

class SearchableYtDlpPlugin extends YtDlpPlugin {
    type = "extractor";

    createSong(info, options) {
        const source = info.extractor || info.extractor_key;
        const url = info.webpage_url || info.original_url || info.url;
        const name = info.title || info.fulltitle;

        if (!source || !url || !name) {
            throw new Error("yt-dlp hat unvollständige Titelinformationen zurückgegeben.");
        }

        return new Song({
            plugin: this,
            source,
            playFromSource: true,
            id: info.id ? String(info.id) : url,
            name,
            url,
            isLive: info.is_live,
            thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
            duration: info.is_live ? 0 : info.duration,
            uploader: {
                name: info.uploader,
                url: info.uploader_url
            },
            views: info.view_count,
            likes: info.like_count,
            dislikes: info.dislike_count,
            reposts: info.repost_count,
            ageRestricted: Boolean(info.age_limit) && info.age_limit >= 18
        }, options);
    }

    async resolve(url, options) {
        const info = await runYtDlpJson(url, {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            skipDownload: true,
            simulate: true
        }, "URL-Auflösung");

        if (!Array.isArray(info.entries)) {
            return this.createSong(info, options);
        }

        const songs = info.entries.map(entry => this.createSong(entry, options));
        if (songs.length === 0) {
            throw new Error("Die Playlist enthält keine abspielbaren Titel.");
        }

        return new Playlist({
            source: info.extractor || info.extractor_key || songs[0].source,
            songs,
            id: String(info.id || url),
            name: info.title || "Playlist",
            url: info.webpage_url || url,
            thumbnail: info.thumbnail || info.thumbnails?.[0]?.url
        }, options);
    }

    async searchSong(query, options) {
        const result = await runYtDlpJson(`ytsearch1:${query}`, {
            dumpSingleJson: true,
            noWarnings: true,
            skipDownload: true,
            simulate: true
        }, "Suche");
        const entry = result.entries?.find(song => song && (song.webpage_url || song.url));

        if (!entry) {
            return null;
        }

        if (!entry.id || !entry.title) {
            throw new Error("yt-dlp hat ein unvollständiges Suchergebnis zurückgegeben.");
        }

        return this.createSong(entry, options);
    }

    async getStreamURL(song) {
        if (!song.url) {
            throw new Error("Der gefundene Titel enthält keine abspielbare URL.");
        }

        const info = await runYtDlpJson(song.url, {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            skipDownload: true,
            simulate: true,
            format: "bestaudio[ext=m4a]/bestaudio/best"
        }, "Audio-Stream-Auflösung");

        if (Array.isArray(info.entries) || !info.url) {
            throw new Error("Für diesen Titel wurde kein Audio-Stream gefunden.");
        }

        return info.url;
    }
}

// =====================================================
// DISTUBE-INSTANZ ERSTELLEN
// =====================================================

function createDisTubeInstance(client) {
    const distube = new DisTube(client, {
        emitNewSongOnly: true,
        savePreviousSongs: true,
        nsfw: false,
        ffmpeg: {
            path: ffmpegStaticPath
        },
        plugins: [
            new SearchableYtDlpPlugin({
                update: false
            })
        ]
    });

    // =====================================================
    // EVENTS
    // =====================================================

    distube.on(DisTubeEvents.PLAY_SONG, (queue, song) => {

        const embed = buildNexoraEmbed({
            title: "🎶 Jetzt läuft",
            description: `**[${song.name}](${song.url})**`,
            thumbnail: song.thumbnail,
            fields: [
                { name: "⏱️ Dauer", value: formatDuration(song.duration), inline: true },
                { name: "🎧 Angefragt von", value: `${song.user || "Unbekannt"}`, inline: true },
                { name: "📃 Warteschlange", value: `${queue.songs.length - 1} weitere Titel`, inline: true }
            ]
        });

        queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    });

    distube.on(DisTubeEvents.ADD_SONG, (queue, song) => {
        // Wird nur gesendet, wenn bereits etwas läuft (emitNewSongOnly).
        clearIdleTimer(queue.id);

        const embed = buildNexoraEmbed({
            title: "➕ Zur Warteschlange hinzugefügt",
            description: `**[${song.name}](${song.url})**`,
            thumbnail: song.thumbnail,
            fields: [
                { name: "⏱️ Dauer", value: formatDuration(song.duration), inline: true },
                { name: "🎧 Angefragt von", value: `${song.user || "Unbekannt"}`, inline: true },
                { name: "📍 Position", value: `${queue.songs.length - 1}`, inline: true }
            ]
        });

        queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    });

    distube.on(DisTubeEvents.ADD_LIST, (queue, playlist) => {
        clearIdleTimer(queue.id);

        const embed = buildNexoraEmbed({
            title: "➕ Playlist hinzugefügt",
            description: `**${playlist.name}** (${playlist.songs.length} Titel)`
        });

        queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    });

    distube.on(DisTubeEvents.FINISH, queue => {
        const embed = buildNexoraEmbed({
            title: "✅ Warteschlange beendet",
            description: `Es sind keine weiteren Titel mehr in der Warteschlange.\nDer Bot verlässt den Kanal in **${Math.round(MUSIC_IDLE_LEAVE_MS / 1000)} Sekunden**, falls nichts Neues abgespielt wird.`
        });

        queue.textChannel?.send({ embeds: [embed] }).catch(() => {});

        scheduleIdleLeave(distube, queue.id);
    });

    distube.on(DisTubeEvents.EMPTY, queue => {
        clearIdleTimer(queue.id);

        const embed = buildNexoraEmbed({
            title: "👋 Sprachkanal leer",
            description: `Alle Benutzer haben den Sprachkanal verlassen. Der Bot verlässt den Kanal in **${MUSIC_EMPTY_COOLDOWN_SECONDS} Sekunden**, falls niemand beitritt.`
        });

        queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    });

    distube.on(DisTubeEvents.DISCONNECT, queue => {
        clearIdleTimer(queue.id);
    });

    distube.on(DisTubeEvents.DELETE_QUEUE, queue => {
        clearIdleTimer(queue.id);
    });

    distube.on(DisTubeEvents.ERROR, (error, queue, song) => {
        console.error("❌ [Music-System] DisTube-Fehler:", error);

        const embed = buildErrorEmbed(
            song
                ? `Beim Abspielen von **${song.name}** ist ein Fehler aufgetreten. Der nächste Titel wird versucht.`
                : "Beim Suchen oder Laden des Titels ist ein Fehler aufgetreten. Bitte versuche es erneut."
        );

        queue?.textChannel?.send({ embeds: [embed] }).catch(() => {});
    });

    return distube;
}

// =====================================================
// SLASH-COMMAND HANDLER
// =====================================================

function getMemberVoiceChannel(interaction) {
    return interaction.member?.voice?.channel || null;
}

function botHasVoicePermissions(voiceChannel, guild) {
    const permissions = voiceChannel.permissionsFor(guild.members.me);
    return Boolean(
        permissions?.has(PermissionsBitField.Flags.Connect) &&
        permissions?.has(PermissionsBitField.Flags.Speak)
    );
}

async function handlePlay(interaction, distube) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const voiceChannel = getMemberVoiceChannel(interaction);

    if (!voiceChannel) {
        return replyError(interaction, "Du musst dich in einem Sprachkanal befinden, um `/play` zu benutzen.");
    }

    if (!botHasVoicePermissions(voiceChannel, interaction.guild)) {
        return replyError(interaction, `Mir fehlen die Berechtigungen **Beitreten** und/oder **Sprechen** in ${voiceChannel}.`);
    }

    const query = interaction.options.getString("query", true).trim();
    if (!query) {
        return replyError(interaction, "Bitte gib einen Suchbegriff oder Link ein.");
    }

    console.log(`🔎 [Music-System] /play gestartet für Query: "${query}" ...`);
    const playStartedAt = Date.now();
    let playTimeout;

    try {
        // Sicherheits-Timeout: distube.play() darf maximal 120 Sekunden
        // dauern. Hängt der zugrunde liegende yt-dlp-Aufruf fest (z. B.
        // durch einen hängenden Kindprozess), würde die Interaktion sonst
        // für immer bei "Denkt nach ..." stehen bleiben, ohne dass wir
        // jemals einen Fehler oder Hinweis in der Konsole sehen.
        await Promise.race([
            distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: interaction.member,
                metadata: { interactionUserId: interaction.user.id }
            }),
            new Promise((_, reject) => {
                playTimeout = setTimeout(
                    () => reject(new Error(`TIMEOUT nach ${Date.now() - playStartedAt}ms - distube.play() hat nicht rechtzeitig geantwortet.`)),
                    120_000
                );
            })
        ]);

        console.log(`✅ [Music-System] distube.play() abgeschlossen nach ${Date.now() - playStartedAt}ms.`);

        const queue = distube.getQueue(interaction.guildId);
        const positionInfo = queue && queue.songs.length > 1
            ? `Der Titel wurde an Position **${queue.songs.length - 1}** der Warteschlange gesetzt.`
            : `Suche nach **${query}** war erfolgreich – die Wiedergabe startet gleich.`;

        await interaction.editReply({
            embeds: [
                buildNexoraEmbed({
                    title: "🔎 Suche erfolgreich",
                    description: positionInfo
                })
            ]
        });
    } catch (error) {
        console.error(`❌ [Music-System] Fehler bei /play nach ${Date.now() - playStartedAt}ms:`, error);

        await interaction.editReply({
            embeds: [
                buildErrorEmbed(`Für **${query}** konnte nichts gefunden oder abgespielt werden. Bitte versuche einen anderen Suchbegriff oder Link.`)
            ]
        });
    } finally {
        clearTimeout(playTimeout);
    }
}

function requireActiveQueue(interaction, distube) {
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) {
        return { queue: null, error: "Aktuell läuft kein Sound und es gibt keine Warteschlange." };
    }

    return { queue, error: null };
}

function requireSameVoiceChannel(interaction, queue) {
    const memberChannel = getMemberVoiceChannel(interaction);
    const botChannelId = queue.voice?.channel?.id;

    if (!memberChannel) {
        return "Du musst dich in einem Sprachkanal befinden, um diesen Befehl zu nutzen.";
    }

    if (botChannelId && memberChannel.id !== botChannelId) {
        return "Du musst dich im selben Sprachkanal wie der Bot befinden, um diesen Befehl zu nutzen.";
    }

    return null;
}

async function handlePause(interaction, distube) {
    const { queue, error } = requireActiveQueue(interaction, distube);
    if (error) return replyError(interaction, error);

    const permissionError = requireSameVoiceChannel(interaction, queue);
    if (permissionError) return replyError(interaction, permissionError);

    if (queue.paused) {
        return replyError(interaction, "Die Wiedergabe ist bereits pausiert.");
    }

    queue.pause();

    return interaction.reply({
        embeds: [buildNexoraEmbed({ title: "⏸️ Pausiert", description: `**${queue.songs[0].name}** wurde pausiert.` })]
    });
}

async function handleResume(interaction, distube) {
    const { queue, error } = requireActiveQueue(interaction, distube);
    if (error) return replyError(interaction, error);

    const permissionError = requireSameVoiceChannel(interaction, queue);
    if (permissionError) return replyError(interaction, permissionError);

    if (!queue.paused) {
        return replyError(interaction, "Die Wiedergabe läuft bereits.");
    }

    queue.resume();

    return interaction.reply({
        embeds: [buildNexoraEmbed({ title: "▶️ Fortgesetzt", description: `**${queue.songs[0].name}** wird fortgesetzt.` })]
    });
}

async function handleSkip(interaction, distube) {
    const { queue, error } = requireActiveQueue(interaction, distube);
    if (error) return replyError(interaction, error);

    const permissionError = requireSameVoiceChannel(interaction, queue);
    if (permissionError) return replyError(interaction, permissionError);

    const skippedSong = queue.songs[0];

    if (queue.songs.length <= 1) {
        return replyError(interaction, "Es gibt keinen weiteren Titel, der übersprungen werden könnte. Nutze `/stop`, um die Wiedergabe zu beenden.");
    }

    try {
        await queue.skip();

        return interaction.reply({
            embeds: [buildNexoraEmbed({ title: "⏭️ Übersprungen", description: `**${skippedSong.name}** wurde übersprungen.` })]
        });
    } catch (error2) {
        console.error("❌ [Music-System] Fehler bei /skip:", error2);
        return replyError(interaction, "Der Titel konnte nicht übersprungen werden.");
    }
}

async function handleStop(interaction, distube) {
    const { queue, error } = requireActiveQueue(interaction, distube);
    if (error) return replyError(interaction, error);

    const permissionError = requireSameVoiceChannel(interaction, queue);
    if (permissionError) return replyError(interaction, permissionError);

    clearIdleTimer(interaction.guildId);
    queue.stop();

    return interaction.reply({
        embeds: [buildNexoraEmbed({ title: "⏹️ Gestoppt", description: "Die Wiedergabe wurde gestoppt, die Warteschlange geleert und der Sprachkanal verlassen." })]
    });
}

async function handleQueue(interaction, distube) {
    const { queue, error } = requireActiveQueue(interaction, distube);
    if (error) return replyError(interaction, error);

    const songsToShow = queue.songs.slice(0, QUEUE_DISPLAY_LIMIT);

    const description = songsToShow
        .map((song, index) => {
            const prefix = index === 0 ? "🎶 **Jetzt:**" : `**${index}.**`;
            return `${prefix} [${song.name}](${song.url}) — \`${formatDuration(song.duration)}\` (${song.user || "Unbekannt"})`;
        })
        .join("\n");

    const remaining = queue.songs.length - songsToShow.length;

    return interaction.reply({
        embeds: [
            buildNexoraEmbed({
                title: "📃 Warteschlange",
                description: description || "Die Warteschlange ist leer.",
                fields: remaining > 0
                    ? [{ name: "ℹ️ Hinweis", value: `+${remaining} weitere Titel nicht angezeigt.` }]
                    : []
            })
        ]
    });
}

// =====================================================
// INITIALISIERUNG
// =====================================================

function initializeMusicSystem(client) {
    const distube = createDisTubeInstance(client);

    client.on("interactionCreate", async interaction => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.__slashCommandPermissionDenied) return;
        if (!MUSIC_COMMAND_NAMES.has(interaction.commandName)) return;

        if (!interaction.guild) {
            return replyError(interaction, "Musik-Befehle funktionieren nur auf einem Server.");
        }

        try {
            switch (interaction.commandName) {
                case "play":
                    return await handlePlay(interaction, distube);
                case "pause":
                    return await handlePause(interaction, distube);
                case "resume":
                    return await handleResume(interaction, distube);
                case "skip":
                    return await handleSkip(interaction, distube);
                case "stop":
                    return await handleStop(interaction, distube);
                case "queue":
                    return await handleQueue(interaction, distube);
                default:
                    return;
            }
        } catch (error) {
            console.error("❌ [Music-System] Unerwarteter Fehler:", error);
            return replyError(interaction, "Es ist ein unerwarteter Fehler aufgetreten.").catch(() => {});
        }
    });

    console.log("🎵 [Music-System] Erfolgreich initialisiert.");

    return distube;
}

module.exports = {
    initializeMusicSystem,
    musicCommandDefinitions
};