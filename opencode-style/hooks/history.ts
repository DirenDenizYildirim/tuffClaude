// The timeline's past: what the session did before the mod loaded (a reload, a resume),
// read back from its transcript. The transcript outgrows `$.fs.read`'s 4 MiB, so a small
// Python filter boils it down to one line per prompt, call, result and turn end.

import type { EngineInterface } from 'claude-code'

import type { OcLane } from '../types'
import { tickKind } from './candy'
import { oneLine } from './format'

const FILTER = `
import json, sys
def out(**k): print(json.dumps(k))
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    if line.startswith('{"type":"api-request') or line.startswith('{"type":"attachment'): continue
    try: o = json.loads(line)
    except Exception: continue
    if o.get('isSidechain'): continue
    t, ts = o.get('type'), o.get('timestamp', '')
    if t == 'system' and o.get('subtype') == 'turn_duration':
        out(k='d', t=ts, ms=o.get('durationMs', 0)); continue
    c = (o.get('message') or {}).get('content')
    if t == 'user':
        blocks = c if isinstance(c, list) else [{'type': 'text', 'text': c}] if isinstance(c, str) else []
        results = [b for b in blocks if isinstance(b, dict) and b.get('type') == 'tool_result']
        for b in results: out(k='r', t=ts, id=b.get('tool_use_id'), err=bool(b.get('is_error')))
        texts = [b.get('text') or '' for b in blocks if isinstance(b, dict) and b.get('type') == 'text']
        if texts and not results and not o.get('isMeta') and not texts[0].lstrip().startswith('<'):
            out(k='p', t=ts, text=texts[0][:300])
    elif t == 'assistant' and isinstance(c, list):
        for b in c:
            if isinstance(b, dict) and b.get('type') == 'tool_use': out(k='u', t=ts, id=b.get('id'), name=b.get('name'))
`

type Beat = { k: 'p'; t: string; text: string } | { k: 'u'; t: string; id: string; name: string } | { k: 'r'; t: string; id: string; err: boolean } | { k: 'd'; t: string; ms: number }

export type HistoryLimits = { slowMs: number; waitMs: number; maxLanes: number; maxTicks: number }

// Lanes from the beats, as the live hooks would have built them.
export function lanesOf(beats: Beat[], limits: HistoryLimits): OcLane[] {
  const lanes: OcLane[] = []
  const started = new Map<string, { name: string; at: number }>()
  let lastBeat = 0

  const open = (): OcLane | undefined => {
    const last = lanes.at(-1)

    return last !== undefined && last.ms === undefined ? last : undefined
  }

  for (const beat of beats) {
    const at = Date.parse(beat.t)

    if (Number.isNaN(at)) continue

    if (beat.k === 'p') {
      // A turn the transcript never closed (interrupted, or cut off) ends where its last call did.
      const was = open()

      if (was !== undefined) was.ms = Math.max(0, lastBeat - was.at)

      lanes.push({ at, prompt: oneLine(beat.text), ticks: [] })
      lastBeat = at
    } else if (beat.k === 'u') {
      const lane = open()

      if (lane !== undefined && lastBeat > 0 && at - lastBeat > limits.waitMs) lane.ticks.push({ kind: 'wait' })

      started.set(beat.id, { name: beat.name, at })
    } else if (beat.k === 'r') {
      const call = started.get(beat.id)
      const lane = open()

      if (call === undefined || lane === undefined) continue

      lane.ticks.push({ kind: tickKind(call.name), ...(beat.err ? { isErrored: true } : {}), ...(at - call.at > limits.slowMs ? { isSlow: true } : {}) })
      lastBeat = at
    } else {
      const lane = open()

      if (lane !== undefined) lane.ms = beat.ms
    }
  }

  return lanes.slice(-limits.maxLanes).map(lane => ({ ...lane, ticks: lane.ticks.slice(-limits.maxTicks) }))
}

// The session's transcript, where Claude Code keeps it: projects/<cwd, dashed>/<id>.jsonl.
export async function readHistory($: EngineInterface, cwd: string, homeDir: string, limits: HistoryLimits): Promise<OcLane[] | null> {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${homeDir}/.claude`
  const path = `${dir}/projects/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${await $.session.id()}.jsonl`

  if (!(await $.fs.exists(path))) return null

  const ran = await $.process.run(['python3', '-I', '-c', FILTER, path], { timeoutMs: 15_000 })

  if (ran.exitCode !== 0) {
    $.ui.log(`timeline: the transcript was not read (${ran.stderr.trim().split('\n').at(-1) ?? ran.exitCode})`, { to: 'debug' })

    return null
  }

  const beats = ran.stdout.split('\n').flatMap(line => {
    try {
      return line === '' ? [] : [JSON.parse(line) as Beat]
    } catch {
      return []
    }
  })

  return lanesOf(beats, limits)
}
