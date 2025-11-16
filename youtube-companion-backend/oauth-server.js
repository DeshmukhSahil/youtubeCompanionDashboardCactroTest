// oauth-server.js (tiny)
const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIR = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5000/oauth2callback';
const PORT = new URL(REDIR).port || 5000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set CLIENT_ID and CLIENT_SECRET in env');
  process.exit(1);
}

const app = express();
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIR);
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];

app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',  // important to get refresh_token
    prompt: 'consent',
    scope: SCOPES
  });
  res.send(`<h3>Authorize (copy refresh_token to .env as YT_REFRESH_TOKEN)</h3><a href="${url}" target="_blank">${url}</a>`);
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code in query');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('TOKENS:', tokens);
    res.send(`<h2>Success</h2><pre>${JSON.stringify(tokens, null, 2)}</pre><p>Copy the refresh_token value into your .env as YT_REFRESH_TOKEN=...</p>`);
  } catch (err) {
    console.error('Callback error', err.response?.data || err.message || err);
    res.status(500).send('OAuth exchange failed. See terminal.');
  }
});

app.listen(PORT, () => {
  console.log(`Open http://localhost:${PORT}/auth to start OAuth flow (redirect URI must match the registered one).`);
});
