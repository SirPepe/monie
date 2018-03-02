"use strict";

const CACHE_ID = "monie-v56";

const FILES = [
  "./", "index.html", "script.js", "style.css",
  "api/latest.json", "lib/localforage.min.js",
  "img/icon48.png", "img/icon48-mono.png", "img/icon72.png", "img/icon96.png",
  "img/icon144.png", "img/icon168.png", "img/icon192.png", "img/icon384.png",
  "favicon.ico", "manifest.webmanifest",
];

const notify = async (title, data = {}) => {
  if (self.registration && self.Notification.permission === "granted") {
    const notification = Object.assign({}, {
      icon: "img/icon192.png",
      badge: "img/icon48-mono.png",
    }, data);
    return self.registration.showNotification(title, notification);
  }
}

const handleInstallation = async (evt) => {
  console.log(`Installing ${CACHE_ID}`);
  const cache = await caches.open(CACHE_ID);
  const installation = await cache.addAll(FILES);
  // Is there already a service worker (= a previous version) running?
  // Then this is an upgrade
  if (self.registration.active) {
    notify(`New version ${CACHE_ID} available`, {
      body: "Close all instances of the app to apply the update",
      tag: "installed",
    });
  }
  return installation;
}

self.addEventListener("install", (evt) => evt.waitUntil(handleInstallation(evt)) );

const handleActivation = async () => {
  console.log(`Activating ${CACHE_ID}`);
  self.clients.claim(); // to get notifications when requesting new rates from the start
  const cacheKeys = await self.caches.keys();
  const toDelete = cacheKeys.filter( (key) => key !== CACHE_ID );
  return Promise.all(toDelete.map( (key) => self.caches.delete(key) ));
};

self.addEventListener("activate", (evt) => evt.waitUntil(handleActivation()) );

const updateCache = async (request, response) => {
  const clone = response.clone();
  const cache = await caches.open(CACHE_ID);
  return await cache.put(request, clone);
};

const handleRefresh = async () => {
  try {
    const response = await fetch("api/latest.json");
    if (response.ok) {
      updateCache("api/latest.json", response);
      notify("Rates updated", { body: `Successfully requested new rates`, tag: "rates" });
      return response;
    } else {
      throw new Error(`Rate request failed with code ${ response.status }`)
    }
  } catch (err) {
    notify("Failed to update rates", { body: err, tag: "rates" });
    return self.caches.match("api/latest.json");
  }
};

const handleFetch = async (evt) => {
  const cache = await caches.open(CACHE_ID);
  if (evt.request.url.endsWith("/api/latest.json?refresh=true")) {
    return handleRefresh();
  }
  if (evt.request.url.endsWith("/push-register") && evt.request.method === "POST") {
    return fetch(evt.request);
  }
  return await cache.match(evt.request);
}

self.addEventListener("fetch", (evt) => evt.respondWith(handleFetch(evt)) );

const handlePush = async (evt) => {
  const payload = (evt.data) ? evt.data.json() : null;
  if (payload) {
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage(payload);
    }
    return notify("New Rates available", { tag: "newRates" });
  }
};


self.addEventListener("push", (evt) => evt.waitUntil(handlePush(evt)) );
