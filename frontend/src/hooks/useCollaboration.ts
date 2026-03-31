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

export interface Comment {
  id: string
  element_id: string
  author: string
  color: string
  text: string
  timestamp: string
}

export interface Activity {
  id: string
  user_name: string
  user_color: string
  action: string
  timestamp: string
}

export interface UseCollaborationResult {
  users: CollabUser[]
  clientId: string
  clientName: string
  clientColor: string
  sendXmlUpdate: (xml: string) => void
  onRemoteXml: React.MutableRefObject<((xml: string, color: string) => void) | null>
  // Resolves with the server's stored XML (or null if none exists yet) as soon
  // as the 'init' message arrives. BpmnEditor awaits this before loading any
  // diagram, so exactly one importXML call happens on startup with the right XML.
  initXmlPromise: Promise<string | null>
  comments: Comment[]
  activities: Activity[]
  sendAddComment: (elementId: string, text: string) => void
  sendDeleteComment: (commentId: string) => void
  sendActivity: (action: string) => void
}

export function useCollaboration(): UseCollaborationResult {
  const [users, setUsers] = useState<CollabUser[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

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

  const onRemoteXml = useRef<((xml: string, color: string) => void) | null>(null)
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
        // Include the sender's colour so remote clients can highlight changed
        // elements in the correct user colour (Bug 2 fix).
        ws.send(JSON.stringify({ type: 'xml_update', xml, color: clientColor }))
      }
    }, 300)
  }, [])

  // Stable helpers — safe to use [] deps because clientName/clientColor come
  // from useMemo([]) (never change) and wsRef is a ref (always the same object).
  const sendAddComment = useCallback((elementId: string, text: string): void => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'comment_add',
        element_id: elementId,
        author: clientName,
        color: clientColor,
        text,
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sendDeleteComment = useCallback((commentId: string): void => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'comment_delete', comment_id: commentId }))
    }
  }, [])

  const sendActivity = useCallback((action: string): void => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'activity',
        user_name: clientName,
        user_color: clientColor,
        action,
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            setComments(data.comments as Comment[] ?? [])
            setActivities(data.activities as Activity[] ?? [])
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
              onRemoteXml.current(
                data.xml as string,
                (data.color as string | undefined) ?? '#3498db',
              )
            }
            break
          case 'comments_updated':
            setComments(data.comments as Comment[])
            break
          case 'activity_update':
            setActivities(data.activities as Activity[])
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

  return {
    users,
    clientId,
    clientName,
    clientColor,
    sendXmlUpdate,
    onRemoteXml,
    initXmlPromise,
    comments,
    activities,
    sendAddComment,
    sendDeleteComment,
    sendActivity,
  }
}
