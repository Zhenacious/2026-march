#!/usr/bin/env node
/**
 * Facebook Comment Scraper
 *
 * Setup (run once):
 *   npm install
 *   npx playwright install chromium
 *   node scrape_fb.js --setup
 *
 * Scrape a post:
 *   node scrape_fb.js "https://www.facebook.com/..."
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SCRIPT_DIR = __dirname;
const SESSION_FILE = path.join(SCRIPT_DIR, 'fb_session.json');

function waitForEnter(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function setupSession() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.facebook.com/');

  console.log('\nA browser window has opened.');
  console.log('Log into Facebook in the browser, then come back here and press Enter.');
  await waitForEnter('Press Enter when you are logged in... ');

  const cookies = await context.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  await browser.close();

  console.log('\nSession saved to fb_session.json');
  console.log('You can now run:  node scrape_fb.js "<post-url>"');
}

async function loadAllComments(page) {
  // Regular posts: click "View more comments" until it disappears
  let clicks = 0;
  for (let i = 0; i < 100; i++) {
    try {
      const btn = page.locator('text=/more comments/i').first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        await page.waitForTimeout(700);
        clicks++;
        process.stdout.write(`  Loading comments... (${clicks} batches)\r`);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  if (clicks) console.log(`  Loading comments... (${clicks} batches total)    `);
}

async function expandAllReplies(page) {
  // Multiple passes: after clicking replies, new "View more replies" buttons can appear
  for (let pass = 0; pass < 10; pass++) {
    const buttons = await page.locator('text=/repl/i').all();
    let expandedAny = false;
    for (const btn of buttons) {
      try {
        const label = await btn.textContent();
        // Only click actual reply expansion buttons, not comment reply links
        if (label && /\d+\s*repl/i.test(label)) {
          await btn.scrollIntoViewIfNeeded();
          await btn.click();
          await page.waitForTimeout(400);
          expandedAny = true;
        }
      } catch { /* skip */ }
    }
    if (!expandedAny) break;
  }
}

async function openReelComments(page) {
  try {
    const btn = page.locator('[aria-label="Comment"]').first();
    if (await btn.isVisible({ timeout: 3000 })) {
      console.log('  Reel detected — opening comment panel...');
      await btn.click();
      await page.waitForTimeout(2000);
      return true;
    }
  } catch { /* not a reel */ }
  return false;
}

async function getTotalCommentCount(page) {
  try {
    const text = await page.locator('text=/of \\d+ comment/i').first().textContent({ timeout: 2000 });
    const m = text.match(/of (\d+)/i);
    return m ? parseInt(m[1]) : null;
  } catch {
    return null;
  }
}

// Scroll using mouse wheel. For reels the panel is on the right; for posts scroll the centre.
async function scrollPanel(page, isReel) {
  const vp = page.viewportSize() || { width: 1280, height: 720 };
  const x = isReel ? vp.width * 0.75 : vp.width * 0.5;
  await page.mouse.move(x, vp.height * 0.5);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(800);
}

// Click "View more comments" if visible. Returns true if clicked.
async function clickMoreComments(page) {
  try {
    const btn = page.locator('text=/more comments/i').first();
    if (await btn.isVisible({ timeout: 800 })) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(900);
      return true;
    }
  } catch { /* not found */ }
  return false;
}

// Click all visible "X replies" buttons. Returns count clicked.
async function clickReplyButtons(page) {
  let clicked = 0;
  const btns = await page.locator('text=/repl/i').all();
  for (const btn of btns) {
    try {
      const label = await btn.textContent();
      if (label && /\d+\s*repl/i.test(label) && await btn.isVisible()) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        await page.waitForTimeout(500);
        clicked++;
      }
    } catch { /* skip */ }
  }
  return clicked;
}

async function loadAllContent(page, isReel) {
  const total = await getTotalCommentCount(page);
  if (total) console.log(`  Target: ${total} comments`);

  // Phase 1: load all top-level comments via button clicks + scrolling
  console.log('  Phase 1: loading all comments...');
  let lastCount = -1;
  let stale = 0;
  for (let i = 0; i < 200; i++) {
    const count = await page.evaluate(() =>
      Math.max(
        document.querySelectorAll('[role="article"]').length,
        document.querySelectorAll('[data-commentid]').length
      )
    );
    process.stdout.write(`  ${count}${total ? '/' + total : ''} loaded\r`);
    if (total && count >= total) break;
    if (count === lastCount) { stale++; if (stale >= 5) break; } else { stale = 0; lastCount = count; }

    const btnClicked = await clickMoreComments(page);
    if (!btnClicked) await scrollPanel(page, isReel);
  }
  const p1 = await page.evaluate(() =>
    Math.max(document.querySelectorAll('[role="article"]').length, document.querySelectorAll('[data-commentid]').length)
  );
  console.log(`  Phase 1 done: ${p1} loaded.    `);

  // Phase 2: expand all reply threads
  console.log('  Phase 2: expanding replies...');
  for (let pass = 1; pass <= 15; pass++) {
    const clicked = await clickReplyButtons(page);
    if (clicked === 0) break;
    console.log(`  Reply pass ${pass}: ${clicked} threads opened`);
    await page.waitForTimeout(400);
  }
  console.log('  Phase 2 done.');

  // Phase 3: final sweep — replies may have surfaced more "View more comments"
  console.log('  Phase 3: final sweep...');
  let extra = 0;
  for (let i = 0; i < 30; i++) {
    if (!await clickMoreComments(page)) break;
    extra++;
  }
  await clickReplyButtons(page);
  const final = await page.evaluate(() =>
    Math.max(document.querySelectorAll('[role="article"]').length, document.querySelectorAll('[data-commentid]').length)
  );
  console.log(`  Done. ${final} total elements${extra ? `, ${extra} extra batches in final sweep` : ''}.`);
}

async function extractComments(page, postUrl) {
  const data = await page.evaluate(() => {
    const out = [];

    function parseComment(el, parentAuthor) {
      const authorEl = el.querySelector('a[role="link"]');
      const author = authorEl ? authorEl.innerText.trim() : '';

      let commentText = '';
      for (const div of el.querySelectorAll('div[dir="auto"]')) {
        const t = div.innerText.trim();
        if (t && t !== author) { commentText = t; break; }
      }

      let ts = '';
      for (const a of el.querySelectorAll('a[aria-label]')) {
        const lbl = a.getAttribute('aria-label') || '';
        if (lbl && /\d/.test(lbl)) { ts = lbl; break; }
      }
      if (!ts) {
        const abbr = el.querySelector('abbr[title]');
        if (abbr) ts = abbr.getAttribute('title') || '';
      }

      let likes = '0';
      for (const span of el.querySelectorAll('[aria-label]')) {
        const lbl = span.getAttribute('aria-label') || '';
        if (/reaction|like/i.test(lbl)) {
          const m = lbl.match(/\d+/);
          if (m) { likes = m[0]; break; }
        }
      }

      return { author, commentText, ts, likes, isReply: !!parentAuthor, replyTo: parentAuthor || '' };
    }

    // Strategy 1: data-commentid (regular posts)
    const byCommentId = document.querySelectorAll('[data-commentid]');
    if (byCommentId.length) {
      for (const el of byCommentId) {
        const parentComment = el.parentElement ? el.parentElement.closest('[data-commentid]') : null;
        const parentAuthor = (parentComment && parentComment !== el)
          ? (parentComment.querySelector('a[role="link"]') || {}).innerText || ''
          : '';
        const c = parseComment(el, parentAuthor);
        if (c.author || c.commentText) out.push(c);
      }
      return out;
    }

    // Strategy 2: role=article (reels / newer layout)
    const articles = document.querySelectorAll('[role="article"]');
    for (const el of articles) {
      // Skip the post itself (usually the first/outermost article)
      const parent = el.parentElement ? el.parentElement.closest('[role="article"]') : null;
      const c = parseComment(el, parent ? (parent.querySelector('a[role="link"]') || {}).innerText || '' : '');
      if (c.author || c.commentText) out.push(c);
    }
    return out;
  });

  return data.map(c => ({ ...c, postUrl }));
}

async function scrape(url) {
  if (!fs.existsSync(SESSION_FILE)) {
    console.log('No session found. Run setup first:\n  node scrape_fb.js --setup');
    process.exit(1);
  }

  const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  console.log('Opening post...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  if (page.url().includes('login') && page.url().includes('facebook.com')) {
    console.log('\nSession expired — run --setup again to log in.');
    await browser.close();
    process.exit(1);
  }

  const isReel = await openReelComments(page);
  console.log('Loading all comments...');
  await loadAllContent(page, isReel);

  console.log('Extracting data...');
  const comments = await extractComments(page, url);

  if (!comments.length) {
    console.log('\nNo comments found — saving debug files...');
    await page.screenshot({ path: path.join(SCRIPT_DIR, 'debug_screenshot.png'), fullPage: false });
    const html = await page.content();
    fs.writeFileSync(path.join(SCRIPT_DIR, 'debug_page.html'), html, 'utf8');
    // Log a summary of what elements exist to help diagnose
    const summary = await page.evaluate(() => ({
      dataCommentId: document.querySelectorAll('[data-commentid]').length,
      roleArticle: document.querySelectorAll('[role="article"]').length,
      dirAuto: document.querySelectorAll('[dir="auto"]').length,
    }));
    console.log(`  Elements found: data-commentid=${summary.dataCommentId}, role=article=${summary.roleArticle}, dir=auto=${summary.dirAuto}`);
    console.log('Saved debug_screenshot.png and debug_page.html');
    await browser.close();
    return;
  }

  await browser.close();

  const outFile = path.join(SCRIPT_DIR, `comments_${timestamp()}.csv`);
  const header = 'author,comment_text,timestamp,likes,is_reply,reply_to,post_url';
  const rows = comments.map(c => [
    escapeCSV(c.author),
    escapeCSV(c.commentText),
    escapeCSV(c.ts),
    escapeCSV(c.likes),
    escapeCSV(c.isReply),
    escapeCSV(c.replyTo),
    escapeCSV(c.postUrl),
  ].join(','));

  fs.writeFileSync(outFile, [header, ...rows].join('\n'), 'utf8');
  console.log(`\nSaved ${comments.length} comments to ${path.basename(outFile)}`);
}

const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.log('Usage:');
  console.log('  node scrape_fb.js --setup        # Set up Facebook login (run once)');
  console.log('  node scrape_fb.js "<url>"        # Scrape comments from a post');
  process.exit(args.length ? 0 : 1);
} else if (args[0] === '--setup') {
  setupSession().catch(e => { console.error(e); process.exit(1); });
} else {
  scrape(args[0]).catch(e => { console.error(e); process.exit(1); });
}
