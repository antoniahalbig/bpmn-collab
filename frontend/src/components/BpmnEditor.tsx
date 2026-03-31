import { useCallback, useEffect, useRef } from 'react'

// bpmn-js has no official @types package — imports are untyped by design
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import BpmnModeler from 'bpmn-js/lib/Modeler'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

import { Comment } from '../hooks/useCollaboration'
import { describeCommand } from '../lib/describeCommand'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BpmnEditorProps {
  sendXmlUpdate: (xml: string) => void
  onRemoteXml: React.MutableRefObject<((xml: string, color: string) => void) | null>
  // Resolves with the server's stored XML, or null if the session is fresh.
  // BpmnEditor awaits this before loading anything so that exactly one
  // importXML call happens on startup — with the right diagram.
  initXmlPromise: Promise<string | null>
  // Feature 1: comment overlays + selection tracking
  comments: Comment[]
  onElementSelect: (elementId: string | null) => void
  // Feature 3: coloring user's edits with their color
  clientColor: string
  // Feature 4: activity feed broadcasts
  sendActivity: (action: string) => void
}

// ─── Default diagram ─────────────────────────────────────────────────────────

// Minimal valid BPMN 2.0 diagram shown when no server diagram exists yet.
const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             targetNamespace="http://bpmn.io/schema/bpmn"
             id="Definitions_1">
  <process id="Process_1" isExecutable="false">
    <startEvent id="StartEvent_1" name="Start" />
    <endEvent id="EndEvent_1" name="End" />
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="155" y="125" width="30" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="382" y="82" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="388" y="125" width="24" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="100" />
        <di:waypoint x="382" y="100" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`

// ─── Helpers (outside component so they are never recreated) ─────────────────

// Feature 2 — remote-change highlighting helpers

type ElementSnapshot = Map<string, {
  x: number; y: number; width: number; height: number;
  label: string | undefined
  waypoints: string | undefined
}>

function snapshotElements(modeler: any): ElementSnapshot {
  const snapshot: ElementSnapshot = new Map()
  modeler.get('elementRegistry').forEach((el: any) => {
    if (el.type === 'root') return
    const waypoints = Array.isArray(el.waypoints)
      ? el.waypoints.map((p: any) => `${p.x},${p.y}`).join(';')
      : undefined

    snapshot.set(el.id, {
      x: el.x, y: el.y, width: el.width, height: el.height,
      label: el.businessObject?.name,
      waypoints,
    })
  })
  return snapshot
}

function diffElements(before: ElementSnapshot, after: ElementSnapshot): string[] {
  const changed: string[] = []
  after.forEach((state, id) => {
    const prev = before.get(id)
    if (!prev) { changed.push(id); return }
    if (
      prev.x !== state.x || prev.y !== state.y ||
      prev.width !== state.width || prev.height !== state.height ||
      prev.label !== state.label ||
      prev.waypoints !== state.waypoints
    ) {
      changed.push(id)
    }
  })
  return changed
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BpmnEditor({
  sendXmlUpdate,
  onRemoteXml,
  initXmlPromise,
  comments,
  onElementSelect,
  clientColor,
  sendActivity,
}: BpmnEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const modelerRef = useRef<InstanceType<typeof BpmnModeler> | null>(null)

  // Counter-based guard instead of a boolean flag; handles concurrent remote
  // imports correctly. commandStack.changed skips sendXmlUpdate while any
  // importXML call is still in flight.
  const importCountRef = useRef(0)

  // sendXmlUpdate is already stable (useCallback with [] in useCollaboration).
  // Wrapping here too so the linter sees a stable dep in the effect below.
  const stableSendXmlUpdate = useCallback(sendXmlUpdate, []) // eslint-disable-line react-hooks/exhaustive-deps

  // syncOverlaysRef lets the comments useEffect call syncOverlays after init().
  const syncOverlaysRef = useRef<((c: Comment[]) => void) | null>(null)

  // commentsRef always holds the latest comments prop so that closures inside
  // the modeler init (which run only once) can access the current value.
  const commentsRef = useRef<Comment[]>(comments)
  commentsRef.current = comments // updated on every render, no re-render side-effect

  // When comments change (from any source), re-render the overlay badges.
  useEffect(() => {
    syncOverlaysRef.current?.(comments)
  }, [comments])

  useEffect(() => {
    if (!containerRef.current) return

    let mounted = true
    const modeler = new BpmnModeler({ container: containerRef.current })
    modelerRef.current = modeler

    const init = async () => {
      // Wait for the server's 'init' message before loading any XML.
      const serverXml = await initXmlPromise
      if (!mounted) return

      try {
        await modeler.importXML(serverXml ?? DEFAULT_BPMN_XML)
      } catch (err) {
        console.error('[BpmnEditor] Failed to load diagram:', err)
        return
      }
      if (!mounted) return

      // ── bpmn-js service references ─────────────────────────────────────────
      // modeler.get() returns unknown because bpmn-js has no @types package.
      const overlays  = modeler.get('overlays')  as any
      const canvas    = modeler.get('canvas')    as any
      const registry  = modeler.get('elementRegistry') as any

      // ── Feature 1: comment overlay badges ─────────────────────────────────
      // Track overlay IDs so we can cleanly remove them on each sync.
      let commentOverlayIds: string[] = []

      const syncOverlays = (allComments: Comment[]) => {
        // Remove previously rendered badges
        commentOverlayIds.forEach(id => {
          try { overlays.remove(id) } catch { /* element may have been removed */ }
        })
        commentOverlayIds = []

        // Group comments by element
        const byElement = allComments.reduce<Record<string, Comment[]>>((acc, c) => {
          ;(acc[c.element_id] ??= []).push(c)
          return acc
        }, {})

        Object.entries(byElement).forEach(([elementId, elementComments]) => {
          const count = elementComments.length
          const BADGE_COLOR = '#3498db'
          try {
            const overlayId = overlays.add(elementId, 'comment-badge', {
              position: { top: -6, right: -6 },
              html: `<div class="comment-badge" data-element-id="${elementId}"
                          style="background:${BADGE_COLOR};border-radius:50%;
                                 width:20px;height:20px;display:flex;
                                 align-items:center;justify-content:center;
                                 color:#fff;font-size:11px;font-weight:600;
                                 cursor:pointer;user-select:none;">
                       ${count}
                     </div>`,
            })
            commentOverlayIds.push(overlayId)
          } catch { /* element not in canvas */ }
        })
      }

      // Register ref so the comments useEffect can reach this function.
      syncOverlaysRef.current = syncOverlays
      // Sync immediately with whatever comments are already available.
      syncOverlays(commentsRef.current)

      // ── commandStack.execute: log activity on local user actions ─────────
      // Fires during the execute phase. We cannot issue commands here, so only
      // describe the user action for the activity feed.
      modeler.on('commandStack.execute', ({ command, context }: any) => {
        if (command === 'element.setColor') return
        if (importCountRef.current > 0) return

        const action = describeCommand(command, context)
        if (action) sendActivity(action)
      })

      // ── commandStack.changed: save XML for any local edit or undo/redo ─────
      modeler.on('commandStack.changed', async () => {
        if (importCountRef.current > 0) return

        try {
          const { xml } = await modeler.saveXML({ format: false })
          if (xml) stableSendXmlUpdate(xml)
        } catch (err) {
          console.error('[BpmnEditor] Failed to serialize diagram:', err)
        }
      })

      // ── Feature 1: selection tracking ─────────────────────────────────────
      modeler.on('selection.changed', ({ newSelection }: any) => {
        const el = newSelection[0] ?? null
        onElementSelect(el ? el.id : null)
      })

      // ── Feature 2 + remote XML handler ────────────────────────────────────
      // Snapshot element states before and after each remote import to detect
      // which elements changed, then briefly highlight them in the sender's colour.
      onRemoteXml.current = async (xml: string, color: string) => {
        importCountRef.current++
        try {
          const before = snapshotElements(modeler)
          await modeler.importXML(xml)
          const after = snapshotElements(modeler)
          const changedIds = diffElements(before, after)

          changedIds.forEach(id => {
            const el = registry.get(id)
            if (!el) return
            // Set the sender's colour as a CSS custom property on the element's
            // graphics group so the .remote-highlight CSS rule can use it.
            const gfx = canvas.getGraphics(el) as SVGElement | null
            if (gfx) gfx.style.setProperty('--highlight-color', color)
            canvas.addMarker(el, 'remote-highlight')
            setTimeout(() => {
              canvas.removeMarker(el, 'remote-highlight')
              if (gfx) gfx.style.removeProperty('--highlight-color')
            }, 1500)
          })

          // Re-sync comment badges after the canvas is rebuilt by importXML.
          syncOverlays(commentsRef.current)
        } catch (err) {
          console.error('[BpmnEditor] Failed to import remote diagram:', err)
        } finally {
          // finally ensures the counter is always decremented even on error,
          // preventing the commandStack.changed guard from getting stuck.
          importCountRef.current--
        }
      }
    }

    init()

    const handleOverlayClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const badge = target?.closest('.comment-badge') as HTMLElement | null
      if (!badge) return
      const elementId = badge.dataset.elementId
      if (elementId) onElementSelect(elementId)
    }

    containerRef.current?.addEventListener('click', handleOverlayClick)

    // Notify bpmn-js when the container is resized so the canvas reflows.
    const resizeObserver = new ResizeObserver(() => {
      (modeler.get('canvas') as any).resized()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      mounted = false
      syncOverlaysRef.current = null
      containerRef.current?.removeEventListener('click', handleOverlayClick)
      resizeObserver.disconnect()
      onRemoteXml.current = null
      modeler.destroy()
      modelerRef.current = null
    }
  // All deps below are intentionally stable (never change identity after mount):
  //   stableSendXmlUpdate — useCallback with []
  //   onRemoteXml         — useRef (same object forever)
  //   initXmlPromise      — useMemo with [] (created once, resolved once)
  //   clientColor         — useMemo with [] in useCollaboration
  //   sendActivity        — useCallback with [] in useCollaboration
  //   onElementSelect     — React setState setter (always stable)
  // Listing them explicitly keeps the linter happy and makes the intent clear.
  }, [stableSendXmlUpdate, onRemoteXml, initXmlPromise, clientColor, sendActivity, onElementSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
