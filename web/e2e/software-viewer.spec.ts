import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {geometryProject} from './m4-fixtures'

test.setTimeout(90000)
test.use({actionTimeout:15000})
async function open(page:Page){
 await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'curved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(geometryProject('vector_stencil','bridge_mm')))})
 await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:90000})
 await page.getByRole('tab',{name:'3D',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true')
}
async function image(page:Page){return page.locator('.mesh-preview canvas').evaluate(c=>(c as HTMLCanvasElement).toDataURL())}
async function download(page:Page){const[file]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Export STL',exact:true}).click()]);return readFileSync((await file.path())!)}

test('an already-lost Safari-style context still has real orbitable, clipped, shaded 3D and unchanged exports',async({page},testInfo)=>{
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]):any{
   if(type==='webgl2')return {isContextLost:()=>true,getParameter:()=>null,getShaderPrecisionFormat:()=>null,getExtension:()=>null}
   return (original as any).call(this,type,...args)
  }as any
 })
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)))
 await open(page);const canvas=page.locator('.mesh-preview canvas');await expect(canvas).toHaveAttribute('data-renderer','software');await expect(canvas).toHaveAttribute('data-render-frame',/^[1-9]/)
 const pixels=await canvas.evaluate(c=>{const v=c as HTMLCanvasElement,p=v.getContext('2d')!.getImageData(0,0,v.width,v.height).data;let count=0;const colours=new Set();for(let i=0;i<p.length;i+=4)if(p[i+3]){count++;colours.add(p[i]+','+p[i+1]+','+p[i+2])}return {count,colours:colours.size}})
 expect(pixels.count).toBeGreaterThan(1000);expect(pixels.colours).toBeGreaterThan(12)
 await page.screenshot({path:testInfo.outputPath('software-3d.png')})
 const exported=await download(page),iso=await image(page);await page.locator('.view-options>summary').click()
 await page.getByRole('combobox',{name:'Camera view',exact:true}).selectOption('top');await expect.poll(()=>image(page)).not.toBe(iso)
 await page.getByRole('combobox',{name:'Camera view',exact:true}).selectOption('iso');await expect.poll(()=>image(page)).toBe(iso)
 await page.getByRole('checkbox',{name:'Wireframe',exact:true}).check();await expect.poll(()=>image(page)).not.toBe(iso);await page.getByRole('checkbox',{name:'Wireframe',exact:true}).uncheck()
 await page.getByRole('combobox',{name:'Mesh shading',exact:true}).selectOption('flat');await expect.poll(()=>image(page)).not.toBe(iso);await page.getByRole('combobox',{name:'Mesh shading',exact:true}).selectOption('smooth')
 await page.getByRole('combobox',{name:'Height inspection',exact:true}).selectOption('below');await page.getByRole('spinbutton',{name:'Inspection height (mm)',exact:true}).fill('.1');await expect.poll(()=>image(page)).not.toBe(iso)
 await page.getByRole('combobox',{name:'Height inspection',exact:true}).selectOption('full');await expect.poll(()=>image(page)).toBe(iso)
 await page.locator('.view-options>summary').click();const rect=await canvas.boundingBox();await page.mouse.move(rect!.x+rect!.width*.4,rect!.y+rect!.height*.55);await page.mouse.down();await page.mouse.move(rect!.x+rect!.width*.6,rect!.y+rect!.height*.65,{steps:6});await page.mouse.up();await expect.poll(()=>image(page)).not.toBe(iso)
 await page.getByRole('tab',{name:'Compare',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true');await expect(page.locator('.mesh-preview canvas')).toHaveAttribute('data-render-frame',/^[1-9]/)
 await page.screenshot({path:testInfo.outputPath('software-comparison.png')})
 expect(await download(page)).toEqual(exported);expect(errors).toEqual([])
})

test('a healthy WebGL context retains the accelerated renderer',async({page})=>{await open(page);await expect(page.locator('.mesh-preview canvas')).toHaveAttribute('data-renderer','webgl')})
