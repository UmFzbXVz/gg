(() => {
	let activeSearches = [];
	let lastResultsKeys = new Set();
	let pendingNewMap = new Map();
	const originalTitle = document.title;
	const REFRESH_INTERVAL = 10 * 60 * 1000;

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
		const staggerMs = opts.staggerMs || 40;
		const baseDelay = opts.baseDelay || 0;

		cards.forEach((card, i) => {
			card.classList.add('new-card');
			card.style.animationDelay = `${baseDelay + i * staggerMs}ms`;
			grid.prepend(card);

			setTimeout(() => {
				card.classList.remove('new-card');
				card.style.animationDelay = '';
			}, 500 + i * staggerMs);
		});
	}

	async function backgroundSearch() {
		if (!window.bgSearchEnabled) return;
		if (!activeSearches.length) return;

		if (!Array.isArray(window.allCards)) window.allCards = [];
		const oldAllCards = [...window.allCards];

		const newCardsThisRun = [];
		const seenKeysThisRun = new Set();

		for (const {
				term,
				catObj
			}
			of activeSearches) {
			try {
				window.allCards = [];
				await Promise.all([
					window.hentOgVisGG(term, catObj, true),
					window.hentOgVisDBA(term, catObj.dbaCat, true)
				]);
				const temp = [...window.allCards];

				temp.forEach(card => {
					const k = cardKey(card);
					if (!k) return;
					if (lastResultsKeys.has(k) || seenKeysThisRun.has(k) || pendingNewMap.has(k)) return;
					seenKeysThisRun.add(k);
					pendingNewMap.set(k, card);
					newCardsThisRun.push(card);
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

		if (document.hasFocus()) {
			const keysToMark = [];
			newCardsThisRun.forEach(card => {
				const k = cardKey(card);
				if (pendingNewMap.has(k)) {
					keysToMark.push(k);
				}
			});

			insertNewCardsAnimated(newCardsThisRun, {
				staggerMs: 40
			});

			keysToMark.forEach(k => {
				lastResultsKeys.add(k);
				pendingNewMap.delete(k);
			});
			updateTitle(pendingNewMap.size);
		} else {
			updateTitle(pendingNewMap.size);
		}
	}

	window.addEventListener('focus', () => {
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

		insertNewCardsAnimated(cards, {
			staggerMs: 60,
			baseDelay: 0
		});

		for (const k of pendingNewMap.keys()) {
			lastResultsKeys.add(k);
		}

		pendingNewMap.clear();
		updateTitle(0);
	});

	window.bgSearch = {
		addActiveSearch: (term, catObj) => {
			if (!window.bgSearchEnabled) return;
			if (!activeSearches.some(s => s.term === term && s.catObj === catObj)) {
				activeSearches.push({
					term,
					catObj
				});
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
			updateTitle(0);
			console.log("Baseline sat med", lastResultsKeys.size, "elementer");
		},
		pendingCount: () => pendingNewMap.size,

		clear: () => {
			activeSearches = [];
			lastResultsKeys.clear();
			pendingNewMap.clear();
			updateTitle(0);
			console.log("bgSearch er nulstillet");
		}
	};

	setInterval(backgroundSearch, REFRESH_INTERVAL);
})();
