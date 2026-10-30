import type { GraphJson, NodeStep,LogLine } from '../api'

export type Quality = 'draft' | 'full'
export type RunStatus = 'empty' | 'dirty' | 'running' | 'complete' | 'cancelled' | 'error'
export interface Completed<T> { generation: number; signature: string; quality: Quality; value: T }
export interface RunState<T> { status: RunStatus; generation: number; signature: string; quality: Quality; progress: number; activity: string; error: string | null; output: Completed<T> | null;steps?:Record<string,NodeStep['state']>;logs?:LogLine[];elapsedMs?:number;startedAt?:number;failedStep?:string|null }
export interface RunPort { cancel(): void; run(graph: GraphJson, step: (s: NodeStep) => void): Promise<{ status: string; error?: string }> }

/** Each open/new/edit creates an epoch, even for identical JSON. Late work cannot publish across it. */
export class RunController<T> {
  private ticket = 0
  state: RunState<T> = { status: 'empty', generation: 0, signature: '', quality: 'full', progress: 0, activity: '', error: null, output: null }
  constructor(private port: RunPort, private publish: (s: RunState<T>) => void, private dispose: (v: T) => void = () => {}) {}
  private set(patch: Partial<RunState<T>>) { this.state = { ...this.state, ...patch }; this.publish(this.state) }
  invalidate(signature: string, reset = false) {
    this.ticket++; this.port.cancel()
    if (reset && this.state.output) this.dispose(this.state.output.value)
    this.set({ status: signature ? 'dirty' : 'empty', signature, generation: this.ticket, progress: 0, activity: '', error: null,steps:{},logs:[],elapsedMs:0,failedStep:null, ...(reset ? { output: null } : {}) })
  }
  cancel() { this.ticket++; this.port.cancel(); this.set({ status: 'cancelled', generation: this.ticket, activity: '', error: null }) }
  get exportable() { return this.state.status === 'complete' && this.state.output?.quality === 'full' && this.state.output.signature === this.state.signature }
  async execute(signature: string, prepare: () => Promise<GraphJson>, capture: (steps: Record<string, NodeStep['state']>) => Promise<T>, quality: Quality = 'full') {
    const mine = ++this.ticket
    this.port.cancel()
    const steps: Record<string, NodeStep['state']> = Object.create(null)
    const startedAt=Date.now()
    this.set({ signature, generation: mine, quality, status: 'running', progress: 0, activity: 'Preparing artwork', error: null,steps:{},logs:[],elapsedMs:0,startedAt,failedStep:null })
    try {
      const graph = await prepare()
      if (mine !== this.ticket) return
      const r = await this.port.run(graph, s => {
        if (mine !== this.ticket) return
        steps[s.node] = s.state
        const type = graph.nodes.find(n => n.id === s.node)?.type ?? ''
        const activity = ({ source: 'artwork', transform: 'framing', threshold: 'paint selection', smooth: 'curves', remove_islands: 'cleanup', trace: 'outlines', stencil: 'stencil geometry', vector_stencil: 'stencil geometry' } as Record<string, string>)[type] ?? type.replace(/_/g, ' ')
        this.set({ progress: (s.n + (s.state.progress ?? 0)) / Math.max(1, s.total), activity: `Processing ${activity}`,steps:{...steps},logs:[...(this.state.logs??[]),...(s.log??[])].slice(-500),elapsedMs:Date.now()-startedAt,failedStep:this.state.failedStep??(s.state.state==='error'?s.node:null) })
      })
      if (mine !== this.ticket) return
      const failed = Object.values(steps).find(s => s.state === 'error')
      if (r.status !== 'done' || failed) throw new Error(failed?.error ?? r.error ?? 'Processing did not finish. Adjust the settings and try again.')
      this.set({ activity: 'Checking completed geometry', progress: .98 })
      const value = await capture(steps)
      if (mine !== this.ticket) { this.dispose(value); return }
      if (this.state.output) this.dispose(this.state.output.value)
      this.set({ status: 'complete', progress: 1, activity: '',elapsedMs:Date.now()-startedAt, output: { generation: mine, signature, quality, value } })
    } catch (e) {
      if (mine !== this.ticket) return
      const message = String(e instanceof Error ? e.message : e)
      this.set({ status: 'error', activity: '',elapsedMs:Date.now()-startedAt, error: /shapes contain no closed outlines/.test(message) ? 'No visible artwork was found. Try darker artwork, adjust paint selection, or invert the image.' : message })
    }
  }
}
