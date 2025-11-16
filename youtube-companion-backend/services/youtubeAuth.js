const axios = require('axios');
require('dotenv').config();

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN;

let cached = {
  accessToken: process.env.YOUTUBE_ACCESS_TOKEN || null,
  expiry: process.env.YT_ACCESS_EXPIRY ? Number(process.env.YT_ACCESS_EXPIRY) : 0
};

function hasValidToken() {
  return cached.accessToken && cached.expiry && Date.now() < (cached.expiry - 60 * 1000);
}

async function refreshAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing CLIENT_ID / CLIENT_SECRET / YT_REFRESH_TOKEN in env');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }).toString();

  const resp = await axios.post(TOKEN_URL, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  const data = resp.data;
  if (!data.access_token) throw new Error('Invalid token response from Google');

  cached.accessToken = data.access_token;
  cached.expiry = Date.now() + (data.expires_in * 1000);
  process.env.YOUTUBE_ACCESS_TOKEN = cached.accessToken;
  process.env.YT_ACCESS_EXPIRY = String(cached.expiry);
  return cached.accessToken;
}

async function getAccessToken() {
  try {
    if (hasValidToken()) return cached.accessToken;
    return await refreshAccessToken();
  } catch (err) {
    throw err;
  }
}

async function forceRefresh() {
  return refreshAccessToken();
}

module.exports = { getAccessToken, forceRefresh };
