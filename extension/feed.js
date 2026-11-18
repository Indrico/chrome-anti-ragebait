(() => {
  const columnSelector = '[data-testid="primaryColumn"]';
  const cellSelector = '[data-testid="cellInnerDiv"]';
  const feedCellSelector = `${columnSelector} ${cellSelector}`;
  const postSelector = 'article[data-testid="tweet"]';
  const textSelector = '[data-testid="tweetText"]';
  const permalinkSelector = 'a[href*="/status/"]:has(time)';
  const postContentSelector = `${postSelector}, ${textSelector}`;
  const activeAttribute = 'data-anti-ragebait-active';
  const stateAttribute = 'data-anti-ragebait-state';
  const pendingCells = new Set();
  const settings = { enabled: true, politicsEnabled: true };
  const settingKeys = Object.keys(settings);
  const changesDuringLoad = {};

  let settingsReady = false;
  let activePath = null;
  let frameId = 0;
  const observer = new MutationObserver(handleMutations);

  function getPostIdentity(post) {
    for (const link of post.querySelectorAll(permalinkSelector)) {
      if (post.contains(link.closest('div[role="link"]'))) continue;
      const permalink = link.getAttribute('href').match(/^(?:https:\/\/x\.com)?\/(?:(?<author>[a-z0-9_]{1,15})\/status\/|i\/web\/status\/)(?<id>\d{1,24})(?:[/?#]|$)/iu);
      if (permalink) return permalink.groups;
    }
    return {};
  }

  function findTermMatch(texts, findTerm, reason) {
    for (const { normalizedText } of texts) {
      const term = findTerm(normalizedText);
      if (term) return { reason, term, normalizedText };
    }
    return null;
  }

  function getBlockDecision(cell) {
    const posts = [...cell.querySelectorAll(postSelector)].filter((post) =>
      post.closest(cellSelector) === cell && !post.parentElement.closest(postSelector),
    );
    if (posts.length !== 1) return null;

    // The tweet-text markers identify each text independently, including quoted text.
    const [post] = posts;
    const texts = [...post.querySelectorAll(textSelector)].map((text) => {
      const rawText = text.textContent;
      return { rawText, normalizedText: normalizePostText(rawText), language: text.getAttribute('lang') ?? '' };
    });
    let match = findTermMatch(texts, findProfanityTerm, 'profanity');
    if (!match && activePath === '/home') {
      if (settings.politicsEnabled) {
        match = findTermMatch(texts, findPoliticalName, 'politics') ??
          findTermMatch(texts, findPoliticalTerm, 'politics');
      }
      if (!match) {
        const ragebait = texts.find(({ rawText, language }) => isIndonesianRagebait(rawText, language));
        if (ragebait) match = { reason: 'ragebait', term: null, normalizedText: ragebait.normalizedText };
      }
    }
    if (!match) return null;

    const { id, author } = getPostIdentity(post);
    const { reason, term, normalizedText } = match;
    const preview = normalizedText.slice(0, 180);
    return {
      id: id ?? null,
      author: author ?? null,
      reason,
      term,
      excerpt: normalizedText.length > preview.length ? `${preview}…` : preview,
      fallbackText: id ? null : texts.map((text) => text.normalizedText).join('\n').slice(0, 4096),
    };
  }

  async function recordBlockedPosts(posts) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'blocked:record', posts });
      if (!response?.ok) throw new Error('Recording failed');
    } catch {
      console.warn('Anti-Ragebait tidak dapat mencatat seluruh pemblokiran.');
    }
  }

  function scheduleBatch() {
    if (settingsReady && pendingCells.size && !frameId) {
      frameId = requestAnimationFrame(processBatch);
    }
  }

  function processBatch() {
    frameId = 0;
    const deadline = performance.now() + 6;
    const blockedPosts = [];
    for (const cell of pendingCells) {
      pendingCells.delete(cell);
      if (cell.isConnected && cell.closest(columnSelector)) {
        const decision = getBlockDecision(cell);
        cell.setAttribute(stateAttribute, decision ? 'blocked' : 'visible');
        if (decision) blockedPosts.push(decision);
      }
      if (performance.now() >= deadline) break;
    }
    if (blockedPosts.length) void recordBlockedPosts(blockedPosts);
    scheduleBatch();
  }

  function queueCell(cell) {
    if (!cell?.isConnected || !cell.closest(columnSelector) || pendingCells.has(cell)) return;
    cell.removeAttribute(stateAttribute);
    pendingCells.add(cell);
    scheduleBatch();
  }

  function containsPostContent(node) {
    return node instanceof Element &&
      (node.matches(postContentSelector) || node.querySelector(postContentSelector));
  }

  function handleMutations(records) {
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!target) continue;

      const cell = target.closest(cellSelector);
      if (record.attributeName === 'data-testid') {
        if (target.matches(columnSelector)) {
          target.querySelectorAll(cellSelector).forEach(queueCell);
        } else if (target.matches(cellSelector) || target.matches(postContentSelector) ||
                   record.oldValue === 'tweet' || record.oldValue === 'tweetText') {
          queueCell(cell);
        }
        continue;
      }

      if (cell) {
        if (target.closest(textSelector) ||
            [...record.addedNodes, ...record.removedNodes].some(containsPostContent)) {
          queueCell(cell);
        }
        continue;
      }

      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(cellSelector)) queueCell(node);
        node.querySelectorAll(cellSelector).forEach(queueCell);
      }
    }
  }

  function refreshActivation() {
    const root = document.documentElement;
    if (!root) return;
    const path = location.pathname.replace(/\/$/u, '');
    const nextPath = settings.enabled && (path === '/home' || path === '/search') ? path : null;
    if (activePath === nextPath) return;

    observer.disconnect();
    cancelAnimationFrame(frameId);
    frameId = 0;
    pendingCells.clear();

    activePath = nextPath;
    root.toggleAttribute(activeAttribute, activePath !== null);
    if (!activePath) {
      root.querySelectorAll(`[${stateAttribute}]`).forEach((cell) => cell.removeAttribute(stateAttribute));
      return;
    }

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ['lang', 'data-testid'],
      attributeOldValue: true,
    });
    root.querySelectorAll(feedCellSelector).forEach(queueCell);
  }

  function applySettings(updatedSettings) {
    const previousPath = activePath;
    const previousPoliticsEnabled = settings.politicsEnabled;
    Object.assign(settings, updatedSettings);
    refreshActivation();
    if (previousPath === '/home' && activePath === '/home' &&
        previousPoliticsEnabled !== settings.politicsEnabled) {
      document.querySelectorAll(feedCellSelector).forEach(queueCell);
    }
  }

  if (document.documentElement) {
    refreshActivation();
  } else {
    const rootObserver = new MutationObserver(() => {
      if (!document.documentElement) return;
      rootObserver.disconnect();
      refreshActivation();
    });
    rootObserver.observe(document, { childList: true });
  }
  navigation.addEventListener('currententrychange', refreshActivation);

  chrome.storage.local.onChanged.addListener((changes) => {
    if (!changes.enabled && !changes.politicsEnabled) return;
    const updatedSettings = {};
    for (const key of settingKeys) {
      if (changes[key]) updatedSettings[key] = changes[key].newValue !== false;
    }
    if (!settingsReady) Object.assign(changesDuringLoad, updatedSettings);
    applySettings(updatedSettings);
  });

  async function loadSettings() {
    let storedSettings;
    try {
      const stored = await chrome.storage.local.get(settingKeys);
      storedSettings = { enabled: stored.enabled !== false, politicsEnabled: stored.politicsEnabled !== false };
    } catch (error) {
      storedSettings = { enabled: false };
      console.warn('Anti-Ragebait tidak dapat membaca pengaturan.', error);
    }
    applySettings({ ...storedSettings, ...changesDuringLoad });
    settingsReady = true;
    scheduleBatch();
  }

  void loadSettings();
})();
