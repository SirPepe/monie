"use strict";

const CACHE_ID = "monie-v47";

const FILES = [
  "./", "index.html", "script.js", "style.css",
  "api/latest.json", "lib/localforage.min.js",
  "img/icon48.png", "img/icon48-mono.png", "img/icon72.png", "img/icon96.png",
  "img/icon144.png", "img/icon168.png", "img/icon192.png", "img/icon384.png",
  "favicon.ico", "manifest.json",
];

async function notify (title, data) {
  if (self.Notification.permission === "granted") {
    const notification = Object.assign({}, {
      icon: "img/icon192.png",
      badge: "img/icon48-mono.png",
    }, data);
    return self.registration.showNotification(title, notification);
  }
}

async function handleInstallation (evt) {
  console.log(`Installing ${CACHE_ID}`);
  const cache = await caches.open(CACHE_ID);
  const installation = await cache.addAll(FILES);
  // Is there already a service worker (= a previous version) running?
  if (self.registration.active) {
    notify(`New version ${CACHE_ID} available`, {
      body: "Close all instances of the app to apply the update"
    });
  }
  return installation;
}

self.addEventListener("install", (evt) => evt.waitUntil(handleInstallation(evt)) );

async function handleActivation () {
  console.log(`Activating ${CACHE_ID}`);
  const cacheKeys = await self.caches.keys();
  const toDelete = cacheKeys.filter( (key) => key !== CACHE_ID );
  return Promise.all(toDelete.map( (key) => self.caches.delete(key) ));
}

self.addEventListener("activate", (evt) => evt.waitUntil(handleActivation()) );


async function refreshRates (request) {
  const [ cache, response ] = await Promise.all([
    caches.open(CACHE_ID), fetch(request),
  ]);
  if (response.ok) {
    // overwrite old response to "api/latest.json"
    await cache.put(new Request("api/latest.json"), response.clone());
    return { updated: true, response };
  } else {
    return { updated: false, response: cache.match("api/latest.json") };
  }
}


async function serveFromCache (evt) {
  console.log(`Serving ${evt.request.url} from cache ${CACHE_ID}`);
  const cache = await caches.open(CACHE_ID);
  if (evt.request.url.endsWith("api/latest.json?refresh=true")) {
    console.log(`Updating rates...`);
    const { response, updated } = await refreshRates(evt.request);
    if (updated) {
      notify("Rates updated", { body: `Successfully requested new rates` });
    } else {
      notify("Failed to update rates", { body: `Rate request failed with code ${response.status}` });
    }
    return response;
  }
  return cache.match(evt.request);
}

self.addEventListener("fetch", (evt) => evt.respondWith(serveFromCache(evt)) );
