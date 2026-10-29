import {useEffect,useMemo,useRef,useState} from 'react'
import type {ArtifactSet} from './artifacts'
import type {ProjectDocument} from './project'
import {makeExportPlan,buildExportPackage,packageFilename,type ExportPlan} from './exportPlan'

export function defaultExportRoots(doc:ProjectDocument,set:ArtifactSet,id:string){
 const step=set.artifacts.find(a=>a.id===id)?.step
 const assembly=doc.raw.stencilStudio?.colourAssemblies?.find((a:any)=>a.id===step)
 if(assembly){const layers=doc.raw.stencilStudio.colourLayers??[],split=layers.find((l:any)=>assembly.layers.includes(l.plate))?.split
  return (doc.raw.stencilStudio.colourAssemblies??[]).filter((a:any)=>a.layers.some((p:string)=>layers.some((l:any)=>l.plate===p&&l.split===split))).map((a:any)=>set.artifacts.find(f=>f.step===a.id&&f.kind==='parts')?.id).filter(Boolean) as string[]}
 return [id]
}
export function useExportPackage(plan:ExportPlan|null,current:boolean):{url?:string;error?:string;progress?:string;manifest?:any}{
 const [state,setState]=useState<{plan:ExportPlan;url?:string;error?:string;progress?:string;manifest?:any}>()
 useEffect(()=>{if(!plan||!current)return;const abort=new AbortController();let url='',timer=setTimeout(()=>{
  setState({plan,progress:'Preparing the manufacturing package…'})
  void buildExportPackage(plan,abort.signal,message=>{if(!abort.signal.aborted)setState({plan,progress:message})}).then(result=>{
   url=result.url;if(abort.signal.aborted)URL.revokeObjectURL(url);else setState({plan,url,manifest:result.manifest})
  }).catch(error=>{if(!abort.signal.aborted)setState({plan,error:String(error instanceof Error?error.message:error)})})
 },180);return()=>{clearTimeout(timer);abort.abort();if(url)URL.revokeObjectURL(url)}},[plan,current])
 return current&&state?.plan===plan?state:{}
}
export function useDefaultPackage(doc:ProjectDocument|null,set:ArtifactSet|undefined,id:string|undefined,current:boolean){
 const plan=useMemo(()=>doc&&set&&id?makeExportPlan(doc,set,defaultExportRoots(doc,set,id)):null,[doc,set,id])
 return useExportPackage(plan,current)
}
export default function ExportPanel({doc,set,initial,current,close}:{doc:ProjectDocument;set:ArtifactSet;initial:string;current:boolean;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[roots,setRoots]=useState(()=>defaultExportRoots(doc,set,initial)),[excluded,setExcluded]=useState<string[]>([]),[layouts,setLayouts]=useState(false),[outlines,setOutlines]=useState(false),[project,setProject]=useState(true)
 const plan=useMemo(()=>makeExportPlan(doc,set,roots,{layouts,outlines,project,excluded}),[doc,set,roots,layouts,outlines,project,excluded]),ready=useExportPackage(plan,current&&plan.complete)
 useEffect(()=>{dialog.current!.showModal();return()=>dialog.current?.close()},[])
 const toggle=(id:string)=>setRoots(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id])
 const sharedPaths=new Map<string,string>();for(const f of ready.manifest?.files??[])for(const alias of f.also_used_by??[])sharedPaths.set(alias.requested_path,f.path)
 return <dialog ref={dialog} className="export-dialog" aria-labelledby="export-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===dialog.current)close()}}>
  <header><div><h2 id="export-title">Manufacturing export</h2><p>Collect the selected plates and their upstream parts.</p></div><button aria-label="Close export planner" onClick={close}>×</button></header>
  <div className="export-body"><fieldset><legend>Assemblies and colour passes</legend>{set.artifacts.map(a=><label className="toggle-field" key={a.id}><span>{doc.raw.stencilStudio?.passNames?.[a.step]??a.label}{set.artifacts.filter(b=>b.label===a.label).length>1?` · Pass ${set.artifacts.filter(b=>b.label===a.label).findIndex(b=>b.id===a.id)+1}`:''}{a.intermediate?' · Intermediate':''}</span><input type="checkbox" aria-label={`Include assembly ${a.step} ${a.kind}`} checked={roots.includes(a.id)} onChange={()=>toggle(a.id)}/></label>)}</fieldset>
  <details><summary>Optional preparation files</summary><label className="toggle-field"><span>Layout previews PNG</span><input type="checkbox" checked={layouts} onChange={e=>setLayouts(e.target.checked)}/></label><label className="toggle-field"><span>Traced outlines SVG before bridges</span><input type="checkbox" checked={outlines} onChange={e=>setOutlines(e.target.checked)}/></label><label className="toggle-field"><span>Original project and artwork</span><input type="checkbox" checked={project} onChange={e=>setProject(e.target.checked)}/></label></details>
  <p role="status">{!current?'Settings changed. Make Stencil before exporting.':plan.complete?'Complete for the selected generated assemblies.':'Incomplete: select an assembly and retain every required printable part.'}</p>
  <p>Copies are listed where the engine determines them. Review unspecified quantities for your installation. One STL may contain several separate alignment pins.</p>
  {!!sharedPaths.size&&<p>Shared upstream parts are stored once. The manifest records every assembly using them.</p>}
  <div className="export-table-wrap"><table><thead><tr><th>Include / file</th><th>Assembly / purpose</th><th>Dimensions (mm)</th><th>Copies</th><th>Verification</th></tr></thead><tbody>{plan.files.map(f=><tr key={f.key}><td><label><input type="checkbox" aria-label={`Include file ${f.path}`} checked={f.selected} onChange={e=>setExcluded(old=>e.target.checked?old.filter(k=>k!==f.key):[...old,f.key])}/>{f.path}</label>{sharedPaths.has(f.path)&&<small>Shared file in ZIP: {sharedPaths.get(f.path)}</small>}{f.selected&&f.url&&current&&(!f.required||!f.error&&f.mesh?.closed)&&<a href={f.url} download={f.name}>Save individual file</a>}</td><td>{f.assembly}<small>{f.role}{f.replaces.length?` · Replaces ${f.replaces.join(', ')}`:''}</small></td><td>{f.mesh?.size.map(v=>v.toFixed(2)).join(' × ')??'—'}</td><td>{f.quantity??'Review'}</td><td>{f.error??(f.mesh?`${f.mesh.closed?'Closed and oriented':'Blocked'} · ${f.mesh.triangles.toLocaleString()} faces · ${f.mesh.components} components`:'Preparation file')}</td></tr>)}</tbody></table></div>
  {plan.missing.map((s,i)=><p role="alert" key={i}>{s}</p>)}{ready.error&&<p role="alert">{ready.error}</p>}
  {!!plan.warnings.length&&<details><summary>Manufacturing notes ({plan.warnings.length})</summary><ul>{plan.warnings.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}
  </div><footer><span>{ready.progress??`${ready.manifest?ready.manifest.files.filter((f:any)=>f.geometry).length:plan.files.filter(f=>f.selected&&f.required).length} ${ready.manifest?'unique':'selected'} STL files · CRC-protected ZIP`}</span><a role="link" tabIndex={ready.url?0:-1} className={`primary-button${!ready.url?' disabled':''}`} aria-disabled={!ready.url} href={ready.url} download={packageFilename(doc)} onClick={e=>{if(!ready.url)e.preventDefault()}}>Download manufacturing ZIP</a></footer>
 </dialog>
}
