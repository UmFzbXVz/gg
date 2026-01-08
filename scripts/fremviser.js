(() => {
  const PROXY = "https://corsproxy.io/?";
  const API_URL = "https://api.guloggratis.dk/graphql";
  const HEADERS = {
    "accept": "*/*",
    "accept-encoding": "gzip, deflate",
    "accept-language": "en-US,en;q=0.9",
    "apollo-require-preflight": "true",
    "content-type": "application/json",
    "origin": "https://www.guloggratis.dk",
    "referer": "https://www.guloggratis.dk/",
    "user-agent": "Dalvik/2.1.0 (Linux; U; Android 15; SM-E366B Build/TQ3A.250901.001) GGApp/8.4.4 EmbeddedBrowser",
    "x-client-idfa": "granted",
    "x-client-type": "android",
    "x-client-version": "8.4.4",
    "x-requested-with": "dk.guloggratis"
  };
  const GET_LISTING_QUERY = `query GetListing($id: ID!) {
        listing(id: $id) {
            id
            title
            url
            description
            price { raw text type }
            images {
                sortOrder
                small: url(size: Listing640)
                medium: url(size: Listing1280)
            }
        }
    }`;
  const grid = document.getElementById("grid");
  const decode = str =>
    (str || "")
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const allowedTags = ['p', 'br'];
  const nodes = div.querySelectorAll('*');
  nodes.forEach(node => {
    if (!allowedTags.includes(node.tagName.toLowerCase())) {
      node.replaceWith(...node.childNodes);
    } else {
      while (node.attributes.length > 0) {
        node.removeAttribute(node.attributes[0].name);
      }
    }
  });
  return div.innerHTML.trim();
}


  async function getDbaDescription(url) {
    try {
      const res = await fetch(PROXY + encodeURIComponent(url));
      const text = await res.text();
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(text, 'text/html');

      let retailerUrl = null;
      let retailerLogo = null;

      function checkJsonLd(script) {
        try {
          const data = JSON.parse(script.textContent.trim());
          if (data["@type"] === "Corporation" && data.url && data.logo) {
            retailerUrl = data.url;
            retailerLogo = data.logo;
          }
        } catch (e) {
        }
      }

      htmlDoc.querySelectorAll('script[type="application/ld+json"]').forEach(checkJsonLd);

      htmlDoc.querySelectorAll('template[shadowrootmode]').forEach(tmpl => {
        tmpl.content.querySelectorAll('script[type="application/ld+json"]').forEach(checkJsonLd);
      });

      let images = getBestImageUrls(htmlDoc);

      function preloadSequential(imgs) {
        if (!imgs.length) return;
        const [first, ...rest] = imgs;
        const img = new Image();
        img.onload = () => preloadSequential(rest);
        img.onerror = () => preloadSequential(rest);
        img.src = first;
      }

        const buildResult = (descriptionHtml) => {
          if (images.length > 1) {
            preloadSequential(images);
          }
          const sanitizedHtml = sanitizeHtml(descriptionHtml); 
          const formattedDescription = sanitizedHtml
            .replace(/\n/g, '<br>') 
            .replace(/<p>\s*<\/p>/g, ''); 
          return {
            description: formattedDescription, 
            images: images.length ? [images[0], ...images.slice(1)] : [],
            retailerUrl,
            retailerLogo
          };
        };

      const podiumLayout = htmlDoc.querySelector('podium-layout');
      const template = podiumLayout?.querySelector('template[shadowrootmode="open"]');
      let descEl = null;

      if (template) {
        descEl = template.content.querySelector('.whitespace-pre-wrap');
        if (descEl && descEl.innerHTML.trim()) {
          let descText = descEl.innerHTML.trim();
          const h2Beskrivelse = descText.match(/<h2 class="h3">Beskrivelse<\/h2>/);
          if (h2Beskrivelse) {
            descText = descText.replace(h2Beskrivelse[0], '').trim();
          }
          return buildResult(descText);
        }
      }

      const staticRouterScript = Array.from(htmlDoc.querySelectorAll('script')).find(
        script => script.textContent.includes('__staticRouterHydrationData')
      );

      if (staticRouterScript) {
        try {
          const jsonMatch = staticRouterScript.textContent.match(/__staticRouterHydrationData = JSON\.parse\("(.+?)"\)/);
          if (jsonMatch && jsonMatch[1]) {
            const escapedJson = jsonMatch[1].replace(/\\"/g, '"');
            const data = JSON.parse(escapedJson);
            const fullDescription = data?.loaderData?.['item-recommerce']?.itemData?.description;
            if (fullDescription && fullDescription.trim()) {
              const htmlDescription = fullDescription
                .split('\n')
                .map(line => `<p>${line.trim()}</p>`)
                .join('');
              return buildResult(htmlDescription);
            }
          }
        } catch (err) {}
      }

      return buildResult('<p>Ingen beskrivelse tilgængelig.</p>');

    } catch (err) {
      return {
        description: '<p>Fejl ved indlæsning af beskrivelse.</p>',
        images: [],
        retailerUrl: null,
        retailerLogo: null
      };
    }
  }

  function getBestImageUrls(htmlDoc) {
    const template = htmlDoc.querySelector('template[shadowrootmode]');
    if (!template) return [];
    const root = template.content;
    const gallery = root.querySelector('section[data-testid="image-gallery"]');
    if (!gallery) return [];
    const imageMap = new Map();
    const addOrUpdateImage = (url, width = 0) => {
      if (!url) return;
      const key = url.split('/').pop().split('?')[0];
      if (!imageMap.has(key) || imageMap.get(key).width < width) {
        imageMap.set(key, { url, width });
      }
    };
    const parseSrcset = (srcset) => {
      return srcset.split(',')
        .map(p => p.trim())
        .map(part => {
          const [url, size] = part.split(/\s+/);
          let width = 0;
          if (size && size.endsWith('w')) width = parseInt(size.replace('w', ''), 10);
          return { url, width };
        });
    };
    gallery.querySelectorAll('img').forEach(img => {
      if (img.hasAttribute('srcset')) {
        parseSrcset(img.getAttribute('srcset')).forEach(({ url, width }) => addOrUpdateImage(url, width));
      } else if (img.hasAttribute('src')) {
        addOrUpdateImage(img.getAttribute('src'));
      }
    });
    gallery.querySelectorAll('li').forEach(li => {
      const bg = li.style.backgroundImage;
      if (bg && bg.startsWith('url(')) {
        const url = bg.slice(4, -1).replace(/["']/g, '');
        addOrUpdateImage(url);
      }
    });
    template.querySelectorAll('link[rel="preload"][as="image"]').forEach(link => {
      if (link.hasAttribute('imagesrcset')) {
        parseSrcset(link.getAttribute('imagesrcset')).forEach(({ url, width }) => addOrUpdateImage(url, width));
      } else if (link.hasAttribute('href')) {
        addOrUpdateImage(link.getAttribute('href'));
      }
    });
    return Array.from(imageMap.values()).map(obj => obj.url);
  }

  function buildImageSlider(images, title, includeZoom = false, includeGoogle = false, lowResFirst = null) {
    const slides = images.map((src, idx) => {
      let imgTag;
      if (idx === 0) {
        if (lowResFirst) {
          imgTag = `<img src="${lowResFirst}" data-highres="${src}" alt="${title}" class="placeholder">`;
        } else {
          imgTag = `<img src="${src}" alt="${title}">`;
        }
      } else {
        imgTag = `<img data-src="${src}" alt="${title}">`;
      }
      if (includeZoom) {
        imgTag = `<div class="zoom-wrapper">${imgTag}</div>`;
      }
      if (includeGoogle) {
        imgTag += `<a href="https://lens.google.com/uploadbyurl?url=${encodeURIComponent(src)}" target="_blank" rel="noopener" class="google-icon">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/d6/Google_Lens_Icon.svg" width="20">
            </a>`;
      }
      return `<div class="slide">${imgTag}</div>`;
    }).join("");
    const arrows = images.length > 1 ?
      `<button class="arrow left-arrow"><</button><button class="arrow right-arrow">></button><div class="slide-indicator"></div>` :
      "";
    return `<div class="image-slider"><div class="slider-inner">${slides}</div>${arrows}</div>`;
  }

  function addLoadingSpinner(slide) {
    const img = slide.querySelector('img');
    if (!img || img.classList.contains('placeholder')) return;
    const wrapper = slide.querySelector('.zoom-wrapper');
    if (!wrapper) return;
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    wrapper.appendChild(spinner);
    if (img.complete && img.naturalHeight !== 0) {
      spinner.remove();
      return;
    }
    img.addEventListener('load', () => spinner.remove());
    img.addEventListener('error', () => spinner.remove());
  }

function openAdModal(title, description, price, location, images, originalUrl, priceDiff = 0, lowResFirst = null, retailerUrl = null, retailerLogo = null) {
    const modal = document.createElement("div");
    modal.className = "ad-modal";
    const hasDescription = description && description.trim() && !["Ingen beskrivelse tilgængelig.", "Fejl ved indlæsning af beskrivelse."].includes(description.trim());
    const useGoogleLens = images.length && images[0] !== "noimage.svg";
    const sliderHtml = buildImageSlider(images, title, true, useGoogleLens, lowResFirst);

    const retailerLinkHtml = (retailerUrl && retailerUrl !== "null") ?
      `<a href="${retailerUrl}" target="_blank" rel="noopener" class="retailer-link" title="Besøg forhandlerens hjemmeside">
         <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M841-518v318q0 33-23.5 56.5T761-120H201q-33 0-56.5-23.5T121-200v-318q-23-21-35.5-54t-.5-72l42-136q8-26 28.5-43t47.5-17h556q27 0 47 16.5t29 43.5l42 136q12 39-.5 71T841-518Zm-272-42q27 0 41-18.5t11-41.5l-22-140h-78v148q0 21 14 36.5t34 15.5Zm-180 0q23 0 37.5-15.5T441-612v-148h-78l-22 140q-4 24 10.5 42t37.5 18Zm-178 0q18 0 31.5-13t16.5-33l22-154h-78l-40 134q-6 20 6.5 43t41.5 23Zm540 0q29 0 42-23t6-43l-42-134h-76l22 154q3 20 16.5 33t31.5 13ZM201-200h560v-282q-5 2-6.5 2H751q-27 0-47.5-9T663-518q-18 18-41 28t-49 10q-27 0-50.5-10T481-518q-17 18-39.5 28T393-480q-29 0-52.5-10T299-518q-21 21-41.5 29.5T211-480h-4.5q-2.5 0-5.5-2v282Zm560 0H201h560Z"/></svg>
       </a>` : '';

    modal.innerHTML = `
        <div class="ad-modal-content">
            ${sliderHtml}
            <div class="ad-info">
                <div class="ad-title-wrapper">
                    <h2>${decode(title)}</h2>
                </div>
                ${hasDescription ? `<div class="ad-description">${decode(description)}</div>` : ""}
                <div class="ad-price-location-container">
                    <div class="ad-price-container clickable-price-container">
                        ${priceDiff ? `<div class="ad-old-price">${(parseInt(price.replace(/\D/g,"")) - priceDiff).toLocaleString("da-DK")} kr.</div>` : ""}
                        <div class="ad-price">${price}</div>
                    </div>
                    <div class="ad-location">${decode(location)}</div>
                </div>
            </div>
            ${retailerLinkHtml}
            <a href="${originalUrl}" target="_blank" rel="noopener" class="original-link">
                <img src="https://ruban.nu/image/external-link-white.svg" width="24">
            </a>
            <button class="close-modal">×</button>
        </div>
    `;
    
    const priceElement = modal.querySelector('.ad-price');
    if (priceElement && originalUrl) {
        priceElement.style.cursor = 'pointer';
        priceElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (isMobile) {
                const fallbackTimer = setTimeout(() => {
                    window.open(originalUrl, '_blank', 'noopener');
                }, 1000);
                window.location.href = originalUrl;
                
                const blurHandler = () => {
                    clearTimeout(fallbackTimer);
                    window.removeEventListener('blur', blurHandler);
                };
                window.addEventListener('blur', blurHandler);
                
                const pagehideHandler = () => {
                    clearTimeout(fallbackTimer);
                };
                window.addEventListener('pagehide', pagehideHandler, { once: true });
            } else {
                window.open(originalUrl, '_blank', 'noopener');
            }
        });
    }
    
    document.body.appendChild(modal);

    document.body.style.overflow = "hidden";

    const inner = modal.querySelector(".slider-inner");
    const slides = Array.from(modal.querySelectorAll('.slide'));
    slides.forEach(addLoadingSpinner);
    const indicator = modal.querySelector(".slide-indicator");
    let currentSlide = 0;
    const firstImg = slides[0]?.querySelector("img");
    if (firstImg) {
      firstImg.addEventListener("load", () => {
        slides.slice(1).forEach(slide => {
          const img = slide.querySelector("img[data-src]");
          if (img) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
          }
        });
      }, { once: true });
    }
    const placeholderImg = slides[0]?.querySelector('img.placeholder');
    if (placeholderImg) {
      const highRes = placeholderImg.dataset.highres;
      const loader = new Image();
      loader.src = highRes;
      loader.onload = () => {
        placeholderImg.src = highRes;
        placeholderImg.classList.remove('placeholder');
        delete placeholderImg.dataset.highres;
      };
    }
    slides.forEach((slide, idx) => {
      const img = slide.querySelector('img');
      if (img.src.includes("noimage.svg")) return;
      const pz = Panzoom(img, {
        maxScale: 5,
        minScale: 1,
        contain: 'outside',
        panOnlyWhenZoomed: true,
        step: 0.2,
        animate: true,
        duration: 150,
        noWheel: true
      });
      img._pz = pz;
      if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
        slide.addEventListener('wheel', e => {
          e.preventDefault();
          const currentScale = pz.getScale();
          const delta = e.deltaY < 0 ? 0.25 : -0.25;
          let targetScale = currentScale + delta;
          targetScale = Math.max(1, Math.min(targetScale, 5));
          pz.zoomToPoint(targetScale, { clientX: e.clientX, clientY: e.clientY, animate: false });
        }, { passive: false });
      }
      let zoomCycle = [1, 2, 5];
      let currentZoomIndex = 0;
      let isAnimating = false;

      function handleZoomCycle(event) {
        if (isAnimating) return;
        event.preventDefault();
        currentZoomIndex = (currentZoomIndex + 1) % zoomCycle.length;
        const targetScale = zoomCycle[currentZoomIndex];
        const rect = img.getBoundingClientRect();
        let clientX = rect.left + rect.width / 2;
        let clientY = rect.top + rect.height / 2;
        if (event.type === 'dblclick') {
          clientX = event.clientX;
          clientY = event.clientY;
        } else if (event.type === 'touchend') {
          const touch = event.changedTouches[0];
          clientX = touch.clientX;
          clientY = touch.clientY;
        }
        if (targetScale === 1) {
          isAnimating = true;
          pz.reset({ animate: true });
          setTimeout(() => { isAnimating = false }, 160);
        } else {
          isAnimating = true;
          pz.zoomToPoint(targetScale, { clientX, clientY, animate: true });
          setTimeout(() => { isAnimating = false }, 160);
        }
      }
      img.addEventListener('dblclick', handleZoomCycle);
      let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
      img.addEventListener('touchend', event => {
        const currentTime = Date.now();
        const touch = event.changedTouches[0];
        const currentX = touch.clientX;
        const currentY = touch.clientY;
        const timeDiff = currentTime - lastTapTime;
        const distance = Math.hypot(currentX - lastTapX, currentY - lastTapY);
        if (timeDiff < 300 && distance < 50) {
          handleZoomCycle(event);
          lastTapTime = 0;
        } else {
          lastTapTime = currentTime;
          lastTapX = currentX;
          lastTapY = currentY;
        }
      });
    });
    const updateSlide = (newIndex) => {
      if (newIndex === undefined) newIndex = currentSlide;
      const oldImg = slides[currentSlide].querySelector('img');
      if (oldImg._pz) {
        oldImg._pz.reset();
        oldImg._baseScale = oldImg._pz.getScale();
      } else {
        oldImg._baseScale = 1;
      }
      currentSlide = newIndex;
      inner.style.transform = `translateX(-${currentSlide * 100}%)`;
      inner.style.transition = "transform 0.3s ease";
      if (indicator) indicator.textContent = `${currentSlide + 1}/${images.length}`;
      const newImg = slides[currentSlide].querySelector('img');
      if (newImg._pz) {
        newImg._pz.reset();
        newImg._baseScale = newImg._pz.getScale();
      } else {
        newImg._baseScale = 1;
      }
    };
    updateSlide();
    modal.querySelector(".left-arrow")?.addEventListener("click", () => {
      const nextIndex = (currentSlide > 0) ? currentSlide - 1 : images.length - 1;
      updateSlide(nextIndex);
    });
    modal.querySelector(".right-arrow")?.addEventListener("click", () => {
      const nextIndex = (currentSlide < images.length - 1) ? currentSlide + 1 : 0;
      updateSlide(nextIndex);
    });
    let startX = 0, startY = 0;
    inner.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      inner.style.transition = "none";
    }, { passive: true });
    inner.addEventListener("touchend", e => {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;
      const img = slides[currentSlide].querySelector('img');
      const zoomed = img._pz ? Math.abs(img._pz.getScale() - img._baseScale) > 0.01 : false;
      if (!zoomed && Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        const nextIndex = diffX > 0 ?
          (currentSlide > 0 ? currentSlide - 1 : images.length - 1) :
          (currentSlide < images.length - 1 ? currentSlide + 1 : 0);
        updateSlide(nextIndex);
      }
    }, { passive: true });
    const closeModal = () => {
      modal.classList.add("closing");
      modal.addEventListener("animationend", () => {
        modal.remove();
        document.body.style.overflow = "auto";
      }, { once: true });
    };
    modal.querySelector(".close-modal").addEventListener("click", closeModal);
    modal.addEventListener("click", e => {
      if (e.target === modal) closeModal();
    });
    const keyHandler = e => {
      if (e.key === "ArrowLeft") updateSlide(currentSlide > 0 ? currentSlide - 1 : images.length - 1);
      if (e.key === "ArrowRight") updateSlide(currentSlide < images.length - 1 ? currentSlide + 1 : 0);
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", keyHandler);
    history.pushState({ modalOpen: true }, "", window.location.href);
    const popHandler = () => {
      const modal = document.querySelector(".ad-modal");
      if (modal && modal.isConnected) {
        modal.querySelector(".close-modal")?.click();
      }
    };
    window.addEventListener("popstate", popHandler);
  }

  async function getReshopperLocation(itemId) {
    try {
      const proxy = PROXY;
      const apiUrl = `https://app.reshopper.com/api/views/items/${itemId}/via-feed`;
      const headers = {
        "Accept-Encoding": "identity",
        "Connection": "Keep-Alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Host": "app.reshopper.com",
        "ReshopperClient": "android 13",
        "User-Agent": "Titanium SDK/12.8.1 (SM-G960F; Android API Level: 33; en-US;)",
        "X-ReshopperVersion": "9.1.10"
      };
      const res = await fetch(proxy + encodeURIComponent(apiUrl), {
        method: "POST",
        headers,
        body: new FormData()
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      const loc = data?.item?.user?.address?.location;
      if (!loc || !loc.lat || !loc.lon) return "Ukendt placering";
      const reverseUrl = `https://api.dataforsyningen.dk/adgangsadresser/reverse?x=${Number(loc.lon).toFixed(6)}&y=${Number(loc.lat).toFixed(6)}&struktur=mini`;
      const revRes = await fetch(reverseUrl);
      if (!revRes.ok) throw new Error(`HTTP error ${revRes.status}`);
      const revData = await revRes.json();
      let city = revData.postnrnavn || "Ukendt";
      const zip = revData.postnr || "";
      if (city === "Ukendt" && zip && window.cityToZip) {
        const matchingCity = Object.keys(window.cityToZip).find(cityName =>
          window.cityToZip[cityName].includes(zip)
        );
        if (matchingCity) city = matchingCity;
      }
      return `${city}${zip ? ` ${zip}` : ""}`;
    } catch (err) {
      return "Ukendt placering";
    }
  }

  grid.addEventListener("click", async e => {
    const card = e.target.closest(".card");
    if (!card || e.target.classList.contains("info-btn")) return;
    e.preventDefault();
    e.stopPropagation();
    const isGG = !!card.querySelector(".gg-badge");
    const isDBA = !!card.querySelector(".dba-badge");
    const isReshopper = !!card.querySelector(".reshopper-badge");
    const originalUrl = card.href;
    const title = card.querySelector("h3")?.innerText || "Ukendt titel";
    const price = card.querySelector(".price")?.innerText || "Ingen pris";
    let location = card.querySelector(".city")?.innerText || "Ukendt placering";
    let description = "";
    let images = [];
    let priceDiff = Number(card.dataset.priceDiff || 0);
    let lowResFirst = null;
    let retailerUrl = null;
    let retailerLogo = null;

    if (isDBA) {
      lowResFirst = card.querySelector("img").src;
    }
    if (isGG) {
      const id = card.querySelector(".info-btn")?.dataset.id;
      if (id) {
        try {
          const body = {
            operationName: "GetListing",
            variables: { id },
            query: GET_LISTING_QUERY
          };
          const res = await fetch(PROXY + API_URL, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify(body)
          });
          const data = await res.json();
          const listing = data?.data?.listing;
          if (listing) {
            const rawDescription = decode(listing.description || "Ingen beskrivelse.");
            const formattedDescription = rawDescription
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map(line => `<p>${line}</p>`)
              .join('');
            description = sanitizeHtml(formattedDescription);
            images = listing.images?.map(img => img.medium || img.small || "").filter(Boolean) || [];
            if (images.length === 0) images = ["noimage.svg"];
          } else {
            description = '<p>Ingen beskrivelse tilgængelig.</p>';
          }
        } catch (err) {
          description = '<p>Fejl ved indlæsning af beskrivelse.</p>';
        }
      }
    } else if (isDBA) {
      const result = await getDbaDescription(originalUrl);
      description = result.description;
      images = result.images;
      retailerUrl = result.retailerUrl;
      retailerLogo = result.retailerLogo;
    } else if (isReshopper) {
      try {
        images = JSON.parse(card.dataset.images || "[]");
      } catch {
        images = [];
      }
      description = decode(card.dataset.description || "Ingen beskrivelse tilgængelig.");
      const itemId = card.dataset.key;
      location = await getReshopperLocation(itemId);
    }
    if (!images.length) {
      images = ["noimage.svg"];
    }
    openAdModal(title, description, price, location, images, originalUrl, priceDiff, lowResFirst, retailerUrl, retailerLogo);
  });
})();
