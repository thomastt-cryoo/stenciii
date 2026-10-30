import {embedAvailableOriginals} from './availableOriginals'
import {useEffect,useMemo,useRef,useState} from 'react'
import {compileRecipe,copy,openDocument,projectName,type ProjectDocument} from './project'
import type {ParameterRegistry} from './registry'
import {safeSegment} from './exportPlan'
import {PACKAGE_LIMIT} from './zip'
import {writeZip} from './zipClient'
import {BATCH_LIMITS,defaultBatchOptions,planBatch,variationFields,type BatchVariation,type BatchOptions} from './batchPlan'
import {executeBatchJob,batchSummary,batchCsv,type BatchRow} from './batchRunner'
import BatchVariations from './BatchVariations'

interface Task {id:number;abort:AbortController;rows:BatchRow[];entries:{name:string;bytes:ArrayBuffer}[];bytes:number;snapshot:ProjectDocument;source:string;options:BatchOptions}
export default function BatchWorkbench({doc,registry}:{doc:ProjectDocument|null;registry:ParameterRegistry}){
 const [recipe,setRecipe]=useState(doc),[recipeMode,setRecipeMode]=useState<'current'|'file'>('current'),[recipeName,setRecipeName]=useState('Current project')
 const [source,setSource]=useState(''),[files,setFiles]=useState<File[]>([]),[variations,setVariations]=useState<BatchVariation[]>([]),[options,setOptions]=useState<BatchOptions>(defaultBatchOptions)
 const [readingRecipe,setReadingRecipe]=useState(false)
 const [rows,setRows]=useState<BatchRow[]>([]),[running,setRunning]=useState(false),[packing,setPacking]=useState(false)
 const [collection,setCollection]=useState(''),[jsonUrl,setJsonUrl]=useState(''),[csvUrl,setCsvUrl]=useState(''),[message,setMessage]=useState(''),[inputNote,setInputNote]=useState('')
 const [progress,setProgress]=useState({job:0,total:0,done:0,stages:1,stage:''}),[compareBy,setCompareBy]=useState('order')
 const imageFiles=useRef<HTMLInputElement>(null),directoryFiles=useRef<HTMLInputElement|null>(null)
 const task=useRef<Task|null>(null),epoch=useRef(0),recipeImport=useRef(0),urls=useRef<string[]>([]),variationId=useRef(0)
 const resultConfig=useRef<{recipe:ProjectDocument;files:File[];variations:BatchVariation[];options:BatchOptions;source:string}|null>(null)
 const own=(bytes:ArrayBuffer|string,mime:string)=>{const url=URL.createObjectURL(new Blob([bytes],{type:mime}));urls.current.push(url);return url}
 const cancel=()=>{task.current?.abort.abort();setRunning(false);setPacking(false);setMessage('Batch cancelled. Verified completed results are kept.')}
 const chooseRecipe=(next:ProjectDocument|null,name:string)=>{recipeImport.current++;setReadingRecipe(false);task.current?.abort.abort();setRecipe(next);setRecipeName(name);setVariations([]);let ids:string[]=[];try{ids=next?compileRecipe(next).nodes.filter(n=>n.type==='source').map(n=>n.id):[]}catch{}setSource(ids.length===1?ids[0]:'')}
 useEffect(()=>{if(recipeMode==='current')chooseRecipe(doc,'Current project')},[doc])
 useEffect(()=>()=>{epoch.current++;recipeImport.current++;task.current?.abort.abort();urls.current.forEach(u=>URL.revokeObjectURL(u))},[])
 const sources=useMemo(()=>{try{return recipe?compileRecipe(recipe).nodes.filter(n=>n.type==='source'):[]}catch{return []}},[recipe])
 const fields=useMemo(()=>recipe?variationFields(recipe,registry):[],[recipe,registry])
 const planning=useMemo(()=>{try{return {jobs:recipe?planBatch(recipe,registry,files,source,variations):[],error:recipe?'':'Choose a saved project or use the current project.'}}catch(error){return {jobs:[],error:String(error instanceof Error?error.message:error)}}},[recipe,registry,files,source,variations])
 const acceptFiles=(selected:File[],folder=false)=>{const supported=folder?selected.filter(f=>/\.(png|jpe?g|bmp|svg)$/i.test(f.name)):selected;setFiles(supported);setInputNote(selected.length!==supported.length?`${selected.length-supported.length} non-image files excluded from the selected folder.`:'')}
 const setVariation=(id:number,patch:Partial<BatchVariation>)=>setVariations(old=>old.map(v=>v.id===id?{...v,...patch}:v))
 const addVariation=()=>{const field=fields.find(f=>!variations.some(v=>v.step===f.step&&v.parameter===f.parameter.name)&&f.parameter.name!=='image_id')??fields[0];if(!field)return;const p=field.parameter;setVariations(old=>[...old,{id:++variationId.current,step:field.step,parameter:p.name,mode:['int','float'].includes(p.kind)?'range':'list',start:String(p.default),end:String(p.default),increment:String(p.step??1),values:JSON.stringify(p.choices?.slice(0,2)??(p.kind==='bool'?[false,true]:[p.default]))}])}
 const reportLinks=(current:Task)=>{
  if(epoch.current!==current.id)return
  setJsonUrl(own(JSON.stringify(batchSummary(current.snapshot,current.source,current.options,current.rows),null,2),'application/json'))
  setCsvUrl(own(batchCsv(current.rows),'text/csv;charset=utf-8'))
 }
 const collect=async(current:Task)=>{
  if(!current.entries.length)return;setPacking(true)
  try{
   const entries=[...current.entries,{name:'batch-summary.json',bytes:new TextEncoder().encode(JSON.stringify(batchSummary(current.snapshot,current.source,current.options,current.rows),null,2)).buffer},{name:'batch-summary.csv',bytes:new TextEncoder().encode(batchCsv(current.rows)).buffer}]
   const bytes=await writeZip(entries,current.abort.signal)
   if(epoch.current===current.id&&!current.abort.signal.aborted)setCollection(own(bytes,'application/zip'))
  }catch(error){if(epoch.current===current.id)setMessage(current.abort.signal.aborted?'Collection cancelled. Save completed results individually or collect them again.':String(error instanceof Error?error.message:error))}
  finally{if(epoch.current===current.id)setPacking(false)}
 }
 const start=async()=>{
  if(!recipe||planning.error||!planning.jobs.length){setMessage(planning.error);return}
  task.current?.abort.abort();const id=++epoch.current;urls.current.forEach(u=>URL.revokeObjectURL(u));urls.current=[]
  setCollection('');setJsonUrl('');setCsvUrl('');setMessage('Starting local jobs…');setRunning(true);resultConfig.current={recipe,files,variations,options,source}
  const jobs=planning.jobs,current:Task={id,abort:new AbortController(),rows:jobs.map(j=>({id:j.id,name:j.name,relativePath:j.relativePath,overrides:j.overrides,status:'Queued'})),entries:[],bytes:0,snapshot:copy(recipe),source,options:{...options}}
  task.current=current;setRows([...current.rows])
  for(const [index,job]of jobs.entries()){
   if(current.abort.signal.aborted||epoch.current!==id)break
   current.rows[index]={...current.rows[index],status:'Processing'};setRows([...current.rows]);setProgress({job:index,total:jobs.length,done:0,stages:1,stage:'Preparing saved recipe'})
   setMessage(`Processing ${index+1} of ${jobs.length}: ${job.name}`);const began=performance.now()
   try{
    const result=await executeBatchJob(current.snapshot,job,current.source,registry,current.options,current.abort.signal,(done,total,stage)=>{if(epoch.current===id&&!current.abort.signal.aborted)setProgress({job:index,total:jobs.length,done,stages:Math.max(1,total),stage})})
    if(current.abort.signal.aborted||epoch.current!==id)break
    const entry=`${job.id}-${safeSegment(job.relativePath)}/manufacturing.${result.extension}`
    if(current.bytes+result.bytes.byteLength+512*1024>PACKAGE_LIMIT)throw Error('The 256 MB browser collection budget is full. Use fewer jobs or lower detail. This result was not retained.')
    current.bytes+=result.bytes.byteLength;current.entries.push({name:entry,bytes:result.bytes})
    current.rows[index]={...current.rows[index],status:'Verified',url:own(result.bytes,result.extension==='zip'?'application/zip':'model/stl'),downloadName:`${job.id}-${safeSegment(job.name)}-manufacturing.${result.extension}`,milliseconds:performance.now()-began,metrics:result.metrics,findings:result.findings}
   }catch(error){if(current.abort.signal.aborted||epoch.current!==id)break;current.rows[index]={...current.rows[index],status:'Failed',error:String(error instanceof Error?error.message:error),milliseconds:performance.now()-began}}
   if(epoch.current===id)setRows([...current.rows])
  }
  if(epoch.current!==id)return
  current.rows=current.rows.map(r=>['Queued','Processing'].includes(r.status)?{...r,status:'Cancelled'}:r);setRows([...current.rows]);reportLinks(current)
  const verified=current.rows.filter(r=>r.status==='Verified').length,failed=current.rows.filter(r=>r.status==='Failed').length
  setProgress(p=>({...p,job:jobs.length,done:1,stages:1}));setMessage(current.abort.signal.aborted?`Cancelled. ${verified} verified results kept.`:`Finished ${jobs.length} jobs: ${verified} verified, ${failed} failed. Each failure is isolated.`)
  if(!current.abort.signal.aborted)await collect(current)
  if(epoch.current===id)setRunning(false)
 }
 const downloadCompleted=async()=>{const current=task.current;if(!current)return;current.abort=new AbortController();await collect(current)}
 const displayed=[...rows].sort((a,b)=>compareBy==='time'?(a.milliseconds??Infinity)-(b.milliseconds??Infinity):compareBy==='triangles'?(a.metrics?.triangles??Infinity)-(b.metrics?.triangles??Infinity):compareBy==='seam'?(a.metrics?.seamStepMm??Infinity)-(b.metrics?.seamStepMm??Infinity):0)
 const directoryAvailable=typeof document!=='undefined'&&'webkitdirectory'in document.createElement('input')
 const previous=rows.length>0&&resultConfig.current&&(resultConfig.current.recipe!==recipe||resultConfig.current.files!==files||resultConfig.current.variations!==variations||resultConfig.current.options!==options||resultConfig.current.source!==source)
 return <section className="batch-workbench" aria-label="Batch Processing">
  <h4>Batch Processing</h4><p>Run saved artwork or up to 20 local images with a frozen recipe. Variations make every selected combination, up to 128 jobs, one at a time on this device. Keep this workspace open; closing it or editing the current project cancels an active run.</p>
  <fieldset disabled={running||packing}><legend>Recipe and artwork</legend>
   <div className="editor-actions"><button disabled={!doc} onClick={()=>{setRecipeMode('current');chooseRecipe(doc,'Current project')}}>Use current project</button><label className="file-control">Choose saved project<input aria-label="Batch saved project" disabled={readingRecipe} type="file" accept=".json" onChange={async e=>{
    const file=e.target.files?.[0];e.currentTarget.value='';if(!file)return;const mine=++recipeImport.current;setReadingRecipe(true);setMessage('Reading the saved recipe and available original artwork…')
    try{if(file.size>BATCH_LIMITS.recipeBytes)throw Error('The saved project exceeds the 100 MB import limit.');const next=openDocument(JSON.parse(await file.text()));if(!await embedAvailableOriginals(next,()=>mine===recipeImport.current))return;setRecipeMode('file');chooseRecipe(next,file.name);setMessage('Saved recipe loaded. The main project is unchanged.')}catch(error){if(mine===recipeImport.current)setMessage(String(error instanceof Error?error.message:error))}finally{if(mine===recipeImport.current)setReadingRecipe(false)}
   }}/></label></div>
   <p>Recipe: {recipeName}{recipe?` · ${projectName(recipe)}`:''}</p>
   <label>Artwork source<select aria-label="Batch artwork source" value={source} onChange={e=>setSource(e.target.value)}><option value="">{files.length?'Choose the source to replace…':'Use saved artwork'}</option>{sources.map(n=><option key={n.id} value={n.id}>{String(recipe?.raw.images?.[String(n.params.image_id)]?.name??n.id)} · {n.id}</option>)}</select></label>
   <label>Choose images<input ref={imageFiles} aria-label="Batch local images" type="file" multiple accept=".png,.jpg,.jpeg,.bmp,.svg" onChange={e=>acceptFiles(Array.from(e.target.files??[]))}/></label>
   {directoryAvailable?<label>Choose an image folder<input aria-label="Batch image folder" type="file" multiple ref={element=>{directoryFiles.current=element;element?.setAttribute('webkitdirectory','')}} onChange={e=>acceptFiles(Array.from(e.target.files??[]),true)}/></label>:<p>Folder selection is unavailable in this browser. Use Choose images to select multiple local files.</p>}
   <p>{files.length?`${files.length} images selected. Only the chosen source is replaced; other originals are kept.`:'No replacement images selected. Runs use the artwork embedded in the saved recipe.'} {inputNote}</p>
   {!!files.length&&<button onClick={()=>{setFiles([]);setInputNote('');if(imageFiles.current)imageFiles.current.value='';if(directoryFiles.current)directoryFiles.current.value=''}}>Use saved artwork instead</button>}
  </fieldset>
  <BatchVariations fields={fields} variations={variations} disabled={running||packing} images={Object.entries<any>(recipe?.raw.images??{}).map(([value,asset])=>({value,label:String(asset.name??value)}))} change={setVariation} remove={id=>setVariations(old=>old.filter(v=>v.id!==id))} add={addVariation}/>
  <details><summary>Output settings</summary><fieldset disabled={running||packing}>
   <label>Output format<select aria-label="Batch output format" value={options.format} onChange={e=>setOptions({...options,format:e.target.value as BatchOptions['format']})}><option value="zip">Manufacturing ZIP · complete assemblies</option><option value="stl">Single STL · recipes producing one printable file</option></select></label>
   {options.format==='stl'&&<p>Single STL contains geometry. Choose ZIP to include the saved project and preparation files.</p>}
   {options.format==='zip'&&<p>Layout PNGs and outline SVGs are included only when this recipe generates those preparation results. Outlines describe the artwork before physical bridge corrections.</p>}
   {(['project','layouts','outlines','strict'] as const).map(key=><label className="toggle-field" key={key}><span>{{project:'Include project and original artwork',layouts:'Include actual layout PNG',outlines:'Include outlines SVG before bridges',strict:'Require warning-free readiness'}[key]}</span><input type="checkbox" disabled={key!=='strict'&&options.format==='stl'} checked={options[key]} onChange={e=>setOptions({...options,[key]:e.target.checked})}/></label>)}
  </fieldset></details>
  <p className="batch-workload" role="status">{planning.error||`${planning.jobs.length} jobs planned · sequential processing · up to 256 MB of collected output.`}</p><p>Large images, detailed meshes and hardware can take longer. Failed jobs stay in the summary and do not replace verified results.</p>
  <div className="editor-actions"><button disabled={running||packing||readingRecipe||!!planning.error||!planning.jobs.length} onClick={()=>void start()}>Run local batch</button>{(running||packing)&&<button onClick={cancel}>Cancel batch</button>}{collection&&<a href={collection} download="stencil-batch.zip">Download batch collection</a>}{!collection&&!running&&!packing&&rows.some(r=>r.status==='Verified')&&<button onClick={()=>void downloadCompleted()}>Collect completed results</button>}</div>
  {(running||packing)&&<div className="batch-progress"><label>Overall progress<progress max={Math.max(1,progress.total)} value={Math.min(progress.total,progress.job+Math.min(1,progress.done/progress.stages))}/></label><label>Current job · {progress.stage}<progress max={progress.stages} value={progress.done}/></label></div>}
  <p role="status">{message}</p>
  {(jsonUrl||csvUrl)&&<div className="editor-actions">{jsonUrl&&<a href={jsonUrl} download="stencil-batch-summary.json">Download JSON summary</a>}{csvUrl&&<a href={csvUrl} download="stencil-batch-summary.csv">Download CSV summary</a>}</div>}
  {!!rows.length&&<>
   {previous&&<p>These results use the previous frozen recipe and settings. Start a new run to apply your changes.</p>}
   <label>Compare results<select aria-label="Compare batch results" value={compareBy} onChange={e=>setCompareBy(e.target.value)}><option value="order">Job order</option><option value="time">Processing time</option><option value="triangles">Triangle count</option><option value="seam">Seam difference</option></select></label>
   <ol className="batch-results">{displayed.map(r=><li key={r.id}>
    <b>{r.name} · {r.status}</b><small>{r.relativePath} · Job {r.id}{r.overrides.length?` · ${r.overrides.map(o=>`${o.label}: ${String(o.value)}`).join('; ')}`:''}</small>
    {r.error&&<p role="alert">{r.error}</p>}{r.metrics&&<p>{r.metrics.stlFiles} STL files · {r.metrics.triangles.toLocaleString()} triangles · {r.metrics.volumeMm3.toFixed(3)} mm³ · maximum part extents by axis {r.metrics.sizeMm.map(v=>v.toFixed(2)).join(' × ')} mm · {((r.milliseconds??0)/1000).toFixed(2)} s{r.metrics.seamStepMm!==null?` · seam difference ${r.metrics.seamStepMm} mm`:''}</p>}
    {!!r.findings?.length&&<details><summary>Readiness notes</summary><ul>{r.findings.map((f,i)=><li key={i}>{f.text}</li>)}</ul></details>}{r.url&&<a href={r.url} download={r.downloadName}>Save verified result</a>}
   </li>)}</ol>
  </>}
  <details><summary>Batch limits and diagnostics</summary><p>Choose up to 20 images and 128 MB combined input, with a 64 MB per-image limit. Parameter combinations are limited to 128 jobs. Collection size is limited to 256 MB and every STL to two million triangles for verification. Supported image formats: PNG, JPEG, BMP and SVG.</p><p>Folder access is limited to the files selected in the browser picker. The multiple-image picker is the fallback. Each job uses the actual saved engine recipe and the same independent mesh checks and complete-assembly export rules as ordinary processing. Outputs and summaries remain local. Save completed results before closing this workspace; jobs do not continue after it or the application closes.</p></details>
 </section>
}
