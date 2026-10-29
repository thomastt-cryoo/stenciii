import { api, artifactUrl, type NodeRun } from '../api'
import { badgesFor, type Badge } from '../badges'
import { compileRecipe, type ProjectDocument } from './project'

export interface Artifact {
  id: string; step: string; label: string; kind: 'solid' | 'parts'; url: string; filename: string
  info: Record<string, any>; findings: Badge[]; mesh: MeshCheck | null
}
export interface ArtifactSet { artifacts: Artifact[]; findings: Badge[] }
export interface MeshCheck { triangles: number; size: number[]; degenerate: number }

/** Inspect real float32 output; validation never repairs geometry. M0 raster defects stay visible. */
export function inspectStl(bytes: ArrayBuffer): MeshCheck {
  if (bytes.byteLength < 84) throw new Error('The generated STL is incomplete. Try making the stencil again.')
  const view = new DataView(bytes), triangles = view.getUint32(80, true)
  if (!triangles || bytes.byteLength !== 84 + triangles * 50) throw new Error('The generated STL has an invalid triangle count.')
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  let degenerate = 0
  for (let i = 0; i < triangles; i++) {
    const p = Array.from({ length: 9 }, (_, j) => view.getFloat32(96 + 50 * i + j * 4, true))
    if (p.some(x => !Number.isFinite(x))) throw new Error('The output contains invalid geometry coordinates.')
    for (let j = 0; j < 9; j++) { const k = j % 3; lo[k] = Math.min(lo[k], p[j]); hi[k] = Math.max(hi[k], p[j]) }
    const a = [p[3]-p[0], p[4]-p[1], p[5]-p[2]], b = [p[6]-p[0], p[7]-p[1], p[8]-p[2]]
    if ((a[1]*b[2]-a[2]*b[1])**2 + (a[2]*b[0]-a[0]*b[2])**2 + (a[0]*b[1]-a[1]*b[0])**2 <= 1e-24) degenerate++
  }
  return { triangles, size: hi.map((v, i) => v - lo[i]), degenerate }
}

export async function captureArtifacts(doc: ProjectDocument, runs: Record<string, NodeRun>): Promise<ArtifactSet> {
  const artifacts: Artifact[] = [], findings: Badge[] = []
  try {
    for (const n of compileRecipe(doc).nodes) {
      const run = runs[n.id]
      if (!run?.key || run.state !== 'done') continue
      const available = Object.entries(run.outputs ?? {}).filter(([, o]) => o.available)
      for (const [out, o] of available) {
        const info = api.peekInfo(run.key, out) ?? {}
        const checks = badgesFor(n.type, n.params, info)
        findings.push(...checks)
        if (o.type !== 'solid' && o.type !== 'parts') continue
        const sourceUrl = artifactUrl(run.key, out)
        if (!sourceUrl) continue
        const response = await fetch(sourceUrl)
        const blob = await response.blob()
        const files = Object.keys(info.files ?? {})
        const solid = o.type === 'solid' || files.length === 1
        const mesh = solid ? inspectStl(await blob.arrayBuffer()) : null
        if (mesh?.degenerate) {
          const warning: Badge = { level: 'warn', text: `${mesh.degenerate} zero-area triangles found. Check this file in your slicer; the original engine output is unchanged.` }
          checks.push(warning); findings.push(warning)
        }
        // Own this URL independently of the worker/cache. Later runs cannot revoke a displayed result.
        const url = URL.createObjectURL(blob)
        artifacts.push({ id: `${n.id}/${out}`, step: n.id, label: n.type === 'vector_stencil' || n.type === 'stencil' ? 'Stencil plate' : n.type.replace(/_/g, ' '), kind: o.type, url, filename: solid ? files[0] ?? 'stencil.stl' : `${n.id}-parts.zip`, info, findings: checks, mesh })
      }
    }
    return { artifacts, findings: findings.filter((f, i, a) => a.findIndex(x => x.level === f.level && x.text === f.text) === i) }
  } catch (e) { releaseArtifacts({ artifacts, findings }); throw e }
}
export function releaseArtifacts(value: ArtifactSet) { value.artifacts.forEach(a => URL.revokeObjectURL(a.url)) }
