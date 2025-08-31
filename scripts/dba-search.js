const MAX_RESULTS = 600;

(() => {
	const grid = document.getElementById("grid");
	const API_URL = "https://www.dba.dk/recommerce-search-page/api/search/SEARCH_ID_BAP_COMMON";
	let isLoading = false;
	let cityToZip = {};

	async function loadPostnumre() {
		try {
			const res = await fetch("https://api.dataforsyningen.dk/postnumre");
			const data = await res.json();
			data.forEach(entry => {
				const city = entry.navn.trim();
				if (!cityToZip[city]) {
					cityToZip[city] = [];
				}
				cityToZip[city].push(entry.nr);
			});
		} catch (err) {
			console.error("Kunne ikke hente postnumre.json:", err);
		}
	}

	function formatPrice(amount, currency) {
		if (typeof amount !== "number") return "";
		let formatted = amount.toLocaleString("da-DK");
		if (currency === "DKK") {
			return `${formatted} kr.`;
		}
		return `${formatted} ${currency || ""}`;
	}

	async function fetchDBAPage(page, term, category) {
		const params = new URLSearchParams();
		params.append("q", term);
		params.append("category", category);
		params.append("sort", "PUBLISHED_DESC");
		["0.200006", "0.200005", "0.200007", "0.200008"].forEach(loc => params.append("location", loc));
		params.append("dealer_segment", "1");
		["1", "2"].forEach(tt => params.append("trade_type", tt));
		params.append("page", page);

		const res = await fetch(`${API_URL}?${params.toString()}`);
		if (!res.ok) throw new Error(`HTTP-fejl ${res.status}`);
		const data = await res.json();

		const docs = data.docs || [];
		const bapDocs = docs.filter(doc => doc.type === "bap");
		const totalResults = data.metadata.result_size?.match_count || 0;

		return {
			bapDocs,
			totalResults
		};
	}

	function getZipForCity(cityName) {
		if (!cityName) return "";
		const zips = cityToZip[cityName.trim()];
		if (zips && zips.length > 0) {
			return zips.join(", ");
		}
		return "";
	}

	window.hentOgVisDBA = async function(term, category) {
		if (isLoading) return;
		isLoading = true;

		try {
			if (Object.keys(cityToZip).length === 0) {
				await loadPostnumre();
			}

			let currentPage = 1;
			const firstPageData = await fetchDBAPage(currentPage, term, category);
			const totalResults = Math.min(firstPageData.totalResults, MAX_RESULTS);
			window.totalAds += totalResults;

			let perPage = firstPageData.bapDocs.length;
			if (perPage === 0 || totalResults === 0) {
				isLoading = false;
				return;
			}

			function makeCard(doc) {
				const card = document.createElement("a");
				card.className = "card";
				card.href = doc.canonical_url?.startsWith("http") ?
					doc.canonical_url :
					`https://www.dba.dk${doc.canonical_url || ""}`;
				card.target = "_blank";
				card.rel = "noopener noreferrer";

				const location = doc.location || "";
				const zip = getZipForCity(location);
				const imageSrc = (doc.image_urls && doc.image_urls.length > 0) ?
					doc.image_urls[0] :
					"";

				const priceText = formatPrice(doc.price?.amount, doc.price?.currency_code);

				card.innerHTML = `
    <img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" />
    <div class="dba-badge">dba</div>
    <div class="card-content">
        <h3>${doc.heading || ""}</h3>
        <div class="card-footer">
          <div class="price">${priceText}</div>
          <div class="city">${location}${zip ? " " + zip : ""}</div>
        </div>
    </div>
  `;

				const h3 = card.querySelector("h3");
				if (h3.textContent.length > 40) {
					h3.style.fontSize = "0.8rem";
				} else {
					h3.style.fontSize = "1rem";
				}

				card.dataset.timestamp = doc.timestamp || 0;
				card.dataset.images = JSON.stringify(doc.image_urls || []);
				return card;
			}


			firstPageData.bapDocs.forEach(doc => {
				window.allCards.push(makeCard(doc));
			});
			window.loadedAds += firstPageData.bapDocs.length;

			const numPages = Math.ceil(totalResults / perPage);
			for (currentPage = 2; currentPage <= numPages && window.allCards.length < window.totalAds; currentPage++) {
				const pageData = await fetchDBAPage(currentPage, term, category);
				pageData.bapDocs.forEach(doc => {
					window.allCards.push(makeCard(doc));
				});
				window.loadedAds += pageData.bapDocs.length;
			}
		} catch (err) {
			console.error("Fejl DBA:", err);
		} finally {
			isLoading = false;
		}
	};
})();
