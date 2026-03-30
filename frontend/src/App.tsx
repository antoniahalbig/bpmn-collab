import { useCollaboration } from './hooks/useCollaboration'
import { BpmnEditor } from './components/BpmnEditor'
import { UserList } from './components/UserList'

export default function App(): JSX.Element {
  const { users, clientId, sendXmlUpdate, onRemoteXml, initXmlPromise } = useCollaboration()
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <BpmnEditor sendXmlUpdate={sendXmlUpdate} onRemoteXml={onRemoteXml} initXmlPromise={initXmlPromise} />
      <UserList users={users} currentClientId={clientId} />
    </div>
  )
}
