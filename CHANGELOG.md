# Changelog

All notable changes to this project are documented here.

## [0.0.1] - 2026-06-23

### Added
- Initial release.
- Watches Cursor agent transcripts (`~/.cursor/projects/*/agent-transcripts/**/*.jsonl`).
- Plays a **bell** when the agent finishes a turn (latest message is text-only).
- Plays a **warning** when the agent asks a question (latest message ends on an `AskQuestion` tool call).
- Configurable sounds, player command, and idle debounce.
- `Cursor Sound Alerts: Test Sounds` command.
