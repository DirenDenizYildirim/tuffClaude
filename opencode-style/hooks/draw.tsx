// The rows opencode-style draws, each from plain data and the surface's element table.

import type { ElementTable, RenderElement } from 'claude-code'

import type { OcFile, OcTodo, OcUsage } from '../types'
import { miniGauge, percentOf } from './candy'
import { clip, formatCount, formatMs, formatUsd } from './format'
import { LEFT_WORD, LOGO_WIDTH, logoRuns, RIGHT_WORD, wordRows } from './logo'
import { mix, type Palette } from './palette'
import { scannerCells } from './scanner'
import { spinGlyph, type SpinnerStyle } from './spinners'
import type { Row, TodoLine } from './tools'

export type Look = { ui: ElementTable; p: Palette; theme: string; spinner: SpinnerStyle }

// ── Transcript ──────────────────────────────────────────────────────────────

// Your message: a panel with the agent's bar down its left edge.
export function userRow(look: Look, text: string, bar: string, extra?: RenderElement) {
  const { Box, Text } = look.ui
  const { p } = look

  return (
    <Box flexDirection="column">
      <Box borderStyle="quote" borderColor={bar} backgroundColor={p.backgroundPanel} paddingLeft={2} paddingRight={1} flexDirection="column">
        <Text color={p.text}>{text}</Text>
      </Box>
      {extra ?? ''}
    </Box>
  )
}

// A reply: the model's markdown, indented three cells, no bullet.
export function replyRow(look: Look, text: string) {
  const { Box, Markdown } = look.ui

  return (
    <Box paddingLeft={3} flexDirection="column">
      <Markdown text={text} />
    </Box>
  )
}

// Under a finished reply: `Build · Claude Opus 5.5 · 12.3s · 45.2 tok/s`.
export function replyFooter(look: Look, facts: { agent: string; color: string; model: string; ms: number; tps?: number; isAborted?: boolean }) {
  const { Box, Text } = look.ui
  const { p } = look
  const tail = [facts.model, formatMs(facts.ms), ...(facts.tps === undefined ? [] : [`${facts.tps.toFixed(1)} tok/s`]), ...(facts.isAborted ? ['interrupted'] : [])]

  return (
    <Box paddingLeft={3}>
      <Text wrap="truncate-end">
        <Text color={facts.isAborted ? p.textMuted : facts.color}>{facts.agent}</Text>
        <Text color={p.textMuted}>{tail.map(part => ` · ${part}`).join('')}</Text>
      </Text>
    </Box>
  )
}

// ── Tool calls ──────────────────────────────────────────────────────────────

export type CallState = { isRunning: boolean; isErrored: boolean; isInterrupted: boolean; hasOutput: boolean; frame: number }

// One inline call: `→ Read src/app.ts`, muted once done, red when it failed.
export function inlineTool(look: Look, row: Row, call: CallState, error?: string) {
  const { Box, Text } = look.ui
  const { p } = look
  const isPending = call.isRunning && !call.hasOutput
  const color = call.isErrored ? p.error : p.textMuted
  const icon = isPending ? spinGlyph(look.spinner, call.frame) : call.isErrored && row.icon === '✓' ? '✗' : row.icon
  const text = isPending ? row.pending : row.text

  return (
    <Box paddingLeft={3} flexDirection="column">
      <Text wrap="truncate-end" color={color} strikethrough={call.isInterrupted && !call.isErrored ? true : undefined}>
        <Text color={call.isErrored ? p.error : isPending ? p.textMuted : p.textMuted}>{`${icon} `}</Text>
        {text}
        {row.tail === '' || isPending ? '' : <Text color={p.textMuted}>{` ${row.tail}`}</Text>}
      </Text>
      {error === undefined || error === '' ? '' : (
        <Box paddingLeft={2}>
          <Text color={p.error}>{clip(error, 2000)}</Text>
        </Box>
      )}
    </Box>
  )
}

// The panel a block tool draws in: an invisible gutter, the raised background.
export function block(look: Look, children: RenderElement[]) {
  const { Box } = look.ui
  const { p } = look

  return (
    <Box borderStyle="quote" borderColor={p.background} backgroundColor={p.backgroundPanel} paddingLeft={2} paddingRight={1} flexDirection="column" gap={1}>
      {children}
    </Box>
  )
}

export function bashBlock(
  look: Look,
  call: CallState,
  body: { command: string; lines: string[]; hidden: number },
  toggle: { isOpen: boolean; onPress: () => void } | null,
  error?: string,
) {
  const { Box, Button, Text } = look.ui
  const { p } = look

  if (body.command === '') {
    return inlineTool(look, { shape: 'bash', icon: '$', text: 'Writing command…', pending: 'Writing command…', tail: '' }, { ...call, hasOutput: false })
  }

  const command = body.command.split('\n')
  const shown = command.length > 2 ? [...command.slice(0, 2), '…'] : command
  const head = call.isRunning ? (
    <Text color={p.text}>
      <Text color={p.textMuted}>{`${spinGlyph(look.spinner, call.frame)} `}</Text>
      {shown.join('\n')}
    </Text>
  ) : (
    <Text color={p.text}>{`$ ${shown.join('\n  ')}`}</Text>
  )
  const parts: RenderElement[] = [head]

  if (toggle !== null && (body.hidden > 0 || toggle.isOpen)) {
    parts.push(
      <Button key="earlier" plain onPress={toggle.onPress}>
        <Text color={p.textMuted}>{toggle.isOpen ? '(collapse)' : `(${body.hidden} earlier lines)`}</Text>
      </Button>,
    )
  }

  if (body.lines.length > 0) {
    parts.push(<Text color={p.textMuted}>{body.lines.join('\n')}</Text>)
  }

  if (error !== undefined && error !== '') {
    parts.push(<Text color={p.error}>{clip(error, 2000)}</Text>)
  }

  return block(look, parts)
}

export function editBlock(look: Look, title: string, stat: string, patch: string | null, path: string, error?: string) {
  const { Code, Text } = look.ui
  const { p } = look
  const parts: RenderElement[] = [
    <Text color={p.textMuted} wrap="truncate-end">
      {`← ${title}`}
      {stat === '' ? '' : <Text color={p.textMuted}>{`  ${stat}`}</Text>}
    </Text>,
  ]

  if (patch !== null) {
    parts.push(<Code source={patch} format="diff" path={path} />)
  }

  if (error !== undefined && error !== '') {
    parts.push(<Text color={p.error}>{clip(error, 2000)}</Text>)
  }

  return block(look, parts)
}

export function writeBlock(look: Look, path: string, shown: string, body: { lines: string[]; hidden: number }) {
  const { Code, Text } = look.ui
  const { p } = look
  const parts: RenderElement[] = [<Text color={p.textMuted} wrap="truncate-end">{`# Wrote ${shown}`}</Text>]

  if (body.lines.length > 0) {
    parts.push(<Code source={body.lines.join('\n')} path={path} startLine={1} />)
  }

  if (body.hidden > 0) {
    parts.push(<Text color={p.textMuted}>{`… ${body.hidden} more lines`}</Text>)
  }

  return block(look, parts)
}

export function todoBlock(look: Look, todos: TodoLine[]) {
  const { Text } = look.ui
  const { p } = look

  return block(look, [
    <Text color={p.textMuted}>{'# Todos'}</Text>,
    <Text>
      {todos.map((todo, i) => (
        <Text color={todo.status === 'in_progress' ? p.warning : p.textMuted}>{`${i === 0 ? '' : '\n'}${todo.mark} ${todo.text}`}</Text>
      ))}
    </Text>,
  ])
}

// A fold of reads and searches: `→ Explored: 2 reads, 1 search`.
export function exploredRow(look: Look, counts: string, isActive: boolean, frame: number) {
  const { Box, Text } = look.ui
  const { p } = look

  return (
    <Box paddingLeft={3}>
      <Text color={p.textMuted} wrap="truncate-end">
        {isActive ? `${spinGlyph(look.spinner, frame)} Exploring: ${counts}` : `→ Explored: ${counts}`}
      </Text>
    </Box>
  )
}

// ── Working indicators and the prompt's footer ──────────────────────────────

export function scanner(look: Look, frame: number, color: string) {
  const { Text } = look.ui

  return (
    <Text>
      {scannerCells(frame, color, look.p.background).map(cell => (
        <Text color={cell.color}>{cell.glyph}</Text>
      ))}
    </Text>
  )
}

export type FooterFacts = {
  isWorking: boolean
  frame: number
  agent: string
  agentColor: string
  modeTag: string
  model: string
  location: string
  usage: OcUsage | null
  extra: string
  columns: number
}

const compact = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)))

// The line under the prompt: the scanner and `esc interrupt` while working, else the agent
// and model; the place, the context's fill and cost, and the agent key on the right.
export function promptFooter(look: Look, f: FooterFacts) {
  const { Box, Text } = look.ui
  const { p } = look
  // Where the gauge cannot be worked out (no window size yet), the count as before.
  const usage =
    f.usage === null || percentOf(f.usage) !== undefined || f.usage.tokens === undefined
      ? ''
      : `${compact(f.usage.tokens)}${f.usage.usd === undefined ? '' : ` · ${formatUsd(f.usage.usd)}`}`
  const left = f.isWorking ? (
    <Text>
      {scanner(look, f.frame, f.agentColor)}
      <Text color={p.text}>{'  esc'}</Text>
      <Text color={p.textMuted}>{' interrupt'}</Text>
    </Text>
  ) : (
    <Text wrap="truncate-end">
      <Text color={f.agentColor} bold>
        {f.agent}
      </Text>
      {f.modeTag === '' ? '' : <Text color={p.textMuted}>{` ${f.modeTag}`}</Text>}
      <Text color={p.textMuted}>{' · '}</Text>
      <Text color={p.text}>{f.model}</Text>
      <Text color={p.textMuted}>{' Anthropic'}</Text>
    </Text>
  )
  const right: RenderElement[] = []
  const room = f.columns - 40

  if (f.extra !== '') right.push(<Text color={p.textMuted}>{f.extra}</Text>)
  if (f.location !== '' && room > 50) right.push(<Text color={p.textMuted}>{clip(f.location, 36)}</Text>)
  if (f.usage !== null && percentOf(f.usage) !== undefined && room > 20) right.push(miniGauge(look, f.usage))
  else if (usage !== '' && room > 20) right.push(<Text color={p.textMuted}>{usage}</Text>)
  right.push(
    <Text>
      <Text color={p.text}>{'shift+tab'}</Text>
      <Text color={p.textMuted}>{' agents'}</Text>
    </Text>,
  )

  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%" paddingLeft={1} paddingRight={1}>
      <Box flexShrink={1}>{left}</Box>
      <Box flexDirection="row" gap={2} flexShrink={0}>
        {right}
      </Box>
    </Box>
  )
}

// ── Home ────────────────────────────────────────────────────────────────────

export function logo(look: Look) {
  const { Box, Text } = look.ui
  const { p } = look
  const left = wordRows(LEFT_WORD)
  const right = wordRows(RIGHT_WORD)
  const leftShadow = mix(p.textMuted, p.background, 0.25)
  const rightShadow = mix(p.text, p.background, 0.25)
  const span = (run: { text: string; color: string; background?: string; bold?: boolean }) => (
    <Text color={run.color} backgroundColor={run.background} bold={run.bold}>
      {run.text}
    </Text>
  )

  return (
    <Box flexDirection="column">
      {left.map((row, i) => (
        <Text>
          {logoRuns(row, p.textMuted, leftShadow, false).map(span)}
          {' '}
          {logoRuns(right[i] ?? '', p.text, rightShadow, true).map(span)}
        </Text>
      ))}
    </Box>
  )
}

export function home(look: Look, tip: { lead: string; rest: string }, columns: number) {
  const { Box, Text } = look.ui
  const { p } = look

  return (
    <Box flexDirection="column" alignItems="center" paddingTop={1} paddingBottom={1} width="100%">
      {columns >= LOGO_WIDTH + 2 ? logo(look) : <Text color={p.text} bold>{'claude code'}</Text>}
      <Box paddingTop={1}>
        <Text wrap="truncate-end">
          <Text color={p.warning}>{'● Tip '}</Text>
          <Text color={p.text}>{tip.lead}</Text>
          <Text color={p.textMuted}>{tip.rest}</Text>
        </Text>
      </Box>
    </Box>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

export type SidebarFacts = {
  title: string
  usage: OcUsage | null
  mcp: string[]
  todos: OcTodo[]
  files: Record<string, OcFile>
  location: string
  version: string
  columns: number
  rows: number
}

export function sidebar(look: Look, s: SidebarFacts) {
  const { Box, Text } = look.ui
  const { p } = look
  const width = Math.max(10, s.columns - 4)
  const heading = (text: string) => (
    <Text color={p.text} bold>
      {text}
    </Text>
  )
  const sections: RenderElement[] = [
    <Text color={p.text} bold>
      {s.title}
    </Text>,
  ]

  if (s.usage !== null && (s.usage.tokens !== undefined || s.usage.usd !== undefined)) {
    sections.push(
      <Box flexDirection="column">
        {heading('Context')}
        {s.usage.tokens === undefined ? '' : <Text color={p.textMuted}>{`${formatCount(s.usage.tokens)} tokens`}</Text>}
        {s.usage.percent === undefined ? '' : <Text color={p.textMuted}>{`${s.usage.percent}% used`}</Text>}
        {s.usage.usd === undefined ? '' : <Text color={p.textMuted}>{`${formatUsd(s.usage.usd)} spent`}</Text>}
      </Box>,
    )
  }

  if (s.mcp.length > 0) {
    sections.push(
      <Box flexDirection="column">
        {heading('MCP')}
        {s.mcp.map(name => (
          <Box flexDirection="row" justifyContent="space-between">
            <Text wrap="truncate-end">
              <Text color={p.success}>{'• '}</Text>
              <Text color={p.text} bold>
                {clip(name, width - 14)}
              </Text>
            </Text>
            <Text color={p.textMuted}>{'Connected'}</Text>
          </Box>
        ))}
      </Box>,
    )
  }

  if (s.todos.some(todo => todo.status !== 'completed')) {
    sections.push(
      <Box flexDirection="column">
        {heading('Todo')}
        {s.todos.map(todo => (
          <Text color={todo.status === 'in_progress' ? p.warning : p.textMuted} wrap="truncate-end">
            {`${todo.status === 'completed' ? '[✓]' : todo.status === 'in_progress' ? '[•]' : '[ ]'} ${todo.content}`}
          </Text>
        ))}
      </Box>,
    )
  }

  const files = Object.entries(s.files)

  if (files.length > 0) {
    sections.push(
      <Box flexDirection="column">
        {heading('Modified Files')}
        {files.map(([path, stat]) => {
          const counts = `${stat.added > 0 ? `+${stat.added}` : ''}${stat.added > 0 && stat.removed > 0 ? ' ' : ''}${stat.removed > 0 ? `-${stat.removed}` : ''}`
          const room = Math.max(4, width - counts.length - 1)
          const shown = path.length > room ? `…${path.slice(path.length - room + 1)}` : path

          return (
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={p.textMuted}>{shown}</Text>
              <Text>
                {stat.added > 0 ? <Text color={p.diffAdded}>{`+${stat.added}`}</Text> : ''}
                {stat.added > 0 && stat.removed > 0 ? ' ' : ''}
                {stat.removed > 0 ? <Text color={p.diffRemoved}>{`-${stat.removed}`}</Text> : ''}
              </Text>
            </Box>
          )
        })}
      </Box>,
    )
  }

  const slash = s.location.lastIndexOf('/')
  const parent = slash >= 0 ? s.location.slice(0, slash + 1) : ''
  const last = slash >= 0 ? s.location.slice(slash + 1) : s.location

  return (
    <Box flexDirection="column" backgroundColor={p.backgroundPanel} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} minHeight={Math.max(1, s.rows)}>
      <Box flexDirection="column" gap={1} flexGrow={1}>
        {sections}
      </Box>
      <Box flexDirection="column" paddingTop={1}>
        <Text wrap="truncate-start">
          <Text color={p.textMuted}>{parent}</Text>
          <Text color={p.text}>{last}</Text>
        </Text>
        <Text>
          <Text color={p.success}>{'• '}</Text>
          <Text color={p.textMuted} bold>
            {'Claude'}
          </Text>
          <Text color={p.text} bold>
            {'Code'}
          </Text>
          <Text color={p.textMuted}>{` ${s.version}`}</Text>
        </Text>
      </Box>
    </Box>
  )
}
