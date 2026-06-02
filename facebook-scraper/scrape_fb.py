#!/usr/bin/env python3
"""
Facebook Comment Scraper

Setup (run once):
  pip install playwright
  playwright install chromium
  python scrape_fb.py --setup

Scrape a post:
  python scrape_fb.py "https://www.facebook.com/..."
"""

import asyncio
import csv
import json
import sys
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / "fb_session.json"


async def setup_session():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("https://www.facebook.com/")

        print("\nA browser window has opened.")
        print("Log into Facebook in the browser, then come back here and press Enter.")
        input("Press Enter when you are logged in...")

        cookies = await context.cookies()
        SESSION_FILE.write_text(json.dumps(cookies, indent=2))
        await browser.close()

        print(f"\nSession saved to fb_session.json")
        print('You can now run:  python scrape_fb.py "<post-url>"')


async def load_all_comments(page):
    """Click 'Load more comments' repeatedly until no more appear."""
    clicks = 0
    for _ in range(100):
        try:
            btn = page.locator("text=/more comments/i").first
            if await btn.is_visible(timeout=3000):
                await btn.scroll_into_view_if_needed()
                await btn.click()
                await page.wait_for_timeout(2000)
                clicks += 1
                print(f"  Loading comments... ({clicks} batches)", end="\r")
            else:
                break
        except Exception:
            break
    if clicks:
        print(f"  Loading comments... ({clicks} batches total)    ")


async def expand_all_replies(page):
    """Click every 'View X replies' link until none remain."""
    for _ in range(50):
        try:
            buttons = await page.locator("text=/\\d+ repl/i").all()
            expanded_any = False
            for btn in buttons:
                try:
                    if await btn.is_visible():
                        await btn.scroll_into_view_if_needed()
                        await btn.click()
                        await page.wait_for_timeout(1000)
                        expanded_any = True
                except Exception:
                    continue
            if not expanded_any:
                break
        except Exception:
            break


async def extract_comments(page, post_url):
    """
    Run JavaScript inside the loaded page to pull comment data out of the DOM.
    Uses data-commentid attributes which are more stable than Facebook's generated class names.
    """
    data = await page.evaluate("""() => {
        const out = [];

        for (const el of document.querySelectorAll('[data-commentid]')) {
            // Author — first link with role=link inside this comment element
            const authorEl = el.querySelector('a[role="link"]');
            const author = authorEl ? authorEl.innerText.trim() : '';

            // Comment text — first non-empty div[dir=auto] that isn't just the author's name
            let commentText = '';
            for (const div of el.querySelectorAll('div[dir="auto"]')) {
                const t = div.innerText.trim();
                if (t && t !== author) {
                    commentText = t;
                    break;
                }
            }

            // Timestamp — look for an aria-label on a link that contains a digit
            let timestamp = '';
            for (const a of el.querySelectorAll('a[aria-label]')) {
                const lbl = a.getAttribute('aria-label') || '';
                if (lbl && /\\d/.test(lbl)) {
                    timestamp = lbl;
                    break;
                }
            }
            if (!timestamp) {
                const abbr = el.querySelector('abbr[title]');
                if (abbr) timestamp = abbr.getAttribute('title') || '';
            }

            // Like / reaction count
            let likes = '0';
            for (const span of el.querySelectorAll('[aria-label]')) {
                const lbl = span.getAttribute('aria-label') || '';
                if (/reaction|like/i.test(lbl)) {
                    const m = lbl.match(/\\d+/);
                    if (m) { likes = m[0]; break; }
                }
            }

            // Is this a reply? Replies are nested inside another [data-commentid] element
            const parentComment = el.parentElement
                ? el.parentElement.closest('[data-commentid]')
                : null;
            const isReply = !!(parentComment && parentComment !== el);
            let replyTo = '';
            if (isReply) {
                const pAuthor = parentComment.querySelector('a[role="link"]');
                replyTo = pAuthor ? pAuthor.innerText.trim() : '';
            }

            if (author || commentText) {
                out.push({ author, commentText, timestamp, likes, isReply, replyTo });
            }
        }

        return out;
    }""")

    for item in data:
        item['post_url'] = post_url

    return data


async def scrape(url):
    if not SESSION_FILE.exists():
        print("No session found. Run setup first:")
        print("  python scrape_fb.py --setup")
        sys.exit(1)

    cookies = json.loads(SESSION_FILE.read_text())

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        await context.add_cookies(cookies)
        page = await context.new_page()

        print("Opening post...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        if "login" in page.url and "facebook.com" in page.url:
            print("\nSession expired — run --setup again to log in.")
            await browser.close()
            sys.exit(1)

        print("Loading all comments (may take a moment)...")
        await load_all_comments(page)

        print("Expanding replies...")
        await expand_all_replies(page)

        print("Extracting data...")
        comments = await extract_comments(page, url)
        await browser.close()

    if not comments:
        print("\nNo comments found.")
        print("Possible reasons:")
        print("  - The post is private or requires a friend connection to view comments")
        print("  - Facebook has changed its page layout (update the selectors in extract_comments)")
        return

    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    out_file = SCRIPT_DIR / f"comments_{ts}.csv"

    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "author", "comment_text", "timestamp", "likes",
            "is_reply", "reply_to", "post_url"
        ])
        writer.writeheader()
        for c in comments:
            writer.writerow({
                "author": c["author"],
                "comment_text": c["commentText"],
                "timestamp": c["timestamp"],
                "likes": c["likes"],
                "is_reply": c["isReply"],
                "reply_to": c["replyTo"],
                "post_url": c["post_url"],
            })

    print(f"\nSaved {len(comments)} comments to {out_file.name}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if "--help" in sys.argv else 1)

    if sys.argv[1] == "--setup":
        asyncio.run(setup_session())
    else:
        asyncio.run(scrape(sys.argv[1]))


if __name__ == "__main__":
    main()
