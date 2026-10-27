
"use strict";

// =====================================================
// 🎬 VEXO RP – KI-BILDANIMATION
// Datei: KI-Chatbot/KI-Animation.js
// Discord.js v14 + lokales ComfyUI + FFmpeg
// =====================================================

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const { AttachmentBuilder } = require("discord.js");

// KORRIGIERT: Setup liegt im selben Ordner.
const {
    isKIChatChannel
} = require("./KI-Chat-Setup");

// =====================================================
// KONFIGURATION
// =====================================================

const BASE = path.join(__dirname, "work");

const COMFY = (
    process.env.VEXO_COMFY_URL ||
    "http://127.0.0.1:8188"
).replace(/\/+$/, "");

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ACTIVE = 1;

const SESSION_TIMEOUT = 30 * 60 * 1000;
const JOB_TIMEOUT = 20 * 60 * 1000;
const CLEANUP_AGE = 24 * 60 * 60 * 1000;

const sessions = new Map();

let active = 0;

const allowed = new Set([
    "image/png",
    "image/jpeg",
    "image/webp"
]);

// =====================================================
// SITZUNG
// =====================================================

function sessionKey(message) {
    return `${message.guildId}:${message.author.id}`;
}

// =====================================================
// BILD ERKENNEN
// =====================================================

function extractImage(message) {
    return message.attachments.find(attachment => {
        const type = attachment.contentType
            ?.split(";")[0]
            ?.toLowerCase();

        return (
            allowed.has(type) &&
            attachment.size <= MAX_BYTES
        );
    });
}

// =====================================================
// ANIMATIONS-PROMPT
// =====================================================

function formatPrompt(text) {
    const instruction = String(text || "")
        .trim()
        .slice(0, 1500);

    return [
        "Animate the uploaded reference image.",
        "Preserve the original subject identity.",
        "Keep logo letters, colors and composition.",
        "Do not change existing text.",
        "Do not introduce unwanted objects.",
        "Use smooth cinematic motion.",
        "Maintain temporal consistency.",
        "No watermark.",
        instruction
    ].join(" ");
}

// =====================================================
// FFMPEG
// =====================================================

function ffmpeg(args) {
    return new Promise((resolve, reject) => {
        const processHandle = spawn(
            process.env.FFMPEG_PATH || "ffmpeg",
            [
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                ...args
            ],
            {
                windowsHide: true
            }
        );

        let errorOutput = "";
        let settled = false;

        function fail(error) {
            if (settled) return;
            settled = true;
            reject(error);
        }

        processHandle.stderr.on("data", chunk => {
            errorOutput += chunk.toString();

            if (errorOutput.length > 4000) {
                errorOutput = errorOutput.slice(-4000);
            }
        });

        processHandle.on("error", fail);

        processHandle.on("close", code => {
            if (settled) return;

            settled = true;

            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        "FFmpeg-Fehler: " +
                        errorOutput.slice(-600)
                    )
                );
            }
        });
    });
}

// =====================================================
// COMFYUI API
// =====================================================

async function comfyRequest(endpoint, options = {}) {
    const response = await fetch(
        COMFY + endpoint,
        {
            ...options,
            signal: AbortSignal.timeout(30000)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `ComfyUI HTTP ${response.status}: ` +
            errorText.slice(0, 300)
        );
    }

    return response;
}

// =====================================================
// BILD ZU COMFYUI HOCHLADEN
// =====================================================

async function uploadImage(buffer, filename) {
    const form = new FormData();

    form.append(
        "image",
        new Blob(
            [buffer],
            {
                type: "image/png"
            }
        ),
        filename
    );

    form.append("overwrite", "false");

    const response = await comfyRequest(
        "/upload/image",
        {
            method: "POST",
            body: form
        }
    );

    const data = await response.json();

    if (!data.name) {
        throw new Error(
            "ComfyUI hat keinen Bildnamen zurückgegeben."
        );
    }

    return data.name;
}

// =====================================================
// WORKFLOW-NODE SETZEN
// =====================================================

function setNode(workflow, id, input, value) {
    const node = workflow[id];

    if (
        !node?.inputs ||
        !(input in node.inputs)
    ) {
        throw new Error(
            `Workflow-Feld ${id}.${input} fehlt.`
        );
    }

    node.inputs[input] = value;
}

// =====================================================
// FORTSCHRITT
// =====================================================

async function updateProgress(message, text) {
    if (!message) return;

    try {
        await message.edit({
            content: text
        });
    } catch (error) {
        console.warn(
            "⚠️ Animationsstatus konnte nicht aktualisiert werden:",
            error.message
        );
    }
}

// =====================================================
// LOKALE KI-ANIMATION
// =====================================================

async function runComfy(
    image,
    prompt,
    seconds,
    fps,
    jobDir,
    onProgress
) {
    const templatePath = path.join(
        __dirname,
        "workflow_api.json"
    );

    let config;

    try {
        const content = await fs.readFile(
            templatePath,
            "utf8"
        );

        config = JSON.parse(content);
    } catch {
        throw new Error(
            "workflow_api.json fehlt oder ist ungültig. " +
            "Exportiere einen echten Image-to-Video-" +
            "API-Workflow aus ComfyUI."
        );
    }

    if (
        !config.workflow ||
        !config.mapping
    ) {
        throw new Error(
            "workflow_api.json benötigt " +
            "die Felder workflow und mapping."
        );
    }

    const workflow = structuredClone(
        config.workflow
    );

    const filename = await uploadImage(
        image,
        `vexo_${crypto.randomUUID()}.png`
    );

    function setMapping(key, value) {
        const reference = config.mapping[key];

        if (!reference) return;

        setNode(
            workflow,
            String(reference.node),
            reference.input,
            value
        );
    }

    if (
        !config.mapping.image ||
        !config.mapping.prompt
    ) {
        throw new Error(
            "Workflow-Mapping für image und prompt fehlt."
        );
    }

    setMapping("image", filename);

    setMapping(
        "prompt",
        formatPrompt(prompt)
    );

    setMapping(
        "frames",
        Math.min(
            240,
            Math.max(8, seconds * fps)
        )
    );

    setMapping("fps", fps);

    onProgress(
        "🎬 KI-Modell wird gestartet. Videoframes werden generiert …"
    );

    const request = await comfyRequest(
        "/prompt",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: workflow,
                client_id: crypto.randomUUID()
            })
        }
    );

    const result = await request.json();

    if (!result.prompt_id) {
        throw new Error(
            "ComfyUI hat den Auftrag nicht angenommen: " +
            JSON.stringify(
                result.node_errors || {}
            ).slice(0, 400)
        );
    }

    const deadline = Date.now() + JOB_TIMEOUT;

    // =================================================
    // AUF COMFYUI WARTEN
    // =================================================

    while (Date.now() < deadline) {
        await new Promise(resolve => {
            setTimeout(resolve, 4000);
        });

        const response = await comfyRequest(
            "/history/" +
            encodeURIComponent(result.prompt_id)
        );

        const history = await response.json();

        const entry = history[result.prompt_id];

        if (!entry) {
            continue;
        }

        if (
            entry.status?.status_str === "error"
        ) {
            throw new Error(
                "Die KI-Generierung ist fehlgeschlagen. " +
                "Prüfe das ComfyUI-Terminal."
            );
        }

        if (!entry.outputs) {
            continue;
        }

        // =============================================
        // AUSGABEDATEI FINDEN
        // =============================================

        for (
            const output of Object.values(entry.outputs)
        ) {
            const files = [
                ...(output.gifs || []),
                ...(output.videos || [])
            ];

            const movie = files.find(file => {
                return /\.(mp4|webm|gif)$/i.test(
                    file.filename || ""
                );
            });

            if (!movie) {
                continue;
            }

            const url = new URL(
                COMFY + "/view"
            );

            url.searchParams.set(
                "filename",
                movie.filename
            );

            url.searchParams.set(
                "subfolder",
                movie.subfolder || ""
            );

            url.searchParams.set(
                "type",
                movie.type || "output"
            );

            const videoResponse = await fetch(
                url,
                {
                    signal: AbortSignal.timeout(
                        120000
                    )
                }
            );

            if (!videoResponse.ok) {
                throw new Error(
                    "ComfyUI-Ausgabedatei konnte nicht heruntergeladen werden."
                );
            }

            const extension = path
                .extname(movie.filename)
                .toLowerCase();

            const raw = path.join(
                jobDir,
                "original" + extension
            );

            await fs.writeFile(
                raw,
                Buffer.from(
                    await videoResponse.arrayBuffer()
                )
            );

            onProgress(
                "🎞️ KI-Frames fertig. MP4, GIF und WEBP werden erstellt …"
            );

            // =========================================
            // MP4
            // =========================================

            const mp4 = path.join(
                jobDir,
                "animation.mp4"
            );

            if (extension === ".mp4") {
                await fs.copyFile(raw, mp4);
            } else {
                await ffmpeg([
                    "-i",
                    raw,
                    "-an",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    mp4
                ]);
            }

            // =========================================
            // GIF
            // =========================================

            const gif = path.join(
                jobDir,
                "animation.gif"
            );

            await ffmpeg([
                "-i",
                mp4,
                "-vf",
                `fps=${Math.min(fps, 15)},` +
                "scale=512:-1:flags=lanczos," +
                "split[s0][s1];" +
                "[s0]palettegen[p];" +
                "[s1][p]paletteuse",
                "-loop",
                "0",
                gif
            ]);

            // =========================================
            // ANIMIERTES WEBP
            // =========================================

            const webp = path.join(
                jobDir,
                "animation.webp"
            );

            await ffmpeg([
                "-i",
                mp4,
                "-vf",
                "fps=12,scale=512:-1:flags=lanczos",
                "-loop",
                "0",
                "-quality",
                "75",
                webp
            ]);

            return {
                mp4,
                gif,
                webp
            };
        }

        throw new Error(
            "ComfyUI hat den Workflow beendet, " +
            "aber keine MP4-, WEBM- oder GIF-Datei erzeugt."
        );
    }

    throw new Error(
        "ComfyUI-Zeitlimit von 20 Minuten erreicht."
    );
}

// =====================================================
// ALTE DATEIEN LÖSCHEN
// =====================================================

async function cleanupOldJobs() {
    await fs.mkdir(
        BASE,
        {
            recursive: true
        }
    );

    const entries = await fs.readdir(
        BASE,
        {
            withFileTypes: true
        }
    );

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const directory = path.join(
            BASE,
            entry.name
        );

        const stats = await fs.stat(
            directory
        ).catch(() => null);

        if (
            stats &&
            Date.now() - stats.mtimeMs > CLEANUP_AGE
        ) {
            await fs.rm(
                directory,
                {
                    recursive: true,
                    force: true
                }
            ).catch(() => {});
        }
    }
}

// =====================================================
// DISCORD-NACHRICHT VERARBEITEN
// =====================================================

async function handleAnimationMessage(message) {
    if (
        !message?.guild ||
        message.author?.bot
    ) {
        return false;
    }

    if (
        !isKIChatChannel(
            message.guild.id,
            message.channel.id
        )
    ) {
        return false;
    }

    const key = sessionKey(message);

    const attachment = extractImage(message);

    // =================================================
    // NEUES BILD
    // =================================================

    if (attachment) {
        try {
            const response = await fetch(
                attachment.url,
                {
                    signal: AbortSignal.timeout(
                        20000
                    )
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Bild konnte nicht heruntergeladen werden."
                );
            }

            const buffer = Buffer.from(
                await response.arrayBuffer()
            );

            if (
                buffer.length > MAX_BYTES ||
                buffer.length < 100
            ) {
                throw new Error(
                    "Ungültige Bildgröße. Maximal 8 MB."
                );
            }

            sessions.set(
                key,
                {
                    image: buffer,
                    expires: Date.now() + SESSION_TIMEOUT
                }
            );

            await message.reply({
                content:
                    "💙 **Bild erkannt!**\n\n" +
                    "Was möchtest du mit deinem Bild machen?\n\n" +
                    "🎬 Animieren\n" +
                    "⚡ Blitze und Effekte\n" +
                    "🔥 Feuer und Rauch\n" +
                    "✨ Neon und Partikel\n" +
                    "🎃 Halloween-Animation\n\n" +
                    "Beschreibe einfach deine gewünschte Bewegung.\n\n" +
                    "**Beispiel:** „Lass mein Logo schweben, " +
                    "mit blauen Blitzen und Nebel, 5 Sekunden.“",
                allowedMentions: {
                    repliedUser: false
                }
            });

            return true;

        } catch (error) {
            await message.reply({
                content:
                    "❌ Bild konnte nicht verarbeitet werden: " +
                    error.message,
                allowedMentions: {
                    repliedUser: false
                }
            });

            return true;
        }
    }

    // =================================================
    // VORHANDENE SITZUNG
    // =================================================

    const session = sessions.get(key);

    if (!session) {
        return false;
    }

    if (session.expires < Date.now()) {
        sessions.delete(key);
        return false;
    }

    const text = (
        message.content || ""
    ).trim();

    if (!text) {
        return false;
    }

    // =================================================
    // ABBRECHEN
    // =================================================

    if (
        /^(abbrechen|stopp|cancel)$/i.test(text)
    ) {
        sessions.delete(key);

        await message.reply(
            "🗑️ Animation abgebrochen."
        );

        return true;
    }

    // =================================================
    // AUSLASTUNG
    // =================================================

    if (active >= MAX_ACTIVE) {
        await message.reply(
            "⏳ Der lokale Animationsrechner ist beschäftigt. " +
            "Bitte versuche es später erneut."
        );

        return true;
    }

    active++;

    let status = null;

    const jobDir = path.join(
        BASE,
        crypto.randomUUID()
    );

    try {
        await cleanupOldJobs();

        await fs.mkdir(
            jobDir,
            {
                recursive: true
            }
        );

        // =============================================
        // STATUS STARTEN
        // =============================================

        status = await message.reply({
            content:
                "🔍 **Bild wird analysiert …**\n" +
                "🎬 Animation wird vorbereitet.",
            allowedMentions: {
                repliedUser: false
            }
        });

        // =============================================
        // DAUER ERKENNEN
        // =============================================

        const seconds =
            /\b10\s*(?:sek|s\b)/i.test(text)
                ? 10
                : /\b3\s*(?:sek|s\b)/i.test(text)
                    ? 3
                    : 5;

        const fps = 12;

        await updateProgress(
            status,
            "🎬 **KI-Animation läuft …**\n" +
            "Die Videoframes werden lokal generiert.\n" +
            "Das kann mehrere Minuten dauern."
        );

        // =============================================
        // ECHTE KI-GENERIERUNG
        // =============================================

        const output = await runComfy(
            session.image,
            text,
            seconds,
            fps,
            jobDir,
            progress => {
                updateProgress(
                    status,
                    progress
                ).catch(() => {});
            }
        );

        // =============================================
        // DATEIEN VORBEREITEN
        // =============================================

        const files = [];

        for (
            const [name, filename]
            of Object.entries(output)
        ) {
            const stats = await fs.stat(
                filename
            );

            if (
                stats.size <= MAX_BYTES
            ) {
                files.push(
                    new AttachmentBuilder(
                        filename,
                        {
                            name:
                                `vexo-animation.${name}`
                        }
                    )
                );
            }
        }

        if (!files.length) {
            throw new Error(
                "Die Animation ist größer als das " +
                "eingestellte Uploadlimit. " +
                "Dateien wurden lokal gespeichert unter: " +
                jobDir
            );
        }

        // =============================================
        // ERGEBNIS SENDEN
        // =============================================

        await status.edit({
            content:
                "✅ **VEXO RP • KI-ANIMATION FERTIG!**\n\n" +
                "🎬 Deine Animation wurde erstellt.\n" +
                "📥 MP4, GIF und WEBP können direkt " +
                "heruntergeladen werden.\n\n" +
                "💙 Für Änderungen beschreibe " +
                "einfach deinen nächsten Wunsch.",
            files
        });

    } catch (error) {
        console.error(
            "❌ KI-Animation:",
            error
        );

        const errorMessage =
            "❌ **Animation konnte nicht erstellt werden.**\n\n" +
            String(error.message).slice(0, 1400);

        if (status) {
            await updateProgress(
                status,
                errorMessage
            );
        } else {
            await message.reply({
                content: errorMessage,
                allowedMentions: {
                    repliedUser: false
                }
            }).catch(() => {});
        }

    } finally {
        active--;
    }

    return true;
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    handleAnimationMessage
};
