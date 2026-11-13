import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

function possibleTailscaleBins() {
  const list = [];
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';
    list.push(
      join(pf, 'Tailscale', 'tailscale.exe'),
      join(pf86, 'Tailscale', 'tailscale.exe'),
      join(local, 'Tailscale', 'tailscale.exe'),
      'tailscale.exe',
      'tailscale'
    );
  } else {
    list.push('/usr/local/bin/tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale', 'tailscale');
  }
  return list;
}

function findTailscale() {
  for (const bin of possibleTailscaleBins()) {
    if (bin === 'tailscale' || bin === 'tailscale.exe') continue;
    if (existsSync(bin)) return bin;
  }
  return process.platform === 'win32' ? 'tailscale.exe' : 'tailscale';
}

function run(bin, args, timeoutMs = 20000, stopWhen) {
  return new Promise((resolve) => {
    const child = execFile(
      bin,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err && err.code,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          error: err ? String(err.message || err) : null,
        });
      }
    );
    if (!stopWhen) return;
    let seen = '';
    const watch = (chunk) => {
      seen += String(chunk);
      if (stopWhen(seen)) child.kill();
    };
    child.stdout?.on('data', watch);
    child.stderr?.on('data', watch);
  });
}

const NEEDS_ENABLE = /https:\/\/login\.tailscale\.com\/[^\s]+/;

function firstHttpsUrl(text) {
  const match = String(text).match(/https:\/\/[a-z0-9.-]+\.ts\.net(?::\d+)?/i);
  return match ? match[0].replace(/\/$/, '') : null;
}

async function getStatusJson(bin) {
  const res = await run(bin, ['status', '--json']);
  if (!res.ok || !res.stdout.trim()) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

function urlForLocalPort(text, localPort) {
  const port = String(localPort);
  const portHit = new RegExp(`(?:localhost|127\\.0\\.0\\.1)?:${port}\\b`);
  const lines = String(text || '').split(/\r?\n/);
  let currentUrl = null;
  for (const line of lines) {
    const found = firstHttpsUrl(line);
    if (found) currentUrl = found;
    if (currentUrl && portHit.test(line)) return currentUrl;
  }
  return null;
}

function urlFromServeJson(json, localPort) {
  const port = String(localPort);
  const web = json?.Web;
  if (!web || typeof web !== 'object') return null;
  for (const [host, spec] of Object.entries(web)) {
    const handlers = spec?.Handlers || spec?.handlers || {};
    for (const handler of Object.values(handlers)) {
      const proxy = String(handler?.Proxy || handler?.proxy || '');
      if (proxy.includes(`:${port}`)) {
        const httpsOn = json?.AllowFunnel?.[host] || json?.AllowFunnel?.[`${host}`];
        const hostName = String(host).replace(/:443$/, '');
        if (httpsOn === false) continue;
        if (/^https?:\/\//i.test(hostName)) return hostName.replace(/\/$/, '');
        return `https://${hostName}`.replace(/\/$/, '');
      }
    }
  }
  return null;
}

async function getFunnelPublicUrl(bin, localPort) {
  const attempts = [
    ['funnel', 'status'],
    ['funnel', 'status', '--json'],
    ['serve', 'status'],
    ['serve', 'status', '--json'],
  ];
  for (const args of attempts) {
    const res = await run(bin, args);
    const text = `${res.stdout}\n${res.stderr}`;
    if (/no serve config/i.test(text)) continue;
    const fromText = urlForLocalPort(text, localPort);
    if (fromText) return fromText;
    const raw = res.stdout.trim();
    if (raw.startsWith('{')) {
      try {
        const json = JSON.parse(raw);
        const fromJson = urlFromServeJson(json, localPort);
        if (fromJson) return fromJson;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export async function enableDirectorFunnel(localPort) {
  const bin = findTailscale();
  const which = await run(bin, ['version']);
  if (!which.ok && which.code === 'ENOENT') {
    return {
      ok: false,
      status: 'missing',
      message: 'Install Tailscale on this PC (free) so phones can send photos from any network.',
      installUrl: 'https://tailscale.com/download',
    };
  }

  const status = await getStatusJson(bin);
  const backend = status?.BackendState;
  if (backend && backend !== 'Running') {
    return {
      ok: false,
      status: 'logged-out',
      message: 'Open Tailscale and sign in on this PC, then retry anywhere access.',
      installUrl: 'https://tailscale.com/download',
    };
  }

  const already = await getFunnelPublicUrl(bin, localPort);
  if (already) {
    return {
      ok: true,
      status: 'ready',
      url: already,
      message: 'Works from anywhere, on any phone.',
    };
  }

  const cmds = [
    ['funnel', '--bg', '--yes', '--https=8443', String(localPort)],
    ['funnel', '--bg', '--yes', '--https=8443', `http://127.0.0.1:${localPort}`],
    ['funnel', '--bg', '--yes', String(localPort)],
    ['funnel', '--bg', '--yes', `http://127.0.0.1:${localPort}`],
  ];

  let last = null;
  for (const args of cmds) {
    last = await run(bin, args, 45000, (text) => NEEDS_ENABLE.test(text));
    const url =
      urlForLocalPort(`${last.stdout}\n${last.stderr}`, localPort) || (await getFunnelPublicUrl(bin, localPort));
    if (url) {
      return {
        ok: true,
        status: 'ready',
        url,
        message: 'Works from anywhere, on any phone.',
      };
    }
    const enable = `${last.stdout}\n${last.stderr}`.match(NEEDS_ENABLE);
    if (enable) {
      return {
        ok: false,
        status: 'needs-enable',
        message: 'Approve Funnel in the browser that just opened, then retry anywhere access.',
        enableUrl: enable[0],
        url: null,
      };
    }
  }

  return {
    ok: false,
    status: 'failed',
    message:
      last?.stderr?.trim() ||
      last?.stdout?.trim() ||
      'Could not start Tailscale Funnel. Turn on HTTPS and Funnel in the Tailscale admin, then retry.',
    adminUrl: 'https://login.tailscale.com/admin/dns',
  };
}
