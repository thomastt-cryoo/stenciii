import { useEffect, useState } from 'react'
import type { ParamDef } from '../api'
import { editor } from './session'

export function NumberControl({ label, value, def, onChange, unit = '' }: { label: string; value: number; def: ParamDef; onChange: (v: number) => void; unit?: string }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <label className="quick-field"><span>{label}</span><span className="number-entry"><input aria-label={label} type="number" min={def.min} max={def.max} step={def.step} value={draft} onFocus={() => editor.begin(false)} onChange={e => {
    setDraft(e.target.value); const v = Number(e.target.value)
    if (e.target.value && Number.isFinite(v) && v >= def.min! && v <= def.max! && (def.kind !== 'int' || Number.isInteger(v))) onChange(v)
  }} onBlur={() => { setDraft(String(value)); editor.end() }} /><span>{unit}</span></span></label>
}
export function SettingControl({ parameter: p, value, id, disabled }: { parameter: ParamDef; value: unknown; id: string; disabled: boolean }) {
  const label = `${p.label} · ${id}`
  if (['int', 'float'].includes(p.kind)) return <fieldset disabled={disabled} className="inline-control"><NumberControl label={label} value={Number(value)} def={p} onChange={v => editor.edit(id, p.name, v)} /></fieldset>
  if (p.kind === 'bool') return <label className="toggle-field"><span>{p.label}</span><input type="checkbox" aria-label={label} checked={!!value} disabled={disabled} onChange={e => editor.edit(id, p.name, e.target.checked)} /></label>
  if (p.kind === 'choice') return <label className="setting-choice"><span>{p.label}</span><select aria-label={label} value={String(value)} disabled={disabled} onChange={e => editor.edit(id, p.name, e.target.value)}>{p.choices?.map(c => <option key={c} value={c}>{c === '0' && p.name === 'turn' ? 'None' : p.name === 'turn' ? `${c}° clockwise` : c.replace(/_/g, ' ')}</option>)}</select></label>
  return null
}
