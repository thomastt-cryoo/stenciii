import {test,expect} from '@playwright/test'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {m5Project,step} from './m5-fixtures'

test('shared and independent hardware branches export every assembly once with actual layout and outline auxiliaries',async({page})=>{
 test.setTimeout(240000)
 const doc=m5Project('tile_layout','edits')
 doc.graph.nodes.push(step('mounted','pads',{pad_thread:'none',mount_screw:'M4',segments:24}),step('hw:a','hardware',{segments:24}),step('hw/a','hardware',{screw:'M6',segments:24}),step('free','hardware',{segments:24}))
 doc.graph.edges.push({from:['built','parts'],to:['mounted','parts']},{from:['mounted','parts'],to:['hw:a','parts']},{from:['mounted','parts'],to:['hw/a','parts']})
 Object.assign(doc.stencilStudio,{name:'Shared manufacturing branches',passNames:{'hw:a':'Workshop','hw/a':'Workshop',free:'Freestanding'}})
 await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'branches.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.getByRole('link',{name:'Export ZIP',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
 await page.getByRole('button',{name:'Export options',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Manufacturing export'})
 for(const id of ['hw:a','hw/a','free'])await dialog.getByRole('checkbox',{name:`Include assembly ${id} parts`,exact:true}).check()
 await dialog.getByText('Optional preparation files',{exact:true}).click();await dialog.getByRole('checkbox',{name:'Layout previews PNG',exact:true}).check();await dialog.getByRole('checkbox',{name:'Traced outlines SVG before bridges',exact:true}).check()
 const link=dialog.getByRole('link',{name:'Download manufacturing ZIP',exact:true});await expect(link).toHaveAttribute('aria-disabled','false',{timeout:30000});await expect(dialog).toContainText('Shared upstream parts are stored once');await expect(dialog).toContainText('Shared file in ZIP:')
 const download=page.waitForEvent('download');await link.click();const data=readFileSync((await(await download).path())!);mkdirSync('../docs/m5/exports',{recursive:true});const zip='../docs/m5/exports/shared-branches.zip';writeFileSync(zip,data)
 const manifest=JSON.parse(execFileSync('python',['-c',`import zipfile,json,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert len(z.namelist())==len(set(n.lower() for n in z.namelist()));print(z.read('manufacturing-manifest.json').decode())`,zip],{encoding:'utf8',maxBuffer:16000000}))
 expect(manifest.complete_for_selected_outputs).toBe(true);expect(manifest.assemblies).toHaveLength(3);expect(manifest.files.some((f:any)=>f.also_used_by.length)).toBe(true);expect(manifest.files.filter((f:any)=>f.role==='Stencil tile')).toHaveLength(2)
 expect(manifest.files.some((f:any)=>f.path.endsWith('.png'))).toBe(true);expect(manifest.files.some((f:any)=>f.path.endsWith('.svg'))).toBe(true)
 for(const record of manifest.files)for(const alias of record.also_used_by)expect(alias.requested_path).toBeTruthy()
 const inspected=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',zip],{encoding:'utf8',maxBuffer:16000000}));expect(inspected.entries.filter((e:any)=>e.name.endsWith('.stl')).every((e:any)=>e.closed_oriented_mesh)).toBe(true)
 writeFileSync('../docs/m5/exports/shared-branches-manifest.json',JSON.stringify({manifest,independent_validation:inspected},null,2));writeFileSync('../docs/m5/examples/shared-branches-project.json',JSON.stringify(doc,null,2))
 const projectBytes=execFileSync('python',['-c',`import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read('original-project.json').decode())`,zip],{encoding:'utf8'});expect(JSON.parse(projectBytes)).toEqual(doc)
})
