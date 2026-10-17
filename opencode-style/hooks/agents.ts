// What the sidebar's Agents section needs that the engine does not say: what a subagent's
// tokens cost, and short names for its type and model. Pure: no engine.

// Dollars per million tokens, first-party API rates (claude-api skill, cached 2026-10-06).
// Cache writes are billed at 1.25x input (5-minute TTL); reads as listed.
type Price = { input: number; output: number; cacheRead: number }

const PRICES: [RegExp, Price][] = [
  [/(fable|mythos)-5-1/, { input: 10, output: 50, cacheRead: 0.25 }],
  [/(fable|mythos)-5/, { input: 10, output: 50, cacheRead: 1 }],
  [/opus-5-5/, { input: 4, output: 20, cacheRead: 0.2 }],
  [/opus-(5|4-[5-9])/, { input: 5, output: 25, cacheRead: 0.5 }],
  [/sonnet-5/, { input: 2, output: 10, cacheRead: 0.2 }],
  [/sonnet-4/, { input: 3, output: 15, cacheRead: 0.3 }],
  [/haiku-5-5/, { input: 0.1, output: 0.5, cacheRead: 0.01 }],
  [/haiku-4/, { input: 1, output: 5, cacheRead: 0.1 }],
]

export type StepUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

// One response's cost in dollars, or undefined for a model not in the table.
export function costOf(model: string, usage: StepUsage): number | undefined {
  const price = PRICES.find(([pattern]) => pattern.test(model))?.[1]

  if (price === undefined) return undefined

  return (
    (usage.input_tokens * price.input +
      usage.output_tokens * price.output +
      usage.cache_read_input_tokens * price.cacheRead +
      usage.cache_creation_input_tokens * price.input * 1.25) /
    1_000_000
  )
}

// Everything one response held: what Claude Code's agent rows count as the agent's tokens.
export const tokensOf = (usage: StepUsage): number => usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

// `general-purpose` → `General`, `claude-code-guide` → `Claude Code Guide`.
export function agentLabel(kind: string): string {
  if (kind === '' || kind === 'general-purpose') return 'General'

  return kind.replace(/(^|[-_ ])(\w)/g, (_, sep: string, ch: string) => `${sep === '' ? '' : ' '}${ch.toUpperCase()}`)
}

// `claude-opus-5-5` → `Opus 5.5`, `sonnet` → `Sonnet`: short enough for the sidebar.
export function shortModel(model: string): string {
  const id = /(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/i.exec(model)
  const cap = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`

  if (id !== null) return `${cap(id[1] ?? '')} ${id[2]}${id[3] === undefined || id[3].length > 2 ? '' : `.${id[3]}`}`

  const alias = /^(opus|sonnet|haiku|fable)\b/i.exec(model.trim())

  return alias === null ? model : cap(alias[1] ?? '')
}
