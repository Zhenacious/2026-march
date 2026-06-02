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
  let clicks = 0;
  for (let i = 0; i < 100; i++) {
    try {
      const btn = page.locator('text=/more comments/i').first();
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        await page.waitForTimeout(2000);
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
  for (let i = 0; i < 50; i++) {
    const buttons = await page.locator('text=/\\d+ repl/i').all();
    let expandedAny = false;
    for (const btn of buttons) {
      try {
        if (await btn.isVisible()) {
          await btn.scrollIntoViewIfNeeded();
          await btn.click();
          await page.waitForTimeout(1000);
          expandedAny = true;
        }
      } catch { /* skip */ }
    }
    if (!expandedAny) break;
  }
}

async function extractComments(page, postUrl) {
  const data = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[data-commentid]')) {
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
        out.push({ author, commentText, ts, likes, isReply, replyTo });
      }
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

  console.log('Loading all comments (may take a moment)...');
  await loadAllComments(page);

  console.log('Expanding replies...');
  await expandAllReplies(page);

  console.log('Extracting data...');
  const comments = await extractComments(page, url);
  await browser.close();

  if (!comments.length) {
    console.log('\nNo comments found.');
    console.log('Possible reasons:');
    console.log('  - The post is private or requires login to see comments');
    console.log('  - Facebook changed its layout (update selectors in extractComments)');
    return;
  }

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
