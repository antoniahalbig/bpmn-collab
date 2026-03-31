import { Activity } from '../hooks/useCollaboration'

interface ActivityFeedProps {
  activities: Activity[]  // newest-last from server; reversed for display
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function ActivityFeed({ activities }: ActivityFeedProps): JSX.Element {
  const reversed = [...activities].reverse()

  return (
    <div
      style={{
        width: '100%',
        maxHeight: 220,
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        fontFamily: 'sans-serif',
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #eee',
          fontWeight: 600,
          color: '#333',
          fontSize: 12,
          position: 'sticky',
          top: 0,
          background: '#fff',
        }}
      >
        Activity
      </div>
      {reversed.length === 0 ? (
        <p style={{ color: '#aaa', margin: '8px 10px', fontSize: 11 }}>No activity yet.</p>
      ) : (
        reversed.map((entry, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
              padding: '6px 10px',
              borderBottom: i < reversed.length - 1 ? '1px solid #f5f5f5' : 'none',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.user_color,
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <span style={{ color: '#444', flex: 1, lineHeight: 1.4 }}>
              <strong style={{ color: '#222' }}>{entry.user_name}</strong>{' '}
              {entry.action}
            </span>
            <span style={{ color: '#bbb', fontSize: 10, flexShrink: 0, marginTop: 2 }}>
              {relativeTime(entry.timestamp)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
