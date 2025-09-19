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
		.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

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

	function imageSlider(images, title) {
		if (!images.length) {
			return `
			<div class="image-slider empty-slider">
				<div class="slide empty-slide">
					<span class="no-image-text">(ingen billeder)</span>
				</div>
			</div>`;
		}

		const slides = images.map(src => `
			<div class="slide">
				<img src="${src}" alt="${title}">
				<a href="https://lens.google.com/uploadbyurl?url=${encodeURIComponent(src)}" target="_blank" rel="noopener" class="google-icon">
					<img src="https://upload.wikimedia.org/wikipedia/commons/d/d6/Google_Lens_Icon.svg" width="20">
				</a>
			</div>`).join("");

		const arrows = images.length > 1 ?
			`<button class="arrow left-arrow"><</button><button class="arrow right-arrow">></button><div class="slide-indicator"></div>` :
			"";

		return `<div class="image-slider"><div class="slider-inner">${slides}</div>${arrows}</div>`;
	}

	function openAdModal(title, description, price, location, images, originalUrl, priceDiff = 0) {
		const modal = document.createElement("div");
		modal.className = "ad-modal";
		const hasDescription = description && description.trim() && description.trim() !== "Ingen beskrivelse tilgængelig.";
		modal.innerHTML = `
			<div class="ad-modal-content">
				${imageSlider(images, title)}
				<div class="ad-info">
					<h2>${decode(title)}</h2><hr class="ad-divider">
					${hasDescription ? `<div class="ad-description">${decode(description)}</div><hr class="ad-divider">` : ""}
					<div class="ad-price-container">${priceBlock(price, priceDiff)}</div>
					<hr class="price-divider">
					<div class="ad-location">${decode(location)}</div>
				</div>
				<a href="${originalUrl}" target="_blank" rel="noopener" class="original-link"><img src="https://ruban.nu/image/external-link-white.svg" width="24"></a>
				<button class="close-modal">×</button>
			</div>
		`;

		document.body.appendChild(modal);
		if (grid) grid.style.pointerEvents = "none";
		document.body.style.overflow = "hidden";

		let currentSlide = 0;
		const inner = modal.querySelector(".slider-inner");
		const indicator = modal.querySelector(".slide-indicator");

		const updateSlide = () => {
			if (inner) {
				inner.style.transform = `translateX(-${currentSlide * 100}%)`;
				inner.style.transition = "transform 0.3s ease";
				if (indicator) indicator.textContent = `${currentSlide + 1}/${images.length}`;
			}
		};

		if (inner) {
			modal.querySelector(".left-arrow")?.addEventListener("click", () => {
				currentSlide = (currentSlide > 0) ? currentSlide - 1 : images.length - 1;
				updateSlide();
			});
			modal.querySelector(".right-arrow")?.addEventListener("click", () => {
				currentSlide = (currentSlide < images.length - 1) ? currentSlide + 1 : 0;
				updateSlide();
			});

			let startX = 0, endX = 0;
			inner.addEventListener("touchstart", e => {
				startX = e.touches[0].clientX;
				inner.style.transition = "none";
			});
			inner.addEventListener("touchend", e => {
				endX = e.changedTouches[0].clientX;
				const diff = endX - startX;
				if (Math.abs(diff) > 50) {
					currentSlide = diff > 0 ? (currentSlide > 0 ? currentSlide - 1 : images.length - 1)
											: (currentSlide < images.length - 1 ? currentSlide + 1 : 0);
				}
				updateSlide();
			});
		}

		const keyHandler = e => {
			if (inner && images.length) {
				if (e.key === "ArrowLeft") currentSlide = (currentSlide > 0) ? currentSlide - 1 : images.length - 1;
				if (e.key === "ArrowRight") currentSlide = (currentSlide < images.length - 1) ? currentSlide + 1 : 0;
				updateSlide();
			}
			if (e.key === "Escape") closeModal();
		};
		document.addEventListener("keydown", keyHandler);

		updateSlide();

		history.pushState({ modalOpen: true }, "", window.location.href);
		const popHandler = () => { if (modal.isConnected) closeModal(); };
		window.addEventListener("popstate", popHandler);

		const closeModal = () => {
			modal.classList.add("closing");
			modal.addEventListener("animationend", () => {
				modal.remove();
				document.removeEventListener("keydown", keyHandler);
				window.removeEventListener("popstate", popHandler);
				if (grid) grid.style.pointerEvents = "auto";
				document.body.style.overflow = "auto";
				if (history.state?.modalOpen) history.back();
			}, { once: true });
		};

		modal.querySelector(".close-modal").addEventListener("click", closeModal);
		modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
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

		if (isGG) {
			const id = card.querySelector(".info-btn")?.dataset.id;
			if (id) {
				try {
					const body = { operationName: "GetListing", variables: { id }, query: GET_LISTING_QUERY };
					const res = await fetch(PROXY + API_URL, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
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
