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

	function decodeUnicodeEscapes(str) {
		if (!str) return "";
		str = str.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
			String.fromCodePoint(parseInt(hex, 16))
		);
		str = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
			String.fromCharCode(parseInt(hex, 16))
		);
		return str;
	}

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
					if (data && data.description) {
						return decodeUnicodeEscapes(data.description.trim());
					}
				} catch (err) {
					console.warn("Kunne ikke parse JSON-LD for DBA annonce:", err);
				}
			}

			const descEl = htmlDoc.querySelector('.vip-description-text');
			if (descEl) {
				return decodeUnicodeEscapes(descEl.innerText.trim());
			}

			return 'Ingen beskrivelse tilgængelig.';
		} catch (err) {
			console.error('Fejl ved hentning af DBA beskrivelse:', err);
			return 'Fejl ved indlæsning af beskrivelse.';
		}
	}

	function openAdModal(title, description, price, location, images, originalUrl) {
		title = decodeUnicodeEscapes(title);
		description = decodeUnicodeEscapes(description);
		location = decodeUnicodeEscapes(location);

		if (images.length === 0) {
			images = ['data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23666"/%3E%3Ctext x="50" y="50" font-size="12" text-anchor="middle" dy=".35em" fill="%23ccc"%3EIngen billede%3C/text%3E%3C/svg%3E'];
		}

		const modal = document.createElement('div');
		modal.className = 'ad-modal';
		let currentSlide = 0;

		const createSlider = () => {
			let html = '<div class="image-slider"><div class="slider-inner">';
			images.forEach(src => {
				const googleUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(src)}`;
				html += `
    <div class="slide">
        <img src="${src}" alt="${title}"> 
        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="google-icon" title="Søg dette billede på Google">
            <img src="https://upload.wikimedia.org/wikipedia/commons/d/d6/Google_Lens_Icon.svg" width="20" height="20" alt="Google Lens">
        </a>
    </div>`;
			});
			html += '</div>';

			if (images.length > 1) {
				html += '<button class="arrow left-arrow"><</button>';
				html += '<button class="arrow right-arrow">></button>';
				html += '<div class="slide-indicator"></div>';
			}

			html += '</div>';
			return html;
		};
		const hasDescription = description && description.trim() && description.trim() !== "Ingen beskrivelse tilgængelig.";
		let modalHtml = `<div class="ad-modal-content">
    ${createSlider()}
    <div class="ad-info">
        <h2 class="ad-title">${title}</h2>
        <div class="ad-price">${price}</div>
        <hr class="ad-divider">
        ${hasDescription ? `<div class="ad-description">${description}</div><hr class="ad-divider">` : ""}
        <div class="ad-location">${location}</div>
    </div>
    <a href="${originalUrl}" target="_blank" rel="noopener noreferrer" class="original-link" title="Se annoncen">
        <img src="https://ruban.nu/image/external-link-white.svg" alt="Se annoncen" width="24" height="24">
    </a>
    <button class="close-modal">×</button>
</div>
`;
		modal.innerHTML = modalHtml;
		document.body.appendChild(modal);

		if (grid) grid.style.pointerEvents = "none";
		document.body.style.overflow = "hidden";

		const inner = modal.querySelector('.slider-inner');
		const indicator = modal.querySelector('.slide-indicator');

		const updateSlide = () => {
			inner.style.transform = `translateX(-${currentSlide * 100}%)`;
			inner.style.transition = "transform 0.3s ease";
			if (indicator) {
				indicator.textContent = `${currentSlide + 1} / ${images.length}`;
			}
		};

		const left = modal.querySelector('.left-arrow');
		const right = modal.querySelector('.right-arrow');
		if (left && right) {
			left.addEventListener('click', () => {
				currentSlide = (currentSlide > 0) ? currentSlide - 1 : images.length - 1;
				updateSlide();
			});
			right.addEventListener('click', () => {
				currentSlide = (currentSlide < images.length - 1) ? currentSlide + 1 : 0;
				updateSlide();
			});
		}

		let startX = 0;
		let endX = 0;

		inner.addEventListener("touchstart", (e) => {
			startX = e.touches[0].clientX;
			inner.style.transition = "none";
		});

		inner.addEventListener("touchend", (e) => {
			endX = e.changedTouches[0].clientX;
			let diff = endX - startX;

			if (Math.abs(diff) > 50) {
				if (diff > 0) {
					currentSlide = (currentSlide > 0) ? currentSlide - 1 : images.length - 1;
				} else {
					currentSlide = (currentSlide < images.length - 1) ? currentSlide + 1 : 0;
				}
			}
			updateSlide();
		});

		const handleKey = (e) => {
			if (e.key === "ArrowLeft") {
				currentSlide = (currentSlide > 0) ? currentSlide - 1 : images.length - 1;
				updateSlide();
			} else if (e.key === "ArrowRight") {
				currentSlide = (currentSlide < images.length - 1) ? currentSlide + 1 : 0;
				updateSlide();
			} else if (e.key === "Escape") {
				closeModal();
			}
		};
		document.addEventListener("keydown", handleKey);

		updateSlide();

		history.pushState({ modalOpen: true }, "", window.location.href);
		const handlePop = () => {
			if (modal.isConnected) closeModal();
		};
		window.addEventListener("popstate", handlePop);

		const closeModal = () => {
			modal.classList.add("closing");

			modal.addEventListener("animationend", () => {
				modal.remove();
				document.removeEventListener("keydown", handleKey);
				window.removeEventListener("popstate", handlePop);
				if (grid) grid.style.pointerEvents = "auto";
				document.body.style.overflow = "auto";

				if (history.state && history.state.modalOpen) {
					history.back();
				}
			}, { once: true });
		};

		modal.querySelector('.close-modal').addEventListener('click', closeModal);
		modal.addEventListener('click', (e) => {
			if (e.target === modal) closeModal();
		});
	}

	grid.addEventListener('click', async (e) => {
		const card = e.target.closest('.card');
		if (!card || e.target.classList.contains('info-btn')) return;

		e.preventDefault();
		e.stopPropagation();

		const isGG = !!card.querySelector('.gg-badge');
		const isDBA = !!card.querySelector('.dba-badge');
		const isReshopper = !!card.querySelector('.reshopper-badge');

		const originalUrl = card.href;
		let title = card.querySelector('h3')?.innerText || 'Ukendt titel';
		const price = card.querySelector('.price')?.innerText || 'Ingen pris';
		let location = card.querySelector('.city')?.innerText || 'Ukendt placering';
		let description = '';
		let images = [];

		if (isGG) {
			const id = card.querySelector('.info-btn')?.dataset.id;
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
						description = decodeUnicodeEscapes(listing.description || 'Ingen beskrivelse.');
						images = listing.images?.map(img => img.medium || img.small || '') || [];
					}
				} catch (err) {
					console.error('Fejl ved hentning af GG annonce:', err);
					description = 'Fejl ved indlæsning.';
				}
			}
		} else if (isDBA) {
			images = JSON.parse(card.dataset.images || '[]');
			description = await getDbaDescription(originalUrl);
		} else if (isReshopper) {
			images = JSON.parse(card.dataset.images || '[]');
			description = decodeUnicodeEscapes(card.dataset.description || 'Ingen beskrivelse tilgængelig.');
			location = decodeUnicodeEscapes(card.dataset.seller || 'Ukendt sælger');
		}

		openAdModal(title, description, price, location, images, originalUrl);
	});

})();
