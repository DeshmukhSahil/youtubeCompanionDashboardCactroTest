import axios from 'axios';
const API = '/api';

export const getVideo = () => axios.get(`${API}/video`).then(r => r.data);
export const getComments = () => axios.get(`${API}/comments`).then(r => r.data);
export const postComment = (text, parentId) => axios.post(`${API}/comment`, { text, parentId }).then(r => r.data);
export const deleteComment = (id) => axios.delete(`${API}/comment/${encodeURIComponent(id)}`).then(r => r.data);
export const saveNote = (content, tags) => axios.post(`${API}/note`, { content, tags }).then(r => r.data);
export const searchNotes = (q = '') => axios.get(`${API}/note/search?q=${encodeURIComponent(q)}`).then(r => r.data);
export async function updateVideo({ title, description }) {
    const res = await fetch('https://youtube-companion-dashboard-cactro-seven.vercel.app/api/video', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
}
