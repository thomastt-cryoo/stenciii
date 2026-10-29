import { useState } from 'react'
import type { ParameterRegistry } from './registry'
import type { ProjectDocument } from './project'
import { operations } from './project'
import { artworkGroups, artworkNames } from './artwork'
import OperationEditor from './OperationEditor'
import { editor } from './session'
export default function ArtworkWorkbench({ doc, registry }: { doc: ProjectDocument; registry: ParameterRegistry }) {
  const [group, setGroup] = useState(operations(doc).some(o => o.type === 'text') && !operations(doc).some(o => o.type === 'source') ? 'Text' : Object.keys(artworkGroups)[0])
  const ops = operations(doc).filter(o => artworkGroups[group].includes(o.type))
  return <div className="artwork-workbench"><nav className="artwork-groups" aria-label="Artwork sections">{Object.keys(artworkGroups).map(g => <button key={g} aria-pressed={g === group} onClick={() => setGroup(g)}>{g}</button>)}</nav>
    <p className="section-note">Choose an operation to adjust. Its settings affect only that instance; shared instances affect each pass using them.</p>
    {ops.map((op, index) => <details className="artwork-operation" key={op.id} open={ops.length === 1 || undefined}><summary>{artworkNames[op.type]}{ops.filter(o => o.type === op.type).length > 1 ? ` ${index + 1}` : ''}</summary><OperationEditor op={op} registry={registry} /></details>)}
    {!ops.length && <p className="section-note">This artwork does not use {group.toLowerCase()} yet. Add a compatible operation in Processing steps.{group === 'Text' && <> Text is a separate artwork source. <button className="text-button" onClick={() => editor.createText()}>Create a separate text stencil</button></>}</p>}
  </div>
}
