export interface UserListUser {
  client_id: string
  name: string
  color: string
}

export interface UserListProps {
  users: UserListUser[]
  currentClientId: string
}

export function UserList({ users, currentClientId }: UserListProps): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        fontFamily: 'sans-serif',
        fontSize: '14px',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: '10px',
          color: '#333',
        }}
      >
        Online ({users.length})
      </div>
      {users.map((user) => (
        <div
          key={user.client_id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: user.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#444' }}>
            {user.name}
            {user.client_id === currentClientId && (
              <span style={{ color: '#888', fontSize: '12px' }}> (you)</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
