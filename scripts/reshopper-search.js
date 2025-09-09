(() => {
	const PROXY = "https://corsproxy.io/?";
	let isLoading = false;

	function formatPrice(amountInHundreds, currency) {
		if (!amountInHundreds) return "";
		let amount = amountInHundreds / 100;
		return currency === "dkk" ?
			`${amount.toLocaleString("da-DK")} kr.` :
			`${amount} ${currency || ""}`;
	}

	function makeCard(item) {
		const card = document.createElement("a");
		card.className = "card";
		card.href = `https://reshopper.com/da/item/${item.brandOrTitle.replace(/\s+/g, '-').toLowerCase()}/${item.id}`;
		card.target = "_blank";
		card.rel = "noopener noreferrer";

		const firstImageObj = item.images && item.images.length ? item.images[0] : null;
		const firstImageUrl = firstImageObj?.url || "";
		const priceText = formatPrice(item.priceInHundreds, item.currency);
		const sellerText = item.user?.userPublicName || "Ukendt";
		const descriptionText = (item.extendedDescription || item.description || "").trim();

		card.innerHTML = `
        <div class="card-image-wrapper">
          <img loading="lazy" src="${firstImageUrl}" alt="${item.brandOrTitle}" />
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
          <h3>${item.brandOrTitle}</h3>
          <div class="card-footer">
            <div class="price">${priceText}</div>
            <div class="seller">${sellerText}</div>
          </div>
        </div>
    `;

		const h3 = card.querySelector("h3");
		h3.style.fontSize = h3.textContent.length > 40 ? "0.8rem" : "1rem";

		card.dataset.timestamp = firstImageObj && firstImageObj.timeUploaded ?
			new Date(firstImageObj.timeUploaded).getTime() :
			0;

		card.dataset.images = JSON.stringify(item.images.map(img => img.url));
		card.dataset.key = `${item.brandOrTitle}|${priceText}`;
		card.dataset.source = "reshopper";
		card.dataset.seller = sellerText;
		card.dataset.description = descriptionText || "Ingen beskrivelse tilgængelig.";

		return card;
	}

	async function fetchReshopperPage(
		offset = 0,
		query = "",
		pageSize = 12,
		location = null,
		radiusInKilometers = null,
		segmentValue = null
	) {
		const API_URL = "https://app.reshopper.com/web/items/faceted";
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
					facetCount: 100
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
			query,
			pageSize,
			offset,
			country: "DK",
			isSold: false,
			removeSoldItemsFromQuery: true,
			sortDirection: "desc",
			sortBy: "created",
			omitPointInTime: true,
			itemCategoryGroupPath: ""
		};

		if (location && location.lat && location.lon) {
			payload.location = {
				lat: String(location.lat),
				lon: String(location.lon)
			};
		}
		if (radiusInKilometers) {
			payload.radiusInKilometers = radiusInKilometers;
		}

		const res = await fetch(PROXY + API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(payload)
		});

		if (!res.ok) throw new Error(`HTTP-fejl ${res.status}`);
		return res.json();
	}


	window.hentOgVisReshopper = async function(term = "", bgMode = false, segmentValue = undefined) {
		if (segmentValue === null) {
			console.log("Reshopper-søgning ignoreret pga. null-segment");
			return;
		}

		if (isLoading) return;
		isLoading = true;

		try {
			let offset = 0;
			const pageSize = 12;
			let totalFetched = 0;

			const firstData = await fetchReshopperPage(offset, term, pageSize, null, null, segmentValue);
			const totalResults = Math.min(firstData.totalHits || 0, MAX_RESULTS);
			window.totalAds += totalResults;

			firstData.items.forEach(item => window.allCards.push(makeCard(item)));
			totalFetched += firstData.items.length;
			window.loadedAds += firstData.items.length;

			const numPages = bgMode ? 1 : Math.ceil(totalResults / pageSize);

			for (let page = 1; page < numPages && totalFetched < totalResults; page++) {
				offset = page * pageSize;
				const pageData = await fetchReshopperPage(offset, term, pageSize, null, null, segmentValue);
				pageData.items.forEach(item => window.allCards.push(makeCard(item)));
				totalFetched += pageData.items.length;
				window.loadedAds += pageData.items.length;
			}
		} catch (err) {
			console.error("Fejl Reshopper:", err);
		} finally {
			isLoading = false;
		}
	};

})();
