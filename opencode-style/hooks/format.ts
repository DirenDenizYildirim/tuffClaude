// Plain string helpers: no engine, no drawing.

export const oneLine = (text: string): string => (text.split('\n', 1)[0] ?? '').replace(/\s+/g, ' ').trim()

export const textOf = (value: unknown): string => (typeof value === 'string' ? value : '')

export const fieldsOf = (input: unknown): Record<string, unknown> =>
  input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {}

const slashed = (path: string): string => path.replace(/\\/g, '/')

// A path under the session's directory shows relative to it, one under home with `~`.
export function shortenPath(path: string, cwd: string, home = ''): string {
  const full = slashed(path)
  const root = slashed(cwd).replace(/\/+$/, '')

  if (root !== '' && full.startsWith(`${root}/`)) {
    return full.slice(root.length + 1)
  }

  const homeRoot = slashed(home).replace(/\/+$/, '')

  return homeRoot !== '' && (full === homeRoot || full.startsWith(`${homeRoot}/`)) ? `~${full.slice(homeRoot.length)}` : full
}

// `1.2s`, `340ms`, `1m 4s`: opencode's duration style.
export function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${Math.max(0, Math.round(ms))}ms`
  }

  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`
  }

  const seconds = Math.round(ms / 1000)

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

// `12,345`: the sidebar's token count.
export const formatCount = (n: number): string => Math.round(n).toLocaleString('en-US')

export const formatUsd = (usd: number): string => `$${usd.toFixed(2)}`

// Lines added and removed, read from an Edit or Write record's patch.
export function diffstat(output: unknown): { added: number; removed: number } | null {
  const patch = fieldsOf(output).structuredPatch

  if (!Array.isArray(patch)) {
    return null
  }

  let added = 0
  let removed = 0

  for (const hunk of patch) {
    const lines = fieldsOf(hunk).lines

    if (!Array.isArray(lines)) {
      continue
    }

    for (const line of lines) {
      if (typeof line !== 'string') continue
      if (line.startsWith('+')) added += 1
      else if (line.startsWith('-')) removed += 1
    }
  }

  return { added, removed }
}

export const clip = (text: string, width: number): string =>
  width <= 1 ? text.slice(0, Math.max(0, width)) : text.length <= width ? text : `${text.slice(0, width - 1)}…`
