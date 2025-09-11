(() => {
	let activeSearches = [];
	let lastResultsKeys = new Set();
	let pendingNewMap = new Map();
	const originalTitle = document.title;
	const REFRESH_INTERVAL = 5 * 60 * 1000;
	const seenPendingTerms = new Map();

	const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

	let bgIntervalId = null;

	function cardKey(card) {
		return card.dataset.id || card.dataset.key;
	}

	function makeKeysFromCards(cards) {
		const keys = new Set();
		cards.forEach(card => keys.add(cardKey(card)));
		return keys;
	}

	function updateTitle(count) {
		if (!isMobile) {
			document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
		}
	}

	function mergeUniqueByKey(newCards, existingCards) {
		const seen = new Set();
		const out = [];
		const combined = [...newCards, ...existingCards];

		combined.forEach(card => {
			const k = cardKey(card);
			if (!seen.has(k)) {
				seen.add(k);
				out.push(card);
			}
		});

		return out;
	}

	function insertNewCardsAnimated(cards, opts = {}) {
		const grid = document.getElementById("grid");
		const baseDelay = opts.baseDelay || 0;
		const staggerMs = opts.staggerMs || 40;
		const maxStaggerCards = 20;

		cards.forEach((card, i) => {
			card.classList.add('new-card');
			let delay = baseDelay;
			if (cards.length <= maxStaggerCards) delay += i * staggerMs;
			card.style.animationDelay = `${delay}ms`;
			grid.prepend(card);

			const animationDuration = 500;
			setTimeout(() => {
				card.classList.remove('new-card');
				card.style.animationDelay = '';
			}, animationDuration + delay);
		});
	}

	async function backgroundSearch() {
		const bgEnabled = document.getElementById("bgToggle").checked;
		if (!bgEnabled || !activeSearches.length) return;
		if (!Array.isArray(window.allCards)) window.allCards = [];

		window.startSpinner();

		const newCardsThisRun = [];
		const seenKeysThisRun = new Set();

		try {
			for (const {
					term,
					catObj
				}
				of activeSearches) {

				if (!seenPendingTerms.has(term)) seenPendingTerms.set(term, new Set());
				const seenTerm = seenPendingTerms.get(term);

				try {
					const tempAllCards = [...window.allCards];
					window.allCards = [];

					await Promise.all([
						window.hentOgVisGG(term, catObj, null, true),
						window.hentOgVisDBA(term, catObj.dbaCat, true),
						window.hentOgVisReshopper(term, true, catObj.reshopperFacetValue)
					]);

					const temp = [...window.allCards];

					temp.forEach(card => {
						const k = cardKey(card);
						if (!k) return;
						if (lastResultsKeys.has(k) || seenKeysThisRun.has(k) || pendingNewMap.has(k) || seenTerm.has(k)) return;

						seenKeysThisRun.add(k);
						pendingNewMap.set(k, card);
						newCardsThisRun.push(card);
						seenTerm.add(k);
					});

					window.allCards = mergeUniqueByKey(temp, tempAllCards);

				} catch (err) {
					console.error(`Fejl i baggrundssøgning for "${term}":`, err);
				}
			}

			if (!newCardsThisRun.length) {
				if (!isMobile) updateTitle(pendingNewMap.size);
				return;
			}

			if (document.visibilityState === "visible") {
				showPendingNow(newCardsThisRun);
			} else {
				if (!isMobile) updateTitle(pendingNewMap.size);
			}
		} finally {
			window.stopSpinner();
		}
	}

	function showPendingNow(cards) {
		if (!cards.length) return;

		const grid = document.getElementById("grid");

		grid.querySelectorAll(".card.bg-new-card").forEach(el => {
			el.classList.remove("bg-new-card");
		});

		insertNewCardsAnimated(cards, {
			staggerMs: 40
		});

		cards.forEach(card => {
			const k = cardKey(card);
			lastResultsKeys.add(k);
			pendingNewMap.delete(k);

			for (const set of seenPendingTerms.values()) set.delete(k);

			setTimeout(() => {
				card.classList.add("bg-new-card");
			}, 350);
		});

		if (!isMobile) updateTitle(pendingNewMap.size);
	}

	if (isMobile) {
		let wasVisible = true;

		async function handleReturnToPage() {
			const bgEnabled = document.getElementById("bgToggle").checked;
			if (!bgEnabled) return;

			const nowVisible = document.visibilityState === "visible";
			if (!nowVisible || wasVisible) {
				wasVisible = nowVisible;
				return;
			}
			wasVisible = nowVisible;

			requestAnimationFrame(async () => {
				if (activeSearches.length) {
					await backgroundSearch();
				}

				const pendingCards = [...pendingNewMap.values()];
				if (pendingCards.length) {
					setTimeout(() => showPendingNow(pendingCards), 50);
				}
			});
		}

		document.addEventListener("visibilitychange", handleReturnToPage);
		window.addEventListener("pageshow", handleReturnToPage);
	} else {
		function startBgInterval() {
			if (bgIntervalId) clearInterval(bgIntervalId);
			bgIntervalId = setInterval(async () => {
				const bgEnabled = document.getElementById("bgToggle").checked;
				if (bgEnabled) {
					await backgroundSearch();
				}
			}, REFRESH_INTERVAL);
		}
		startBgInterval();

		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible" && pendingNewMap.size) {
				showPendingNow([...pendingNewMap.values()]);
			}
		});
	}

	window.bgSearch = {
		_pausedSearches: [],

		addActiveSearch: function(term, catObj) {
			const bgEnabled = document.getElementById("bgToggle").checked;
			if (!bgEnabled) return;
			if (!activeSearches.some(s => s.term === term && s.catObj === catObj)) {
				activeSearches.push({
					term,
					catObj
				});
			}
		},

		removeActiveSearch: function(term, catObj) {
			activeSearches = activeSearches.filter(s => !(s.term === term && s.catObj === catObj));
		},

		setBaseline: function() {
			const bgEnabled = document.getElementById("bgToggle").checked;
			if (!bgEnabled) return;
			if (!Array.isArray(window.allCards)) window.allCards = [];
			lastResultsKeys = makeKeysFromCards(window.allCards);
			pendingNewMap.clear();
			seenPendingTerms.clear();
			updateTitle(0);
			console.log("Baseline sat med", lastResultsKeys.size, "elementer");
		},

		pendingCount: function() {
			return pendingNewMap.size;
		},

		clear: function() {
			this._pausedSearches = activeSearches.slice();
			activeSearches = [];
			lastResultsKeys.clear();
			pendingNewMap.clear();
			seenPendingTerms.clear();
			updateTitle(0);
			console.log("bgSearch er nulstillet (pauset", this._pausedSearches.length, "søgninger)");
		},

		resume: function() {
			const bgEnabled = document.getElementById("bgToggle").checked;
			if (!bgEnabled) return;

			if (Array.isArray(this._pausedSearches) && this._pausedSearches.length) {
				activeSearches = this._pausedSearches;
				this._pausedSearches = [];
			}

			if (window.pendingBgSearches) {
				window.pendingBgSearches.forEach(s => this.addActiveSearch(s.term, s.catObj));
				window.pendingBgSearches = null;
			}

			if (!Array.isArray(window.allCards)) window.allCards = [];
			lastResultsKeys = makeKeysFromCards(window.allCards);
			pendingNewMap.clear();
			seenPendingTerms.clear();
			updateTitle(0);

			if (!isMobile) startBgInterval();

			backgroundSearch().catch(console.error);

			console.log("bgSearch er genoptaget; aktive søgninger:", activeSearches.length);
		}
	};
})();
