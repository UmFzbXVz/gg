const MAX_RESULTS = 300;
const PROXY = "https://corsproxy.io/?";
const PRICE_FILE = "./docs/priser.json.gz";

(async () => {
    const grid = document.getElementById("grid");
    const API_URL = "https://www.dba.dk/recommerce-search-page/api/search/SEARCH_ID_BAP_COMMON";
    let isLoading = false;

    async function loadPriceData() {
        try {
            const res = await fetch(PRICE_FILE);
            if (!res.ok) throw new Error(`Kunne ikke hente ${PRICE_FILE} (status ${res.status})`);
            const arrayBuffer = await res.arrayBuffer();
            const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
            const data = JSON.parse(decompressed);
            console.log("Indlæst priceData med", Object.keys(data).length);
            return data;
        } catch (err) {
            console.error("Fejl ved loadPriceData:", err);
            return {};
        }
    }

    window.priceData = await loadPriceData();

    const jylland = ["0.200006", "0.200005", "0.200007", "0.200008"];
    const sydsjaellandOgOerne = ["0.200004"];

    function getSelectedLocations() {
        const selected = [];
        if (document.getElementById("locationJylland")?.checked) selected.push(...jylland);
        if (document.getElementById("locationSydsjaelland")?.checked) selected.push(...sydsjaellandOgOerne);
        return selected.length ? selected : jylland;
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
        const imageSrc = doc.image_urls?.[0] || "";
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
        card.dataset.key = doc.id; 

        const adId = String(doc.id);
        const history = window.priceData[adId];

        if (history && history.length > 0) {
            const firstPrice = history[0][2];
            const currentPrice = doc.price?.amount;
            if (typeof currentPrice === "number" && typeof firstPrice === "number" && firstPrice !== 0) {
                const priceDiff = currentPrice - firstPrice;
                if (priceDiff !== 0) {
                    const status = priceDiff > 0 ? "steget" : "faldet";
                    const diffBadge = document.createElement("div");
                    diffBadge.className = `price-change-badge ${status}`;
                    diffBadge.innerHTML = `${priceDiff > 0 ? '<span class="arrow-up">△</span>' : '<span class="arrow-down">▽</span>'} ${Math.abs(priceDiff).toLocaleString("da-DK")} kr.`;
                    card.querySelector(".card-image-wrapper").appendChild(diffBadge);

                    card.dataset.priceDiff = priceDiff;
                    card.dataset.priceDiffStatus = status;
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
        const bapDocs = (data.docs || []).filter(doc => doc.type === "bap");
        const totalResults = data.metadata?.result_size?.match_count || 0;

        return { bapDocs, totalResults };
    }

    window.hentOgVisDBA = async function(term, category, bgMode = false) {
        if (isLoading) return;
        isLoading = true;

        try {
            const firstPage = await fetchDBAPage(1, term, category);
            const totalResults = Math.min(firstPage.totalResults, MAX_RESULTS);
            window.totalAds += totalResults;

            const perPageAPI = 60;
            const pages = bgMode ? [1] : Array.from({ length: Math.ceil(totalResults / perPageAPI) }, (_, i) => i + 1);

            for (const page of pages) {
                const pageData = page === 1 ? firstPage : await fetchDBAPage(page, term, category);
                for (const doc of pageData.bapDocs) {
                    const adId = doc.id;
                    if (window.seenAdKeys.has(adId)) continue;
                    const card = makeCard(doc);
                    window.allCards.push(card);
                    window.seenAdKeys.add(adId);
                }
                window.loadedAds += pageData.bapDocs.length;
            }
        } catch (err) {
            console.error("Fejl DBA:", err);
        } finally {
            isLoading = false;
        }
    };
})();
