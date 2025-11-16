import React, { useState } from 'react';

export default function Topbar({ onSearch }) {
  const [q, setQ] = useState('');
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">YC</div>
        <div>
          <h1 className="app-title">YouTube Companion Dashboard</h1>
          <p className="app-sub">Moderation, notes & quick video management</p>
        </div>
      </div>

      <div className="top-actions">
        <input
          className="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearch(q); } }}
          placeholder="Search notes..."
          aria-label="Search notes"
        />
        <button className="btn accent" onClick={() => onSearch(q)}>Search</button>
      </div>
    </header>
  );
}
