(() => {
  const columnSelector = '[data-testid="primaryColumn"]';
  const cellSelector = '[data-testid="cellInnerDiv"]';
  const postSelector = 'article[data-testid="tweet"]';
  const textSelector = '[data-testid="tweetText"]';
  const postContentSelector = `${postSelector}, ${textSelector}`;
  const activeAttribute = 'data-anti-ragebait-active';
  const stateAttribute = 'data-anti-ragebait-state';
  const pendingCells = new Set();

  let enabled = true;
  let settingsReady = false;
  let active = false;
  let frameId = 0;
  const observer = new MutationObserver(handleMutations);

  function shouldBlock(cell) {
    const posts = [...cell.querySelectorAll(postSelector)].filter((post) =>
      post.closest(cellSelector) === cell && !post.parentElement.closest(postSelector),
    );
    if (posts.length !== 1) return false;

    // The tweet-text markers identify each text independently, including quoted text.
    return [...posts[0].querySelectorAll(textSelector)].some((text) =>
      isIndonesianRagebait(text.textContent, text.getAttribute('lang') ?? ''),
    );
  }

  function scheduleBatch() {
    if (settingsReady && pendingCells.size && !frameId) {
      frameId = requestAnimationFrame(processBatch);
    }
  }

  function processBatch() {
    frameId = 0;
    const deadline = performance.now() + 6;
    for (const cell of pendingCells) {
      pendingCells.delete(cell);
      if (cell.isConnected && cell.closest(columnSelector)) {
        const state = shouldBlock(cell) ? 'blocked' : 'visible';
        cell.setAttribute(stateAttribute, state);
      }
      if (performance.now() >= deadline) break;
    }
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
