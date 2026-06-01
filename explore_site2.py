"""Explore Kaveri portal for registration transaction search."""
import asyncio
import json
import re
from playwright.async_api import async_playwright

BASE = "https://kaveri.karnataka.gov.in"


async def main():
    api_calls = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-IN",
        )
        page = await context.new_page()

        async def on_response(response):
            url = response.url
            if response.request.resource_type in ("xhr", "fetch") or re.search(
                r"api|search|transaction|registration|report|ec|property|guidance|master",
                url,
                re.I,
            ):
                entry = {
                    "url": url,
                    "status": response.status,
                    "method": response.request.method,
                }
                try:
                    ct = response.headers.get("content-type", "")
                    if "json" in ct:
                        text = await response.text()
                        entry["body"] = text[:3000]
                except Exception:
                    pass
                api_calls.append(entry)

        page.on("response", on_response)

        await page.goto(f"{BASE}/landing-page", wait_until="networkidle", timeout=60000)
        print("Title:", await page.title())
        print("URL:", page.url)

        links = await page.eval_on_selector_all(
            "a[href]",
            """els => els.map(e => ({
                text: (e.innerText || '').trim().replace(/\\s+/g, ' '),
                href: e.href
            })).filter(l => l.text && l.href.includes('kaveri'))""",
        )
        print(f"\n=== Internal links ({len(links)}) ===")
        seen = set()
        for link in links:
            key = (link["text"], link["href"])
            if key in seen:
                continue
            seen.add(key)
            if any(
                k in link["text"].lower()
                for k in ("search", "registration", "transaction", "ec", "guidance", "report", "market", "value")
            ):
                print(f"  * {link['text']} -> {link['href']}")

        # Dump all unique link texts
        print(f"\n=== All unique link texts ===")
        for link in sorted({l["text"] for l in links}):
            print(f"  - {link}")

        body = await page.content()
        # Find script src and route patterns
        scripts = re.findall(r'src="([^"]+)"', body)
        print(f"\n=== Script sources ({len(scripts)}) ===")
        for s in scripts[:20]:
            print(f"  {s}")

        # Look for angular/react routes in page source
        routes = re.findall(r"path:\s*['\"]([^'\"]+)['\"]", body)
        print(f"\n=== Routes in HTML ({len(routes)}) ===")
        for r in sorted(set(routes))[:40]:
            print(f"  {r}")

        await page.screenshot(path="/Users/adityasingh/Real estate/explore_screenshot.png", full_page=True)

        await browser.close()

    print(f"\n=== XHR/Fetch calls ({len(api_calls)}) ===")
    for call in api_calls:
        print(json.dumps(call, indent=2)[:500])
        print("---")


if __name__ == "__main__":
    asyncio.run(main())
