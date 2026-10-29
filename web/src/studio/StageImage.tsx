import { useEffect, useRef, useState } from 'react'
import { ArtworkPreviewClient } from './artworkPreview'
import { signature, type ProjectDocument } from './project'
export default function StageImage({ doc, step, port, draft, zoom = 1, fit = 0, caption = true }: { doc: ProjectDocument; step: string; port: string; draft: boolean; zoom?: number; fit?: number; caption?: boolean }) {
  const client = useRef<ArtworkPreviewClient>(), ticket = useRef(0), urlRef = useRef('')
  const [result, setResult] = useState<{ url: string; info: any; request: string }>(), [busy, setBusy] = useState(true), [error, setError] = useState(''), [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number }>()
  const key = signature(doc)
  const request = JSON.stringify([key, step, port, draft]), matches = result?.request === request, ready = !!matches && !busy && !error
  useEffect(() => { client.current = new ArtworkPreviewClient(); return () => { ticket.current++; client.current?.dispose(); if (urlRef.current) URL.revokeObjectURL(urlRef.current) } }, [])
  useEffect(() => {
    const mine = ++ticket.current; setBusy(true); setError('')
    const timer = setTimeout(() => { void client.current!.render(doc, step, port, draft).then(next => {
      if (mine !== ticket.current) { URL.revokeObjectURL(next.url); return }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = next.url; setResult({ ...next, request }); setBusy(false)
    }).catch(e => { if (mine === ticket.current) { setError(e.message); setBusy(false) } }) }, draft ? 120 : 300)
    return () => { clearTimeout(timer); ticket.current++ }
  }, [key, step, port, draft])
  useEffect(() => setPan({ x: 0, y: 0 }), [fit, step, port])
  return <div className="stage-image" data-ready={ready} onPointerDown={e => { drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }) }} onPointerUp={() => { drag.current = undefined }}>
    {result && <img alt="Actual processed artwork" draggable={false} src={result.url} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} />}
    {caption && <span className="stage-state">{error || (busy || !matches ? 'Previous artwork · Updating' : draft ? 'Draft artwork preview' : 'Full-resolution artwork preview')}{result && ready && ` · ${result.info.width} × ${result.info.height} px`}</span>}
    {result && ready && !draft && <a className="stage-download" href={result.url} download={`${step}-${port}.${result.info.kind === 'shapes' ? 'svg' : 'png'}`} onPointerDown={e=>e.stopPropagation()}>Save artwork preview</a>}
  </div>
}
