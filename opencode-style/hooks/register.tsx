// opencode-style: Claude Code drawn the way opencode draws itself. Its themes (for these
// rows and, through themes/, Claude Code's own UI), its sidebar, its message and tool
// rows, the Knight Rider scanner under the prompt, its home logo and its commands.

import { atom, memberOf, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { OcActivity, OcLane, OcTodo, OcTurn, OcUsage } from '../types'
import { spinnerGallery, spinnerRow, themeStudio, tickKind, timeline } from './candy'
import {
  bashBlock,
  editBlock,
  exploredRow,
  home,
  inlineTool,
  type Look,
  promptFooter,
  replyFooter,
  replyRow,
  sidebar,
  todoBlock,
  userRow,
  writeBlock,
} from './draw'
import { clip, diffstat, fieldsOf, oneLine, shortenPath, textOf } from './format'
import { readHistory } from './history'
import { agentColor, claudeOverrides, DEFAULT_THEME, PALETTES, THEME_NAMES, themeLabel, themeOf } from './palette'
import { autoSpinner, DEFAULT_SPINNER, type DrawnStyle, SPINNER_NOTES, spinnerOf, SPINNERS, type SpinnerStyle } from './spinners'
import { bashBody, patchOf, rowOf, todoLines, writeBody } from './tools'

const PLUGIN = 'opencode-style'
const SIDEBAR = 'oc-sidebar'
const THEMES = 'oc-themes'
const MINIMAP = 'oc-minimap'
const SPINNER_PANE = 'oc-spinners'
// A call that runs this long is marked slow on the timeline; a gap this long with no call is a `⋯`.
const SLOW_MS = 15_000
const WAIT_MS = 20_000
const MAX_LANES = 60
const MAX_TICKS = 300
const FRAME_MS = 45
const BASH_LINES = 10
const WRITE_LINES = 40
const MAX_PROMPT = 4000
// The custom theme Claude Code's own UI wears: ~/.claude/themes/opencode.json.
const CLAUDE_THEME = 'opencode'

const themeAtom = atom({ plugin: 'opencode-style', key: 'theme' } as const, DEFAULT_THEME)
const frameAtom = atom({ plugin: 'opencode-style', key: 'frame' } as const, 0)
const workingAtom = atom({ plugin: 'opencode-style', key: 'isWorking' } as const, false)
const workStartedAtom = atom({ plugin: 'opencode-style', key: 'workStartedAt' } as const, 0)
const todosAtom = atom({ plugin: 'opencode-style', key: 'todos' } as const, [] as OcTodo[])
const filesAtom = atom({ plugin: 'opencode-style', key: 'files' } as const, {} as Record<string, { added: number; removed: number }>)
const usageAtom = atom({ plugin: 'opencode-style', key: 'usage' } as const, null as OcUsage | null)
const titleAtom = atom({ plugin: 'opencode-style', key: 'title' } as const, '')
const modeAtom = atom({ plugin: 'opencode-style', key: 'mode' } as const, 'default')
const modelAtom = atom({ plugin: 'opencode-style', key: 'model' } as const, '')
const branchAtom = atom({ plugin: 'opencode-style', key: 'branch' } as const, '')
const turnsAtom = atom({ plugin: 'opencode-style', key: 'turns' } as const, {} as Record<string, OcTurn>)
const detailsAtom = atom({ plugin: 'opencode-style', key: 'details' } as const, true)
const mcpAtom = atom({ plugin: 'opencode-style', key: 'mcp' } as const, [] as string[])
const hasMessagesAtom = atom({ plugin: 'opencode-style', key: 'hasMessages' } as const, false)
const expandedAtom = atom({ plugin: 'opencode-style', key: 'expanded' } as const, false)
const spinnerAtom = atom({ plugin: 'opencode-style', key: 'spinner' } as const, DEFAULT_SPINNER as string)
const activityAtom = atom({ plugin: 'opencode-style', key: 'activity' } as const, null as OcActivity | null)
const timelineAtom = atom({ plugin: 'opencode-style', key: 'timeline' } as const, [] as OcLane[])

// Prompts the person typed, as opposed to notifications and other agents' messages.
const TYPED = new Set(['composer', 'bridge', 'sdk'])
// Tools whose rows Claude Code draws best itself: dialogs and plans.
const ENGINE_DRAWN = new Set(['AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode'])
const EXPLORE: Record<string, [string, string]> = {
  Read: ['read', 'reads'],
  Glob: ['search', 'searches'],
  Grep: ['search', 'searches'],
  ToolSearch: ['search', 'searches'],
  LS: ['list', 'lists'],
  WebFetch: ['fetch', 'fetches'],
  WebSearch: ['web search', 'web searches'],
}

const TIPS: { lead: string; rest: string }[] = [
  { lead: 'shift+tab', rest: ' cycles between the Build and Plan agents' },
  { lead: '/themes', rest: " switches between opencode's themes" },
  { lead: '/new', rest: ' starts a fresh session' },
  { lead: '/sessions', rest: ' lists and resumes earlier sessions' },
  { lead: '/models', rest: ' switches the model' },
  { lead: '/sidebar', rest: ' shows or hides the sidebar' },
  { lead: '/details', rest: ' shows or hides tool output in the transcript' },
  { lead: '/undo', rest: ' rewinds to an earlier message' },
  { lead: '!', rest: ' at the start of the prompt runs a shell command' },
  { lead: '@', rest: ' in the prompt mentions a file' },
  { lead: '/spinner', rest: ' picks how the working indicator moves' },
  { lead: '/minimap', rest: ' shows the session as a timeline' },
]

const COMMANDS: { name: string; description: string; argumentHint?: string; runs?: string }[] = [
  { name: 'new', description: 'New session', runs: 'clear' },
  { name: 'sessions', description: 'Switch session', runs: 'resume' },
  { name: 'models', description: 'Switch model', runs: 'model' },
  { name: 'undo', description: 'Undo previous message', runs: 'rewind' },
  { name: 'mcps', description: 'MCP servers', runs: 'mcp' },
  { name: 'themes', description: 'Switch theme', argumentHint: '[theme]' },
  { name: 'sidebar', description: 'Show or hide the sidebar' },
  { name: 'details', description: 'Show or hide tool details' },
  { name: 'spinner', description: 'Pick a spinner style', argumentHint: '[style]' },
  { name: 'minimap', description: 'Show or hide the session timeline' },
]

// Claude Code's mode, as opencode names its primary agents.
const agentOf = (mode: string): string => (mode === 'plan' ? 'Plan' : 'Build')
const modeTagOf = (mode: string): string => (mode === 'acceptEdits' || mode === 'auto' ? 'auto' : mode === 'bypassPermissions' ? 'bypass' : '')

// `claude-opus-5-5` → `Claude Opus 5.5`, as opencode's footer names a model.
export function prettyModel(model: string): string {
  const id = /claude-(opus|sonnet|haiku|fable)-(\d+)-(\d+)/i.exec(model)

  if (id !== null) {
    const family = id[1] ?? ''

    return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${id[2]}.${id[3]}`
  }

  const alias = /^(opus|sonnet|haiku|fable)\b/i.exec(model.trim())

  return alias === null ? model.replace(/\[[^\]]*\]$/, '') : `Claude ${(alias[1] ?? '').charAt(0).toUpperCase()}${(alias[1] ?? '').slice(1).toLowerCase()}`
}

// The text of a failed call, without the harness's own tags.
function errorOf(output: unknown): string {
  const text = typeof output === 'string' ? output : textOf(fieldsOf(output).error) || textOf(fieldsOf(output).stderr)

  return text.replace(/<\/?tool_use_error>/g, '').trim()
}

let cwd = ''
let homeDir = ''
let version = ''
let ticker: { cancel(): void } | undefined
// The sidebar opens once a drawing says the terminal docks panes (its fullscreen layout):
// `pending` while that is still to learn, then what the drawing reported.
let sidebarWanted = false
let dockSeen: boolean | undefined
// Whether /themes closed the sidebar to show its picker, to bring it back after.
let sidebarAside = false
// The theme in force when /themes opened, put back if the picker closes with no pick.
let savedTheme = DEFAULT_THEME
let isPicked = false
let previewPaint = 0
// The spinner gallery animates while open, turn or no turn.
let isGalleryOpen = false
// The calls running now, by id, so the spinner names the newest still going.
const running = new Map<string, OcActivity & { startedAt: number }>()
// When the timeline last saw something happen, to mark long silences.
let lastBeat = 0

async function lookOf($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0]): Promise<Look> {
  const theme = themeOf(await read($, themeAtom))

  return { ui: $.ui.resolve(e), p: theme.palette, theme: theme.name, spinner: spinnerOf(await read($, spinnerAtom)) }
}

const baseName = (path: string): string => path.replace(/\\/g, '/').split('/').pop() ?? path

// What a call is working on, in a few words: a file's name, a command, a pattern.
function detailOf(tool: string, input: unknown): string {
  const f = fieldsOf(input)
  const path = textOf(f.file_path) || textOf(f.notebook_path)

  if (path !== '') return baseName(path)
  if (tool === 'Bash') return clip(textOf(f.description) || oneLine(textOf(f.command)), 40)
  if (tool === 'Grep' || tool === 'Glob') return clip(textOf(f.pattern), 30)
  if (tool === 'WebFetch') return /^https?:\/\/([^/]+)/.exec(textOf(f.url))?.[1] ?? ''
  if (tool === 'WebSearch') return clip(textOf(f.query), 30)
  if (tool === 'Agent' || tool === 'Task') return clip(textOf(f.description), 30)

  return ''
}

async function addTick($: EngineInterface, tick: OcLane['ticks'][number]): Promise<void> {
  await update($, timelineAtom, lanes => {
    const last = lanes.at(-1)

    if (last === undefined || last.ms !== undefined) return lanes

    return [...lanes.slice(0, -1), { ...last, ticks: [...last.ticks, tick].slice(-MAX_TICKS) }]
  })
}

// Live preview: the rows recolor at once, the terminal and Claude Code's own UI once the
// cursor rests, so running down the list does not rewrite the theme file at every step.
function previewTheme($: EngineInterface, name: string): void {
  previewPaint += 1
  const ticket = previewPaint
  void update($, themeAtom, () => name)
  $.clock.after(140, () => (ticket === previewPaint ? paint($, name) : undefined))
}

async function pickSpinner($: EngineInterface, style: SpinnerStyle): Promise<void> {
  await update($, spinnerAtom, () => style)
  await $.store.set('spinner', style)
  $.ui.toast(`Spinner: ${style}, ${SPINNER_NOTES[style]}`)
}

async function location($: EngineInterface): Promise<string> {
  const branch = await read($, branchAtom)

  return `${shortenPath(cwd, '', homeDir)}${branch === '' ? '' : `:${branch}`}`
}

async function refreshUsage($: EngineInterface): Promise<void> {
  const usage = await $.session.usage()
  const next: OcUsage = {
    window: usage.context.window,
    ...(usage.context.tokens === undefined ? {} : { tokens: usage.context.tokens }),
    ...(usage.context.percent === undefined ? {} : { percent: usage.context.percent }),
    ...(usage.cost === undefined ? {} : { usd: usage.cost.usd }),
  }
  await update($, usageAtom, () => next)
}

async function refreshBranch($: EngineInterface): Promise<void> {
  const ran = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeoutMs: 3000 }).catch(() => null)
  const branch = ran !== null && ran.exitCode === 0 ? ran.stdout.trim() : ''
  await update($, branchAtom, () => branch)
}

async function refreshMcp($: EngineInterface): Promise<void> {
  const tools = await $.tool.list()
  const servers = [...new Set(tools.flatMap(tool => /^mcp__(.+?)__/.exec(tool.name)?.[1] ?? []))].filter(name => name !== PLUGIN).sort()
  await update($, mcpAtom, () => servers)
}

// Claude Code's own UI wears the theme through one custom theme, `opencode`, kept in
// ~/.claude/themes: Claude Code watches that folder, so rewriting it recolors live.
async function paintClaude($: EngineInterface, name: string): Promise<void> {
  const theme = themeOf(name)
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${homeDir}/.claude`
  const file = { name: 'opencode', base: 'dark', overrides: claudeOverrides(theme.name, theme.palette) }
  await $.fs.write(`${dir}/themes/${CLAUDE_THEME}.json`, `${JSON.stringify(file, null, 2)}\n`)
}

// opencode paints the whole terminal; Claude Code leaves the background to the terminal,
// so the mod sets the terminal's own (OSC 11), and puts it back when the session ends.
async function paintBackground($: EngineInterface, hex: string | null): Promise<void> {
  const sequence = hex === null ? '\x1b]111\x1b\\' : `\x1b]11;${hex}\x1b\\`
  await $.process.run(['sh', '-c', 'printf "%s" "$1" > /dev/tty', 'sh', sequence], { timeoutMs: 2000 })
}

async function paint($: EngineInterface, name: string): Promise<void> {
  const theme = themeOf(name)
  const done = await Promise.allSettled([paintClaude($, theme.name), paintBackground($, theme.palette.background)])

  for (const result of done) {
    if (result.status === 'rejected') {
      $.ui.log(`theme: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`, { to: 'debug' })
    }
  }
}

async function applyTheme($: EngineInterface, name: string): Promise<void> {
  await update($, themeAtom, () => name)
  await $.store.set('theme', name)
  await paint($, name)
  await followClaudeTheme($).catch((error: unknown) => $.ui.log(`theme: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' }))
  $.ui.toast(`Theme: ${themeLabel(name)}`)
}

// Points Claude Code's theme setting at the `opencode` custom theme, once.
async function followClaudeTheme($: EngineInterface): Promise<void> {
  const settings = await $.settings.read()

  if (settings.theme === `custom:${CLAUDE_THEME}`) {
    return
  }

  const set = await $.config.set({ key: 'theme', value: `custom:${CLAUDE_THEME}` }).catch((error: unknown) => ({ deny: error instanceof Error ? error.message : String(error) }))

  if (set.deny !== undefined) {
    $.ui.log(`theme: Claude Code's theme setting was left as it was (${set.deny})`, { to: 'debug' })
    $.ui.toast('To recolor Claude Code\'s own UI too, pick "opencode" in /theme.')
  }
}

async function openSidebar($: EngineInterface): Promise<boolean> {
  const opened = await $.ui.open({ id: SIDEBAR, title: 'Session', columns: 42 })

  return opened.isPlaced
}

async function resetSession($: EngineInterface): Promise<void> {
  await update($, hasMessagesAtom, () => false)
  await update($, todosAtom, () => [])
  await update($, filesAtom, () => ({}))
  await update($, titleAtom, () => '')
  await update($, turnsAtom, () => ({}))
  await update($, timelineAtom, () => [])
  running.clear()
}

// A title for the session, as opencode asks a small model for one after the first prompt.
function nameSession($: EngineInterface, prompt: string): void {
  $.clock.after(1, async () => {
    const asked = await $.model.complete({
      model: 'haiku',
      system: 'You write short titles for coding sessions.',
      prompt: `Write a title of at most 50 characters for a coding session that starts with this request. Reply with the title alone, no quotes or punctuation at the end.\n\n<request>\n${prompt.slice(0, 2000)}\n</request>`,
      maxTokens: 40,
      effort: 'low',
      timeoutMs: 15_000,
    })
    const title = asked.isAnswered ? oneLine(asked.text).replace(/^["'#\s]+|["'.\s]+$/g, '').slice(0, 60) : ''

    if (title !== '') {
      await update($, titleAtom, current => (current === '' || current.startsWith('New session') ? title : current))
    }
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    homeDir = (await $.env.get('HOME')) ?? ''
    version = (await $.session.version()).version

    const stored = await $.store.get('theme')
    const name = themeOf(typeof stored === 'string' ? stored : DEFAULT_THEME).name
    await update($, themeAtom, () => name)

    if (e.isInteractive) {
      await paint($, name)
    }

    const details = await $.store.get('details')
    await update($, detailsAtom, () => details !== false)
    const spinner = spinnerOf(await $.store.get('spinner'))
    await update($, spinnerAtom, () => spinner)
    isGalleryOpen = false

    for (const command of COMMANDS) {
      await $.command
        .register({ name: command.name, description: command.description, ...(command.argumentHint === undefined ? {} : { argumentHint: command.argumentHint }) })
        .catch((error: unknown) => $.ui.log(`/${command.name} not registered: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' }))
    }

    const model = await $.session.model()
    const hasMessages = (await $.session.turns()) > 0
    await update($, modelAtom, () => model)
    await update($, hasMessagesAtom, () => hasMessages)
    await Promise.all([refreshUsage($), refreshBranch($), refreshMcp($)]).catch((error: unknown) =>
      $.ui.log(`start: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' }),
    )

    // What the session did before this load, so a reload or a resume keeps its timeline.
    if (hasMessages) {
      void readHistory($, cwd, homeDir, { slowMs: SLOW_MS, waitMs: WAIT_MS, maxLanes: MAX_LANES, maxTicks: MAX_TICKS })
        .then(lanes => (lanes !== null && lanes.length > 0 ? update($, timelineAtom, () => lanes) : undefined))
        .catch((error: unknown) => $.ui.log(`timeline: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' }))
    }

    // Only a running turn's indicators read the frame, so the tick redraws nothing else.
    ticker?.cancel()
    // opencode docks its sidebar beside the transcript; Claude Code docks panes in fullscreen,
    // which only a drawing's viewport reports, so the ticker opens it once one has.
    sidebarWanted = e.isInteractive && (await $.store.get('sidebar')) !== false
    dockSeen = undefined
    ticker = $.clock.every(FRAME_MS, () => {
      void read($, workingAtom).then(isWorking => (isWorking || isGalleryOpen ? update($, frameAtom, frame => frame + 1) : undefined))

      if (sidebarWanted && dockSeen !== undefined) {
        sidebarWanted = false

        if (dockSeen) {
          void openSidebar($)
        }
      }
    })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await resetSession($)
    } else {
      await paintBackground($, null).catch(() => undefined)
    }

    return next(e)
  })

  // ── Commands ──────────────────────────────────────────────────────────────

  for (const command of COMMANDS) {
    const target = command.runs

    if (target === undefined) continue

    // Runs Claude Code's own command in a dispatch of its own, once this one has answered.
    on('command.run', { command: command.name }, async ($, e) => {
      $.clock.after(1, () =>
        $.command.run({ command: target, ...(e.args.trim() === '' ? {} : { args: e.args }) }).catch((error: unknown) => {
          $.ui.toast(`/${target} did not run: ${error instanceof Error ? error.message : String(error)}`)
        }),
      )

      return {}
    }).catch(() => ({ text: 'opencode-style: that command failed; the debug log says why.' }))
  }

  on('command.run', { command: 'themes' }, async ($, e) => {
    const wanted = e.args.trim().toLowerCase().replace(/\s+/g, '-')

    if (wanted !== '') {
      const match = THEME_NAMES().find(name => name === wanted || themeLabel(name).toLowerCase().replace(/\s+/g, '-') === wanted)

      if (match === undefined) {
        return { text: `No theme named "${e.args.trim()}". Themes: ${THEME_NAMES().join(', ')}` }
      }

      await applyTheme($, match)

      return {}
    }

    // Beside the docked sidebar the picker would open as a tab behind it, so the sidebar
    // steps aside while the picker is up and comes back when it closes.
    sidebarAside = (await $.ui.panes()).some(pane => pane.id === SIDEBAR)

    if (sidebarAside) {
      await $.ui.close({ id: SIDEBAR })
    }

    savedTheme = await read($, themeAtom)
    isPicked = false
    await $.ui.open({ id: THEMES, title: 'Themes', focus: true, closeOnEscape: true, rows: THEME_NAMES().length + 3 })

    return {}
  }).catch(() => ({ text: 'opencode-style: that command failed; the debug log says why.' }))

  on('command.run', { command: 'spinner' }, async ($, e) => {
    const wanted = e.args.trim().toLowerCase()

    if (wanted !== '') {
      if (!(SPINNERS as readonly string[]).includes(wanted)) {
        return { text: `No spinner named "${e.args.trim()}". Spinners: ${SPINNERS.join(', ')}` }
      }

      await pickSpinner($, wanted as SpinnerStyle)

      return {}
    }

    isGalleryOpen = true
    await $.ui.open({ id: SPINNER_PANE, title: 'Spinners', focus: true, closeOnEscape: true, rows: SPINNERS.length + 3 })

    return {}
  }).catch(() => ({ text: 'opencode-style: that command failed; the debug log says why.' }))

  on('command.run', { command: 'minimap' }, async $ => {
    const isShown = (await $.ui.panes()).some(pane => pane.id === MINIMAP && pane.isPlaced)

    if (isShown) {
      await $.ui.close({ id: MINIMAP })

      return {}
    }

    const opened = await $.ui.open({ id: MINIMAP, title: 'Timeline', columns: 40 })

    return opened.isPlaced ? {} : { text: 'The timeline opens once the terminal is wide enough.' }
  }).catch(() => ({ text: 'opencode-style: that command failed; the debug log says why.' }))

  on('command.run', { command: 'sidebar' }, async $ => {
    // A pane opened unasked can wait undrawn below 144 columns; asking places it.
    const isShown = (await $.ui.panes()).some(pane => pane.id === SIDEBAR && pane.isPlaced)

    if (isShown) {
      await $.ui.close({ id: SIDEBAR })
      await $.store.set('sidebar', false)

      return {}
    }

    await $.store.set('sidebar', true)
    const isPlaced = await openSidebar($)

    return isPlaced ? {} : { text: 'The sidebar opens once the terminal is wide enough.' }
  }).catch(() => ({ text: 'opencode-style: that command failed; the debug log says why.' }))

  on('command.run', { command: 'details' }, async $ => {
    const shown = !(await read($, detailsAtom))
    await update($, detailsAtom, () => shown)
    await $.store.set('details', shown)
    $.ui.toast(shown ? 'Tool details shown' : 'Tool details hidden')

    return {}
  }).catch(() => ({ text: 'opencode-style: that command failed; the debug log says why.' }))

  on('ui.focus', { component: 'Pane', requestId: THEMES }, async ($, e, next) => {
    const name = e.element?.startsWith('theme-') === true ? e.element.slice('theme-'.length) : ''

    if (name !== '' && Object.hasOwn(PALETTES, name) && name !== (await read($, themeAtom))) {
      previewTheme($, name)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.close', { id: SPINNER_PANE }, async ($, e, next) => {
    isGalleryOpen = false

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.close', { id: THEMES }, async ($, e, next) => {
    const closed = await next(e)

    // Closed with no pick: back to the theme it opened on.
    if (!isPicked && (await read($, themeAtom)) !== savedTheme) {
      previewPaint += 1
      await update($, themeAtom, () => savedTheme)
      await paint($, savedTheme)
    }

    if (sidebarAside) {
      sidebarAside = false
      $.clock.after(1, () => void openSidebar($))
    }

    return closed
  }).catch(($, e, next) => next(e))

  on('ui.close', { id: SIDEBAR }, async ($, e, next) => {
    if (e.origin.kind === 'person') {
      await $.store.set('sidebar', false)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // ── What the session does ─────────────────────────────────────────────────

  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    const text = e.text.trim()

    if (e.command === undefined && e.isMeta !== true && text !== '') {
      const isFirst = !(await read($, hasMessagesAtom))
      await update($, hasMessagesAtom, () => true)
      const now = await $.clock.now()
      lastBeat = now
      await update($, timelineAtom, lanes => [...lanes, { at: now, prompt: oneLine(text), ticks: [] }].slice(-MAX_LANES))

      if (isFirst && (await read($, titleAtom)) === '') {
        await update($, titleAtom, () => `New session - ${new Date().toISOString().slice(0, 19)}`)
        nameSession($, text)
      }
    }

    return result
  }).catch(($, e, next) => next(e))

  on('classic.UserPromptSubmit', async ($, e, next) => {
    if (typeof e.permission_mode === 'string') {
      const mode = e.permission_mode
      await update($, modeAtom, () => mode)
    }

    if (typeof e.session_title === 'string' && e.session_title.trim() !== '') {
      const title = e.session_title.trim()
      await update($, titleAtom, () => title)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, workStartedAtom, () => now)
      await update($, workingAtom, () => true)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, workingAtom, () => false)
      const mode = await read($, modeAtom)
      const model = e.usage?.model ?? (await $.session.model())
      const tps = e.usage !== undefined && e.durationMs > 0 ? e.usage.output_tokens / (e.durationMs / 1000) : undefined
      const turn: OcTurn = { agent: agentOf(mode), model: prettyModel(model), isAborted: e.isAborted, ...(tps === undefined ? {} : { tps }) }
      await update($, turnsAtom, turns => Object.fromEntries([...Object.entries(turns), [String(e.durationMs), turn]].slice(-100)))
      await update($, modelAtom, () => model)
      await update($, timelineAtom, lanes => {
        const last = lanes.at(-1)

        return last === undefined || last.ms !== undefined ? lanes : [...lanes.slice(0, -1), { ...last, ms: e.durationMs, ...(e.isAborted ? { isAborted: true } : {}) }]
      })
      await update($, activityAtom, () => null)
      running.clear()
      await refreshUsage($).catch(() => undefined)
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const isMain = e.agentId === undefined
    const tool = String(e.tool)
    const id = e.tool_use_id ?? `${tool}-${Math.random()}`
    const startedAt = await $.clock.now()

    if (isMain) {
      if (lastBeat > 0 && startedAt - lastBeat > WAIT_MS) {
        await addTick($, { kind: 'wait' })
      }

      running.set(id, { tool, detail: detailOf(tool, e), startedAt })
      await update($, activityAtom, () => ({ tool, detail: detailOf(tool, e) }))
    }

    const ran = await next(e).finally(async () => {
      if (!isMain) return

      running.delete(id)
      const newest = [...running.values()].at(-1)
      await update($, activityAtom, () => (newest === undefined ? null : { tool: newest.tool, detail: newest.detail }))
    })

    if (isMain) {
      const endedAt = await $.clock.now()
      const isErrored = ran.deny !== undefined || ran.isError === true
      lastBeat = endedAt
      await addTick($, { kind: tickKind(tool), ...(isErrored ? { isErrored: true } : {}), ...(endedAt - startedAt > SLOW_MS ? { isSlow: true } : {}) })
    }

    if (!isMain || ran.deny !== undefined) {
      return ran
    }

    const fields = fieldsOf(e)
    const result = fieldsOf(ran.result)

    if (e.tool === 'TodoWrite') {
      const todos: OcTodo[] = todoLines(e).map(todo => ({ content: todo.text, status: todo.status }))
      await update($, todosAtom, () => todos)
    } else if (e.tool === 'TaskCreate') {
      const task = fieldsOf(result.task)
      const id = textOf(task.id)
      const content = textOf(task.subject) || textOf(fields.subject)

      if (content !== '') {
        await update($, todosAtom, todos => [...todos, { ...(id === '' ? {} : { id }), content, status: 'pending' as const }])
      }
    } else if (e.tool === 'TaskUpdate') {
      const id = textOf(fields.taskId)
      const status: OcTodo['status'] | 'deleted' | undefined =
        fields.status === 'pending' || fields.status === 'in_progress' || fields.status === 'completed' || fields.status === 'deleted' ? fields.status : undefined

      if (status !== undefined && status !== 'deleted') {
        await update($, todosAtom, todos => todos.map(todo => (todo.id === id ? { ...todo, status } : todo)))
      } else if (status === 'deleted') {
        await update($, todosAtom, todos => todos.filter(todo => todo.id !== id))
      }
    } else if (e.tool === 'TaskList' && Array.isArray(result.tasks)) {
      const todos: OcTodo[] = result.tasks.flatMap(item => {
        const task = fieldsOf(item)
        const status = task.status === 'completed' || task.status === 'in_progress' ? task.status : 'pending'

        return textOf(task.subject) === '' ? [] : [{ id: textOf(task.id), content: textOf(task.subject), status }]
      })
      await update($, todosAtom, () => todos)
    }

    const path = textOf(fields.file_path) || textOf(fields.notebook_path)
    const stat = diffstat(ran.result)

    if (path !== '' && stat !== null && ['Edit', 'Write', 'MultiEdit'].includes(String(e.tool))) {
      const shown = shortenPath(path, cwd, homeDir)
      await update($, filesAtom, files => {
        const was = files[shown] ?? { added: 0, removed: 0 }

        return { ...files, [shown]: { added: was.added + stat.added, removed: was.removed + stat.removed } }
      })
    }

    await refreshUsage($).catch(() => undefined)

    return ran
  }).catch(($, e, next) => next(e))

  // ── Drawing ───────────────────────────────────────────────────────────────

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!TYPED.has(e.props.origin.kind) || e.props.text.trim() === '' || e.props.text.length > MAX_PROMPT) {
      return next(e)
    }

    const look = await lookOf($, e)

    return userRow(look, e.props.text, agentColor(look.theme, look.p, agentOf(await read($, modeAtom))))
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary === true || e.props.text.trim() === '') {
      return next(e)
    }

    return replyRow(await lookOf($, e), e.props.text)
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e) => {
    const look = await lookOf($, e)
    const turn = (await read($, turnsAtom))[String(e.props.durationMs)]
    const agent = turn?.agent ?? agentOf(await read($, modeAtom))

    return replyFooter(look, {
      agent,
      color: agentColor(look.theme, look.p, agent),
      model: turn?.model ?? prettyModel(await read($, modelAtom)),
      ms: e.props.durationMs,
      ...(turn?.tps === undefined ? {} : { tps: turn.tps }),
      ...(turn?.isAborted === true ? { isAborted: true } : {}),
    })
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { tool, input, output, isRunning, isErrored, isInterrupted } = e.props

    if (ENGINE_DRAWN.has(tool)) {
      return next(e)
    }

    const look = await lookOf($, e)
    const paths = { cwd, home: homeDir }
    const row = rowOf(tool, input, output, paths)
    const frame = isRunning ? await read($, frameAtom) : 0
    const call = { isRunning, isErrored, isInterrupted, hasOutput: output !== undefined, frame }
    const details = await read($, detailsAtom)
    const error = isErrored ? errorOf(output) : undefined
    const isDone = !isRunning && !isErrored && output !== undefined
    const file = textOf(fieldsOf(input).file_path)

    switch (row.shape) {
      case 'bash': {
        if (!details) {
          return inlineTool(look, { ...row, text: `$ ${oneLine(textOf(fieldsOf(input).command))}` }, call, error)
        }

        const expanded = memberOf(expandedAtom, e)
        const isOpen = await read($, expanded)
        const body = bashBody(input, output, isOpen ? 10_000 : BASH_LINES)
        // opencode keeps the tail of long output and says how much came before it.
        const tail = isOpen ? body : { ...body, lines: bashBody(input, output, 100_000).lines.slice(-BASH_LINES) }

        return bashBlock(look, call, tail, body.hidden > 0 || isOpen ? { isOpen, onPress: () => void update($, expanded, open => !open) } : null, error)
      }
      case 'edit': {
        if (!isDone || !details) {
          return inlineTool(look, row, call, error)
        }

        return editBlock(look, row.text, row.tail, patchOf(output), file)
      }
      case 'write': {
        if (!isDone || !details) {
          return inlineTool(look, row, call, error)
        }

        return writeBlock(look, file, shortenPath(file, cwd, homeDir), writeBody(input, WRITE_LINES))
      }
      case 'todos': {
        const todos = todoLines(input)

        if (!details || todos.length === 0 || isErrored) {
          return inlineTool(look, { ...row, icon: '⚙' }, call, error)
        }

        return todoBlock(look, todos)
      }
      case 'task':
        return inlineTool(look, { ...row, icon: isRunning ? '│' : row.icon }, { ...call, hasOutput: call.hasOutput || !isRunning }, error)
      default:
        return inlineTool(look, row, call, error)
    }
  })

  // The row draws the call's answer itself, so Claude Code's result block stands down.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const output = fieldsOf(e.props.output)

    if (ENGINE_DRAWN.has(e.props.tool) || output.isImage === true || e.props.tool === 'Read' && output.type === 'image') {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.props.isExpanded) {
      return next(e)
    }

    const counts = new Map<string, number>()

    for (const call of e.props.calls) {
      const key = String(call.tool)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const merged = new Map<string, [number, [string, string]]>()

    for (const [tool, n] of counts) {
      const words = EXPLORE[tool] ?? ['call', 'calls']
      const was = merged.get(words[0])
      merged.set(words[0], [(was?.[0] ?? 0) + n, words])
    }

    const summary = [...merged.values()].map(([n, words]) => `${n} ${n === 1 ? words[0] : words[1]}`).join(', ')
    const isActive = e.props.isActive && e.props.calls.some(call => call.isRunning)

    return exploredRow(await lookOf($, e), summary, isActive, isActive ? await read($, frameAtom) : 0)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const words: Record<string, string> = {
      thinking: 'Thinking',
      responding: 'Writing',
      requesting: 'Waiting for the model',
      'tool-input': 'Preparing a tool call',
      'tool-use': 'Running tools',
    }
    const look = await lookOf($, e)
    let word = e.props.message ?? words[e.props.mode] ?? 'Working'
    let style: DrawnStyle

    if (look.spinner === 'auto') {
      const auto = autoSpinner(e.props.mode, await read($, activityAtom))
      style = auto.style

      if (e.props.message === null && auto.word !== undefined) {
        word = auto.word
      }
    } else {
      style = look.spinner
    }

    const startedAt = await read($, workStartedAtom)
    const frame = await read($, frameAtom)
    const elapsed = startedAt === 0 ? 0 : (await $.clock.now()) - startedAt

    return spinnerRow(look, style, frame, word.replace(/[….]+$/, ''), elapsed)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    if (dockSeen === undefined && e.viewport?.isFullscreen !== undefined) {
      dockSeen = e.viewport.isFullscreen
    }

    const look = await lookOf($, e)
    const hint = e.props.hint
    const mode = /plan mode on/i.test(hint) ? 'plan' : /accept edits on/i.test(hint) ? 'acceptEdits' : /auto mode on/i.test(hint) ? 'auto' : /bypass permissions on/i.test(hint) ? 'bypassPermissions' : 'default'
    const agent = agentOf(mode)
    // What else the engine had to say there (a background task's pill, a notice), kept dim.
    const extra = hint
      .replace(/[⏸⏵]+\s*(plan mode|accept edits|auto mode|bypass permissions) on/gi, '')
      .replace(/\(shift\+tab to cycle\)|\? for shortcuts|esc to interrupt|ctrl\+c to interrupt/gi, '')
      .replace(/^[\s·]+|[\s·]+$/g, '')
      .replace(/\s{2,}/g, ' ')
    const isWorking = e.props.isWorking || (await read($, workingAtom))

    return promptFooter(look, {
      isWorking,
      frame: isWorking ? await read($, frameAtom) : 0,
      agent,
      agentColor: agentColor(look.theme, look.p, agent),
      modeTag: modeTagOf(mode),
      model: prettyModel(await read($, modelAtom)),
      location: await location($),
      usage: await read($, usageAtom),
      extra,
      columns: e.viewport?.columns ?? 100,
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined || (await read($, hasMessagesAtom))) {
      return next(e)
    }

    const look = await lookOf($, e)
    const { Box } = look.ui
    const theirs = await next(e)
    const seed = cwd.length + new Date().getDate()
    const tip = TIPS[seed % TIPS.length] ?? TIPS[0]!

    return (
      <Box flexDirection="column">
        {home(look, tip, e.props.bodyColumns)}
        {theirs}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: SIDEBAR }, async ($, e) => {
    const look = await lookOf($, e)
    const title = (await read($, titleAtom)) || 'New session'

    return sidebar(look, {
      title,
      usage: await read($, usageAtom),
      mcp: await read($, mcpAtom),
      todos: await read($, todosAtom),
      files: await read($, filesAtom),
      location: await location($),
      version: version === '' ? '' : `v${version}`,
      columns: e.props.bodyColumns,
      rows: e.props.scroll.bodyRows,
    })
  })

  on('ui.render', { component: 'Pane', requestId: THEMES }, async ($, e) => {
    const look = await lookOf($, e)

    if (e.surface === 'mobile') {
      const { Text } = look.ui

      return <Text color={look.p.textMuted}>{`Type /themes <name>: ${THEME_NAMES().join(', ')}`}</Text>
    }

    const themes = THEME_NAMES()
      .map(name => ({ value: name, label: themeLabel(name), palette: themeOf(name).palette }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return themeStudio(look, themes, savedTheme, agentColor(look.theme, look.p, 'Build'), e.props.bodyColumns, value => {
      isPicked = true
      previewPaint += 1
      void applyTheme($, value)
        .then(() => $.ui.close({ id: THEMES }))
        .catch((error: unknown) => $.ui.log(`theme: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' }))
    })
  })

  on('ui.render', { component: 'Pane', requestId: SPINNER_PANE }, async ($, e) => {
    const look = await lookOf($, e)

    if (e.surface === 'mobile') {
      const { Text } = look.ui

      return <Text color={look.p.textMuted}>{`Type /spinner <style>: ${SPINNERS.join(', ')}`}</Text>
    }

    return spinnerGallery(look, await read($, frameAtom), look.spinner, style => {
      void pickSpinner($, style)
        .then(() => $.ui.close({ id: SPINNER_PANE }))
        .catch((error: unknown) => $.ui.log(`spinner: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' }))
    })
  })

  on('ui.render', { component: 'Pane', requestId: MINIMAP }, async ($, e) => {
    const look = await lookOf($, e)
    const lanes = await read($, timelineAtom)
    const isWorking = await read($, workingAtom)
    // Only a live turn's node spins, so only then does the timeline follow the frame.
    const isLive = isWorking && lanes.at(-1)?.ms === undefined && lanes.length > 0

    return timeline(look, {
      lanes,
      isWorking,
      frame: isLive ? await read($, frameAtom) : 0,
      agentColor: agentColor(look.theme, look.p, agentOf(await read($, modeAtom))),
      columns: e.props.bodyColumns,
      rows: e.props.scroll.bodyRows,
    })
  })
}
