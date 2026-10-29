import { useEffect, useState } from 'react'
import type { ParamDef } from '../api'
import { object } from './project'
import { editor, useEditor } from './session'

export function NumberControl({ label, value, def, onChange, unit = '', displayLabel }: { label: string; value: number; def: ParamDef; onChange: (v: number) => void; unit?: string; displayLabel?: string }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <label className="quick-field"><span>{displayLabel ?? label}</span><span className="number-entry"><input aria-label={label} type="number" min={def.min} max={def.max} step={def.step} value={draft} onFocus={() => editor.begin(false)} onChange={e => {
    setDraft(e.target.value); const v = Number(e.target.value)
    if (e.target.value && Number.isFinite(v) && v >= def.min! && v <= def.max! && (def.kind !== 'int' || Number.isInteger(v))) onChange(v)
  }} onBlur={() => { setDraft(String(value)); editor.end() }} /><span>{unit}</span></span></label>
}
export function SettingControl({ parameter: p, value, id, disabled }: { parameter: ParamDef; value: unknown; id: string; disabled: boolean }) {
  return <div className="parameter-control"><ValueControl parameter={p} value={value} id={id} disabled={disabled} /><button className="reset-parameter" disabled={disabled} aria-label={`Reset ${p.label} · ${id}`} title={`Engine default: ${String(p.default) || 'empty'}`} onClick={() => editor.resetParameter(id, p.name)}>Reset</button></div>
}
function ValueControl({ parameter: p, value, id, disabled }: { parameter: ParamDef; value: unknown; id: string; disabled: boolean }) {
  const doc = useEditor(s => s.doc)
  const label = `${p.label} · ${id}`
  if(p.name==='edits')return <SavedLayoutOffsets label={label} value={String(value??'')} disabled={disabled} id={id} name={p.name}/>
  if (p.name === 'image_id') return <div className="source-control"><label className="setting-choice"><span>Original image</span><select aria-label={label} value={String(value)} disabled={disabled} onChange={e => editor.edit(id, p.name, e.target.value)}>{!doc?.raw.images?.[String(value)] && <option value={String(value)}>{value ? 'Current artwork' : 'No image selected'}</option>}{Object.entries<any>(doc?.raw.images ?? {}).filter(([,a])=>object(a)&&typeof a.base64==='string').map(([key, asset]) => <option key={key} value={key}>{asset.name}</option>)}</select></label><label className="file-control">Replace image<input type="file" accept=".png,.jpg,.jpeg,.bmp,.svg" aria-label={`Replace image · ${id}`} disabled={disabled} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void editor.image(f, id) }} /></label></div>
  if (['int', 'float'].includes(p.kind)) return <fieldset disabled={disabled} className="inline-control"><NumberControl label={label} displayLabel={p.label} value={Number(value)} def={p} onChange={v => editor.edit(id, p.name, v)} /></fieldset>
  if (p.kind === 'bool') return <label className="toggle-field"><span>{p.label}</span><input type="checkbox" aria-label={label} checked={!!value} disabled={disabled} onChange={e => editor.edit(id, p.name, e.target.checked)} /></label>
  if (p.kind === 'choice') return <label className="setting-choice"><span>{p.label}</span><select aria-label={label} value={String(value)} disabled={disabled} onChange={e => editor.edit(id, p.name, e.target.value)}>{p.choices?.map(c => <option key={c} value={c}>{c === '0' && p.name === 'turn' ? 'None' : p.name === 'turn' ? `${c}° clockwise` : c.replace(/_/g, ' ')}</option>)}</select></label>
  return <label className="text-parameter"><span>{p.label}</span><textarea rows={p.name === 'text' ? 4 : 2} aria-label={label} value={String(value ?? '')} disabled={disabled} onFocus={() => editor.begin(false)} onBlur={() => editor.end()} onChange={e => editor.edit(id, p.name, e.target.value)} /></label>
}

function SavedLayoutOffsets({label,value,disabled,id,name}:{label:string;value:string;disabled:boolean;id:string;name:string}){
 const [draft,setDraft]=useState(value);useEffect(()=>setDraft(value),[value])
 return <details className="saved-layout-offsets"><summary>Saved layout offsets · advanced import</summary><p>Use the visual layout and numeric positions for ordinary changes. This field accepts the original saved offset format; incompatible offsets are reported by the engine.</p><label className="text-parameter">{label}<textarea aria-label={label} rows={3} value={draft} disabled={disabled} onChange={e=>setDraft(e.target.value)}/></label><button disabled={disabled||draft===value} onClick={()=>editor.edit(id,name,draft)}>Apply saved offsets</button></details>
}
