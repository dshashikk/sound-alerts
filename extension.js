const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

let watcher = null;
let output = null;
const debounceTimers = new Map(); // filePath -> timeout
const handledLen = new Map(); // filePath -> byte length already acted on

function cfg() {
    const c = vscode.workspace.getConfiguration('soundAlerts');
    return {
        enabled: c.get('enabled', true),
        bell: c.get('bellSound', '/System/Library/Sounds/Glass.aiff'),
        warning: c.get('warningSound', '/System/Library/Sounds/Sosumi.aiff'),
        player: c.get('playerCommand', 'afplay'),
        idleMs: c.get('idleMs', 1500)
    };
}

function play(sound) {
    const { player } = cfg();
    try {
        const child = cp.spawn(player, [sound], { detached: true, stdio: 'ignore' });
        child.unref();
    } catch (e) {
        log('play error: ' + e.message);
    }
}

function log(msg) {
    if (output) output.appendLine('[' + new Date().toISOString() + '] ' + msg);
}

// Read up to maxBytes from the end of the file (transcripts are append-mostly).
function readTail(file, maxBytes) {
    const stat = fs.statSync(file);
    const start = Math.max(0, stat.size - maxBytes);
    const len = stat.size - start;
    const fd = fs.openSync(file, 'r');
    try {
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, start);
        return { text: buf.toString('utf8'), size: stat.size };
    } finally {
        fs.closeSync(fd);
    }
}

// Classify the most recent assistant message:
//   'question' -> ends on an AskQuestion tool call (agent is waiting on you)
//   'final'    -> text-only assistant message (turn complete, results ready)
//   'working'  -> ends on another tool call (still doing work)
//   null       -> indeterminate
function classifyLatest(text) {
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        let o;
        try { o = JSON.parse(line); } catch (e) { continue; }
        if (!o || o.role !== 'assistant') continue;
        const content = (o.message && Array.isArray(o.message.content)) ? o.message.content : [];
        if (!content.length) continue;
        const toolUses = content.filter(c => c && c.type === 'tool_use');
        if (toolUses.some(c => c.name === 'AskQuestion')) return 'question';
        if (toolUses.length === 0) return 'final';
        return 'working';
    }
    return null;
}

function onTranscriptChange(file) {
    const { enabled, idleMs } = cfg();
    if (!enabled) return;
    if (debounceTimers.has(file)) clearTimeout(debounceTimers.get(file));
    debounceTimers.set(file, setTimeout(() => {
        debounceTimers.delete(file);
        let info;
        try { info = readTail(file, 65536); } catch (e) { return; }
        const prev = handledLen.get(file);
        if (prev !== undefined && info.size <= prev) return; // nothing new since last action
        const cls = classifyLatest(info.text);
        if (cls === 'working' || cls === null) return; // more is coming; don't mark handled
        handledLen.set(file, info.size);
        if (cls === 'question') {
            log('warning (AskQuestion) <- ' + file);
            play(cfg().warning);
        } else if (cls === 'final') {
            log('bell (turn complete) <- ' + file);
            play(cfg().bell);
        }
    }, idleMs));
}

function activate(context) {
    output = vscode.window.createOutputChannel('Sound Alerts');
    const base = path.join(os.homedir(), '.cursor', 'projects');
    try {
        watcher = fs.watch(base, { recursive: true }, (event, filename) => {
            if (!filename) return;
            const fp = path.join(base, filename);
            if (!fp.includes(path.sep + 'agent-transcripts' + path.sep)) return;
            if (!fp.endsWith('.jsonl')) return;
            onTranscriptChange(fp);
        });
        log('watching ' + base);
    } catch (e) {
        log('watch error: ' + e.message);
        vscode.window.showWarningMessage('Sound Alerts: could not watch transcripts: ' + e.message);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('soundAlerts.testSounds', () => {
            const c = cfg();
            play(c.warning);
            setTimeout(() => play(c.bell), 1200);
            vscode.window.showInformationMessage('Sound Alerts: played warning, then bell.');
        }),
        { dispose: () => { try { watcher && watcher.close(); } catch (e) {} } }
    );
}

function deactivate() {
    try { watcher && watcher.close(); } catch (e) {}
}

module.exports = { activate, deactivate };
