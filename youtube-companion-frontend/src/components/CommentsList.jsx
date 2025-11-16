import React from 'react';

export default function CommentsList({ items = [], onDelete }) {
  const list = Array.isArray(items) ? items : (items && Array.isArray(items.items) ? items.items : []);

  if (!list.length) return <div className="muted small">No comments</div>;

  return (
    <div>
      <h3 className="section-title">Comments</h3>
      <div id="comments" className="comments-list">
        {list.map((c) => {
          const snippet = c.snippet?.topLevelComment?.snippet || c.snippet || {};
          const author = snippet.authorDisplayName || 'Unknown';
          const text = snippet.textOriginal || snippet.textDisplay || '';
          const published = snippet.publishedAt ? new Date(snippet.publishedAt).toLocaleString() : '';
          const id = c.id || snippet.id || (c.snippet?.topLevelComment?.id) || Math.random().toString(36).slice(2,9);

          return (
            <div className="comment" key={id}>
              <div className="meta">
                <div>{author}</div>
                <div className="muted small">{published}</div>
              </div>
              <div className="text">{text}</div>
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => { if (window.confirm('Delete this comment?')) onDelete(id); }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
