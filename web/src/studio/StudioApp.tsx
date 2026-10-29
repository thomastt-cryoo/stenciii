import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { controller, editor, useEditor } from './session'
import { decodeBytes, operations, projectName, quickRecipe } from './project'
import type { ParamDef } from '../api'
import Settings from './Settings'
const MeshPreview = lazy(() => import('./MeshPreview'))

function Mark() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h7v4H8v3H4V4Zm9 0h7v7h-4V8h-3V4ZM4 13h4v3h3v4H4v-7Zm12 0h4v7h-7v-4h3v-3Z" fill="currentColor" /></svg> }
function NumberControl({ label, value, def, onChange, unit }: { label: string; value: number; def: ParamDef; onChange: (v: number) => void; unit: string }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <label className="quick-field"><span>{label}</span><span className="number-entry"><input aria-label={label} type="number" min={def.min} max={def.max} step={def.step} value={draft} onChange={e => {
    setDraft(e.target.value); const v = Number(e.target.value)
    if (e.target.value && Number.isFinite(v) && v >= def.min! && v <= def.max! && (def.kind !== 'int' || Number.isInteger(v))) onChange(v)
  }} onBlur={() => setDraft(String(value))} /><span>{unit}</span></span></label>
}
function Artwork({ url, zoom, fit }: { url: string; zoom: number; fit: number }) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => setPan({ x: 0, y: 0 }), [url, fit])
  return <div className="artwork-preview" onPointerDown={e => { drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}><img draggable={false} src={url} alt="Original artwork" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} /></div>
}

export default function StudioApp() {
  const state = useEditor(), { doc, registry, run } = state
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('stencil-studio.theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') } catch { return 'light' } })
  const [view, setView] = useState<'original' | 'stencil' | '3d'>('original')
  const [settings, setSettings] = useState(false), [zoom, setZoom] = useState(1), [fit, setFit] = useState(0)
  const [drag, setDrag] = useState(false), [assetUrl, setAssetUrl] = useState(''), [selected, setSelected] = useState('')
  const imageInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null)
  const recipe = doc && quickRecipe(doc), sources = doc ? operations(doc).filter(o => o.type === 'source') : []
  const asset = doc?.raw.images?.[String(sources[0]?.params.image_id)]
  const result = run.output?.value.artifacts.find(a => a.id === selected) ?? run.output?.value.artifacts.at(-1)
  const current = !!controller.exportable, meshUrl = result?.mesh ? result.url : ''
  const findings = run.output?.value.findings ?? []
  const warnings = findings.filter(f => f.level !== 'info'), blocked = findings.some(f => f.level === 'error')
  const canExport = current && !!result && !blocked
  useEffect(() => { void editor.initialize() }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('stencil-studio.theme', theme) } catch {} }, [theme])
  useEffect(() => {
    let url = ''
    if (asset?.base64) { try { url = URL.createObjectURL(new Blob([decodeBytes(asset.base64)], { type: /\.svg$/i.test(asset.name) ? 'image/svg+xml' : /\.jpe?g$/i.test(asset.name) ? 'image/jpeg' : /\.bmp$/i.test(asset.name) ? 'image/bmp' : 'image/png' })) } catch {} }
    setAssetUrl(url); return () => { if (url) URL.revokeObjectURL(url) }
  }, [asset?.base64, asset?.name])
  useEffect(() => { if (!doc) { setView('original'); setZoom(1) } }, [doc])
  useEffect(() => { if (!run.output) setView('original') }, [run.output])
  useEffect(() => { if (run.status === 'complete' && run.output?.value.artifacts.length) { setView('stencil'); setZoom(1) } }, [run.status, run.output?.generation])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() === 's') { e.preventDefault(); editor.downloadProject() }
      if (e.key.toLowerCase() === 'o') { e.preventDefault(); projectInput.current?.click() }
      if (e.key === 'Enter') { e.preventDefault(); void editor.make() }
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); setSettings(true) }
      if (!(e.target as HTMLElement).closest('input, textarea, select, [contenteditable]') && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo() }
    }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [])
  const chooseImage = () => imageInput.current?.click()
  const make = () => { void editor.make() }
  const number = (id: string, type: string, key: string, label: string, unit: string, params: Record<string, unknown>) => {
    const def = registry?.types.get(type)?.params.find(p => p.name === key)
    return def && <NumberControl key={`${id}/${key}`} label={label} unit={unit} def={def} value={Number(params[key] ?? def.default)} onChange={v => editor.edit(id, key, v)} />
  }
  let status = doc ? 'Ready to make your stencil' : 'Choose an image to begin'
  if (run.status === 'running') status = 'Making your stencil…'
  else if (run.status === 'error') status = 'Something needs attention'
  else if (run.status === 'cancelled') status = 'Processing cancelled · Make Stencil to try again'
  else if (run.status === 'dirty' && run.output) status = 'Settings changed · Make Stencil to update'
  else if (current) status = blocked ? 'Output needs attention' : warnings.length ? 'Stencil made · Review the notes' : 'Stencil ready'
  if (current && !result) status = 'Processing complete · No 3D output'
  return <div className={`studio-app${drag ? ' is-dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false) }} onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void (/\.json$/i.test(f.name) ? editor.importFile(f) : editor.image(f)) }}>
    <input className="visually-hidden" ref={imageInput} type="file" accept="image/png,image/jpeg,image/bmp,image/svg+xml,.svg,.bmp" aria-label="Choose image file" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setView('original'); void editor.image(f) } }} />
    <input className="visually-hidden" ref={projectInput} type="file" accept=".json" aria-label="Open project file" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void editor.importFile(f) }} />
    <header className="app-header"><a className="brand" href="#" onClick={e => e.preventDefault()}><Mark /><span>Stencil Studio</span></a><span className="header-divider" />
      <nav aria-label="Project actions"><button onClick={() => editor.newProject()}>New Project</button><button onClick={() => projectInput.current?.click()}>Open Project</button><button onClick={() => editor.downloadProject()} disabled={!doc}>Save Project</button></nav>
      <div className="header-end"><div className="undo-actions"><button className="icon-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!state.canUndo} onClick={() => editor.undo()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5-4 4 4 4M3 9h8a5 5 0 0 1 5 5" /></svg></button><button className="icon-button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => editor.redo()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m13 5 4 4-4 4m4-4H9a5 5 0 0 0-5 5" /></svg></button></div>
        <button className="icon-button theme-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><svg viewBox="0 0 20 20" aria-hidden="true">{theme === 'light' ? <path d="M15 12A7 7 0 0 1 8 4a7 7 0 1 0 7 8Z" /> : <><circle cx="10" cy="10" r="3" /><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.5 3.5 5 5m10 10 1.5 1.5m-13 0L5 15M15 5l1.5-1.5" /></>}</svg></button>
        <a role="link" tabIndex={canExport ? 0 : -1} className={`export-button${!canExport ? ' disabled' : ''}`} aria-disabled={!canExport} href={canExport ? result?.url : undefined} download={result?.filename} onClick={e => { if (!canExport) e.preventDefault() }}>Export {result?.filename.endsWith('.zip') ? 'ZIP' : 'STL'}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9m-3-3 3 3 3-3M4 13v4h12v-4" /></svg></a>
      </div>
    </header>
    <div className="workspace-layout"><main className="workspace">
      <div className="workspace-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>{doc ? projectName(doc) : 'From artwork to stencil.'}</h1></div>{doc && <button className="replace-image" onClick={chooseImage} disabled={state.loading || sources.length !== 1}>Replace image</button>}</div>
      <div className="preview-toolbar"><div className="preview-tabs" role="tablist" aria-label="Preview views">{(['original', 'stencil', '3d'] as const).map(v => <button key={v} role="tab" aria-selected={view === v} aria-controls="preview-surface" disabled={v !== 'original' && !meshUrl} onClick={() => { setView(v); setZoom(1); setFit(f => f + 1) }}>{v === '3d' ? '3D' : v === 'stencil' ? 'Stencil' : 'Original'}</button>)}</div>{doc && <div className="zoom-controls"><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.25, z / 1.25))}>−</button><output aria-label="Zoom level">{Math.round(zoom * 100)}%</output><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(5, z * 1.25))}>+</button><button onClick={() => { setZoom(1); setFit(f => f + 1) }}>Fit</button></div>}</div>
      <section className="preview-surface" id="preview-surface" aria-label="Artwork and stencil preview">
        {!doc ? <div className="empty-workspace"><div className="upload-symbol"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 31v7h28v-7M24 9v22M16 17l8-8 8 8" /></svg></div><h2>Start with your artwork.</h2><p>Drop an image here, or choose a file.<br />Your stencil starts with a single image.</p><button className="primary-button" onClick={chooseImage} disabled={state.loading}>{state.loading ? 'Starting the engine…' : 'Choose Image'}</button><small>PNG, JPG, BMP or SVG · Processed on your device</small></div>
        : view === 'original' ? (assetUrl ? <Artwork url={assetUrl} zoom={zoom} fit={fit} /> : <div className="empty-workspace"><h2>Your saved workflow is intact.</h2><p>{sources.length ? 'The original artwork is not embedded. You can save this project safely or choose a replacement.' : 'This project uses generated artwork or specialist processing.'}</p></div>)
        : meshUrl ? <Suspense fallback={<p className="view-message">Loading preview…</p>}><MeshPreview url={meshUrl} flat={view === 'stencil'} zoom={zoom} fit={fit} theme={theme} onZoom={setZoom} /></Suspense> : null}
        {run.output && !current && view !== 'original' && <div className="stale-label">Previous result · {run.status === 'running' ? 'Updating' : 'Not current'}</div>}
        {drag && <div className="drop-overlay">Drop to open your artwork</div>}
      </section>
      <div className="preview-caption"><span>{doc ? view === 'original' ? asset?.name ?? 'Original artwork' : view === 'stencil' ? 'Top view of the generated STL · Bridges included' : 'Drag to orbit · Scroll to zoom' : 'Local processing. Your artwork stays with you.'}</span>{result?.mesh && view !== 'original' && <span>{result.mesh.size.map(v => v.toFixed(1)).join(' × ')} mm</span>}</div>
      {run.output && run.output.value.artifacts.length > 1 && <label className="output-choice">Preview output <select value={result?.id} onChange={e => setSelected(e.target.value)}>{run.output.value.artifacts.map(a => <option key={a.id} value={a.id}>{a.label} · {a.step}</option>)}</select></label>}
      <section className="readiness" aria-label="Stencil readiness"><span className={`status-dot ${run.status}`} /><div><strong role="status" aria-live="polite">{state.loading ? 'Opening artwork…' : status}</strong><p>{run.status === 'running' ? `${run.activity} · ${Math.min(99, Math.round(run.progress * 100))}%` : current ? !result ? 'This saved workflow produces no STL. Its artwork and settings are preserved.' : result.mesh ? `${result.mesh.triangles.toLocaleString()} triangles${result.info.stats?.watertight ? ' · Closed mesh checked by the engine' : ''}` : `${Object.keys(result.info.files ?? {}).length} files in the selected output` : doc ? 'Choose your settings, then make a full-quality stencil.' : 'No accounts. No uploads. Just your artwork.'}</p></div>{run.status === 'running' && <button onClick={() => editor.cancel()}>Cancel</button>}</section>
      {(state.error || run.error) && <div className="error-message" role="alert">{(state.error ?? run.error)?.replace(/\bnodes?\b/gi, 'step').replace(/\bgraph\b/gi, 'workflow')}<button onClick={make} disabled={!doc}>Try again</button></div>}
      {state.notice && <p className="notice" role="status">{state.notice}</p>}
      {current && warnings.length > 0 && <details className="readiness-notes"><summary>{warnings.length} print note{warnings.length > 1 ? 's' : ''} to review</summary><ul>{warnings.map((w, i) => <li key={i}>{w.text}</li>)}</ul></details>}
    </main>
    <aside className="quick-sidebar" aria-label="Quick Adjustments"><div className="sidebar-title"><h2>Quick Adjustments</h2><p>A few choices. Your kind of stencil.</p></div>
      {!recipe && doc ? <div className="compatibility-note"><h3>Custom workflow</h3><p>All {operations(doc).length} saved steps, artwork and settings are preserved. Supported processing runs with the original engine. Unavailable steps are reported without changing the saved file.</p><p>Quick adjustments are available for simple image-to-stencil workflows. Specialist editing arrives in M3–M5.</p></div> : <>
        <div className="style-section"><span className="control-label">Stencil style</span><div className="selected-style"><Mark /><div><strong>{recipe && !recipe.vector ? 'Imported raster' : 'Standard'}</strong><small>{recipe && !recipe.vector ? 'Original raster processing' : 'Clean outlines. Smooth edges.'}</small></div><span className="selection-indicator" aria-hidden="true">✓</span></div><p className="subtle-note">More stencil styles are being developed.</p></div>
        {recipe && <fieldset disabled={state.loading} className="quick-group"><legend>Artwork</legend><>
          {number(recipe.source.id, 'source', 'resolution', 'Working detail', 'px', recipe.source.params)}
          <p className="field-hint">More pixels preserve finer features.</p>
          <label className="toggle-field"><span>Automatic threshold</span><input aria-label="Automatic threshold" type="checkbox" role="switch" checked={Number(recipe.threshold.params.threshold ?? 256) === 256} onChange={e => editor.edit(recipe.threshold.id, 'threshold', e.target.checked ? 256 : 128)} /></label>
          {Number(recipe.threshold.params.threshold ?? 256) !== 256 && <label className="threshold-field"><span>Threshold <output>{String(recipe.threshold.params.threshold)}</output></span><input type="range" aria-label="Threshold" min={0} max={255} step={1} value={Number(recipe.threshold.params.threshold)} onChange={e => editor.edit(recipe.threshold.id, 'threshold', Number(e.target.value))} /></label>}
          <label className="toggle-field"><span>Invert artwork</span><input aria-label="Invert artwork" type="checkbox" checked={!!recipe.threshold.params.invert} onChange={e => editor.edit(recipe.threshold.id, 'invert', e.target.checked)} /></label>
        </></fieldset>}
        {recipe && <fieldset disabled={state.loading} className="quick-group"><legend>Size & strength</legend><>
          {number(recipe.build.id, recipe.build.type, 'width_mm', 'Stencil width', 'mm', recipe.build.params)}
          {number(recipe.build.id, recipe.build.type, 'thickness_mm', 'Base thickness', 'mm', recipe.build.params)}
          {number(recipe.build.id, recipe.build.type, 'bridge_mm', 'Bridge width', 'mm', recipe.build.params)}
          <p className="field-hint">Bridges hold floating pieces in place. Final height includes the saved extra layers.</p>
        </></fieldset>}
        {!doc && <p className="sidebar-empty-note">Your everyday controls appear here once you choose an image.</p>}
      </>}
      <div className="sidebar-actions"><button className="primary-button make-button" disabled={!doc || state.loading || run.status === 'running'} onClick={make}>{run.status === 'running' ? 'Making stencil…' : 'Make Stencil'}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg></button><button className="all-settings-button" onClick={() => setSettings(true)} disabled={!registry}>All Settings <span aria-hidden="true">↗</span></button><small>Everything stays on your device.</small></div>
    </aside></div>
    {settings && registry && <Settings registry={registry} doc={doc} close={() => setSettings(false)} />}
  </div>
}
