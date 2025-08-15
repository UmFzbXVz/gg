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

    window.hentOgVisDBA = async function(term) {
        if (isLoading) return;
        isLoading = true;
        try {
            const params = new URLSearchParams();
            params.append("q", term);
            params.append("category", "0.78");
            params.append("sort", "PUBLISHED_DESC");
            ["0.200006", "0.200005", "0.200007", "0.200008"].forEach(loc => params.append("location", loc));
            params.append("dealer_segment", "1");
            ["1", "2"].forEach(tt => params.append("trade_type", tt));

            const res = await fetch(`${API_URL}?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP-fejl ${res.status}`);
            const data = await res.json();

            const docs = data.docs || [];
            docs.forEach(doc => {
                if (doc.type === "bap") {
                    const card = document.createElement("a");
                    card.className = "card";
                    card.href = doc.canonical_url?.startsWith("http") 
                                ? doc.canonical_url 
                                : `https://www.dba.dk${doc.canonical_url || ""}`;
                    card.target = "_blank";
                    card.rel = "noopener noreferrer";

                    const location = doc.location || "";
                    const imageSrc = (doc.image_urls && doc.image_urls.length > 0) 
                                     ? doc.image_urls[0] 
                                     : "";

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
                }
            });
        } catch (err) {
            console.error("Fejl DBA:", err);
        } finally {
            isLoading = false;
        }
    };
})();
