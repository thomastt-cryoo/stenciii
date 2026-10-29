import type { Quality } from './runController'

/** Drafts are throttled; full runs are debounced and wait for gesture end. */
export class LivePreview {
  enabled = false
  private draft: ReturnType<typeof setTimeout> | undefined
  private full: ReturnType<typeof setTimeout> | undefined
  private touching = false
  private pending = false
  constructor(private run: (quality: Quality) => void, readonly settleMs = 650, readonly draftMs = 180, private clock = { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle) }) {}
  begin() { this.touching = true; if (this.full) this.clock.clear(this.full) }
  end() { this.touching = false; if (this.enabled && this.pending) this.final() }
  change() {
    if (!this.enabled) return
    this.pending = true
    if (!this.draft) this.draft = this.clock.set(() => { this.draft = undefined; this.run('draft') }, this.draftMs)
    if (this.full) this.clock.clear(this.full)
    if (!this.touching) this.final()
  }
  private final() {
    if (this.full) this.clock.clear(this.full)
    this.full = this.clock.set(() => { this.full = undefined; this.pending = false; if (this.draft) this.clock.clear(this.draft); this.draft = undefined; this.run('full') }, this.settleMs)
  }
  stop(disable = false) {
    if (this.draft) this.clock.clear(this.draft)
    if (this.full) this.clock.clear(this.full)
    this.draft = this.full = undefined; this.touching = false; this.pending = false
    if (disable) this.enabled = false
  }
}
