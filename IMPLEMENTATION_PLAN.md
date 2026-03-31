# Implementation Plan — bpmn-collab Improvements

Features are ordered by priority: highest user-visible value relative to effort first.
Each section lists every file that must be created or modified, in the exact order the changes should be made.

---

## Feature 1 — External Comment System with Overlays

**Why first:** Directly addresses the original question, natively supports user color, and requires backend work that the later activity feed also builds on.

### Overview

Comments are stored in the backend (in memory, like the diagram). Each comment carries `element_id`, `author`, `color`, `text`, and `timestamp`. A new WebSocket message type handles add/delete. bpmn-js overlays render a colored count badge on elements that have comments. A sidebar panel shows and creates comments for the selected element.

### Step 1 — Backend: `backend/app/connection_manager.py`

Add `comments: list[dict]` to `__init__`. Add three methods:

```python
self.comments: list[dict] = []

def add_comment(self, comment: dict) -> None:
    self.comments.append(comment)

def delete_comment(self, comment_id: str) -> None:
    self.comments = [c for c in self.comments if c['id'] != comment_id]

def get_comments(self) -> list[dict]:
    return list(self.comments)
```

### Step 2 — Backend: `backend/app/main.py`

Add `import uuid` and `from datetime import datetime, timezone` at the top.

In the `init` send, add `"comments": manager.get_comments()` to the payload.

In the message loop, add two new branches alongside `xml_update`:

```python
elif msg_type == 'comment_add':
    comment = {
        'id': str(uuid.uuid4()),
        'element_id': data['element_id'],
        'author': data['author'],
        'color': data['color'],
        'text': data['text'],
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }
    manager.add_comment(comment)
    await manager.broadcast({
        'type': 'comments_updated',
        'comments': manager.get_comments(),
    })

elif msg_type == 'comment_delete':
    manager.delete_comment(data['comment_id'])
    await manager.broadcast({
        'type': 'comments_updated',
        'comments': manager.get_comments(),
    })
```

### Step 3 — Frontend: `src/hooks/useCollaboration.ts`

Add `comments` state and two send helpers to the hook:

```ts
// State
const [comments, setComments] = useState<Comment[]>([])

// Helpers (stable, use [] deps like sendXmlUpdate)
const sendAddComment = useCallback((elementId, text) => {
    ws.send(JSON.stringify({
        type: 'comment_add',
        element_id: elementId,
        author: clientName,
        color: clientColor,
        text,
    }))
}, [])

const sendDeleteComment = useCallback((commentId) => {
    ws.send(JSON.stringify({ type: 'comment_delete', comment_id: commentId }))
}, [])
```

In the message switch, add:
- `'init'` → also call `setComments(data.comments ?? [])`
- `'comments_updated'` → call `setComments(data.comments)`

Update the return type and return value.

### Step 4 — Frontend: `src/components/CommentPanel.tsx` (new file)

A fixed right-hand sidebar (below the UserList). Props:

```ts
interface CommentPanelProps {
    comments: Comment[]             // all comments
    selectedElementId: string | null
    currentClientId: string
    onAdd: (elementId: string, text: string) => void
    onDelete: (commentId: string) => void
}
```

Render:
- If no element is selected: "Select an element to view or add comments."
- If selected: list of comments for that element (author dot in user color, name, timestamp, text) + a textarea + "Add" button.
- Delete button visible only on comments where `comment.author === currentClientName`.
- Styled with inline styles only (no CSS file). Position: `fixed`, `top: 80px`, `right: 16px`, `width: 260px`.

### Step 5 — Frontend: `src/components/BpmnEditor.tsx`

Add to props: `comments`, `clientName`, `clientColor`, `sendAddComment`, `sendDeleteComment`, and an `onElementSelect` callback so the parent knows which element is selected.

Inside `init()`, after the modeler is ready:

**Overlay rendering** — write a function `syncOverlays(comments)` that:
1. Calls `overlays.clear('comment-badge')` to remove all existing badges.
2. Groups comments by `element_id`.
3. For each element that has comments, calls:
```ts
overlays.add(elementId, 'comment-badge', {
    position: { top: -12, right: -12 },
    html: `<div class="comment-badge"
                style="background:${comments[0].color};border-radius:50%;
                       width:20px;height:20px;display:flex;align-items:center;
                       justify-content:center;color:#fff;font-size:11px;
                       font-weight:600;cursor:pointer;">
               ${count}
           </div>`,
})
```

Call `syncOverlays` once after the initial import and again inside `onRemoteXml.current` after each import, and whenever `comments` prop changes (via a separate `useEffect` that depends only on `comments`).

**Selection tracking** — listen to `selection.changed`:
```ts
modeler.on('selection.changed', ({ newSelection }) => {
    const el = newSelection[0] ?? null
    onElementSelect(el ? el.id : null)
})
```

### Step 6 — Frontend: `src/App.tsx`

Destructure `comments`, `sendAddComment`, `sendDeleteComment` from `useCollaboration`.
Add `selectedElementId` state (`useState<string | null>(null)`).
Pass all new props to `BpmnEditor` and `CommentPanel`.
Render `<CommentPanel>` alongside `<UserList>`.

### Step 7 — Frontend: CSS for badge hover

In `index.html` or a `<style>` block, add a hover state:
```css
.comment-badge:hover { transform: scale(1.2); transition: transform 0.1s; }
```

---

## Feature 2 — Transient Element Highlighting on Remote Change

**Why second:** Single-file change, no backend work, immediately makes collaboration visible.

### Overview

Before applying a remote `importXML`, snapshot all current element positions. After the import, diff the snapshots and apply a pulsing CSS marker to changed or new elements for 1.5 seconds.

### Step 1 — Frontend: CSS for the highlight marker

In `BpmnEditor.tsx` (or a global `<style>` in `index.html`), add:

```css
@keyframes remote-pulse {
    0%, 100% { stroke-opacity: 1; }
    50%       { stroke-opacity: 0.2; }
}
.remote-highlight .djs-visual > :is(rect, circle, polygon, path) {
    stroke: #f39c12 !important;
    stroke-width: 3px !important;
    animation: remote-pulse 0.5s ease-in-out 3;
}
```

### Step 2 — Frontend: `src/components/BpmnEditor.tsx`

Add two helper functions (outside the component, top of file):

```ts
type ElementSnapshot = Map<string, { x: number; y: number; width: number; height: number; label: string | undefined }>

function snapshotElements(modeler): ElementSnapshot {
    const snapshot: ElementSnapshot = new Map()
    modeler.get('elementRegistry').forEach((el: any) => {
        if (el.type === 'root') return
        snapshot.set(el.id, {
            x: el.x, y: el.y, width: el.width, height: el.height,
            label: el.businessObject?.name,
        })
    })
    return snapshot
}

function diffElements(before: ElementSnapshot, after: ElementSnapshot): string[] {
    const changed: string[] = []
    after.forEach((state, id) => {
        const prev = before.get(id)
        if (!prev) { changed.push(id); return }
        if (prev.x !== state.x || prev.y !== state.y ||
            prev.width !== state.width || prev.height !== state.height ||
            prev.label !== state.label) {
            changed.push(id)
        }
    })
    return changed
}
```

Modify `onRemoteXml.current` inside `init()`:

```ts
onRemoteXml.current = async (xml: string) => {
    importCountRef.current++
    try {
        const before = snapshotElements(modeler)
        await modeler.importXML(xml)
        const after = snapshotElements(modeler)
        const changedIds = diffElements(before, after)

        const canvas = modeler.get('canvas')
        const registry = modeler.get('elementRegistry')
        changedIds.forEach(id => {
            const el = registry.get(id)
            if (!el) return
            canvas.addMarker(el, 'remote-highlight')
            setTimeout(() => canvas.removeMarker(el, 'remote-highlight'), 1500)
        })
    } finally {
        importCountRef.current--
    }
}
```

No other files need to change.

---

## Feature 3 — Element Coloring on User Edit

**Why third:** Low effort, visually communicates ownership, persists in the BPMN XML automatically.

### Overview

When the local user executes a diagram command (move, create, rename, resize), apply their color to the affected elements via `modeling.setColor()`. The color is stored in the XML and broadcast to all clients as part of the normal `commandStack.changed` flow.

### Step 1 — Frontend: `src/hooks/useCollaboration.ts`

`clientColor` is already returned. No changes needed here.

### Step 2 — Frontend: `src/components/BpmnEditor.tsx`

Add `clientColor: string` to `BpmnEditorProps`.

Add a helper (outside the component):

```ts
function getAffectedElements(context: any): any[] {
    return [
        context.shape,
        context.connection,
        ...(context.shapes ?? []),
        ...(context.connections ?? []),
    ].filter(Boolean)
}

// Produces a very light fill from a hex color (10% opacity via mix with white)
function lightFill(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},0.12)`
}
```

Inside `init()`, after the `commandStack.changed` listener, add:

```ts
modeler.on('commandStack.execute', ({ command, context }: any) => {
    // Don't re-color when setColor itself runs (prevents infinite loop)
    if (command === 'element.setColor') return
    // Don't run during remote imports
    if (importCountRef.current > 0) return

    const elements = getAffectedElements(context)
    if (elements.length === 0) return

    const modeling = modeler.get('modeling')
    modeling.setColor(elements, {
        stroke: clientColor,
        fill: lightFill(clientColor),
    })
})
```

### Step 3 — Frontend: `src/App.tsx`

Destructure `clientColor` from `useCollaboration` and pass it to `<BpmnEditor>`.

---

## Feature 4 — Activity Feed

**Why fourth:** Medium effort across both backend and frontend, but the `commandStack.execute` listener from Feature 3 makes the frontend side much lighter.

### Overview

Each user-initiated command is described in plain English and broadcast as an `activity` message. The backend keeps the last 20 activities in memory. A fixed panel displays them in reverse-chronological order with the user's color dot.

### Step 1 — Backend: `backend/app/connection_manager.py`

Add `activities: list[dict] = []` to `__init__`. Add:

```python
def add_activity(self, activity: dict) -> None:
    self.activities.append(activity)
    self.activities = self.activities[-20:]   # rolling window

def get_activities(self) -> list[dict]:
    return list(self.activities)
```

### Step 2 — Backend: `backend/app/main.py`

In the `init` payload, add `"activities": manager.get_activities()`.

In the message loop:

```python
elif msg_type == 'activity':
    activity = {
        'user_name':  data['user_name'],
        'user_color': data['user_color'],
        'action':     data['action'],
        'timestamp':  datetime.now(timezone.utc).isoformat(),
    }
    manager.add_activity(activity)
    await manager.broadcast({
        'type': 'activity_update',
        'activities': manager.get_activities(),
    })
```

### Step 3 — Frontend: `src/hooks/useCollaboration.ts`

Add `activities` state and `sendActivity` helper (stable, `[]` deps). Handle `'activity_update'` and `'init'` (extract `data.activities`) in the message switch. Add to return type and return value.

### Step 4 — Frontend: command description helper (new file `src/lib/describeCommand.ts`)

```ts
export function describeCommand(command: string, context: any): string | null {
    const shape = context.shape ?? context.shapes?.[0]
    const conn  = context.connection ?? context.connections?.[0]
    const el    = shape ?? conn
    if (!el) return null

    const bpmnType = (el.type ?? '').split(':')[1] ?? ''
    const typeNames: Record<string, string> = {
        Task: 'task', StartEvent: 'start event', EndEvent: 'end event',
        ExclusiveGateway: 'gateway', ParallelGateway: 'gateway',
        SubProcess: 'subprocess', SequenceFlow: 'connection',
    }
    const typeName = Object.entries(typeNames).find(([k]) => bpmnType.includes(k))?.[1] ?? 'element'
    const label = el.businessObject?.name
    const named = label ? ` "${label}"` : ''

    switch (command) {
        case 'shape.create':              return `added ${typeName}${named}`
        case 'shape.delete':              return `deleted ${typeName}${named}`
        case 'shape.move':
        case 'elements.move':             return `moved ${typeName}${named}`
        case 'shape.resize':              return `resized ${typeName}${named}`
        case 'element.updateProperties':  return `updated ${typeName}${named}`
        case 'connection.create':         return `added connection`
        case 'connection.delete':         return `deleted connection`
        default:                          return null
    }
}
```

### Step 5 — Frontend: `src/components/ActivityFeed.tsx` (new file)

Props:

```ts
interface ActivityFeedProps {
    activities: Activity[]   // newest-last from server; reverse for display
}
```

Render a fixed panel (bottom-left, `position: fixed`, `bottom: 16px`, `left: 16px`, `width: 240px`, `max-height: 300px`, overflow scroll). Each entry: colored dot (user color) + `"UserName action"` + relative timestamp. Inline styles only.

### Step 6 — Frontend: `src/components/BpmnEditor.tsx`

Add `clientName`, `sendActivity` to props.

Import `describeCommand` from `src/lib/describeCommand.ts`.

Extend the `commandStack.execute` listener added in Feature 3:

```ts
modeler.on('commandStack.execute', ({ command, context }: any) => {
    if (command === 'element.setColor') return
    if (importCountRef.current > 0) return

    // Color (from Feature 3)
    const elements = getAffectedElements(context)
    if (elements.length > 0) {
        modeling.setColor(elements, { stroke: clientColor, fill: lightFill(clientColor) })
    }

    // Activity feed
    const action = describeCommand(command, context)
    if (action) sendActivity(action)
})
```

### Step 7 — Frontend: `src/App.tsx`

Destructure `activities` and `sendActivity` from `useCollaboration`. Pass `sendActivity` and `clientName` to `<BpmnEditor>`. Render `<ActivityFeed activities={activities} />`.

---

## Summary of all files touched

| File | Features |
|---|---|
| `backend/app/connection_manager.py` | 1, 4 |
| `backend/app/main.py` | 1, 4 |
| `frontend/src/hooks/useCollaboration.ts` | 1, 4 |
| `frontend/src/components/BpmnEditor.tsx` | 1, 2, 3, 4 |
| `frontend/src/components/CommentPanel.tsx` | 1 (new) |
| `frontend/src/components/ActivityFeed.tsx` | 4 (new) |
| `frontend/src/lib/describeCommand.ts` | 4 (new) |
| `frontend/src/App.tsx` | 1, 3, 4 |
| `frontend/index.html` | 2 (CSS) |

Backend changes require a Docker rebuild (`docker compose up --build`).
Frontend changes in the `additionalModules` list also require a rebuild.
All other frontend changes are picked up by Vite's HMR if running in dev mode.
