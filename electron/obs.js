import { createServer } from 'http';
import { existsSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';

const PORTS = [4777, 4778, 4779, 4780, 4781];
const clients = new Set();

const BRIDGE = `<script>
window.wflMedal = {
  getAudienceState() {
    return fetch('/state', { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Audience state unavailable');
      return response.json();
    });
  },
  onAudience(callback) {
    const source = new EventSource('/events');
    source.onmessage = (event) => {
      try {
        callback(JSON.parse(event.data));
      } catch {
        /* keep the last frame */
      }
    };
    return () => source.close();
  },
};
</script>`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function rewriteMedalUrls(value) {
  if (typeof value === 'string') {
    return value.replace(/^medal:\/\/(logos|photos|sponsors)\/(.+)$/, '/media/$1/$2');
  }
  if (Array.isArray(value)) return value.map(rewriteMedalUrls);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = rewriteMedalUrls(item);
    return out;
  }
  return value;
}

function sendFile(res, filePath) {
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const type = TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': type.startsWith('image/') || type.includes('javascript') || type.includes('css') ? 'public, max-age=3600' : 'no-store',
  });
  res.end(readFileSync(filePath));
}

function audienceHtml(distDir) {
  const file = join(distDir, 'audience.html');
  if (!existsSync(file)) return null;
  const html = readFileSync(file, 'utf8');
  if (html.includes('window.wflMedal')) return html;
  return html.replace('</head>', `${BRIDGE}</head>`);
}

export function broadcastObs(audienceState) {
  if (!clients.size) return;
  const payload = `data: ${JSON.stringify(rewriteMedalUrls(audienceState))}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

export function startObsServer({ distDir, mediaFile, getAudience }) {
  const handler = (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);

    if (path === '/state') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(rewriteMedalUrls(getAudience())));
      return;
    }

    if (path === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify(rewriteMedalUrls(getAudience()))}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (path === '/' || path === '/audience' || path === '/audience.html') {
      const html = audienceHtml(distDir);
      if (!html) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Audience page is not built yet.');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(html);
      return;
    }

    if (path.startsWith('/assets/')) {
      sendFile(res, join(distDir, 'assets', basename(path)));
      return;
    }

    const media = path.match(/^\/media\/(logos|photos|sponsors)\/([^/]+)$/);
    if (media) {
      sendFile(res, mediaFile(media[1], basename(media[2])));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  };

  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    const tryPort = (index) => {
      if (index >= PORTS.length) {
        reject(new Error('No local port free for the OBS page'));
        return;
      }
      const port = PORTS[index];
      const onError = (error) => {
        if (error?.code === 'EADDRINUSE') tryPort(index + 1);
        else reject(error);
      };
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', onError);
        const timer = setInterval(() => {
          for (const client of clients) {
            try {
              client.write(': ping\n\n');
            } catch {
              clients.delete(client);
            }
          }
        }, 15000);
        server.on('close', () => clearInterval(timer));
        resolve({
          url: `http://127.0.0.1:${port}/`,
          close: () =>
            new Promise((done) => {
              clients.clear();
              server.close(() => done());
            }),
        });
      });
    };
    tryPort(0);
  });
}
