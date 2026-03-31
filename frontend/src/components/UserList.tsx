import { CollabUser } from '../hooks/useCollaboration'
import { colors, shadows, radii, fonts } from '../styles/tokens'

interface UserListProps {
  users: CollabUser[]
  currentClientId: string
}

export function UserList({ users, currentClientId }: UserListProps): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        background: colors.panelBgTranslucent,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.md,
        padding: '12px 16px',
        boxShadow: shadows.panel,
        fontFamily: fonts.family,
        fontSize: fonts.size.lg,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10, color: colors.textPrimary }}>
        Online ({users.length})
      </div>
      {users.map(user => (
        <div
          key={user.client_id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: user.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: colors.textSecondary }}>
            {user.name}
            {user.client_id === currentClientId && (
              <span style={{ color: colors.textFaint, fontSize: fonts.size.base }}> (you)</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
