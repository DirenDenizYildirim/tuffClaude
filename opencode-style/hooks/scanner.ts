// opencode's working indicator, the Knight Rider scanner under its prompt (ui/spinner.ts):
// eight cells, a lead block sweeping right, holding, sweeping back, holding longer, its
// trail fading behind it. Colors are blended over the background here, since a terminal
// cell has no alpha.

import { brighten, mix } from './palette'

const WIDTH = 8
const HOLD_START = 30
const HOLD_END = 9
const TRAIL = 6
const INACTIVE_ALPHA = 0.6
const MIN_ALPHA = 0.3

export const SCANNER_FRAMES = WIDTH + HOLD_END + (WIDTH - 1) + HOLD_START

type State = { position: number; isHolding: boolean; hold: number; holdTotal: number; moved: number; moveTotal: number; isForward: boolean }

function stateAt(frame: number): State {
  const f = ((frame % SCANNER_FRAMES) + SCANNER_FRAMES) % SCANNER_FRAMES

  if (f < WIDTH) {
    return { position: f, isHolding: false, hold: 0, holdTotal: 0, moved: f, moveTotal: WIDTH, isForward: true }
  }

  if (f < WIDTH + HOLD_END) {
    return { position: WIDTH - 1, isHolding: true, hold: f - WIDTH, holdTotal: HOLD_END, moved: 0, moveTotal: 0, isForward: true }
  }

  if (f < WIDTH + HOLD_END + WIDTH - 1) {
    const back = f - WIDTH - HOLD_END

    return { position: WIDTH - 2 - back, isHolding: false, hold: 0, holdTotal: 0, moved: back, moveTotal: WIDTH - 1, isForward: false }
  }

  return { position: 0, isHolding: true, hold: f - WIDTH - HOLD_END - (WIDTH - 1), holdTotal: HOLD_START, moved: 0, moveTotal: 0, isForward: false }
}

function trailIndex(state: State, cell: number): number {
  const distance = state.isForward ? state.position - cell : cell - state.position

  if (state.isHolding) {
    return distance + state.hold
  }

  return distance >= 0 && distance < TRAIL ? distance : -1
}

export type ScannerCell = { glyph: string; color: string }

export function scannerCells(frame: number, color: string, background: string): ScannerCell[] {
  const state = stateAt(frame)
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const alpha = i === 0 ? 1 : i === 1 ? 0.9 : 0.65 ** (i - 1)
    const ink = i === 1 ? brighten(color, 1.15) : color

    return mix(ink, background, alpha)
  })
  const fade = state.isHolding
    ? Math.max(MIN_ALPHA, 1 - Math.min(state.hold / Math.max(1, state.holdTotal), 1) * (1 - MIN_ALPHA))
    : MIN_ALPHA + Math.min(state.moved / Math.max(1, state.moveTotal - 1), 1) * (1 - MIN_ALPHA)
  const inactive = mix(color, background, INACTIVE_ALPHA * fade)

  return Array.from({ length: WIDTH }, (_, cell) => {
    const index = trailIndex(state, cell)
    const lit = index >= 0 && index < TRAIL

    return { glyph: lit ? '■' : '⬝', color: lit ? (trail[index] ?? color) : inactive }
  })
}

// The braille spinner opencode draws beside a pending row, at 80ms a frame.
const BRAILLE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const braille = (frame: number): string => BRAILLE[Math.floor(frame / 2) % BRAILLE.length] ?? '⠋'
