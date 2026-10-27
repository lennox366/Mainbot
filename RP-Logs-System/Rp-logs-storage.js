const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "rp-logs.json");

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), "utf8");
    }
}

function loadAll() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        return JSON.parse(raw || "{}");
    } catch (error) {
        console.error("❌ [RP-Logs] Konnte rp-logs.json nicht laden:", error);
        return {};
    }
}

function saveAll(data) {
    try {
        ensureDataFile();
        // WICHTIG: webhookToken landet mit in dieser Datei, damit der Bot ihn
        // wiederverwenden kann. Diese Datei darf NIEMALS öffentlich einsehbar
        // sein und wird nirgendwo geloggt oder ausgegeben.
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ [RP-Logs] Konnte rp-logs.json nicht speichern:", error);
        return false;
    }
}

let cache = loadAll();

function defaultConfig(guildId) {
    return {
        guildId: guildId,

        // ---------- eigener, von NoVex RP erstellter RP-Webhook ----------
        webhookId: null,
        webhookToken: null,
        webhookGuildId: null,
        webhookChannelId: null,
        webhookCreatedAt: null,

        // ---------- manueller Webhook (für Mainboard, etc.) ----------
        manualWebhookUrl: null,
        manualWebhookName: null,

        // ---------- Anzeige-Einstellungen ----------
        channelId: null,
        webPanelChannelId: null,
        webPanelMessageId: null,

        enabled: false,
        logsSent: 0,
        failedLogs: 0,
        lastLog: null
    };
}

function getGuildConfig(guildId) {
    if (!cache[guildId]) {
        cache[guildId] = defaultConfig(guildId);
        saveAll(cache);
    }
    return cache[guildId];
}

function updateGuildConfig(guildId, patch) {
    const config = getGuildConfig(guildId);
    Object.assign(config, patch);
    cache[guildId] = config;
    saveAll(cache);
    return config;
}

// =====================================================
// 🔗 EIGENER RP-WEBHOOK (von NoVex RP erstellt & verwaltet)
// =====================================================

function hasRpWebhook(guildId) {
    const config = getGuildConfig(guildId);
    return Boolean(config.webhookId && config.webhookToken);
}

function setRpWebhook(guildId, { id, token, channelId }) {
    return updateGuildConfig(guildId, {
        webhookId: id,
        webhookToken: token,
        webhookGuildId: guildId,
        webhookChannelId: channelId,
        webhookCreatedAt: new Date().toISOString(),
        enabled: true
    });
}

function removeRpWebhook(guildId) {
    return updateGuildConfig(guildId, {
        webhookId: null,
        webhookToken: null,
        webhookGuildId: null,
        webhookChannelId: null,
        webhookCreatedAt: null,
        enabled: false
    });
}

// =====================================================
// 🔗 MANUELLER WEBHOOK (für Mainboard, etc.)
// =====================================================

function hasManualWebhook(guildId) {
    const config = getGuildConfig(guildId);
    return Boolean(config.manualWebhookUrl);
}

function setManualWebhook(guildId, url, name = "Manueller Webhook") {
    return updateGuildConfig(guildId, {
        manualWebhookUrl: url,
        manualWebhookName: name,
        enabled: true
    });
}

function removeManualWebhook(guildId) {
    return updateGuildConfig(guildId, {
        manualWebhookUrl: null,
        manualWebhookName: null,
        enabled: false
    });
}

function getManualWebhookUrl(guildId) {
    const config = getGuildConfig(guildId);
    return config.manualWebhookUrl || null;
}

function setLogChannel(guildId, channelId) {
    return updateGuildConfig(guildId, { channelId });
}

function setWebPanel(guildId, channelId, messageId) {
    return updateGuildConfig(guildId, {
        webPanelChannelId: channelId,
        webPanelMessageId: messageId
    });
}

function registerLogSuccess(guildId) {
    const config = getGuildConfig(guildId);
    config.logsSent = Number(config.logsSent || 0) + 1;
    config.lastLog = new Date().toISOString();
    cache[guildId] = config;
    saveAll(cache);
    return config;
}

function registerLogFailure(guildId) {
    const config = getGuildConfig(guildId);
    config.failedLogs = Number(config.failedLogs || 0) + 1;
    cache[guildId] = config;
    saveAll(cache);
    return config;
}

function reload() {
    cache = loadAll();
    return cache;
}

module.exports = {
    getGuildConfig,
    updateGuildConfig,
    hasRpWebhook,
    setRpWebhook,
    removeRpWebhook,
    hasManualWebhook,
    setManualWebhook,
    removeManualWebhook,
    getManualWebhookUrl,
    setLogChannel,
    setWebPanel,
    registerLogSuccess,
    registerLogFailure,
    reload
};