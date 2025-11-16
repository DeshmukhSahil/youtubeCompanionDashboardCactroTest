const express = require('express');
const axios = require('axios');
const Note = require('../models/Note');
const Log = require('../models/Log');
const { getAccessToken } = require('../services/youtubeAuth');

const router = express.Router();
const baseURL = 'https://www.googleapis.com/youtube/v3';

async function logAction(action, meta = {}) {
  try {
    await Log.create({ action, meta });
  } catch (e) {
    console.error('logAction failed:', e.message);
  }
}


async function buildReadAuth() {
  try {
    const token = await getAccessToken();
    return { token, headers: { Authorization: `Bearer ${token}` } };
  } catch (e) {
    return { token: null, headers: {} };
  }
}

/* GET video */
router.get('/video', async (req, res) => {
  const videoId = req.query.videoId || process.env.VIDEO_ID;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const { token, headers } = await buildReadAuth();
    const params = { part: 'snippet,statistics', id: videoId };
    if (!token && process.env.YOUTUBE_API_KEY) params.key = process.env.YOUTUBE_API_KEY;

    const response = await axios.get(`${baseURL}/videos`, { params, headers });
    await logAction('FETCH_VIDEO_DETAILS', { videoId });
    return res.json(response.data);
  } catch (err) {
    console.error('YouTube API error:', err.response?.status, err.response?.data || err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data || { message: err.message } });
  }
});

/* POST comment */
router.post('/comment', async (req, res) => {
  const { text, parentId } = req.body;
  const VIDEO_ID = process.env.VIDEO_ID;

  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });

  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    return res.status(401).json({ error: 'Missing/invalid OAuth token. Authorize once and set YT_REFRESH_TOKEN in .env' });
  }

  const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };

  try {
    let response;
    if (parentId) {
      response = await axios.post(`${baseURL}/comments?part=snippet`, { snippet: { parentId, textOriginal: text } }, config);
    } else {
      response = await axios.post(`${baseURL}/commentThreads?part=snippet`, {
        snippet: { videoId: VIDEO_ID, topLevelComment: { snippet: { textOriginal: text } } }
      }, config);
    }

    await logAction('POST_COMMENT', { text, parentId });
    return res.json(response.data);
  } catch (err) {
    console.error('YouTube API error:', err.response?.status, err.response?.data || err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data || { message: err.message } });
  }
});

/* GET comments */
router.get('/comments', async (req, res) => {
  const VIDEO_ID = process.env.VIDEO_ID;
  if (!VIDEO_ID) return res.status(400).json({ error: 'Missing VIDEO_ID in env' });

  const all = req.query.all === 'true';
  const maxResults = Math.min(parseInt(req.query.maxResults || '50', 10), 100);
  let pageToken = req.query.pageToken;

  try {
    const { token, headers } = await buildReadAuth();
    const paramsBase = { part: 'snippet,replies', videoId: VIDEO_ID, maxResults };
    if (!token && process.env.YOUTUBE_API_KEY) paramsBase.key = process.env.YOUTUBE_API_KEY;

    async function fetchPage(tokenParam) {
      const params = { ...paramsBase };
      if (tokenParam) params.pageToken = tokenParam;
      const resp = await axios.get(`${baseURL}/commentThreads`, { params, headers });
      return resp.data;
    }

    if (!all) {
      const data = await fetchPage(pageToken);
      await logAction('FETCH_COMMENTS_PAGE', { pageToken, count: (data.items || []).length });
      return res.json(data);
    }

    const allItems = [];
    let nextToken = pageToken;
    const SAFETY_LIMIT = 1000;

    while (true) {
      const data = await fetchPage(nextToken);
      if (Array.isArray(data.items)) allItems.push(...data.items);
      nextToken = data.nextPageToken;
      if (!nextToken) break;
      if (allItems.length >= SAFETY_LIMIT) break;
    }

    await logAction('FETCH_COMMENTS_ALL', { total: allItems.length });
    return res.json({ items: allItems, nextPageToken: nextToken || null, fetchedAll: !nextToken });
  } catch (err) {
    console.error('YouTube comments.list error:', err.response?.status, err.response?.data || err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data || { message: err.message } });
  }
});

/* DELETE comment */
router.delete('/comment/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Comment id required' });

  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    return res.status(401).json({ error: 'Missing/invalid OAuth token. Authorize once and set YT_REFRESH_TOKEN in .env' });
  }

  const config = { params: { id }, headers: { Authorization: `Bearer ${token}` } };

  try {
    await axios.delete(`${baseURL}/comments`, config);
    await logAction('DELETE_COMMENT', { id });
    return res.sendStatus(200);
  } catch (err) {
    console.error('YouTube delete error:', err.response?.status, err.response?.data || err.message);
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };

    if (status === 400) {
      try {
        await axios.delete(`${baseURL}/commentThreads`, config);
        await logAction('DELETE_COMMENTTHREAD', { id });
        return res.sendStatus(200);
      } catch (fallbackErr) {
        console.error('Fallback delete error:', fallbackErr.response?.status, fallbackErr.response?.data || fallbackErr.message);
        return res.status(fallbackErr.response?.status || 500).json({ error: fallbackErr.response?.data || fallbackErr.message });
      }
    }

    if (status === 401) return res.status(401).json({ error: 'Unauthorized — token missing/expired/invalid or missing scope', details: data });
    if (status === 403) return res.status(403).json({ error: 'Forbidden — likely not comment owner or channel owner', details: data });

    return res.status(status).json({ error: data });
  }
});

/* PUT video */
router.put('/video', async (req, res) => {
  const { title, description } = req.body;
  const VIDEO_ID = process.env.VIDEO_ID;

  if (!VIDEO_ID) return res.status(400).json({ error: 'Missing VIDEO_ID in env' });
  if (!title && !description) return res.status(400).json({ error: 'title or description required' });

  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    return res.status(401).json({ error: 'Missing/invalid OAuth token. Authorize once and set YT_REFRESH_TOKEN in .env' });
  }

  try {
    const getResp = await axios.get(`${baseURL}/videos`, {
      params: { part: 'snippet', id: VIDEO_ID },
      headers: { Authorization: `Bearer ${token}` }
    });

    const item = getResp.data?.items?.[0];
    if (!item || !item.snippet) {
      return res.status(404).json({ error: 'Video not found or snippet missing' });
    }

    const existing = item.snippet;

    const categoryId = existing.categoryId || '22';

    const updatedSnippet = {
      ...existing,
      title: title !== undefined ? title : existing.title,
      description: description !== undefined ? description : existing.description,
      categoryId
    };

    const putResp = await axios.put(
      `${baseURL}/videos`,
      { id: VIDEO_ID, snippet: updatedSnippet },
      {
        params: { part: 'snippet' },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await logAction('UPDATE_VIDEO_DETAILS', { title, description, videoId: VIDEO_ID });
    return res.json(putResp.data);
  } catch (err) {
    console.error('Update video error:', err.response?.status, err.response?.data || err.message);
    const status = err.response?.status || 500;
    const data = err.response?.data || { message: err.message };

    if (data?.error?.errors?.some(e => e.reason === 'invalidCategoryId')) {
      data.hint = 'The existing categoryId is invalid. Consider calling /videoCategories.list to get supported categories and update the snippet.categoryId accordingly.';
    }

    return res.status(status).json({ error: data });
  }
});


router.get('/notes', async (req, res) => {
  const videoId = req.query.videoId || process.env.VIDEO_ID;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const notes = await Note.find({ videoId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    return res.json(notes);
  } catch (err) {
    console.error('Notes list error', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/note', async (req, res) => {
  const { content, tags } = req.body;
  const videoId = req.body.videoId || process.env.VIDEO_ID;

  if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });

  try {
    const note = await Note.create({
      videoId,
      content: content.trim(),
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(s=>s.trim()).filter(Boolean) : [])
    });
    await logAction('ADD_NOTE', { noteId: note._id, videoId });
    return res.status(201).json(note);
  } catch (err) {
    console.error('Note create error', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/note/:id', async (req, res) => {
  const id = req.params.id;
  const { content, tags } = req.body;
  if (!id) return res.status(400).json({ error: 'note id required' });

  const update = {};
  if (content !== undefined) {
    if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });
    update.content = content.trim();
  }
  if (tags !== undefined) {
    update.tags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(s=>s.trim()).filter(Boolean) : []);
  }
  update.updatedAt = Date.now();

  try {
    const note = await Note.findByIdAndUpdate(id, update, { new: true });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    await logAction('UPDATE_NOTE', { noteId: id, changes: Object.keys(update) });
    return res.json(note);
  } catch (err) {
    console.error('Note update error', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/note/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'note id required' });

  try {
    const note = await Note.findByIdAndDelete(id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    await logAction('DELETE_NOTE', { noteId: id, videoId: note.videoId });
    return res.sendStatus(204);
  } catch (err) {
    console.error('Note delete error', err.message);
    return res.status(500).json({ error: err.message });
  }
});



router.get('/note/search', async (req, res) => {
  const { q } = req.query;
  try {
    const notes = await Note.find({ content: new RegExp(q, 'i') });
    return res.json(notes);
  } catch (err) {
    console.error('Note search error', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
