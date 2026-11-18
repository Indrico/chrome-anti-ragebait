const recentLimit = 50;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withBlockHistory(mode, run) {
  const open = indexedDB.open('anti-ragebait', 1);
  open.onupgradeneeded = () => {
    const posts = open.result.createObjectStore('blocked-posts', { keyPath: 'key' });
    posts.createIndex('by-blocked-at', 'blockedAt');
  };
  const database = await requestResult(open);
  try {
    const transaction = database.transaction('blocked-posts', mode);
    const complete = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
    const [result] = await Promise.all([run(transaction.objectStore('blocked-posts')), complete]);
    return result;
  } finally {
    database.close();
  }
}

async function getPostKey(post) {
  if (post.id) return `x:${post.id}`;
  const bytes = new TextEncoder().encode(post.fallbackText.toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `text:${hex}`;
}

async function addBlockedPosts(posts) {
  const keys = await Promise.all(posts.map(getPostKey));
  const entries = new Map();
  for (let i = 0; i < posts.length; i += 1) {
    const key = keys[i];
    if (entries.has(key)) continue;
    const { author, reason, term, excerpt } = posts[i];
    entries.set(key, { key, author, reason, term, excerpt, blockedAt: Date.now() });
  }

  return withBlockHistory('readwrite', async (store) => {
    const knownKeys = await Promise.all([...entries.keys()].map((key) => requestResult(store.getKey(key))));
    for (const key of knownKeys) entries.delete(key);
    if (!entries.size) return false;

    await Promise.all([...entries.values()].map((entry) => requestResult(store.add(entry))));
    const recent = store.index('by-blocked-at');
    const overflow = await requestResult(recent.count()) - recentLimit;
    if (overflow > 0) {
      const olderKeys = await requestResult(recent.getAllKeys(undefined, overflow));
      // Keep an identifier for the unique total and discard the older post's metadata.
      await Promise.all(olderKeys.map((key) => requestResult(store.put({ key }))));
    }
    return true;
  });
}

function readBlockedPosts() {
  return withBlockHistory('readonly', async (store) => {
    const [total, recent] = await Promise.all([
      requestResult(store.count()),
      requestResult(store.index('by-blocked-at').getAll()),
    ]);
    return { total, recent: recent.reverse() };
  });
}

async function notifyHistoryChanged() {
  try {
    await chrome.runtime.sendMessage({ type: 'blocked:changed' });
  } catch {
    // The popup can be closed when the history changes.
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'blocked:record' && message?.type !== 'blocked:read') return;

  (async () => {
    try {
      if (message.type === 'blocked:read') {
        sendResponse({ ok: true, ...await readBlockedPosts() });
      } else {
        const changed = await addBlockedPosts(message.posts);
        sendResponse({ ok: true });
        if (changed) void notifyHistoryChanged();
      }
    } catch {
      sendResponse({ ok: false });
    }
  })();
  return true;
});
