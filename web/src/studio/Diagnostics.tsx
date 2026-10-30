import {useEffect,useState} from 'react'
import {api,engineStatus} from '../api'
import {controller,download,useEditor} from './session'
import type {ProjectDocument} from './project'
import {operations} from './project'
import type {ParameterRegistry} from './registry'

export default function Diagnostics({doc,registry,review}:{doc:ProjectDocument|null;registry:ParameterRegistry;review:(id:string)=>void}){
 const run=useEditor(s=>s.run),[open,setOpen]=useState(false),[engine,setEngine]=useState<{n:number;why:string;version:string}|null>(null),[frames,setFrames]=useState({perSecond:0,maxGapMs:0,pageHeapBytes:null as number|null})
 useEffect(()=>{if(!open)return;let alive=true;void api.threads().then(value=>{if(alive)setEngine(value)}).catch(()=>{});return()=>{alive=false}},[open,run.generation])
 useEffect(()=>{
  if(!open)return;let request=0,last=0,start=0,count=0,max=0
  const frame=(now:number)=>{if(last)max=Math.max(max,now-last);last=now;start||=now;count++;if(now-start>=1000){const memory=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;setFrames({perSecond:count*1000/(now-start),maxGapMs:max,pageHeapBytes:memory?.usedJSHeapSize??null});start=now;count=0}request=requestAnimationFrame(frame)}
  request=requestAnimationFrame(frame);return()=>cancelAnimationFrame(request)
 },[open])
 const ops=doc?operations(doc):[],storage=api.storageStatus(),eta=run.status==='running'&&run.progress>.1&&run.progress<.95?(run.elapsedMs??0)*(1-run.progress)/run.progress:null
 const report=()=>({schema:1,app:__BUILD__,engine,storage,uiSamples:frames,worker:engineStatus(),generation:run.generation,status:run.status,quality:run.quality,outputMatchesCurrent:controller.exportable,elapsedMs:run.elapsedMs??0,error:run.error,failedStep:run.failedStep,steps:run.steps??{},log:run.logs??[],lastOutputGeneration:run.output?.generation??null,outputs:run.output?.value.artifacts.map(a=>({step:a.step,kind:a.kind,info:a.info,mesh:a.mesh,findings:a.findings,parts:a.parts?.map(p=>({name:p.name,mesh:p.mesh,error:p.error}))}))??[]})
 return <details className="engine-diagnostics" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Engine diagnostics and reports</summary>
  <p>Application {__BUILD__.version} · build {__BUILD__.build} · {__BUILD__.commit}. {engine?`Engine ${engine.version} · ${engine.n} threads · ${engine.why}.`:'Reading local engine status…'}</p>
  <p>{registry.types.size} processing types · {registry.settings.length} qualified settings. Generation {run.generation} · {run.status} · {run.quality} quality. {controller.exportable?'Output matches the current completed generation.':'Current settings do not have a completed full-quality output.'}</p>
  <p>Total processing and validation: {((run.elapsedMs??0)/1000).toFixed(2)} s.{eta!==null?` Approximate remaining processing time: ${(eta/1000).toFixed(0)} s.`:''} Estimates change with operation complexity and caching.</p>
  <p>Session image cache: {(storage.sessionBytes/1048576).toFixed(1)} / {(storage.sessionLimitBytes/1048576).toFixed(0)} MB. {storage.persistentAvailable?'No image-storage failure observed.':'Persistent image storage is unavailable. Keep this window open and Save Project.'}</p>
  <p>UI samples while this panel is open: {frames.perSecond.toFixed(0)} animation frames/s · longest sampled gap {frames.maxGapMs.toFixed(1)} ms{frames.pageHeapBytes!==null?` · page JavaScript heap estimate ${(frames.pageHeapBytes/1048576).toFixed(1)} MB`:''}. These are browser samples, not CPU usage or total worker memory.</p>
  {run.failedStep&&<button onClick={()=>review(run.failedStep!)}>Review failed operation</button>}
  {Object.keys(run.steps??{}).length>0&&<div className="diagnostic-table"><table><thead><tr><th>Operation</th><th>Result</th><th>Time</th></tr></thead><tbody>{Object.entries(run.steps??{}).map(([id,state])=><tr key={id}><td>{registry.types.get(ops.find(op=>op.id===id)?.type??'')?.label??id}<small>{id}</small></td><td>{state.error??state.state}{state.cached?' · cached':''}</td><td>{state.ms==null?'—':`${state.ms.toFixed(1)} ms`}</td></tr>)}</tbody></table></div>}
  <button onClick={()=>download(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}),'stencil-diagnostics.json')}>Download diagnostic report JSON</button>
  {!!run.logs?.length&&<details><summary>Processing activity log ({run.logs.length})</summary><ol className="processing-log" aria-label="Processing activity log">{run.logs.map((line,index)=><li key={index}><time>{line.ts}</time> · {line.node} · {line.msg}{line.ms==null?'':` · ${line.ms} ms`}</li>)}</ol><p>The latest 500 log lines are retained for this generation.</p></details>}
 </details>
}
