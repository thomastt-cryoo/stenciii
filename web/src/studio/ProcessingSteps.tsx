import {isManufacturing} from './manufacturing'
import { useState } from 'react'
import type { ParameterRegistry } from './registry'
import { compileRecipe, operations, type ProjectDocument } from './project'
import { artworkNames, isArtwork, passList, canBypass, bypassArtwork, enableArtwork, duplicateArtwork, moveArtwork, insertionOptions, insertArtwork, inputChoices, connectInput, renamePass, resetStyle, duplicatePass, removeArtwork } from './artwork'
import { editor } from './session'
import { isGeometry, geometryType } from './geometry'
import OperationEditor from './OperationEditor'

export default function ProcessingSteps({ doc, registry }: { doc: ProjectDocument; registry: ParameterRegistry }) {
  try { compileRecipe(doc) } catch { return <p className="section-note">This saved project contains an unavailable processing connection. Its complete data is preserved. Save a copy or review Compatibility before changing its steps.</p> }
  return <ValidSteps doc={doc} registry={registry} />
}
function ValidSteps({ doc, registry }: { doc: ProjectDocument; registry: ParameterRegistry }) {
  const passes = passList(doc), [passId, setPass] = useState(''), [selected, setSelected] = useState(''), [newName, setNewName] = useState('')
  const pass = passes.find(p => p.id === passId) ?? passes[0], catalogue = [...registry.types.values()], graph = compileRecipe(doc)
  if (!pass) return <p>This project has no output yet. Create artwork to begin.</p>
  const action = (label: string, update: (doc: ProjectDocument) => ProjectDocument) => editor.command(label, update)
  const shared = (id: string) => passes.filter(p => p.steps.some(s => s.id === id)).length
  const movable = (id: string, direction: -1 | 1) => { try { moveArtwork(doc, id, direction, catalogue); return true } catch { return false } }
  return <div className="processing-editor"><p className="section-note">Steps use compatible artwork formats. A shared adjustment affects every named pass that uses it. Choose a manufacturing step to edit its saved settings.</p>
    <label className="setting-choice"><span>Processing pass</span><select aria-label="Processing pass" value={pass.id} onChange={e => { setPass(e.target.value); setSelected('') }}>{passes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="pass-name"><input aria-label="Pass name" placeholder={pass.name} value={newName} onChange={e => setNewName(e.target.value)} /><button disabled={!newName.trim()} onClick={() => { action('Rename processing pass', d => renamePass(d, pass.id, newName.trim())); setNewName('') }}>Rename pass</button></div>
    <div className="editor-actions"><button disabled={pass.steps.some(s=>!isArtwork(s.type)&&!['stencil','vector_stencil','remesh','complexity'].includes(s.type))} onClick={()=>action('Duplicate artwork pass',d=>duplicatePass(d,pass.id,catalogue))}>Duplicate artwork pass</button></div>
    <ol className="processing-list">{pass.steps.map((op, index) => {
      const def = registry.types.get(geometryType(op.type)), optional = canBypass(doc, op.id, catalogue), editable = isArtwork(op.type) || isGeometry(op.type) || isManufacturing(op.type)
      return <li key={op.id} className={selected === op.id ? 'selected' : ''}>
        <div className="step-heading"><button className="step-select" aria-expanded={selected === op.id} onClick={() => setSelected(selected === op.id ? '' : op.id)}><span className="step-number">{index + 1}</span><span>{doc.raw.stencilStudio?.passNames?.[op.id] ?? artworkNames[op.type] ?? def?.label ?? 'Unavailable saved operation'}{shared(op.id) > 1 && <small>Shared by {shared(op.id)} passes</small>}</span></button>
          {def?.outputs.filter(p => ['image','mask','shapes','solid'].includes(p.type) && !(p.type === 'solid' && graph.edges.some(e=>e.to[0]===op.id&&e.to[1]==='tiles'))).map(p => <button className="text-button" key={p.name} onClick={() => editor.preview(op.id, p.name)}>Preview{['removed','rounded'].includes(p.name) ? ' removed' : ''}</button>)}
        </div>
        {selected === op.id && <div className="step-body">
          {def?.inputs.map(input => {
            const actual = graph.edges.find(e => e.to[0] === op.id && e.to[1] === input.name), choices = inputChoices(doc, op.id, input.name, catalogue), insert = insertionOptions(input.type, catalogue)
            return <div className="step-input" key={input.name}><label className="setting-choice"><span>{input.name === 'image' ? 'Use image from' : input.name === 'mask' ? 'Use paint from' : input.name === 'shapes' ? 'Use outlines from' : 'Saved input'}</span><select aria-label={`Input ${op.id}.${input.name}`} disabled={!editable && !['stencil','vector_stencil','remesh','complexity'].includes(op.type)} value={actual?.from.join('/') ?? ''} onChange={e => { const c = choices.find(c => c.from.join('/') === e.target.value); if (c) action('Choose artwork input', d => connectInput(d, op.id, input.name, c.from, catalogue)) }}><option value="">No input</option>{choices.map(c => <option key={c.from.join('/')} value={c.from.join('/')}>{c.label}</option>)}</select></label>
              {actual && insert.length > 0 && <label className="setting-choice"><span>Add before this step</span><select aria-label={`Add before ${op.id}`} value="" onChange={e => { if (e.target.value) action('Add artwork processing', d => insertArtwork(d, op.id, input.name, e.target.value, catalogue)) }}><option value="">Choose an operation…</option>{insert.map(o => <option key={o.type} value={o.type}>{artworkNames[o.type]}{o.pair ? ` + ${artworkNames[o.pair].toLowerCase()}` : ''}</option>)}</select></label>}
            </div>
          })}
          {editable ? <OperationEditor op={op} registry={registry} /> : <p className="section-note">This saved output and all of its settings are preserved. Its manufacturing editor belongs to M5.</p>}
          <div className="step-actions"><button disabled={!optional} onClick={() => action('Disable artwork step', d => bypassArtwork(d, op.id, catalogue))}>Disable step</button><button disabled={!optional} onClick={() => action('Duplicate artwork step', d => duplicateArtwork(d, op.id, catalogue))}>Duplicate step</button><button disabled={!editable || !optional && graph.edges.some(e=>e.from[0]===op.id)} onClick={() => action('Remove artwork step', d => removeArtwork(d, op.id, catalogue))}>Remove step</button><button disabled={!optional || !movable(op.id, -1)} onClick={() => action('Move artwork earlier', d => moveArtwork(d, op.id, -1, catalogue))}>Move earlier</button><button disabled={!optional || !movable(op.id, 1)} onClick={() => action('Move artwork later', d => moveArtwork(d, op.id, 1, catalogue))}>Move later</button></div>
          {!optional && <p className="parameter-help">Source and format-conversion steps cannot be bypassed while their results are in use. Compatible input choices exclude circular dependencies. Reordering shared branches is protected.</p>}
        </div>}
      </li>
    })}</ol>
    {Object.entries<any>(doc.raw.stencilStudio?.disabled ?? {}).filter(([, saved]) => saved?.node && typeof saved.node === 'object').map(([id, saved]) => <div className="disabled-step" key={id}><span>{artworkNames[(saved.node.data ?? saved.node).type] ?? 'Saved operation'} · Disabled · settings retained</span><button aria-label={`Enable ${id}`} onClick={() => action('Enable artwork step', d => enableArtwork(d, id, catalogue))}>Enable step</button></div>)}
    <details className="reset-style"><summary>Restore a workflow template</summary><p>A style is a starting recipe. This replaces the current single artwork pass and keeps its complete previous project for undo and recovery. Operation presets only change the selected step.</p><button disabled={passes.length !== 1 || operations(doc).some(n => !isArtwork(n.type) && !['stencil','vector_stencil','remesh','complexity'].includes(n.type))} onClick={() => action('Restore original style recipe', d => resetStyle(d, catalogue))}>Restore original style recipe</button></details>
  </div>
}
