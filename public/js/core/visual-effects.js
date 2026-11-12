/* Pure presentation helpers: no application data or business rules. */
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const observeImages = (root) => {
  root
    .querySelectorAll?.(
      ".cloth-img:not(:has(img)), .trip-suitcase-item:not(:has(img)), .trip-day-piece:not(:has(img))",
    )
    .forEach((item) => item.classList.add("has-image"));
  const markLoaded = (image) => {
    image.classList.add("is-loaded");
    image
      .closest(
        ".cloth-img, .outfit-piece, .trip-suitcase-item, .trip-day-piece",
      )
      ?.classList.add("has-image");
  };
  root.querySelectorAll?.("img").forEach((image) => {
    const markFailed = () => {
      image.classList.add("is-error");
      image
        .closest(
          ".cloth-img, .outfit-piece, .trip-suitcase-item, .trip-day-piece",
        )
        ?.classList.add("has-image");
    };
    if (image.complete && image.naturalWidth > 0) markLoaded(image);
    else if (image.complete) markFailed();
    else {
      image.addEventListener("load", () => markLoaded(image), { once: true });
      image.addEventListener("error", markFailed, { once: true });
    }
  });
};
const updateHeader = () =>
  document
    .querySelectorAll(".navbar, .site-header")
    .forEach((header) =>
      header.classList.toggle("is-scrolled", window.scrollY > 18),
    );
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();
if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.08 },
  );
  const watch = (node) => {
    observeImages(node);
    if (
      node.matches(
        "section, .cloth-card, .outfit-card, .trip-card, .feature-card, .step, .day-card, .day-style-card, .trip-day-card",
      )
    ) {
      node.classList.add("reveal");
      observer.observe(node);
    }
    node
      .querySelectorAll?.(
        "section, .cloth-card, .outfit-card, .trip-card, .feature-card, .step, .day-card, .day-style-card, .trip-day-card",
      )
      .forEach((item) => {
        item.classList.add("reveal");
        observer.observe(item);
      });
  };
  document
    .querySelectorAll(
      "main section, .cloth-card, .outfit-card, .trip-card, .feature-card, .step, .day-style-card, .saved-week-item",
    )
    .forEach(watch);
  new MutationObserver((records) =>
    records.forEach((record) =>
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) watch(node);
      }),
    ),
  ).observe(document.querySelector("main") || document.body, {
    childList: true,
    subtree: true,
  });
}
observeImages(document);
