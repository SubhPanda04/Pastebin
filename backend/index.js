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

// Root redirect (helpful for local dev and navigation)
app.get('/', (req, res) => {
    // Redirect to the frontend (port 5173 locally, or base URL in prod)
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
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
            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Paste Not Found</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body class="bg-[#0f172a] text-slate-300 min-h-screen flex flex-col items-center justify-center p-4">
                    <div class="text-center">
                        <h1 class="text-6xl font-bold text-slate-700 mb-4">404</h1>
                        <p class="text-xl mb-8 text-slate-400">This paste doesn't exist or has expired.</p>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg">Back to Creation</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Increment view count for HTML view
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
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pastebin - ${id}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
                <style>
                    body { background-color: #020202; color: #d4d4d8; font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
                    .mono { font-family: 'JetBrains Mono', monospace; }
                    pre { white-space: pre-wrap; word-wrap: break-word; }
                    .glass { background: rgba(5, 5, 8, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); }
                </style>
            </head>
            <body class="min-h-screen py-10 px-6 flex flex-col items-center selection:bg-white/10">
                <div class="w-full max-w-[900px]">
                    <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-white/10 pb-8">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-white/20 flex items-center justify-center">
                                <svg class="w-4 h-4 text-zinc-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m18 16 4-4-4-4M6 8l-4 4 4 4m8.5-12-5 16"/></svg>
                            </div>
                            <h1 class="text-xl font-medium tracking-tight text-white">Pastebin</h1>
                        </div>
                        <div class="flex flex-wrap gap-2 text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-400">
                           ${paste.expires_at ? `<div class="px-3 py-1.5 bg-zinc-950 border border-white/10 rounded-full flex items-center gap-2">Expire: ${new Date(paste.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                           ${paste.max_views ? `<div class="px-3 py-1.5 bg-zinc-950 border border-white/10 rounded-full flex items-center gap-2">View: ${paste.view_count + 1}/${paste.max_views}</div>` : ''}
                           <div class="px-3 py-1.5 bg-zinc-950 border border-white/10 rounded-full tracking-tighter text-zinc-500">${new Date(paste.created_at).toLocaleDateString()}</div>
                        </div>
                    </header>
                    
                    <main class="relative">
                        <div class="glass rounded-2xl overflow-hidden">
                            <div class="p-8 md:p-14 overflow-auto max-h-[80vh]">
                                <pre class="text-[14px] leading-[1.9] mono text-zinc-100 tracking-tight">${safeContent}</pre>
                            </div>
                        </div>
                    </main>

                    <div class="mt-12 flex justify-end px-4">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700 hover:text-white transition-all">
                           <span>New Session</span>
                           <span class="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        </a>
                    </div>

                    <footer class="mt-24 text-center">
                        <p class="text-[9px] text-zinc-900 font-bold uppercase tracking-[0.5em]">&copy; 2026 PASTEBIN</p>
                    </footer>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Failed to render paste:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Server Error</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
                <script src="https://cdn.tailwindcss.com"></script>
                <style>body { font-family: 'Inter', sans-serif; background: #09090b; }</style>
            </head>
            <body class="text-zinc-400 min-h-screen flex flex-col items-center justify-center p-6">
                <div class="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 mb-6 text-red-500 font-bold">!</div>
                <h1 class="text-base font-medium text-white mb-2">Service Temporarily Unavailable</h1>
                <p class="text-sm mb-8">We encountered a database error while retrieving this snippet.</p>
                <a href="/" class="text-xs uppercase font-bold tracking-widest text-zinc-500 hover:text-white transition-colors">Return home</a>
            </body>
            </html>
        `);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
