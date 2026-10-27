'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { extract } = require('./extractor');
try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); } } catch {}
const MAX = 50000, TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  const send = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'GET' && req.url === '/api/health') return send(200, { ok: true, aiConfigured: !!(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL) });
  if (req.method === 'POST' && req.url === '/api/extract') {
    let body = '';
    for await (const c of req) { body += c; if (body.length > MAX * 2) return send(413, { error: 'Request too large.' }); }
    let notes; try { notes = JSON.parse(body).notes; } catch { return send(400, { error: 'Invalid JSON body.' }); }
    if (typeof notes !== 'string' || notes.trim().length < 20) return send(400, { error: 'Please paste at least 20 characters of notes.' });
    if (notes.length > MAX) return send(400, { error: `Notes exceed ${MAX} characters.` });
    return send(200, await extract(notes));
  }
  const dist = path.join(__dirname, '..', 'frontend', 'dist');
  let rel; try { rel = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]); } catch { return send(400, { error: 'Bad URL' }); }
  const f = path.join(dist, rel);
  if (!f.startsWith(dist)) return send(403, { error: 'Forbidden' });
  fs.readFile(f, (e, d) => { if (e) return send(404, { error: 'Not found. Run "npm run build" first.' }); res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(d); });
});
if (require.main === module) server.listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
module.exports = server;
