import { create } from 'zustand'
import { api } from '../api'
import { captureArtifacts, releaseArtifacts, type ArtifactSet } from './artifacts'
import { RunController, type RunState } from './runController'
import { ParameterRegistry } from './registry'
import { ProjectCommands, compileRecipe, copy, decodeBytes, editParameter, encodeBytes, object, openDocument, operations, projectName, quickRecipe, signature, standardRecipe, type ProjectDocument } from './project'

export const AUTOSAVE = 'stencil-studio.project.v1'
interface State {
  doc: ProjectDocument | null; registry: ParameterRegistry | null; run: RunState<ArtifactSet>
  loading: boolean; error: string | null; notice: string | null; canUndo: boolean; canRedo: boolean
}
const commands = new ProjectCommands()
export const controller = new RunController<ArtifactSet>({ cancel: () => api.cancel(), run: (g, step) => api.run(g, undefined, step) }, run => useEditor.setState({ run }), releaseArtifacts)
export const useEditor = create<State>(() => ({ doc: null, registry: null, run: controller.state, loading: true, error: null, notice: null, canUndo: false, canRedo: false }))
let fileEpoch = 0
let initialization: Promise<void> | null = null
function sync() {
  const doc = commands.current
  useEditor.setState({ doc, canUndo: !!commands.past.length, canRedo: !!commands.future.length })
  try { if (doc) localStorage.setItem(AUTOSAVE, JSON.stringify(doc.raw)); else localStorage.removeItem(AUTOSAVE) }
  catch { useEditor.setState({ notice: 'Automatic saving is unavailable. Use Save Project to keep your work.' }) }
}
function invalidate(reset = false) { controller.invalidate(commands.current ? signature(commands.current) : '', reset); sync() }
function error(e: unknown) { useEditor.setState({ error: String(e instanceof Error ? e.message : e) }) }

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
  newProject() { fileEpoch++; commands.reset(null); useEditor.setState({ error: null, notice: null, loading: false }); invalidate(true) },
  async open(value: unknown) {
    fileEpoch++
    const doc = openDocument(value)
    commands.reset(doc); useEditor.setState({ error: null, notice: null, loading: false }); invalidate(true)
    // Always run on open, including the exact same JSON after New. No signature-only deduplication.
    await editor.make()
  },
  async importFile(file: File) {
    const mine = ++fileEpoch
    useEditor.setState({ error: null })
    try { const raw = JSON.parse(await file.text()); if (mine === fileEpoch) await editor.open(raw) } catch (e) { if (mine === fileEpoch) error(e) }
  },
  async image(file: File) {
    const mine = ++fileEpoch
    useEditor.setState({ loading: true, error: null })
    try {
      const bytes = await file.arrayBuffer()
      const got = await api.loadImage(new Uint8Array(bytes), file.name)
      if (mine !== fileEpoch) return
      const old = commands.current
      const sources = old ? operations(old).filter(n => n.type === 'source') : []
      if (old && sources.length !== 1) throw new Error('This project has several artwork sources. Their individual replacement editor will be available in a later milestone. Your project is unchanged.')
      const next = old ? editParameter(old, sources[0].id, 'image_id', got.id) : standardRecipe(got.id, file.name, [...useEditor.getState().registry!.types.values()])
      if (!object(next.raw.images)) next.raw.images = {}
      // Retain earlier originals for undo and unreferenced image data for legacy round trips.
      next.raw.images[got.id] = { name: file.name, base64: encodeBytes(bytes) }
      if (old) commands.apply('Replace image', () => next); else commands.reset(next)
      invalidate(true)
    } catch (e) { if (mine === fileEpoch) error(e) }
    finally { if (mine === fileEpoch) useEditor.setState({ loading: false }) }
  },
  edit(id: string, key: string, value: unknown) {
    try {
      const state = useEditor.getState(), op = state.doc && operations(state.doc).find(n => n.id === id)
      if (!op) return
      state.registry!.validate(op.type, key, value)
      if (commands.apply(`Adjust ${key}`, doc => editParameter(doc, id, key, value))) invalidate()
      useEditor.setState({ error: null })
    } catch (e) { error(e) }
  },
  rename(name: string) {
    commands.apply('Rename project', doc => {
      const next = copy(doc)
      // Use an application-owned namespace without changing an imported namespace of another shape.
      if (next.raw.stencilStudio && !object(next.raw.stencilStudio)) throw new Error('The imported project name metadata uses an unsupported format.')
      next.raw.stencilStudio = { ...next.raw.stencilStudio, name }; return next
    }); sync()
  },
  undo() { if (commands.undo()) invalidate() },
  redo() { if (commands.redo()) invalidate() },
  history: () => commands.past.map(c => c.label),
  cancel() { controller.cancel() },
  async make() {
    const doc = commands.current
    if (!doc) return
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
      return compileRecipe(doc, map)
    }, runs => captureArtifacts(doc, runs))
  },
  downloadProject() {
    const doc = commands.current; if (!doc) return
    download(new Blob([JSON.stringify(doc.raw, null, 2)], { type: 'application/json' }), `${safeName(projectName(doc))}.stencil.json`)
  },
  currentRecipe: () => commands.current && quickRecipe(commands.current),
}
export const safeName = (value: string) => value.replace(/[^a-z0-9 ._-]/gi, '_').slice(0, 100) || 'stencil'
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000) }
