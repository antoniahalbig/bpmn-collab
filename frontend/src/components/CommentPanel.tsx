import { useState } from 'react'
import { Comment } from '../hooks/useCollaboration'

interface CommentPanelProps {
  comments: Comment[]
  selectedElementId: string | null
  currentClientName: string
  onAdd: (elementId: string, text: string) => void
  onDelete: (commentId: string) => void
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 80,
    right: 16,
    width: 260,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    fontFamily: 'sans-serif',
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 100px)',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
    fontWeight: 600,
    color: '#333',
    fontSize: 13,
    flexShrink: 0,
  }

  const bodyStyle: React.CSSProperties = {
    overflowY: 'auto',
    flex: 1,
    padding: '8px 12px',
  }

  const footerStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderTop: '1px solid #eee',
    flexShrink: 0,
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>💬 Comments</div>

      <div style={bodyStyle}>
        {!selectedElementId ? (
          <p style={{ color: '#999', margin: '8px 0', fontSize: 12 }}>
            Select an element to view or add comments.
          </p>
        ) : elementComments.length === 0 ? (
          <p style={{ color: '#999', margin: '8px 0', fontSize: 12 }}>
            No comments on this element yet.
          </p>
        ) : (
          elementComments.map(comment => (
            <div
              key={comment.id}
              style={{
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: '1px solid #f0f0f0',
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
                <span style={{ fontWeight: 600, color: '#333' }}>{comment.author}</span>
                <span style={{ color: '#aaa', fontSize: 11, marginLeft: 'auto' }}>
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
                      color: '#ccc',
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#e74c3c')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                  >
                    ×
                  </button>
                )}
              </div>
              <p style={{ margin: 0, color: '#555', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {comment.text}
              </p>
            </div>
          ))
        )}
      </div>

      {selectedElementId && (
        <div style={footerStyle}>
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
              border: '1px solid #ddd',
              borderRadius: 4,
              padding: '6px 8px',
              fontSize: 12,
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
              background: draft.trim() ? '#3498db' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: draft.trim() ? 'pointer' : 'default',
              fontWeight: 600,
              fontSize: 12,
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
