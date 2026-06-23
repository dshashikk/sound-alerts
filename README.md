# Sound Alerts

Audio cues for the [Cursor](https://cursor.com) agent: 🔔 a **bell** the moment
the agent finishes responding.

Cursor's chat UI isn't exposed to the extension API, but Cursor *does* support
[Hooks](https://docs.cursor.com) — scripts it runs at agent lifecycle events. On
activation this extension installs a **`stop` hook** (into `~/.cursor/hooks.json`)
that plays your bell sound the instant the agent completes. That makes the alert
event-driven and reliable, with no polling and no false positives.

## Features

- 🔔 Bell on agent completion, driven by Cursor's `stop` hook (instant, reliable).
- Installs/updates the hook automatically; preserves any other hooks you have.
- Status-bar counter of bells rung; click to preview sounds.
- Configurable sound + player command. Disabling the extension removes the hook.
- Commands: `Sound Alerts: Test Sounds`, `Reinstall Hook`, `Remove Hook`.

> Note: the bell is the agent-completion alert. A distinct "question/MCQ"
> warning isn't currently available as a hook event; the `warningSound` setting
> is used by the test command and reserved for the future.

## Install

From a packaged `.vsix`:

```bash
cursor --install-extension sound-alerts-<version>.vsix
# or, in VS Code:
code --install-extension sound-alerts-<version>.vsix
```

Then reload the window (**Developer: Reload Window**) so the hook is installed.

> This is a **Cursor** feature — it relies on Cursor's hooks. In plain VS Code the
> extension installs and the test command works, but there's no agent `stop`
> event to ring the bell.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `soundAlerts.enabled` | `true` | Master on/off. Turning off removes the hook. |
| `soundAlerts.bellSound` | `/System/Library/Sounds/Glass.aiff` | Sound played on agent completion. |
| `soundAlerts.warningSound` | `/System/Library/Sounds/Sosumi.aiff` | Used by the test command (reserved for a future question alert). |
| `soundAlerts.playerCommand` | `afplay` | Player binary. |

### Cross-platform players

- **macOS:** `afplay` (built in).
- **Linux:** `paplay` or `aplay` (use `.wav`/`.ogg` sound paths).
- **Windows:** set `playerCommand` to a script/`powershell` that plays a sound.

## Development

```bash
npm install
npm run package        # build the .vsix (vsce)
```

## How it works

On activation the extension:

1. Writes a small bell script to `~/.cursor/hooks/sound-alerts-bell.sh`.
2. Merges a `stop` entry into `~/.cursor/hooks.json` (keeping your other hooks).

Cursor runs that script the moment the agent finishes, which plays the bell —
event-driven, instant, and with no transcript polling. Changing the sound/player
settings regenerates the script; disabling the extension (or running
**Remove Hook**) removes both the script and the `hooks.json` entry.

## Limitations

- Cursor-only (depends on Cursor Hooks).
- The bell fires on agent completion. There's no hook event for "agent asked an
  MCQ", so a distinct question warning isn't available yet.
- Uninstalling the extension doesn't auto-clean the hook (extensions have no
  reliable uninstall step); run **Sound Alerts: Remove Hook** first, or delete
  the `stop` entry from `~/.cursor/hooks.json` manually.
- Sound playback shells out to `playerCommand`; configure it per OS.

## License

MIT — see [LICENSE](./LICENSE).
