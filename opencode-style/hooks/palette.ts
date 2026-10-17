// opencode's themes, dark mode, resolved from its theme files (packages/tui/src/theme/assets),
// and what each one paints in Claude Code: the mod's own rows read `Palette`, Claude Code's
// own UI reads the custom theme `claudeOverrides` builds (themes/<name>.json).

export type Palette = {
  primary: string
  secondary: string
  accent: string
  error: string
  warning: string
  success: string
  info: string
  text: string
  textMuted: string
  background: string
  backgroundPanel: string
  backgroundElement: string
  border: string
  borderActive: string
  borderSubtle: string
  diffAdded: string
  diffRemoved: string
  diffAddedBg: string
  diffRemovedBg: string
  diffHighlightAdded: string
  diffHighlightRemoved: string
}

// What you picked in opencode itself (~/.config/opencode/cli.json).
export const DEFAULT_THEME = 'github'

// The agents' colors, as opencode picks them: the theme's first categorical hue for Build
// (its `secondary`), the fourth for Plan. opencode's own theme names them outright.
const AGENT_HUES: Record<string, { build: string; plan: string }> = {
  opencode: { build: '#5c9cf5', plan: '#fab283' },
}

export function agentColor(theme: string, palette: Palette, agent: string): string {
  const hues = AGENT_HUES[theme] ?? { build: palette.secondary, plan: palette.warning }

  return agent === 'Plan' ? hues.plan : hues.build
}

const channels = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16)

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const toHex = (rgb: readonly number[]): string =>
  `#${rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`

// `amount` of `ink` laid over `base`: opencode's alpha blending, done ahead of the terminal.
export function mix(ink: string, base: string, amount: number): string {
  const a = channels(ink)
  const b = channels(base)

  return toHex(a.map((c, i) => c * amount + (b[i] ?? 0) * (1 - amount)))
}

export function brighten(hex: string, factor: number): string {
  return toHex(channels(hex).map(c => c * factor))
}

export const rgb = (hex: string): string => `rgb(${channels(hex).join(',')})`

// Claude Code's own theme keys, painted from the palette: the prompt's border, the
// spinner, the diff colors, menus. Laid over Claude Code's dark theme.
export function claudeOverrides(theme: string, p: Palette): Record<string, string> {
  const plan = agentColor(theme, p, 'Plan')
  const colors: Record<string, string> = {
    text: p.text,
    inverseText: p.background,
    inactive: p.textMuted,
    inactiveShimmer: mix(p.text, p.textMuted, 0.4),
    subtle: p.border,
    suggestion: p.primary,
    remember: p.accent,
    success: p.success,
    error: p.error,
    warning: p.warning,
    warningShimmer: mix(p.text, p.warning, 0.3),
    merged: p.accent,
    claude: p.primary,
    claudeShimmer: mix('#ffffff', p.primary, 0.3),
    claudeBlue_FOR_SYSTEM_SPINNER: p.secondary,
    claudeBlueShimmer_FOR_SYSTEM_SPINNER: mix('#ffffff', p.secondary, 0.3),
    permission: p.primary,
    permissionShimmer: mix('#ffffff', p.primary, 0.3),
    planMode: plan,
    autoAccept: p.accent,
    autoAcceptShimmer: mix('#ffffff', p.accent, 0.3),
    skill: p.accent,
    promptBorder: p.border,
    promptBorderShimmer: p.borderActive,
    bashBorder: p.primary,
    ide: p.info,
    diffAdded: p.diffAddedBg,
    diffRemoved: p.diffRemovedBg,
    diffAddedDimmed: mix(p.diffAddedBg, p.background, 0.55),
    diffRemovedDimmed: mix(p.diffRemovedBg, p.background, 0.55),
    diffAddedWord: mix(p.diffHighlightAdded, p.diffAddedBg, 0.4),
    diffRemovedWord: mix(p.diffHighlightRemoved, p.diffRemovedBg, 0.4),
    userMessageBackground: p.backgroundPanel,
    userMessageBackgroundHover: p.backgroundElement,
    composerSidebarBackground: p.backgroundPanel,
    selectionBg: mix(p.primary, p.background, 0.35),
    bashMessageBackgroundColor: p.backgroundPanel,
    memoryBackgroundColor: p.backgroundPanel,
    clawd_body: p.primary,
    clawd_background: p.background,
    professionalBlue: p.secondary,
    rate_limit_fill: p.primary,
    rate_limit_empty: p.backgroundElement,
    briefLabelYou: p.secondary,
    briefLabelClaude: p.primary,
    fastMode: p.warning,
    fastModeShimmer: mix('#ffffff', p.warning, 0.3),
    effortUltra: p.accent,
  }

  return Object.fromEntries(Object.entries(colors).map(([key, hex]) => [key, rgb(hex)]))
}

// What /themes lists: opencode's own spelling of each name.
export function themeLabel(name: string): string {
  const special: Record<string, string> = {
    opencode: 'OpenCode',
    github: 'GitHub',
    'one-dark': 'One Dark',
    nightowl: 'Night Owl',
    rosepine: 'Rosé Pine',
    synthwave84: 'Synthwave 84',
    'osaka-jade': 'Osaka Jade',
    tokyonight: 'Tokyo Night',
  }

  return special[name] ?? name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export const themeOf = (name: string | undefined): { name: string; palette: Palette } => {
  const key = name !== undefined && Object.hasOwn(PALETTES, name) ? name : DEFAULT_THEME

  return { name: key, palette: PALETTES[key] as Palette }
}

export const THEME_NAMES = (): string[] => Object.keys(PALETTES)

export const PALETTES: Record<string, Palette> = {
  'aura': { primary: '#a277ff', secondary: '#f694ff', accent: '#a277ff', error: '#ff6767', warning: '#ffca85', success: '#61ffca', info: '#a277ff', text: '#edecee', textMuted: '#6d6d6d', background: '#0f0f0f', backgroundPanel: '#15141b', backgroundElement: '#15141b', border: '#2d2d2d', borderActive: '#6d6d6d', borderSubtle: '#2d2d2d', diffAdded: '#61ffca', diffRemoved: '#ff6767', diffAddedBg: '#354933', diffRemovedBg: '#3f191a', diffHighlightAdded: '#61ffca', diffHighlightRemoved: '#ff6767' },
  'ayu': { primary: '#59c2ff', secondary: '#d2a6ff', accent: '#e6b450', error: '#d95757', warning: '#e6b673', success: '#7fd962', info: '#39bae6', text: '#bfbdb6', textMuted: '#565b66', background: '#0b0e14', backgroundPanel: '#0f131a', backgroundElement: '#0d1017', border: '#6c7380', borderActive: '#6c7380', borderSubtle: '#11151c', diffAdded: '#7fd962', diffRemoved: '#f26d78', diffAddedBg: '#20303b', diffRemovedBg: '#37222c', diffHighlightAdded: '#aad94c', diffHighlightRemoved: '#f07178' },
  'carbonfox': { primary: '#33b1ff', secondary: '#78a9ff', accent: '#ff7eb6', error: '#ee5396', warning: '#f1c21b', success: '#25be6a', info: '#78a9ff', text: '#f2f4f8', textMuted: '#7d848f', background: '#161616', backgroundPanel: '#1a1a1a', backgroundElement: '#1e1e1e', border: '#303030', borderActive: '#33b1ff', borderSubtle: '#262626', diffAdded: '#50fa7b', diffRemoved: '#ff6b6b', diffAddedBg: '#0f2418', diffRemovedBg: '#2a1216', diffHighlightAdded: '#7dffaa', diffHighlightRemoved: '#ff9999' },
  'catppuccin-frappe': { primary: '#8da4e2', secondary: '#ca9ee6', accent: '#f4b8e4', error: '#e78284', warning: '#e5c890', success: '#a6d189', info: '#81c8be', text: '#c6d0f5', textMuted: '#949cb8', background: '#303446', backgroundPanel: '#292c3c', backgroundElement: '#232634', border: '#414559', borderActive: '#51576d', borderSubtle: '#626880', diffAdded: '#a6d189', diffRemoved: '#e78284', diffAddedBg: '#29342b', diffRemovedBg: '#3a2a31', diffHighlightAdded: '#a6d189', diffHighlightRemoved: '#e78284' },
  'catppuccin-macchiato': { primary: '#8aadf4', secondary: '#c6a0f6', accent: '#f5bde6', error: '#ed8796', warning: '#eed49f', success: '#a6da95', info: '#8bd5ca', text: '#cad3f5', textMuted: '#939ab7', background: '#24273a', backgroundPanel: '#1e2030', backgroundElement: '#181926', border: '#363a4f', borderActive: '#494d64', borderSubtle: '#5b6078', diffAdded: '#a6da95', diffRemoved: '#ed8796', diffAddedBg: '#29342b', diffRemovedBg: '#3a2a31', diffHighlightAdded: '#a6da95', diffHighlightRemoved: '#ed8796' },
  'catppuccin': { primary: '#89b4fa', secondary: '#cba6f7', accent: '#f5c2e7', error: '#f38ba8', warning: '#f9e2af', success: '#a6e3a1', info: '#94e2d5', text: '#cdd6f4', textMuted: '#9399b2', background: '#1e1e2e', backgroundPanel: '#181825', backgroundElement: '#11111b', border: '#313244', borderActive: '#45475a', borderSubtle: '#585b70', diffAdded: '#a6e3a1', diffRemoved: '#f38ba8', diffAddedBg: '#24312b', diffRemovedBg: '#3c2a32', diffHighlightAdded: '#a6e3a1', diffHighlightRemoved: '#f38ba8' },
  'cobalt2': { primary: '#0088ff', secondary: '#9a5feb', accent: '#2affdf', error: '#ff0088', warning: '#ffc600', success: '#9eff80', info: '#ff9d00', text: '#ffffff', textMuted: '#adb7c9', background: '#193549', backgroundPanel: '#122738', backgroundElement: '#1f4662', border: '#1f4662', borderActive: '#0088ff', borderSubtle: '#0e1e2e', diffAdded: '#9eff80', diffRemoved: '#ff0088', diffAddedBg: '#1a3a2a', diffRemovedBg: '#3a1a2a', diffHighlightAdded: '#b9ff9f', diffHighlightRemoved: '#ff5fb3' },
  'cursor': { primary: '#88c0d0', secondary: '#81a1c1', accent: '#88c0d0', error: '#e34671', warning: '#f1b467', success: '#3fa266', info: '#81a1c1', text: '#e4e4e4', textMuted: '#e4e4e4', background: '#181818', backgroundPanel: '#141414', backgroundElement: '#262626', border: '#e4e4e4', borderActive: '#88c0d0', borderSubtle: '#0f0f0f', diffAdded: '#3fa266', diffRemoved: '#e34671', diffAddedBg: '#3fa266', diffRemovedBg: '#b80049', diffHighlightAdded: '#70b489', diffHighlightRemoved: '#fc6b83' },
  'dracula': { primary: '#bd93f9', secondary: '#ff79c6', accent: '#8be9fd', error: '#ff5555', warning: '#f1fa8c', success: '#50fa7b', info: '#ffb86c', text: '#f8f8f2', textMuted: '#6272a4', background: '#282a36', backgroundPanel: '#21222c', backgroundElement: '#44475a', border: '#44475a', borderActive: '#bd93f9', borderSubtle: '#191a21', diffAdded: '#50fa7b', diffRemoved: '#ff5555', diffAddedBg: '#1a3a1a', diffRemovedBg: '#3a1a1a', diffHighlightAdded: '#50fa7b', diffHighlightRemoved: '#ff5555' },
  'everforest': { primary: '#a7c080', secondary: '#7fbbb3', accent: '#d699b6', error: '#e67e80', warning: '#e69875', success: '#a7c080', info: '#83c092', text: '#d3c6aa', textMuted: '#7a8478', background: '#2d353b', backgroundPanel: '#333c43', backgroundElement: '#343f44', border: '#859289', borderActive: '#9da9a0', borderSubtle: '#7a8478', diffAdded: '#4fd6be', diffRemoved: '#c53b53', diffAddedBg: '#20303b', diffRemovedBg: '#37222c', diffHighlightAdded: '#b8db87', diffHighlightRemoved: '#e26a75' },
  'flexoki': { primary: '#da702c', secondary: '#4385be', accent: '#8b7ec8', error: '#d14d41', warning: '#da702c', success: '#879a39', info: '#3aa99f', text: '#cecdc3', textMuted: '#6f6e69', background: '#100f0f', backgroundPanel: '#1c1b1a', backgroundElement: '#282726', border: '#575653', borderActive: '#6f6e69', borderSubtle: '#403e3c', diffAdded: '#879a39', diffRemoved: '#d14d41', diffAddedBg: '#1a2d1a', diffRemovedBg: '#2d1a1a', diffHighlightAdded: '#879a39', diffHighlightRemoved: '#d14d41' },
  'github': { primary: '#58a6ff', secondary: '#bc8cff', accent: '#39c5cf', error: '#f85149', warning: '#e3b341', success: '#3fb950', info: '#d29922', text: '#c9d1d9', textMuted: '#8b949e', background: '#0d1117', backgroundPanel: '#010409', backgroundElement: '#161b22', border: '#30363d', borderActive: '#58a6ff', borderSubtle: '#21262d', diffAdded: '#3fb950', diffRemoved: '#f85149', diffAddedBg: '#033a16', diffRemovedBg: '#67060c', diffHighlightAdded: '#3fb950', diffHighlightRemoved: '#f85149' },
  'gruvbox': { primary: '#83a598', secondary: '#d3869b', accent: '#8ec07c', error: '#fb4934', warning: '#fe8019', success: '#b8bb26', info: '#fabd2f', text: '#ebdbb2', textMuted: '#928374', background: '#282828', backgroundPanel: '#3c3836', backgroundElement: '#504945', border: '#665c54', borderActive: '#ebdbb2', borderSubtle: '#504945', diffAdded: '#98971a', diffRemoved: '#cc241d', diffAddedBg: '#32302f', diffRemovedBg: '#322929', diffHighlightAdded: '#b8bb26', diffHighlightRemoved: '#fb4934' },
  'kanagawa': { primary: '#7e9cd8', secondary: '#957fb8', accent: '#d27e99', error: '#e82424', warning: '#d7a657', success: '#98bb6c', info: '#76946a', text: '#dcd7ba', textMuted: '#727169', background: '#1f1f28', backgroundPanel: '#2a2a37', backgroundElement: '#363646', border: '#54546d', borderActive: '#c38d9d', borderSubtle: '#363646', diffAdded: '#98bb6c', diffRemoved: '#e82424', diffAddedBg: '#252e25', diffRemovedBg: '#362020', diffHighlightAdded: '#a9d977', diffHighlightRemoved: '#f24a4a' },
  'material': { primary: '#82aaff', secondary: '#c792ea', accent: '#89ddff', error: '#f07178', warning: '#ffcb6b', success: '#c3e88d', info: '#ffcb6b', text: '#eeffff', textMuted: '#546e7a', background: '#263238', backgroundPanel: '#1e272c', backgroundElement: '#37474f', border: '#37474f', borderActive: '#82aaff', borderSubtle: '#1e272c', diffAdded: '#c3e88d', diffRemoved: '#f07178', diffAddedBg: '#2e3c2b', diffRemovedBg: '#3c2b2b', diffHighlightAdded: '#c3e88d', diffHighlightRemoved: '#f07178' },
  'matrix': { primary: '#2eff6a', secondary: '#00efff', accent: '#c770ff', error: '#ff4b4b', warning: '#e6ff57', success: '#62ff94', info: '#30b3ff', text: '#62ff94', textMuted: '#8ca391', background: '#0a0e0a', backgroundPanel: '#0e130d', backgroundElement: '#141c12', border: '#1e2a1b', borderActive: '#2eff6a', borderSubtle: '#141c12', diffAdded: '#1cc24b', diffRemoved: '#ff4b4b', diffAddedBg: '#132616', diffRemovedBg: '#261212', diffHighlightAdded: '#77ffaf', diffHighlightRemoved: '#ff7171' },
  'mercury': { primary: '#8da4f5', secondary: '#a7b6f8', accent: '#8da4f5', error: '#fc92b4', warning: '#fc9b6f', success: '#77c599', info: '#77becf', text: '#dddde5', textMuted: '#9d9da8', background: '#171721', backgroundPanel: '#10101a', backgroundElement: '#272735', border: '#b4b7c8', borderActive: '#8da4f5', borderSubtle: '#b4b7c8', diffAdded: '#77c599', diffRemoved: '#fc92b4', diffAddedBg: '#77c599', diffRemovedBg: '#fc92b4', diffHighlightAdded: '#77c599', diffHighlightRemoved: '#fc92b4' },
  'monokai': { primary: '#66d9ef', secondary: '#ae81ff', accent: '#a6e22e', error: '#f92672', warning: '#e6db74', success: '#a6e22e', info: '#fd971f', text: '#f8f8f2', textMuted: '#75715e', background: '#272822', backgroundPanel: '#1e1f1c', backgroundElement: '#3e3d32', border: '#3e3d32', borderActive: '#66d9ef', borderSubtle: '#1e1f1c', diffAdded: '#a6e22e', diffRemoved: '#f92672', diffAddedBg: '#1a3a1a', diffRemovedBg: '#3a1a1a', diffHighlightAdded: '#a6e22e', diffHighlightRemoved: '#f92672' },
  'nightowl': { primary: '#82aaff', secondary: '#7fdbca', accent: '#c792ea', error: '#ef5350', warning: '#ecc48d', success: '#c5e478', info: '#82aaff', text: '#d6deeb', textMuted: '#5f7e97', background: '#011627', backgroundPanel: '#0b253a', backgroundElement: '#0b253a', border: '#5f7e97', borderActive: '#82aaff', borderSubtle: '#5f7e97', diffAdded: '#c5e478', diffRemoved: '#ef5350', diffAddedBg: '#0a2e1a', diffRemovedBg: '#2d1b1b', diffHighlightAdded: '#c5e478', diffHighlightRemoved: '#ef5350' },
  'nord': { primary: '#88c0d0', secondary: '#81a1c1', accent: '#8fbcbb', error: '#bf616a', warning: '#d08770', success: '#a3be8c', info: '#88c0d0', text: '#eceff4', textMuted: '#8b95a7', background: '#2e3440', backgroundPanel: '#3b4252', backgroundElement: '#434c5e', border: '#434c5e', borderActive: '#4c566a', borderSubtle: '#434c5e', diffAdded: '#a3be8c', diffRemoved: '#bf616a', diffAddedBg: '#3b4252', diffRemovedBg: '#3b4252', diffHighlightAdded: '#a3be8c', diffHighlightRemoved: '#bf616a' },
  'one-dark': { primary: '#61afef', secondary: '#c678dd', accent: '#56b6c2', error: '#e06c75', warning: '#e5c07b', success: '#98c379', info: '#d19a66', text: '#abb2bf', textMuted: '#5c6370', background: '#282c34', backgroundPanel: '#21252b', backgroundElement: '#353b45', border: '#393f4a', borderActive: '#61afef', borderSubtle: '#2c313a', diffAdded: '#98c379', diffRemoved: '#e06c75', diffAddedBg: '#2c382b', diffRemovedBg: '#3a2d2f', diffHighlightAdded: '#aad482', diffHighlightRemoved: '#e8828b' },
  'opencode': { primary: '#fab283', secondary: '#5c9cf5', accent: '#9d7cd8', error: '#e06c75', warning: '#f5a742', success: '#7fd88f', info: '#56b6c2', text: '#eeeeee', textMuted: '#808080', background: '#0a0a0a', backgroundPanel: '#141414', backgroundElement: '#1e1e1e', border: '#484848', borderActive: '#606060', borderSubtle: '#3c3c3c', diffAdded: '#4fd6be', diffRemoved: '#c53b53', diffAddedBg: '#20303b', diffRemovedBg: '#37222c', diffHighlightAdded: '#b8db87', diffHighlightRemoved: '#e26a75' },
  'orng': { primary: '#ec5b2b', secondary: '#ee7948', accent: '#fff7f1', error: '#e06c75', warning: '#ec5b2b', success: '#6ba1e6', info: '#56b6c2', text: '#eeeeee', textMuted: '#808080', background: '#0a0a0a', backgroundPanel: '#141414', backgroundElement: '#1e1e1e', border: '#ec5b2b', borderActive: '#ee7948', borderSubtle: '#3c3c3c', diffAdded: '#6ba1e6', diffRemoved: '#c53b53', diffAddedBg: '#1a2a3d', diffRemovedBg: '#37222c', diffHighlightAdded: '#6ba1e6', diffHighlightRemoved: '#e26a75' },
  'osaka-jade': { primary: '#2dd5b7', secondary: '#d2689c', accent: '#549e6a', error: '#ff5345', warning: '#e5c736', success: '#549e6a', info: '#2dd5b7', text: '#c1c497', textMuted: '#53685b', background: '#111c18', backgroundPanel: '#1a2520', backgroundElement: '#23372b', border: '#3d4a44', borderActive: '#2dd5b7', borderSubtle: '#23372b', diffAdded: '#549e6a', diffRemoved: '#ff5345', diffAddedBg: '#15241c', diffRemovedBg: '#241515', diffHighlightAdded: '#63b07a', diffHighlightRemoved: '#db9f9c' },
  'palenight': { primary: '#82aaff', secondary: '#c792ea', accent: '#89ddff', error: '#f07178', warning: '#ffcb6b', success: '#c3e88d', info: '#f78c6c', text: '#a6accd', textMuted: '#676e95', background: '#292d3e', backgroundPanel: '#1e2132', backgroundElement: '#32364a', border: '#32364a', borderActive: '#82aaff', borderSubtle: '#1e2132', diffAdded: '#c3e88d', diffRemoved: '#f07178', diffAddedBg: '#2e3c2b', diffRemovedBg: '#3c2b2b', diffHighlightAdded: '#c3e88d', diffHighlightRemoved: '#f07178' },
  'rosepine': { primary: '#9ccfd8', secondary: '#c4a7e7', accent: '#ebbcba', error: '#eb6f92', warning: '#f6c177', success: '#31748f', info: '#9ccfd8', text: '#e0def4', textMuted: '#6e6a86', background: '#191724', backgroundPanel: '#1f1d2e', backgroundElement: '#26233a', border: '#403d52', borderActive: '#9ccfd8', borderSubtle: '#21202e', diffAdded: '#31748f', diffRemoved: '#eb6f92', diffAddedBg: '#1f2d3a', diffRemovedBg: '#3a1f2d', diffHighlightAdded: '#31748f', diffHighlightRemoved: '#eb6f92' },
  'solarized': { primary: '#268bd2', secondary: '#6c71c4', accent: '#2aa198', error: '#dc322f', warning: '#b58900', success: '#859900', info: '#cb4b16', text: '#839496', textMuted: '#586e75', background: '#002b36', backgroundPanel: '#073642', backgroundElement: '#073642', border: '#073642', borderActive: '#586e75', borderSubtle: '#073642', diffAdded: '#859900', diffRemoved: '#dc322f', diffAddedBg: '#073642', diffRemovedBg: '#073642', diffHighlightAdded: '#859900', diffHighlightRemoved: '#dc322f' },
  'synthwave84': { primary: '#36f9f6', secondary: '#ff7edb', accent: '#b084eb', error: '#fe4450', warning: '#fede5d', success: '#72f1b8', info: '#ff8b39', text: '#ffffff', textMuted: '#848bbd', background: '#262335', backgroundPanel: '#1e1a29', backgroundElement: '#2a2139', border: '#495495', borderActive: '#36f9f6', borderSubtle: '#241b2f', diffAdded: '#72f1b8', diffRemoved: '#fe4450', diffAddedBg: '#1a3a2a', diffRemovedBg: '#3a1a2a', diffHighlightAdded: '#97f1d8', diffHighlightRemoved: '#ff5e5b' },
  'tokyonight': { primary: '#82aaff', secondary: '#c099ff', accent: '#ff966c', error: '#ff757f', warning: '#ff966c', success: '#c3e88d', info: '#82aaff', text: '#c8d3f5', textMuted: '#828bb8', background: '#1a1b26', backgroundPanel: '#1e2030', backgroundElement: '#222436', border: '#737aa2', borderActive: '#9099b2', borderSubtle: '#545c7e', diffAdded: '#4fd6be', diffRemoved: '#c53b53', diffAddedBg: '#20303b', diffRemovedBg: '#37222c', diffHighlightAdded: '#b8db87', diffHighlightRemoved: '#e26a75' },
  'vercel': { primary: '#0070f3', secondary: '#52a8ff', accent: '#8e4ec6', error: '#e5484d', warning: '#ffb224', success: '#46a758', info: '#52a8ff', text: '#ededed', textMuted: '#878787', background: '#000000', backgroundPanel: '#1a1a1a', backgroundElement: '#292929', border: '#1f1f1f', borderActive: '#454545', borderSubtle: '#1a1a1a', diffAdded: '#63c46d', diffRemoved: '#ff6166', diffAddedBg: '#0b1d0f', diffRemovedBg: '#2a1314', diffHighlightAdded: '#63c46d', diffHighlightRemoved: '#ff6166' },
  'vesper': { primary: '#ffc799', secondary: '#99ffe4', accent: '#ffc799', error: '#ff8080', warning: '#ffc799', success: '#99ffe4', info: '#ffc799', text: '#fff', textMuted: '#a0a0a0', background: '#101010', backgroundPanel: '#101010', backgroundElement: '#101010', border: '#282828', borderActive: '#ffc799', borderSubtle: '#1c1c1c', diffAdded: '#99ffe4', diffRemoved: '#ff8080', diffAddedBg: '#0d2818', diffRemovedBg: '#281a1a', diffHighlightAdded: '#99ffe4', diffHighlightRemoved: '#ff8080' },
  'zenburn': { primary: '#8cd0d3', secondary: '#dc8cc3', accent: '#93e0e3', error: '#cc9393', warning: '#f0dfaf', success: '#7f9f7f', info: '#dfaf8f', text: '#dcdccc', textMuted: '#9f9f9f', background: '#3f3f3f', backgroundPanel: '#4f4f4f', backgroundElement: '#5f5f5f', border: '#5f5f5f', borderActive: '#8cd0d3', borderSubtle: '#4f4f4f', diffAdded: '#7f9f7f', diffRemoved: '#cc9393', diffAddedBg: '#4f5f4f', diffRemovedBg: '#5f4f4f', diffHighlightAdded: '#8fb28f', diffHighlightRemoved: '#dca3a3' },
}
