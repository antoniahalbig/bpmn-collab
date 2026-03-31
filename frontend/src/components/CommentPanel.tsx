import { useState } from 'react'
import { Comment } from '../hooks/useCollaboration'
import { relativeTime } from '../lib/relativeTime'
import { colors, shadows, radii, fonts } from '../styles/tokens'

interface CommentPanelProps {
  comments: Comment[]
  selectedElementId: string | null
  currentClientName: string
  onAdd: (elementId: string, text: string) => void
  onDelete: (commentId: string) => void
}

export function CommentPanel({
  comments,
  selectedElementId,
  currentClientName,
  onAdd,
  onDelete,
}: CommentPanelProps): JSX.Element {
  const [draft, setDraft] = useState('')

  const elementComments = selectedElementId
    ? comments.filter(c => c.element_id === selectedElementId)
    : []

  const handleAdd = () => {
    const text = draft.trim()
    if (!text || !selectedElementId) return
    onAdd(selectedElementId, text)
    setDraft('')
  }

  return (
    <div
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        background: colors.panelBg,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.md,
        boxShadow: shadows.panel,
        fontFamily: fonts.family,
        fontSize: fonts.size.md,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          fontWeight: 600,
          color: colors.textPrimary,
          fontSize: fonts.size.md,
          flexShrink: 0,
        }}
      >
        💬 Comments
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
        {!selectedElementId ? (
          <p style={{ color: colors.textPlaceholder, margin: '8px 0', fontSize: fonts.size.base }}>
            Select an element to view or add comments.
          </p>
        ) : elementComments.length === 0 ? (
          <p style={{ color: colors.textPlaceholder, margin: '8px 0', fontSize: fonts.size.base }}>
            No comments on this element yet.
          </p>
        ) : (
          elementComments.map(comment => (
            <div
              key={comment.id}
              style={{
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: `1px solid ${colors.borderFaint}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: comment.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, color: colors.textPrimary }}>{comment.author}</span>
                <span style={{ color: colors.textDim, fontSize: fonts.size.sm, marginLeft: 'auto' }}>
                  {relativeTime(comment.timestamp)}
                </span>
                {comment.author === currentClientName && (
                  <button
                    onClick={() => onDelete(comment.id)}
                    title="Delete comment"
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: colors.textDim,
                      padding: 0,
                      fontSize: fonts.size.lg,
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = colors.danger)}
                    onMouseLeave={e => (e.currentTarget.style.color = colors.textDim)}
                  >
                    ×
                  </button>
                )}
              </div>
              <p style={{ margin: 0, color: colors.textMuted, lineHeight: 1.4, wordBreak: 'break-word' }}>
                {comment.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Footer — only shown when an element is selected */}
      {selectedElementId && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: `1px solid ${colors.borderSubtle}`,
            flexShrink: 0,
          }}
        >
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd()
            }}
            placeholder="Add a comment… (Ctrl+Enter)"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'none',
              border: `1px solid ${colors.border}`,
              borderRadius: radii.sm,
              padding: '6px 8px',
              fontSize: fonts.size.base,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!draft.trim()}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '6px 0',
              background: draft.trim() ? colors.primary : colors.textDim,
              color: colors.panelBg,
              border: 'none',
              borderRadius: radii.sm,
              cursor: draft.trim() ? 'pointer' : 'default',
              fontWeight: 600,
              fontSize: fonts.size.base,
              transition: 'background 0.15s',
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
