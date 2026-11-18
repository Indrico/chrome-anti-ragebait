const path = require('node:path');
const { test, expect, chromium } = require('@playwright/test');

const extension = path.resolve(__dirname, '../extension');
const blockedText = 'Lu emang clown. Cry harder.';
const normalText = 'Saya tidak setuju dengan hasil survei karena sampelnya kecil.';
const makePost = (id, body, quote = '') =>
  `<div data-testid="cellInnerDiv" id="${id}">
    <article data-testid="tweet">
      <div data-testid="tweetText" lang="id">${body}</div>
      ${quote ? `<div role="link"><div data-testid="tweetText" lang="id">${quote}</div></div>` : ''}
      <button type="button">Suka</button>
    </article>
  </div>`;

const fixture = `<!doctype html><html lang="id">
  <head><meta charset="utf-8"><title>Timeline</title></head>
  <body>
    <button type="button" id="before">Sebelum feed</button>
    <main data-testid="primaryColumn">
      <div id="timeline">
        ${makePost('blocked', blockedText)}
        <script>
          const firstPost = document.querySelector('#blocked article');
          window.initialPostVisibility = getComputedStyle(firstPost).visibility;
        </script>
        ${makePost('normal', normalText)}
        ${makePost('quoted', normalText, 'Ayo ribut di kolom komentar.')}
        <div data-testid="cellInnerDiv" id="unknown"><article>Struktur alternatif</article></div>
        <div data-testid="cellInnerDiv" id="multiple">
          <article data-testid="tweet"><div data-testid="tweetText" lang="id">${blockedText}</div></article>
          <article data-testid="tweet"><div data-testid="tweetText" lang="id">${normalText}</div></article>
        </div>
      </div>
      <div style="height: 1400px"></div>
    </main>
    <aside>${makePost('sidebar', blockedText)}</aside>
    <script>
      window.events = [];
      document.addEventListener('click', (event) => {
        if (event.target.matches('article button')) {
          window.events.push(event.target.closest('[data-testid="cellInnerDiv"]').id);
        }
      });
    </script>
  </body></html>`;

let context;
test.beforeEach(async () => {
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: { width: 900, height: 700 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.route('https://x.com/**', (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: fixture,
  }));
});

test.afterEach(async () => {
  await context?.close();
});

test('filter aktif sejak pertama dibuka dan kartu terjaring tidak menerima interaksi', async () => {
  const page = await context.newPage();
  await page.goto('https://x.com/home');

  expect(await page.evaluate(() => window.initialPostVisibility)).toBe('hidden');
  await expect(page.locator('#blocked')).toHaveCSS('display', 'none');
  await expect(page.locator('#quoted')).toBeHidden();
  await expect(page.locator('#normal')).toBeVisible();
  await expect(page.locator('#unknown')).toBeVisible();
  await expect(page.locator('#multiple')).toBeVisible();
  await expect(page.locator('#sidebar')).toBeVisible();

  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#normal button')).toBeFocused();
  await page.locator('#blocked button').evaluate((button) => button.focus());
  await expect(page.locator('#normal button')).toBeFocused();
  await expect(page.locator('#blocked button').click({ timeout: 300 })).rejects.toThrow(/Timeout/);
  await expect(page.locator('#normal button')).toBeEnabled();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.events)).toEqual(['normal']);
});

test('kartu baru dan kartu daur ulang diperiksa saat scroll', async () => {
  const page = await context.newPage();
  await page.goto('https://x.com/home');
  await expect(page.locator('#normal')).toBeVisible();
  await page.evaluate((post) => {
    window.addEventListener('scroll', () => {
      document.querySelector('#timeline').insertAdjacentHTML('beforeend', post);
    }, { once: true });
    window.scrollTo(0, 600);
  }, makePost('appended', 'Ayo ribut di reply.'));
  await expect(page.locator('#appended')).toHaveCSS('display', 'none');
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const recycled = page.locator('#normal [data-testid="tweetText"]');
  await recycled.evaluate((text, value) => { text.firstChild.data = value; }, blockedText);
  await expect(page.locator('#normal')).toHaveCSS('display', 'none');
  await recycled.evaluate((text, value) => { text.textContent = value; }, normalText);
  await expect(page.locator('#normal')).toBeVisible();

  await page.locator('#unknown article').evaluate((article, value) => {
    article.setAttribute('data-testid', 'tweet');
    const body = document.createElement('div');
    body.textContent = value;
    article.replaceChildren(body);
  }, blockedText);
  await expect(page.locator('#unknown')).toBeVisible();
  await page.locator('#unknown article div').evaluate((body) => {
    body.setAttribute('data-testid', 'tweetText');
  });
  await expect(page.locator('#unknown')).toHaveCSS('display', 'none');
});

test('navigasi tanpa muat ulang membatasi filter ke Beranda', async () => {
  const page = await context.newPage();
  await page.goto('https://x.com/akun/status/1');
  await expect(page.locator('#blocked')).toBeVisible();
  await page.evaluate(() => history.pushState({}, '', '/home'));
  await expect(page.locator('#blocked')).toHaveCSS('display', 'none');
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL('https://x.com/akun/status/1');
  await expect(page.locator('#blocked')).toBeVisible();
});

test('sakelar popup berlaku di semua tab dan bertahan setelah halaman dimuat ulang', async () => {
  const home = await context.newPage();
  const otherHome = await context.newPage();
  await Promise.all([
    home.goto('https://x.com/home'),
    otherHome.goto('https://x.com/home/'),
  ]);
  await expect(home.locator('#blocked')).toHaveCSS('display', 'none');
  await expect(otherHome.locator('#blocked')).toHaveCSS('display', 'none');

  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  const extensionItem = manager.locator('extensions-item').filter({ hasText: 'Chrome Anti-Ragebait' });
  const id = await extensionItem.getAttribute('id');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  const toggle = popup.getByRole('switch', { name: 'Saring Beranda X' });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(home.locator('#blocked')).toBeVisible();
  await expect(otherHome.locator('#blocked')).toBeVisible();

  await home.reload();
  await popup.reload();
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
  await expect(home.locator('#blocked')).toBeVisible();
  await toggle.check();
  await expect(home.locator('#blocked')).toHaveCSS('display', 'none');
  await expect(otherHome.locator('#blocked')).toHaveCSS('display', 'none');
});
