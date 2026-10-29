import {expect,test} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import {geometryProject} from './m4-fixtures'
test.setTimeout(240_000)
test('dense exact topology audit stays off the UI, checks an analytic closed solid and refuses above-budget data',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled();await page.setInputFiles('[aria-label="Open project file"]',{name:'geometry.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(geometryProject('vector_stencil','bridge_mm')))})
 await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
 const workerUrl=page.workers().find(w=>w.url().includes('meshAudit.worker'))!.url()
 const result=await page.evaluate(async workerUrl=>{
  const code=`onmessage=e=>{const n=e.data,t=12*n*n,b=new ArrayBuffer(84+t*50),d=new DataView(b);d.setUint32(80,t,true);const points=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],quads=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];let tri=0;for(const q of quads){const a=points[q[0]],u=points[q[1]].map((v,k)=>v-a[k]),v=points[q[3]].map((v,k)=>v-a[k]);for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(const pair of [[[x,y],[x+1,y],[x+1,y+1]],[[x,y],[x+1,y+1],[x,y+1]]]){for(let j=0;j<3;j++)for(let k=0;k<3;k++)d.setFloat32(96+tri*50+j*12+k*4,a[k]+u[k]*pair[j][0]/n+v[k]*pair[j][1]/n,true);tri++}}postMessage(b,[b])}`
  const generatorUrl=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),generator=new Worker(generatorUrl),auditor=new Worker(workerUrl,{type:'module'});let id=0
  const build=(n:number)=>new Promise<ArrayBuffer>(resolve=>{generator.onmessage=e=>resolve(e.data);generator.postMessage(n)})
  const audit=(bytes:ArrayBuffer)=>new Promise<any>(resolve=>{auditor.onmessage=e=>resolve(e.data);auditor.postMessage({id:++id,bytes},[bytes])})
  const gaps:number[]=[];let last=performance.now(),frame=0,active=true
  const tick=(now:number)=>{gaps.push(now-last);last=now;if(active)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick)
  try{
   const valid=await audit(await build(384)),blocked=await audit(await build(420));return{valid,blocked,max_frame_gap_ms:Math.max(...gaps),frames:gaps.length}
  }finally{active=false;cancelAnimationFrame(frame);auditor.terminate();generator.terminate();URL.revokeObjectURL(generatorUrl)}
 },workerUrl)
 expect(result.valid.ok.closed).toBe(true);expect(result.valid.ok.components).toBe(1);expect(result.valid.ok.triangles).toBe(1_769_472);expect(result.valid.ok.signedVolume).toBeCloseTo(1,5);expect(result.valid.ok.size).toEqual([1,1,1]);expect(result.blocked.error).toContain('two-million-triangle');expect(result.frames).toBeGreaterThan(10);expect(result.max_frame_gap_ms).toBeLessThan(1500)
 await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false')
 mkdirSync('../docs/m4',{recursive:true});writeFileSync('../docs/m4/dense-audit.json',JSON.stringify(result,null,2))
})
