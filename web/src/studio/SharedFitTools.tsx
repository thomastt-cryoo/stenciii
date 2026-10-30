import {useState} from 'react'
import type {ProjectDocument} from './project'
import type {ParameterRegistry} from './registry'
import {editor} from './session'
import {fitOperations,setFitLink,sharedFitFields} from './sharedFit'

export default function SharedFitTools({doc,registry}:{doc:ProjectDocument;registry:ParameterRegistry}){
 const ops=fitOperations(doc,registry),[selected,setSelected]=useState(''),source=ops.find(op=>op.id===selected)??ops[0]
 if(!source)return null
 const enabled=doc.raw.stencilStudio?.sharedFit?.schema===1&&doc.raw.stencilStudio.sharedFit.enabled===true
 const unequal=sharedFitFields.some(key=>new Set(ops.map(op=>op.params[key]??registry.defaults(op.type)[key])).size>1)
 return <details className="shared-fit-tools"><summary>Project screw-fit settings</summary><p>Link nut clearance, tip taper and taper length across screws and border hardware. Plate-hole and pad clearances keep their separate units and controls.</p>
  {unequal&&!enabled&&<p>These operations have different saved fit settings. They stay independent until you enable linking.</p>}
  <label>Use fit values from<select aria-label="Shared fit source" disabled={enabled} value={source.id} onChange={e=>setSelected(e.target.value)}>{ops.map(op=><option key={op.id} value={op.id}>{registry.types.get(op.type)?.label} · {op.id}</option>)}</select></label>
  <label className="toggle-field"><span>Link screw-fit settings in this project</span><input type="checkbox" checked={enabled} onChange={e=>editor.command(e.target.checked?'Link screw fit settings':'Unlink screw fit settings',current=>setFitLink(current,source.id,e.target.checked,registry))}/></label>
  {enabled&&<p>Edits to these three settings in any linked operation update the matching settings together. Undo restores the complete previous values.</p>}
 </details>
}
