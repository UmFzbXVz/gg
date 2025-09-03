(() => {
	let activeSearches = [];
	let lastResultsKeys = new Set();
	let pendingNewMap = new Map();
	const originalTitle = document.title;
	const REFRESH_INTERVAL = 1 * 60 * 1000;
	const seenPendingTerms = new Map(); 

	const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

	function cardKey(card) {
		return card.dataset.id || card.dataset.key;
	}

	function makeKeysFromCards(cards) {
		const keys = new Set();
		cards.forEach(card => keys.add(cardKey(card)));
		return keys;
	}

	function updateTitle(count) {
		document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
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

			if (cards.length <= maxStaggerCards) {
				delay += i * staggerMs;
			}

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
		if (!window.bgSearchEnabled) return;
		if (!activeSearches.length) return;
		if (!Array.isArray(window.allCards)) window.allCards = [];
		const oldAllCards = [...window.allCards];

		const newCardsThisRun = [];
		const seenKeysThisRun = new Set();

		for (const { term, catObj } of activeSearches) {
			if (!seenPendingTerms.has(term)) seenPendingTerms.set(term, new Set());

			try {
				window.allCards = [];
				await Promise.all([
					window.hentOgVisGG(term, catObj, true),
					window.hentOgVisDBA(term, catObj.dbaCat, true)
				]);
				const temp = [...window.allCards];

				const seenTerm = seenPendingTerms.get(term);

				temp.forEach(card => {
					const k = cardKey(card);
					if (!k) return;
					if (lastResultsKeys.has(k) || seenKeysThisRun.has(k) || pendingNewMap.has(k) || seenTerm.has(k)) return;

					seenKeysThisRun.add(k);
					pendingNewMap.set(k, card);
					newCardsThisRun.push(card);
					seenTerm.add(k); 
				});
			} catch (err) {
				console.error(`Fejl i baggrundssøgning for "${term}":`, err);
			} finally {
				window.allCards = [...oldAllCards];
			}
		}

		if (!newCardsThisRun.length) {
			updateTitle(pendingNewMap.size);
			return;
		}

		window.allCards = mergeUniqueByKey(newCardsThisRun, oldAllCards);

		if (document.visibilityState === "visible") {
			showPendingNow(newCardsThisRun);
		} else {
			updateTitle(pendingNewMap.size);
		}
	}

	function showPendingNow(cards) {
		insertNewCardsAnimated(cards, { staggerMs: 40 });
		cards.forEach(card => {
			const k = cardKey(card);
			lastResultsKeys.add(k);
			pendingNewMap.delete(k);

			for (const [term, set] of seenPendingTerms) {
				set.delete(k);
			}
		});
		updateTitle(pendingNewMap.size);
	}

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState !== "visible") return;
		if (!window.bgSearchEnabled) return;

		if (pendingNewMap.size === 0) {
			updateTitle(0);
			return;
		}

		const cards = Array.from(pendingNewMap.values());
		if (!cards.length) {
			updateTitle(0);
			return;
		}

		insertNewCardsAnimated(cards, { staggerMs: 60, baseDelay: 0 });
		cards.forEach(card => lastResultsKeys.add(cardKey(card)));

		for (const card of cards) {
			const k = cardKey(card);
			pendingNewMap.delete(k);
			for (const set of seenPendingTerms.values()) set.delete(k);
		}

		updateTitle(0);
	});

	window.bgSearch = {
		addActiveSearch: (term, catObj) => {
			if (!window.bgSearchEnabled) return;
			if (!activeSearches.some(s => s.term === term && s.catObj === catObj)) {
				activeSearches.push({ term, catObj });
			}
		},
		removeActiveSearch: (term, catObj) => {
			activeSearches = activeSearches.filter(s => !(s.term === term && s.catObj === catObj));
		},
		setBaseline: () => {
			if (!window.bgSearchEnabled) return;
			if (!Array.isArray(window.allCards)) window.allCards = [];
			lastResultsKeys = makeKeysFromCards(window.allCards);
			pendingNewMap.clear();
			seenPendingTerms.clear();
			updateTitle(0);
			console.log("Baseline sat med", lastResultsKeys.size, "elementer");
		},
		pendingCount: () => pendingNewMap.size,
		clear: () => {
			activeSearches = [];
			lastResultsKeys.clear();
			pendingNewMap.clear();
			seenPendingTerms.clear();
			updateTitle(0);
			console.log("bgSearch er nulstillet");
		}
	};

	if (!isMobile) {
		setInterval(backgroundSearch, REFRESH_INTERVAL);
	} else {
		console.log("Mobildetektion: bg.js intervalopdatering er deaktiveret, kører kun ved visibilitychange");
	}
})();
