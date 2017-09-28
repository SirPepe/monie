const CACHE_ID = "v1";


const PRECACHE_FILES = [
  "./", "index.html", "script.js", "style.css",
  "api/latest.json", "lib/localforage.min.js",
  "img/icon48.png", "img/icon72.png", "img/icon96.png", "img/icon144.png",
  "img/icon168.png", "img/icon192.png", "img/icon192-mono.png", "img/icon384.png",
  "favicon.ico", "manifest.json",
];

async function precache () {
  try {
    const cache = await caches.open(CACHE_ID);
    return cache.addAll(PRECACHE_FILES);
  } catch (fail) {
    throw fail;
  }
}

async function fromCache (request) {
  const cache = await caches.open(CACHE_ID);
  return cache.match(request);
}

async function update (request) {
  const [ cache, response ] = await Promise.all([
    caches.open(CACHE_ID), fetch(request),
  ]);

  await cache.put(request, response.clone());
  return response;
}

async function refresh (response) {
  const [ clients, data ] = await Promise.all([
    self.clients.matchAll(), response.json(),
  ]);
  for (const client of clients) {
    client.postMessage({ type: "RATE_UPDATE", payload: data })
  }
}

async function handleError (details) {
  for (const client of await self.clients.matchAll()) {
    client.postMessage({ type: "ERROR", payload: details })
  }
}

self.addEventListener("fetch", function (evt) {
  evt.respondWith(fromCache(evt.request));
  if (evt.request.url.endsWith("api/latest.json")) {
    update(evt.request)
      .then(refresh)
      .catch(handleError);
  }
});

self.addEventListener("install", (evt) => evt.waitUntil(precache()) );
