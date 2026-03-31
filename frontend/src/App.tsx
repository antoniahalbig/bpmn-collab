import { useState } from 'react'
import { useCollaboration } from './hooks/useCollaboration'
import { BpmnEditor } from './components/BpmnEditor'
import { UserList } from './components/UserList'
import { CommentPanel } from './components/CommentPanel'
import { ActivityFeed } from './components/ActivityFeed'

export default function App(): JSX.Element {
  const {
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
  } = useCollaboration()

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <BpmnEditor
        sendXmlUpdate={sendXmlUpdate}
        onRemoteXml={onRemoteXml}
        initXmlPromise={initXmlPromise}
        comments={comments}
        onElementSelect={setSelectedElementId}
        clientColor={clientColor}
        sendActivity={sendActivity}
      />

      {/* Side panel — fixed overlay on the right, stacked vertically */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          bottom: 16,
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'stretch',
          zIndex: 20,
          overflow: 'hidden',
        }}
      >
        <UserList users={users} currentClientId={clientId} />
        <CommentPanel
          comments={comments}
          selectedElementId={selectedElementId}
          currentClientName={clientName}
          onAdd={sendAddComment}
          onDelete={sendDeleteComment}
        />
        <ActivityFeed activities={activities} />
      </div>
    </div>
  )
}
