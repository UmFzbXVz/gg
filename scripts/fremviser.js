(() => {
	const PROXY = "https://corsproxy.io/?";
	const API_URL = "https://api.guloggratis.dk/graphql";
	const HEADERS = {
		"content-type": "application/json",
		"origin": "https://www.guloggratis.dk",
		"referer": "https://www.guloggratis.dk/",
		"user-agent": "Dalvik/2.1.0 (Linux; Android 15; SM-E366B) GGApp/8.4.4",
		"x-client-type": "android",
		"x-client-version": "8.4.4",
	};
	const GET_LISTING_QUERY = `query($id: ID!){ listing(id:$id){id title url description price{raw text} images{small:url(size:Listing640) medium:url(size:Listing1280)}} }`;

	const grid = document.getElementById("grid");

	const decode = str =>
		(str || "")
		.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

	async function getDbaDescription(url) {
		try {
			const text = await (await fetch(PROXY + encodeURIComponent(url))).text();
			const doc = new DOMParser().parseFromString(text, "text/html");
			const json = doc.querySelector('script[type="application/ld+json"]');
			if (json) {
				const data = JSON.parse(json.textContent || "{}");
				if (data.description) return decode(data.description.trim());
			}
			const desc = doc.querySelector(".vip-description-text");
			return decode(desc?.innerText.trim() || "Ingen beskrivelse tilgængelig.");
		} catch {
			return "Fejl ved indlæsning af beskrivelse.";
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
			images = [
				'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#666"/><text x="50" y="50" font-size="12" text-anchor="middle" dy=".35em" fill="#ccc">Ingen billede</text></svg>'
			];
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

	function openAdModal({
		title,
		description,
		price,
		priceDiff,
		location,
		images,
		url
	}) {
		const modal = document.createElement("div");
		modal.className = "ad-modal";
		modal.innerHTML = `
			<div class="ad-modal-content">
				${imageSlider(images, title)}
				<div class="ad-info">
					<h2>${decode(title)}</h2><hr class="ad-divider">
					${description && description !== "Ingen beskrivelse tilgængelig." ? `<div class="ad-description">${decode(description)}</div><hr class="ad-divider">` : ""}
					<div class="ad-price-container">${priceBlock(price, priceDiff)}</div>
					<hr class="price-divider">
					<div class="ad-location">${decode(location)}</div>
				</div>
				<a href="${url}" target="_blank" rel="noopener" class="original-link"><img src="https://ruban.nu/image/external-link-white.svg" width="24"></a>
				<button class="close-modal">×</button>
			</div>`;

		document.body.appendChild(modal);
		if (grid) grid.style.pointerEvents = "none";
		document.body.style.overflow = "hidden";

		let current = 0;
		const inner = modal.querySelector(".slider-inner");
		const indicator = modal.querySelector(".slide-indicator");

		const update = () => {
			inner.style.transform = `translateX(-${current * 100}%)`;
			inner.style.transition = "transform 0.3s ease";
			if (indicator) indicator.textContent = `${current + 1}/${images.length}`;
		};

		modal.querySelector(".left-arrow")?.addEventListener("click", () => {
			current = (current > 0) ? current - 1 : images.length - 1;
			update();
		});
		modal.querySelector(".right-arrow")?.addEventListener("click", () => {
			current = (current < images.length - 1) ? current + 1 : 0;
			update();
		});

		const keyHandler = e => {
			if (e.key === "ArrowLeft") {
				current = (current > 0) ? current - 1 : images.length - 1;
				update();
			}
			if (e.key === "ArrowRight") {
				current = (current < images.length - 1) ? current + 1 : 0;
				update();
			}
			if (e.key === "Escape") close();
		};
		document.addEventListener("keydown", keyHandler);

		let startX = 0,
			endX = 0;
		inner.addEventListener("touchstart", e => {
			startX = e.touches[0].clientX;
			inner.style.transition = "none";
		});
		inner.addEventListener("touchend", e => {
			endX = e.changedTouches[0].clientX;
			const diff = endX - startX;
			if (Math.abs(diff) > 50) {
				if (diff > 0) {
					current = (current > 0) ? current - 1 : images.length - 1;
				} else {
					current = (current < images.length - 1) ? current + 1 : 0;
				}
			}
			update();
		});

		update();

		history.pushState({
			modalOpen: true
		}, "", window.location.href);
		const popHandler = () => {
			if (modal.isConnected) close();
		};
		window.addEventListener("popstate", popHandler);

		const close = () => {
			modal.classList.add("closing");
			modal.addEventListener("animationend", () => {
				modal.remove();
				document.removeEventListener("keydown", keyHandler);
				window.removeEventListener("popstate", popHandler);
				if (grid) grid.style.pointerEvents = "auto";
				document.body.style.overflow = "auto";
				if (history.state?.modalOpen) history.back();
			}, {
				once: true
			});
		};

		modal.querySelector(".close-modal").addEventListener("click", close);
		modal.addEventListener("click", e => {
			if (e.target === modal) close();
		});
	}

	grid.addEventListener("click", async e => {
		const card = e.target.closest(".card");
		if (!card || e.target.classList.contains("info-btn")) return;
		e.preventDefault();

		const url = card.href;
		const title = card.querySelector("h3")?.innerText || "Ukendt titel";
		const price = card.querySelector(".price")?.innerText || "Ingen pris";
		const priceDiff = Number(card.dataset.priceDiff || 0);
		let location = card.querySelector(".city")?.innerText || "Ukendt placering";
		let description = "",
			images = [];

		if (card.querySelector(".gg-badge")) {
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
						images = listing.images?.map(img => img.medium || img.small).filter(Boolean) || [];
					}
				} catch {
					description = "Fejl ved indlæsning.";
				}
			}
		} else if (card.querySelector(".dba-badge")) {
			images = JSON.parse(card.dataset.images || "[]");
			description = await getDbaDescription(url);
		} else if (card.querySelector(".reshopper-badge")) {
			images = JSON.parse(card.dataset.images || "[]");
			description = decode(card.dataset.description || "Ingen beskrivelse tilgængelig.");
			location = decode(card.dataset.seller || "Ukendt sælger");
		}

		openAdModal({
			title,
			description,
			price,
			priceDiff,
			location,
			images,
			url
		});
	});
})();
