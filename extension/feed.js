(() => {
  const columnSelector = '[data-testid="primaryColumn"]';
  const cellSelector = '[data-testid="cellInnerDiv"]';
  const postSelector = 'article[data-testid="tweet"]';
  const textSelector = '[data-testid="tweetText"]';
  const permalinkSelector = 'a[href*="/status/"]:has(time)';
  const postContentSelector = `${postSelector}, ${textSelector}`;
  const activeAttribute = 'data-anti-ragebait-active';
  const stateAttribute = 'data-anti-ragebait-state';
  const pendingCells = new Set();

  let enabled = true;
  let settingsReady = false;
  let active = false;
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

  function getBlockDecision(cell) {
    const posts = [...cell.querySelectorAll(postSelector)].filter((post) =>
      post.closest(cellSelector) === cell && !post.parentElement.closest(postSelector),
    );
    if (posts.length !== 1) return null;

    // The tweet-text markers identify each text independently, including quoted text.
    const [post] = posts;
    const textNodes = [...post.querySelectorAll(textSelector)];
    for (const text of textNodes) {
      const rawText = text.textContent;
      const normalizedText = normalizePostText(rawText);
      const term = findPoliticalTerm(normalizedText);
      if (term || isIndonesianRagebait(rawText, text.getAttribute('lang') ?? '')) {
        const { id, author } = getPostIdentity(post);
        const preview = normalizedText.slice(0, 180);
        return {
          id: id ?? null,
          author: author ?? null,
          reason: term ? 'politics' : 'ragebait',
          term,
          excerpt: normalizedText.length > preview.length ? `${preview}…` : preview,
          fallbackText: id ? null : textNodes.map((node) => normalizePostText(node.textContent)).join('\n').slice(0, 4096),
        };
      }
    }
    return null;
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
    const onHome = location.pathname === '/home' || location.pathname === '/home/';
    const shouldActivate = enabled && onHome;
    if (active === shouldActivate) return;

    active = shouldActivate;
    root.toggleAttribute(activeAttribute, active);
    if (active) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributeFilter: ['lang', 'data-testid'],
        attributeOldValue: true,
      });
      root.querySelectorAll(`${columnSelector} ${cellSelector}`).forEach(queueCell);
      return;
    }

    observer.disconnect();
    cancelAnimationFrame(frameId);
    frameId = 0;
    pendingCells.clear();
    root.querySelectorAll(`[${stateAttribute}]`).forEach((cell) => cell.removeAttribute(stateAttribute));
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

  let receivedSettingChange = false;
  chrome.storage.local.onChanged.addListener((changes) => {
    if (!changes.enabled) return;
    receivedSettingChange = true;
    enabled = changes.enabled.newValue !== false;
    refreshActivation();
  });

  async function loadSettings() {
    try {
      const settings = await chrome.storage.local.get('enabled');
      if (!receivedSettingChange) enabled = settings.enabled !== false;
    } catch (error) {
      if (!receivedSettingChange) enabled = false;
      console.warn('Anti-Ragebait tidak dapat membaca pengaturan.', error);
    }
    settingsReady = true;
    refreshActivation();
    scheduleBatch();
  }

  void loadSettings();
})();
