import { api, artifactUrl, partUrl, type NodeRun } from '../api'
import { badgesFor, type Badge } from '../badges'
import { compileRecipe, projectName, adjustmentRecipe as quickRecipe, type ProjectDocument } from './project'
import { activeStyle } from './recipes'
import { artworkNames, type PreviewStage } from './artwork'

export interface Artifact {
  id: string; step: string; label: string; kind: 'solid' | 'parts'; url: string; filename: string
  info: Record<string, any>; findings: Badge[]; mesh: MeshCheck | null; outline?: Outline
}
export interface ArtworkComparison { url: string; width: number; height: number; marginX: number; marginY: number; flip: boolean }
export interface Outline { url: string; filename: string }
export interface ArtifactSet { artifacts: Artifact[]; findings: Badge[]; comparison?: ArtworkComparison; outline?: Outline; outlines?: Record<string, Outline>; stages?: PreviewStage[] }
export interface MeshCheck { triangles: number; size: number[]; degenerate: number }

/** Inspect real float32 output; invalid facets block export instead of being silently repaired. */
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
  const result: ArtifactSet = { artifacts, findings, stages: [], outlines: {} }
  const recipe = quickRecipe(doc)
  const graph = compileRecipe(doc)
  const textSources = graph.nodes.filter(n=>n.type==='text'), builders = graph.nodes.filter(n=>['stencil','vector_stencil'].includes(n.type))
  const compareBuilder = recipe?.build ?? (textSources.length === 1 && builders.length === 1 ? builders[0] : null)
  const compareSource = recipe ? graph.edges.find(e=>e.to[0]===recipe.threshold.id)?.from[0] : textSources.length === 1 ? textSources[0].id : null
  const base = projectName(doc).replace(/[^a-z0-9 ._-]/gi, '_').slice(0, 80) || 'stencil'
  const name = `${base}-${recipe ? activeStyle(doc) : 'custom'}`
  try {
    for (const n of graph.nodes) {
      const run = runs[n.id]
      if (!run?.key || run.state !== 'done') continue
      const available = Object.entries(run.outputs ?? {}).filter(([, o]) => o.available)
      for (const [out, o] of available) {
        const info = api.peekInfo(run.key, out) ?? {}
        // An empty diagnostic "removed" output means cleanup removed nothing.
        // It is not missing artwork. Connected auxiliary outputs still get checked.
        const auxiliary = ['removed', 'rounded'].includes(out) && !graph.edges.some(e => e.from[0] === n.id && e.from[1] === out)
        const checks = auxiliary ? [] : badgesFor(n.type, n.params, info)
        findings.push(...checks)
        if (['image', 'mask', 'shapes'].includes(o.type)) {
          const url = artifactUrl(run.key, out)
          if (url) result.stages!.push({ id: `${n.id}/${out}`, step: n.id, port: out, label: `${artworkNames[n.type] ?? n.type}${['removed', 'rounded'].includes(out) ? ' · Removed details' : ''}`, kind: o.type, url: URL.createObjectURL(await (await fetch(url)).blob()), info })
        }
        if (compareBuilder && n.id === compareSource && ['image','mask'].includes(o.type) && !graph.nodes.some(n=>n.type==='shapes_to_mask')) {
          const sourceUrl = artifactUrl(run.key, out)
          if (sourceUrl) {
            const width = Number(compareBuilder.params.width_mm ?? 200), margin = Number(compareBuilder.params.margin_mm ?? 8), vector = compareBuilder.type === 'vector_stencil'
            const gridMargin = Math.ceil(margin / (width / info.width))
            const scale = width / (info.width + 2 * gridMargin)
            result.comparison = { url: URL.createObjectURL(await (await fetch(sourceUrl)).blob()), width: vector ? width - 2 * margin : info.width * scale, height: vector ? (width - 2 * margin) * info.height / info.width : info.height * scale, marginX: vector ? margin : gridMargin * scale, marginY: vector ? margin : gridMargin * scale, flip: !!compareBuilder.params.flip }
          }
        }
        if (n.type === 'trace' && o.type === 'shapes' && out === 'shapes') {
          const sourceUrl = artifactUrl(run.key, out)
          if (sourceUrl) { const outline = { url: URL.createObjectURL(await (await fetch(sourceUrl)).blob()), filename: `${name}-${n.id}-traced-outlines.svg` }; result.outlines![n.id] = outline; result.outline = outline }
        }
        if (o.type !== 'solid' && o.type !== 'parts') continue
        const sourceUrl = artifactUrl(run.key, out)
        if (!sourceUrl) continue
        const response = await fetch(sourceUrl)
        const blob = await response.blob()
        const files = Object.keys(info.files ?? {})
        const solid = o.type === 'solid' || files.length === 1
        const mesh = solid ? inspectStl(await blob.arrayBuffer()) : null
        if (mesh?.degenerate) {
          const warning: Badge = { level: 'error', text: `${mesh.degenerate} zero-area triangles found. Export is blocked. Try another style or lower detail.` }
          checks.push(warning); findings.push(warning)
        }
        if (!solid) for (const file of files.filter(f => /\.stl$/i.test(f))) {
          const check = inspectStl(await (await fetch(partUrl(run.key, out, file))).arrayBuffer())
          if (check.degenerate) { const bad: Badge = { level: 'error', text: `${file} has ${check.degenerate} zero-area triangles. Export is blocked.` }; checks.push(bad); findings.push(bad) }
        }
        // Own this URL independently of the worker/cache. Later runs cannot revoke a displayed result.
        const url = URL.createObjectURL(blob)
        artifacts.push({ id: `${n.id}/${out}`, step: n.id, label: n.type === 'vector_stencil' || n.type === 'stencil' ? 'Stencil plate' : n.type.replace(/_/g, ' '), kind: o.type, url, filename: solid ? `${name}${artifacts.length ? `-${n.id}` : ''}.stl` : `${name}-${n.id}-parts.zip`, info, findings: checks, mesh })
      }
    }
    const nearest = (id: string, seen = new Set<string>()): string[] => {
      if (seen.has(id)) return []; seen.add(id)
      if (result.outlines![id]) return [id]
      return [...new Set(graph.edges.filter(e=>e.to[0]===id).flatMap(e=>nearest(e.from[0],seen)))]
    }
    for (const artifact of artifacts) { const traces = nearest(artifact.step); if (traces.length === 1) artifact.outline = result.outlines![traces[0]] }
    result.findings = findings.filter((f, i, a) => a.findIndex(x => x.level === f.level && x.text === f.text) === i)
    return result
  } catch (e) { releaseArtifacts(result); throw e }
}
export function releaseArtifacts(value: ArtifactSet) { value.artifacts.forEach(a => URL.revokeObjectURL(a.url)); value.stages?.forEach(s => URL.revokeObjectURL(s.url)); if (value.comparison) URL.revokeObjectURL(value.comparison.url); if (value.outlines) Object.values(value.outlines).forEach(o=>URL.revokeObjectURL(o.url)); else if (value.outline) URL.revokeObjectURL(value.outline.url) }
