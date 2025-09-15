import requests
import json
import gzip
import os
import math
import concurrent.futures
import time

API_URL = "https://www.dba.dk/recommerce-search-page/api/search/SEARCH_ID_BAP_COMMON"
PRISER_FILE_GZ = "docs/priser.json.gz"
MAX_PAGES = 50
MAX_RETRIES = 3
RETRY_SLEEP = 10

def load_priser():
    if os.path.exists(PRISER_FILE_GZ):
        with gzip.open(PRISER_FILE_GZ, "rt", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_priser(priser):
    with gzip.open(PRISER_FILE_GZ, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(priser, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Gemte priser.json.gz med {len(priser)} annoncer")

def update_history(priser, doc):
    ad_id = str(doc["ad_id"])
    current_price = doc.get("price", {}).get("amount")
    timestamp = doc.get("timestamp")

    history = priser.get(ad_id, [])
    latest_version = history[-1] if history else None

    if latest_version:
        last_price = latest_version[2]
        if last_price == current_price:
            return False
        version = latest_version[0] + 1
    else:
        version = 1

    history.append([version, timestamp, current_price])
    priser[ad_id] = history
    return True

def fetch_dba_page(page, term="*", category=None, locations=None):
    if page > MAX_PAGES:
        raise ValueError(f"Page {page} overskrider MAX_PAGES ({MAX_PAGES})")

    params = {
        "q": term,
        "sort": "PUBLISHED_DESC",
        "page": page
    }
    if category:
        params["category"] = category
    if locations:
        for loc in locations:
            params.setdefault("location", []).append(loc)
    for ds in ["1", "2"]:
        params.setdefault("dealer_segment", []).append(ds)
    for tt in ["1", "2"]:
        params.setdefault("trade_type", []).append(tt)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            res = requests.get(API_URL, params=params)
            res.raise_for_status()
            data = res.json()
            docs = [doc for doc in data.get("docs", []) if doc.get("type") == "bap"]
            totalResults = data.get("metadata", {}).get("result_size", {}).get("match_count", 0)
            return {"bapDocs": docs, "totalResults": totalResults}
        except Exception as e:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_SLEEP)
            else:
                print(f"Side {page} for '{term}' fejlede permanent: {e}")
                raise e

def fetch_term(priser, term="*", category=None, locations=None):
    first_page = fetch_dba_page(1, term, category, locations)
    total_results = first_page["totalResults"]
    per_page = len(first_page["bapDocs"])
    num_pages = min(math.ceil(total_results / per_page), MAX_PAGES) if per_page else 1

    updated = 0
    for doc in first_page["bapDocs"]:
        if update_history(priser, doc):
            updated += 1

    pages_to_fetch = list(range(2, num_pages + 1))
    failed_pages = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_dba_page, page, term, category, locations): page for page in pages_to_fetch}
        for future in concurrent.futures.as_completed(futures):
            page = futures[future]
            try:
                result = future.result()
                for doc in result["bapDocs"]:
                    if update_history(priser, doc):
                        updated += 1
            except Exception:
                failed_pages.append(page)

    retries = 0
    while failed_pages and retries < MAX_RETRIES:
        time.sleep(RETRY_SLEEP)
        current_failed = []
        for page in failed_pages:
            try:
                result = fetch_dba_page(page, term, category, locations)
                for doc in result["bapDocs"]:
                    if update_history(priser, doc):
                        updated += 1
            except Exception:
                current_failed.append(page)
        failed_pages = current_failed
        retries += 1

    return updated

if __name__ == "__main__":
    priser = load_priser()
    print(f"Indlæst {len(priser)} annoncer fra priser.json.gz")

    total_updated = fetch_term(priser, "*")

    if total_updated > 0:
        save_priser(priser)
        print(f"{total_updated} annoncer opdateret")
    else:
        print("Ingen ændringer fundet")
