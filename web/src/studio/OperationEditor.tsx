import { SettingControl } from './Controls'
import { editor, useEditor } from './session'
import { artworkHelp, artworkNames } from './artwork'
import type { Operation } from './project'
import type { ParameterRegistry } from './registry'
import { isGeometry } from './geometry'
import { GeometryEditor } from './GeometryWorkbench'
import SourceInformation from './SourceInformation'
export default function OperationEditor({ op, registry }: { op: Operation; registry: ParameterRegistry }) {
  const doc = useEditor(s => s.doc), def = registry.types.get(op.type)
  if (isGeometry(op.type)) return <GeometryEditor op={op} registry={registry} />
  if (!def) return <p>This specialist operation is preserved but is not available in this engine.</p>
  const stored = op.type === 'source' && doc?.raw.images?.[String(op.params.image_id)], asset = typeof stored?.base64 === 'string' ? stored : null
  return <section className="operation-editor" aria-label={`${artworkNames[op.type] ?? def.label} settings · ${op.id}`}>
    {asset && <p className="file-information">{asset.name} · {(Math.floor(asset.base64.length * .75) - (asset.base64.endsWith('==') ? 2 : asset.base64.endsWith('=') ? 1 : 0)).toLocaleString()} original bytes retained</p>}
    {op.type === 'source' && <SourceInformation id={String(op.params.image_id ?? '')} resolution={Number(op.params.resolution ?? 1000)} />}
    {op.type === 'transform' && <div className="editor-actions"><button onClick={() => editor.crop(op.id)}>Edit crop visually</button><button onClick={() => editor.parameters(op.id, Object.fromEntries(def.params.map(p => [p.name, p.default])), 'Reset transformation')}>Reset transformation</button></div>}
    {def.params.map(p => {
      const setting = registry.settings.find(s => s.key === `${op.type}.${p.name}`)!, availability = registry.availability(setting, op.params)
      return <div className="artwork-parameter" key={p.name} data-parameter={`${op.type}.${p.name}`}><SettingControl parameter={p} value={op.params[p.name] ?? p.default} id={op.id} disabled={!availability.active} /><p className="parameter-help">{availability.active ? artworkHelp[setting.key] : availability.reason}</p></div>
    })}
    <details className="technical-identity"><summary>Setting identities</summary><code>{op.id} · {op.type}</code></details>
  </section>
}
