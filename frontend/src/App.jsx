import { useState } from 'react';
import axios from 'axios';
import { Clipboard, Check, Clock, Eye, Send, Code, Link as LinkIcon, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [content, setContent] = useState('');
  const [ttl, setTtl] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        content,
        ttl_seconds: ttl ? parseInt(ttl) : undefined,
        max_views: maxViews ? parseInt(maxViews) : undefined,
      };

      const response = await axios.post(`${API_BASE_URL}/api/pastes`, payload);
      setResult(response.data);
      setContent('');
      setTtl('');
      setMaxViews('');
    } catch (err) {
      setError(err.response?.data?.error || 'Initialization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#020202] text-zinc-300 selection:bg-white/10 flex flex-col items-center py-12 px-6">
      <div className="w-full max-w-[800px]">
        {/* Header */}
        <header className="flex justify-between items-center mb-16 border-b border-white/[0.03] pb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-white/[0.08]">
              <Code className="w-5 h-5 text-zinc-200" />
            </div>
            <h1 className="text-xl font-medium tracking-tight text-white">Pastebin</h1>
          </div>
        </header>

        <main>
          <form onSubmit={handleCreate} className="space-y-6">
            {/* Main Input Area */}
            <div className="relative">
              <textarea
                className="w-full h-[400px] bg-zinc-950/40 border border-white/10 rounded-2xl p-8 text-[15px] leading-relaxed mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-all resize-none shadow-2xl"
                placeholder="Content goes here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
              />
            </div>

            {/* Constraints Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-950/20 border border-white/10 rounded-2xl p-5">
                <label className="block text-[11px] uppercase font-bold tracking-[0.2em] text-zinc-400 mb-3 ml-1">
                  Expiry (Seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-white/30 placeholder:text-zinc-500"
                  placeholder="Optional"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                />
              </div>

              <div className="bg-zinc-950/20 border border-white/10 rounded-2xl p-5">
                <label className="block text-[11px] uppercase font-bold tracking-[0.2em] text-zinc-400 mb-3 ml-1">
                  View Limit
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-white/30 placeholder:text-zinc-500"
                  placeholder="Optional"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="w-full bg-zinc-100 disabled:bg-zinc-900 disabled:text-zinc-700 text-black font-bold uppercase tracking-widest text-[11px] py-5 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-white/5"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mx-auto" />
              ) : (
                "Store Paste"
              )}
            </button>
          </form>

          {/* Result Interface */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8"
              >
                <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                  <div className="flex items-center gap-4 group cursor-pointer" onClick={copyToClipboard}>
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-white/[0.05]">
                      <LinkIcon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                    </div>
                    <div>
                      <p className="text-[13px] text-zinc-400 truncate max-w-[200px] md:max-w-md mono">{result.url}</p>
                    </div>
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2.5 px-6 py-3 bg-zinc-100 hover:bg-white text-black rounded-xl transition-all active:scale-95 shadow-xl shadow-white/5"
                  >
                    {copied ? (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-green-700">Copied</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-widest">Copy URL</span>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 flex items-center justify-center text-[10px] uppercase tracking-widest text-red-900 font-black"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-24 pt-8 border-t border-white/[0.03] flex justify-center text-[10px] text-zinc-800 font-black uppercase tracking-[0.4em]">
          <span>© 2026 PASTEBIN</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
