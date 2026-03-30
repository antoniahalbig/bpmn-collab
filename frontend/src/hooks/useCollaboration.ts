import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const COLOR_PALETTE = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#e91e63',
]

export interface CollabUser {
  client_id: string
  name: string
  color: string
}

export interface UseCollaborationResult {
  users: CollabUser[]
  clientId: string
  clientName: string
  clientColor: string
  sendXmlUpdate: (xml: string) => void
  onRemoteXml: React.MutableRefObject<((xml: string) => void) | null>
  // Resolves with the server's stored XML (or null if none exists yet) as soon
  // as the 'init' message arrives. BpmnEditor awaits this before loading any
  // diagram, so exactly one importXML call happens on startup with the right XML.
  initXmlPromise: Promise<string | null>
}

export function useCollaboration(): UseCollaborationResult {
  const [users, setUsers] = useState<CollabUser[]>([])

  const { clientId, clientName, clientColor } = useMemo(() => {
    // Identity is generated fresh on every page load (tab open / hard refresh).
    // To persist identity across refreshes, read from and write to localStorage here:
    //   const stored = localStorage.getItem('bpmn-collab-identity')
    //   if (stored) return JSON.parse(stored)
    //   const identity = { clientId: ..., clientName: ..., clientColor: ... }
    //   localStorage.setItem('bpmn-collab-identity', JSON.stringify(identity))
    //   return identity
    const id = crypto.randomUUID()
    return {
      clientId: id,
      clientName: 'User #' + id.slice(-4),
      clientColor: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
    }
  }, [])

  const onRemoteXml = useRef<((xml: string) => void) | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)

  // Created once. Captures the resolver so the WebSocket handler can settle it
  // when 'init' arrives. BpmnEditor awaits this Promise before loading any XML.
  const initXmlResolveRef = useRef<((xml: string | null) => void) | null>(null)
  const initXmlPromise = useMemo(
    () => new Promise<string | null>(resolve => { initXmlResolveRef.current = resolve }),
    [],
  )

  // useCallback with [] so this function has a stable identity across renders.
  // Without this, BpmnEditor's useEffect would re-run on every render (e.g.
  // when setUsers fires), destroy the modeler, and reload the stale initial XML
  // — resetting all edits. Safe to use [] because the function body only reads
  // refs (debounceTimerRef, wsRef), never closed-over render-cycle values.
  const sendXmlUpdate = useCallback((xml: string): void => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'xml_update', xml }))
      }
    }, 300)
  }, [])

  useEffect(() => {
    let cancelled = false

    function connect(): void {
      const ws = new WebSocket(`ws://${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        attemptRef.current = 0
        ws.send(
          JSON.stringify({
            type: 'join',
            client_id: clientId,
            name: clientName,
            color: clientColor,
          })
        )
      }

      ws.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data as string)

        switch (data.type as string) {
          case 'init':
            setUsers(data.users as CollabUser[])
            // Settle the Promise so BpmnEditor can load the correct diagram.
            // Called at most once; subsequent calls to a resolved Promise are no-ops.
            initXmlResolveRef.current?.(data.xml as string | null)
            initXmlResolveRef.current = null
            break
          case 'user_joined':
          case 'user_left':
            setUsers(data.users as CollabUser[])
            break
          case 'xml_update':
            if (onRemoteXml.current) {
              onRemoteXml.current(data.xml as string)
            }
            break
          default:
            break
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        const attempt = attemptRef.current
        if (attempt >= 5) return
        const delay = 1000 * Math.pow(2, attempt)
        attemptRef.current += 1
        setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [clientId, clientName, clientColor])

  return { users, clientId, clientName, clientColor, sendXmlUpdate, onRemoteXml, initXmlPromise }
}
