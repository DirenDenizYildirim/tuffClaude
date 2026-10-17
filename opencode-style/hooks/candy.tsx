// The eye candy: the working row's spinners, the context gauge in the prompt footer, the session
// timeline pane and the theme studio's live preview. Each drawn from plain data and the Look.

import type { RenderElement } from 'claude-code'

import type { OcAgent, OcLane, OcTick, OcUsage } from '../types'
import { agentLabel, shortModel } from './agents'
import type { Look } from './draw'
import { clip, formatMs, formatUsd } from './format'
import { mix, type Palette } from './palette'
import { type Cell, type DrawnStyle, shimmerCells, spinGlyph, SPINNER_NOTES, spinnerCells, SPINNERS, type SpinnerStyle } from './spinners'

function cellsOf(look: Look, cells: Cell[]) {
  const { Text } = look.ui

  return cells.map(cell => <Text color={cell.color}>{cell.glyph}</Text>)
}

// ── Spinner ─────────────────────────────────────────────────────────────────

// Where Claude Code's spinner line was: the style's glyphs, the word, the time so far.
export function spinnerRow(look: Look, style: DrawnStyle, frame: number, word: string, elapsedMs: number) {
  const { Box, Text } = look.ui
  const { p } = look

  return (
    <Box paddingLeft={3}>
      <Text wrap="truncate-end">
        {cellsOf(look, spinnerCells(style, frame, p))}
        {' '}
        {style === 'shimmer' ? cellsOf(look, shimmerCells(word, frame, p.textMuted, p.text)) : <Text color={p.textMuted}>{word}</Text>}
        <Text color={p.textMuted}>{elapsedMs >= 1000 ? ` · ${formatMs(elapsedMs)}` : ''}</Text>
      </Text>
    </Box>
  )
}

// Every style at once, animating, each a row to pick: what /spinner opens.
export function spinnerGallery(look: Look, frame: number, current: SpinnerStyle, onPick: (style: SpinnerStyle) => void) {
  const { Box, Button, Text } = look.ui
  const { p } = look
  const sample = (style: SpinnerStyle): Cell[] => {
    const drawn: DrawnStyle = style === 'auto' ? autoCycle(frame) : style
    const word = style === 'auto' ? (AUTO_WORDS[drawn] ?? 'Working') : 'Thinking'
    const cells = spinnerCells(drawn, frame, p)
    const pad = Array.from({ length: Math.max(0, 9 - cells.length) }, () => ({ glyph: ' ', color: p.textMuted }))
    const text = drawn === 'shimmer' ? shimmerCells(word, frame, p.textMuted, p.text) : [...word].map(glyph => ({ glyph, color: p.textMuted }))

    return [...cells, ...pad, { glyph: ' ', color: p.textMuted }, ...text]
  }

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} gap={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={p.text} bold>
          {'Spinners'}
        </Text>
        <Text>
          <Text color={p.text}>{'enter'}</Text>
          <Text color={p.textMuted}>{' pick  '}</Text>
          <Text color={p.text}>{'esc'}</Text>
          <Text color={p.textMuted}>{' close'}</Text>
        </Text>
      </Box>
      <Box flexDirection="column">
        {SPINNERS.map(style => (
          <Box flexDirection="row" gap={2}>
            <Box width={12} flexShrink={0}>
              <Button key={`spinner-${style}`} plain {...(style === current ? { autoFocus: true as const } : {})} onPress={() => onPick(style)}>
                <Text color={style === current ? p.primary : p.textMuted}>{style === current ? '● ' : '  '}</Text>
                <Text color={style === current ? p.text : p.textMuted}>{style}</Text>
              </Button>
            </Box>
            <Box width={22} flexShrink={0}>
              <Text>{cellsOf(look, sample(style))}</Text>
            </Box>
            <Text color={p.textMuted} wrap="truncate-end">
              {SPINNER_NOTES[style]}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// What `auto` shows off in the gallery: each of its moods for a couple of seconds.
const AUTO_MOODS: DrawnStyle[] = ['shimmer', 'wave', 'orbit', 'bounce', 'braille', 'pulse']
const AUTO_WORDS: Partial<Record<DrawnStyle, string>> = { shimmer: 'Thinking', wave: 'Writing', orbit: 'Reading', bounce: 'Editing', braille: 'Running', pulse: 'Waiting' }
const autoCycle = (frame: number): DrawnStyle => AUTO_MOODS[Math.floor(frame / 50) % AUTO_MOODS.length] ?? 'braille'

// ── Context gauge ───────────────────────────────────────────────────────────

// Green while there is room, amber past half, red near the end.
export function heat(p: Palette, k: number): string {
  if (k <= 0.5) return p.success
  if (k <= 0.75) return mix(p.warning, p.success, (k - 0.5) / 0.25)

  return mix(p.error, p.warning, Math.min(1, (k - 0.75) / 0.2))
}

export const percentOf = (usage: OcUsage): number | undefined =>
  usage.percent ?? (usage.tokens === undefined || usage.window <= 0 ? undefined : (usage.tokens / usage.window) * 100)

// The prompt footer's corner: a short bar that fills as the context window does, `━━━━╸───── 45% · $1.20`.
export function miniGauge(look: Look, usage: OcUsage, cells = 10) {
  const { Text } = look.ui
  const { p } = look
  const percent = Math.max(0, Math.min(100, percentOf(usage) ?? 0))
  const filled = (percent / 100) * cells
  const whole = Math.floor(filled)
  const empty = mix(p.textMuted, p.background, 0.3)
  const bar: RenderElement[] = []

  for (let i = 0; i < cells; i += 1) {
    if (i < whole) {
      bar.push(<Text color={heat(p, (i + 1) / cells)}>{'━'}</Text>)
    } else if (i === whole && filled - whole >= 0.5) {
      bar.push(<Text color={heat(p, (i + 1) / cells)}>{'╸'}</Text>)
    } else {
      bar.push(<Text color={empty}>{'━'}</Text>)
    }
  }

  return (
    <Text>
      {bar}
      <Text color={heat(p, percent / 100)}>{` ${Math.round(percent)}%`}</Text>
      <Text color={p.textMuted}>{usage.usd === undefined ? '' : ` · ${formatUsd(usage.usd)}`}</Text>
    </Text>
  )
}

// ── Agents ──────────────────────────────────────────────────────────────────

const compact = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)))
const dollars = (usd: number): string => (usd > 0 && usd < 0.01 ? '<$0.01' : formatUsd(usd))

function statusOf(look: Look, agent: OcAgent, frame: number): Cell {
  const { p } = look

  if (agent.status === 'running') return { glyph: spinGlyph(look.spinner, frame), color: p.secondary }
  if (agent.status === 'done') return { glyph: '✓', color: p.success }
  if (agent.status === 'failed') return { glyph: '✗', color: p.error }

  return { glyph: '■', color: p.textMuted }
}

// What the Session sidebar keeps of the agents: one line pointing at their tab.
export function agentsLine(look: Look, agents: OcAgent[], frame: number) {
  const { Text } = look.ui
  const { p } = look
  const running = agents.filter(agent => agent.status === 'running').length
  const total = agents.reduce((sum, agent) => sum + (agent.usd ?? 0), 0)
  const counts = running > 0 ? `${running} running` : `${agents.length} ${agents.length === 1 ? 'agent' : 'agents'}`

  return (
    <Text wrap="truncate-end">
      <Text color={p.text} bold>
        {'Agents '}
      </Text>
      {running > 0 ? <Text color={p.secondary}>{`${spinGlyph(look.spinner, frame)} `}</Text> : ''}
      <Text color={p.textMuted}>{`${counts} · ${dollars(total)} · in their tab`}</Text>
    </Text>
  )
}

// One agent as a card: a bar in its status color, its type and model, the goal, a tick per
// call it made (the timeline's colors), and what it has used.
function agentCard(look: Look, agent: OcAgent, frame: number, now: number, width: number) {
  const { Box, Text } = look.ui
  const { p } = look
  const mark = statusOf(look, agent, frame)
  const took = agent.ms ?? Math.max(0, now - agent.startedAt)
  const ticks = (agent.ticks ?? []).slice(-Math.max(4, width - 6))
  const spent = [agent.tokens > 0 ? `${compact(agent.tokens)} tokens` : '', agent.usd === undefined ? '' : dollars(agent.usd)].filter(part => part !== '').join(' · ')

  return (
    <Box borderStyle="quote" borderColor={mark.color} backgroundColor={p.backgroundPanel} paddingLeft={1} paddingRight={1} flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Text wrap="truncate-end">
          <Text color={mark.color}>{`${mark.glyph} `}</Text>
          <Text color={p.text} bold>
            {agentLabel(agent.kind)}
          </Text>
        </Text>
        <Text color={p.textMuted}>{`${agent.model === '' ? '' : shortModel(agent.model)}${agent.isBackground === true ? ' · bg' : ''}`}</Text>
      </Box>
      <Text color={p.text} wrap="truncate-end">
        {agent.goal === '' ? '…' : agent.goal}
      </Text>
      {ticks.length > 0 ? <Text>{cellsOf(look, ticks.map(tick => tickLook(p, tick)))}</Text> : ''}
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Text color={p.textMuted}>{`${agent.tools} ${agent.tools === 1 ? 'call' : 'calls'} · ${formatMs(took)}`}</Text>
        <Text color={p.textMuted}>{spent}</Text>
      </Box>
      {agent.status === 'running' && agent.activity !== undefined && agent.activity !== '' ? (
        <Text color={mix(p.textMuted, p.background, 0.7)} wrap="truncate-end">
          {`↳ ${agent.activity}`}
        </Text>
      ) : (
        ''
      )}
    </Box>
  )
}

export type AgentsTabFacts = { agents: OcAgent[]; frame: number; now: number; columns: number; rows: number }

// The Agents tab: the running agents first, then the rest, newest first; totals on top.
export function agentsTab(look: Look, t: AgentsTabFacts) {
  const { Box, Text } = look.ui
  const { p } = look
  const running = t.agents.filter(agent => agent.status === 'running')
  const total = t.agents.reduce((sum, agent) => sum + (agent.usd ?? 0), 0)
  const tokens = t.agents.reduce((sum, agent) => sum + agent.tokens, 0)
  const calls = t.agents.reduce((sum, agent) => sum + agent.tools, 0)
  const ordered = [...running.reverse(), ...t.agents.filter(agent => agent.status !== 'running').reverse()]
  // A card takes five or six rows and a gap; what does not fit is counted at the bottom.
  const fits = Math.max(1, Math.floor((t.rows - 5) / 7))
  const shown = ordered.slice(0, fits)
  const hidden = ordered.length - shown.length

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text color={p.text} bold>
            {'Agents'}
          </Text>
          <Text>
            {running.length > 0 ? <Text color={p.secondary}>{`${running.length} running · `}</Text> : ''}
            <Text color={p.textMuted}>{dollars(total)}</Text>
          </Text>
        </Box>
        <Text color={p.textMuted} wrap="truncate-end">
          {t.agents.length === 0 ? 'None yet' : `${t.agents.length} launched · ${compact(tokens)} tokens · ${calls} calls`}
        </Text>
      </Box>
      {t.agents.length === 0 ? <Text color={p.textMuted}>{'When Claude launches an agent, it shows up here: its goal, model, calls, tokens and cost.'}</Text> : ''}
      {shown.map(agent => agentCard(look, agent, t.frame, t.now, t.columns - 4))}
      {hidden > 0 ? <Text color={p.textMuted}>{`+${hidden} more`}</Text> : ''}
    </Box>
  )
}

// ── Timeline ────────────────────────────────────────────────────────────────

const KINDS: Record<string, readonly string[]> = {
  read: ['Read', 'NotebookRead'],
  search: ['Grep', 'Glob', 'LS', 'ToolSearch'],
  edit: ['Edit', 'MultiEdit', 'Write', 'NotebookEdit'],
  shell: ['Bash', 'BashOutput', 'KillShell', 'Monitor'],
  agent: ['Agent', 'Task', 'SendMessage'],
  web: ['WebFetch', 'WebSearch'],
  todo: ['TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet'],
}

export function tickKind(tool: string): string {
  for (const [kind, tools] of Object.entries(KINDS)) {
    if (tools.includes(tool)) return kind
  }

  return tool.startsWith('mcp__') ? 'web' : 'other'
}

function tickLook(p: Palette, tick: OcTick): Cell {
  if (tick.isErrored === true) return { glyph: '✗', color: p.error }

  const color: Record<string, string> = {
    read: p.primary,
    search: p.accent,
    edit: p.success,
    shell: p.warning,
    agent: p.secondary,
    web: p.info,
    todo: p.textMuted,
    wait: mix(p.textMuted, p.background, 0.6),
  }
  const glyph = tick.kind === 'wait' ? '⋯' : tick.kind === 'todo' ? '▪' : tick.isSlow === true ? '◆' : '■'

  return { glyph, color: color[tick.kind] ?? p.textMuted }
}

const clock = (at: number): string => {
  const d = new Date(at)

  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const LEGEND: [OcTick, string][] = [
  [{ kind: 'read' }, 'read'],
  [{ kind: 'search' }, 'search'],
  [{ kind: 'edit' }, 'edit'],
  [{ kind: 'shell' }, 'shell'],
  [{ kind: 'agent' }, 'agent'],
  [{ kind: 'web' }, 'web'],
  [{ kind: 'other', isErrored: true }, 'error'],
  [{ kind: 'other', isSlow: true }, 'slow'],
  [{ kind: 'wait' }, 'thinking'],
]

export type TimelineFacts = { lanes: OcLane[]; isWorking: boolean; frame: number; agentColor: string; columns: number; rows: number }

// The session top to bottom: a node per turn, its calls as colored ticks under it.
export function timeline(look: Look, t: TimelineFacts) {
  const { Box, Text } = look.ui
  const { p } = look
  const width = Math.max(8, t.columns - 4)
  const rail = mix(p.border, p.background, 0.7)
  const calls = t.lanes.reduce((n, lane) => n + lane.ticks.filter(tick => tick.kind !== 'wait').length, 0)
  const errors = t.lanes.reduce((n, lane) => n + lane.ticks.filter(tick => tick.isErrored === true).length, 0)
  const head = (
    <Box flexDirection="column">
      <Text color={p.text} bold>
        {'Timeline'}
      </Text>
      <Text color={p.textMuted} wrap="truncate-end">
        {`${t.lanes.length} ${t.lanes.length === 1 ? 'turn' : 'turns'} · ${calls} ${calls === 1 ? 'call' : 'calls'}`}
        {errors > 0 ? <Text color={p.error}>{` · ${errors} ${errors === 1 ? 'error' : 'errors'}`}</Text> : ''}
      </Text>
    </Box>
  )
  const legend = (
    <Text wrap="wrap">
      {LEGEND.map(([tick, word], i) => {
        const cell = tickLook(p, tick)

        return (
          <Text>
            <Text color={cell.color}>{`${i === 0 ? '' : '  '}${cell.glyph}`}</Text>
            <Text color={p.textMuted}>{` ${word}`}</Text>
          </Text>
        )
      })}
    </Text>
  )

  if (t.lanes.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
        {head}
        <Text color={p.textMuted}>{'Each turn shows up here as you work: its calls, errors and slow spots.'}</Text>
        {legend}
      </Box>
    )
  }

  // The newest turns that fit, drawn oldest first.
  const room = Math.max(4, t.rows - 8)
  const shown: { lane: OcLane; lines: OcTick[][] }[] = []
  let used = 0

  for (let i = t.lanes.length - 1; i >= 0; i -= 1) {
    const lane = t.lanes[i] as OcLane
    const lines: OcTick[][] = []

    for (let at = 0; at < lane.ticks.length; at += width) {
      lines.push(lane.ticks.slice(at, at + width))
    }

    const cost = 2 + lines.length

    if (shown.length > 0 && used + cost > room) break

    shown.unshift({ lane, lines })
    used += cost
  }

  const hidden = t.lanes.length - shown.length
  const lastIndex = shown.length - 1

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
      {head}
      <Box flexDirection="column">
        {hidden > 0 ? <Text color={p.textMuted}>{`↑ ${hidden} earlier ${hidden === 1 ? 'turn' : 'turns'}`}</Text> : ''}
        {shown.map(({ lane, lines }, i) => {
          const isLive = i === lastIndex && lane.ms === undefined && t.isWorking
          const node = isLive ? spinGlyph(look.spinner, t.frame) : lane.isAborted === true ? '✕' : '●'
          const nodeColor = lane.isAborted === true ? p.textMuted : t.agentColor
          const took = isLive ? '' : lane.ms === undefined ? '' : lane.isAborted === true ? 'stopped' : formatMs(lane.ms)
          const tookColor = lane.ms !== undefined && lane.ms > 120_000 ? p.warning : p.textMuted

          return (
            <Box flexDirection="column">
              <Box flexDirection="row" justifyContent="space-between">
                <Text wrap="truncate-end">
                  <Text color={nodeColor}>{`${node} `}</Text>
                  <Text color={p.textMuted}>{`${clock(lane.at)} `}</Text>
                  <Text color={p.text}>{clip(lane.prompt, Math.max(4, width - 14))}</Text>
                </Text>
                <Text color={tookColor}>{took}</Text>
              </Box>
              {lines.map(line => (
                <Text>
                  <Text color={rail}>{'│ '}</Text>
                  {cellsOf(look, line.map(tick => tickLook(p, tick)))}
                </Text>
              ))}
              {i === lastIndex ? '' : <Text color={rail}>{'│'}</Text>}
            </Box>
          )
        })}
      </Box>
      {legend}
    </Box>
  )
}

// ── Theme studio ────────────────────────────────────────────────────────────

export type ThemeEntry = { value: string; label: string; palette: Palette }

// A small scene in the theme under the cursor: its colors, a prompt, a reply, calls, a diff.
function preview(look: Look, label: string, agentColor: string) {
  const { Box, Text } = look.ui
  const { p } = look
  const swatch = [p.primary, p.secondary, p.accent, p.success, p.warning, p.error, p.info]

  return (
    <Box flexDirection="column" backgroundColor={p.background} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} gap={1} flexGrow={1}>
      <Box flexDirection="column">
        <Text color={p.text} bold>
          {label}
        </Text>
        <Text>
          {swatch.map(color => (
            <Text color={color}>{'███ '}</Text>
          ))}
        </Text>
      </Box>
      <Box borderStyle="quote" borderColor={agentColor} backgroundColor={p.backgroundPanel} paddingLeft={2} paddingRight={1}>
        <Text color={p.text}>{'make the header sticky'}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={3}>
        <Text color={p.textMuted}>{'→ Read src/header.tsx'}</Text>
        <Text color={p.textMuted}>{'← Edit src/header.tsx  +1 -1'}</Text>
        <Text color={p.diffHighlightRemoved} backgroundColor={p.diffRemovedBg}>{'-  position: relative;'}</Text>
        <Text color={p.diffHighlightAdded} backgroundColor={p.diffAddedBg}>{'+  position: sticky;'}</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={3}>
        <Text color={p.text}>
          {'The header is now '}
          <Text color={p.primary} bold>
            {'sticky'}
          </Text>
          {'.'}
        </Text>
        <Text>
          <Text color={agentColor}>{'Build'}</Text>
          <Text color={p.textMuted}>{' · Claude Opus 5.5 · 4.2s'}</Text>
        </Text>
      </Box>
    </Box>
  )
}

// Every theme as a row of its own colors; moving onto one previews it everywhere at once.
export function themeStudio(look: Look, themes: ThemeEntry[], saved: string, agentColor: string, columns: number, onPick: (value: string) => void) {
  const { Box, Button, Text } = look.ui
  const { p } = look
  const current = themes.find(theme => theme.value === look.theme)
  const list = (
    <Box flexDirection="column" flexShrink={0} width={28}>
      {themes.map(theme => (
        <Button key={`theme-${theme.value}`} plain {...(theme.value === saved ? { autoFocus: true as const } : {})} onPress={() => onPick(theme.value)}>
          <Text color={theme.palette.primary}>{'■'}</Text>
          <Text color={theme.palette.secondary}>{'■'}</Text>
          <Text color={theme.palette.accent}>{'■'}</Text>
          <Text color={theme.value === look.theme ? p.text : p.textMuted}>{` ${theme.label}`}</Text>
          <Text color={p.primary}>{theme.value === saved ? ' ●' : ''}</Text>
        </Button>
      ))}
    </Box>
  )

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} gap={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={p.text} bold>
          {'Themes'}
        </Text>
        <Text>
          <Text color={p.text}>{'↑↓'}</Text>
          <Text color={p.textMuted}>{' preview  '}</Text>
          <Text color={p.text}>{'enter'}</Text>
          <Text color={p.textMuted}>{' apply  '}</Text>
          <Text color={p.text}>{'esc'}</Text>
          <Text color={p.textMuted}>{' cancel'}</Text>
        </Text>
      </Box>
      {columns >= 72 ? (
        <Box flexDirection="row" gap={2}>
          {list}
          {preview(look, current?.label ?? look.theme, agentColor)}
        </Box>
      ) : (
        list
      )}
    </Box>
  )
}
