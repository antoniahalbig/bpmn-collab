/**
 * Minimal type declarations for the bpmn-js services and objects used in this project.
 *
 * bpmn-js ships no official @types package. Rather than sprinkling `any` throughout
 * BpmnEditor.tsx we declare just the surface area we actually call. Add new entries
 * here as the integration grows.
 */

// ── Element shapes ────────────────────────────────────────────────────────────

export interface BpmnWaypoint {
  x: number
  y: number
}

export interface BpmnBusinessObject {
  name?: string
}

export interface BpmnElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  waypoints?: BpmnWaypoint[]
  businessObject?: BpmnBusinessObject
}

// ── Service: overlays ─────────────────────────────────────────────────────────

export interface BpmnOverlayPosition {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

export interface BpmnOverlayConfig {
  position: BpmnOverlayPosition
  html: string
}

export interface BpmnOverlays {
  add(elementId: string, type: string, config: BpmnOverlayConfig): string
  remove(overlayId: string): void
}

// ── Service: canvas ───────────────────────────────────────────────────────────

export interface BpmnCanvas {
  addMarker(element: BpmnElement, marker: string): void
  removeMarker(element: BpmnElement, marker: string): void
  getGraphics(element: BpmnElement): SVGElement | null
  resized(): void
}

// ── Service: elementRegistry ──────────────────────────────────────────────────

export interface BpmnElementRegistry {
  forEach(callback: (element: BpmnElement) => void): void
  get(id: string): BpmnElement | undefined
}

// ── Event payloads ────────────────────────────────────────────────────────────

export interface BpmnCommandContext {
  shape?: BpmnElement
  shapes?: BpmnElement[]
  connection?: BpmnElement
  connections?: BpmnElement[]
}

export interface BpmnCommandEvent {
  command: string
  context: BpmnCommandContext
}

export interface BpmnSelectionChangedEvent {
  newSelection: BpmnElement[]
}

// ── Modeler instance ──────────────────────────────────────────────────────────

export interface BpmnModelerInstance {
  get(service: 'overlays'): BpmnOverlays
  get(service: 'canvas'): BpmnCanvas
  get(service: 'elementRegistry'): BpmnElementRegistry
  importXML(xml: string): Promise<{ warnings?: unknown[] }>
  saveXML(options?: { format?: boolean }): Promise<{ xml?: string }>
  on(event: 'commandStack.execute', handler: (event: BpmnCommandEvent) => void): void
  on(event: 'commandStack.changed', handler: () => void): void
  on(event: 'selection.changed', handler: (event: BpmnSelectionChangedEvent) => void): void
  destroy(): void
}
