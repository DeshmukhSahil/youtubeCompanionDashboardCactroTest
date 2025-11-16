import React, { useState } from 'react';

export default function CommentsList({ items = [], onDelete, onCommentsRefresh, onInsertedReply }) {
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({}); // track which threads have replies open

  const list = Array.isArray(items) ? items : (items && Array.isArray(items.items) ? items.items : []);

  if (!list.length) return <div className="muted small">No comments</div>;

  function toggleReplies(threadId) {
    setExpandedReplies(prev => ({ ...prev, [threadId]: !prev[threadId] }));
  }

  async function submitReply(parentId, threadId = null) {
  setError(null);
  if (!replyText || !replyText.trim()) {
    setError('Reply cannot be empty');
    return;
  }
  setLoading(true);
  try {
    const res = await fetch('/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: replyText.trim(), parentId })
    });
    const payload = await res.json().catch(()=>null);

    if (!res.ok) {
      if (res.status === 401) throw new Error('Unauthorized — re-auth the YouTube account on the server.');
      if (res.status === 403) throw new Error('Forbidden — server token does not own the channel.');
      throw new Error((payload && (payload.error?.message || JSON.stringify(payload.error || payload))) || `Request failed (${res.status})`);
    }

    if (typeof onInsertedReply === 'function') {
      try { onInsertedReply(payload); } catch(e) { console.warn('onInsertedReply failed', e); }
    }

    if (typeof onCommentsRefresh === 'function') {
      try { await onCommentsRefresh(); } catch(e) { console.warn('immediate refresh failed', e); }
    }

    if (typeof onCommentsRefresh === 'function') {
      setTimeout(() => {
        onCommentsRefresh().catch(e => console.warn('delayed refresh failed', e));
      }, 1000);
    }

    setReplyText('');
    setReplyTo(null);
    if (threadId) setExpandedReplies(prev => ({ ...prev, [threadId]: true }));
  } catch (err) {
    console.error('Reply failed', err);
    setError(err.message || 'Reply failed');
  } finally {
    setLoading(false);
  }
}


  return (
    <div>
      <h3 className="section-title">Comments</h3>
      <div id="comments" className="comments-list">
        {list.map((thread) => {
          const tlSnippet = thread.snippet?.topLevelComment?.snippet || thread.snippet || {};
          const author = tlSnippet.authorDisplayName || 'Unknown';
          const text = tlSnippet.textOriginal || tlSnippet.textDisplay || '';
          const published = tlSnippet.publishedAt ? new Date(tlSnippet.publishedAt).toLocaleString() : '';
          const threadId = thread.id; // thread id
          const topLevelId = thread.snippet?.topLevelComment?.id || tlSnippet.id || threadId;
          const replyCount = (thread.snippet && Number(thread.snippet.totalReplyCount)) || (thread.replies && (thread.replies.comments || []).length) || 0;
          const repliesArray = (thread.replies && thread.replies.comments) || [];

          const repliesOpen = Boolean(expandedReplies[threadId]);

          return (
            <div className="comment-thread" key={threadId} style={{ marginBottom: 18, padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
              <div className="comment">
                <div className="meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>{author}</div>
                  <div className="muted small">{published}</div>
                </div>

                <div className="text" style={{ marginTop: 6 }}>{text}</div>

                <div style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => { if (onDelete && window.confirm('Delete this comment?')) onDelete(topLevelId); }}>
                    Delete
                  </button>

                  <button
                    className="btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => setReplyTo(replyTo === topLevelId ? null : topLevelId)}
                  >
                    {replyTo === topLevelId ? 'Cancel' : 'Reply'}
                  </button>

                  {replyCount > 0 && (
                    <button
                      className="btn"
                      style={{ marginLeft: 8 }}
                      onClick={() => toggleReplies(threadId)}
                    >
                      {repliesOpen ? `Hide replies (${replyCount})` : `View replies (${replyCount})`}
                    </button>
                  )}
                </div>

                {replyTo === topLevelId && (
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      rows={3}
                      style={{ width: '100%', padding: 8 }}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                    />
                    <div style={{ marginTop: 6 }}>
                      <button className="btn" onClick={() => submitReply(topLevelId, threadId)} disabled={loading}>
                        {loading ? 'Sending…' : 'Send Reply'}
                      </button>
                      <button className="btn" onClick={() => { setReplyTo(null); setReplyText(''); setError(null); }} style={{ marginLeft: 8 }} disabled={loading}>
                        Cancel
                      </button>
                    </div>
                    {error && <div className="muted small" style={{ color: 'crimson', marginTop: 6 }}>{error}</div>}
                  </div>
                )}
              </div>

              {/* Replies block (indented) */}
              {repliesOpen && (
                <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: '2px solid #f0f0f0' }}>
                  {repliesArray.length === 0 && <div className="muted small">No replies yet</div>}
                  {repliesArray.map((r) => {
                    const rSnippet = r.snippet || {};
                    const rid = r.id || (rSnippet && (rSnippet.id));
                    return (
                      <div key={rid} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{rSnippet.authorDisplayName}</div>
                        <div style={{ fontSize: 13 }}>{rSnippet.textOriginal || rSnippet.textDisplay}</div>
                        <div className="muted small" style={{ fontSize: 12 }}>{rSnippet.publishedAt ? new Date(rSnippet.publishedAt).toLocaleString() : ''}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
