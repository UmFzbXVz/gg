const MAX_RESULTS = 600;

(() => {
  const grid = document.getElementById("grid");
  const API_URL = "https://www.dba.dk/recommerce-search-page/api/search/SEARCH_ID_BAP_COMMON";
  let isLoading = false;

  function formatPrice(amount, currency) {
    if (typeof amount !== "number") return "";
    let formatted = amount.toLocaleString("da-DK");
    if (currency === "DKK") {
      return `${formatted} kr.`;
    }
    return `${formatted} ${currency || ""}`;
  }

  async function fetchDBAPage(page, term, category) {
    const params = new URLSearchParams();
    params.append("q", term);
    params.append("category", category);
    params.append("sort", "PUBLISHED_DESC");
    ["0.200006", "0.200005", "0.200007", "0.200008"].forEach(loc => params.append("location", loc));
    params.append("dealer_segment", "1");
    ["1", "2"].forEach(tt => params.append("trade_type", tt));
    params.append("page", page);

    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP-fejl ${res.status}`);
    const data = await res.json();

    const docs = data.docs || [];
    const bapDocs = docs.filter(doc => doc.type === "bap");
    const totalResults = data.metadata.result_size?.match_count || 0;

    return {
      bapDocs,
      totalResults
    };
  }

  window.hentOgVisDBA = async function(term, category) {
    if (isLoading) return;
    isLoading = true;
    try {
      let currentPage = 1;
      const firstPageData = await fetchDBAPage(currentPage, term, category);
      const totalResults = Math.min(firstPageData.totalResults, MAX_RESULTS);
      window.totalAds += totalResults;

      let perPage = firstPageData.bapDocs.length;
      if (perPage === 0 || totalResults === 0) {
        isLoading = false;
        return;
      }

      firstPageData.bapDocs.forEach(doc => {
        const card = document.createElement("a");
        card.className = "card";
        card.href = doc.canonical_url?.startsWith("http") ?
          doc.canonical_url :
          `https://www.dba.dk${doc.canonical_url || ""}`;
        card.target = "_blank";
        card.rel = "noopener noreferrer";

        const location = doc.location || "";
        const imageSrc = (doc.image_urls && doc.image_urls.length > 0) ?
          doc.image_urls[0] :
          "";

        const priceText = formatPrice(doc.price?.amount, doc.price?.currency_code);

        card.innerHTML = `
                    <img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" />
                    <div class="card-content">
                        <h3>${doc.heading || ""}</h3>
                        <div class="price">${priceText}</div>
                        <div class="city">${location}</div>
                    </div>
                    <div class="dba-badge">dba</div>
                `;

        card.dataset.timestamp = doc.timestamp || 0;
        window.allCards.push(card);
      });
      window.loadedAds += firstPageData.bapDocs.length;

      const numPages = Math.ceil(totalResults / perPage);
      for (currentPage = 2; currentPage <= numPages && window.allCards.length < window.totalAds; currentPage++) {
        const pageData = await fetchDBAPage(currentPage, term, category);
        pageData.bapDocs.forEach(doc => {
          const card = document.createElement("a");
          card.className = "card";
          card.href = doc.canonical_url?.startsWith("http") ?
            doc.canonical_url :
            `https://www.dba.dk${doc.canonical_url || ""}`;
          card.target = "_blank";
          card.rel = "noopener noreferrer";

          const location = doc.location || "";
          const imageSrc = (doc.image_urls && doc.image_urls.length > 0) ?
            doc.image_urls[0] :
            "";

          const priceText = formatPrice(doc.price?.amount, doc.price?.currency_code);

          card.innerHTML = `
                        <img loading="lazy" src="${imageSrc}" alt="${doc.heading || ''}" />
                        <div class="card-content">
                            <h3>${doc.heading || ""}</h3>
                            <div class="price">${priceText}</div>
                            <div class="city">${location}</div>
                        </div>
                        <div class="dba-badge">dba</div>
                    `;

          card.dataset.timestamp = doc.timestamp || 0;
          window.allCards.push(card);
        });
        window.loadedAds += pageData.bapDocs.length;
      }
    } catch (err) {
      console.error("Fejl DBA:", err);
    } finally {
      isLoading = false;
    }
  };
})();
