from __future__ import annotations

import logging

from playwright.async_api import async_playwright
logger = logging.getLogger(__name__)


async def build_patient_dashboard_pdf_from_url(url: str) -> bytes:
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )

            context = await browser.new_context()
            page = await context.new_page()

            # 👉 Load your frontend print URL
            await page.goto(url, wait_until="networkidle")

            # ✅ Wait for charts to render (IMPORTANT)
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(5000)        # small buffer

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

            await browser.close()
            return pdf_bytes

    except Exception as e:
        logger.error(f"Playwright PDF failed: {str(e)}")
        raise

