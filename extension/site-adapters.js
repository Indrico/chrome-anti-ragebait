const feedAdapters = (() => {
  const excluded = 'aside, nav, dialog, [role="dialog"], [role="log"], [aria-modal="true"], form, ' +
    '[contenteditable="true"], [data-pagelet^="ChatTab"], [data-testid*="comment" i], [data-ad-rendering-role="comment"]';
  const excludedText = `${excluded}, [hidden], [aria-hidden="true"], header, footer, time, button, [role="button"], script, style`;
  const main = 'main, [role="main"], [role="feed"]';
  const quote = 'blockquote, [data-testid*="quote" i], [data-ad-rendering-role="shared_story"]';
  const xCard = '[data-testid="cellInnerDiv"]';
  const xPost = 'article[data-testid="tweet"]';
  const xText = '[data-testid="tweetText"]';
  const facebookArticle = 'article, [role="article"], [data-testid="feed_story"]';
  const facebookCard = `${facebookArticle}, [data-pagelet^="FeedUnit_"]:not(:has(${facebookArticle}))`;
  const facebookText = '[data-ad-preview="message"], [data-ad-comet-preview="message"], ' +
    '[data-ad-rendering-role="story_message"], [data-testid="post_message"]';
  const instagramArticle = 'article, [role="article"]';
  const instagramCaption = 'figcaption, [data-caption], [data-testid="caption"], [data-testid="post-caption"]';
  const instagramLink = 'a[href*="/p/"], a[href*="/reel/"]';
  const instagramCard = `${instagramArticle}, :is(${instagramLink}):has(${instagramCaption}):not(:is(${instagramArticle}) *)`;
  const threadsLink = 'a[href*="/post/"], a[href^="/t/"]';
  const threadsCard = `article, [role="article"], [data-pressable-container="true"]:has(${threadsLink})`;
  const threadsText = '[data-testid="post-text"], [data-testid="thread-text"], [data-text-post-text]';

  function surface(path, home, search) {
    if (home.test(path)) return 'home';
    return search.test(path) ? 'search' : null;
  }

  function hostName(host) {
    return host.replace(/^www\./u, '');
  }

  function postLink(link, domain) {
    try {
      const url = new URL(link.getAttribute('href'), location.origin);
      return url.protocol === 'https:' && hostName(url.hostname) === domain ? url : null;
    } catch {
      return null;
    }
  }

  function readText(node) {
    const copy = node.cloneNode(true);
    for (const child of copy.querySelectorAll(excludedText)) child.remove();
    for (const br of copy.querySelectorAll('br')) br.replaceWith('\n');
    return { rawText: copy.textContent, language: node.closest('[lang]')?.lang ?? '' };
  }

  function textParts(nodes) {
    const eligible = nodes.filter((node) => !node.closest(excludedText));
    // A text wrapper and its child describe the same caption.
    const outer = eligible.filter((node) => !eligible.some((other) => other !== node && other.contains(node)));
    return outer.map(readText).filter(({ rawText }) => rawText.trim());
  }

  function belongsToCard(node, card, cardSelector) {
    return node.closest(cardSelector) === card || card.contains(node.closest(quote));
  }

  function linksIn(card, selector) {
    const links = [...card.querySelectorAll(selector)];
    if (card.matches(selector)) links.unshift(card);
    return links.filter((link) => !link.closest(`${excluded}, ${quote}`));
  }

  function readX(card) {
    const posts = [...card.querySelectorAll(xPost)].filter((post) =>
      post.closest(xCard) === card && !post.parentElement.closest(xPost),
    );
    if (posts.length !== 1) return null;
    const [post] = posts;
    let identity = {};
    for (const link of post.querySelectorAll('a[href*="/status/"]:has(time)')) {
      if (post.contains(link.closest('div[role="link"]'))) continue;
      const match = link.getAttribute('href').match(/^(?:https:\/\/x\.com)?\/(?:(?<author>[a-z0-9_]{1,15})\/status\/|i\/web\/status\/)(?<id>\d{1,24})(?:[/?#]|$)/iu);
      if (match) {
        identity = match.groups;
        break;
      }
    }
    const texts = [...post.querySelectorAll(xText)].map((text) => ({
      rawText: text.textContent,
      language: text.getAttribute('lang') ?? '',
    }));
    return { ...identity, texts };
  }

  function facebookPostId(url) {
    const post = url.pathname.match(/\/(?:posts|permalink)\/([a-z0-9_]+)\/?$/iu);
    if (post) return post[1];
    if (!['/permalink.php', '/story.php'].includes(url.pathname)) return null;
    const id = url.searchParams.get('story_fbid');
    return /^[a-z0-9_]+$/iu.test(id ?? '') ? id : null;
  }

  function readFacebook(card) {
    const bodies = [...card.querySelectorAll(facebookText)].filter((body) =>
      belongsToCard(body, card, facebookCard),
    );
    const texts = textParts(bodies);
    if (!texts.length) return null;

    const ids = new Set();
    for (const link of linksIn(card, 'a[href*="/posts/"], a[href*="/permalink"], a[href*="/story.php"]')) {
      const url = postLink(link, 'facebook.com');
      if (!url || url.searchParams.has('comment_id') || url.searchParams.has('reply_comment_id')) continue;
      const id = facebookPostId(url);
      if (id) ids.add(id);
    }
    if (ids.size > 1) return null;
    const [id] = ids;
    const author = card.querySelector('header strong, [data-testid="story_author_link"], h2 a, h3 a, h4 a')
      ?.textContent.trim().slice(0, 100);
    return { id, author, texts };
  }

  function instagramAuthor(link) {
    const url = postLink(link, 'instagram.com');
    const handle = url?.pathname.match(/^\/([a-z0-9._]{1,30})\/?$/iu)?.[1];
    return handle && link.textContent.trim().toLowerCase() === handle.toLowerCase() ? handle : null;
  }

  function readInstagram(card) {
    const posts = new Map();
    for (const link of linksIn(card, instagramLink)) {
      const post = postLink(link, 'instagram.com')?.pathname.match(/^\/(?:(?<author>[a-z0-9._]+)\/)?(?:p|reel)\/(?<id>[a-z0-9_-]+)\/?$/iu);
      if (!post) continue;
      const old = posts.get(post.groups.id);
      if (!old || post.groups.author) posts.set(post.groups.id, post.groups);
    }
    if (posts.size !== 1) return null;
    const [identity] = posts.values();
    const handleLinks = [...card.querySelectorAll('a[href]')].filter((link) =>
      !link.closest(excluded) && instagramAuthor(link),
    );
    const author = identity.author ?? handleLinks.map(instagramAuthor)[0];
    const candidates = [...card.querySelectorAll(`${instagramCaption}, h1, ._a9zs`)];
    if (!candidates.length && author) {
      // Feed variants can render the caption immediately after its inline author.
      for (const link of handleLinks) {
        if (instagramAuthor(link)?.toLowerCase() !== author.toLowerCase() || link.closest('header, ul, li')) continue;
        for (const label of [link, link.parentElement, link.parentElement?.parentElement]) {
          if (!label || label === card || !card.contains(label)) break;
          const sibling = label.nextElementSibling;
          if (sibling?.matches('span[dir="auto"], div[dir="auto"]') && !sibling.querySelector('time, form')) {
            candidates.push(sibling);
            break;
          }
        }
      }
    }
    const texts = textParts(candidates.filter((node) => belongsToCard(node, card, instagramCard)));
    return texts.length ? { id: identity.id, author, texts } : null;
  }

  function readThreads(card) {
    const posts = new Map();
    for (const link of linksIn(card, threadsLink)) {
      const post = postLink(link, 'threads.com')?.pathname.match(/^\/(?:@(?<author>[a-z0-9._]+)\/post|t)\/(?<id>[a-z0-9_-]+)\/?$/iu);
      if (!post) continue;
      const old = posts.get(post.groups.id);
      if (!old || link.querySelector('time')) {
        posts.set(post.groups.id, { ...post.groups, timestamp: !!link.querySelector('time') });
      }
    }
    const entries = [...posts.values()];
    const timestamped = entries.filter((entry) => entry.timestamp);
    const candidates = timestamped.length ? timestamped : entries;
    if (candidates.length !== 1) return null;
    const [identity] = candidates;

    let nodes = [...card.querySelectorAll(threadsText)];
    if (!nodes.length) {
      nodes = [...card.querySelectorAll('span[dir="auto"], div[dir="auto"]')].filter((node) =>
        !node.closest('a[href*="/@"], a[href^="/t/"], [data-testid*="username" i]') &&
        !node.querySelector('time, header, form, a[href*="/@"]:not([href*="/post/"])'),
      );
    }
    const texts = textParts(nodes.filter((node) => belongsToCard(node, card, threadsCard)));
    return texts.length ? { id: identity.id, author: identity.author, texts } : null;
  }

  return {
    'x.com': {
      site: 'x', scope: '[data-testid="primaryColumn"]', card: xCard, content: `${xPost}, ${xText}`,
      surface: (path) => surface(path, /^\/home$/u, /^\/search$/u), read: readX,
    },
    'facebook.com': {
      site: 'facebook', scope: main, card: facebookCard, content: facebookText, excluded,
      surface: (path) => surface(path, /^\/(?:home\.php)?$/u, /^\/search(?:\/(?:top|posts))?$/u), read: readFacebook,
    },
    'instagram.com': {
      site: 'instagram', scope: main, card: instagramCard, excluded,
      content: `${instagramCaption}, h1, [dir="auto"], ._a9zs, ${instagramLink}`,
      surface: (path) => surface(path, /^\/$/u, /^\/explore\/search\/keyword$/u), read: readInstagram,
    },
    'threads.com': {
      site: 'threads', card: threadsCard, excluded, content: `${threadsText}, [dir="auto"], ${threadsLink}`,
      surface: (path) => surface(path, /^\/(?:following)?$/u, /^\/search$/u), read: readThreads,
    },
  };
})();
