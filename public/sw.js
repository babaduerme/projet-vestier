const CACHE_NAME = "styleai-static-v23";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./wardrobe.html",
  "./outfits.html",
  "./trip.html",
  "./login.html",
  "./404.html",
  "./css/base.css",
  "./css/components.css",
  "./css/pages/index.css",
  "./css/pages/login.css",
  "./css/pages/wardrobe.css",
  "./css/pages/outfits.css",
  "./css/pages/trip.css",
  "./css/pages/404.css",
  "./assets/img/fashion-editorial-960.webp",
  "./assets/img/fashion-editorial-1600.webp",
  "./assets/img/tailor-atelier-640.webp",
  "./assets/img/tailor-atelier-1200.webp",
  "./js/core/config.js",
  "./js/auth/auth.js",
  "./js/core/ui-utils.js",
  "./js/core/theme.js",
  "./js/core/visual-effects.js",
  "./js/auth/login.js",
  "./js/core/api-client.js",
  "./js/wardrobe/color-analysis.js",
  "./js/wardrobe/wardrobe.js",
  "./js/shared/weather/weather.js",
  "./js/shared/styles/style-rules.js",
  "./js/shared/styles/styles-config.js",
  "./js/shared/styles/style-utils.js",
  "./js/shared/outfit-matcher.js",
  "./js/shared/outfit-generator.js",
  "./js/trip/trip-planner.js",
  "./js/trip/trip.js",
  "./js/outfits/index.js",
  "./js/wardrobe/garment-classifier.js",
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
