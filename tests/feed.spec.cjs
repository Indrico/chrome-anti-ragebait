const path = require('node:path');
const { createHash } = require('node:crypto');
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

const metaSites = [
  {
    name: 'Facebook', host: 'www.facebook.com', search: '/search/posts/?q=goblok', unsupported: '/messages/t/4',
    card: (name, text, id, { search, quote, comment } = {}) => `
      <div role="article" id="${name}">
        <header><strong>${name}</strong></header>
        <a href="${search ? '/permalink.php?story_fbid=' + id + '&id=75' : '/' + name + '/posts/' + id}"><time>Hari ini</time></a>
        <div data-ad-comet-preview="message" data-test-body>${text}</div>
        ${quote ? `<blockquote><div role="article"><div data-ad-preview="message" data-test-quote>${quote}</div></div></blockquote>` : ''}
        ${comment ? `<div data-testid="comments"><div role="article"><div data-ad-preview="message">${comment}</div></div></div>` : ''}
        <button type="button">Suka</button>
      </div>`,
  },
  {
    name: 'Instagram', host: 'www.instagram.com', search: '/explore/search/keyword/?q=goblok', unsupported: '/direct/inbox/',
    card: (name, text, id, { search, comment } = {}) => search
      ? `<a id="${name}" href="/${name}/p/${id}/"><figure><img alt="Foto"><figcaption data-test-body>${text}</figcaption></figure></a>`
      : `<article id="${name}">
        <header><a href="/${name}/">${name}</a><a href="/p/${id}/"><time>Hari ini</time></a></header>
        <div><h2><a href="/${name}/">${name}</a></h2><span dir="auto" data-test-body>${text}</span></div>
        ${comment ? `<ul data-testid="comments"><li><span dir="auto">${comment}</span></li></ul>` : ''}
        <button type="button">Suka</button>
      </article>`,
  },
  {
    name: 'Threads', host: 'www.threads.com', search: '/search?q=goblok', unsupported: '/@contoh/post/101',
    card: (name, text, id, { quote, comment } = {}) => `
      <div data-pressable-container="true" id="${name}">
        <a href="/@${name}"><span dir="auto">${name}</span></a>
        <a href="/@${name}/post/${id}?xmt=demo"><time>Hari ini</time></a>
        <div dir="auto" data-test-body>${text}</div>
        ${quote ? `<blockquote><div data-pressable-container="true"><a href="/@kutipan/post/909"><time>Hari ini</time></a><div dir="auto" data-test-quote>${quote}</div></div></blockquote>` : ''}
        ${comment ? `<div data-testid="comments"><div dir="auto">${comment}</div></div>` : ''}
        <button type="button">Suka</button>
      </div>`,
  },
];

async function openMetaPage(site, pathname = '/') {
  const origin = `https://${site.host}`;
  const page = await context.newPage();
  await page.route(`${origin}/**`, (route) => {
    const search = new URL(route.request().url()).pathname === new URL(site.search, origin).pathname;
    const fixture = `<!doctype html><html lang="id"><body>
      <nav><input aria-label="Cari" value="goblok"></nav>
      <main><div id="meta-feed" role="feed">
        ${site.card('kata', 'Goblok!', '101', { search })}
        ${site.card('politik', 'Jokowi datang.', '104', { search })}
        ${site.card('bait', blockedText, '107', { search })}
        ${site.card('biasa', 'Catatan kegiatan hari ini.', '108', { search, comment: 'goblok' })}
        ${site.card('tanpaTeks', '', '109', { search })}
      </div><div style="height: 1400px"></div></main>
      <aside>${site.card('samping', 'goblok', '201')}</aside>
      <div role="dialog">${site.card('pesan', 'goblok', '202')}</div>
      </body></html>`;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture });
  });
  await page.goto(origin + pathname);
  return page;
}

for (const site of metaSites) {
  test(`${site.name} memakai filter Beranda dan pencarian pada kartu yang dikenali`, async () => {
    const page = await openMetaPage(site);
    for (const id of ['kata', 'politik', 'bait']) {
      await expect(page.locator(`#${id}`)).toHaveCSS('display', 'none');
    }
    for (const id of ['biasa', 'tanpaTeks', 'samping', 'pesan']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator('#tanpaTeks')).not.toHaveAttribute('data-anti-ragebait-state');
    await expect(page.getByRole('textbox', { name: 'Cari' })).toHaveValue('goblok');

    const latePost = site.card('scrollPost', 'Goblok!', '212');
    await page.evaluate((html) => {
      window.addEventListener('scroll', () => {
        document.querySelector('#meta-feed').insertAdjacentHTML('beforeend', html);
      }, { once: true });
      window.scrollTo(0, 500);
    }, latePost);
    await expect(page.locator('#scrollPost')).toHaveCSS('display', 'none');
    await page.locator('#tanpaTeks [data-test-body]').evaluate((body) => { body.textContent = 'Goblok!'; });
    await expect(page.locator('#tanpaTeks')).toHaveCSS('display', 'none');
    await page.locator('#scrollPost [data-test-body]').evaluate((body) => { body.textContent = 'Agenda hari ini.'; });
    await expect(page.locator('#scrollPost')).toBeVisible();

    if (site.name !== 'Instagram') {
      await page.locator('#meta-feed').evaluate((feed, html) => feed.insertAdjacentHTML('beforeend', html),
        site.card('kutipan', 'Agenda hari ini.', '220', { quote: 'Catatan tambahan.' }));
      await expect(page.locator('#kutipan')).toBeVisible();
      await page.locator('#kutipan [data-test-quote]').evaluate((text) => { text.textContent = 'Goblok!'; });
      await expect(page.locator('#kutipan')).toHaveCSS('display', 'none');
    }

    await page.evaluate((path) => history.pushState({}, '', path), site.search);
    await expect(page.locator('#politik')).toBeVisible();
    await expect(page.locator('#bait')).toBeVisible();
    await expect(page.locator('#kata')).toHaveCSS('display', 'none');
    const search = await openMetaPage(site, site.search);
    await expect(search.locator('#kata')).toHaveCSS('display', 'none');
    await expect(search.locator('#politik')).toBeVisible();
    await expect(search.locator('#biasa')).toBeVisible();
    await expect(search.getByRole('textbox', { name: 'Cari' })).toHaveValue('goblok');

    await page.evaluate((path) => history.pushState({}, '', path), site.unsupported);
    await expect(page.locator('#kata')).toBeVisible();
    const outside = await openMetaPage(site, site.unsupported);
    await expect(outside.locator('#kata')).toBeVisible();
    await expect(outside.locator('#kata')).not.toHaveAttribute('data-anti-ragebait-state');
  });
}

test('riwayat dan sakelar gabungan kompatibel dengan data X lama', async () => {
  const popup = await openPopup();
  const count = popup.locator('#blocked-count');
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await expect(count).toHaveText('0 unggahan unik diblokir');
  const legacyFallback = 'Goblok! Berkas arsip.';
  const legacyHash = createHash('sha256').update(legacyFallback.toLowerCase()).digest('hex');
  await worker.evaluate(async (hash) => {
    await withBlockHistory('readwrite', async (store) => {
      const record = { author: 'arsip', reason: 'profanity', term: 'goblok', excerpt: 'Goblok!', blockedAt: 1 };
      await requestResult(store.add({ ...record, key: 'x:101' }));
      await requestResult(store.add({ ...record, key: 'text:' + hash }));
    });
    refreshBadge();
  }, legacyHash);
  await popup.reload();
  await expect(count).toHaveText('2 unggahan unik diblokir');
  await expect(popup.locator('.entry-site')).toHaveText(['X', 'X']);

  const x = await context.newPage();
  await x.goto('https://x.com/home');
  await x.locator('#timeline').evaluate((feed, html) => feed.insertAdjacentHTML('beforeend', html),
    makePost('arsip', legacyFallback));
  await expect(x.locator('#arsip')).toHaveCSS('display', 'none');
  const homes = await Promise.all(metaSites.map((site) => openMetaPage(site)));
  const searches = await Promise.all(metaSites.map((site) => openMetaPage(site, site.search)));
  for (const page of [...homes, ...searches]) {
    await expect(page.locator('#kata')).toHaveCSS('display', 'none');
  }
  await expect(count).toHaveText('13 unggahan unik diblokir');
  await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('13');
  for (const site of ['X', ...metaSites.map(({ name }) => name)]) {
    await expect(popup.locator('.entry-site').filter({ hasText: new RegExp(`^${site}$`) }).first()).toBeVisible();
  }

  await popup.getByRole('switch', { name: 'Blokir politik di Beranda' }).uncheck();
  for (const page of homes) {
    await expect(page.locator('#politik')).toBeVisible();
    await expect(page.locator('#bait')).toHaveCSS('display', 'none');
  }
  await expect(x.locator('#politics')).toBeVisible();
  const master = popup.getByRole('switch', { name: 'Saring unggahan' });
  await master.uncheck();
  for (const page of [...homes, ...searches]) await expect(page.locator('#kata')).toBeVisible();
  await expect(x.locator('#blocked')).toBeVisible();
  await master.check();
  for (const page of [...homes, ...searches]) await expect(page.locator('#kata')).toHaveCSS('display', 'none');
  await expect(count).toHaveText('13 unggahan unik diblokir');
});

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

test('navigasi tanpa muat ulang membatasi filter Beranda di luar halaman unggahan', async () => {
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
  const toggle = popup.getByRole('switch', { name: 'Saring unggahan' });
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

test('umpatan diblokir di hasil pencarian dan Beranda serta tercatat di popup', async () => {
  const page = await context.newPage();
  const searchUrl = 'https://x.com/search?q=goblok&src=typed_query';
  const searchFixture = fixture.replace('<div id="timeline">',
    `<input aria-label="Cari di X" value="goblok">
    <div id="timeline">${makePost('umpatan', 'Goblok!', '', 106)}`,
  );
  await page.route((url) => url.pathname === '/search', (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: searchFixture,
  }));
  await page.goto(searchUrl);
  expect(await page.evaluate(() => window.initialPostVisibility)).toBe('hidden');
  await expect(page.getByRole('textbox', { name: 'Cari di X' })).toHaveValue('goblok');
  await expect(page.locator('#umpatan')).toHaveCSS('display', 'none');
  await expect(page.locator('#normal')).toBeVisible();
  await expect(page.locator('#politics')).toBeVisible();
  await expect(page.locator('#blocked')).toBeVisible();

  const quoted = makePost('kutipUmpatan', normalText, 'Dia bilang tolol.', 107);
  await page.locator('#timeline').evaluate((timeline, html) => timeline.insertAdjacentHTML('beforeend', html), quoted);
  await expect(page.locator('#kutipUmpatan')).toHaveCSS('display', 'none');

  const popup = await openPopup();
  await expect(popup.locator('#blocked-count')).toHaveText('2 unggahan unik diblokir');
  await expect(popup.getByText('@umpatan · Umpatan (goblok)', { exact: true })).toBeVisible();
  await expect(popup.getByText('@kutipUmpatan · Umpatan (tolol)', { exact: true })).toBeVisible();

  await page.evaluate(() => history.pushState({}, '', '/home'));
  await expect(page.locator('#politics')).toHaveCSS('display', 'none');
  await expect(page.locator('#umpatan')).toHaveCSS('display', 'none');
  await expect(popup.locator('#blocked-count')).toHaveText('5 unggahan unik diblokir');
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(searchUrl);
  await expect(page.locator('#politics')).toBeVisible();
  await expect(page.locator('#umpatan')).toHaveCSS('display', 'none');

  const toggle = popup.getByRole('switch', { name: 'Saring unggahan' });
  await toggle.uncheck();
  await expect(page.locator('#umpatan')).toBeVisible();
  await toggle.check();
  await expect(page.locator('#umpatan')).toHaveCSS('display', 'none');
});

test('sakelar politik berlaku lintas tab dan tersimpan terpisah dari filter lain', async () => {
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto('https://x.com/home'), second.goto('https://x.com/home/')]);
  await expect(first.locator('#politics')).toHaveCSS('display', 'none');
  await expect(second.locator('#politics')).toHaveCSS('display', 'none');

  const popup = await openPopup();
  const master = popup.getByRole('switch', { name: 'Saring unggahan' });
  const politics = popup.getByRole('switch', { name: 'Blokir politik di Beranda' });
  await expect(politics).toBeChecked();
  await politics.uncheck();
  await expect(first.locator('#politics')).toBeVisible();
  await expect(second.locator('#politics')).toBeVisible();
  await expect(first.locator('#blocked')).toHaveCSS('display', 'none');
  await expect(second.locator('#blocked')).toHaveCSS('display', 'none');

  const posts = makePost('politikBaru', 'Jadwal pemilu telah diumumkan.', '', 112) +
    makePost('campuran', 'Jadwal pemilu telah diumumkan. Ayo ribut di reply.', '', 113) +
    makePost('umpatanBaru', 'Goblok!', '', 114);
  await first.locator('#timeline').evaluate((timeline, html) => timeline.insertAdjacentHTML('beforeend', html), posts);
  await expect(first.locator('#politikBaru')).toBeVisible();
  await expect(first.locator('#campuran')).toHaveCSS('display', 'none');
  await expect(first.locator('#umpatanBaru')).toHaveCSS('display', 'none');
  await expect(popup.locator('#blocked-count')).toHaveText('5 unggahan unik diblokir');

  await Promise.all([first.reload(), popup.reload()]);
  await expect(politics).toBeEnabled();
  await expect(politics).not.toBeChecked();
  await expect(first.locator('#politics')).toBeVisible();
  await master.uncheck();
  await expect(first.locator('#blocked')).toBeVisible();
  await politics.check();
  await expect(first.locator('#politics')).toBeVisible();
  await master.check();
  await expect(first.locator('#politics')).toHaveCSS('display', 'none');
  await expect(second.locator('#politics')).toHaveCSS('display', 'none');
  await expect(popup.locator('#blocked-count')).toHaveText('5 unggahan unik diblokir');
});

test('nama politik dan perluasan umpatan memakai sakelar, riwayat, dan total yang ada', async () => {
  const home = await context.newPage();
  const search = await context.newPage();
  await Promise.all([home.goto('https://x.com/home'), search.goto('https://x.com/search?q=monyet')]);
  const posts = makePost('tokoh', 'Jokowi datang hari ini.', '', 121) +
    makePost('kutipTokoh', 'Catatan Pemilu.', '#AniesBaswedan', 122) +
    makePost('partai', 'PDI-P menerbitkan pernyataan.', '', 123) +
    makePost('namaUmum', 'Joko dan Raka berangkat ke SBY.', '', 124) +
    makePost('adopsi', 'Kami mengadopsi anjing.', '', 125) +
    makePost('satwa', normalText, 'Seekor monyet duduk di dahan.', 126);
  await Promise.all([home, search].map((page) =>
    page.locator('#timeline').evaluate((timeline, html) => timeline.insertAdjacentHTML('beforeend', html), posts),
  ));
  for (const id of ['tokoh', 'kutipTokoh', 'partai']) {
    await expect(home.locator(`#${id}`)).toHaveCSS('display', 'none');
    await expect(search.locator(`#${id}`)).toBeVisible();
  }
  for (const page of [home, search]) {
    await expect(page.locator('#namaUmum')).toBeVisible();
    await expect(page.locator('#adopsi')).toHaveCSS('display', 'none');
    await expect(page.locator('#satwa')).toHaveCSS('display', 'none');
  }

  const popup = await openPopup();
  const count = popup.locator('#blocked-count');
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const readBadge = () => worker.evaluate(() => chrome.action.getBadgeText({}));
  await expect(count).toHaveText('8 unggahan unik diblokir');
  await expect.poll(readBadge).toBe('8');
  await expect(popup.getByText('@tokoh · Politik (Joko Widodo)', { exact: true })).toBeVisible();
  await expect(popup.getByText('@kutipTokoh · Politik (Anies Rasyid Baswedan)', { exact: true })).toBeVisible();
  await expect(popup.getByText('@partai · Politik (Partai Demokrasi Indonesia Perjuangan)', { exact: true })).toBeVisible();
  await expect(popup.getByText('@satwa · Umpatan (monyet)', { exact: true })).toBeVisible();

  const politics = popup.getByRole('switch', { name: 'Blokir politik di Beranda' });
  await politics.uncheck();
  await expect(home.locator('#tokoh')).toBeVisible();
  await expect(home.locator('#kutipTokoh')).toBeVisible();
  await expect(home.locator('#partai')).toBeVisible();
  await expect(home.locator('#adopsi')).toHaveCSS('display', 'none');
  await expect(home.locator('#satwa')).toHaveCSS('display', 'none');
  await politics.check();
  await expect(home.locator('#tokoh')).toHaveCSS('display', 'none');
  await expect(count).toHaveText('8 unggahan unik diblokir');
  await expect.poll(readBadge).toBe('8');
});

test('riwayat terisi otomatis, menjelaskan alasan, dan mencatat setiap ID sekali lintas tab', async () => {
  const popup = await openPopup();
  const count = popup.locator('#blocked-count');
  const history = popup.locator('#block-history');
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const readBadge = () => worker.evaluate(() => chrome.action.getBadgeText({}));
  await expect(count).toHaveText('0 unggahan unik diblokir');
  await expect.poll(readBadge).toBe('0');
  await expect(popup.getByText('Belum ada unggahan yang diblokir.')).toBeVisible();

  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto('https://x.com/home'), second.goto('https://x.com/home')]);
  await expect(count).toHaveText('3 unggahan unik diblokir');
  await expect.poll(readBadge).toBe('3');
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
  await expect.poll(readBadge).toBe('4');
  await expect.poll(() => worker.evaluate(() => chrome.action.getTitle({})))
    .toBe('Anti-Ragebait · 4 unggahan unik diblokir');
  await expect(history.getByText('@berita · Politik (pilpres)', { exact: true })).toBeVisible();
  await expect(politicalEntry.locator('.entry-excerpt')).toBeVisible();

  await Promise.all([first.reload(), second.reload(), popup.reload()]);
  await expect(first.locator('#politics')).toHaveCSS('display', 'none');
  await expect(second.locator('#politics')).toHaveCSS('display', 'none');
  await expect(count).toHaveText('4 unggahan unik diblokir');
  await expect.poll(readBadge).toBe('4');
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
