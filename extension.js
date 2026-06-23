const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

let output = null;
let statusItem = null;
let uiTimer = null;

const HOOKS_DIR = path.join(os.homedir(), '.cursor', 'hooks');
const HOOKS_JSON = path.join(os.homedir(), '.cursor', 'hooks.json');
const SCRIPT_PATH = path.join(HOOKS_DIR, 'sound-alerts-bell.sh');
const COUNT_FILE = path.join(HOOKS_DIR, '.sound-alerts-count');
const PAYLOAD_LOG = path.join(HOOKS_DIR, '.sound-alerts-payload.log');
const HOOK_MARKER = 'sound-alerts-bell';

function cfg() {
    const c = vscode.workspace.getConfiguration('soundAlerts');
    return {
        enabled: c.get('enabled', true),
        bell: c.get('bellSound', '/System/Library/Sounds/Glass.aiff'),
        warning: c.get('warningSound', '/System/Library/Sounds/Sosumi.aiff'),
        player: c.get('playerCommand', 'afplay')
    };
}

function log(msg) {
    if (output) output.appendLine('[' + new Date().toISOString() + '] ' + msg);
}

// Play a sound directly from the extension (used by the test command).
function play(sound) {
    try {
        const child = cp.spawn(cfg().player, [sound], { detached: true, stdio: 'ignore' });
        child.unref();
    } catch (e) {
        log('play error: ' + e.message);
    }
}

// Contents of the Cursor `stop` hook script: drains/logs the payload, plays the
// bell, and bumps a counter the status bar reads. Regenerated whenever settings
// change so the configured player/sound stay in sync.
function scriptContents() {
    const { player, bell } = cfg();
    return [
        '#!/bin/bash',
        '# Managed by the Sound Alerts Cursor extension -- do not edit by hand.',
        '# Configure via the soundAlerts.* settings; this file is regenerated.',
        'mkdir -p "' + HOOKS_DIR + '" 2>/dev/null',
        '{ printf "\\n--- %s ---\\n" "$(date)"; cat; } >> "' + PAYLOAD_LOG + '" 2>/dev/null',
        '"' + player + '" "' + bell + '" >/dev/null 2>&1 &',
        'CF="' + COUNT_FILE + '"',
        'n=$(cat "$CF" 2>/dev/null || echo 0)',
        'printf "%s" "$((n+1))" > "$CF" 2>/dev/null',
        'exit 0',
        ''
    ].join('\n');
}

function writeScript() {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    fs.writeFileSync(SCRIPT_PATH, scriptContents(), { mode: 0o755 });
    fs.chmodSync(SCRIPT_PATH, 0o755);
}

function readHooksJson() {
    if (!fs.existsSync(HOOKS_JSON)) return { version: 1, hooks: {} };
    return JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8')); // may throw on invalid JSON
}

// Write the script and merge a `stop` entry into ~/.cursor/hooks.json,
// preserving any hooks the user already has.
function installHook() {
    writeScript();
    let data;
    try {
        data = readHooksJson();
    } catch (e) {
        vscode.window.showWarningMessage(
            'Sound Alerts: ~/.cursor/hooks.json is not valid JSON, so it was left untouched. ' +
            'Fix or remove it, then run "Sound Alerts: Reinstall Hook".');
        log('hooks.json parse error: ' + e.message);
        return;
    }
    if (!data.version) data.version = 1;
    if (!data.hooks || typeof data.hooks !== 'object') data.hooks = {};
    if (!Array.isArray(data.hooks.stop)) data.hooks.stop = [];
    const present = data.hooks.stop.some(h => h && typeof h.command === 'string' && h.command.includes(HOOK_MARKER));
    if (!present) {
        data.hooks.stop.push({ command: SCRIPT_PATH });
        fs.writeFileSync(HOOKS_JSON, JSON.stringify(data, null, 2) + '\n');
        log('installed stop hook -> ' + HOOKS_JSON);
    }
}

// Remove our script and our `stop` entry, leaving any other hooks intact.
function removeHook() {
    try { if (fs.existsSync(SCRIPT_PATH)) fs.unlinkSync(SCRIPT_PATH); } catch (e) { /* ignore */ }
    if (!fs.existsSync(HOOKS_JSON)) return;
    let data;
    try { data = readHooksJson(); } catch (e) { return; }
    if (data.hooks && Array.isArray(data.hooks.stop)) {
        const before = data.hooks.stop.length;
        data.hooks.stop = data.hooks.stop.filter(
            h => !(h && typeof h.command === 'string' && h.command.includes(HOOK_MARKER)));
        if (data.hooks.stop.length !== before) {
            if (data.hooks.stop.length === 0) delete data.hooks.stop;
            fs.writeFileSync(HOOKS_JSON, JSON.stringify(data, null, 2) + '\n');
            log('removed stop hook from ' + HOOKS_JSON);
        }
    }
}

function reconcile() {
    if (cfg().enabled) installHook(); else removeHook();
}

function readCount() {
    try { return parseInt(fs.readFileSync(COUNT_FILE, 'utf8').trim(), 10) || 0; } catch (e) { return 0; }
}

function updateStatus() {
    if (!statusItem) return;
    const on = cfg().enabled;
    const n = readCount();
    statusItem.text = '$(bell) ' + n;
    statusItem.tooltip = 'Sound Alerts ' + (on ? 'active (Cursor stop hook)' : 'disabled') +
        '\nbells rung: ' + n + '\nClick to test sounds';
}

function activate(context) {
    output = vscode.window.createOutputChannel('Sound Alerts');
    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusItem.command = 'soundAlerts.testSounds';
    statusItem.show();

    try { reconcile(); } catch (e) { log('reconcile error: ' + e.message); }
    updateStatus();
    uiTimer = setInterval(updateStatus, 2000);

    context.subscriptions.push(
        vscode.commands.registerCommand('soundAlerts.testSounds', () => {
            const c = cfg();
            play(c.warning);
            setTimeout(() => play(c.bell), 1200);
            vscode.window.showInformationMessage('Sound Alerts: played warning, then bell.');
        }),
        vscode.commands.registerCommand('soundAlerts.reinstallHook', () => {
            try { installHook(); vscode.window.showInformationMessage('Sound Alerts: stop hook (re)installed.'); }
            catch (e) { vscode.window.showErrorMessage('Sound Alerts: ' + e.message); }
        }),
        vscode.commands.registerCommand('soundAlerts.removeHook', () => {
            try { removeHook(); vscode.window.showInformationMessage('Sound Alerts: stop hook removed.'); }
            catch (e) { vscode.window.showErrorMessage('Sound Alerts: ' + e.message); }
        }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('soundAlerts')) {
                try { reconcile(); } catch (err) { log('reconcile error: ' + err.message); }
                updateStatus();
            }
        }),
        statusItem,
        { dispose: () => { try { clearInterval(uiTimer); } catch (e) {} } }
    );

    log('activated; stop hook -> ' + SCRIPT_PATH);
}

function deactivate() {
    try { clearInterval(uiTimer); } catch (e) {}
}

module.exports = { activate, deactivate };
