import { Activity } from '../hooks/useCollaboration'
import { relativeTime } from '../lib/relativeTime'
import { colors, shadows, radii, fonts } from '../styles/tokens'

interface ActivityFeedProps {
  activities: Activity[]  // newest-last from server; reversed for display
}

export function ActivityFeed({ activities }: ActivityFeedProps): JSX.Element {
  const reversed = [...activities].reverse()

  return (
    <div
      style={{
        width: '100%',
        maxHeight: 220,
        overflowY: 'auto',
        background: colors.panelBg,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.md,
        boxShadow: shadows.panel,
        fontFamily: fonts.family,
        fontSize: fonts.size.base,
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          fontWeight: 600,
          color: colors.textPrimary,
          fontSize: fonts.size.base,
          position: 'sticky',
          top: 0,
          background: colors.panelBg,
        }}
      >
        Activity
      </div>
      {reversed.length === 0 ? (
        <p style={{ color: colors.textDim, margin: '8px 10px', fontSize: fonts.size.sm }}>
          No activity yet.
        </p>
      ) : (
        reversed.map((entry, i) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
              padding: '6px 10px',
              borderBottom: i < reversed.length - 1 ? `1px solid ${colors.borderFaintest}` : 'none',
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
            <span style={{ color: colors.textSecondary, flex: 1, lineHeight: 1.4 }}>
              <strong style={{ color: colors.textStrong }}>{entry.user_name}</strong>{' '}
              {entry.action}
            </span>
            <span style={{ color: colors.textDimmer, fontSize: fonts.size.xs, flexShrink: 0, marginTop: 2 }}>
              {relativeTime(entry.timestamp)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
