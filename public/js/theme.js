(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      function () {
        navigator.serviceWorker
          .register("./sw.js?v=20261107-v12")
          .then(function (registration) {
            return registration.update();
          })
          .catch(function () {
            // La navigation reste fonctionnelle si le cache hors ligne est indisponible.
          });
      },
      { once: true },
    );
  }
})();
