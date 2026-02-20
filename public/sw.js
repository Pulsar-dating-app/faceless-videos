const CACHE_NAME = 'video-cache-v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const MAX_CACHE_BYTES = 50 * 1024 * 1024; // não cacheia vídeos acima de 50 MB

// Hosts cujos vídeos devem ser cacheados
const VIDEO_HOSTS = ['tzkasbfuhnhfhyvhcjnf.supabase.co'];

// Evita baixar o mesmo arquivo mais de uma vez simultaneamente
const pendingCache = new Set();

function isVideoRequest(url) {
  try {
    const parsed = new URL(url);
    return (
      VIDEO_HOSTS.some((host) => parsed.hostname === host) &&
      (parsed.pathname.endsWith('.mp4') || parsed.pathname.endsWith('.webm'))
    );
  } catch {
    return false;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isVideoRequest(event.request.url)) return;

  event.respondWith(handleVideoRequest(event.request));
  event.waitUntil(ensureCached(event.request.url));
});

async function handleVideoRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const rangeHeader = request.headers.get('Range');
  const cached = await cache.match(new Request(request.url));

  if (cached) {
    const cachedAt = cached.headers.get('sw-cached-at');
    const expired = cachedAt
      ? Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS
      : false;

    if (!expired) {
      try {
        if (rangeHeader) {
          return await serveRange(cached, rangeHeader);
        }
        return cached;
      } catch (err) {
        // Se qualquer coisa der errado ao servir do cache, cai na rede
        console.warn('[SW] Falha ao servir do cache, usando rede:', err);
        await cache.delete(new Request(request.url));
      }
    } else {
      await cache.delete(new Request(request.url));
    }
  }

  return fetch(request);
}

async function ensureCached(url) {
  if (pendingCache.has(url)) return;

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(new Request(url));
  if (cached) return;

  pendingCache.add(url);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'video/mp4,video/*,*/*' },
    });

    if (!response.ok) return;

    // Verifica tamanho antes de ler o body inteiro
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_CACHE_BYTES) {
      console.warn('[SW] Vídeo muito grande para cachear:', url, contentLength);
      return;
    }

    const buffer = await response.arrayBuffer();

    // Confere novamente após leitura (caso content-length não estivesse presente)
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_CACHE_BYTES) return;

    const headers = new Headers(response.headers);
    headers.set('sw-cached-at', new Date().toISOString());
    headers.set('content-length', String(buffer.byteLength));

    await cache.put(
      new Request(url),
      new Response(buffer, { status: 200, statusText: 'OK', headers })
    );
  } catch (err) {
    console.warn('[SW] Cache em background falhou:', url, err);
  } finally {
    pendingCache.delete(url);
  }
}

async function serveRange(response, rangeHeader) {
  const buffer = await response.clone().arrayBuffer();

  if (buffer.byteLength === 0) {
    throw new Error('Buffer cacheado vazio');
  }

  const totalSize = buffer.byteLength;
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);

  if (!match) {
    return new Response('Range inválido', { status: 416 });
  }

  let start, end;
  if (match[1] === '') {
    const suffixLength = parseInt(match[2]);
    start = totalSize - suffixLength;
    end = totalSize - 1;
  } else {
    start = parseInt(match[1]);
    end = match[2] !== '' ? Math.min(parseInt(match[2]), totalSize - 1) : totalSize - 1;
  }

  if (start > end || start >= totalSize) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${totalSize}` },
    });
  }

  const slice = buffer.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Content-Length': String(slice.byteLength),
      'Accept-Ranges': 'bytes',
    },
  });
}
