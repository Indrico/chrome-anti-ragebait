const path = require('node:path');
const { test, expect, chromium } = require('@playwright/test');

const extension = path.resolve(__dirname, '../extension');
const blockedText = 'Lu emang clown. Cry harder.';
const normalText = 'Saya tidak setuju dengan hasil survei karena sampelnya kecil.';
const makePost = (id, body, quote = '', statusId = null) =>
  `<div data-testid="cellInnerDiv" id="${id}">
    <article data-testid="tweet">
      <div data-testid="tweetText" lang="id">${body}</div>
      ${quote ? `<div role="link">
        <a href="/kutipan/status/999"><time>Hari ini</time></a>
        <div data-testid="tweetText" lang="id">${quote}</div>
      </div>` : ''}
      <button type="button">Suka</button>
      ${statusId ? `<a href="/${id}/status/${statusId}"><time>Hari ini</time></a>` : ''}
    </article>
  </div>`;

const fixture = `<!doctype html><html lang="id">
  <head><meta charset="utf-8"><title>Timeline</title></head>
  <body>
    <button type="button" id="before">Sebelum feed</button>
    <main data-testid="primaryColumn">
      <div id="timeline">
        ${makePost('blocked', blockedText, '', 101)}
        <script>
          const firstPost = document.querySelector('#blocked article');
          window.initialPostVisibility = getComputedStyle(firstPost).visibility;
        </script>
        ${makePost('normal', normalText, '', 102)}
        ${makePost('quoted', normalText, 'Ayo ribut di kolom komentar.', 103)}
        ${makePost('politics', 'KPU mengumumkan jadwal pilkada.', '', 104)}
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

async function openPopup() {
  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  const item = manager.locator('extensions-item').filter({ hasText: 'Chrome Anti-Ragebait' });
  const id = await item.getAttribute('id');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await manager.close();
  return popup;
}

test('filter aktif sejak pertama dibuka dan kartu terjaring tidak menerima interaksi', async () => {
  const page = await context.newPage();
  await page.goto('https://x.com/home');

  expect(await page.evaluate(() => window.initialPostVisibility)).toBe('hidden');
  await expect(page.locator('#blocked')).toHaveCSS('display', 'none');
  await expect(page.locator('#quoted')).toBeHidden();
  await expect(page.locator('#politics')).toBeHidden();
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

  const popup = await openPopup();
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

test('riwayat terisi otomatis, menjelaskan alasan, dan mencatat setiap ID sekali lintas tab', async () => {
  const popup = await openPopup();
  const count = popup.locator('#blocked-count');
  const history = popup.locator('#block-history');
  await expect(count).toHaveText('0 unggahan unik diblokir');
  await expect(popup.getByText('Belum ada unggahan yang diblokir.')).toBeVisible();

  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto('https://x.com/home'), second.goto('https://x.com/home')]);
  await expect(count).toHaveText('3 unggahan unik diblokir');
  await expect(history.locator('li')).toHaveCount(3);
  await expect(history.getByText('@quoted · Ragebait', { exact: true })).toBeVisible();
  await expect(history.getByText('@kutipan', { exact: false })).toHaveCount(0);

  const politicalEntry = history.locator('details').filter({ hasText: '@politics' });
  await expect(politicalEntry.locator('summary')).toContainText('Politik (kpu)');
  await expect(politicalEntry.locator('time')).toHaveAttribute('datetime', /T/);
  await expect(politicalEntry.locator('.entry-excerpt')).toBeHidden();
  await politicalEntry.locator('summary').press('Enter');
  await expect(politicalEntry.locator('.entry-excerpt')).toBeVisible();
  await expect(politicalEntry.locator('.entry-excerpt')).toHaveText('KPU mengumumkan jadwal pilkada.');

  const html = makePost('berita', 'Catatan hari ini.', 'jadwal PILPRES diumumkan.', 105);
  await Promise.all([first, second].map((page) =>
    page.locator('#timeline').evaluate((timeline, post) => timeline.insertAdjacentHTML('beforeend', post), html),
  ));
  await expect(first.locator('#berita')).toHaveCSS('display', 'none');
  await expect(second.locator('#berita')).toHaveCSS('display', 'none');
  await expect(count).toHaveText('4 unggahan unik diblokir');
  await expect(history.getByText('@berita · Politik (pilpres)', { exact: true })).toBeVisible();
  await expect(politicalEntry.locator('.entry-excerpt')).toBeVisible();

  await Promise.all([first.reload(), second.reload(), popup.reload()]);
  await expect(first.locator('#politics')).toHaveCSS('display', 'none');
  await expect(second.locator('#politics')).toHaveCSS('display', 'none');
  await expect(count).toHaveText('4 unggahan unik diblokir');
});

test('riwayat menyimpan 50 entri terbaru tanpa mengurangi total atau menghitung ulang entri lama', async () => {
  const page = await context.newPage();
  await page.goto('https://x.com/home');
  const popup = await openPopup();
  const count = popup.locator('#blocked-count');
  const entries = popup.locator('#block-history li');
  await expect(count).toHaveText('3 unggahan unik diblokir');

  const posts = Array.from({ length: 52 }, (_, index) =>
    makePost(`akun${index}`, 'Jadwal pemilu diumumkan.', '', 200 + index),
  ).join('');
  await page.locator('#timeline').evaluate((timeline, html) => timeline.insertAdjacentHTML('beforeend', html), posts);
  await expect(count).toHaveText('55 unggahan unik diblokir');
  await expect(entries).toHaveCount(50);
  await expect(entries.filter({ hasText: '@blocked' })).toHaveCount(0);
  await expect(entries.filter({ hasText: '@akun51' })).toHaveCount(1);

  await page.reload();
  await expect(page.locator('#blocked')).toHaveCSS('display', 'none');
  await popup.reload();
  await expect(count).toHaveText('55 unggahan unik diblokir');
  await expect(entries).toHaveCount(50);
});
