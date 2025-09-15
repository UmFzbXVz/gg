const MAX_RESULTS = 600;
const PROXY = "https://corsproxy.io/?";
const PRICE_FILE = "./docs/priser.json.gz";

(async () => {
	const grid = document.getElementById("grid");
	const API_URL = "https://www.dba.dk/recommerce-search-page/api/search/SEARCH_ID_BAP_COMMON";
	let isLoading = false;

	async function loadPriceData() {
		const res = await fetch(PRICE_FILE);
		if (!res.ok) throw new Error(`Kunne ikke hente ${PRICE_FILE}`);

		const ds = new DecompressionStream("gzip");
		const decompressed = res.body.pipeThrough(ds);
		const text = await new Response(decompressed).text();
		return JSON.parse(text);
	}

	window.priceData = await loadPriceData();
	console.log("Indlæst priceData med", Object.keys(window.priceData).length, "annoncer");

	const jylland = ["0.200006", "0.200005", "0.200007", "0.200008"];
	const sydsjaellandOgOerne = ["0.200004"];

	function getSelectedLocations() {
		const selected = [];
		const jyllandBox = document.getElementById("locationJylland");
		const sydBox = document.getElementById("locationSydsjaelland");

		if (jyllandBox && jyllandBox.checked) selected.push(...jylland);
		if (sydBox && sydBox.checked) selected.push(...sydsjaellandOgOerne);
		return selected.length > 0 ? selected : jylland;
	}

	function formatPrice(amount, currency) {
		if (typeof amount !== "number") return "";
		if (amount === 0) return "Gives væk";
		const formatted = amount.toLocaleString("da-DK");
		return currency === "DKK" ? `${formatted} kr.` : `${formatted} ${currency || ""}`;
	}

	function makeCard(doc) {
		const card = document.createElement("a");
		card.className = "card";
		card.href = doc.canonical_url?.startsWith("http") ? doc.canonical_url : `https://www.dba.dk${doc.canonical_url || ""}`;
		card.target = "_blank";
		card.rel = "noopener noreferrer";

		const location = doc.location || "";
		const zip = window.getZipForCity(location);
		const imageSrc = (doc.image_urls && doc.image_urls.length > 0) ? doc.image_urls[0] : "";
		const priceText = formatPrice(doc.price?.amount, doc.price?.currency_code);

		card.innerHTML = `
			<div class="card-image-wrapper">
				<img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" />
			</div>
			<div class="dba-badge">dba</div>
			<div class="card-content">
				<h3>${doc.heading || ""}</h3>
				<div class="card-footer">
					<div class="price">${priceText}</div>
					<div class="city">${location}${zip ? " " + zip : ""}</div>
				</div>
			</div>
		`;

		card.dataset.timestamp = doc.timestamp || 0;
		card.dataset.images = JSON.stringify(doc.image_urls || []);
		card.dataset.key = `${doc.heading || ""}|${priceText}`;

		const adId = String(doc.id);
		const history = window.priceData?.[adId];

		if (history && history.length > 0) {
			const firstPrice = history[0][2];
			const currentPrice = doc.price?.amount;

			if (typeof currentPrice === "number" && typeof firstPrice === "number" && firstPrice !== 0) {
				let diffPercent = Math.round((currentPrice - firstPrice) / firstPrice * 100);
				if (diffPercent !== 0) {
					const status = diffPercent > 0 ? "steget" : "faldet";
					console.log(`Annonce ${adId} er ${status} med ${Math.abs(diffPercent)}%`);

					const percentBadge = document.createElement("div");
					percentBadge.className = `price-change-badge ${diffPercent > 0 ? "steget" : "faldet"}`;
					percentBadge.textContent = `${diffPercent > 0 ? '+' : ''}${diffPercent}%`;
					card.querySelector(".card-image-wrapper").appendChild(percentBadge);
				}
			}
		}

		return card;
	}

	async function fetchDBAPage(page, term, category) {
		const params = new URLSearchParams();
		params.append("q", term);
		if (category) params.append("category", category);
		params.append("sort", "PUBLISHED_DESC");
		getSelectedLocations().forEach(loc => params.append("location", loc));
		params.append("dealer_segment", "1");
		["1", "2"].forEach(tt => params.append("trade_type", tt));
		params.append("page", page);

		const res = await fetch(`${PROXY}${API_URL}?${params.toString()}`);
		if (!res.ok) throw new Error(`HTTP-fejl ${res.status}`);
		const data = await res.json();

		const docs = data.docs || [];
		const bapDocs = docs.filter(doc => doc.type === "bap");
		const totalResults = data.metadata?.result_size?.match_count || 0;

		return {
			bapDocs,
			totalResults
		};
	}

	window.hentOgVisDBA = async function(term, category, bgMode = false) {
		if (isLoading) return;
		isLoading = true;

		try {
			let currentPage = 1;
			const firstPageData = await fetchDBAPage(currentPage, term, category);
			const totalResults = Math.min(firstPageData.totalResults, MAX_RESULTS);
			window.totalAds += totalResults;

			const perPageAPI = 60;
			const firstPageDocs = firstPageData.bapDocs;
			firstPageDocs.forEach(doc => window.allCards.push(makeCard(doc)));
			window.loadedAds += firstPageDocs.length;

			const numPages = bgMode ? 1 : Math.ceil(totalResults / perPageAPI);
			for (currentPage = 2; currentPage <= numPages && window.allCards.length < window.totalAds; currentPage++) {
				const pageData = await fetchDBAPage(currentPage, term, category);
				pageData.bapDocs.forEach(doc => window.allCards.push(makeCard(doc)));
				window.loadedAds += pageData.bapDocs.length;
			}
		} catch (err) {
			console.error("Fejl DBA:", err);
		} finally {
			isLoading = false;
		}
	};
})();
