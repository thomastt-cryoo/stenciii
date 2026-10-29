import {expect,test} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
import {catalogue,changesC,m5Project} from './m5-fixtures'
import {prove} from './m5-proof'
import {ParameterRegistry} from '../src/studio/registry'
import {manufacturingHelp} from '../src/studio/manufacturing'

test('M5C all 44 mounting, border and hardware slots edit, reset, reopen and change applicable real outputs',async({page})=>{
 test.setTimeout(900_000);mkdirSync('../docs/m5',{recursive:true});mkdirSync('../sandbox/m5/c',{recursive:true})
 const rows:any[]=[],registry=new ParameterRegistry(catalogue)
 await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 for(const type of ['pads','ring','hardware'].filter(t=>!process.env.M5_TYPE||t===process.env.M5_TYPE))for(const parameter of catalogue.find(t=>t.id===type)!.params.filter(p=>!process.env.M5_KEY||p.name===process.env.M5_KEY)){
  const key=`${type}.${parameter.name}`,doc=m5Project(type,parameter.name),out='parts',target='test',stem=key.replace('.','-'),value=changesC[parameter.name]
  expect(manufacturingHelp[key],key).toBeTruthy();registry.validate(type,parameter.name,value)
  await page.setInputFiles('[aria-label="Open project file"]',{name:'manufacturing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))})
  await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill(key);await page.locator('.setting-reference summary').first().click()
  const label=`${parameter.label} · test`,before=await prove(page,doc,target,out)
  if(parameter.kind==='bool')await page.getByRole('checkbox',{name:label,exact:true}).setChecked(Boolean(value))
  else if(parameter.kind==='choice')await page.getByRole('combobox',{name:label,exact:true}).selectOption(String(value))
  else if(parameter.name==='edits'){await page.locator('.saved-layout-offsets summary').click();await page.getByRole('textbox',{name:label,exact:true}).fill(String(value));await page.getByRole('button',{name:'Apply saved offsets',exact:true}).click()}
  else await page.getByRole('spinbutton',{name:label,exact:true}).fill(String(value))
  const changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(changed.graph.nodes.find((n:any)=>n.id==='test').params[parameter.name],key).toEqual(value)
  let after:any;try{after=await prove(page,changed,target,out)}catch(error){if(type!=='tiles'||parameter.name!=='reinforce')throw error;after={error:String(error instanceof Error?error.message:error)};expect(after.error).toMatch(/no room/)}
  if(!after.error)expect(after.sha256,key).not.toBe(before.sha256)
  for(const [phase,result,project] of [['before',before,doc],['after',after,changed]] as const){
   if((result as any).error){writeFileSync(`../sandbox/m5/c/${stem}-${phase}.json`,JSON.stringify(project));continue}
   const path=resolve(`../sandbox/m5/c/${stem}-${phase}.${result.extension}`);writeFileSync(path,Buffer.from(result.base64,'base64'));writeFileSync(`../sandbox/m5/c/${stem}-${phase}.json`,JSON.stringify(project));(result as any).validation=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8',maxBuffer:8*1024*1024}));delete(result as any).base64
   const invalid=(result as any).validation.entries.filter((e:any)=>!e.closed_oriented_mesh);(result as any).independently_valid=invalid.length===0;if(process.env.M5_PRE_REPAIR==='1'){expect(invalid.every((e:any)=>/fit_test/.test(e.name??e.file??'')),JSON.stringify(invalid)).toBe(true)}else expect(invalid,key).toEqual([])
  }
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'All Settings',exact:true})).toBeEnabled();expect(await page.evaluate(name=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!).graph.nodes.find((n:any)=>n.id==='test').params[name],parameter.name)).toEqual(value);await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill(key);await page.locator('.setting-reference summary').first().click()
  await page.getByRole('button',{name:`Reset ${label}`,exact:true}).click();const reset=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(reset.graph.nodes.find((n:any)=>n.id==='test').params[parameter.name]).toEqual(parameter.default);expect(reset.images).toEqual(doc.images);expect(reset.opaque).toEqual(doc.opaque)
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'All Settings',exact:true})).toBeEnabled();expect(await page.evaluate(name=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!).graph.nodes.find((n:any)=>n.id==='test').params[name],parameter.name)).toEqual(parameter.default)
  rows.push({key,default:parameter.default,kind:parameter.kind,min:parameter.min,max:parameter.max,step:parameter.step,choices:parameter.choices,category:registry.settings.find(s=>s.key===key)!.category,control:parameter.kind,dependencies:manufacturingHelp[key],changed_to:value,reset:true,reopened:true,output_changed:!after.error,engine_refusal:!!after.error,verified:true,before,after,project_before:`sandbox/m5/c/${stem}-before.json`,project_after:`sandbox/m5/c/${stem}-after.json`});writeFileSync(process.env.M5_TYPE?'../docs/m5/c-probe.json':'../docs/m5/c-coverage.json',JSON.stringify({slots:rows.length,cases:rows},null,2))
 }
 expect(rows).toHaveLength(catalogue.filter(t=>['pads','ring','hardware'].includes(t.id)&&(!process.env.M5_TYPE||t.id===process.env.M5_TYPE)).reduce((n,t)=>n+t.params.filter(p=>!process.env.M5_KEY||p.name===process.env.M5_KEY).length,0))
})
