// dba-search.js
const MAX_RESULTS = 300;
const PROXY = "https://corsproxy.io/?";
const PRICE_FILE = "https://umfzbxvz.github.io/gg/docs/priser.json.gz";
const isMobileDevice = /mobile|tablet|android|iphone|ipad|ipod/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 1024);

let priceWorker = null;
const firstPricesCache = new Map();
const pendingRequests = new Map();

if (!isMobileDevice) {
    async function loadPriceData() {
        return new Promise((resolve, reject) => {
            const workerCode = `
                importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
                let priceData, ready = false, pendingQueries = [];
                self.addEventListener('message', async e => {
                    const d = e.data;
                    if (d.type === 'load') {
                        try {
                            const res = await fetch('${PRICE_FILE}');
                            if (!res.ok) throw new Error('HTTP '+res.status);
                            const buf = await res.arrayBuffer();
                            const str = pako.ungzip(new Uint8Array(buf), {to:'string'});
                            priceData = JSON.parse(str);
                            ready = true;
                            self.postMessage({type:'ready'});
                            pendingQueries.forEach(q => {
                                const h = priceData[q.adId];
                                const fp = h && h.length ? h[0][2] : null;
                                self.postMessage({type:'firstPrice', adId:q.adId, firstPrice:fp});
                            });
                            pendingQueries = [];
                        } catch (err) { self.postMessage({type:'error', error:err.message}); }
                    } else if (d.type === 'getFirstPrice') {
                        if (ready) {
                            const h = priceData[d.adId];
                            const fp = h && h.length ? h[0][2] : null;
                            self.postMessage({type:'firstPrice', adId:d.adId, firstPrice:fp});
                        } else pendingQueries.push({adId:d.adId});
                    }
                });
            `;
            const blob = new Blob([workerCode], {type:'application/javascript'});
            priceWorker = new Worker(URL.createObjectURL(blob));
            priceWorker.addEventListener('message', e => {
                if (e.data.type === 'ready') resolve();
                else if (e.data.type === 'error') reject(new Error(e.data.error));
                else if (e.data.type === 'firstPrice') {
                    firstPricesCache.set(e.data.adId, e.data.firstPrice);
                    const r = pendingRequests.get(e.data.adId);
                    if (r) { r(e.data.firstPrice); pendingRequests.delete(e.data.adId); }
                }
            });
            priceWorker.postMessage({type:'load'});
        });
    }
    async function getFirstPrice(adId) {
        const cached = firstPricesCache.get(adId);
        if (cached !== undefined) return cached;
        return new Promise(res => { pendingRequests.set(adId, res); priceWorker.postMessage({type:'getFirstPrice', adId}); });
    }
    loadPriceData().catch(e => console.error("Prishistorik fejl:", e));
    window.getFirstPrice = getFirstPrice;
} else {
    window.getFirstPrice = () => Promise.resolve(null);
}

const API_URL = "https://www.dba.dk/recommerce-search-page/api/search/SEARCH_ID_BAP_COMMON";
let isLoading = false;

const jylland = ["0.200006","0.200005","0.200007","0.200008"];
const sydsjaellandOgOerne = ["0.200004"];
const fyn = ["0.200009"];
const sjaelland = ["0.200001","0.200002","0.200003"];

function getSelectedLocations() {
    if (document.getElementById("closestToggle")?.checked) return [];
    const sel = [];
    if (document.getElementById("locationJylland")?.checked) sel.push(...jylland);
    if (document.getElementById("locationSydsjaelland")?.checked) sel.push(...sydsjaellandOgOerne);
    if (document.getElementById("locationFyn")?.checked) sel.push(...fyn);
    if (document.getElementById("locationSjaelland")?.checked) sel.push(...sjaelland);
    return sel.length ? sel : jylland;
}

function formatPrice(amount, currency) {
    if (typeof amount !== "number") return "";
    if (amount === 0) return "Gives væk";
    return amount.toLocaleString("da-DK") + " kr.";
}

function makeCard(doc) {
    if (!doc.image_urls || doc.image_urls.length === 0) doc.image_urls = ["noimage.svg"];

    const card = document.createElement("a");
    card.className = "card";
    card.href = doc.canonical_url?.startsWith("http") ? doc.canonical_url : `https://www.dba.dk${doc.canonical_url || ""}`;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const location = doc.location || "";
    const zip = window.getZipForCity(location);
    const imageSrc = doc.image_urls[0];
    const priceText = formatPrice(doc.price?.amount, doc.price?.currency_code);

    const imageHtml = imageSrc.endsWith("noimage.svg")
        ? `<img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" class="fallback-image" />`
        : `<img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" />`;

    card.innerHTML = `
        <div class="card-image-wrapper">
            ${imageHtml}
        </div>
        <div class="dba-badge">dba</div>
        <div class="card-content">
            <h3>${doc.heading || ""}</h3>
            <div class="card-footer">
                <div class="price">${priceText}</div>
                <div class="city">${(location === "København K" || location === "København V" || location === "Frederiksberg C") ? location : location + (zip ? " " + zip : "")}</div>
            </div>
        </div>
    `;

    card.dataset.timestamp = doc.timestamp || 0;
    card.dataset.images = JSON.stringify(doc.image_urls);
    card.dataset.key = doc.id;

    const adId = String(doc.id);
    const currentPrice = doc.price?.amount;

    if (typeof currentPrice === "number" && !isMobileDevice) {
        getFirstPrice(adId).then(firstPrice => {
            if (firstPrice !== null && typeof firstPrice === "number" && firstPrice !== 0) {
                const priceDiff = currentPrice - firstPrice;
                if (priceDiff !== 0) {
                    const status = priceDiff > 0 ? "steget" : "faldet";
                    const diffBadge = document.createElement("div");
                    diffBadge.className = `price-change-badge ${status}`;
                    diffBadge.innerHTML = `${priceDiff > 0 ? '<svg viewBox="0 0 24 24" class="arrow-up"><path d="M12 2 L22 22 L2 22 Z"/></svg>' : '<svg viewBox="0 0 24 24" class="arrow-down"><path d="M2 2 L22 2 L12 22 Z"/></svg>'} ${Math.abs(priceDiff).toLocaleString("da-DK")} kr.`;
                    card.querySelector(".card-image-wrapper").appendChild(diffBadge);
                    card.dataset.priceDiff = priceDiff;
                    card.dataset.priceDiffStatus = status;
                }
            }
        }).catch(() => {});
    }

    return card;
}

async function fetchDBAPage(page, term, category) {
    const p = new URLSearchParams();
    p.append("q", term);
    if (category) p.append("category", category);
    if (document.getElementById("closestToggle")?.checked && window.userPosition) {
        p.append("sort", "CLOSEST");
        p.append("lat", window.userPosition.lat);
        p.append("lon", window.userPosition.lon);
        p.append("radius", 30000);
    } else {
        p.append("sort", "PUBLISHED_DESC");
        getSelectedLocations().forEach(l => p.append("location", l));
    }
    p.append("dealer_segment", "1");
    ["1","2"].forEach(t => p.append("trade_type", t));
    p.append("page", page);

    const res = await fetch(`${PROXY}${API_URL}?${p.toString()}`);
    if (!res.ok) throw new Error("HTTP "+res.status);
    const data = await res.json();
    const docs = (data.docs || []).filter(d => d.type === "bap");
    const total = data.metadata?.result_size?.match_count || 0;
    return { docs, total };
}

window.hentOgVisDBA = async function(term, category, bgMode = false) {
    if (isLoading) return;
    isLoading = true;
    try {
        const first = await fetchDBAPage(1, term, category);
        const total = Math.min(first.total, MAX_RESULTS);
        window.totalAds += total;
        const perPage = 60;
        const pages = bgMode ? 1 : (window.isMagicMode ? 2 : Math.ceil(total/perPage));
        const pagePromises = Array.from({length:pages}, (_,i) => i+1);
        for (const pg of pagePromises) {
            const {docs} = pg===1 ? first : await fetchDBAPage(pg, term, category);
            for (const doc of docs) {
                if (window.seenAdKeys.has(doc.id)) continue;
                window.allCards.push(makeCard(doc));
                window.seenAdKeys.add(doc.id);
            }
            window.loadedAds += docs.length;
        }
    } catch (e) { console.error("DBA fejl:", e); }
    finally { isLoading = false; }
};

