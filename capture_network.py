"""Capture XHR/fetch API calls from Kaveri portal pages (no dropdown interaction)."""
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urlparse

from playwright.async_api import Request, Response, async_playwright

PRIMARY_BASE = "https://kaverionline.karnataka.gov.in"
FALLBACK_BASE = "https://kaveri.karnataka.gov.in"

PAGES_TO_PROBE = [
    ("/", "Homepage"),
    ("/landing-page", "Landing page"),
    ("/ec-search", "EC search route"),
    ("/citizen/ec-search", "Citizen EC search route"),
    ("/encumbrance-certificate", "Encumbrance certificate route"),
    ("/guest/ec-search", "Guest EC search route"),
]


@dataclass
class CapturedCall:
    page_label: str
    url: str
    method: str
    status: int | None
    request_headers: dict[str, str]
    response_headers: dict[str, str] = field(default_factory=dict)
    resource_type: str = ""
    post_data: str | None = None
    response_preview: str | None = None

    @property
    def endpoint(self) -> str:
        parsed = urlparse(self.url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def is_api_request(request: Request) -> bool:
    if request.resource_type in ("xhr", "fetch"):
        return True
    return "/api/" in request.url.lower()


def header_subset(headers: dict[str, str]) -> dict[str, str]:
    keep = {
        "authorization",
        "content-type",
        "accept",
        "origin",
        "referer",
        "x-requested-with",
        "cookie",
        "user-agent",
    }
    return {k: v for k, v in headers.items() if k.lower() in keep}


async def resolve_base_url(page) -> tuple[str, list[str]]:
    notes: list[str] = []
    for base in (PRIMARY_BASE, FALLBACK_BASE):
        try:
            resp = await page.request.get(f"{base}/landing-page", timeout=20000)
            if resp.status < 400:
                if base != PRIMARY_BASE:
                    notes.append(
                        f"{PRIMARY_BASE} unreachable; using {base} (same Kaveri 2.0 portal)."
                    )
                return base, notes
        except Exception as exc:
            notes.append(f"{base} failed: {exc}")
    raise RuntimeError("Neither Kaveri portal URL is reachable.")


async def capture_page(
    page,
    base_url: str,
    path: str,
    label: str,
    captured: list[CapturedCall],
) -> int | None:
    pending: dict[str, CapturedCall] = {}

    def on_request(request: Request) -> None:
        if not is_api_request(request):
            return
        pending[request.url + request.method] = CapturedCall(
            page_label=label,
            url=request.url,
            method=request.method,
            status=None,
            request_headers=header_subset(request.headers),
            resource_type=request.resource_type,
            post_data=request.post_data,
        )

    async def on_response(response: Response) -> None:
        request = response.request
        if not is_api_request(request):
            return
        key = request.url + request.method
        call = pending.pop(
            key,
            CapturedCall(
                page_label=label,
                url=request.url,
                method=request.method,
                status=None,
                request_headers=header_subset(request.headers),
                resource_type=request.resource_type,
                post_data=request.post_data,
            ),
        )
        call.status = response.status
        call.response_headers = header_subset(response.headers)
        try:
            ct = response.headers.get("content-type", "")
            if "json" in ct or "text" in ct:
                body = await response.text()
                call.response_preview = body[:500] if body else None
        except Exception:
            pass
        captured.append(call)

    page.on("request", on_request)
    page.on("response", on_response)

    target = base_url.rstrip("/") + path
    http_status = None
    try:
        response = await page.goto(target, wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(3000)
        http_status = response.status if response else None
        print(f"  [{label}] {target} -> HTTP {http_status}")
    except Exception as exc:
        print(f"  [{label}] {target} -> FAILED: {exc}")
    finally:
        page.remove_listener("request", on_request)
        page.remove_listener("response", on_response)

    return http_status


async def find_ec_references(page, base_url: str) -> list[dict]:
    await page.goto(f"{base_url}/landing-page", wait_until="networkidle", timeout=45000)
    await page.wait_for_timeout(2000)
    return await page.eval_on_selector_all(
        "a[href], option, [routerlink]",
        """els => els.map(el => ({
            text: (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' '),
            href: el.href || el.getAttribute('routerlink') || el.value || ''
        })).filter(x => /ec|encumbrance/i.test(x.text + ' ' + x.href))""",
    )


def dedupe_calls(calls: list[CapturedCall]) -> list[CapturedCall]:
    seen: set[tuple[str, str]] = set()
    unique: list[CapturedCall] = []
    for call in calls:
        key = (call.endpoint, call.method)
        if key in seen:
            continue
        seen.add(key)
        unique.append(call)
    return unique


def format_output(base_url: str, calls: list[CapturedCall], notes: list[str]) -> str:
    lines = [
        "# Kaveri portal API endpoints",
        f"# Captured: {datetime.now().isoformat(timespec='seconds')}",
        f"# Base URL: {base_url}",
        "# Method: Playwright network capture (XHR/fetch on page load only)",
        "",
    ]
    for note in notes:
        lines.append(f"# NOTE: {note}")
    lines.append("")

    if not calls:
        lines.append("No XHR/fetch API calls captured.")
        return "\n".join(lines) + "\n"

    for call in calls:
        lines.append(f"## {call.page_label}")
        lines.append(f"ENDPOINT: {call.method} {call.endpoint}")
        lines.append(f"FULL_URL: {call.url}")
        lines.append(f"STATUS: {call.status}")
        lines.append(f"RESOURCE_TYPE: {call.resource_type}")
        if call.post_data:
            lines.append(f"POST_DATA: {call.post_data[:1000]}")
        lines.append("REQUEST_HEADERS:")
        for k, v in sorted(call.request_headers.items()):
            lines.append(f"  {k}: {v}")
        if call.response_headers:
            lines.append("RESPONSE_HEADERS:")
            for k, v in sorted(call.response_headers.items()):
                lines.append(f"  {k}: {v}")
        if call.response_preview:
            lines.append(f"RESPONSE_PREVIEW: {call.response_preview.replace(chr(10), ' ')}")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


async def main() -> None:
    captured: list[CapturedCall] = []
    notes: list[str] = []

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

        base_url, resolve_notes = await resolve_base_url(page)
        notes.extend(resolve_notes)
        print(f"Using base URL: {base_url}")

        for path, label in PAGES_TO_PROBE:
            await capture_page(page, base_url, path, label, captured)

        ec_refs = await find_ec_references(page, base_url)
        if ec_refs:
            notes.append(f"Found {len(ec_refs)} EC-related UI references on landing page.")
            for ref in ec_refs[:5]:
                notes.append(f"  EC ref: text='{ref.get('text','')}' href='{ref.get('href','')}'")
        else:
            notes.append("No EC-related links found in landing page DOM.")

        # Probe any absolute EC href discovered (page load only)
        probed_ec_paths: set[str] = set()
        for ref in ec_refs:
            href = ref.get("href") or ""
            if not href or href.startswith("mailto:") or href.startswith("#"):
                continue
            parsed = urlparse(href)
            if parsed.netloc and parsed.netloc.endswith("karnataka.gov.in"):
                path = parsed.path or "/"
                if path not in probed_ec_paths:
                    probed_ec_paths.add(path)
                    label = f"EC page: {ref.get('text', path)}"
                    await capture_page(
                        page, f"{parsed.scheme}://{parsed.netloc}", path, label, captured
                    )

        # Open property valuation panel (single click — no form/dropdown interaction)
        await page.goto(f"{base_url}/landing-page", wait_until="networkidle")
        pending: dict[str, CapturedCall] = {}

        def on_request_valuation(request: Request) -> None:
            if not is_api_request(request):
                return
            pending[request.url + request.method] = CapturedCall(
                page_label="Property valuation panel open",
                url=request.url,
                method=request.method,
                status=None,
                request_headers=header_subset(request.headers),
                resource_type=request.resource_type,
                post_data=request.post_data,
            )

        async def on_response_valuation(response: Response) -> None:
            request = response.request
            if not is_api_request(request):
                return
            key = request.url + request.method
            call = pending.pop(
                key,
                CapturedCall(
                    page_label="Property valuation panel open",
                    url=request.url,
                    method=request.method,
                    status=None,
                    request_headers=header_subset(request.headers),
                    resource_type=request.resource_type,
                    post_data=request.post_data,
                ),
            )
            call.status = response.status
            call.response_headers = header_subset(response.headers)
            try:
                ct = response.headers.get("content-type", "")
                if "json" in ct or "text" in ct:
                    body = await response.text()
                    call.response_preview = body[:500] if body else None
            except Exception:
                pass
            captured.append(call)

        page.on("request", on_request_valuation)
        page.on("response", on_response_valuation)
        try:
            await page.get_by_text("KNOW YOUR PROPERTY VALUATION", exact=False).first.click()
            await page.wait_for_timeout(4000)
            notes.append(
                "Property valuation panel opened via click; captured its XHR/fetch calls."
            )
        except Exception as exc:
            notes.append(f"Could not open property valuation panel: {exc}")
        finally:
            page.remove_listener("request", on_request_valuation)
            page.remove_listener("response", on_response_valuation)

        # EC search is behind login — document DOM finding only
        ec_options = await page.eval_on_selector_all(
            "option",
            "els => els.map(e => ({text: e.textContent.trim(), value: e.value}))",
        )
        ec_login_options = [
            o
            for o in ec_options
            if o.get("value") == "EC" or o.get("text", "").strip().lower() == "ec search"
        ]
        if ec_login_options:
            notes.append(
                "EC Search is a post-login service option (not a public page). "
                f"Login service dropdown: {ec_login_options[0]}"
            )
        notes.append(
            "Dedicated EC routes (/ec-search, /guest/ec-search, etc.) all serve the "
            "same SPA shell — no EC-specific public API calls on load."
        )
        notes.append(
            "Transaction-level APIs (FetchMarketandFeeData, GetRegisteredDocumentCount, "
            "GetValuationData) require Authorization token — not exposed on public load."
        )

        await browser.close()

    api_calls = dedupe_calls([c for c in captured if "/api/" in c.url.lower()])
    if not api_calls:
        api_calls = dedupe_calls(captured)

    out_path = "/Users/adityasingh/Real estate/api_endpoints.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(format_output(base_url, api_calls, notes))

    print(f"\nSaved {len(api_calls)} endpoints to {out_path}")
    for call in api_calls:
        print(f"  {call.method} {call.status} {call.endpoint}")


if __name__ == "__main__":
    asyncio.run(main())
