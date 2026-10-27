
"use strict";

// =====================================================
// 🤖 NoVex RP – KI-CHAT
// Datei: KI-Chatbot/KI-Chat.js
// Mit integrierter KI-Bildanimation
// =====================================================

const { AttachmentBuilder } = require("discord.js");

const {
    handleCodeMessage,
    registerCodeInteractions
} = require("./KI-Code-Manager");

const {
    isKIChatChannel,
    getKIChatChannelId
} = require("./KI-Chat-Setup");

// WICHTIG: KI-Animation.js liegt im selben Ordner.
const {
    handleAnimationMessage
} = require("./KI-Animation");

// =====================================================
// STATUS
// =====================================================

let initialized = false;
let discordClient = null;

// =====================================================
// CLIENT SETZEN
// =====================================================

function setClient(client) {
    discordClient = client;
}

// =====================================================
// LANGE ANTWORTEN AUFTEILEN
// =====================================================

const CHUNK_LIMIT = 1900;
const MAX_CHUNKS = 5;

function splitMessage(text, max = CHUNK_LIMIT) {
    const chunks = [];

    let current = "";
    let openFence = null;

    const lines = text.split("\n");
    const pieceSize = max - 20;

    for (const rawLine of lines) {
        const pieces =
            rawLine.length > pieceSize
                ? rawLine.match(
                    new RegExp(`[\\s\\S]{1,${pieceSize}}`, "g")
                )
                : [rawLine];

        for (const line of pieces) {
            const reserve = openFence ? 4 : 0;

            if (
                current.length +
                line.length +
                1 +
                reserve > max
            ) {
                if (openFence) {
                    current += "\n```";
                }

                chunks.push(current);

                current = openFence
                    ? openFence + "\n"
                    : "";
            }

            if (
                current &&
                !current.endsWith("\n")
            ) {
                current += "\n";
            }

            current += line;

            if (
                line.trim().startsWith("```")
            ) {
                openFence = openFence
                    ? null
                    : line.trim();
            }
        }
    }

    if (current.trim()) {
        chunks.push(current);
    }

    return chunks;
}

// =====================================================
// NACHRICHTEN-HANDLER
// =====================================================

async function handleKIChatMessage(message) {
    let typingInterval = null;

    try {
        if (!discordClient || !message) {
            return;
        }

        // Bot-Nachrichten ignorieren
        if (message.author?.bot) {
            return;
        }

        // Nur Discord-Server
        if (!message.guild) {
            return;
        }

        // Nur im eingestellten KI-Chat-Kanal
        if (
            !isKIChatChannel(
                message.guild.id,
                message.channel.id
            )
        ) {
            return;
        }

        // =============================================
        // 🎬 KI-BILDANIMATION
        // =============================================

        // Wichtig: Vor der Prüfung auf Textinhalt,
        // damit auch Bilder ohne Nachrichtentext
        // erkannt werden.
        if (
            typeof handleAnimationMessage === "function"
        ) {
            const handled =
                await handleAnimationMessage(message);

            if (handled) {
                return;
            }
        }

        // =============================================
        // 💻 KI-CODE-MANAGER
        // =============================================

        if (
            await handleCodeMessage(message)
        ) {
            return;
        }

        // =============================================
        // 💬 NORMALER KI-CHAT
        // =============================================

        if (!message.content) {
            return;
        }

        const userMessage =
            message.content.trim();

        if (!userMessage) {
            return;
        }

        const {
            generateAIResponse
        } = require("./KI-Chat-Technik");

        try {
            await message.channel.sendTyping();
        } catch (_) {}

        typingInterval = setInterval(() => {
            message.channel
                .sendTyping()
                .catch(() => {});
        }, 8000);

        const response =
            await generateAIResponse(
                userMessage,
                {
                    guildId: message.guild.id,
                    channelId: message.channel.id,
                    userId: message.author.id,
                    username: message.author.username,
                    guild: message.guild,
                    member: message.member
                }
            );

        clearInterval(typingInterval);
        typingInterval = null;

        if (!response) {
            return;
        }

        const answer = String(response);

        // =============================================
        // KURZE ANTWORT
        // =============================================

        if (answer.length <= 2000) {
            await message.reply({
                content: answer,
                allowedMentions: {
                    repliedUser: false
                }
            });

            return;
        }

        // =============================================
        // LANGE ANTWORT
        // =============================================

        const chunks = splitMessage(answer);

        if (chunks.length > MAX_CHUNKS) {
            const file = new AttachmentBuilder(
                Buffer.from(answer, "utf8"),
                {
                    name: "antwort.md"
                }
            );

            await message.reply({
                content:
                    "📄 Die Antwort ist sehr lang, " +
                    "deshalb habe ich sie als Datei angehängt.",
                files: [file],
                allowedMentions: {
                    repliedUser: false
                }
            });

            return;
        }

        await message.reply({
            content: chunks[0],
            allowedMentions: {
                repliedUser: false
            }
        });

        for (
            let i = 1;
            i < chunks.length;
            i++
        ) {
            await message.channel.send({
                content: chunks[i],
                allowedMentions: {
                    parse: []
                }
            });
        }

    } catch (error) {
        console.error(
            "❌ Fehler im KI-Chat:",
            error
        );

        try {
            await message.reply({
                content:
                    "❌ Die KI konnte gerade keine Antwort erstellen. " +
                    "Bitte prüfe die Bot-Konsole.",
                allowedMentions: {
                    repliedUser: false
                }
            });
        } catch (_) {}

    } finally {
        if (typingInterval) {
            clearInterval(typingInterval);
        }
    }
}

// =====================================================
// HANDLER REGISTRIEREN
// =====================================================

function initializeKIChat(client) {
    if (initialized) {
        return;
    }

    if (!client) {
        throw new Error(
            "KI-Chat: Kein Discord-Client übergeben."
        );
    }

    discordClient = client;

    registerCodeInteractions(client);

    client.on(
        "messageCreate",
        handleKIChatMessage
    );

    initialized = true;

    console.log(
        "🤖 KI-Chat mit Bildanimations-Anbindung aktiviert."
    );
}

// =====================================================
// STATUS
// =====================================================

function isInitialized() {
    return initialized;
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    initializeKIChat,
    handleKIChatMessage,
    setClient,
    isInitialized,
    getKIChatChannelId
};
