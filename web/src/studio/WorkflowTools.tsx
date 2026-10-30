import {useEffect,useState} from 'react'
import {operations,projectName,type ProjectDocument} from './project'
import type {ParameterRegistry} from './registry'
import {editor,useEditor} from './session'
import {originalWorkflows,applyOriginalWorkflow} from './workflowTemplates'
import {copyStepGroup,pasteStepGroup,type StepClipboard} from './stepClipboard'

let clipboard:StepClipboard|null=null
export function ProjectDetails({doc}:{doc:ProjectDocument}){
 const actual=projectName(doc),[name,setName]=useState(actual)
 const busy=useEditor(state=>state.loading||state.run.status==='running')
 useEffect(()=>setName(actual),[actual])
 return <details className="project-details"><summary>Project name</summary><label>Project name<input aria-label="Project name" value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||!name.trim()||name.trim()===actual} onClick={()=>editor.rename(name.trim())}>Rename project</button></details>
}
export function OriginalWorkflows({doc,registry}:{doc:ProjectDocument;registry:ParameterRegistry}){
 const sources=operations(doc).filter(n=>n.type==='source'),[source,setSource]=useState(sources.length===1?sources[0].id:''),[selected,setSelected]=useState('simple')
 return <details className="original-workflows"><summary>Original workflow templates</summary><p>These six starting workflows retain the original application defaults. Create a reversible project copy using one original image. The complete previous project remains available in Compatibility and Undo.</p>
  <label>Original image<select aria-label="Workflow template image" value={source} onChange={e=>setSource(e.target.value)}><option value="">Choose an original image…</option>{sources.map(n=><option key={n.id} value={n.id}>{String(doc.raw.images?.[String(n.params.image_id)]?.name??n.id)} · {n.id}</option>)}</select></label>
  <label>Workflow<select aria-label="Original workflow template" value={selected} onChange={e=>setSelected(e.target.value)}>{originalWorkflows.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
  <button disabled={!source} onClick={()=>editor.command('Create original workflow copy',current=>applyOriginalWorkflow(current,selected,source,[...registry.types.values()]))}>Create workflow project copy</button>
 </details>
}
export function StepCopyTools({doc,registry}:{doc:ProjectDocument;registry:ParameterRegistry}){
 const [selected,setSelected]=useState<string[]>([]),[count,setCount]=useState(clipboard?.nodes.length??0),[message,setMessage]=useState('')
 return <details className="step-copy-tools"><summary>Copy processing steps</summary><p>Select steps to copy. Their required input preparation and original image bytes are included. Pasting creates independent steps and retains the current workflow.</p>
  <div className="step-copy-options">{operations(doc).map(n=><label key={n.id}><input type="checkbox" aria-label={`Copy step ${n.id}`} checked={selected.includes(n.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,n.id]:old.filter(id=>id!==n.id))}/>{registry.types.get(n.type==='complexity'?'remesh':n.type)?.label??'Unavailable operation'} · {n.id}</label>)}</div>
  <div className="editor-actions"><button disabled={!selected.length} onClick={()=>{try{clipboard=copyStepGroup(doc,selected);setCount(clipboard.nodes.length);setMessage(`Copied ${clipboard.nodes.length} steps, including required inputs.`)}catch(error){setMessage(String(error instanceof Error?error.message:error))}}}>Copy selected steps</button><button disabled={!clipboard} onClick={()=>{if(clipboard)editor.command('Paste processing group',current=>pasteStepGroup(current,clipboard!,[...registry.types.values()]))}}>Paste copied steps</button></div>
  <p role="status">{message||`${count} steps in the internal clipboard. It is cleared when the page closes.`}</p>
 </details>
}
export function EditHistory(){
 return <details className="edit-history"><summary>Edit history</summary><p>Restore an earlier state or return to a later one. A new edit after restoring an older state starts a new history branch.</p><ol className="step-list">{editor.historyItems().map((item,index)=><li key={index}><button disabled={item.current} aria-current={item.current?'step':undefined} aria-label={`Restore history state ${index}: ${item.label}`} onClick={()=>editor.jumpHistory(index)}>{item.label.replace(/_/g,' ')}{item.current?' · Current':''}</button></li>)}</ol></details>
}
