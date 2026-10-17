// What a tool call's row says, in opencode's words: an icon, a verb, a target, a tail.
// Pure: reads the call's input and output, never the engine.

import { clip, diffstat, fieldsOf, oneLine, shortenPath, textOf } from './format'

export type Paths = { cwd: string; home: string }

// The block tools draw a panel under their title; the rest are one inline line.
export type Shape = 'inline' | 'bash' | 'edit' | 'write' | 'todos' | 'task'

export type Row = {
  shape: Shape
  icon: string
  // What the line says once the call has its answer: `Read src/app.ts`.
  text: string
  // What it says while the model is still writing the call or it runs.
  pending: string
  // Dim words after the text: `(12 matches)`, `[offset=40]`.
  tail: string
}

const SHELLS = new Set(['Bash', 'PowerShell'])

const quoted = (text: string): string => `"${clip(oneLine(text), 80)}"`

// A Read's window, as opencode appends it to the path: `:40-120`.
function readRange(fields: Record<string, unknown>): string {
  const offset = typeof fields.offset === 'number' ? fields.offset : undefined
  const limit = typeof fields.limit === 'number' ? fields.limit : undefined

  if (offset === undefined && limit === undefined) {
    return ''
  }

  const start = offset ?? 1

  return limit === undefined ? `:${start}` : `:${start}-${start + limit - 1}`
}

const matches = (n: number): string => `(${n} ${n === 1 ? 'match' : 'matches'})`

// `[k=v, k2=v2]`: a call's plain arguments, the way opencode lists a tool it has no row for.
function argList(fields: Record<string, unknown>): string {
  const args = Object.entries(fields)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) && String(value).trim() !== '')
    .map(([key, value]) => `${key}=${clip(oneLine(String(value)), 40)}`)

  return args.length === 0 ? '' : ` [${clip(args.join(', '), 100)}]`
}

function lineCount(text: string): number {
  return text === '' ? 0 : text.replace(/\n$/, '').split('\n').length
}

// `mcp__github__create_issue` → `github_create_issue`, the way opencode names MCP tools.
export function toolName(tool: string): string {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)

  return mcp === null ? tool : `${mcp[1]}_${mcp[2]}`
}

export function rowOf(tool: string, input: unknown, output: unknown, paths: Paths): Row {
  const f = fieldsOf(input)
  const out = fieldsOf(output)
  const path = (key: string) => shortenPath(textOf(f[key]), paths.cwd, paths.home)

  if (SHELLS.has(tool)) {
    const description = textOf(f.description)

    return {
      shape: 'bash',
      icon: '$',
      text: description === '' ? 'Shell' : description,
      pending: 'Writing command…',
      tail: '',
    }
  }

  switch (tool) {
    case 'Read': {
      return { shape: 'inline', icon: '→', text: `Read ${path('file_path')}${readRange(f)}`, pending: 'Reading file…', tail: '' }
    }
    case 'Write':
      return { shape: 'write', icon: '←', text: `Write ${path('file_path')}`, pending: 'Preparing write…', tail: '' }
    case 'Edit':
    case 'MultiEdit': {
      const stat = diffstat(output)

      return {
        shape: 'edit',
        icon: '←',
        text: `Edit ${path('file_path')}`,
        pending: 'Preparing edit…',
        tail: stat === null ? '' : `+${stat.added} -${stat.removed}`,
      }
    }
    case 'NotebookEdit':
      return { shape: 'inline', icon: '←', text: `Edit ${path('notebook_path')}`, pending: 'Preparing edit…', tail: '' }
    case 'Glob': {
      const where = path('path')
      const count = Array.isArray(out.filenames) ? matches(out.filenames.length) : ''

      return { shape: 'inline', icon: '✱', text: `Glob ${quoted(textOf(f.pattern))}${where === '' ? '' : ` in ${where}`}`, pending: 'Finding files…', tail: count }
    }
    case 'Grep': {
      const where = path('path')
      const count = typeof out.numMatches === 'number' ? matches(out.numMatches) : typeof out.numFiles === 'number' ? matches(out.numFiles) : ''

      return { shape: 'inline', icon: '✱', text: `Grep ${quoted(textOf(f.pattern))}${where === '' ? '' : ` in ${where}`}`, pending: 'Searching content…', tail: count }
    }
    case 'LS':
      return { shape: 'inline', icon: '→', text: `List ${path('path')}`, pending: 'Listing directory…', tail: '' }
    case 'WebFetch':
      return { shape: 'inline', icon: '%', text: `WebFetch ${textOf(f.url)}`, pending: 'Fetching from the web…', tail: '' }
    case 'WebSearch': {
      const results = Array.isArray(out.results)
        ? out.results.reduce<number>((n, item) => n + (Array.isArray(fieldsOf(item).content) ? (fieldsOf(item).content as unknown[]).length : 0), 0)
        : 0

      return { shape: 'inline', icon: '◈', text: `Web Search ${quoted(textOf(f.query))}`, pending: 'Searching web…', tail: results > 0 ? `(${results} results)` : '' }
    }
    case 'TodoWrite':
      return { shape: 'todos', icon: '#', text: 'Todos', pending: 'Updating todos…', tail: '' }
    case 'TaskCreate':
      return { shape: 'inline', icon: '☐', text: `Todo ${quoted(textOf(f.subject))}`, pending: 'Adding todo…', tail: '' }
    case 'TaskUpdate': {
      const status = textOf(f.status)

      return { shape: 'inline', icon: status === 'completed' ? '✓' : '☐', text: `Todo #${textOf(f.taskId)}${status === '' ? '' : ` ${status.replace('_', ' ')}`}`, pending: 'Updating todo…', tail: '' }
    }
    case 'TaskList':
    case 'TaskGet':
      return { shape: 'inline', icon: '→', text: 'Read todos', pending: 'Reading todos…', tail: '' }
    case 'Agent':
    case 'Task': {
      const kind = textOf(f.subagent_type)
      const label = kind === '' ? 'General' : kind.replace(/(^|[-_ ])(\w)/g, (_, sep: string, ch: string) => `${sep === '' ? '' : ' '}${ch.toUpperCase()}`)
      const description = textOf(f.description)

      return { shape: 'task', icon: '✓', text: `${label} Subagent${description === '' ? '' : ` — ${description}`}`, pending: 'Delegating…', tail: '' }
    }
    case 'Skill':
      return { shape: 'inline', icon: '→', text: `Skill ${quoted(textOf(f.skill))}`, pending: 'Loading skill…', tail: '' }
    case 'ToolSearch':
      return { shape: 'inline', icon: '✱', text: `Tool search ${quoted(textOf(f.query))}`, pending: 'Searching tools…', tail: '' }
    case 'LSP':
      return { shape: 'inline', icon: '→', text: `LSP ${textOf(f.operation)} ${path('filePath')}`.trim(), pending: 'Asking the language server…', tail: '' }
    default:
      return { shape: 'inline', icon: '✓', text: `${toolName(tool)}${argList(f)}`, pending: toolName(tool), tail: '' }
  }
}

// What a bash block draws under its title: `$ command`, then the output, cut to `limit` lines.
export function bashBody(input: unknown, output: unknown, limit: number): { command: string; lines: string[]; hidden: number } {
  const f = fieldsOf(input)
  const out = fieldsOf(output)
  const text = [textOf(out.stdout), textOf(out.stderr)].filter(part => part.trim() !== '').join('\n').replace(/\s+$/, '')
  const all = text === '' ? [] : text.split('\n')
  const lines = all.length > limit ? all.slice(0, limit) : all

  return { command: textOf(f.command), lines, hidden: all.length - lines.length }
}

// The Write block's body: the file as written, cut to `limit` lines.
export function writeBody(input: unknown, limit: number): { lines: string[]; hidden: number } {
  const content = textOf(fieldsOf(input).content)
  const total = lineCount(content)
  const lines = content.replace(/\n$/, '').split('\n').slice(0, limit)

  return { lines: total === 0 ? [] : lines, hidden: Math.max(0, total - limit) }
}

export type TodoLine = { mark: string; text: string; status: 'pending' | 'in_progress' | 'completed' }

export function todoLines(input: unknown): TodoLine[] {
  const todos = fieldsOf(input).todos

  if (!Array.isArray(todos)) {
    return []
  }

  return todos.flatMap(item => {
    const t = fieldsOf(item)
    const status = t.status === 'completed' || t.status === 'in_progress' ? t.status : 'pending'
    const text = textOf(t.content)

    return text === '' ? [] : [{ mark: status === 'completed' ? '[✓]' : status === 'in_progress' ? '[•]' : '[ ]', text, status }]
  })
}

// The unified diff an Edit or Write answered with, as Code's `diff` format reads it.
export function patchOf(output: unknown): string | null {
  const patch = fieldsOf(output).structuredPatch

  if (!Array.isArray(patch) || patch.length === 0) {
    return null
  }

  const hunks = patch.flatMap(hunk => {
    const h = fieldsOf(hunk)
    const lines = Array.isArray(h.lines) ? h.lines.filter((line): line is string => typeof line === 'string') : []

    return [`@@ -${String(h.oldStart)},${String(h.oldLines)} +${String(h.newStart)},${String(h.newLines)} @@`, ...lines]
  })

  return hunks.join('\n')
}

export const isShell = (tool: string): boolean => SHELLS.has(tool)
