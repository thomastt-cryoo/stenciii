import {useEffect,useRef,useState} from 'react'
import {ArtworkPreviewClient} from './artworkPreview'
import {compileRecipe,signature,type ProjectDocument} from './project'

function imageInput(doc:ProjectDocument,step:string){
 const graph=compileRecipe(doc),seen=new Set<string>(),queue=graph.edges.filter(e=>e.to[0]===step).map(e=>e.from[0])
 while(queue.length){const id=queue.shift()!;if(seen.has(id))continue;seen.add(id);const node=graph.nodes.find(n=>n.id===id);if(node&&['source','transform','reduce'].includes(node.type))return id;queue.push(...graph.edges.filter(e=>e.to[0]===id).map(e=>e.from[0]))}
 return null
}
function preferences(){try{const raw=JSON.parse(localStorage.getItem('studio.imageview')??'{}'),state=raw.state??raw;return{overlay:state.overlay===true,opacity:Number.isFinite(state.opacity)?Math.max(.1,Math.min(1,state.opacity)):.6}}catch{return{overlay:false,opacity:.6}}}
export default function StageImage({doc,step,port,draft,zoom=1,fit=0,caption=true}:{doc:ProjectDocument;step:string;port:string;draft:boolean;zoom?:number;fit?:number;caption?:boolean}){
 const client=useRef<ArtworkPreviewClient>(),ticket=useRef(0),urls=useRef<string[]>([])
 const [result,setResult]=useState<{url:string;info:any;request:string;under?:string;overlayNote?:string}>(),[busy,setBusy]=useState(true),[error,setError]=useState(''),[pan,setPan]=useState({x:0,y:0}),[prefs,setPrefs]=useState(preferences)
 const drag=useRef<{x:number;y:number}>(),key=signature(doc),request=JSON.stringify([key,step,port,draft]),matches=result?.request===request,ready=!!matches&&!busy&&!error
 useEffect(()=>{client.current=new ArtworkPreviewClient();return()=>{ticket.current++;client.current?.dispose();urls.current.forEach(URL.revokeObjectURL)}},[])
 useEffect(()=>{
  const mine=++ticket.current;setBusy(true);setError('')
  const timer=setTimeout(()=>{void(async()=>{
   const next=await client.current!.render(doc,step,port,draft),owned=[next.url];let under:string|undefined,overlayNote:string|undefined
   if(next.info.kind==='mask'){
    const input=imageInput(doc,step)
    if(input)try{const image=await client.current!.render(doc,input,'image',draft);owned.push(image.url);if(image.info.width===next.info.width&&image.info.height===next.info.height)under=image.url;else overlayNote='Image overlay is unavailable because these working dimensions differ.'}catch{overlayNote='The image input could not be displayed as an overlay.'}
   }
   if(mine!==ticket.current){owned.forEach(URL.revokeObjectURL);return}
   urls.current.forEach(URL.revokeObjectURL);urls.current=owned;setResult({...next,request,under,overlayNote});setBusy(false)
  })().catch(e=>{if(mine===ticket.current){setError(e.message);setBusy(false)}})},draft?120:300)
  return()=>{clearTimeout(timer);ticket.current++}
 },[key,step,port,draft])
 useEffect(()=>setPan({x:0,y:0}),[fit,step,port])
 const change=(patch:Partial<typeof prefs>)=>{const next={...prefs,...patch};setPrefs(next);try{localStorage.setItem('studio.imageview',JSON.stringify({state:next,version:0}))}catch{}}
 const transform=`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,overlay=ready&&!!result?.under&&prefs.overlay
 return <div className="stage-image" data-ready={ready} data-source-overlay={overlay} onPointerDown={e=>{drag.current={x:e.clientX-pan.x,y:e.clientY-pan.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag.current)setPan({x:e.clientX-drag.current.x,y:e.clientY-drag.current.y})}} onPointerUp={()=>{drag.current=undefined}} onPointerCancel={()=>{drag.current=undefined}}>
  {overlay&&<img className="stage-underlay" alt="Aligned image input beneath the paint mask" draggable={false} src={result!.under} style={{transform}}/>}
  {result&&<img alt="Actual processed artwork" draggable={false} src={result.url} style={{transform,opacity:overlay?prefs.opacity:1}}/>}
  {caption&&<span className="stage-state">{error||(busy||!matches?'Previous artwork · Updating':draft?'Draft artwork preview':'Full-resolution artwork preview')}{result&&ready&&` · ${result.info.width} × ${result.info.height} px`}</span>}
  {result&&ready&&result.under&&<div className="stage-overlay-controls" onPointerDown={e=>e.stopPropagation()}><label><input type="checkbox" aria-label="Paint mask over image input" checked={prefs.overlay} onChange={e=>change({overlay:e.target.checked})}/>Over image input</label>{prefs.overlay&&<label>Mask opacity<input type="range" aria-label="Paint mask opacity" min=".1" max="1" step=".05" value={prefs.opacity} onChange={e=>change({opacity:Number(e.target.value)})}/></label>}</div>}
  {result&&ready&&result.overlayNote&&<span className="stage-overlay-note">{result.overlayNote}</span>}
  {result&&ready&&!draft&&<a className="stage-download" href={result.url} download={`${step}-${port}.${result.info.kind==='shapes'?'svg':'png'}`} onPointerDown={e=>e.stopPropagation()}>Save artwork preview</a>}
 </div>
}

