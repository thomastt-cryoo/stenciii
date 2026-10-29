import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ArtworkComparison } from './artifacts'
import { reducedDisplay } from './displayMesh'
type View='iso'|'top'|'bottom'|'left'|'right'|'front'|'back'
type Options={view:View;wire:boolean;shading:string;detail:string;cut:string;height:number;heights:boolean}
export default function MeshPreview({url,flat,zoom,fit,theme,onZoom,comparison,stats={}}:{url:string;flat:boolean;zoom:number;fit:number;theme:string;onZoom:(v:number)=>void;comparison?:ArtworkComparison;stats?:Record<string,any>}){
 const host=useRef<HTMLDivElement>(null),cameraRef=useRef<THREE.OrthographicCamera>(),applyRef=useRef<()=>void>(),presetRef=useRef<(v:View)=>void>()
 const remembered=useRef<{position:number[];target:number[];up:number[];flat:boolean}>(),reset=useRef(fit)
 const [options,setOptions]=useState<Options>({view:'iso',wire:false,shading:'smooth',detail:'auto',cut:'full',height:0,heights:false}),optionRef=useRef(options)
 const [bounds,setBounds]=useState({height:1,triangles:0}),[readyUrl,setReadyUrl]=useState(''),[error,setError]=useState('')
 const [ratio,setRatio]=useState(.5),ratioRef=useRef(.5),layer=Number(stats.layer_height_mm)||.2
 const request=JSON.stringify([url,flat,fit,theme,comparison?.url,layer]),ready=readyUrl===request&&!error
 useEffect(()=>{optionRef.current=options;applyRef.current?.()},[options])
 useEffect(()=>{ratioRef.current=ratio},[ratio])
 useEffect(()=>{
  const el=host.current!;let renderer:THREE.WebGLRenderer
  setReadyUrl('');setError('')
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch{setError('3D rendering is unavailable. The verified STL remains downloadable.');return}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.localClippingEnabled=true
  const scene=new THREE.Scene(),artwork=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100000),controls=new OrbitControls(camera,renderer.domElement)
  camera.zoom=zoom;cameraRef.current=camera;controls.enableRotate=!flat;controls.enableDamping=true;controls.minZoom=.25;controls.maxZoom=5
  controls.addEventListener('change',()=>onZoom(camera.zoom))
  scene.add(new THREE.HemisphereLight(0xffffff,0x696969,2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(-1,2,5);scene.add(light)
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',comparison?'Aligned prepared artwork and generated STL comparison':flat?'Stencil top view from generated STL':'Interactive 3D stencil from generated STL');el.appendChild(renderer.domElement)
  const resources:{dispose():void}[]=[];let alive=true,radius=1,mesh:THREE.Mesh|undefined,full:THREE.BufferGeometry|undefined,smooth:THREE.BufferGeometry|undefined,reduced:THREE.BufferGeometry|undefined,height=1,moving=false,endTimer:ReturnType<typeof setTimeout>|undefined
  const material=flat?new THREE.MeshBasicMaterial({color:theme==='dark'?0xededeb:0x444441,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:0xd5d5d0,roughness:.85,metalness:0,side:THREE.DoubleSide});resources.push(material)
  function colour(g:THREE.BufferGeometry){if(g.getAttribute('color'))return;const p=g.getAttribute('position'),c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const grey=.25+.7*(p.getZ(i)+height/2)/Math.max(height,.001);c.fill(grey,i*3,i*3+3)}g.setAttribute('color',new THREE.BufferAttribute(c,3))}
  const apply=()=>{
   if(!mesh||!full)return;const o=optionRef.current,low=!flat&&(o.detail==='reduced'||o.detail==='auto'&&moving&&full.getAttribute('position').count>180000)
   if(low&&!reduced){reduced=reducedDisplay(full);resources.push(reduced)}
   if(!flat&&o.shading==='smooth'&&!low&&!smooth){smooth=toCreasedNormals(full,Math.PI/3);resources.push(smooth)}
   mesh.geometry=low?reduced!:!flat&&o.shading==='smooth'?smooth!:full
   material.wireframe=!flat&&o.wire;material.vertexColors=!flat&&o.heights
   if(material.vertexColors)colour(mesh.geometry)
   if(material instanceof THREE.MeshStandardMaterial)material.flatShading=o.shading==='flat'
   const h=Math.min(height,Math.max(0,o.height)),planes:THREE.Plane[]=[]
   if(!flat&&o.cut!=='full'){
    const top=o.cut==='layer'?Math.min(height,(Math.floor((h+1e-7)/layer)+1)*layer):h
    planes.push(new THREE.Plane(new THREE.Vector3(0,0,-1),top-height/2+1e-6))
    if(o.cut==='layer')planes.push(new THREE.Plane(new THREE.Vector3(0,0,1),-(Math.floor((h+1e-7)/layer)*layer-height/2)+1e-6))
   }
   material.clippingPlanes=planes;material.needsUpdate=true
  };applyRef.current=apply
  const preset=(v:View)=>{
   const positions:Record<View,number[]>={iso:[1.1,-1.5,2.4],top:[0,0,4],bottom:[0,0,-4],left:[-4,0,0],right:[4,0,0],front:[0,-4,0],back:[0,4,0]}
   const p=positions[v];camera.position.set(p[0]*radius,p[1]*radius,p[2]*radius);camera.up.set(0,v==='top'||v==='bottom'?1:0,v==='top'||v==='bottom'?0:1);controls.target.set(0,0,0);controls.update()
  };presetRef.current=preset
  controls.addEventListener('start',()=>{moving=true;clearTimeout(endTimer);apply()});controls.addEventListener('end',()=>{endTimer=setTimeout(()=>{moving=false;apply()},160)})
  const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight),aspect=w/h,vertical=radius*1.3/Math.min(1,aspect);renderer.setSize(w,h);camera.left=-vertical*aspect;camera.right=vertical*aspect;camera.top=vertical;camera.bottom=-vertical;camera.updateProjectionMatrix()}
  const observer=new ResizeObserver(resize);observer.observe(el)
  new STLLoader().load(url,g=>{
   if(!alive){g.dispose();return}resources.push(g);g.computeBoundingBox();g.computeVertexNormals()
   const box=g.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());height=size.z;radius=Math.max(size.x,size.y,size.z)/2
   g.translate(-center.x,-center.y,-center.z);g.computeBoundingBox();full=g;mesh=new THREE.Mesh(g,material);scene.add(mesh);setBounds({height,triangles:g.getAttribute('position').count/3})
   const saved=remembered.current
   if(saved&&saved.flat===flat&&reset.current===fit){camera.position.fromArray(saved.position);camera.up.fromArray(saved.up);controls.target.fromArray(saved.target)}else preset(flat?'top':optionRef.current.view)
   reset.current=fit;controls.update();resize();apply()
   if(comparison){const texture=new THREE.TextureLoader().load(comparison.url,()=>{
    if(!alive)return
    const border=new THREE.PlaneGeometry(size.x,size.y),white=new THREE.MeshBasicMaterial({color:0xffffff}),plane=new THREE.PlaneGeometry(comparison.width,comparison.height),ink=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide})
    artwork.add(new THREE.Mesh(border,white));const image=new THREE.Mesh(plane,ink);image.position.set(comparison.marginX+comparison.width/2-center.x,comparison.marginY+comparison.height/2-center.y,.01);if(comparison.flip)image.scale.x=-1;artwork.add(image);resources.push(border,white,plane,ink);setReadyUrl(request)
   },undefined,()=>alive&&setError('The artwork comparison could not be displayed.'));texture.colorSpace=THREE.SRGBColorSpace;resources.push(texture)}else setReadyUrl(request)
  },undefined,()=>alive&&setError('The model could not be displayed. Try Make Stencil again.'))
  let frame=0;const render=()=>{frame=requestAnimationFrame(render);controls.update();renderer.setScissorTest(false);renderer.clear();if(comparison){renderer.render(artwork,camera);const split=Math.round(el.clientWidth*ratioRef.current);renderer.setScissor(split,0,el.clientWidth-split,el.clientHeight);renderer.setScissorTest(true);renderer.render(scene,camera);renderer.setScissorTest(false)}else renderer.render(scene,camera)};render()
  return()=>{remembered.current={position:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray(),flat};alive=false;clearTimeout(endTimer);cancelAnimationFrame(frame);observer.disconnect();controls.dispose();resources.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove();cameraRef.current=undefined;applyRef.current=undefined;presetRef.current=undefined}
 },[url,flat,fit,theme,onZoom,comparison,layer])
 useEffect(()=>{if(cameraRef.current){cameraRef.current.zoom=zoom;cameraRef.current.updateProjectionMatrix()}},[zoom,ready,fit])
 const splitAt=(x:number)=>{const b=host.current!.getBoundingClientRect();setRatio(Math.max(.03,Math.min(.97,(x-b.left)/b.width)))}
 const update=(p:Partial<Options>)=>setOptions(o=>({...o,...p}))
 return <div className="mesh-preview" ref={host} data-ready={ready} data-comparison={!!comparison} data-wireframe={options.wire} data-shading={options.shading} data-detail={options.detail} data-cut={options.cut}>
  {!ready&&!error&&<span className="view-message">Drawing your stencil…</span>}{error&&<p className="view-message" role="alert">{error}</p>}
  {!flat&&<details className="view-options"><summary>View Options</summary><div>
   <label>Camera<select aria-label="Camera view" value={options.view} onChange={e=>{const view=e.target.value as View;update({view});presetRef.current?.(view)}}>{(['iso','top','bottom','left','right','front','back'] as View[]).map(v=><option key={v} value={v}>{v==='iso'?'Isometric':v[0].toUpperCase()+v.slice(1)}</option>)}</select></label>
   <button onClick={()=>{presetRef.current?.('iso');update({view:'iso'});onZoom(1)}}>Reset camera</button>
   <label>Shading<select aria-label="Mesh shading" value={options.shading} onChange={e=>update({shading:e.target.value})}><option value="smooth">Smooth</option><option value="flat">Flat</option></select></label>
   <label><span>Wireframe</span><input type="checkbox" aria-label="Wireframe" checked={options.wire} onChange={e=>update({wire:e.target.checked})}/></label>
   <label>Display detail<select aria-label="Display detail" value={options.detail} onChange={e=>update({detail:e.target.value})}><option value="auto">Automatic while moving</option><option value="full">Full mesh</option><option value="reduced">Reduced preview</option></select></label>
   <label><span>Colour by height</span><input type="checkbox" aria-label="Colour by height" checked={options.heights} onChange={e=>update({heights:e.target.checked})}/></label>
   <label>Height inspection<select aria-label="Height inspection" value={options.cut} onChange={e=>update({cut:e.target.value,height:options.height||Math.min(layer/2,bounds.height)})}><option value="full">Complete model</option><option value="below">Below chosen height</option><option value="layer">One print-layer interval</option></select></label>
   {options.cut!=='full'&&<><label>Height above bed (mm)<input type="number" aria-label="Inspection height (mm)" min="0" max={bounds.height} step={layer/2} value={options.height} onChange={e=>update({height:Math.max(0,Math.min(bounds.height,Number(e.target.value)))})}/></label><input type="range" aria-label="Inspection height slider" min="0" max={bounds.height} step={layer/2} value={options.height} onChange={e=>update({height:Number(e.target.value)})}/><p>Layer {Math.min(Number(stats.layers)||Infinity,Math.floor(options.height/layer)+1)} · {layer} mm interval. Uncapped geometry cutaway; this is not a manufacturing slicer.</p></>}
   <p>{bounds.triangles.toLocaleString()} source triangles · {bounds.height.toFixed(3)} mm final height. Display changes do not modify the STL.</p>
  </div></details>}
  {comparison&&<><div className="comparison-labels"><span>Prepared artwork</span><span>STL top view</span></div><button className="comparison-handle" aria-label="Drag comparison divider" style={{left:`${ratio*100}%`}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);splitAt(e.clientX)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))splitAt(e.clientX)}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)} tabIndex={-1}><span>↔</span></button><label className="comparison-range">Compare<input type="range" aria-label="Comparison split" min="3" max="97" value={Math.round(ratio*100)} onChange={e=>setRatio(Number(e.target.value)/100)}/></label></>}
 </div>
}
