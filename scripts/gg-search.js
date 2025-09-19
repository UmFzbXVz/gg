const danishMonths = {
	'jan': 0,
	'feb': 1,
	'mar': 2,
	'apr': 3,
	'maj': 4,
	'jun': 5,
	'jul': 6,
	'aug': 7,
	'sep': 8,
	'okt': 9,
	'nov': 10,
	'dec': 11
};

const danishWeekdays = {
	'søn': 0,
	'man': 1,
	'tir': 2,
	'ons': 3,
	'tor': 4,
	'fre': 5,
	'lør': 6
};

function parseGGDate(str) {
	if (!str) return 0;
	const now = new Date();
	let date = new Date(now);

	if (str === 'i dag') {
		date.setHours(0, 0, 0, 0);
		return date.getTime();
	} else if (str === 'i går') {
		date.setDate(date.getDate() - 1);
		date.setHours(0, 0, 0, 0);
		return date.getTime();
	}

	const weekdayMatch = str.match(/^([a-zæøå]+)\.?$/i);
	if (weekdayMatch) {
		const abbr = weekdayMatch[1].toLowerCase();
		const weekday = danishWeekdays[abbr];
		if (weekday !== undefined) {
			let target = new Date(now);
			target.setHours(0, 0, 0, 0);

			let diff = now.getDay() - weekday;
			if (diff <= 0) {
				diff += 7;
			}
			target.setDate(now.getDate() - diff);
			return target.getTime();
		}
	}

	const match = str.match(/^(\d+)\.\s*(\w+)\.?\s*(\d+)?\.?$/);
	if (match) {
		const day = parseInt(match[1]);
		const monthAbbr = match[2].toLowerCase();
		const month = danishMonths[monthAbbr];
		if (month === undefined) return 0;

		let year = match[3] ? parseInt(match[3]) : now.getFullYear();
		date = new Date(year, month, day, 0, 0, 0, 0);

		if (!match[3] && date > now) {
			date.setFullYear(year - 1);
		}
		return date.getTime();
	}

	return 0;
}

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

	const GRAPHQL_QUERY = `query Search($filters: SearchFiltersInput!, $pagination: PaginationInput!, $currentUrl: String!) { redirect(url: $currentUrl) search(filters: $filters, pagination: $pagination) { pagination { total hasPrevious hasNext __typename } availableCategories { title url count __typename } listings { id title description url price { text raw __typename } primaryImage { url(size: Listing320) __typename } city zipcode createdAt(dateFormat: RELATIVE_SHORT) } }}`;
	const GET_LISTING_QUERY = `query GetListing($id: ID!) { listing(id: $id) { id title url description categoryId externalLink status viewsCount draftFinishedAt expiredAt productType favoritesCount isWeaponContent isTransactionEnabled metaTitle metaDescription isFixedPrice isInBasket isShippingAvailable transactionData { transactionId __typename } price { raw text type __typename } originalPrice images { sortOrder small: url(size: Listing640) medium: url(size: Listing1280) bigPictureSmall: url(size: Listing640x640) bigPictureMedium: url(size: Listing1280x1280) bigPictureLarge: url(size: Listing2560x2560) __typename } user { id displayName isBusiness mitIdValidatedAt isReachableByMessage isTransactionEnabled isSafepayAuthenticated status avatar { url(size: Avatar75) __typename } subscription { userId __typename } memberSince: createdAt(dateFormat: RELATIVE_LONG) availableFrom availableTo onlineListingsCount business { isBannerOwnershipActive isNoFollowEnabled isGenericExternalLinkTextEnabled isPromotionsEnabled isReachableByMail website websiteText profileText __typename } displayAddress city zipcode createdAt transactionHandInTime isFollowing receivedRatings { amount average __typename } followersCount __typename } displayAddress phones { id masked __typename } categories { id title url __typename } leafCategory { id title url featureTags isPublished __typename } listingFields { field { id isSeo title slug isBookable sortOrder parentFieldId __typename } fieldOption { slug title __typename } value fullValue displayGroup { id title sortOrder __typename } __typename } __typename } }`;

	let currentPage = 1;
	let currentTerm = "";
	let hasNextPage = false;
	let isLoading = false;

	const grid = document.getElementById("grid");

	const locationsGG = {
		jylland: ["oestjylland", "vestogmidtjylland", "nordjylland", "sydjylland"],
		sydsjaellandOgOerne: ["sydsjaelland", "bornholm"],
		fyn: ["fyn"],
		sjaelland: ["hovedstaden", "koebenhavnogomegn", "midtogoetsjaelland", "vestsjaelland"]
	};

	function getSelectedAreas() {
		const selected = [];
		if (document.getElementById("locationJylland")?.checked) selected.push(...locationsGG.jylland);
		if (document.getElementById("locationSydsjaelland")?.checked) selected.push(...locationsGG.sydsjaellandOgOerne);
		if (document.getElementById("locationFyn")?.checked) selected.push(...locationsGG.fyn);
		if (document.getElementById("locationSjaelland")?.checked) selected.push(...locationsGG.sjaelland);
		return selected.length ? selected : locationsGG.jylland;
	}

	async function hentSide(page, term, categorySlug) {
		const body = {
			operationName: "Search",
			variables: {
				category: categorySlug,
				filters: {
					area: getSelectedAreas(),
					categoryFields: [],
					listingTypes: ["Sell"],
					sorting: "LastCreated",
					term: term,
					userType: "Private",
					weapons: true
				},
				pagination: {
					perPage: 60,
					page: page
				},
				currentUrl: "/s"
			},
			query: GRAPHQL_QUERY
		};
		const res = await fetch(PROXY + API_URL, {
			method: "POST",
			headers: HEADERS,
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`Fejl ved hentning af side ${page}: ${res.status}`);
		return res.json();
	}

	async function hentOgVisSide(page, catObj) {
		if (isLoading) return;
		isLoading = true;
		try {
			const data = await hentSide(page, currentTerm, catObj.ggSlug);
			const searchData = data?.data?.search || {};
			hasNextPage = searchData?.pagination?.hasNext;

			if (page === 1) {
				const categories = searchData.availableCategories || [];
				const targetCategory = categories.find(cat => cat.title.toLowerCase() === catObj.ggTitle.toLowerCase());
				if (targetCategory) {
					const total = Math.min(targetCategory.count, 300);
					window.totalAds += total;
				}
			}

			const listings = searchData.listings || [];
			const remaining = 300 - window.loadedAds;
			const toShow = listings.slice(0, remaining);

			toShow.forEach(({
				id,
				title,
				price,
				url,
				primaryImage,
				city,
				zipcode,
				createdAt
			}) => {
				const card = document.createElement("a");
				card.className = "card";
				card.href = "https://www.guloggratis.dk" + url;
				card.target = "_blank";
				card.rel = "noopener noreferrer";
				const location = [city, zipcode].filter(Boolean).join(" ") || "";
				card.innerHTML = `
                <button class="info-btn" data-id="${id}">i</button>
                <img loading="lazy" src="${primaryImage?.url || ''}" alt="${title}" />
                <div class="card-content">
                    <h3>${title}</h3>
                    <div class="price">${price?.text || "Ingen pris"}</div>
                    <div class="city">${location}</div>
                </div>
                <div class="gg-badge">GG</div>
            `;
				const parsedTimestamp = parseGGDate(createdAt);
				card.dataset.timestamp = parsedTimestamp;
				window.allCards.push(card);
			});

			window.loadedAds += toShow.length;
		} catch (err) {
			console.error("Fejl:", err.message);
		} finally {
			isLoading = false;
		}
	}


	async function showSellerInfo(listingId) {
		try {
			const body = {
				operationName: "GetListing",
				variables: {
					id: listingId
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
			if (!listing || !listing.user) return;

			const user = listing.user;
			const phones = listing.phones || [];
			const fullAddress = listing.displayAddress || `${user.city || ''} ${user.zipcode || ''}`;
			const mapsLink = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : '';

			const modal = document.createElement('div');
			modal.className = 'modal';
			modal.innerHTML = `
            <div class="modal-content">
                <h2>Sælgers information</h2>
                <p>Navn: <strong>
                    <a href="https://www.guloggratis.dk/bruger/${user.id}" target="_blank" rel="noopener noreferrer">
                        ${user.displayName || 'Ukendt'}
                    </a>
                </strong></p>
                <p>Medlem siden: <strong>${user.memberSince || 'Ukendt'}</strong></p>
                <p>By: <strong>${user.city || ''} ${user.zipcode || ''}</strong></p>
                ${fullAddress ? `<p class="address-line">
                    Adresse: <img class="maps-icon" src="https://www.merrimackvalleyglass.com/wp-content/uploads/2020/07/1200px-Google_Maps_icon_2020.svg_.png" alt="Google Maps">
                    <strong><a href="${mapsLink}" target="_blank" rel="noopener noreferrer">${fullAddress}</a></strong>
                </p>` : ''}
                ${phones.length ? `<p>Telefon: <strong>${phones.map(p => p.masked).join(', ')}</strong></p>` : ''}
                <button class="close-btn">Luk</button>
            </div>
        `;

			document.body.appendChild(modal);
			modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
			modal.addEventListener('click', e => {
				if (e.target === modal) modal.remove();
			});

		} catch (err) {
			console.error('Fejl ved hentning af sælgerinfo:', err);
		}
	}


	grid.addEventListener('click', async (e) => {
		if (e.target.classList.contains('info-btn')) {
			e.preventDefault();
			e.stopPropagation();
			await showSellerInfo(e.target.dataset.id);
		}
	});

	window.hentOgVisGG = async function(term, catObj, maybeBgMode, maybeBgMode2) {
		const bgMode = (typeof maybeBgMode2 === 'boolean') ? maybeBgMode2 :
			(typeof maybeBgMode === 'boolean') ? maybeBgMode :
			false;

		currentTerm = term;
		currentPage = 1;
		hasNextPage = true;

		const maxPages = bgMode ? 1 : 3;

		while (hasNextPage && currentPage <= maxPages && window.allCards.length < 100) {
			await hentOgVisSide(currentPage, catObj);
			currentPage++;
		}
	};

})();
