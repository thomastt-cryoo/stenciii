import { useEffect, useRef, useState } from 'react'
import { categories, type ParameterRegistry } from './registry'
import { compileRecipe, operations, type ProjectDocument } from './project'
import { editor, useEditor } from './session'
import { editable } from './recipes'
import { SettingControl } from './Controls'

export const milestones: Record<string, string> = {
  'Artwork and image cleanup': 'M2–M3', 'Size and print settings': 'M2–M3', 'Bridges and stencil geometry': 'M3',
  'Colours and layers': 'M3–M4', 'Mesh optimization': 'M4', 'Tiles and large stencils': 'M4',
  'Mounting and borders': 'M5', 'Screws, connectors and hardware': 'M5', 'Processing steps': 'M3–M5',
  'Presets and history': 'M2–M3', 'Batch processing and diagnostics': 'M5', 'Compatibility': 'M3–M5',
}
const readable = (s: string) => s.replace(/\bnodes?\b/gi, 'step').replace(/\bgraphs?\b/gi, 'workflow')
export default function Settings({ registry, doc, close, initialCategory, initialQuery = '' }: { registry: ParameterRegistry; doc: ProjectDocument | null; close: () => void; initialCategory?: string; initialQuery?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const error = useEditor(s => s.error)
  const [query, setQuery] = useState(initialQuery), [category, setCategory] = useState<string>(initialCategory ?? categories[0]), [used, setUsed] = useState(false)
  useEffect(() => {
    const modal = dialog.current!, opener = document.querySelector<HTMLButtonElement>('.all-settings-button')
    modal.showModal()
    return () => { modal.close(); opener?.focus() }
  }, [])
  const ops = doc ? operations(doc) : []
  const layoutInputs = new Set<string>()
  if (doc) { try { for (const e of compileRecipe(doc).edges) if (e.to[1] === 'tiles') layoutInputs.add(e.to[0]) } catch { /* Compatibility view still saves malformed data. */ } }
  const results = registry.search(query, query.trim() ? undefined : category).filter(s => !used || registry.instances(s, ops).length).sort((a, b) => query ? 0 : Number(!registry.instances(a, ops).length) - Number(!registry.instances(b, ops).length))
  return <dialog className="settings-dialog" ref={dialog} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === dialog.current) close() }} aria-labelledby="settings-title">
    <header><div><h2 id="settings-title">All Settings</h2><p>Find a setting. Understand what it changes.</p></div><button className="icon-button" onClick={close} aria-label="Close settings">×</button></header>
    <div className="settings-search"><input autoFocus type="search" placeholder="Search settings…" aria-label="Search all settings" value={query} onChange={e => setQuery(e.target.value)} /><label className="used-filter"><input type="checkbox" checked={used} onChange={e => setUsed(e.target.checked)} />In this project</label><span>{registry.settings.length} settings</span></div>
    {error && <p className="settings-error" role="alert">{error}</p>}
    <div className="settings-body"><nav aria-label="Settings categories">{categories.map(c => <button key={c} aria-current={!query && category === c ? 'page' : undefined} onClick={() => { setCategory(c); setQuery('') }}>{c}</button>)}</nav>
      <section className="settings-content" aria-label="Settings results">
        <h3>{query ? `${results.length} matching settings` : category}</h3>
        {!query && <p className="section-note">{category === 'Presets and history' ? 'Your adjustments and style changes can be undone. Reusable presets arrive in M3.' : category === 'Processing steps' ? 'Your saved processing is listed below. Reordering and branching editors arrive in M3–M5.' : category === 'Compatibility' ? 'Imported workflows and unknown data are kept intact.' : 'Adjustable settings act on the named step in this project. Reference settings explain specialist tools; their editors arrive in later milestones.'}</p>}
        {['Processing steps', 'Compatibility'].includes(category) && !query && <ol className="step-list">{ops.map((o, i) => <li key={i}><b>{registry.types.get(o.type === 'complexity' ? 'remesh' : o.type)?.label ?? 'Unavailable processing step'}</b><span>{o.id} · {Object.keys(o.params).length} saved values{!registry.types.has(o.type) && o.type !== 'complexity' ? ' · Cannot run in this engine version' : ''}</span></li>)}</ol>}
        {category === 'Presets and history' && !query && <ol className="step-list">{editor.history().map((h, i) => <li key={i}>{h.replace(/_/g, ' ')}</li>)}</ol>}
        {!results.length && query && <p>No settings match “{query}”. Try a shorter name, such as bridge or thickness.</p>}
        {results.map(s => {
          const instances = registry.instances(s, ops)
          const p = s.parameter
          const adjustable = editable(s.type, p.name) && instances.length > 0
          return <details className="setting-reference" key={s.key} open={initialQuery === s.key || undefined}><summary><span>{p.label}</span><small>{s.operationLabel}</small><span className={`setting-badge ${adjustable ? 'editable' : ''}`}>{adjustable ? 'Adjustable' : instances.length ? 'In project · Reference' : 'Reference'}</span></summary><div>
            <code>{s.key}</code><p>{readable(s.dependency)}</p>
            <dl><dt>Default</dt><dd>{String(p.default) || 'Empty'}</dd><dt>Allowed</dt><dd>{p.choices?.join(', ') ?? (p.min !== undefined ? `${p.min} to ${p.max} · step ${p.step}` : p.kind === 'bool' ? 'On / off' : 'Text')}</dd></dl>
            {instances.length > 0 ? instances.map((o, i) => { const state = registry.availability(s, o.params, { hasLayout: layoutInputs.has(o.id) }); return <div className="setting-instance" key={o.id}><p className="saved-value">{s.operationLabel}{instances.length > 1 ? ` ${i + 1}` : ''} · <code>{o.id}</code> · {state.active ? 'Active' : 'Inactive'}{!adjustable && <> · Saved: <strong>{JSON.stringify(o.params[p.name] ?? p.default)}</strong></>}</p>{adjustable && <SettingControl parameter={p} value={o.params[p.name] ?? p.default} id={o.id} disabled={!state.active} />}{!state.active && <p>Currently inactive: {state.reason}</p>}</div> }) : <p className="saved-value">Not used in this workflow.</p>}
            {!adjustable && <small>Reference only. Specialist editing is planned for {milestones[s.category]}.</small>}
          </div></details>
        })}
      </section>
    </div>
    <footer>24 processing types · All original project data stays in your saved file.</footer>
  </dialog>
}
