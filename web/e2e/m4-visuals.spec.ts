import {expect,test} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import {geometryProject} from './m4-fixtures'
const folder='../docs/m6/replay/m5/replay/m4/screenshots/geometry'
test.setTimeout(240_000)
test('geometry inspector, real bridge cutaways, mesh precision and camera tools in both themes and mobile',async({page})=>{
 mkdirSync(folder,{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'});await page.goto('/')
 await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled();await page.setInputFiles('[aria-label="Open project file"]',{name:'geometry.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(geometryProject('vector_stencil','bridge_mm')))})
 const ready=async()=>{await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000});await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true')}
 const shot=async(name:string)=>page.screenshot({path:`${folder}/${name}.png`,fullPage:true})
 await ready();await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Bridges and stencil geometry',exact:true}).click();await page.locator('.geometry-group').filter({hasText:'Bridge placement'}).locator('summary').first().click();await shot('01-bridges-light')
 await page.locator('.geometry-group').filter({hasText:'Bridge placement'}).locator('summary').first().click();await page.locator('.geometry-group').filter({hasText:'Bridge height & layers'}).locator('summary').first().click();await shot('02-layers-light')
 await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.getByRole('tab',{name:'Compare',exact:true}).click();await ready();await shot('03-artwork-and-bridges')
 await page.getByRole('tab',{name:'3D',exact:true}).click();await ready();await page.locator('.view-options summary').click();await page.getByRole('checkbox',{name:'Colour by height',exact:true}).check();await shot('04-raised-bridges-light')
 await page.getByRole('combobox',{name:'Camera view',exact:true}).selectOption('top');await page.getByRole('combobox',{name:'Height inspection',exact:true}).selectOption('below');await page.getByRole('spinbutton',{name:'Inspection height (mm)',exact:true}).fill('.1');await shot('05-first-layer-cutaway')
 await page.getByRole('combobox',{name:'Height inspection',exact:true}).selectOption('layer');await page.getByRole('spinbutton',{name:'Inspection height (mm)',exact:true}).fill('1.3');await shot('06-layer-interval')
 await page.getByRole('combobox',{name:'Height inspection',exact:true}).selectOption('full');await page.getByRole('combobox',{name:'Camera view',exact:true}).selectOption('iso');await page.getByRole('checkbox',{name:'Wireframe',exact:true}).check();await shot('07-wireframe-light');await page.getByRole('checkbox',{name:'Wireframe',exact:true}).uncheck()
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await ready();await shot('08-raised-bridges-dark')
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Bridges and stencil geometry',exact:true}).click();await page.locator('.geometry-group').filter({hasText:'Strength & stability'}).locator('summary').first().click();await shot('09-strength-dark')
 const audits=[]
 for(const width of [1440,800,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.settings-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);const result=await new AxeBuilder({page}).include('.settings-dialog').withTags(['wcag2a','wcag2aa']).analyze();const errors=result.violations.filter(v=>['critical','serious'].includes(v.impact??''));expect(errors).toEqual([]);audits.push({width,serious_or_critical:errors.length})}
 await shot('10-mobile-geometry-dark');await page.setViewportSize({width:1440,height:1000});await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Mesh optimization',exact:true}).click();await page.getByRole('button',{name:'Add mesh optimization',exact:true}).click();await page.locator('.geometry-group').filter({hasText:'Surface & outline precision'}).locator('summary').first().click();await shot('11-mesh-optimization-dark');await page.getByRole('button',{name:'Close settings',exact:true}).click();await ready();await shot('12-optimized-solid-dark')
 writeFileSync('../docs/m6/replay/m5/replay/m4/accessibility.json',JSON.stringify({geometry_dialog:audits,themes:['light','dark'],external_processing:false},null,2))
})
