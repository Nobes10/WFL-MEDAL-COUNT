export function parseMaybeDoubleJson(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('Empty response');
  try {
    return JSON.parse(trimmed);
  } catch {
    const split = trimmed.indexOf('}{');
    if (split > 0) {
      return JSON.parse(trimmed.slice(0, split + 1));
    }
    throw new Error('Could not parse JSON');
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json, text/plain, */*',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  const text = await response.text();
  return parseMaybeDoubleJson(text);
}

export async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 80) return null;
  return bytes;
}

export async function mapPool(items, limit, mapper) {
  const list = [...items];
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (list.length) {
      const item = list.shift();
      await mapper(item);
    }
  });
  await Promise.all(workers);
}
