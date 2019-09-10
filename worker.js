"use strict";

const CACHE_ID = "monie-v73";

const FILES = [
  "./", "script.js", "helpers.js", "style.css",
  "api/latest.json", "lib/localforage.min.js",
  "img/icon48.png", "img/icon72.png", "img/icon96.png", "img/icon120.png",
  "img/icon144.png", "img/icon152.png", "img/icon167.png", "img/icon168.png",
  "img/icon180.png", "img/icon192.png", "img/icon384.png",
  "img/apple-touch-icon-120.png", "img/apple-touch-icon-152.png", "img/apple-touch-icon-167.png", "img/apple-touch-icon-180.png",
  "img/badge.png", "favicon.ico", "manifest.webmanifest",
];


const asCacheUrl = (url) => {
  return new Promise( async (resolve) => {
    const response = await caches.match(url);
    // If there's no cache entry to be found, resolve with the real url as a
    // fallback for the data url from the cache
    if (!response) {
      return resolve(url);
    }
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}


const asCacheUrls = (urls) => Promise.all(urls.map( (url) => asCacheUrl(url) ));



let userDefinedPermission;


const notify = async (title, data = {}) => {
  if (self.registration
    && self.Notification.permission === "granted"
    && userDefinedPermission === true
  ) {
    const [ icon, badge ] = await asCacheUrls([
      "img/icon192.png", "img/badge.png"
    ]);
    const options = Object.assign({ icon, badge, }, data);
    const notification = self.registration.showNotification(title, options);
    return notification;
  }
}


const handleInstallation = async (evt) => {
  console.log(`Installing version ${CACHE_ID}`);
  const cache = await caches.open(CACHE_ID);
  const installationResult = await cache.addAll(FILES);
  // Is there already a service worker (= a previous version) running?
  // Then this is an upgrade
  if (self.registration.active) {
    notify(`New version ${CACHE_ID} available`, {
      body: "Close all instances of the app to apply the update",
      tag: "installed",
    });
  }
  return installationResult;
}

self.addEventListener("install",
  (evt) => evt.waitUntil(handleInstallation(evt)) );


const handleActivation = async () => {
  console.log(`Activating version ${CACHE_ID}`);
  // claiming to enable notifications when requesting new rates from the start
  const claim = self.clients.claim();
  const cacheKeys = await self.caches.keys();
  const toDelete = cacheKeys.filter( (key) => key !== CACHE_ID );
  // post the service worker version to the ui in order to show the installed
  // version in the sidebar
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({
      type: "STATUS_INFO",
      payload: { version: CACHE_ID },
    });
  }
  // Migrate and claim
  return Promise.all([
    claim,
    ...toDelete.map( (key) => self.caches.delete(key) ),
  ]);
};

self.addEventListener("activate",
  (evt) => evt.waitUntil(handleActivation()) );


// Update a single cache item
const updateCache = async (request, response) => {
  const clone = response.clone();
  const cache = await caches.open(CACHE_ID);
  return await cache.put(request, clone);
};


// Handle requests for new Rates. Attempt to get rates from the network, fall
// back to cache if something goes wrong
const handleRefresh = async () => {
  try {
    const response = await fetch("api/latest.json");
    if (response.ok) {
      await updateCache("api/latest.json", response);
      notify("Rates updated", {
        body: `Successfully loaded new rates`,
        tag: "rates",
      });
      return response;
    } else {
      throw new Error(`Rate request failed with code ${ response.status }`)
    }
  } catch (err) {
    notify("Failed to update rates", {
      body: err.message,
      tag: "rates",
    });
    return self.caches.match("api/latest.json");
  }
};


// Handle all requests with special cases for push message registration and
// rate refreshes
const handleFetch = async (evt) => {
  const { pathname, searchParams } = new URL(evt.request.url);
  if (pathname === "/api/latest.json" && searchParams.get("refresh") === "true") {
    return handleRefresh();
  }
  if (evt.request.method === "POST" && pathname === "/push-register") {
    return fetch(evt.request);
  }
  const cache = await caches.open(CACHE_ID);
  return await cache.match(evt.request);
}

self.addEventListener("fetch", (evt) => evt.respondWith(handleFetch(evt)) );


// Notify clients on push
const handlePush = async (evt) => {
  const payload = (evt.data) ? evt.data.json() : null;
  if (payload && payload.type === "NEW_RATES") {
    const notification = notify("New Rates available", { tag: "rates" });
    const newRatesResponse = await handleRefresh();
    const newRates = await newRatesResponse.json();
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: "NEW_RATES",
        payload: newRates,
      });
    }
    return notification;
  } else {
    return notify("Recieved push notification", {
      body: JSON.stringify(payload),
    });
  }
};


self.addEventListener("push", (evt) => evt.waitUntil(handlePush(evt)) );


self.addEventListener("message", (evt) => {
  const client = evt.source;
  if (evt.data.type === "SET_NOTIFICATION_PERMISSIONS") {
    userDefinedPermission = evt.data.payload;
    return;
  }
  if (evt.data.type === "REQUEST_STATUS_INFO") {
    client.postMessage({
      type: "STATUS_INFO",
      payload: {
        version: CACHE_ID,
      },
    });
    return;
  }
})