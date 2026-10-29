import { useEffect, useRef, useState } from 'react'
import { ArtworkPreviewClient } from './artworkPreview'
import { compileRecipe, operations, type ProjectDocument } from './project'
import { editor, useEditor } from './session'
import { cropAt, cropPixels, type Crop } from './crop'
import StageImage from './StageImage'
import OperationEditor from './OperationEditor'
import type { ParameterRegistry } from './registry'

export default function CropEditor({ doc, id, registry }: { doc: ProjectDocument; id: string; registry: ParameterRegistry }) {
  const dialog = useRef<HTMLDialogElement>(null), host = useRef<HTMLDivElement>(null), plane = useRef<HTMLDivElement>(null), client = useRef<ArtworkPreviewClient>()
  const [input, setInput] = useState<{ url: string; info: any }>(), [error, setError] = useState(''), [zoom, setZoom] = useState(1), [panMode, setPanMode] = useState(false), [pan, setPan] = useState({ x: 0, y: 0 }), [size, setSize] = useState({ w: 600, h: 380 }), [numeric, setNumeric] = useState(false)
  const pointer = useRef<{ handle: string; x: number; y: number }>(), urlRef = useRef('')
  const interacting = useEditor(s => s.interacting), op = operations(doc).find(n => n.id === id), graph = compileRecipe(doc), incoming = graph.edges.find(e => e.to[0] === id)
  const inputKey = JSON.stringify(graph.nodes.filter(n => n.id !== id)) + JSON.stringify(graph.edges) + JSON.stringify(doc.raw.images)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement; dialog.current!.showModal(); client.current = new ArtworkPreviewClient()
    const observer = new ResizeObserver(() => setSize({ w: host.current!.clientWidth, h: host.current!.clientHeight })); observer.observe(host.current!)
    return () => { editor.end(); client.current?.dispose(); observer.disconnect(); if (urlRef.current) URL.revokeObjectURL(urlRef.current); opener?.focus() }
  }, [])
  useEffect(() => {
    let alive = true
    if (incoming) void client.current!.render(doc, incoming.from[0], incoming.from[1]).then(next => {
      if (!alive) { URL.revokeObjectURL(next.url); return }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = next.url; setInput(next); setError('')
    }).catch(e => alive && setError(e.message))
    return () => { alive = false }
  }, [inputKey, incoming?.from[0], incoming?.from[1]])
  if (!op) return null
  const p = Object.fromEntries(['crop_left','crop_top','crop_right','crop_bottom'].map(k => [k, Number(op.params[k] ?? 0)])) as unknown as Crop
  const width = input?.info.width ?? 1, height = input?.info.height ?? 1, bounds = cropPixels(p, width, height), scale = Math.min((size.w - 70) / width, (size.h - 65) / height)
  const change = (handle: string, clientX: number, clientY: number) => { const box = plane.current!.getBoundingClientRect(); editor.parameters(id, { ...cropAt(p, handle, (clientX - box.left) / box.width * width, (clientY - box.top) / box.height * height, width, height) }, 'Crop artwork') }
  const close = () => editor.crop(null)
  return <dialog className="crop-dialog" ref={dialog} aria-labelledby="crop-title" onCancel={e => { e.preventDefault(); close() }}><header><div><h2 id="crop-title">Crop & rotate artwork</h2><p>Handles select exact input pixels. Crop happens before flip and rotation; the original file is kept.</p></div><button aria-label="Close crop editor" onClick={close}>×</button></header>
    <div className="crop-toolbar"><button onClick={() => setZoom(z => Math.max(.25, z / 1.25))} aria-label="Crop zoom out">−</button><output>{Math.round(zoom * 100)}%</output><button onClick={() => setZoom(z => Math.min(5, z * 1.25))} aria-label="Crop zoom in">+</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Fit crop</button><button aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>Pan artwork</button><button onClick={() => editor.parameters(id, { crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0 }, 'Reset crop')}>Reset crop</button><button onClick={() => editor.parameters(id, { turn: String((Number(op.params.turn ?? 0) + 90) % 360) }, 'Rotate artwork')}>Rotate 90°</button><button aria-pressed={!!op.params.flip_h} onClick={() => editor.edit(id, 'flip_h', !op.params.flip_h)}>Flip horizontally</button><button aria-pressed={!!op.params.flip_v} onClick={() => editor.edit(id, 'flip_v', !op.params.flip_v)}>Flip vertically</button></div>
    <div className="crop-columns"><section><h3>Crop selection</h3><div className={`crop-surface ${panMode ? 'pan-mode' : ''}`} ref={host} onPointerDown={e => { if (panMode) { pointer.current = { handle: 'pan', x: e.clientX - pan.x, y: e.clientY - pan.y }; e.currentTarget.setPointerCapture(e.pointerId) } }} onPointerMove={e => { if (pointer.current?.handle === 'pan') setPan({ x: e.clientX - pointer.current.x, y: e.clientY - pointer.current.y }) }} onPointerUp={() => { pointer.current = undefined }}>
      {input && <div className="crop-plane" ref={plane} data-width={width} data-height={height} style={{ width: width * scale, height: height * scale, transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}><img alt="Engine image before this crop" src={input.url} draggable={false} /><div className="crop-boundary" style={{ left: `${bounds.left / width * 100}%`, top: `${bounds.top / height * 100}%`, width: `${(bounds.right-bounds.left) / width * 100}%`, height: `${(bounds.bottom-bounds.top) / height * 100}%` }}>
        {['top-left','top','top-right','right','bottom-right','bottom','bottom-left','left'].map(handle => <button key={handle} className={`crop-handle ${handle}`} aria-label={`Crop ${handle.replace('-', ' ')}`} onPointerDown={e => { e.stopPropagation(); pointer.current = { handle, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); editor.begin() }} onPointerMove={e => { if (pointer.current?.handle === handle && e.currentTarget.hasPointerCapture(e.pointerId)) change(handle, e.clientX, e.clientY) }} onPointerUp={e => { pointer.current = undefined; e.currentTarget.releasePointerCapture(e.pointerId); editor.end() }} onPointerCancel={() => { pointer.current = undefined; editor.end() }} onKeyDown={e => {
          if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return
          e.preventDefault(); const delta = (e.shiftKey ? 10 : 1), x = handle.includes('left') ? bounds.left : handle.includes('right') ? bounds.right : width / 2, y = handle.includes('top') ? bounds.top : handle.includes('bottom') ? bounds.bottom : height / 2
          editor.parameters(id, { ...cropAt(p, handle, x + (e.key === 'ArrowRight' ? delta : e.key === 'ArrowLeft' ? -delta : 0), y + (e.key === 'ArrowDown' ? delta : e.key === 'ArrowUp' ? -delta : 0), width, height) }, 'Crop artwork')
        }} />)}
      </div></div>}
      {!input && <p className="view-message">{error || 'Preparing the input image…'}</p>}
    </div><p className="crop-measurement">{input && `${bounds.right-bounds.left} × ${bounds.bottom-bounds.top} selected input pixels · Arrow keys move a handle 1 pixel; Shift moves 10.`}</p></section>
      <section><h3>Actual prepared artwork</h3><div className="crop-result"><StageImage doc={doc} step={id} port="image" draft={interacting} /></div></section></div>
    <button className="numeric-crop-toggle" aria-expanded={numeric} onClick={() => setNumeric(!numeric)}>Numeric crop & transformation settings</button>{numeric && <div className="crop-numeric"><OperationEditor op={op} registry={registry} /></div>}
    <footer><span>{error || 'Final prepared preview uses the same Rust operation as the exported stencil.'}</span><button className="primary-button" onClick={close}>Done</button></footer>
  </dialog>
}
