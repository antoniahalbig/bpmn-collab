import { useCallback, useEffect, useRef } from 'react'

// bpmn-js has no official @types package — imports are untyped by design
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import BpmnModeler from 'bpmn-js/lib/Modeler'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BpmnEditorProps {
  sendXmlUpdate: (xml: string) => void
  onRemoteXml: React.MutableRefObject<((xml: string) => void) | null>
  // Resolves with the server's stored XML, or null if the session is fresh.
  // BpmnEditor awaits this before loading anything so that exactly one
  // importXML call happens on startup — with the right diagram.
  initXmlPromise: Promise<string | null>
}

// ─── Default diagram ─────────────────────────────────────────────────────────

// Minimal valid BPMN 2.0 diagram shown when no server diagram exists yet.
// Contains both the semantic layer (process/events/flow) and the
// diagram layer (BPMNDiagram/BPMNShape/BPMNEdge with pixel coordinates).
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

// ─── Component ───────────────────────────────────────────────────────────────

export function BpmnEditor({ sendXmlUpdate, onRemoteXml, initXmlPromise }: BpmnEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const modelerRef = useRef<InstanceType<typeof BpmnModeler> | null>(null)

  // Counter-based guard instead of a boolean flag, handles concurrent remote
  // imports correctly. commandStack.changed skips sendXmlUpdate while any
  // importXML call is still in flight.
  const importCountRef = useRef(0)

  // sendXmlUpdate is already stable (useCallback with [] in useCollaboration).
  // Wrapping here too so the linter sees a stable dep in the effect below.
  const stableSendXmlUpdate = useCallback(sendXmlUpdate, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!containerRef.current) return

    let mounted = true
    const modeler = new BpmnModeler({ container: containerRef.current })
    modelerRef.current = modeler

    const init = async () => {
      // Wait for the server's 'init' message before loading any XML.
      // This guarantees exactly one importXML call on startup:
      //   - serverXml !== null → load the existing shared diagram
      //   - serverXml === null → load the default starter diagram
      // Loading DEFAULT_BPMN_XML eagerly (before init arrives) risks a
      // concurrent second import when the server XML arrives, and can cause
      // commandStack.changed to fire with the wrong XML and overwrite the
      // server's stored diagram for all connected clients.
      const serverXml = await initXmlPromise
      if (!mounted) return

      try {
        await modeler.importXML(serverXml ?? DEFAULT_BPMN_XML)
      } catch (err) {
        console.error('[BpmnEditor] Failed to load diagram:', err)
        return
      }
      if (!mounted) return

      modeler.on('commandStack.changed', async () => {
        // Skip while a remote importXML is in flight to prevent echo.
        if (importCountRef.current > 0) return

        try {
          // format: false → compact XML, reduces WebSocket payload size.
          // Use format: true only for debugging/export.
          const { xml } = await modeler.saveXML({ format: false })
          if (xml) stableSendXmlUpdate(xml)
        } catch (err) {
          console.error('[BpmnEditor] Failed to serialize diagram:', err)
        }
      })

      // Assign the remote-update handler only after the initial load so that
      // the modeler is fully ready before any incoming xml_update is applied.
      onRemoteXml.current = async (xml: string) => {
        importCountRef.current++
        try {
          await modeler.importXML(xml)
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

    // Notify bpmn-js when the container is resized so the canvas reflows.
    const resizeObserver = new ResizeObserver(() => {
      (modeler.get('canvas') as any).resized()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      mounted = false
      resizeObserver.disconnect()
      onRemoteXml.current = null
      modeler.destroy()
      modelerRef.current = null
    }
  // All three deps are intentionally stable (never change identity after mount):
  //   stableSendXmlUpdate — useCallback with []
  //   onRemoteXml         — useRef (same object forever)
  //   initXmlPromise      — useMemo with [] (created once, resolved once)
  // Listing them explicitly keeps the linter happy and makes the intent clear.
  }, [stableSendXmlUpdate, onRemoteXml, initXmlPromise]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
