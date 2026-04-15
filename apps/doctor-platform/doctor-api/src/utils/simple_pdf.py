from __future__ import annotations

import logging

from playwright.async_api import Error as PlaywrightError, TimeoutError as PlaywrightTimeoutError, async_playwright

from core.config import settings
logger = logging.getLogger(__name__)


async def build_patient_dashboard_pdf_from_url(url: str) -> bytes:
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )

            context = await browser.new_context(
                # Non-production environments may use self-signed or mismatched certs.
                # This prevents fax generation from failing on cert chain issues.
                ignore_https_errors=not settings.is_production,
            )
            page = await context.new_page()

            # Load page with a practical wait strategy.
            # `networkidle` is often too strict for SPAs with background calls.
            await page.goto(url, wait_until="domcontentloaded", timeout=60_000)

            # Try to wait for network to settle, but continue if it never reaches idle.
            try:
                await page.wait_for_load_state("networkidle", timeout=15_000)
            except PlaywrightTimeoutError:
                logger.warning("Playwright networkidle timeout; continuing PDF render for url=%s", url)
            await page.wait_for_timeout(2000)

            # 🧼 Optional: remove unwanted UI (if any)
            await page.add_style_tag(content="""
                button, nav, header, footer {
                    display: none !important;
                }
                body {
                    margin: 0;
                }
            """)

            # 🖨️ Generate PDF
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={
                    "top": "10mm",
                    "bottom": "10mm",
                    "left": "10mm",
                    "right": "10mm"
                }
            )

            await context.close()
            await browser.close()
            return pdf_bytes

    except (PlaywrightError, PlaywrightTimeoutError) as e:
        logger.error("Playwright PDF failed for url=%s error=%s", url, str(e))
        raise
    except Exception as e:
        logger.exception("Unexpected PDF generation failure for url=%s error=%s", url, str(e))
        raise

