import {useState} from 'react'

const KEY='stencil-studio.sidebar-width'
const clamp=(width:number)=>Math.min(440,Math.max(268,width))
export function initialSidebarWidth(){try{const width=Number(localStorage.getItem(KEY));return width>=268&&width<=440?width:312}catch{return 312}}
export default function SidebarResize({width,change}:{width:number;change:(width:number)=>void}){
 const [drag,setDrag]=useState(false)
 const set=(value:number)=>{const next=clamp(value);change(next);try{localStorage.setItem(KEY,String(next))}catch{}}
 return <div className={`sidebar-resize${drag?' dragging':''}`} style={{right:width-4}} role="separator" tabIndex={0} aria-label="Resize quick settings" aria-orientation="vertical" aria-valuemin={268} aria-valuemax={440} aria-valuenow={width} title="Drag or use Left/Right arrows to resize quick settings; Home resets the width" onPointerDown={e=>{setDrag(true);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag)set(e.currentTarget.parentElement!.getBoundingClientRect().right-e.clientX)}} onPointerUp={()=>setDrag(false)} onPointerCancel={()=>setDrag(false)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();set(e.key==='Home'?312:e.key==='End'?440:width+(e.key==='ArrowLeft'?16:-16))}}}/>
}
