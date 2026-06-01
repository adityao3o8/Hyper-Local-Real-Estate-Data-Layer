"""Temporary script to explore Kaveri portal structure."""
import asyncio
import json
from playwright.async_api import async_playwright


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
            if any(
                k in url.lower()
                for k in ("api", "search", "transaction", "registration", "report", "ec", "property", "guidance")
            ):
                try:
                    ct = response.headers.get("content-type", "")
                    body = None
                    if "json" in ct or "text" in ct:
                        body = await response.text()
                        if len(body) > 2000:
                            body = body[:2000] + "..."
                except Exception:
                    body = None
                api_calls.append(
                    {
                        "url": url,
                        "status": response.status,
                        "method": response.request.method,
                        "content_type": response.headers.get("content-type"),
                        "body_preview": body,
                    }
                )

        page.on("response", on_response)

        print("Navigating to homepage...")
        try:
            resp = await page.goto(
                "https://kaverionline.karnataka.gov.in",
                wait_until="networkidle",
                timeout=60000,
            )
            print(f"Status: {resp.status if resp else 'None'}")
            print(f"Title: {await page.title()}")
            print(f"URL: {page.url}")

            # Get all links
            links = await page.eval_on_selector_all(
                "a[href]",
                "els => els.map(e => ({text: e.innerText.trim(), href: e.href})).filter(l => l.text)",
            )
            print(f"\nFound {len(links)} links")
            for link in links[:40]:
                print(f"  - {link['text'][:60]} -> {link['href'][:100]}")

            # Get page text snippets
            body_text = await page.inner_text("body")
            print(f"\nBody text preview ({len(body_text)} chars):")
            print(body_text[:3000])

            # Look for menus / buttons
            buttons = await page.eval_on_selector_all(
                "button, input[type=submit], .nav-link, [role=menuitem]",
                "els => els.map(e => e.innerText.trim()).filter(t => t)",
            )
            print(f"\nButtons/menus: {buttons[:30]}")

        except Exception as e:
            print(f"Error: {e}")

        await browser.close()

    print(f"\n\nAPI calls captured: {len(api_calls)}")
    for call in api_calls[:30]:
        print(json.dumps(call, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
