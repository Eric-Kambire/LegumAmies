"""Capture real browser screenshots of the deployed Légume'Ami PWA.

Uses Playwright driving the system Google Chrome (channel='chrome', no download).
Screenshots are saved under reports/ux-audit/screenshots/.
"""
from __future__ import annotations
import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "https://team-testing.doxhuwpoc3ctn.amplifyapp.com/"
OUT = Path(__file__).resolve().parent / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = {
    "iphone_375x812": (375, 812, 3),
    "iphone_390x844": (390, 844, 3),
    "ipad_768x1024": (768, 1024, 2),
    "laptop_1366x768": (1366, 768, 1),
    "desktop_1920x1080": (1920, 1080, 1),
}
# Tab labels in AppleTabBar / DesktopNavBar
TABS = ["Accueil", "Carte", "Parcelles", "Analyses", "Alertes"]


def shoot(page, name, full=False):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print("saved", name)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True,
                                    args=["--no-sandbox", "--disable-dev-shm-usage"])
        # 1) Each viewport: landing screenshot
        for vp, (w, h, dsf) in VIEWPORTS.items():
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=dsf)
            page = ctx.new_page()
            try:
                page.goto(URL, wait_until="load", timeout=45000)
                page.wait_for_timeout(4500)
                shoot(page, f"landing_{vp}")
            except Exception as e:
                print("ERR landing", vp, repr(e)[:120])
            ctx.close()

        # 2) Mobile 390x844: walk the 5 destinations
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3)
        page = ctx.new_page()
        try:
            page.goto(URL, wait_until="load", timeout=45000)
            page.wait_for_timeout(4000)
            for i, tab in enumerate(TABS, 1):
                try:
                    page.get_by_text(tab, exact=True).first.click(timeout=6000)
                    page.wait_for_timeout(3000)
                    shoot(page, f"tab_{i}_{tab.lower()}")
                except Exception as e:
                    print("ERR tab", tab, repr(e)[:120])
        except Exception as e:
            print("ERR tabwalk", repr(e)[:120])
        ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
