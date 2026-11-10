const CACHE_NAME = "styleai-static-v15";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./wardrobe.html",
  "./outfits.html",
  "./login.html",
  "./404.html",
  "./css/base.css",
  "./css/components.css",
  "./css/pages/index.css",
  "./css/pages/login.css",
  "./css/pages/wardrobe.css",
  "./css/pages/outfits.css",
  "./css/pages/404.css",
  "./js/config.js",
  "./js/auth.js",
  "./js/ui-utils.js",
  "./js/theme.js",
  "./js/login.js",
  "./js/api-client.js",
  "./js/color-analysis.js",
  "./js/wardrobe.js",
  "./js/weather.js",
  "./js/style-rules.js",
  "./js/outfits.js",
  "./js/outfit-matcher.js",
  "./js/garment-classifier.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  const networkFirst = ["document", "script", "style"].includes(
    request.destination,
  );
  if (networkFirst) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
