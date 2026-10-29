import { create } from 'zustand'
import { api } from '../api'
import { captureArtifacts, releaseArtifacts, type ArtifactSet } from './artifacts'
import { RunController, type RunState } from './runController'
import { ParameterRegistry } from './registry'
import { ProjectCommands, adjustmentRecipe, compileRecipe, copy, decodeBytes, editParameter, encodeBytes, object, openDocument, operations, projectName, quickRecipe, signature, type ProjectDocument } from './project'
import { styleRecipe, switchStyle, setDetail, draftRecipe, pixelCleanup, type Style } from './recipes'
import { LivePreview } from './livePreview'
import type { Quality } from './runController'
import { liveArtwork, textRecipe, editMany } from './artwork'

export const AUTOSAVE = 'stencil-studio.project.v1'
interface State {
  doc: ProjectDocument | null; registry: ParameterRegistry | null; run: RunState<ArtifactSet>
  loading: boolean; error: string | null; notice: string | null; canUndo: boolean; canRedo: boolean
  preview: { step: string; port: string } | null; cropStep: string | null; interacting: boolean
}
const commands = new ProjectCommands()
export const controller = new RunController<ArtifactSet>({ cancel: () => api.cancel(), run: (g, step) => api.run(g, undefined, step) }, run => useEditor.setState({ run }), releaseArtifacts)
export const useEditor = create<State>(() => ({ doc: null, registry: null, run: controller.state, loading: true, error: null, notice: null, canUndo: false, canRedo: false, preview: null, cropStep: null, interacting: false }))
let fileEpoch = 0
let initialization: Promise<void> | null = null
let gesture = false
let gestureChanged = false
const live = new LivePreview(quality => { void editor.make(quality, true) })
function sync() {
  const doc = commands.current
  useEditor.setState({ doc, canUndo: !!commands.past.length, canRedo: !!commands.future.length })
  try { if (doc) localStorage.setItem(AUTOSAVE, JSON.stringify(doc.raw)); else localStorage.removeItem(AUTOSAVE) }
  catch { useEditor.setState({ notice: 'Automatic saving is unavailable. Use Save Project to keep your work.' }) }
}
function invalidate(reset = false) { controller.invalidate(commands.current ? signature(commands.current) : '', reset); sync() }
function error(e: unknown) { useEditor.setState({ error: String(e instanceof Error ? e.message : e) }) }
function changed() { invalidate(); if (commands.current && liveArtwork(commands.current)) live.change() }

export const editor = {
  initialize() {
    if (!initialization) initialization = (async () => {
      try {
        const catalogue = await api.nodeTypes()
        useEditor.setState({ registry: new ParameterRegistry(catalogue), loading: false })
        const saved = localStorage.getItem(AUTOSAVE)
        if (saved && !commands.current) await editor.open(JSON.parse(saved))
      } catch (e) { useEditor.setState({ loading: false }); error(e) }
    })()
    return initialization
  },
  newProject() { fileEpoch++; live.stop(true); gesture = false; commands.reset(null); useEditor.setState({ error: null, notice: null, loading: false, preview: null, cropStep: null, interacting: false }); invalidate(true) },
  async open(value: unknown) {
    fileEpoch++
    const doc = openDocument(value)
    live.stop(true)
    gesture = false; commands.reset(doc); useEditor.setState({ error: null, notice: null, loading: false, preview: null, cropStep: null, interacting: false }); invalidate(true)
    // Always run on open, including the exact same JSON after New. No signature-only deduplication.
    await editor.make()
  },
  async importFile(file: File) {
    const mine = ++fileEpoch
    useEditor.setState({ error: null })
    try { const raw = JSON.parse(await file.text()); if (mine === fileEpoch) await editor.open(raw) } catch (e) { if (mine === fileEpoch) error(e) }
  },
  async image(file: File, sourceId?: string) {
    const mine = ++fileEpoch
    useEditor.setState({ loading: true, error: null })
    try {
      if (!/\.(png|jpe?g|bmp|svg)$/i.test(file.name)) throw new Error('Choose a PNG, JPG, BMP or SVG image. To open a saved project, use Open Project.')
      if (!file.size) throw new Error('This image is empty. Choose another image.')
      if (file.size > 64 * 1024 * 1024) throw new Error('This image is larger than 64 MB. Save a smaller copy and try again.')
      const bytes = await file.arrayBuffer()
      const got = await api.loadImage(new Uint8Array(bytes), file.name).catch(() => { throw new Error('This image could not be read. Try opening it in an image editor and saving a new PNG, JPG, BMP or SVG copy.') })
      if (mine !== fileEpoch) return
      const old = commands.current
      const sources = old ? operations(old).filter(n => n.type === 'source') : []
      const source = sourceId ? sources.find(s => s.id === sourceId) : sources.length === 1 ? sources[0] : null
      if (old && !source) throw new Error('Choose the individual image in Artwork settings to replace it. Your project is unchanged.')
      const next = old ? editParameter(old, source!.id, 'image_id', got.id) : styleRecipe(got.id, file.name, [...useEditor.getState().registry!.types.values()])
      if (!object(next.raw.images)) next.raw.images = {}
      // Retain earlier originals for undo and unreferenced image data for legacy round trips.
      next.raw.images[got.id] = { name: file.name, base64: encodeBytes(bytes) }
      if (old) commands.apply('Replace image', () => next); else commands.reset(next)
      live.stop(); invalidate(true)
      if (old && live.enabled && liveArtwork(next)) live.change()
    } catch (e) { if (mine === fileEpoch) error(e) }
    finally { if (mine === fileEpoch) useEditor.setState({ loading: false }) }
  },
  createText() {
    fileEpoch++; live.stop(true)
    const doc = textRecipe([...useEditor.getState().registry!.types.values()])
    if (commands.current) doc.raw.stencilStudio.previousProject = copy(commands.current.raw)
    if (commands.current) commands.apply('Create a separate text stencil', () => doc); else commands.reset(doc)
    gesture = false; useEditor.setState({ error: null, notice: null, preview: null, cropStep: null, interacting: false }); invalidate(true)
  },
  command(label: string, update: (doc: ProjectDocument) => ProjectDocument) {
    const before = commands.current && signature(commands.current)
    try { if (commands.apply(label, update, gesture && gestureChanged)) { gestureChanged = true; if (commands.current && signature(commands.current) !== before) changed(); else sync() }; useEditor.setState({ error: null }) }
    catch (e) { error(e) }
  },
  parameters(id: string, values: Record<string, unknown>, label = 'Adjust artwork') {
    const state = useEditor.getState(), op = state.doc && operations(state.doc).find(o => o.id === id)
    if (!op) return
    try {
      for (const [key, value] of Object.entries(values)) state.registry!.validate(op.type, key, value)
      const p = { ...op.params, ...values }
      if (op.type === 'transform' && (Number(p.crop_left ?? 0) + Number(p.crop_right ?? 0) >= 95 || Number(p.crop_top ?? 0) + Number(p.crop_bottom ?? 0) >= 95)) throw Error('Keep at least 5% of the image when cropping.')
      editor.command(`${label} ${id}`, doc => editMany(doc, id, values))
    } catch (e) { error(e) }
  },
  resetParameter(id: string, key: string) {
    const state = useEditor.getState(), op = state.doc && operations(state.doc).find(o => o.id === id)
    const def = op && state.registry?.types.get(op.type)?.params.find(p => p.name === key)
    if (def) editor.edit(id, key, def.default)
  },
  edit(id: string, key: string, value: unknown) {
    try {
      const state = useEditor.getState(), op = state.doc && operations(state.doc).find(n => n.id === id)
      if (!op) return
      state.registry!.validate(op.type, key, value)
      if (op.type === 'transform' && key.startsWith('crop_')) {
        const other = key === 'crop_left' ? 'crop_right' : key === 'crop_right' ? 'crop_left' : key === 'crop_top' ? 'crop_bottom' : 'crop_top'
        if (Number(value) + Number(op.params[other] ?? 0) >= 95) throw new Error('Keep at least 5% of the image when cropping.')
      }
      if (commands.apply(`Adjust ${id}.${key}`, doc => editParameter(doc, id, key, value), gesture && gestureChanged)) { gestureChanged = true; changed() }
      useEditor.setState({ error: null })
    } catch (e) { error(e) }
  },
  begin(interactive = true) { gesture = true; gestureChanged = false; if (interactive) { live.begin(); useEditor.setState({ interacting: true }) } },
  end() { gesture = false; live.end(); useEditor.setState({ interacting: false }) },
  preview(step: string, port: string) { useEditor.setState({ preview: { step, port } }) },
  crop(step: string | null) { useEditor.setState({ cropStep: step }) },
  style(style: Style) {
    try { if (commands.apply(`Choose ${style} style`, doc => switchStyle(doc, style, [...useEditor.getState().registry!.types.values()]))) changed(); useEditor.setState({ error: null }) }
    catch (e) { error(e) }
  },
  detail(level: number) { if (commands.apply('Adjust detail', doc => setDetail(doc, level), gesture && gestureChanged)) { gestureChanged = true; changed() } },
  pixelCleanup(enabled: boolean) {
    try { if (commands.apply(enabled ? 'Enable pixel cleanup' : 'Bypass pixel cleanup', doc => pixelCleanup(doc, enabled, [...useEditor.getState().registry!.types.values()]))) changed(); useEditor.setState({ error: null }) }
    catch (e) { error(e) }
  },
  autoThreshold(automatic: boolean) {
    const q = commands.current && adjustmentRecipe(commands.current); if (!q) return
    const old = Number(q.threshold.params.threshold ?? 256)
    commands.apply('Adjust paint selection', doc => {
      const next = editParameter(doc, q.threshold.id, 'threshold', automatic ? 256 : Number(doc.raw.stencilStudio?.manualThreshold ?? 128))
      if (automatic && old !== 256) next.raw.stencilStudio = { ...next.raw.stencilStudio, manualThreshold: old }
      return next
    }); changed()
  },
  rename(name: string) {
    commands.apply('Rename project', doc => {
      const next = copy(doc)
      // Use an application-owned namespace without changing an imported namespace of another shape.
      if (next.raw.stencilStudio && !object(next.raw.stencilStudio)) throw new Error('The imported project name metadata uses an unsupported format.')
      next.raw.stencilStudio = { ...next.raw.stencilStudio, name }; return next
    }); sync()
  },
  undo() { if (commands.undo()) changed() },
  redo() { if (commands.redo()) changed() },
  history: () => commands.past.map(c => c.label),
  cancel() { live.stop(); controller.cancel() },
  async make(quality: Quality = 'full', automatic = false) {
    const doc = commands.current
    if (!doc) return
    if (!automatic) live.stop()
    useEditor.setState({ error: null })
    await controller.execute(signature(doc), async () => {
      const map = new Map<string, string>()
      for (const source of operations(doc).filter(n => n.type === 'source')) {
        const id = String(source.params.image_id ?? '')
        if (map.has(id)) continue
        const asset = doc.raw.images?.[id]
        const stored = !asset ? await api.storedImage(id) : null
        if (!asset && !stored) throw new Error('The original image is missing from this project. Choose a replacement image and try again.')
        const bytes = asset ? decodeBytes(asset.base64) : new Uint8Array(stored!.bytes)
        const loaded = await api.loadImage(bytes, asset?.name ?? stored!.name)
        map.set(id, loaded.id)
      }
      const graph = compileRecipe(doc, map)
      return quality === 'draft' ? draftRecipe(graph) : graph
    }, runs => captureArtifacts(doc, runs), quality)
    if (controller.exportable && commands.current && signature(commands.current) === signature(doc)) live.enabled = true
  },
  downloadProject() {
    const doc = commands.current; if (!doc) return
    download(new Blob([JSON.stringify(doc.raw, null, 2)], { type: 'application/json' }), `${safeName(projectName(doc))}.stencil.json`)
  },
  currentRecipe: () => commands.current && quickRecipe(commands.current),
}
export const safeName = (value: string) => value.replace(/[^a-z0-9 ._-]/gi, '_').slice(0, 100) || 'stencil'
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000) }
