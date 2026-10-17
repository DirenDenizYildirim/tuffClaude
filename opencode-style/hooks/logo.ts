// The home screen's logo in opencode's block font: "claude" in the muted ink, "code" in
// the bright one, bold. opencode's own letters (o, p, e, n, c, d) are copied from its
// logo.ts; l, a and u are drawn to match. Markers, as opencode reads them:
//   _  a space on the shadow        ^  ▀ in ink on the shadow
//   ~  ▀ in the shadow              ,  ▄ in the shadow

const GLYPHS: Record<string, readonly [string, string, string, string]> = {
  a: ['    ', '▀▀▀█', '█^^█', '▀▀▀▀'],
  c: ['    ', '█▀▀▀', '█___', '▀▀▀▀'],
  d: ['   ▄', '█▀▀█', '█__█', '▀▀▀▀'],
  e: ['    ', '█▀▀█', '█^^^', '▀▀▀▀'],
  l: ['▄', '█', '█', '▀'],
  n: ['    ', '█▀▀▄', '█__█', '▀~~▀'],
  o: ['    ', '█▀▀█', '█__█', '▀▀▀▀'],
  p: ['    ', '█▀▀█', '█__█', '█▀▀▀'],
  u: ['    ', '█  █', '█__█', '▀▀▀▀'],
}

export const wordRows = (word: string): string[] =>
  [0, 1, 2, 3].map(row =>
    [...word]
      .map(letter => GLYPHS[letter]?.[row] ?? '')
      .join(' '),
  )

export type LogoRun = { text: string; color: string; background?: string; bold?: boolean }

// One row of a word as runs of one style each, ready to draw as Text spans.
export function logoRuns(row: string, ink: string, shadow: string, bold: boolean): LogoRun[] {
  const runs: LogoRun[] = []

  for (const mark of row) {
    const cell: LogoRun =
      mark === '_'
        ? { text: ' ', color: ink, background: shadow }
        : mark === '^'
          ? { text: '▀', color: ink, background: shadow }
          : mark === '~'
            ? { text: '▀', color: shadow }
            : mark === ','
              ? { text: '▄', color: shadow }
              : { text: mark, color: ink }
    const last = runs.at(-1)

    if (last !== undefined && last.color === cell.color && last.background === cell.background) {
      last.text += cell.text
    } else {
      runs.push({ ...cell, ...(bold ? { bold } : {}) })
    }
  }

  return runs
}

export const LEFT_WORD = 'claude'
export const RIGHT_WORD = 'code'
export const LOGO_WIDTH = (wordRows(LEFT_WORD)[1]?.length ?? 0) + 1 + (wordRows(RIGHT_WORD)[1]?.length ?? 0)
