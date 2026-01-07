const MAX_RESULTS = 300;
const PROXY = "https://corsproxy.io/?";
const PRICE_FILE = "https://umfzbxvz.github.io/gg/docs/priser.json.gz";
const PRICE_FILE_HEAD = `${PRICE_FILE}`;
let cachedPriceFileSize = null;
let priceWorker = null;
let priceDataEnabled = false;
let priceDataLoading = false;
const firstPricesCache = new Map();
const pendingRequests = new Map();

async function fetchPriceFileSize() {
    if (cachedPriceFileSize !== null) return cachedPriceFileSize;
    const res = await fetch(PRICE_FILE_HEAD, { method: 'HEAD' });
    if (!res.ok) throw new Error();
    const len = res.headers.get("content-length");
    if (!len) throw new Error();
    cachedPriceFileSize = Number(len);
    return cachedPriceFileSize;
}

async function loadPriceData() {
    if (priceDataLoading || priceWorker) return;
    priceDataLoading = true;

    return new Promise((resolve, reject) => {
        const workerCode = `
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
            let priceData, ready = false, pendingQueries = [];
            self.addEventListener('message', async e => {
                const d = e.data;
                if (d.type === 'load') {
                    try {
                        const req = new XMLHttpRequest();
                        req.open('GET', '${PRICE_FILE}', true);
                        req.responseType = 'arraybuffer';
                        req.onprogress = prog => {
                            if (prog.lengthComputable) {
                                self.postMessage({
                                    type: 'progress',
                                    loaded: prog.loaded,
                                    total: prog.total
                                });
                            }
                        };
                        req.onload = async () => {
                            try {
                                const buf = req.response;
                                const str = pako.ungzip(new Uint8Array(buf), {to: 'string'});
                                priceData = JSON.parse(str);
                                ready = true;
                                const size = buf.byteLength;
                                self.postMessage({type: 'ready', size});
                                pendingQueries.forEach(q => {
                                    const h = priceData[q.adId];
                                    const fp = h && h.length ? h[0][2] : null;
                                    self.postMessage({type: 'firstPrice', adId: q.adId, firstPrice: fp});
                                });
                                pendingQueries = [];
                            } catch (err) {
                                self.postMessage({type: 'error', error: err.message});
                            }
                        };
                        req.onerror = () => self.postMessage({type: 'error', error: 'Network error'});
                        req.send();
                    } catch (err) {
                        self.postMessage({type: 'error', error: err.message});
                    }
                } else if (d.type === 'getFirstPrice') {
                    if (ready) {
                        const h = priceData[d.adId];
                        const fp = h && h.length ? h[0][2] : null;
                        self.postMessage({type: 'firstPrice', adId: d.adId, firstPrice: fp});
                    } else {
                        pendingQueries.push({adId: d.adId});
                    }
                }
            });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        priceWorker = new Worker(URL.createObjectURL(blob));

        priceWorker.addEventListener('message', e => {
            const data = e.data;
            const indicator = document.getElementById('priceHistoryIndicator');

            if (data.type === 'progress') {
                const mb = (data.loaded / 1048576).toFixed(1);
                if (indicator) indicator.textContent = `${mb} MB`;
            } else if (data.type === 'ready') {
                priceDataEnabled = true;
                priceDataLoading = false;
                const mb = (data.size / 1048576).toFixed(1);
                if (indicator) indicator.textContent = `${mb} MB`;
                resolve();
            } else if (data.type === 'error') {
                priceDataLoading = false;
                if (indicator) indicator.textContent = 'Fejl';
                console.error('Prishistorik worker fejl:', data.error);
                reject(new Error(data.error));
            } else if (data.type === 'firstPrice') {
                firstPricesCache.set(data.adId, data.firstPrice);
                const resolver = pendingRequests.get(data.adId);
                if (resolver) {
                    resolver(data.firstPrice);
                    pendingRequests.delete(data.adId);
                }
            }
        });

        priceWorker.postMessage({ type: 'load' });
    });
}

function unloadPriceData() {
    if (priceWorker) {
        priceWorker.terminate();
        priceWorker = null;
    }
    firstPricesCache.clear();
    pendingRequests.clear();
    priceDataEnabled = false;
    priceDataLoading = false;
    cachedPriceFileSize = null;

    const indicator = document.getElementById('priceHistoryIndicator');
    if (indicator) indicator.textContent = '';
}

async function getFirstPrice(adId) {
    if (!priceDataEnabled) return null;
    const cached = firstPricesCache.get(adId);
    if (cached !== undefined) return cached;

    return new Promise(resolve => {
        pendingRequests.set(adId, resolve);
        if (priceWorker) {
            priceWorker.postMessage({ type: 'getFirstPrice', adId });
        } else {
            resolve(null);
        }
    });
}

window.getFirstPrice = getFirstPrice;

document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('priceHistoryToggle');
    const indicator = document.getElementById('priceHistoryIndicator');
    if (!toggle) return;

    try {
        const bytes = await fetchPriceFileSize();
        if (indicator) indicator.textContent = `${(bytes / 1048576).toFixed(1)} MB`;
    } catch {
        if (indicator) indicator.textContent = '';
    }

    const saved = localStorage.getItem("ratoghvidt_settings");
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (settings.priceHistoryToggle === true) {
                toggle.checked = true;
                loadPriceData().catch(() => {});
            }
        } catch {}
    }

    toggle.addEventListener('change', async () => {
        const currentSettings = {};
        document.querySelectorAll('#searchForm input[type="checkbox"]').forEach(cb => {
            currentSettings[cb.id] = cb.checked;
        });

        if (toggle.checked) {
            let mb = '?';
            try {
                const bytes = await fetchPriceFileSize();
                mb = (bytes / 1048576).toFixed(1);
            } catch {}

            const confirmed = confirm(
                `Er du sikker? Prishistorik kræver download og behandling af ca. ${mb} MB data.`
            );

            if (!confirmed) {
                toggle.checked = false;
                currentSettings.priceHistoryToggle = false;
                localStorage.setItem("ratoghvidt_settings", JSON.stringify(currentSettings));
                return;
            }

            loadPriceData().catch(err => {
                console.error("Kunne ikke indlæse prishistorik:", err);
                if (indicator) indicator.textContent = 'Fejl';
            });
        } else {
            unloadPriceData();
        }

        localStorage.setItem("ratoghvidt_settings", JSON.stringify(currentSettings));
    });
});

const API_URL = "https://www.dba.dk/recommerce/forsale/search/api/search/SEARCH_ID_BAP_COMMON";
let isLoading = false;

const jylland = ["0.200006", "0.200005", "0.200007", "0.200008"];
const sydsjaellandOgOerne = ["0.200004"];
const fyn = ["0.200009"];
const sjaelland = ["0.200001", "0.200002", "0.200003"];

function getSelectedLocations() {
    if (document.getElementById("closestToggle")?.checked) return [];
    const sel = [];
    if (document.getElementById("locationJylland")?.checked) sel.push(...jylland);
    if (document.getElementById("locationSydsjaelland")?.checked) sel.push(...sydsjaellandOgOerne);
    if (document.getElementById("locationFyn")?.checked) sel.push(...fyn);
    if (document.getElementById("locationSjaelland")?.checked) sel.push(...sjaelland);
    return sel.length ? sel : jylland;
}

function formatPrice(amount, currency, trade_type) {
    if (typeof amount !== "number") return "";
    if (amount === 0) {
        if (trade_type === "Gives væk") {
            return "Gives væk";
        } else {
            return "Til salg";
        }
    }
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
    const priceText = formatPrice(doc.price?.amount, doc.price?.currency_code, doc.trade_type);
    const isRetailer = doc.flags && Array.isArray(doc.flags) && doc.flags.includes('retailer');

    const imageHtml = imageSrc.endsWith("noimage.svg") ?
        `<img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" class="fallback-image" />` :
        `<img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" />`;

    let retailerBadgeHtml = '';
    if (isRetailer) {
        const orgName = doc.organisation_name?.trim();
        if (orgName) {
            retailerBadgeHtml = `<div class="retailer-badge retailer-named">${orgName}</div>`;
            card.dataset.organisationName = orgName;
        } else {
            retailerBadgeHtml = '<div class="retailer-badge">Forhandler</div>';
            card.dataset.organisationName = '';
        }
    }

    card.innerHTML = `
        <div class="card-image-wrapper">
        ${imageHtml}
        </div>
        <div class="dba-badge">dba</div>
        ${retailerBadgeHtml}
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
    card.dataset.sellerType = isRetailer ? 'retailer' : 'private';
    if (isRetailer && doc.organisation_name) {
        card.dataset.organisationName = doc.organisation_name.trim();
    } else {
        card.dataset.organisationName = '';
    }

    const adId = String(doc.id);
    const currentPrice = doc.price?.amount;
    if (typeof currentPrice === "number" && priceDataEnabled) {
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
        p.append("radius", 50000);
    } else {
        p.append("sort", "PUBLISHED_DESC");
        getSelectedLocations().forEach(l => p.append("location", l));
    }

    const includeDealers = document.getElementById("includeDealersToggle")?.checked || false;
    if (includeDealers) {
        p.append("dealer_segment", "1");
        p.append("dealer_segment", "3");
    } else {
        p.append("dealer_segment", "1");
    }

    ["1", "2"].forEach(t => p.append("trade_type", t));
    p.append("page", page);

    const res = await fetch(`${PROXY}${API_URL}?${p.toString()}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const docs = (data.docs || []).filter(d => d.type === "bap");
    const total = data.metadata?.result_size?.match_count || 0;
    return { docs, total };
}

window.hentOgVisDBA = async function(term, category, bgMode = false) {
    if (!document.getElementById("sourceDBA")?.checked) return;
    if (isLoading) return;
    isLoading = true;

    try {
        const first = await fetchDBAPage(1, term, category);
        const total = Math.min(first.total, MAX_RESULTS);
        window.totalAds += total;

        const perPage = 60;
        const pages = bgMode ? 1 : (window.isMagicMode ? 2 : Math.ceil(total / perPage));
        const pagePromises = Array.from({ length: pages }, (_, i) => i + 1);

        for (const pg of pagePromises) {
            const { docs } = pg === 1 ? first : await fetchDBAPage(pg, term, category);
            for (const doc of docs) {
                if (window.seenAdKeys.has(doc.id)) continue;
                window.allCards.push(makeCard(doc));
                window.seenAdKeys.add(doc.id);
            }
            window.loadedAds += docs.length;
        }
    } catch (e) {
        console.error("DBA fejl:", e);
    } finally {
        isLoading = false;
    }
};
