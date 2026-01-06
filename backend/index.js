require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const sql = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Helper to get current time
const getNow = (req) => {
    if (process.env.TEST_MODE === '1' && req.headers['x-test-now-ms']) {
        return new Date(parseInt(req.headers['x-test-now-ms']));
    }
    return new Date();
};

// Health Check
app.get('/api/healthz', async (req, res) => {
    try {
        // Basic connectivity check
        await sql`SELECT 1`;
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({ ok: false, error: 'Database connection failed' });
    }
});

// Create a paste
app.post('/api/pastes', async (req, res) => {
    const { content, ttl_seconds, max_views } = req.body;

    if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ error: 'content is required and must be a non-empty string' });
    }

    if (ttl_seconds !== undefined && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
        return res.status(400).json({ error: 'ttl_seconds must be an integer >= 1' });
    }

    if (max_views !== undefined && (!Number.isInteger(max_views) || max_views < 1)) {
        return res.status(400).json({ error: 'max_views must be an integer >= 1' });
    }

    const id = nanoid(10);
    const now = getNow(req);
    let expires_at = null;

    if (ttl_seconds) {
        expires_at = new Date(now.getTime() + ttl_seconds * 1000);
    }

    try {
        await sql`
      INSERT INTO pastes (id, content, expires_at, max_views, created_at)
      VALUES (${id}, ${content}, ${expires_at}, ${max_views}, ${now})
    `;

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        res.status(201).json({
            id,
            url: `${baseUrl}/p/${id}`
        });
    } catch (error) {
        console.error('Failed to create paste:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch a paste
app.get('/api/pastes/:id', async (req, res) => {
    const { id } = req.params;
    const now = getNow(req);

    try {
        const [paste] = await sql`
      SELECT * FROM pastes WHERE id = ${id}
    `;

        if (!paste) {
            return res.status(404).json({ error: 'Paste not found' });
        }

        // Check expiry
        if (paste.expires_at && new Date(paste.expires_at) <= now) {
            return res.status(404).json({ error: 'Paste expired' });
        }

        // Check view count
        if (paste.max_views && paste.view_count >= paste.max_views) {
            return res.status(404).json({ error: 'View count limit exceeded' });
        }

        // Increment view count
        const [updatedPaste] = await sql`
      UPDATE pastes 
      SET view_count = view_count + 1 
      WHERE id = ${id} 
      RETURNING *
    `;

        res.json({
            content: updatedPaste.content,
            remaining_views: updatedPaste.max_views ? Math.max(0, updatedPaste.max_views - updatedPaste.view_count) : null,
            expires_at: updatedPaste.expires_at
        });
    } catch (error) {
        console.error('Failed to fetch paste:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// View a paste (HTML)
app.get('/p/:id', async (req, res) => {
    const { id } = req.params;
    const now = getNow(req);

    try {
        const [paste] = await sql`
      SELECT * FROM pastes WHERE id = ${id}
    `;

        if (!paste ||
            (paste.expires_at && new Date(paste.expires_at) <= now) ||
            (paste.max_views && paste.view_count >= paste.max_views)) {
            return res.status(404).send('<h1>404 Paste Not Found or Expired</h1>');
        }

        // Increment view count for HTML view as well
        await sql`UPDATE pastes SET view_count = view_count + 1 WHERE id = ${id}`;

        // Render safely
        const safeContent = paste.content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>View Paste</title>
        <style>
          body { font-family: monospace; padding: 20px; background: #0f172a; color: #e2e8f0; }
          pre { background: #1e293b; padding: 15px; border-radius: 8px; white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <h1>Paste Content</h1>
        <pre>${safeContent}</pre>
        <hr>
        <a href="/" style="color: #38bdf8;">Create New Paste</a>
      </body>
      </html>
    `);
    } catch (error) {
        console.error('Failed to render paste:', error);
        res.status(500).send('<h1>Internal Server Error</h1>');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
