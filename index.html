<!DOCTYPE html>
<html lang="da">
<head>
    <meta charset="UTF-8">
    <title>Råt og Hvidt</title>
    <link rel="stylesheet" href="style.css">
    <link rel="icon" type="image/png" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
</head>
<body>
<div class="page-container">
    <h1>
        <span class="title-highlight"><span id="rat">Råt</span> og <span id="hvidt">Hvidt</span></span>
    </h1>
    <form id="searchForm" class="controls">
        <div class="input-wrapper">
            <input type="text" id="searchTerm" placeholder="søg efter..." autocomplete="off">
            <svg id="searchSpinner" class="loading-border" viewBox="0 0 300 40" preserveAspectRatio="none">
                <rect x="2" y="2" width="296" height="36" rx="6" ry="6" fill="none" stroke="#4caf50" stroke-width="5" stroke-linecap="round" />
            </svg>
        </div>
        <div class="category-selector">
            <button id="categoryButton" class="category-button" type="button">
                <img src="sorting.svg" alt="" class="category-icon">
            </button>
            <div id="categoryMenu" class="category-menu" style="display: none;">
                <ul>
                    <li data-value="mobler">Møbler og indretning</li>
                    <li data-value="dyr">Dyr og udstyr</li>
                    <li data-value="kunst">Kunst og antik</li>
                </ul>
                <hr class="menu-divider" />
                <label class="bg-toggle">
                    Auto-opdatér
                    <input type="checkbox" id="bgToggle" checked>
                </label>
            </div>
        </div>
    </form>
    <div id="grid"></div>
</div>

<script src="scripts/gg-search.js"></script>
<script src="scripts/dba-search.js"></script>
<script src="scripts/fremviser.js"></script>
<script src="scripts/bg.js"></script>

<script>
(() => {
    function cardKey(card) {
        return card.dataset.id || card.dataset.key;
    }

    const form = document.getElementById("searchForm");
    const input = document.getElementById("searchTerm");
    const spinner = document.getElementById("searchSpinner");
    const grid = document.getElementById("grid");
    const categoryButton = document.getElementById("categoryButton");
    const categoryMenu = document.getElementById("categoryMenu");
    const bgToggle = document.getElementById("bgToggle");

    let selectedCategory = 'mobler';
    window.bgSearchEnabled = true;

    const BATCH_SIZE = 30;
    let isFirstSearch = true;
    window.allCards = [];
    let currentIndex = 0;

    const categories = {
        'mobler': { ggSlug: '/mobler', ggTitle: 'møbler', dbaCat: '0.78' },
        'dyr': { ggSlug: '/dyr-og-tilbehor', ggTitle: 'dyr og tilbehør', dbaCat: '0.77' },
        'kunst': { ggSlug: '/antikviteter-og-kunst', ggTitle: 'antikviteter og kunst', dbaCat: '0.76' }
    };

    const defaultLi = categoryMenu.querySelector('li[data-value="mobler"]');
    if (defaultLi) defaultLi.classList.add('active');

    if (bgToggle) {
        bgToggle.addEventListener("change", (e) => {
            window.bgSearchEnabled = e.target.checked;
            console.log("Baggrundssøgning:", window.bgSearchEnabled ? "TIL" : "FRA");
            if (!window.bgSearchEnabled && window.bgSearch) {
                window.bgSearch.clear();
            }
        });
    }

    function showNoResults(term) {
        if (window.allCards.length === 0) {
            grid.innerHTML = `<div class="no-results">0 søgeresultater for "<strong>${term}</strong>".</div>`;
        }
    }

    function sortAllCards() {
        window.allCards.sort((a, b) => Number(b.dataset.timestamp) - Number(a.dataset.timestamp));
    }

    function renderNextBatch() {
        const nextBatch = window.allCards.slice(currentIndex, currentIndex + BATCH_SIZE);
        nextBatch.forEach(card => grid.appendChild(card));
        currentIndex += nextBatch.length;
    }

    function handleScroll() {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
            renderNextBatch();
        }
    }

    window.sortAndRender = function() {
        sortAllCards();
        grid.innerHTML = "";
        currentIndex = 0;
        renderNextBatch();
        window.addEventListener('scroll', handleScroll);
    }

    categoryButton.addEventListener('click', (e) => {
        e.preventDefault();
        const isVisible = categoryMenu.style.display === 'block';
        categoryMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (!categoryButton.contains(e.target) && !categoryMenu.contains(e.target)) {
            categoryMenu.style.display = 'none';
        }
    });

    input.addEventListener("focus", function() { this.select(); });

    categoryMenu.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
            selectedCategory = li.dataset.value;
            categoryMenu.querySelectorAll('li').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
            categoryMenu.style.display = 'none';
            const term = input.value.trim();
            if (term) {
                input.disabled = true;
                spinner.classList.add("active");
                form.requestSubmit();
            }
        });
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const term = input.value.trim();
        if (!term) return;
        const catObj = categories[selectedCategory];

        input.disabled = true;
        spinner.classList.add("active");

        if (isFirstSearch) { grid.innerHTML = ""; isFirstSearch = false; }
        window.allCards = [];
        window.totalAds = 0;
        window.loadedAds = 0;
        currentIndex = 0;
        window.removeEventListener('scroll', handleScroll);

        if (window.bgSearch) { window.bgSearch.clear(); }

        try {
            await Promise.all([
                window.hentOgVisGG(term, catObj, false),
                window.hentOgVisDBA(term, catObj.dbaCat, false)
            ]);

            await new Promise(resolve => setTimeout(resolve, 0));

            window.loadedAds = window.totalAds;
            window.sortAndRender();

            if (window.bgSearchEnabled && window.bgSearch) {
                window.bgSearch.addActiveSearch(term, catObj);
                window.bgSearch.setBaseline(); 
            }

            showNoResults(term);

        } catch (err) {
            console.error("Fejl i søgning:", err);
        } finally {
            input.disabled = false;
            spinner.classList.remove("active");
        }
    });

    function insertNewCardsAnimated(newCards) {
        newCards.forEach(card => {
            card.classList.add('new-card');
            grid.prepend(card);
            requestAnimationFrame(() => { card.classList.remove('new-card'); });
        });
    }

    function magicSpan(id, terms, displayTerm) {
        const span = document.getElementById(id);
        if (!span) return;

        span.addEventListener('click', async () => {
            const catObj = categories[selectedCategory];
            input.value = "";
            input.disabled = true;
            spinner.classList.add("active");
            window.allCards = [];
            window.totalAds = 0;
            window.loadedAds = 0;
            currentIndex = 0;
            window.removeEventListener('scroll', handleScroll);

            try {
                if (window.bgSearchEnabled && window.bgSearch) {
                    window.bgSearch.clear(); 
                    terms.forEach(term => window.bgSearch.addActiveSearch(term, catObj));
                }

                for (const term of terms) {
                    await window.hentOgVisGG(term, catObj, true);
                    await window.hentOgVisDBA(term, catObj.dbaCat, true);
                }

                const seenKeys = new Set();
                window.allCards = window.allCards.filter(card => {
                    const key = cardKey(card);
                    if (seenKeys.has(key)) return false;
                    seenKeys.add(key);
                    return true;
                });

                insertNewCardsAnimated(window.allCards);
                window.loadedAds = window.totalAds = window.allCards.length;
                window.sortAndRender();
                showNoResults(displayTerm);

                if (window.bgSearchEnabled && window.bgSearch) {
                    window.bgSearch.setBaseline();
                }

            } catch (err) {
                console.error("Fejl i magicSpan-søgning:", err);
            } finally {
                input.disabled = false;
                spinner.classList.remove("active");
            }
        });
    }

    magicSpan("rat", ["Jason", "Rolschau", "Glostrup møbelfabrik", "Brande møbelindustri", "Østervig"], "gode sager");
    magicSpan("hvidt", ["bord", "skrivebord", "sofa", "sofabord", "spisebord", "skænk", "stol", "lænestol", "hvilestol", "palisander"], "generelle sager");

})();
</script>
</body>
</html>
