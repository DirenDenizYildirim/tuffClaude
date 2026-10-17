# tuffClaude

Mods for Claude Code.

## opencode-style

Makes Claude Code look and feel like [opencode](https://github.com/sst/opencode): its themes, sidebar, tool rows, prompt footer and commands, plus some extras.

- **Themes**: all of opencode's themes. `/themes` opens a picker that previews each one live across the whole UI as you move through the list; Enter keeps it, Esc goes back.
- **Sidebar**: session title, context use, MCP servers, todos and modified files (`/sidebar`).
- **Spinners**: `/spinner` opens a gallery of animated styles. The default, `auto`, changes with what Claude is doing: a shimmer while thinking, a wave while writing, "Reading app.ts" or "Running npm test" during tools.
- **Context gauge**: a small bar in the prompt footer's right corner that fills green to amber to red as the context window does.
- **Timeline**: `/minimap` shows the session as a timeline, one row per turn with a colored tick per tool call, errors and slow calls marked.
- **Agents tab**: when Claude launches a subagent, an Agents tab opens beside the sidebar (`/agents` toggles it), its title counting the ones running. Each agent gets a card: its type and model, the goal, a tick per tool call, what it is doing now, and its tokens, cost and time. Cost is estimated from token counts at Anthropic's API prices, since Claude Code reports no per-agent cost.
- **Commands**: `/new`, `/sessions`, `/models`, `/undo`, `/mcps`, `/details`.

Good to know:

- Picking a theme writes a custom Claude Code theme to `~/.claude/themes/opencode.json` and switches Claude Code's `theme` setting to it, so Claude Code's own UI is recolored too (where the setting can't be changed, a toast says to pick "opencode" in `/theme`). It also sets the terminal's background color, and resets it when the session ends.
- The timeline reads past turns back from the session's transcript with `python3`. Without it, only turns from after the mod loaded are shown.
- The sidebar and timeline dock beside the transcript in fullscreen and open once the terminal is wide enough.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install opencode-style --marketplace DirenDenizYildirim/tuffClaude
```

Answer `y` to add the marketplace, then pick a scope (the user scope is first; Enter takes it).

From a shell:

```
claude plugin install opencode-style --marketplace DirenDenizYildirim/tuffClaude
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `DirenDenizYildirim/tuffClaude`, then Add plugin.
