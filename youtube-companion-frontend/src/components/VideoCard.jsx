import React, { useState, useEffect } from 'react';

export default function VideoCard({ video, onPostComment, onUpdateVideo, children }) {
  const [text, setText] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const snippet = video?.snippet || {};
  const stats = video?.statistics || {};
  const thumb = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url;
  const isMFK = video?.status?.madeForKids || video?.status?.selfDeclaredMadeForKids;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditTitle(snippet.title || '');
    setEditDescription(snippet.description || '');
  }, [snippet.title, snippet.description]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    await onPostComment(text);
    setText('');
  };

  const startEdit = () => {
    setEditTitle(snippet.title || '');
    setEditDescription(snippet.description || '');
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!onUpdateVideo) { alert('Update handler not provided'); return; }
    setSaving(true);
    try {
      await onUpdateVideo(editTitle, editDescription);
      setEditing(false);
    } catch (err) {
      console.error('saveEdit', err);
      alert('Failed to update video');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card video-card" aria-live="polite">
      <div className="thumb" id="thumb">
        {thumb ? <img src={thumb} alt="video thumbnail" /> : <div className="muted">No thumbnail</div>}
      </div>

      <div className="meta">
        <div className="meta-top">
          <div style={{ minWidth: 0 }}>
            {!editing ? (
              <>
                <h2 id="videoTitle">{snippet.title || 'Untitled'}</h2>
                <div id="videoChannel" className="muted small">{snippet.channelTitle || ''}</div>
              </>
            ) : (
              <div style={{ width: '100%' }}>
                <input
                  aria-label="Edit title"
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)', background: 'transparent', color: 'inherit' }}
                  value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <textarea
                  aria-label="Edit description"
                  style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)', background: 'transparent', color: 'inherit' }}
                  rows={4} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            <div className="pill">{(stats.viewCount || 0) + ' views'}</div>
            <div className="pill">{isMFK ? 'Made for Kids' : 'Not marked for kids'}</div>
          </div>
        </div>

        <div className={`desc ${showDesc ? 'expanded' : ''}`} id="videoDesc" style={{ marginTop: 6 }}>
          {!editing ? (snippet.description || '—') : null}
        </div>

        <div className="card-section">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!editing ? (
              <>
                <button className="btn" onClick={startEdit}>Edit video</button>
                <button className="btn" onClick={() => setShowDesc(s => !s)}>{showDesc ? 'Show less' : 'Show full'}</button>
              </>
            ) : (
              <>
                <button className="btn primary" onClick={saveEdit} disabled={saving}>Save</button>
                <button className="btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
              </>
            )}
          </div>

          <form id="commentForm" className="form-inline" onSubmit={submit} style={{ marginTop: 12 }}>
            <input id="commentInput" type="text" placeholder="Write a comment…" required value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn primary" type="submit">Post</button>
          </form>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}
