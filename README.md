# Sound Alerts

Audio cues for the [Cursor](https://cursor.com) agent. It plays:

- 🔔 a **bell** when the agent finishes a turn (results ready), and
- ⚠️ a **warning** when the agent asks you a question / MCQ.

Cursor's chat UI isn't exposed to the extension API, so this works by **watching
the agent transcript files** Cursor writes at
`~/.cursor/projects/*/agent-transcripts/**/*.jsonl`. When a transcript goes
write-idle, the extension classifies the latest assistant message and plays the
matching sound.

## Features

- Bell on turn completion, warning on `AskQuestion`.
- No sound while the agent is still working (mid tool-calls).
- Fully configurable sounds, player command, and debounce.
- `Sound Alerts: Test Sounds` command to preview.

## Install

From a packaged `.vsix`:

```bash
cursor --install-extension sound-alerts-<version>.vsix
# or, in VS Code:
code --install-extension sound-alerts-<version>.vsix
```

Then reload the window (**Developer: Reload Window**).

> The automatic sounds trigger on **Cursor agent** activity. In plain VS Code the
> extension installs and the test command works, but there are no Cursor
> transcripts to watch unless Cursor's agent is running.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `soundAlerts.enabled` | `true` | Master on/off. |
| `soundAlerts.bellSound` | `/System/Library/Sounds/Glass.aiff` | Sound on turn completion. |
| `soundAlerts.warningSound` | `/System/Library/Sounds/Sosumi.aiff` | Sound on question/MCQ. |
| `soundAlerts.playerCommand` | `afplay` | Player binary. |
| `soundAlerts.idleMs` | `1500` | Write-idle debounce before classifying. |
| `soundAlerts.pollMs` | `400` | How often (ms) to scan transcripts for changes. Applied on reload. |

### Cross-platform players

- **macOS:** `afplay` (built in).
- **Linux:** `paplay` or `aplay` (use `.wav`/`.ogg` sound paths).
- **Windows:** set `playerCommand` to a script/`powershell` that plays a sound.

## Development

```bash
npm install
npm run package        # build the .vsix (vsce)
```

## How it works (detail)

Each transcript line is a JSON object. The extension reads the tail of the
changed file and finds the most recent `role: "assistant"` message:

- ends on a `tool_use` named `AskQuestion` → **warning**
- text-only (no `tool_use`) → **bell**
- ends on another `tool_use` → still working, no sound

## Limitations

- Reactive (small delay) and dependent on Cursor's transcript JSON format, which
  a future Cursor update could change.
- Sound playback shells out to `playerCommand`; configure it per OS.

## License

MIT — see [LICENSE](./LICENSE).
