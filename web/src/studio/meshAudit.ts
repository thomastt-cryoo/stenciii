export interface MeshCheck {
 triangles:number; size:number[]; bounds:number[][]; degenerate:number; vertices:number; components:number
 edgesNotSharedTwice:number; inconsistentWinding:number; signedVolume:number; closed:boolean; milliseconds:number
}
const capacity=(n:number)=>{let size=16;while(size<n)size*=2;return size}
const hash=(a:number,b:number,c=0)=>{let h=Math.imul(a^0x9e3779b9,0x85ebca6b);h=Math.imul(h^b,0xc2b2ae35);h=Math.imul(h^c,0x27d4eb2d);return(h^(h>>>16))>>>0}
/** Independent exact-float32 topology audit, without welding, repairing or using
 * the engine's watertight flag. Typed hash tables keep dense audits off the UI. */
export function inspectStl(bytes:ArrayBuffer):MeshCheck {
 const start=performance.now()
 if(bytes.byteLength<84)throw Error('The generated STL is incomplete. Try making the stencil again.')
 const v=new DataView(bytes),triangles=v.getUint32(80,true)
 if(!triangles||bytes.byteLength!==84+triangles*50)throw Error('The generated STL has an invalid triangle count.')
 if(triangles>2_000_000)throw Error('This model exceeds the current two-million-triangle verification limit. Lower vector detail or use mesh optimization before exporting.')
 const vc=capacity(triangles*6),ec=capacity(triangles*4),offsets=new Uint32Array(vc),ids=new Uint32Array(vc)
 const eLo=new Uint32Array(ec),eHi=new Uint32Array(ec),eFirst=new Uint32Array(ec),eCount=new Uint32Array(ec),eBalance=new Int8Array(ec),parent=new Uint32Array(triangles)
 for(let i=0;i<triangles;i++)parent[i]=i
 const root=(x:number)=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x}
 const union=(a:number,b:number)=>{a=root(a);b=root(b);if(a!==b)parent[b]=a}
 const bits=(off:number)=>{const b=v.getUint32(off,true);return (b&0x7fffffff)===0?0:b}
 let vertices=0,degenerate=0,signedVolume=0
 const vertex=(off:number)=>{const x=bits(off),y=bits(off+4),z=bits(off+8);let slot=hash(x,y,z)&(vc-1)
  while(offsets[slot]){const o=offsets[slot]-1;if(bits(o)===x&&bits(o+4)===y&&bits(o+8)===z)return ids[slot];slot=(slot+1)&(vc-1)}offsets[slot]=off+1;ids[slot]=vertices;return vertices++}
 const edge=(a:number,b:number,t:number)=>{const lo=Math.min(a,b),hi=Math.max(a,b);let slot=hash(lo,hi)&(ec-1)
  while(eFirst[slot]&&(eLo[slot]!==lo||eHi[slot]!==hi))slot=(slot+1)&(ec-1)
  if(eFirst[slot])union(t,eFirst[slot]-1);else{eFirst[slot]=t+1;eLo[slot]=lo;eHi[slot]=hi}
  eCount[slot]++;eBalance[slot]+=a<b?1:-1}
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity]
 for(let t=0;t<triangles;t++){
  const off=96+t*50,p=Array.from({length:9},(_,j)=>v.getFloat32(off+j*4,true))
  if(p.some(x=>!Number.isFinite(x))||[84,88,92].some(n=>!Number.isFinite(v.getFloat32(t*50+n,true))))throw Error('The output contains invalid geometry coordinates or normals.')
  for(let j=0;j<9;j++){const k=j%3;lo[k]=Math.min(lo[k],p[j]);hi[k]=Math.max(hi[k],p[j])}
  const ax=p[3]-p[0],ay=p[4]-p[1],az=p[5]-p[2],bx=p[6]-p[0],by=p[7]-p[1],bz=p[8]-p[2]
  if((ay*bz-az*by)**2+(az*bx-ax*bz)**2+(ax*by-ay*bx)**2<=1e-24)degenerate++
  signedVolume+=(p[0]*(p[4]*p[8]-p[5]*p[7])+p[1]*(p[5]*p[6]-p[3]*p[8])+p[2]*(p[3]*p[7]-p[4]*p[6]))/6
  const a=vertex(off),b=vertex(off+12),c=vertex(off+24);edge(a,b,t);edge(b,c,t);edge(c,a,t)
 }
 let edgesNotSharedTwice=0,inconsistentWinding=0,components=0
 for(let i=0;i<ec;i++)if(eFirst[i]){if(eCount[i]!==2)edgesNotSharedTwice++;else if(eBalance[i]!==0)inconsistentWinding++}
 for(let i=0;i<triangles;i++)if(root(i)===i)components++
 return {triangles,size:hi.map((n,i)=>n-lo[i]),bounds:[lo,hi],vertices,components,degenerate,edgesNotSharedTwice,inconsistentWinding,signedVolume,closed:!degenerate&&!edgesNotSharedTwice&&!inconsistentWinding&&signedVolume>1e-12,milliseconds:performance.now()-start}
}
export function meshProblems(m:MeshCheck){
 const out:string[]=[]
 if(m.degenerate)out.push(`${m.degenerate} zero-area triangles`)
 if(m.edgesNotSharedTwice)out.push(`${m.edgesNotSharedTwice} open or non-manifold edges`)
 if(m.inconsistentWinding)out.push(`${m.inconsistentWinding} inconsistently oriented edges`)
 if(m.signedVolume<=1e-12)out.push('zero volume or reversed orientation')
 return out
}
