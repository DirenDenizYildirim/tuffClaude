// The spinner styles /spinner picks between: frames of colored cells for the working row,
// one glyph for a pending tool row, and the shimmer that sweeps a word. A frame is 45ms.

import { mix, type Palette } from './palette'
import { braille } from './scanner'

export type Cell = { glyph: string; color: string }

export const SPINNERS = ['auto', 'braille', 'orbit', 'wave', 'bounce', 'pulse', 'shimmer'] as const
export type SpinnerStyle = (typeof SPINNERS)[number]
// What `auto` resolves to: one style per kind of work.
export type DrawnStyle = Exclude<SpinnerStyle, 'auto'>

export const DEFAULT_SPINNER: SpinnerStyle = 'auto'

export const spinnerOf = (name: unknown): SpinnerStyle => (SPINNERS as readonly unknown[]).includes(name) ? (name as SpinnerStyle) : DEFAULT_SPINNER

export const SPINNER_NOTES: Record<SpinnerStyle, string> = {
  auto: 'changes with what Claude is doing',
  braille: "opencode's braille dots",
  orbit: 'a dot circling a braille cell',
  wave: 'a bar graph rolling like a wave',
  bounce: 'a ball bouncing along a track',
  pulse: 'a dot breathing in and out',
  shimmer: 'a light sweeping across the word',
}

const ORBIT = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']
const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
const DROP = ['⠁', '⠂', '⠄', '⡀', '⡀', '⠄', '⠂', '⠁']
const BREATH = ['·', '•', '●', '•']
const TWINKLE = ['⋆', '✧', '✦', '✧']

const at = <T>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length] as T

// Smooth 0..1..0 over `period` frames.
const wave01 = (frame: number, period: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * frame) / period)

// A stop along primary → secondary → accent, for styles that color across their width.
function gradient(p: Palette, k: number): string {
  return k < 0.5 ? mix(p.secondary, p.primary, k * 2) : mix(p.accent, p.secondary, (k - 0.5) * 2)
}

// The working row's glyphs for a drawn style.
export function spinnerCells(style: DrawnStyle, frame: number, p: Palette): Cell[] {
  switch (style) {
    case 'braille':
      return [{ glyph: braille(frame), color: p.primary }]
    case 'orbit':
      return [{ glyph: at(ORBIT, Math.floor(frame / 2)), color: p.primary }]
    case 'wave':
      return Array.from({ length: 8 }, (_, i) => {
        const height = 0.5 + 0.5 * Math.sin((frame - i * 2.2) / 3)

        return { glyph: at(BARS, Math.round(height * (BARS.length - 1))), color: gradient(p, i / 7) }
      })
    case 'bounce': {
      const track = 9
      const span = (track - 1) * 2
      const step = Math.floor(frame / 2) % span
      const ball = step < track ? step : span - step
      const behind = step < track ? -1 : 1

      return Array.from({ length: track }, (_, i) =>
        i === ball
          ? { glyph: '●', color: p.primary }
          : i === ball + behind
            ? { glyph: '•', color: mix(p.primary, p.background, 0.55) }
            : { glyph: '·', color: p.borderSubtle },
      )
    }
    case 'pulse':
      return [{ glyph: '●', color: mix(p.primary, p.background, 0.2 + 0.8 * wave01(frame, 28)) }]
    case 'shimmer':
      return [{ glyph: at(TWINKLE, Math.floor(frame / 4)), color: mix(p.accent, p.primary, wave01(frame, 32)) }]
  }
}

// The one glyph a pending tool row spins with.
export function spinGlyph(style: SpinnerStyle, frame: number): string {
  switch (style) {
    case 'orbit':
      return at(ORBIT, Math.floor(frame / 2))
    case 'wave':
      return at([...BARS, ...BARS.slice(1, -1).reverse()], Math.floor(frame / 2))
    case 'bounce':
      return at(DROP, Math.floor(frame / 2))
    case 'pulse':
      return at(BREATH, Math.floor(frame / 4))
    case 'shimmer':
      return at(TWINKLE, Math.floor(frame / 4))
    default:
      return braille(frame)
  }
}

// A light band sweeping across `word`, left to right, then a pause.
export function shimmerCells(word: string, frame: number, base: string, bright: string): Cell[] {
  const chars = [...word]
  const head = (frame % (chars.length + 14)) - 4

  return chars.map((glyph, i) => {
    const distance = Math.abs(i - head)

    return { glyph, color: distance > 3 ? base : mix(bright, base, 1 - distance / 4) }
  })
}

export type Activity = { tool: string; detail: string }

const READS = new Set(['Read', 'NotebookRead'])
const SEARCHES = new Set(['Grep', 'Glob', 'LS', 'ToolSearch'])
const EDITS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const SHELLS = new Set(['Bash', 'BashOutput', 'KillShell'])
const AGENTS = new Set(['Agent', 'Task'])
const WEB = new Set(['WebFetch', 'WebSearch'])

// What `auto` draws, and the words it says, for the turn's mode and running tool.
export function autoSpinner(mode: string, activity: Activity | null): { style: DrawnStyle; word?: string } {
  if (mode === 'thinking') return { style: 'shimmer', word: 'Thinking' }
  if (mode === 'requesting') return { style: 'pulse' }
  if (mode === 'responding') return { style: 'wave', word: 'Writing' }

  if (mode === 'tool-use' && activity !== null) {
    const { tool, detail } = activity
    const about = detail === '' ? '' : ` ${detail}`

    if (READS.has(tool)) return { style: 'orbit', word: `Reading${about}` }
    if (SEARCHES.has(tool)) return { style: 'orbit', word: `Searching${about}` }
    if (EDITS.has(tool)) return { style: 'bounce', word: `${tool === 'Write' ? 'Writing' : 'Editing'}${about}` }
    if (SHELLS.has(tool)) return { style: 'braille', word: `Running${about}` }
    if (AGENTS.has(tool)) return { style: 'orbit', word: `Delegating${about}` }
    if (WEB.has(tool)) return { style: 'pulse', word: `Browsing${about}` }
  }

  return { style: 'braille' }
}
