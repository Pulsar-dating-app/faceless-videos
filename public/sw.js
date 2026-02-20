const CACHE_NAME = 'video-cache-v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

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

  // Responde imediatamente (cache ou rede), sem bloquear
  event.respondWith(handleVideoRequest(event.request));

  // Em paralelo, garante que o vídeo completo fique em cache para a próxima visita
  event.waitUntil(ensureCached(event.request.url));
});

// Retorna do cache se disponível; caso contrário passa direto para a rede
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
      return rangeHeader ? serveRange(cached, rangeHeader) : cached;
    }

    await cache.delete(new Request(request.url));
  }

  // Ainda não está em cache — passa para a rede normalmente
  return fetch(request);
}

// Baixa o vídeo completo e armazena no cache (roda em background)
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

    const buffer = await response.arrayBuffer();
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

// Constrói uma resposta 206 a partir do buffer cacheado
async function serveRange(response, rangeHeader) {
  const buffer = await response.clone().arrayBuffer();
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
