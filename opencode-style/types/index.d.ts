// The values opencode-style keeps in $.state, the session's.

export type OcTodo = { id?: string; content: string; status: 'pending' | 'in_progress' | 'completed' }

export type OcFile = { added: number; removed: number }

export type OcUsage = { tokens?: number; window: number; percent?: number; usd?: number }

// What the footer under a reply names: the agent and model the turn ran with, its speed.
export type OcTurn = { agent: string; model: string; tps?: number; isAborted: boolean }

// What the spinner says the turn is doing: the running tool and what it is working on.
export type OcActivity = { tool: string; detail: string }

// One mark on the timeline: a call by its kind, or `wait` for a long stretch with none.
export type OcTick = { kind: string; isErrored?: boolean; isSlow?: boolean }

// One turn on the timeline: when it started, what was asked, its calls, how long it took.
export type OcLane = { at: number; prompt: string; ticks: OcTick[]; ms?: number; isAborted?: boolean }

declare module 'claude-code' {
  interface PluginState {
    'opencode-style': {
      theme: string
      frame: number
      isWorking: boolean
      workStartedAt: number
      todos: OcTodo[]
      files: Record<string, OcFile>
      usage: OcUsage | null
      title: string
      mode: string
      model: string
      branch: string
      turns: Record<string, OcTurn>
      details: boolean
      mcp: string[]
      hasMessages: boolean
      expanded: StateFamily<boolean>
      spinner: string
      activity: OcActivity | null
      timeline: OcLane[]
    }
  }
}
