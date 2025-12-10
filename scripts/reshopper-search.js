const RESHOPPER_MAX = 100;
(() => {
	const PROXY = "https://corsproxy.io/?";
	let isLoading = false;
	const locationCoords = {
		jylland: {
			lat: 56.15,
			lon: 10.20,
			radius: 90
		},
		sydsjaellandOgOerne: {
			lat: 55.24,
			lon: 11.76,
			radius: 60
		},
		fyn: {
			lat: 55.40,
			lon: 10.40,
			radius: 50
		},
		sjaelland: {
			lat: 55.68,
			lon: 12.10,
			radius: 90
		}
	};
	const CUSTOM_LOCATION = {
		lat: 54.891039361728026,
		lon: 11.87686376273632,
		radiusInKilometers: 50
	};

	function getSelectedLocationsRes() {
		const selected = [];
		if (document.getElementById("locationJylland")?.checked) selected.push('jylland');
		if (document.getElementById("locationSydsjaelland")?.checked) selected.push('sydsjaellandOgOerne');
		if (document.getElementById("locationFyn")?.checked) selected.push('fyn');
		if (document.getElementById("locationSjaelland")?.checked) selected.push('sjaelland');
		return selected.length ? selected : ['jylland'];
	}

	function formatPrice(amountInHundreds, currency) {
		if (!amountInHundreds) return "";
		let amount = amountInHundreds / 100;
		return currency === "dkk" ?
			`${amount.toLocaleString("da-DK")} kr.` :
			`${amount} ${currency || ""}`;
	}

	function getHighestQualityImages(images = []) {
		const bestImages = {};
		images.forEach(img => {
			const fileId = img.fileId;
			if (!fileId) return;
			const pixels = (img.width || 0) * (img.height || 0);
			if (!bestImages[fileId] || pixels > bestImages[fileId].pixels) {
				bestImages[fileId] = {
					...img,
					pixels
				};
			}
		});
		return Object.values(bestImages).map(img => img.url);
	}

	function makeCard(item) {
		const card = document.createElement("a");
		card.className = "card";
		card.href = `https://reshopper.com/da/item/${item.description.replace(/\s+/g, '-').toLowerCase()}/${item.id}`;
		card.target = "_blank";
		card.rel = "noopener noreferrer";
		let bestImageUrls = getHighestQualityImages(item.images);
		if (!bestImageUrls.length) bestImageUrls.push("noimage.svg");
		const imageHtml = bestImageUrls[0].endsWith("noimage.svg") ?
			`<img loading="lazy" src="${bestImageUrls[0]}" alt="${item.description}" class="fallback-image" />` :
			`<img loading="lazy" src="${bestImageUrls[0]}" alt="${item.description}" />`;
		const priceText = formatPrice(item.priceInHundreds, item.currency);
		const sellerText = item.user?.publicName || "Ukendt";
		const descriptionText = (item.extendedDescription || item.description || "").trim();
		card.innerHTML = `
      <div class="card-image-wrapper">
        ${imageHtml}
        <div class="reshopper-badge">
          <svg width="24" height="24" viewBox="0 0 1200 1203" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="none" stroke-width="1">
              <g>
                <path d="M1200,311.292 L1200,921.985 C1200,938.205 1198.597,954.144 1195.93,969.663 C1173.1,1101.384 1057.456,1202.442 919.309,1202.442 L280.691,1202.442 C142.544,1202.442 26.9,1101.384 4.07,969.663 C1.403,954.144 0,938.205 0,921.985 L0,311.292 L1200,311.292 Z" fill="#80BEE9" />
                <path d="M959.512,2.911 L959.512,309.221 C959.512,375.737 905.967,429.705 839.88,429.705 C773.835,429.705 720.244,375.737 720.244,309.221 L720.244,0 L919.353,0 C932.973,0 946.405,0.986 959.512,2.911 Z" fill="#D44B3E" />
                <path d="M478.488,0 L280.219,0 C266.32,0 252.654,1.034 239.268,3.007 L239.268,309.165 C239.268,375.756 292.812,429.705 358.904,429.705 C424.617,429.705 477.929,376.367 478.488,310.292 L478.488,309.964 L478.488,0 Z" fill="#D44B3E" />
                <path d="M1197.558,969.278 C1174.713,1100.526 1058.99,1201.221 920.748,1201.221 L281.693,1201.221 C143.452,1201.221 27.728,1100.526 4.883,969.278 L1197.558,969.278 Z" fill="#A66641" />
                <path d="M707.823,761.086 C683.567,747.115 675.181,715.877 689.183,691.675 L803.489,494.138 C817.491,469.931 848.794,461.564 873.05,475.539 L873.05,475.539 C897.306,489.51 905.697,520.744 891.69,544.946 L777.389,742.488 C763.382,766.69 732.079,775.057 707.823,761.086 Z" fill="#9DCFF1" />
                <path d="M571.29,744.377 C552.676,733.712 546.239,709.874 556.986,691.403 L607.068,605.321 C617.815,586.851 641.837,580.462 660.45,591.127 L660.45,591.127 C679.063,601.791 685.501,625.63 674.754,644.105 L624.671,730.182 C613.924,748.653 589.903,755.041 571.29,744.377 Z" fill="#9DCFF1" />
              </g>
            </g>
          </svg>
        </div>
      </div>
      <div class="card-content">
        <h3>${item.description}</h3>
        <div class="card-footer">
          <div class="price">${priceText}</div>
          <div class="seller">${sellerText}</div>
        </div>
      </div>
    `;
		card.dataset.timestamp = item.images?.[0]?.timeUploaded ?
			new Date(item.images[0].timeUploaded).getTime() :
			0;
		card.dataset.images = JSON.stringify(bestImageUrls);
		card.dataset.key = item.id;
		card.dataset.source = "reshopper";
		card.dataset.seller = sellerText;
		card.dataset.description = descriptionText || "Ingen beskrivelse tilgængelig.";
		return card;
	}
	async function fetchReshopperPage(offset = 0, query = "", pageSize = 32, location = null, radiusInKilometers = null, segmentValue = null) {
		const API_URL = "https://app.reshopper.com/api/query/items/faceted";
		const payload = {
			facets: [{
					type: "segment",
					facetCount: 3,
					values: segmentValue ? [segmentValue] : undefined
				},
				{
					type: "condition",
					facetCount: 5
				},
				{
					type: "gender",
					facetCount: 3
				},
				{
					type: "category",
					facetCount: 20
				},
				{
					type: "size",
					facetCount: 40
				},
				{
					type: "brandOrTitle",
					facetCount: 60
				},
				{
					type: "age",
					facetCount: 20
				},
				{
					type: "shopType",
					facetCount: 4
				},
				{
					type: "retailShop",
					facetCount: 10
				},
				{
					type: "isShippingOffered",
					facetCount: 3
				}
			],
			cursor: null,
			query,
			pageSize,
			offset,
			country: "DK",
			isSold: false,
			sortDirection: "asc",
			sortBy: "distance",
			omitPointInTime: false
		};
		if (location && location.lat && location.lon) {
			payload.location = {
				lat: location.lat,
				lon: location.lon
			};
		}
		if (radiusInKilometers) {
			payload.radiusInKilometers = radiusInKilometers;
		}
		const res = await fetch(PROXY + API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept-Encoding": "identity",
				"ReshopperClient": "android 15",
				"User-Agent": "Titanium SDK/13.0.0 (SM-G990; Android API Level: 35; sut-en-fed-pik;)",
				"X-ReshopperVersion": "9.2.1"
			},
			body: JSON.stringify(payload)
		});
		if (!res.ok) throw new Error(`HTTP-fejl ${res.status}`);
		return res.json();
	}
	window.hentOgVisReshopper = async function(term = "", bgMode = false, segmentValue = undefined) {
		if (!document.getElementById("sourceReshopper")?.checked) {
			return;
		}
		if (segmentValue === null) return;
		if (isLoading) return;
		isLoading = true;
		try {
			const closestToggle = document.getElementById("closestToggle");
			const useClosest = closestToggle?.checked || false;
			let locationsToSearch;
			if (useClosest) {
				locationsToSearch = [{
					...CUSTOM_LOCATION,
					name: "closest"
				}];
			} else {
				const selectedKeys = getSelectedLocationsRes();
				locationsToSearch = selectedKeys.map(key => ({
					lat: locationCoords[key].lat,
					lon: locationCoords[key].lon,
					radiusInKilometers: locationCoords[key].radius,
					name: key
				}));
			}
			let totalFetched = 0;
			const pageSize = 32;
			const numPagesPerLoc = bgMode ? 1 : (window.isMagicMode ? 2 : Math.ceil(RESHOPPER_MAX / pageSize));
			for (const loc of locationsToSearch) {
				let offset = 0;
				const firstData = await fetchReshopperPage(
					offset,
					term,
					pageSize, {
						lat: loc.lat,
						lon: loc.lon
					},
					loc.radiusInKilometers,
					segmentValue
				);
				const locTotal = Math.min(firstData.totalHits || 0, RESHOPPER_MAX);
				window.totalAds += locTotal;
				for (const item of firstData.items || []) {
					if (totalFetched >= RESHOPPER_MAX) break;
					const adId = item.id;
					if (window.seenAdKeys.has(adId)) continue;
					window.allCards.push(makeCard(item));
					window.seenAdKeys.add(adId);
					totalFetched++;
					window.loadedAds++;
				}
				for (let page = 1; page < numPagesPerLoc && totalFetched < RESHOPPER_MAX; page++) {
					offset = page * pageSize;
					const pageData = await fetchReshopperPage(
						offset, term, pageSize, {
							lat: loc.lat,
							lon: loc.lon
						}, loc.radiusInKilometers, segmentValue);
					for (const item of pageData.items || []) {
						if (totalFetched >= RESHOPPER_MAX) break;
						const adId = item.id;
						if (window.seenAdKeys.has(adId)) continue;
						window.allCards.push(makeCard(item));
						window.seenAdKeys.add(adId);
						totalFetched++;
						window.loadedAds++;
					}
				}
				if (totalFetched >= RESHOPPER_MAX) break;
			}
		} catch (err) {
			console.error("Fejl Reshopper:", err);
		} finally {
			isLoading = false;
		}
	};
})();
