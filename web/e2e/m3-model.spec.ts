import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { NodeType } from '../src/api'
import { ParameterRegistry } from '../src/studio/registry'
import { copy, editParameter, operations, rawGraph, ProjectCommands, saveDocument } from '../src/studio/project'
import { styleRecipe, switchStyle } from '../src/studio/recipes'
import { artworkTypes, artworkHelp, validateRecipe, insertArtwork, bypassArtwork, enableArtwork, duplicateArtwork, duplicatePass, moveArtwork, inputChoices, connectInput, passList, textRecipe, renamePass } from '../src/studio/artwork'
import { editable } from '../src/studio/recipes'
import { cropAt, cropPixels } from '../src/studio/crop'
import { applyOperationPreset } from '../src/studio/Presets'
const catalogue: NodeType[] = JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json', import.meta.url), 'utf8'))
const registry = new ParameterRegistry(catalogue)

test('all 41 artwork slots have actual defaults, constraints, help, validation and editable routing', () => {
  const scoped = registry.settings.filter(s => (artworkTypes as readonly string[]).includes(s.type))
  expect(scoped).toHaveLength(41)
  for (const s of scoped) {
    expect(editable(s.type, s.parameter.name)).toBe(true); expect(artworkHelp[s.key]?.length).toBeGreaterThan(15)
    expect(() => registry.validate(s.type, s.parameter.name, s.parameter.default)).not.toThrow()
    if (['int','float'].includes(s.parameter.kind)) { expect(() => registry.validate(s.type, s.parameter.name, s.parameter.min!-1)).toThrow(); expect(() => registry.validate(s.type, s.parameter.name, s.parameter.max!+1)).toThrow() }
    if (s.parameter.choices) expect(() => registry.validate(s.type, s.parameter.name, 'unavailable-choice')).toThrow()
    if (['text','string'].includes(s.parameter.kind)) expect(() => registry.validate(s.type, s.parameter.name, 12)).toThrow()
  }
  expect(registry.settings).toHaveLength(217)
  expect(registry.search('smooth edges').some(s => s.type === 'smooth')).toBe(true)
  expect(registry.search('remove small dots').some(s => s.type === 'remove_islands')).toBe(true)
})
test('typed insert, duplicate, reordering, bypass/enable and undo preserve values and stable identities', () => {
  const history = new ProjectCommands(styleRecipe('image', 'Artwork.svg', catalogue))
  history.apply('insert', d => insertArtwork(d, 'outlines', 'mask', 'morphology', catalogue))
  const first = operations(history.current!).find(n => n.type === 'morphology')!
  history.apply('set', d => editParameter(d, first.id, 'radius', 3))
  history.apply('duplicate', d => duplicateArtwork(d, first.id, catalogue))
  const pair = operations(history.current!).filter(n => n.type === 'morphology'); expect(pair).toHaveLength(2); expect(pair.every(n => n.params.radius === 3)).toBe(true)
  const second = pair.find(n => n.id !== first.id)!
  const before = copy(history.current!)
  history.apply('move', d => moveArtwork(d, first.id, -1, catalogue)); validateRecipe(history.current!, catalogue)
  history.apply('disable', d => bypassArtwork(d, second.id, catalogue)); expect(operations(history.current!).find(n => n.id === second.id)).toBeUndefined()
  expect(history.current!.raw.stencilStudio.disabled[second.id].node.params.radius).toBe(3)
  history.apply('enable', d => enableArtwork(d, second.id, catalogue)); validateRecipe(history.current!, catalogue)
  history.undo(); history.undo(); history.undo(); expect(history.current).toEqual(before)
  expect(() => bypassArtwork(history.current!, 'outlines', catalogue)).toThrow(/format/)
  expect(() => insertArtwork(history.current!, 'paint', 'image', 'smooth', catalogue)).toThrow(/format/)
})
test('conversion pairs compile, every input has the proper type, and circular choices are excluded', () => {
  let doc = insertArtwork(styleRecipe('i','a',catalogue), 'plate','shapes','shapes_to_mask',catalogue)
  validateRecipe(doc,catalogue); expect(operations(doc).filter(n=>n.type==='trace')).toHaveLength(2)
  expect(inputChoices(doc,'paint','image',catalogue).some(c=>c.from[0]==='artwork')).toBe(true)
  expect(inputChoices(doc,'outlines','mask',catalogue).some(c=>c.from[0].startsWith('shapes_to_mask'))).toBe(false)
  expect(()=>connectInput(doc,'outlines','mask',['shapes_to_mask-1','mask'],catalogue)).toThrow(/circular/)
  doc = switchStyle(doc,'smooth',catalogue); doc = switchStyle(doc,'standard',catalogue)
  expect(operations(doc).some(n=>n.type==='shapes_to_mask')).toBe(true)
})
test('named imported branches keep unrelated manufacturing, metadata, raw identities and unknown data', () => {
  let doc = styleRecipe('i','a',catalogue)
  rawGraph(doc).nodes.push({ id:'second',type:'vector_stencil',params:{ width_mm:120 },position:{x:9},future:['keep'] })
  rawGraph(doc).edges.push({ from:['cleanup','shapes'],to:['second','shapes'],future:'link' })
  doc.raw.future={ deeply:{keep:[1,false]} }; doc.raw.images={unused:{base64:'AQID',name:'unused'}}
  const original=copy(doc); doc=renamePass(doc,'second','Lettering proof')
  expect(passList(doc).find(p=>p.id==='second')!.name).toBe('Lettering proof')
  doc=insertArtwork(doc,'plate','shapes','round_corners',catalogue)
  expect(rawGraph(doc).nodes.find((n:any)=>n.id==='second')).toEqual(rawGraph(original).nodes.find((n:any)=>n.id==='second'))
  expect(rawGraph(doc).edges.find((e:any)=>e.to[0]==='second')).toEqual(rawGraph(original).edges.find((e:any)=>e.to[0]==='second'))
  expect(doc.raw.future).toEqual(original.raw.future); expect(doc.raw.images).toEqual(original.raw.images)
  expect(JSON.parse(saveDocument(doc))).toEqual(doc.raw)
  expect(()=>switchStyle(doc,'crisp',catalogue)).toThrow(/custom/)
})
test('text is an independent typed source and operation presets affect only their selected instance', () => {
  const text=textRecipe(catalogue);validateRecipe(text,catalogue);expect(operations(text).some(n=>n.type==='source')).toBe(false)
  let doc=insertArtwork(styleRecipe('i','a',catalogue),'outlines','mask','smooth',catalogue)
  const smoothing=operations(doc).find(n=>n.type==='smooth')!
  doc=duplicateArtwork(doc,smoothing.id,catalogue)
  const before=copy(doc);doc=applyOperationPreset(doc,smoothing.id,{radius:2,unknown_future:'retained in library'},registry)
  expect(operations(doc).find(n=>n.id===smoothing.id)!.params.radius).toBe(2)
  expect(operations(doc).find(n=>n.type==='smooth'&&n.id!==smoothing.id)).toEqual(operations(before).find(n=>n.type==='smooth'&&n.id!==smoothing.id))
  expect(()=>applyOperationPreset(doc,smoothing.id,{radius:100},registry)).toThrow()
})
test('crop handles use the same rounded input pixels as Rust, including odd sizes, aspect ratios and keyboard steps', () => {
  for(const [w,h] of [[650,520],[101,37],[37,101],[2000,333]]){
    const p={crop_left:0,crop_top:0,crop_right:0,crop_bottom:0},next=cropAt(p,'top-left',w*.13,h*.21,w,h),b=cropPixels(next,w,h)
    expect(b.left).toBe(Math.round(w*.13));expect(b.top).toBe(Math.round(h*.21));expect(b.right).toBe(w);expect(b.bottom).toBe(h)
    const moved=cropAt(next,'left',b.left+1,0,w,h);expect(cropPixels(moved,w,h).left).toBe(b.left+1)
    const extreme=cropAt(next,'bottom-right',-100,-100,w,h),box=cropPixels(extreme,w,h)
    expect(box.right-box.left).toBeGreaterThanOrEqual(2);expect(box.bottom-box.top).toBeGreaterThanOrEqual(2)
  }
})
test('morphology dependencies distinguish kernel, pass count and pattern controls without deleting inactive values',()=>{
 const state=(key:string,p:Record<string,unknown>)=>registry.availability(registry.settings.find(s=>s.key===`morphology.${key}`)!,p).active
 expect(state('angle',{op:'open',kernel:'line'})).toBe(true);expect(state('angle',{op:'open',kernel:'disc'})).toBe(false)
 expect(state('radius',{op:'thin'})).toBe(false);expect(state('iterations',{op:'thin',iterations:0})).toBe(true)
 expect(state('iterations',{op:'skeleton'})).toBe(false);expect(state('pattern',{op:'hit_or_miss'})).toBe(true)
 expect(state('custom',{op:'hit_or_miss',pattern:'custom'})).toBe(true);expect(state('rotate',{op:'hit_or_miss',pattern:'endpoints'})).toBe(false)
})

test('legacy-shaped steps, opaque links and disabled identities survive safe structural editing',()=>{
 let doc=styleRecipe('original','Legacy',catalogue),g=rawGraph(doc)
 g.nodes=g.nodes.map((n:any,i:number)=>({id:n.id,position:{x:i*20,y:3},data:{type:n.type,params:n.params,opaque:['keep',i]}}))
 g.edges=g.edges.map((e:any,i:number)=>({id:`saved-${i}`,source:e.from[0],sourceHandle:e.from[1],target:e.to[0],targetHandle:e.to[1],opaque:{keep:i}}))
 doc=insertArtwork(doc,'outlines','mask','morphology',catalogue);doc=editParameter(doc,'morphology-1','radius',4)
 doc=bypassArtwork(doc,'morphology-1',catalogue);doc=insertArtwork(doc,'outlines','mask','morphology',catalogue)
 expect(operations(doc).some(n=>n.id==='morphology-2')).toBe(true)
 // The new insertion uses the old bypass connection, so recovering the disabled
 // operation refuses to overwrite it and keeps both configurations available.
 expect(()=>enableArtwork(doc,'morphology-1',catalogue)).toThrow()
 expect(doc.raw.stencilStudio.disabled['morphology-1'].node.params.radius).toBe(4)
 const old=copy(doc);doc=duplicatePass(doc,'plate',catalogue);validateRecipe(doc,catalogue)
 for(const node of rawGraph(old).nodes)expect(rawGraph(doc).nodes.find((n:any)=>n.id===node.id)).toEqual(node)
 for(const link of rawGraph(old).edges)expect(rawGraph(doc).edges).toContainEqual(link)
 expect(doc.raw.stencilStudio.disabled).toEqual(old.raw.stencilStudio.disabled)
})
