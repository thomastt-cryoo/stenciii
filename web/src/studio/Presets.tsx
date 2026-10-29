import {isManufacturing,manufacturingNames} from './manufacturing'
import { useState } from 'react'
import { BUILT_IN, mergeBook, parseBook, type Book } from '../presetBook'
import { copy, object, operations, rawGraph, type ProjectDocument } from './project'
import type { ParameterRegistry } from './registry'
import { artworkNames, editMany, isArtwork, liveArtwork, passList, validateRecipe } from './artwork'
import { isGeometry, geometryType } from './geometry'
import { activeStyle } from './recipes'
import { download, editor } from './session'

export function applyOperationPreset(doc: ProjectDocument, id: string, values: Record<string, unknown>, registry: ParameterRegistry) {
  if (!object(values)) throw Error('Choose a preset for this operation. The project is unchanged.')
  const op = operations(doc).find(n => n.id === id); if (!op || !(isArtwork(op.type) || isGeometry(op.type) || isManufacturing(op.type))) throw Error('Choose an artwork operation for this preset.')
  const known = new Set(registry.types.get(geometryType(op.type))!.params.map(p => p.name)), changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) if (known.has(key) && key !== 'image_id') { registry.validate(geometryType(op.type), key, value); changes[key] = value }
  const next = editMany(doc, id, changes), p = operations(next).find(o => o.id === id)!.params
  if (op.type === 'transform' && (Number(p.crop_left ?? 0)+Number(p.crop_right ?? 0)>=95 || Number(p.crop_top ?? 0)+Number(p.crop_bottom ?? 0)>=95)) throw Error('This preset crops away too much artwork. The project is unchanged.')
  return next
}
const KEY = 'stencil-presets', TEMPLATE_KEY = 'stencil-studio.templates.v1'
export default function Presets({ doc, registry }: { doc: ProjectDocument; registry: ParameterRegistry }) {
  const [book, setBook] = useState<Book>(() => { try { const value = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return object(value) ? value : {} } catch { return {} } })
  const [templates, setTemplates] = useState<Record<string, any>>(() => { try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? '{}') } catch { return {} } })
  const [instance, setInstance] = useState(''), [selected, setSelected] = useState(''), [name, setName] = useState(''), [message, setMessage] = useState('')
  const ops = operations(doc).filter(n => isArtwork(n.type) || isGeometry(n.type) || isManufacturing(n.type)), op = ops.find(o => o.id === instance) ?? ops[0], mine = op && book[op.type] || {}, builtin = op && BUILT_IN[op.type] || {}
  const commitBook = (next: Book) => {
    // Do not overwrite malformed legacy storage through an apparently empty UI.
    const raw = localStorage.getItem(KEY); if (raw) { const old = JSON.parse(raw); if (!object(old)) throw Error('Existing presets use an unsupported format. Export or repair that data first.') }
    localStorage.setItem(KEY, JSON.stringify(next)); setBook(next)
  }
  const action = (fn: () => void) => { try { fn(); setMessage('Preset library updated.') } catch (e) { setMessage(String(e instanceof Error ? e.message : e)) } }
  return <div className="preset-library"><p className="section-note">An operation preset adjusts one selected instance. A style supplies a starting recipe. Engine defaults reset fields. Workflow templates replace all preparation steps in a new project copy. Saved projects also include original image bytes.</p>
    {op && <><label className="setting-choice"><span>Apply to operation</span><select aria-label="Preset operation" value={op.id} onChange={e => { setInstance(e.target.value); setSelected('') }}>{ops.map(o => <option key={o.id} value={o.id}>{(manufacturingNames[o.type] ?? artworkNames[o.type])}{ops.filter(p=>p.type===o.type).length>1 ? ` ${ops.filter(p=>p.type===o.type).findIndex(p=>p.id===o.id)+1}` : ''}</option>)}</select></label>
      <label className="setting-choice"><span>Operation preset</span><select aria-label="Operation preset" value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a preset…</option>{[...Object.keys(builtin), ...Object.keys(mine)].map(n => <option key={n} value={n}>{n}{builtin[n] ? ' · Built in' : ''}</option>)}</select></label>
      <div className="preset-name"><input aria-label="Preset name" value={name} placeholder="Name your preset" onChange={e => setName(e.target.value)} /></div>
      <div className="editor-actions"><button disabled={!name.trim()} onClick={() => action(() => { const n = name.trim(); if (mine[n] || builtin[n]) throw Error('Choose a different name; that preset is already saved.'); const values = { ...registry.defaults(geometryType(op.type)), ...op.params }; delete values.image_id; commitBook({ ...book, [op.type]: { ...mine, [n]: values } }); setSelected(n) })}>Save operation preset</button>
        <button disabled={!selected} onClick={() => editor.command('Apply operation preset', d => applyOperationPreset(d, op.id, mine[selected] ?? builtin[selected], registry))}>Apply to selected operation</button>
        <button disabled={!mine[selected] || !name.trim()} onClick={() => action(() => { const n = name.trim(); if (n !== selected && (mine[n] || builtin[n])) throw Error('That name is already used.'); const sets = { ...mine, [n]: mine[selected] }; if (n !== selected) delete sets[selected]; commitBook({ ...book, [op.type]: sets }); setSelected(n) })}>Rename preset</button>
        <button disabled={!mine[selected]} onClick={() => action(() => { const sets = { ...mine }; delete sets[selected]; commitBook({ ...book, [op.type]: sets }); setSelected('') })}>Remove preset</button>
        <button onClick={() => editor.parameters(op.id, registry.defaults(geometryType(op.type)), 'Restore operation defaults')}>Restore operation defaults</button>
      </div></>}
    <div className="editor-actions"><button onClick={() => download(new Blob([JSON.stringify({ stencilPresets: 1, presets: book, stencilStudioTemplates: templates }, null, 2)], { type: 'application/json' }), 'stencil-presets.json')}>Export presets</button><label className="file-control">Import presets<input aria-label="Import presets file" type="file" accept=".json" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
      try { const raw = JSON.parse(await file.text()), merged = mergeBook(book, parseBook(raw)); commitBook(merged.book); if (object(raw.stencilStudioTemplates)) { const next = { ...raw.stencilStudioTemplates, ...templates }; localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next)); setTemplates(next) }; setMessage(`Imported ${merged.added} presets. Existing names were kept.`) } catch (error) { setMessage(`Presets were not replaced: ${String(error instanceof Error ? error.message : error)}`) }
    }} /></label></div>
    <details className="workflow-templates"><summary>Workflow templates</summary><p>Save a single artwork pass as a reusable template. Applying one creates a separate, reversible copy and retains the complete previous project. The current original image or text is kept.</p>
      <button disabled={!name.trim() || !liveArtwork(doc) || passList(doc).length !== 1} onClick={() => action(() => { const n = name.trim(); if (templates[n]) throw Error('That template name is already used.'); const raw = { version: 2, graph: copy(rawGraph(doc)), stencilStudio: { schema: 2, style: activeStyle(doc), disabled: copy(doc.raw.stencilStudio?.disabled ?? {}) } }; const next = { ...templates, [n]: raw }; localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next)); setTemplates(next) })}>Save workflow template</button>
      {Object.entries<any>(templates).map(([n, raw]) => <div className="template-row" key={n}><span>{n}</span><button onClick={() => editor.command(`Apply ${n} as project copy`, current => {
        if (!object(raw) || !object(raw.graph) || !Array.isArray(raw.graph.nodes) || !Array.isArray(raw.graph.edges)) throw Error('This template is not supported. The original project is unchanged.')
        const next: ProjectDocument = { raw: copy(raw) }, oldSources = operations(current).filter(o => ['source','text'].includes(o.type)), sources = operations(next).filter(o => ['source','text'].includes(o.type))
        if (sources.length !== 1 || oldSources.length !== 1 || sources[0].type !== oldSources[0].type) throw Error('Choose a template matching this image or text source.')
        const replacement = sources[0].type === 'source' ? { image_id: oldSources[0].params.image_id } : { text: oldSources[0].params.text }
        const result = editMany(next, sources[0].id, replacement); result.raw.images = copy(current.raw.images ?? {}); result.raw.stencilStudio = { ...result.raw.stencilStudio, previousProject: copy(current.raw) }; validateRecipe(result, [...registry.types.values()]); return result
      })}>Apply as project copy</button><button onClick={() => action(() => { const next = { ...templates }; delete next[n]; localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next)); setTemplates(next) })}>Remove template</button></div>)}
    </details>
    {message && <p role="status" className="preset-message">{message}</p>}
  </div>
}
