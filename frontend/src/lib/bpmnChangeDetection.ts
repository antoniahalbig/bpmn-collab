import { BpmnModelerInstance, BpmnElement, BpmnBusinessObject } from './bpmnTypes'

/**
 * A snapshot of every non-root element on the canvas, keyed by element ID.
 * Used to diff the canvas before and after a remote XML import so we know
 * which elements actually changed and should be highlighted.
 */
export type ElementSnapshot = Map<string, {
  x: number
  y: number
  width: number
  height: number
  type: string | undefined
  label: string | undefined
  waypoints: string | undefined
  semantic: string
}>

/**
 * Serialises the semantically meaningful properties of a business object into
 * a single comparable string. This catches changes that don't affect geometry —
 * e.g. swapping a plain task for a service task, adding a loop, changing event
 * definitions — which would otherwise be invisible to a position/size diff.
 */
export function getBusinessObjectSemantic(bo: BpmnBusinessObject): string {
  const defs = Array.isArray(bo.eventDefinitions)
    ? bo.eventDefinitions.map((def: BpmnBusinessObject) => def.$type).join('|')
    : ''

  const loop = bo.loopCharacteristics?.$type ?? ''
  const triggered = bo.triggeredByEvent?.toString() ?? ''
  const cancelActivity = bo.cancelActivity?.toString() ?? ''
  const interrupting = bo.isInterrupting?.toString() ?? ''
  const isExpanded = typeof bo.isExpanded === 'boolean' ? bo.isExpanded.toString() : ''

  return [bo.$type, defs, loop, triggered, cancelActivity, interrupting, isExpanded]
    .filter(Boolean)
    .join('|')
}

/**
 * Records the current position, size, type, label, waypoints and semantic
 * fingerprint for every non-root element on the canvas.
 */
export function snapshotElements(modeler: BpmnModelerInstance): ElementSnapshot {
  const snapshot: ElementSnapshot = new Map()
  modeler.get('elementRegistry').forEach((el: BpmnElement) => {
    if (el.type === 'root') return
    const waypoints = Array.isArray(el.waypoints)
      ? el.waypoints.map(p => `${p.x},${p.y}`).join(';')
      : undefined

    snapshot.set(el.id, {
      x: el.x, y: el.y, width: el.width, height: el.height,
      type: el.type,
      label: el.businessObject?.name,
      waypoints,
      semantic: getBusinessObjectSemantic(el.businessObject ?? {}),
    })
  })
  return snapshot
}

/**
 * Returns the IDs of elements that are new or whose recorded properties differ
 * between two snapshots. Deleted elements are intentionally ignored — bpmn-js
 * removes them from the canvas immediately and they don't need highlighting.
 */
export function diffElements(before: ElementSnapshot, after: ElementSnapshot): string[] {
  const changed: string[] = []
  after.forEach((state, id) => {
    const prev = before.get(id)
    if (!prev) { changed.push(id); return }
    if (
      prev.x !== state.x || prev.y !== state.y ||
      prev.width !== state.width || prev.height !== state.height ||
      prev.type !== state.type ||
      prev.label !== state.label ||
      prev.waypoints !== state.waypoints ||
      prev.semantic !== state.semantic
    ) {
      changed.push(id)
    }
  })
  return changed
}
