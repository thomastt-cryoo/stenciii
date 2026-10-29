import { useEffect, useRef, useState } from 'react'
import { categories, type ParameterRegistry } from './registry'
import { compileRecipe, operations, type ProjectDocument } from './project'
import { editor } from './session'

export const milestones: Record<string, string> = {
  'Artwork and image cleanup': 'M2–M3', 'Size and print settings': 'M2–M3', 'Bridges and stencil geometry': 'M3',
  'Colours and layers': 'M3–M4', 'Mesh optimization': 'M4', 'Tiles and large stencils': 'M4',
  'Mounting and borders': 'M5', 'Screws, connectors and hardware': 'M5', 'Processing steps': 'M3–M5',
  'Presets and history': 'M2–M3', 'Batch processing and diagnostics': 'M5', 'Compatibility': 'M3–M5',
}
const readable = (s: string) => s.replace(/\bnodes?\b/gi, 'step').replace(/\bgraphs?\b/gi, 'workflow')
export default function Settings({ registry, doc, close }: { registry: ParameterRegistry; doc: ProjectDocument | null; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState(''), [category, setCategory] = useState<string>(categories[0])
  useEffect(() => {
    const modal = dialog.current!, opener = document.querySelector<HTMLButtonElement>('.all-settings-button')
    modal.showModal()
    return () => { modal.close(); opener?.focus() }
  }, [])
  const ops = doc ? operations(doc) : []
  const layoutInputs = new Set<string>()
  if (doc) { try { for (const e of compileRecipe(doc).edges) if (e.to[1] === 'tiles') layoutInputs.add(e.to[0]) } catch { /* Compatibility view still saves malformed data. */ } }
  const results = registry.search(query, query.trim() ? undefined : category)
  return <dialog className="settings-dialog" ref={dialog} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === dialog.current) close() }} aria-labelledby="settings-title">
    <header><div><h2 id="settings-title">All Settings</h2><p>Find a setting. Understand what it changes.</p></div><button className="icon-button" onClick={close} aria-label="Close settings">×</button></header>
    <div className="settings-search"><input autoFocus type="search" placeholder="Search by name or key…" aria-label="Search all settings" value={query} onChange={e => setQuery(e.target.value)} /><span>{registry.settings.length} settings</span></div>
    <div className="settings-body"><nav aria-label="Settings categories">{categories.map(c => <button key={c} aria-current={!query && category === c ? 'page' : undefined} onClick={() => { setCategory(c); setQuery('') }}>{c}</button>)}</nav>
      <section className="settings-content" aria-label="Settings results">
        <h3>{query ? `${results.length} matching settings` : category}</h3>
        {!query && <p className="section-note">{category === 'Presets and history' ? 'Undo and redo work now. Saved preset editors are planned for M2–M3.' : category === 'Processing steps' ? 'Saved processing is preserved below. Adding, reordering and branching steps arrives in M3–M5.' : category === 'Compatibility' ? 'Imported workflows and unknown data are kept intact. Specialist editing arrives in M3–M5.' : `Specialist controls are planned for ${milestones[category]}. The catalogue below is a reference, not an unfinished control panel.`}</p>}
        {['Processing steps', 'Compatibility'].includes(category) && !query && <ol className="step-list">{ops.map((o, i) => <li key={i}><b>{registry.types.get(o.type === 'complexity' ? 'remesh' : o.type)?.label ?? 'Unavailable processing step'}</b><span>{o.id} · {Object.keys(o.params).length} saved values{!registry.types.has(o.type) && o.type !== 'complexity' ? ' · Cannot run in this engine version' : ''}</span></li>)}</ol>}
        {category === 'Presets and history' && !query && <ol className="step-list">{editor.history().map((h, i) => <li key={i}>{h.replace(/_/g, ' ')}</li>)}</ol>}
        {!results.length && query && <p>No settings match “{query}”. Try a shorter name, such as bridge or thickness.</p>}
        {results.map(s => {
          const instances = registry.instances(s, ops)
          const p = s.parameter
          return <details className="setting-reference" key={s.key}><summary><span>{p.label}</span><small>{s.operationLabel}</small></summary><div>
            <code>{s.key}</code><p>{readable(s.dependency)}</p>
            <dl><dt>Default</dt><dd>{String(p.default) || 'Empty'}</dd><dt>Allowed</dt><dd>{p.choices?.join(', ') ?? (p.min !== undefined ? `${p.min} to ${p.max} · step ${p.step}` : p.kind === 'bool' ? 'On / off' : 'Text')}</dd></dl>
            {instances.length > 0 ? instances.map((o, i) => { const state = registry.availability(s, o.params, { hasLayout: layoutInputs.has(o.id) }); return <div key={o.id}><p className="saved-value">Saved in {s.operationLabel}{instances.length > 1 ? ` ${i + 1}` : ''} ({o.id}): <strong>{JSON.stringify(o.params[p.name] ?? p.default)}</strong></p>{!state.active && <p>Currently inactive: {state.reason}</p>}</div> }) : <p className="saved-value">Not used in this workflow.</p>}
            <small>Reference only here. Quick Adjustments edits the everyday controls; specialist editors are planned for {milestones[s.category]}.</small>
          </div></details>
        })}
      </section>
    </div>
    <footer>24 processing types · All original project data stays in your saved file.</footer>
  </dialog>
}
