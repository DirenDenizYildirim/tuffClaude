import { describe, expect, mock, test } from 'claude-code/testing'

import { costOf, shortModel } from '../hooks/agents'
import { lanesOf } from '../hooks/history'

const PLUGIN = 'opencode-style'
const SURFACES = ['terminal', 'desktop'] as const
const scroll = { offset: 0, bodyRows: 30 }

const spinning = (mode: 'thinking' | 'tool-use' | 'responding' | 'requesting' | 'tool-input') => ({ word: 'Sauteing', message: null, suffix: '…', mode })

const toolUse = (tool: string, input: unknown, output?: unknown, isRunning = false) => ({
  tool_use_id: `t-${tool}`,
  tool,
  input,
  isRunning,
  isErrored: false,
  isInterrupted: false,
  ...(output === undefined ? {} : { output }),
})

describe('transcript rows', () => {
  test('a Read is one inline row with its arrow', async $ => {
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'ToolUse', requestId: 'r1', props: toolUse('Read', { file_path: 'src/app.ts', offset: 10, limit: 5 }, { type: 'text', file: { filePath: 'src/app.ts', content: '', numLines: 5, startLine: 10, totalLines: 99 } }) })
      expect(await ui.find({ text: /→ $/ })).toBeDefined()
      expect(await ui.find({ text: /Read src\/app\.ts:10-14/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('a shell call is a block: the command, then its output', async $ => {
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'ToolUse', requestId: 'r2', props: toolUse('Bash', { command: 'ls -la', description: 'List files' }, { stdout: 'a.txt\nb.txt', stderr: '', interrupted: false }) })
      expect(await ui.find({ text: '$ ls -la' })).toBeDefined()
      expect(await ui.find({ text: /a\.txt\nb\.txt/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('long shell output keeps its tail and says how much came before', async $ => {
    const stdout = Array.from({ length: 25 }, (_, i) => `line ${i + 1}`).join('\n')
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'ToolUse', requestId: 'r3', props: toolUse('Bash', { command: 'seq 25' }, { stdout, stderr: '', interrupted: false }) })
    expect(await ui.find({ text: '(15 earlier lines)' })).toBeDefined()
    expect(await ui.find({ text: /line 25$/ })).toBeDefined()
    await ui.press({ key: 'earlier' })
    expect(await ui.find({ text: '(collapse)' })).toBeDefined()
    await ui.unmount()
  })

  test('the reply footer names the agent, the model and the time', async $ => {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'TurnDuration', requestId: 'd1', props: { word: 'Baked', durationMs: 3200 } })
    expect(await ui.find({ text: 'Build' })).toBeDefined()
    expect(await ui.find({ text: / · 3\.2s/ })).toBeDefined()
    await ui.unmount()
  })

  test('your prompt is drawn in its panel', async $ => {
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'UserMessage', requestId: 'u1', props: { text: 'fix the tests', origin: { kind: 'composer' }, isExpanded: false } })
      expect(await ui.find({ text: 'fix the tests' })).toBeDefined()
      await ui.unmount()
    }
  })
})

describe('around the prompt', () => {
  test('the footer names the agent, and Plan in plan mode', async $ => {
    const idle = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'PromptHint', requestId: 'h', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } })
    expect(await idle.find({ text: 'Build' })).toBeDefined()
    expect(await idle.find({ text: 'shift+tab' })).toBeDefined()
    await idle.unmount()

    const plan = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'PromptHint', requestId: 'h', props: { isDraft: false, isWorking: false, hint: '⏸ plan mode on (shift+tab to cycle)' } })
    expect(await plan.find({ text: 'Plan' })).toBeDefined()
    await plan.unmount()
  })

  test('while working the footer shows the scanner and how to interrupt', async $ => {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'PromptHint', requestId: 'h', props: { isDraft: false, isWorking: true, hint: 'esc to interrupt' } })
    expect(await ui.find({ text: /[■⬝]/ })).toBeDefined()
    expect(await ui.find({ text: ' interrupt' })).toBeDefined()
    await ui.unmount()
  })

  test('the auto spinner shimmers while thinking', async $ => {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Spinner', requestId: 'main', props: spinning('thinking') })
    expect(await ui.find({ text: /[⋆✧✦]/ })).toBeDefined()
    expect(await ui.find({ text: 'T' })).toBeDefined()
    await ui.unmount()
  })

  test('the footer corner shows a small gauge of the context', async ($, on) => {
    mock.store(on)
    mock.clock(on)
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 90_000, percent: 45 }, rateLimits: [], cost: { usd: 1.2 } } }) as never)
    on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)
    await $.tool.call({ tool: 'Bash', tool_use_id: 'b2', command: 'ls' } as never)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'PromptHint', requestId: 'h', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } })
    expect(await ui.find({ text: '╸' })).toBeDefined()
    expect(await ui.find({ text: ' 45%' })).toBeDefined()
    expect(await ui.find({ text: ' · $1.20' })).toBeDefined()
    await ui.unmount()
  })

  test('a new session shows the logo above the prompt', async ($, on) => {
    // Claude Code's own band, beneath the plugin: empty here.
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e)

      return <Box />
    })
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll, view: {} } })
    expect(await ui.find({ text: /█▀▀█/ })).toBeDefined()
    expect(await ui.find({ text: '● Tip ' })).toBeDefined()
    await ui.unmount()
  })
})

describe('panes', () => {
  test('the sidebar has a title and the version line', async $ => {
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'oc-sidebar', props: { title: 'Session', isFocused: false, bodyColumns: 40, placement: 'dock', scroll, view: {} } })
      expect(await ui.find({ text: 'New session' })).toBeDefined()
      expect(await ui.find({ text: 'Code' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('the theme studio lists every theme with a preview', async $ => {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'oc-themes', props: { title: 'Themes', isFocused: true, bodyColumns: 90, placement: 'inline', scroll, view: {} } })
    expect(await ui.find({ text: 'Themes' })).toBeDefined()
    expect(await ui.find({ key: 'theme-tokyonight' })).toBeDefined()
    expect(await ui.find({ text: 'make the header sticky' })).toBeDefined()
    await ui.unmount()
  })

  test('the spinner gallery picks a style', async ($, on) => {
    mock.store(on)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'oc-spinners', props: { title: 'Spinners', isFocused: true, bodyColumns: 80, placement: 'inline', scroll, view: {} } })
    expect(await ui.find({ key: 'spinner-wave' })).toBeDefined()
    await ui.press({ key: 'spinner-bounce' })
    await ui.unmount()

    const row = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Spinner', requestId: 'main', props: spinning('tool-use') })
    expect(await row.find({ text: '●' })).toBeDefined()
    expect(await row.find({ text: /Running tools/ })).toBeDefined()
    await row.unmount()
  })

  test('the timeline shows each turn and its calls', async ($, on) => {
    mock.store(on)
    on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)
    on('prompt.submit', ($, e) => ({ text: e.text }))
    mock.clock(on)
    await $.prompt.submit({ text: 'fix the tests', wait: false, origin: { kind: 'composer' } } as never)
    await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'npm test' } as never)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'oc-minimap', props: { title: 'Timeline', isFocused: false, bodyColumns: 40, placement: 'dock', scroll, view: {} } })
    expect(await ui.find({ text: 'fix the tests' })).toBeDefined()
    expect(await ui.find({ text: '■' })).toBeDefined()
    expect(await ui.find({ text: /1 turn · 1 call/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('themes', () => {
  test('picking a theme in the picker switches every row to it', async ($, on) => {
    mock.store(on)
    mock.env(on, { HOME: '/home/someone' })
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'oc-themes', props: { title: 'Themes', isFocused: true, bodyColumns: 90, placement: 'inline', scroll, view: {} } })
    await ui.press({ key: 'theme-tokyonight' })
    await ui.unmount()

    const row = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', requestId: 'u2', props: { text: 'hi', origin: { kind: 'composer' }, isExpanded: false } })
    const drawn = (await row.drawn()) as { children?: { props?: { backgroundColor?: string } }[] }
    expect(drawn.children?.[0]?.props?.backgroundColor).toBe('#1e2030')
    await row.unmount()
  })

  test('moving through the studio previews a theme at once', async ($, on) => {
    mock.store(on)
    mock.env(on, { HOME: '/home/someone' })
    const studio = { plugin: PLUGIN, surface: 'terminal' as const, component: 'Pane' as const, requestId: 'oc-themes', props: { title: 'Themes', isFocused: true, bodyColumns: 90, placement: 'inline' as const, scroll, view: {} } }
    mock.clock(on)
    on('ui.focus', () => ({}) as never)
    const ui = await $.ui.mount(studio)
    await $.ui.focus({ component: 'Pane', requestId: 'oc-themes', element: 'theme-dracula', origin: { kind: 'person' } })
    const panel = async () => {
      const row = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', requestId: 'u3', props: { text: 'hi', origin: { kind: 'composer' }, isExpanded: false } })
      const drawn = (await row.drawn()) as { children?: { props?: { backgroundColor?: string } }[] }
      await row.unmount()

      return drawn.children?.[0]?.props?.backgroundColor
    }
    expect(await panel()).toBe('#21222c')
    await ui.unmount()
  })
})

describe('timeline history', () => {
  test('a transcript read back gives the same lanes the live hooks build', () => {
    const limits = { slowMs: 15_000, waitMs: 20_000, maxLanes: 60, maxTicks: 300 }
    const lanes = lanesOf(
      [
        { k: 'p', t: '2026-10-17T10:00:00Z', text: 'fix the tests' },
        { k: 'u', t: '2026-10-17T10:00:02Z', id: 'a', name: 'Read' },
        { k: 'r', t: '2026-10-17T10:00:03Z', id: 'a', err: false },
        { k: 'u', t: '2026-10-17T10:00:40Z', id: 'b', name: 'Bash' },
        { k: 'r', t: '2026-10-17T10:01:00Z', id: 'b', err: true },
        { k: 'd', t: '2026-10-17T10:01:05Z', ms: 65_000 },
        { k: 'p', t: '2026-10-17T10:02:00Z', text: 'and the docs' },
      ],
      limits,
    )
    expect(lanes.length).toBe(2)
    expect(lanes[0]?.ms).toBe(65_000)
    expect(lanes[0]?.ticks).toEqual([{ kind: 'read' }, { kind: 'wait' }, { kind: 'shell', isErrored: true, isSlow: true }])
    expect(lanes[1]?.prompt).toBe('and the docs')
    expect(lanes[1]?.ms).toBeUndefined()
  })
})

describe('agents', () => {
  const pane = { plugin: PLUGIN, surface: 'terminal' as const, component: 'Pane' as const, requestId: 'oc-sidebar', props: { title: 'Session', isFocused: false, bodyColumns: 40, placement: 'dock' as const, scroll, view: {} } }

  test('a launched agent gets a card in the Agents tab and a line in the sidebar, then finishes', async ($, on) => {
    mock.store(on)
    mock.clock(on)
    let release = () => {}
    const gate = new Promise<void>(resolve => (release = resolve))
    on('tool.call', async () => {
      await gate

      return { result: { status: 'completed', agentId: 'a1', totalTokens: 120_000, totalDurationMs: 4000, totalToolUseCount: 1, content: [], prompt: 'look for the theme files', usage: {} } } as never
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
    on('turn.complete', () => ({ text: '' }) as never)
    on('turn.step', async function* (_$, e) {
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-sonnet-5-5', input_tokens: 100_000, output_tokens: 500, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 1_000 } } as never
    })

    const call = $.tool.call({ tool: 'Agent', tool_use_id: 'ag1', description: 'find theme files', prompt: 'look for the theme files', subagent_type: 'Explore' } as never)
    await $.turn.start({ text: 'look for the theme files', turnId: 't1', agentId: 'a1', input: null } as never)
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'a1' } as never)
    for await (const _chunk of stream) {
      // drained
    }
    await stream.result

    const tab = { ...pane, requestId: 'oc-agents', props: { ...pane.props, title: 'Agents' } }
    const live = await $.ui.mount(tab)
    expect(await live.find({ text: 'Agents' })).toBeDefined()
    expect(await live.find({ text: 'Explore' })).toBeDefined()
    expect(await live.find({ text: 'Sonnet 5.5' })).toBeDefined()
    expect(await live.find({ text: 'find theme files' })).toBeDefined()
    expect(await live.find({ text: '111.5K tokens · $0.21' })).toBeDefined()
    expect(await live.find({ text: '1 running · ' })).toBeDefined()
    await live.unmount()

    const side = await $.ui.mount(pane)
    expect(await side.find({ text: '1 running · $0.21 · in their tab' })).toBeDefined()
    await side.unmount()

    release()
    await call
    const done = await $.ui.mount(tab)
    expect(await done.find({ text: '✓ ' })).toBeDefined()
    expect(await done.find({ text: '120.0K tokens · $0.21' })).toBeDefined()
    await done.unmount()
  })

  test('costs follow each model\'s prices, and models get short names', () => {
    expect(costOf('claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })).toBe(4)
    expect(costOf('claude-haiku-5-5', { input_tokens: 0, output_tokens: 1_000_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })).toBe(0.5)
    expect(costOf('some-other-model', { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })).toBeUndefined()
    expect(shortModel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(shortModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(shortModel('sonnet')).toBe('Sonnet')
  })
})
