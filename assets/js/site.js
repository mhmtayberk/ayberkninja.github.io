let navigationIndicator = document.getElementById("indicator");
let navigationTimeout = 0;
let progressFrame = 0;

pill("#page", {
  onLoading() {
    navigationIndicator = document.getElementById("indicator");

    if (navigationTimeout) {
      clearTimeout(navigationTimeout);
      navigationTimeout = 0;
    }

    if (navigationIndicator) {
      addClass(navigationIndicator, "is-loading");
      navigationIndicator.style.display = "block";
    }
  },
  onReady() {
    navigationTimeout = setTimeout(() => {
      navigationIndicator = document.getElementById("indicator");
      if (navigationIndicator) {
        removeClass(navigationIndicator, "is-loading");
        navigationIndicator.style.display = "none";
      }
    }, 500);

    initializePageFeatures();
  }
});

function addClass(target, className) {
  target.className = target.className
    .trim()
    .split(/\s+/)
    .concat(className)
    .join(" ");
}

function removeClass(target, className) {
  target.className = target.className
    .trim()
    .split(/\s+/)
    .filter(item => item !== className)
    .join(" ");
}

function initializePageFeatures() {
  initializeTableOfContents();
  initializeCodeBlocks();
  initializeLightboxImages();
  updateReadingProgress();
}

function pageLanguage() {
  return document.documentElement.lang.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function initializeTableOfContents() {
  const toc = document.querySelector(".table-of-contents");
  const postBody = document.querySelector(".post-body");
  if (!toc || !postBody) return;

  const headings = Array.from(postBody.querySelectorAll("h2, h3, h4"));
  const tocHeadings = headings.filter(heading => heading.tagName === "H2");
  const list = toc.querySelector("ol");
  const summary = toc.querySelector("summary");
  const usedIds = new Set();
  const headingInfo = [];

  list.replaceChildren();
  summary.textContent = pageLanguage() === "tr" ? "Bu yazıda" : "On this page";

  headings.forEach((heading, index) => {
    const headingText = heading.textContent.trim();
    let id = heading.id || slugifyHeading(headingText) || `section-${index + 1}`;
    const baseId = id;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    heading.id = id;
    usedIds.add(id);

    if (!heading.querySelector(":scope > .heading-anchor")) {
      const anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = `#${id}`;
      anchor.textContent = "#";
      anchor.setAttribute("aria-label", `${headingText} section link`);
      anchor.title = pageLanguage() === "tr" ? "Bu bölüme bağlantı" : "Link to this section";
      heading.append(anchor);
    }

    headingInfo.push({ heading, headingText, id });
  });

  if (tocHeadings.length < 2) {
    toc.hidden = true;
    return;
  }

  toc.hidden = false;

  headingInfo
    .filter(({ heading }) => heading.tagName === "H2")
    .forEach(({ heading, headingText, id }) => {

    const item = document.createElement("li");
    item.className = `toc-level-${heading.tagName.slice(1)}`;

    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = headingText;

    item.append(link);
    list.append(item);
    });

  applyTableOfContentsMode();
}

function slugifyHeading(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function applyTableOfContentsMode() {
  const details = document.querySelector(".table-of-contents details");
  if (!details) return;
  details.open = !window.matchMedia("(max-width: 1050px)").matches;
}

function initializeCodeBlocks() {
  document.querySelectorAll(".post-body pre").forEach(pre => {
    let container = pre.closest(".highlighter-rouge");

    if (!container) {
      container = document.createElement("div");
      container.className = "code-block-container";
      pre.before(container);
      container.append(pre);
    }

    if (container.querySelector(":scope > .copy-code-button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code-button";
    button.textContent = pageLanguage() === "tr" ? "Kopyala" : "Copy";
    button.setAttribute(
      "aria-label",
      pageLanguage() === "tr" ? "Kod bloğunu kopyala" : "Copy code block"
    );
    button.dataset.copyTarget = "code";
    container.append(button);
  });
}

function initializeLightboxImages() {
  document.querySelectorAll(".post-body img").forEach(image => {
    if (image.closest("a")) return;
    image.dataset.lightboxReady = "true";
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute(
      "aria-label",
      pageLanguage() === "tr" ? "Görseli büyüt" : "Enlarge image"
    );
  });
}

function ensureLightboxDialog() {
  let dialog = document.querySelector(".image-lightbox");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "image-lightbox";
  dialog.innerHTML = `
    <button type="button" aria-label="Close image">Close</button>
    <img alt="">
    <p hidden></p>
  `;
  document.body.append(dialog);

  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });

  return dialog;
}

function openImageLightbox(sourceImage) {
  const dialog = ensureLightboxDialog();
  const image = dialog.querySelector("img");
  const caption = dialog.querySelector("p");
  const closeButton = dialog.querySelector("button");

  image.src = sourceImage.currentSrc || sourceImage.src;
  image.alt = sourceImage.alt || "";
  caption.textContent = sourceImage.alt || "";
  caption.hidden = !caption.textContent;
  closeButton.textContent = pageLanguage() === "tr" ? "Kapat" : "Close";
  closeButton.setAttribute(
    "aria-label",
    pageLanguage() === "tr" ? "Görseli kapat" : "Close image"
  );

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for browsers that expose the API but deny clipboard permission.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function updateReadingProgress() {
  if (progressFrame) return;

  progressFrame = window.requestAnimationFrame(() => {
    progressFrame = 0;
    const progress = document.getElementById("reading-progress");
    const article = document.querySelector(".post-article");
    if (!progress || !article) return;

    const articleTop = article.getBoundingClientRect().top + window.scrollY;
    const scrollableDistance = Math.max(article.offsetHeight - window.innerHeight, 1);
    const percent = Math.min(
      100,
      Math.max(0, ((window.scrollY - articleTop) / scrollableDistance) * 100)
    );

    progress.style.width = `${percent}%`;
  });
}

document.addEventListener("click", async event => {
  const filter = event.target.closest("[data-language-filter]");
  if (filter) {
    const selectedLanguage = filter.dataset.languageFilter;

    document.querySelectorAll("[data-lang]").forEach(post => {
      post.hidden = post.dataset.lang !== selectedLanguage;
    });

    document.querySelectorAll("[data-language-filter]").forEach(button => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.languageFilter === selectedLanguage)
      );
    });
    return;
  }

  const copyButton = event.target.closest("[data-copy-target='code']");
  if (copyButton) {
    const pre = copyButton.parentElement.querySelector("pre");
    if (!pre) return;

    const originalText = pageLanguage() === "tr" ? "Kopyala" : "Copy";
    try {
      await copyText(pre.innerText);
      copyButton.textContent = pageLanguage() === "tr" ? "Kopyalandı" : "Copied";
    } catch {
      copyButton.textContent = pageLanguage() === "tr" ? "Kopyalanamadı" : "Copy failed";
    }
    window.setTimeout(() => {
      copyButton.textContent = originalText;
    }, 1500);
    return;
  }

  const lightboxImage = event.target.closest("img[data-lightbox-ready='true']");
  if (lightboxImage) openImageLightbox(lightboxImage);
});

document.addEventListener("keydown", event => {
  const image = event.target.closest("img[data-lightbox-ready='true']");
  if (!image || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  openImageLightbox(image);
});

window.addEventListener("scroll", updateReadingProgress, { passive: true });
window.addEventListener("resize", () => {
  applyTableOfContentsMode();
  updateReadingProgress();
});

initializePageFeatures();
