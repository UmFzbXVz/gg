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

	async function getDbaDescription(url) {
		try {
			const res = await fetch(PROXY + encodeURIComponent(url));
			const text = await res.text();
			const parser = new DOMParser();
			const htmlDoc = parser.parseFromString(text, 'text/html');

			const ldJsonEl = htmlDoc.querySelector('script[type="application/ld+json"]');
			if (ldJsonEl) {
				try {
					const data = JSON.parse(ldJsonEl.textContent);
					if (data && data.description) return decode(data.description.trim());
				} catch {}
			}

			const descEl = htmlDoc.querySelector('.vip-description-text');
			if (descEl) return decode(descEl.innerText.trim());

			return 'Ingen beskrivelse tilgængelig.';
		} catch {
			return 'Fejl ved indlæsning af beskrivelse.';
		}
	}

	function priceBlock(price, diff) {
		if (!diff) return `<div class="ad-price">${price}</div>`;
		const numeric = +price.replace(/\D/g, "") || 0;
		const oldPrice = diff > 0 ? numeric - diff : numeric + Math.abs(diff);
		return `
            <div class="ad-old-price">${oldPrice.toLocaleString("da-DK")} kr.</div>
            <div class="ad-price">${price}</div>
        `;
	}

	function buildImageSlider(images, title, includeZoom = false, includeGoogle = false) {
		if (!images.length) {
			return `
            <div class="image-slider empty-slider">
                <div class="slide empty-slide">
                    <span class="no-image-text">(ingen billeder)</span>
                </div>
            </div>`;
		}

		const slides = images.map(src => {
			let slideContent = `<img src="${src}" alt="${title}">`;
			if (includeZoom) {
				slideContent = `<div class="zoom-wrapper">${slideContent}</div>`;
			}
			if (includeGoogle) {
				slideContent += `<a href="https://lens.google.com/uploadbyurl?url=${encodeURIComponent(src)}" target="_blank" rel="noopener" class="google-icon">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/d/d6/Google_Lens_Icon.svg" width="20">
                </a>`;
			}
			return `<div class="slide">${slideContent}</div>`;
		}).join("");

		const arrows = images.length > 1 ?
			`<button class="arrow left-arrow"><</button><button class="arrow right-arrow">></button><div class="slide-indicator"></div>` :
			"";

		return `<div class="image-slider"><div class="slider-inner">${slides}</div>${arrows}</div>`;
	}

	function imageSlider(images, title) {
		return buildImageSlider(images, title, false, false);
	}

	function openAdModal(title, description, price, location, images, originalUrl, priceDiff = 0) {
		const modal = document.createElement("div");
		modal.className = "ad-modal";

		const hasDescription = description && description.trim() && description.trim() !== "Ingen beskrivelse tilgængelig.";
		const useGoogleLens = images.length && images[0] !== "noimage.svg";
		const sliderHtml = buildImageSlider(images, title, true, useGoogleLens);

		modal.innerHTML = `
        <div class="ad-modal-content">
            ${sliderHtml}
            <div class="ad-info">
                <div class="ad-title-wrapper"><h2>${decode(title)}</h2></div>
                ${hasDescription ? `<hr class="ad-divider"><div class="ad-description">${decode(description)}</div>` : ""}
                <hr class="ad-divider">
                <div class="ad-price-container">
                    ${priceDiff ? `<div class="ad-old-price">${(parseInt(price.replace(/\D/g,"")) - priceDiff).toLocaleString("da-DK")} kr.</div>` : ""}
                    <div class="ad-price">${price}</div>
                </div>
                <hr class="price-divider">
                <div class="ad-location">${decode(location)}</div>
            </div>
            <a href="${originalUrl}" target="_blank" rel="noopener" class="original-link">
                <img src="https://ruban.nu/image/external-link-white.svg" width="24">
            </a>
            <button class="close-modal">×</button>
        </div>
    `;

		document.body.appendChild(modal);
		document.body.style.overflow = "hidden";

		const inner = modal.querySelector(".slider-inner");
		const slides = Array.from(modal.querySelectorAll('.slide'));
		const indicator = modal.querySelector(".slide-indicator");
		let currentSlide = 0;

		slides.forEach((slide, idx) => {
			const img = slide.querySelector('img');
			const pz = Panzoom(img, {
				maxScale: 5,
				minScale: 1,
				contain: 'outside',
				panOnlyWhenZoomed: true
			});
			img._pz = pz;
			img._baseScale = pz.getScale();
		});

		const updateSlide = (newIndex) => {
			if (newIndex === undefined) newIndex = currentSlide;
			const oldImg = slides[currentSlide].querySelector('img');
			oldImg._pz.reset();
			oldImg._baseScale = oldImg._pz.getScale();

			currentSlide = newIndex;
			inner.style.transform = `translateX(-${currentSlide * 100}%)`;
			inner.style.transition = "transform 0.3s ease";
			if (indicator) indicator.textContent = `${currentSlide + 1}/${images.length}`;

			const newImg = slides[currentSlide].querySelector('img');
			newImg._pz.reset();
			newImg._baseScale = newImg._pz.getScale();
		};

		modal.querySelector(".left-arrow")?.addEventListener("click", () => {
			const nextIndex = (currentSlide > 0) ? currentSlide - 1 : images.length - 1;
			updateSlide(nextIndex);
		});

		modal.querySelector(".right-arrow")?.addEventListener("click", () => {
			const nextIndex = (currentSlide < images.length - 1) ? currentSlide + 1 : 0;
			updateSlide(nextIndex);
		});

		let startX = 0,
			startY = 0;
		inner.addEventListener("touchstart", e => {
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
			inner.style.transition = "none";
		}, {
			passive: true
		});

		inner.addEventListener("touchend", e => {
			const diffX = e.changedTouches[0].clientX - startX;
			const diffY = e.changedTouches[0].clientY - startY;

			const img = slides[currentSlide].querySelector('img');
			const zoomed = Math.abs(img._pz.getScale() - img._baseScale) > 0.01;

			if (!zoomed && Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
				const nextIndex = diffX > 0 ?
					(currentSlide > 0 ? currentSlide - 1 : images.length - 1) :
					(currentSlide < images.length - 1 ? currentSlide + 1 : 0);
				updateSlide(nextIndex);
			}
		}, {
			passive: true
		});

		const closeModal = () => {
			modal.classList.add("closing");
			modal.addEventListener("animationend", () => {
				modal.remove();
				document.body.style.overflow = "auto";
			}, {
				once: true
			});
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

		history.pushState({
			modalOpen: true
		}, "", window.location.href);
		const popHandler = () => {
			const modal = document.querySelector(".ad-modal");
			if (modal && modal.isConnected) {
				modal.querySelector(".close-modal")?.click();
			}
		};
		window.addEventListener("popstate", popHandler);

	};

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

		if (isGG) {
			const id = card.querySelector(".info-btn")?.dataset.id;
			if (id) {
				try {
					const body = {
						operationName: "GetListing",
						variables: {
							id
						},
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
						description = decode(listing.description || "Ingen beskrivelse.");
						images = listing.images?.map(img => img.medium || img.small || "").filter(Boolean) || [];
					}
				} catch {
					description = "Fejl ved indlæsning.";
				}
			}
		} else if (isDBA) {
			images = JSON.parse(card.dataset.images || "[]");
			description = await getDbaDescription(originalUrl);
		} else if (isReshopper) {
			images = JSON.parse(card.dataset.images || "[]");
			description = decode(card.dataset.description || "Ingen beskrivelse tilgængelig.");
			location = decode(card.dataset.seller || "Ukendt sælger");
		}

		openAdModal(title, description, price, location, images, originalUrl, priceDiff);
	});
})();
