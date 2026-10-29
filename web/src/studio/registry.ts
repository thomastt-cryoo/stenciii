import {manufacturingHelp, manufacturingNames} from './manufacturing'
import type { NodeType, ParamDef } from '../api'
import mapping from '../../../docs/audit/parameter-mapping.json' with { type: 'json' }
import type { Operation } from './project'
import { geometryHelp } from './geometry'
import { artworkHelp, artworkNames } from './artwork'

export const categories = [
  'Artwork and image cleanup', 'Size and print settings', 'Bridges and stencil geometry', 'Colours and layers',
  'Mesh optimization', 'Tiles and large stencils', 'Mounting and borders', 'Screws, connectors and hardware',
  'Processing steps', 'Presets and history', 'Batch processing and diagnostics', 'Compatibility',
] as const
export const categoryFor = (type: string, p: string) => {
  if (type === 'export') return categories[11]
  if (['stencil', 'vector_stencil'].includes(type)) return ['width_mm', 'thickness_mm', 'margin_mm', 'flip', 'layer_height_mm', 'extra_top_layers'].includes(p) ? categories[1] : p === 'detail' ? categories[4] : p === 'tile_method' ? categories[5] : categories[2]
  if (['split_colours', 'tone_patterns', 'colour_set'].includes(type)) return categories[3]
  if (type === 'remesh') return categories[4]
  if (['tile_layout', 'tiles', 'fragments'].includes(type)) return categories[5]
  if (['pads', 'ring'].includes(type)) return categories[6]
  if (type === 'hardware') return categories[7]
  return categories[0]
}
export interface Setting { key: string; type: string; operationLabel: string; parameter: ParamDef; category: string; dependency: string }
export interface WorkflowContext { hasLayout?: boolean; toneCount?: number }

/** The executed catalogue supplies every constraint. The audit only supplies routing/help. */
export class ParameterRegistry {
  readonly types: Map<string, NodeType>
  readonly settings: Setting[]
  constructor(catalogue: NodeType[]) {
    this.types = new Map(catalogue.map(t => [t.id, t]))
    const plan = new Map(mapping.map(p => [p.key, p]))
    this.settings = catalogue.flatMap(t => t.params.map(p => ({ key: `${t.id}.${p.name}`, type: t.id, operationLabel: manufacturingNames[t.id] ?? artworkNames[t.id] ?? t.label.replace(/\s*\(old\)$/, ''), parameter: p, category: categoryFor(t.id, p.name), dependency: plan.get(`${t.id}.${p.name}`)?.dependency ?? t.doc })))
  }
  defaults(type: string) { return Object.fromEntries((this.types.get(type)?.params ?? []).map(p => [p.name, p.default])) }
  search(query: string, category?: string) {
    const text = query.toLowerCase().trim()
    const aliases: Record<string, string> = { 'smooth edges': 'smooth', 'remove small dots': 'remove_islands', 'remove specks': 'delete_specks', 'fill small holes': 'fill_holes', 'round tips': 'round_corners', 'thicken paint': 'morphology', 'font': 'text.font' }
    const words = (aliases[text] ?? text).split(/\s+/).filter(Boolean)
    const score = (s: Setting) => {
      const exact = [s.key, s.parameter.name, s.parameter.label, s.operationLabel].map(v => v.toLowerCase())
      return exact.includes(text) ? 0 : exact.some(v => v.startsWith(text)) ? 1 : words.every(w => exact.some(v => v.includes(w))) ? 2 : 3
    }
    return this.settings.filter(s => (!category || s.category === category) && words.every(q => `${s.key} ${s.parameter.label} ${s.operationLabel} ${s.category} ${s.dependency} ${manufacturingHelp[s.key] ?? geometryHelp[s.key] ?? artworkHelp[s.key] ?? ''}`.toLowerCase().includes(q))).sort((a, b) => text ? score(a) - score(b) : 0)
  }
  instances(setting: Setting, operations: Operation[]) { return operations.filter(o => (o.type === 'complexity' ? 'remesh' : o.type) === setting.type) }
  /** Availability is a projection only. Inactive values are never removed or reset. */
  availability(setting: Setting, given: Record<string, unknown>, context: WorkflowContext = {}) {
    const p = { ...this.defaults(setting.type), ...given }, key = setting.parameter.name, type = setting.type
    const inactive = (reason: string) => ({ active: false, reason })
    if (type === 'stencil' || type === 'vector_stencil') {
      if (['width_mm', 'margin_mm'].includes(key) && context.hasLayout) return inactive('The tile layout supplies this value. The saved plate value is retained.')
      if (['bridge_min_angle_deg', 'bridge_max_length', 'bridge_passes'].includes(key) && p.bridge_spacing !== 'spread') return inactive('Choose spread bridge spacing to use this setting.')
      if (type === 'stencil' && key === 'bridge_min_angle_deg' && Number(p.bridge_passes) === 1) return inactive('One raster pass uses the fallback route. Choose at least two spread passes for angular separation.')
      if (key === 'z_bridging' && (!p.raised_bridges || Math.round(Number(p.thickness_mm)/Number(p.layer_height_mm)) < 2)) return inactive('Raised bridges need at least two base layers to use a height strategy.')
      if (key === 'first_layer_taper_mm' && Number(p.min_first_layer_width_mm) === 0) return inactive('Set minimum first-layer width above zero to use the taper.')
      if (key === 'tile_method' && !context.hasLayout) return inactive('This method applies to a layout made before building.')
    }
    if (type === 'morphology') {
      const kernelOps = ['erode', 'dilate', 'open', 'close', 'gradient', 'white_hat', 'black_hat']
      if (['kernel', 'radius', 'angle'].includes(key) && !kernelOps.includes(String(p.op))) return inactive('This operation does not use a kernel.')
      if (key === 'angle' && (p.kernel !== 'line' || !kernelOps.includes(String(p.op)))) return inactive('The angle only applies to a line kernel in a neighbourhood operation.')
      if (key === 'iterations' && ['skeleton', 'hit_or_miss'].includes(String(p.op))) return inactive('This operation computes its complete result without a pass count.')
      if (['custom', 'rotate'].includes(key) && p.op !== 'hit_or_miss') return inactive('Choose hit-or-miss to use pattern settings.')
      if (['pattern', 'custom', 'rotate'].includes(key) && p.op !== 'hit_or_miss') return inactive('Choose hit-or-miss to use pattern settings.')
      if (['custom', 'rotate'].includes(key) && p.pattern !== 'custom') return inactive('Choose a custom pattern to use this setting.')
    }
    if (type === 'remesh' && key === 'decimate_mm' && !p.decimate) return inactive('Enable decimation to use this surface tolerance.')
    if (type==='tone_patterns' && /^(spacing|cover)_\d+$/.test(key) && ['solid','empty'].includes(String(p[`kind_${key.split('_').at(-1)}`]))) return inactive('Solid and empty tones do not use pattern spacing or coverage. The saved override is retained.')
    if (type === 'tone_patterns' && context.toneCount !== undefined && /_\d+$/.test(key) && Number(key.split('_').at(-1)) > context.toneCount - 2) return inactive('This intermediate tone is not present. Its override is retained.')
    if (type === 'pads') {
      if (['thread_clearance', 'long_edge'].includes(key) && p.pad_thread === 'none') return inactive('Choose a pad thread to add pads.')
      if (['mount_threaded', 'mount_clearance', 'hole_spacing', 'joiner_offset', 'extend'].includes(key) && p.mount_screw === 'none') return inactive('Choose a mounting screw to use this setting.')
    }
    if (type === 'ring') {
      if (['screw_length', 'nut_clearance', 'tip_taper', 'tip_pitches'].includes(key) && !p.hardware) return inactive('Enable the bolt and nut to use this setting.')
      if (['number_size', 'pocket_depth'].includes(key) && !p.number_parts) return inactive('Enable slab numbering to use this setting.')
      if (key === 'hole_spacing' && !p.wall_holes) return inactive('Enable outer mounting holes to use this spacing.')
    }
    if (type === 'hardware') {
      if (key.startsWith('plate_') && !p.plate) return inactive('Enable hand-sized plates to use this setting.')
      if (['connector', 'connector_d'].includes(key) && !p.fit_test) return inactive('Enable the connector fit-test strip to use this setting.')
    }
    if (type === 'colour_set') {
      if (key !== 'holes' && Number(p.holes) === 0) return inactive('Add registration holes to use this setting.')
      if (['pin_clearance', 'pin_length'].includes(key) && !p.pins) return inactive('Enable alignment pins to use this setting.')
    }
    return { active: true, reason: setting.dependency }
  }
  validate(type: string, name: string, value: unknown): void {
    const p = this.types.get(type)?.params.find(p => p.name === name)
    if (!p) throw new Error('This setting is not available in this engine version.')
    if (['int', 'float'].includes(p.kind) && (typeof value !== 'number' || !Number.isFinite(value) || value < p.min! || value > p.max! || (p.kind === 'int' && !Number.isInteger(value)))) throw new Error(`Enter a value from ${p.min} to ${p.max}.`)
    if (p.kind === 'bool' && typeof value !== 'boolean') throw new Error('Choose on or off.')
    if (p.kind === 'choice' && !p.choices?.includes(String(value))) throw new Error('Choose one of the available options.')
    if (['string', 'text'].includes(p.kind) && typeof value !== 'string') throw new Error('Enter text for this setting.')
  }
}
