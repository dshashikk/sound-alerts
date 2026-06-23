const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

let output = null;
let statusItem = null;
let pollTimer = null;
const state = new Map(); // file -> { size, lastGrow, evaluatedSize }
const counts = { bell: 0, warning: 0 };

function cfg() {
    const c = vscode.workspace.getConfiguration('soundAlerts');
    return {
        enabled: c.get('enabled', true),
        bell: c.get('bellSound', '/System/Library/Sounds/Glass.aiff'),
        warning: c.get('warningSound', '/System/Library/Sounds/Sosumi.aiff'),
        player: c.get('playerCommand', 'afplay'),
        idleMs: c.get('idleMs', 1500),
        pollMs: c.get('pollMs', 400)
    };
}

function log(msg) {
    if (output) output.appendLine('[' + new Date().toISOString() + '] ' + msg);
}

function play(sound) {
    try {
        const child = cp.spawn(cfg().player, [sound], { detached: true, stdio: 'ignore' });
        child.unref();
    } catch (e) {
        log('play error: ' + e.message);
    }
}

// Cursor writes agent transcripts here.
function transcriptsRoot() {
    return path.join(os.homedir(), '.cursor', 'projects');
}

function readTail(file, maxBytes) {
    const stat = fs.statSync(file);
    const start = Math.max(0, stat.size - maxBytes);
    const len = stat.size - start;
    const fd = fs.openSync(file, 'r');
    try {
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, start);
        return buf.toString('utf8');
    } finally {
        fs.closeSync(fd);
    }
}

// 'question' | 'final' | 'working' | null  (based on the latest assistant message)
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

// Find recently-modified Cursor transcript .jsonl files (active conversations).
// Layout: ~/.cursor/projects/<project>/agent-transcripts/<conv>/<conv>.jsonl
function findTranscripts() {
    const out = [];
    const cutoff = Date.now() - 10 * 60 * 1000;
    const root = transcriptsRoot();
    let projects = [];
    try { projects = fs.readdirSync(root); } catch (e) { return out; }
    for (const p of projects) {
        const at = path.join(root, p, 'agent-transcripts');
        let convs = [];
        try { convs = fs.readdirSync(at); } catch (e) { continue; }
        for (const c of convs) {
            const dir = path.join(at, c);
            let files = [];
            try { files = fs.readdirSync(dir); } catch (e) { continue; }
            for (const f of files) {
                if (!f.endsWith('.jsonl')) continue;
                const fp = path.join(dir, f);
                try {
                    const st = fs.statSync(fp);
                    if (st.mtimeMs >= cutoff) out.push({ fp, size: st.size });
                } catch (e) { /* ignore */ }
            }
        }
    }
    return out;
}

function updateStatus() {
    if (!statusItem) return;
    statusItem.text = '$(bell) ' + counts.bell + '  $(warning) ' + counts.warning;
    statusItem.tooltip = 'Sound Alerts active\nbells: ' + counts.bell + ', warnings: ' + counts.warning + '\nClick to test sounds';
}

function poll() {
    const { enabled, idleMs } = cfg();
    if (!enabled) return;
    const now = Date.now();

    for (const { fp, size } of findTranscripts()) {
        let st = state.get(fp);
        if (!st) {
            // First time we see this file: baseline it so we don't replay history.
            state.set(fp, { size, lastGrow: now, evaluatedSize: size });
            continue;
        }
        if (size > st.size) {
            st.size = size;
            st.lastGrow = now;
        }
    }

    // Wait for write-idle, then classify the latest assistant message.
    for (const [fp, st] of state) {
        if (st.size > st.evaluatedSize && (now - st.lastGrow) >= idleMs) {
            st.evaluatedSize = st.size; // evaluate this size once
            let cls = null;
            try { cls = classifyLatest(readTail(fp, 131072)); } catch (e) { continue; }
            if (cls === 'question') {
                counts.warning++; updateStatus(); log('warning (AskQuestion) <- ' + fp); play(cfg().warning);
            } else if (cls === 'final') {
                counts.bell++; updateStatus(); log('bell (turn complete) <- ' + fp); play(cfg().bell);
            }
            // 'working' / null: nothing; will re-evaluate when the file grows again.
        }
    }
}

function activate(context) {
    output = vscode.window.createOutputChannel('Sound Alerts');
    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusItem.command = 'soundAlerts.testSounds';
    updateStatus();
    statusItem.show();
    log('activated; polling ' + transcriptsRoot());

    pollTimer = setInterval(poll, cfg().pollMs);

    context.subscriptions.push(
        vscode.commands.registerCommand('soundAlerts.testSounds', () => {
            const c = cfg();
            play(c.warning);
            setTimeout(() => play(c.bell), 1200);
            vscode.window.showInformationMessage('Sound Alerts: played warning, then bell.');
        }),
        statusItem,
        { dispose: () => { try { clearInterval(pollTimer); } catch (e) {} } }
    );
}

function deactivate() {
    try { clearInterval(pollTimer); } catch (e) {}
}

module.exports = { activate, deactivate };
