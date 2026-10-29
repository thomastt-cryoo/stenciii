import { api, artifactUrl, partUrl, type NodeRun } from '../api'
import { badgesFor, type Badge } from '../badges'
import { compileRecipe, projectName, adjustmentRecipe as quickRecipe, type ProjectDocument } from './project'
import { auditMesh } from './meshAuditClient'
import { meshProblems, type MeshCheck } from './meshAudit'
export { inspectStl } from './meshAudit'
export type { MeshCheck } from './meshAudit'
import { activeStyle } from './recipes'
import { artworkNames, type PreviewStage } from './artwork'

export interface Artifact {
  id: string; step: string; label: string; kind: 'solid' | 'parts'; url: string; filename: string
  info: Record<string, any>; findings: Badge[]; mesh: MeshCheck | null; outline?: Outline; intermediate?: boolean
}
export interface ArtworkComparison { url: string; width: number; height: number; marginX: number; marginY: number; flip: boolean }
export interface Outline { url: string; filename: string }
export interface ArtifactSet { artifacts: Artifact[]; findings: Badge[]; comparison?: ArtworkComparison; outline?: Outline; outlines?: Record<string, Outline>; stages?: PreviewStage[] }
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
        let mesh: MeshCheck | null = null
        if(solid)try{mesh=await auditMesh(await blob.arrayBuffer())}catch(error){
          if(n.type==='remesh')throw error
          const bad:Badge={level:'error',text:String(error instanceof Error?error.message:error)};checks.push(bad);findings.push(bad)
        }
        if (mesh && meshProblems(mesh).length) {
          const warning: Badge = { level: 'error', text: `${meshProblems(mesh).join('; ')} found. Export is blocked. Try another style or lower detail.` }
          checks.push(warning); findings.push(warning)
        }
        if (!solid) for (const file of files.filter(f => /\.stl$/i.test(f))) {
          const check = await auditMesh(await (await fetch(partUrl(run.key, out, file))).arrayBuffer())
          if (meshProblems(check).length) { const bad: Badge = { level: 'error', text: `${file} has ${meshProblems(check).join('; ')}. Export is blocked.` }; checks.push(bad); findings.push(bad) }
        }
        if(mesh && ['stencil','vector_stencil','remesh'].includes(n.type) && mesh.components>1){const bad:Badge={level:'error',text:`${mesh.components} disconnected solid components found. Export is blocked.`};checks.push(bad);findings.push(bad)}
        if(n.type === 'remesh' && mesh && (!mesh.closed || mesh.components>1)) throw Error('Mesh optimization failed independent validation: '+meshProblems(mesh).join('; ')+'. The previous result is retained.')
        // Own this URL independently of the worker/cache. Later runs cannot revoke a displayed result.
        const url = URL.createObjectURL(blob)
        artifacts.push({ id: `${n.id}/${out}`, step: n.id, label: n.type === 'vector_stencil' || n.type === 'stencil' ? 'Stencil plate' : n.type === 'remesh' ? 'Optimized stencil' : n.type.replace(/_/g, ' '), kind: o.type, url, filename: solid ? `${name}${artifacts.length ? `-${n.id}` : ''}.stl` : `${name}-${n.id}-parts.zip`, info, findings: checks, mesh, intermediate: graph.edges.some(e=>e.from[0]===n.id&&e.from[1]===out) })
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
