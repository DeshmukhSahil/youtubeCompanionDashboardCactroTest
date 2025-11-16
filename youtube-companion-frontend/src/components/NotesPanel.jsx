import React, { useEffect, useState } from 'react';

export default function NotesPanel({
  notes = [],
  videoId,
  onSave,
  onClear,
  onDelete,
  onEdit,
  apiBase = '/api'
}) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [list, setList] = useState(Array.isArray(notes) ? notes : (notes && Array.isArray(notes.items) ? notes.items : []));
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingTags, setEditingTags] = useState('');
  const [busy, setBusy] = useState(false);

  const tagsFromString = (s) => (s || '').split(',').map(t => t.trim()).filter(Boolean);
  const getId = (n) => (n && (n._id || n.id)) || '';

  const timeAgo = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  useEffect(() => {
    const normalized = Array.isArray(notes) ? notes : (notes && Array.isArray(notes.items) ? notes.items : []);
    const incoming = normalized.filter(Boolean);

    setList(prev => {
      if ((!prev || prev.length === 0) && incoming.length > 0) return incoming;
      if (incoming.length === 0 && prev && prev.length > 0) return prev;
      const prevIds = (prev || []).map(getId).join(',');
      const newIds = incoming.map(getId).join(',');
      if (prevIds === newIds) return prev;
      return incoming;
    });
  }, [notes]);

  const fetchNotes = async () => {
    try {
      const vid = videoId || (new URLSearchParams(window.location.search)).get('videoId') || process.env.REACT_APP_VIDEO_ID;
      const res = await fetch(`${apiBase}/notes?videoId=${encodeURIComponent(vid)}`);
      if (!res.ok) throw new Error(`Fetch notes failed: ${res.status}`);
      const data = await res.json();
      setList(Array.isArray(data) ? data.filter(Boolean) : []);
    } catch (err) {
      console.error('fetchNotes error', err);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!content.trim()) { alert('Please add note text'); return; }
    const arr = tagsFromString(tags);

    setBusy(true);
    try {
      let note;
      if (onSave) {
        note = await onSave(content.trim(), arr);
      } else {
        const res = await fetch(`${apiBase}/note`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content.trim(), tags: arr, videoId })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        note = await res.json();
      }

      if (note && (note._id || note.id)) {
        setList(prev => [note, ...prev.filter(Boolean)]);
      } else {
        console.warn('Create note returned unexpected payload, refetching notes list', note);
        await fetchNotes();
      }

      setContent('');
      setTags('');
    } catch (err) {
      console.error('Save note error', err);
      alert('Could not save note');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (onClear) return onClear();
    if (!window.confirm('Clear notes from UI? This does not delete them from server.')) return;
    setList([]);
  };

  const startEdit = (note) => {
    if (!note) return;
    setEditingId(getId(note));
    setEditingContent(note.content || '');
    setEditingTags((note.tags || []).join(', '));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
    setEditingTags('');
  };

  const saveEdit = async () => {
    if (!editingContent.trim()) { alert('Content required'); return; }
    setBusy(true);
    try {
      let updated;
      const payload = { content: editingContent.trim(), tags: tagsFromString(editingTags) };

      if (onEdit) {
        updated = await onEdit(editingId, payload.content, payload.tags);
      } else {
        const res = await fetch(`${apiBase}/note/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        updated = await res.json();
      }

      setList(prev => prev.map(n => (String(getId(n)) === String(editingId) ? updated : n)).filter(Boolean));
      cancelEdit();
    } catch (err) {
      console.error('Edit error', err);
      alert('Could not update note');
    } finally {
      setBusy(false);
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note? This action cannot be undone.')) return;
    setBusy(true);
    try {
      if (onDelete) {
        await onDelete(id);
      } else {
        const res = await fetch(`${apiBase}/note/${id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw new Error(await res.text());
      }
      setList(prev => prev.filter(n => String(getId(n)) !== String(id)));
      if (String(editingId) === String(id)) cancelEdit();
    } catch (err) {
      console.error('Delete error', err);
      alert('Could not delete note');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notes-panel card">
      <div className="notes-header">
        <div>
          <h3 className="section-title">Quick Notes</h3>
          <div className="section-sub">{list.length} note{list.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <form id="noteForm" className="note-form grid-form" aria-label="Add note" onSubmit={handleSave}>
        <div className="note-left">
          <textarea
            id="noteInput"
            className="note-input"
            placeholder="Add a quick note…"
            rows="4"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>

        <div className="note-right">
          <label className="label">Tags</label>
          <input
            id="tagInput"
            className="tag-input"
            type="text"
            placeholder="tags (comma separated)"
            value={tags}
            onChange={e => setTags(e.target.value)}
          />

          <div className="note-actions" style={{ marginTop: 8 }}>
            <button className="btn accent" type="submit" disabled={busy}>Save</button>
            <button className="btn" onClick={(e) => { e.preventDefault(); setContent(''); setTags(''); }} disabled={busy}>Reset</button>
          </div>
        </div>
      </form>

      <div className="notes-list-wrap" style={{ marginTop: 14 }}>
        <h4 className="section-sub">Notes</h4>

        <div id="notesList" className="notes-list">
          {(!list || list.length === 0) ? (
            <div className="muted small">No notes</div>
          ) : list.filter(Boolean).map((n, idx) => {
            const id = getId(n) || `__temp_${idx}_${Math.random().toString(36).slice(2,8)}`;
            const isEditing = String(editingId) === String(id);

            return (
              <article className="note-card" key={id} aria-live="polite">
                <div className="note-card-main">
                  {isEditing ? (
                    <div className="note-edit">
                      <textarea rows="3" value={editingContent} onChange={e => setEditingContent(e.target.value)} />
                      <input value={editingTags} onChange={e => setEditingTags(e.target.value)} placeholder="tags (comma separated)" />
                      <div className="note-edit-actions">
                        <button className="btn accent" onClick={(e) => { e.preventDefault(); saveEdit(); }} disabled={busy}>Save</button>
                        <button className="btn" onClick={(e) => { e.preventDefault(); cancelEdit(); }} disabled={busy}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="note-content">{n.content}</div>

                      {n.tags && n.tags.length ? (
                        <div className="note-tags">
                          {n.tags.map(t => <span className="tag" key={t}>{t}</span>)}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="note-meta">
                  <div className="note-time muted small">Saved: {timeAgo(n.updatedAt || n.createdAt)}</div>
                  <div className="note-controls">
                    {!isEditing && <button className="btn small" onClick={() => startEdit(n)}>Edit</button>}
                    {!isEditing && <button className="btn small" onClick={() => deleteNote(id)}>Delete</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
