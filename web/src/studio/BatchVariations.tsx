import type {BatchVariation,variationFields} from './batchPlan'

interface Props {
 fields:ReturnType<typeof variationFields>;variations:BatchVariation[];disabled:boolean
 images:{value:string;label:string}[]
 change:(id:number,patch:Partial<BatchVariation>)=>void;remove:(id:number)=>void;add:()=>void
}
export default function BatchVariations({fields,variations,disabled,images,change,remove,add}:Props){
 return <fieldset disabled={disabled}><legend>Parameter variations</legend><p>Each combination makes a separate job. Inactive settings retain their engine meaning.</p>
  {variations.map((variation,index)=>{
   const field=fields.find(f=>f.step===variation.step&&f.parameter.name===variation.parameter),p=field?.parameter
   let selected:unknown[]=[];try{const parsed=JSON.parse(variation.values);if(Array.isArray(parsed))selected=parsed}catch{}
   const choices=p?.kind==='bool'?[{value:false,label:'Off'},{value:true,label:'On'}]:p?.kind==='choice'?(p.choices??[]).map(value=>({value,label:value.replace(/_/g,' ')})):field?.type==='source'&&p?.name==='image_id'?images:[]
   return <div className="batch-variation" key={variation.id}>
    <label>Setting {index+1}<select aria-label={`Variation setting ${index+1}`} value={JSON.stringify([variation.step,variation.parameter])} onChange={e=>{
     const [step,parameter]=JSON.parse(e.target.value),next=fields.find(f=>f.step===step&&f.parameter.name===parameter)!.parameter
     change(variation.id,{step,parameter,mode:['int','float'].includes(next.kind)?'range':'list',start:String(next.default),end:String(next.default),increment:String(next.step??1),values:JSON.stringify(next.choices?.slice(0,2)??(next.kind==='bool'?[false,true]:[next.default]))})
    }}>{fields.map(f=><option key={JSON.stringify([f.step,f.parameter.name])} value={JSON.stringify([f.step,f.parameter.name])}>{f.label}</option>)}</select></label>
    {p&&['int','float'].includes(p.kind)?<>
     <label>Values<select aria-label={`Variation values mode ${index+1}`} value={variation.mode} onChange={e=>change(variation.id,{mode:e.target.value as 'range'|'list'})}><option value="range">Start, end and increment</option><option value="list">Explicit values</option></select></label>
     {variation.mode==='range'?<div className="batch-range">{(['start','end','increment'] as const).map(key=><label key={key}>{key==='increment'?'Increment':key==='start'?'Start':'End'}<input type="number" aria-label={`Variation ${key} ${index+1}`} step="any" value={variation[key]} onChange={e=>change(variation.id,{[key]:e.target.value})}/></label>)}</div>:<label>Values as a JSON list<input aria-label={`Variation explicit values ${index+1}`} value={variation.values} onChange={e=>change(variation.id,{values:e.target.value})}/></label>}
     <small>Allowed {p.min}–{p.max}{p.kind==='int'?' · whole numbers':''}. Control increment {p.step}.</small>
    </>:choices.length?<div className="batch-choices" role="group" aria-label={`Variation choices ${index+1}`}>{choices.map(({value,label})=><label key={String(value)}><input type="checkbox" checked={selected.includes(value)} onChange={e=>change(variation.id,{values:JSON.stringify(e.target.checked?[...selected,value]:selected.filter(v=>v!==value))})}/>{label}</label>)}</div>:<label>Values as a JSON list<textarea aria-label={`Variation explicit values ${index+1}`} placeholder={'["First text", "Second text"]'} value={variation.values} onChange={e=>change(variation.id,{values:e.target.value})}/></label>}
    <button onClick={()=>remove(variation.id)}>Remove variation {index+1}</button>
   </div>
  })}
  <button disabled={!fields.length} onClick={add}>Add parameter variation</button>
 </fieldset>
}
