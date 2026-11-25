// Find in page for the wrapper's windows. A WebView has no find bar of its
// own, so Ctrl+F / Cmd+F did nothing; this script (injected into every page
// by `find_bar.rs`, whatever site the window is showing) adds one.
//
// - Ctrl+F / Cmd+F opens it (prefilled with the selected text) or refocuses it.
// - Enter / Ctrl+G / F3 goes to the next match, Shift+ the same to the previous.
// - Escape, or the close button, closes it and clears the highlights.
//
// A page that handles Ctrl+F itself (an editor's own search) keeps it: the bar
// opens only when no handler called `preventDefault()` on the key press.
//
// Matches are painted with the CSS Custom Highlight API, which never touches
// the page's DOM (React and ProseMirror own it). Where that API is missing,
// the current match is shown as the selection instead.
(function () {
  if (window.top !== window || window.__nativeFindBar) return;

  var HOST_ID = 'native-find-bar';
  var HIGHLIGHT = 'native-find';
  var ACTIVE = 'native-find-active';
  var MAX_MATCHES = 2000;
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1 };

  var host = null;
  var input = null;
  var countLabel = null;
  var pageStyle = null;
  var observer = null;
  var refreshTimer = 0;
  var matches = [];
  var current = -1;
  var lastFocused = null;
  var canHighlight = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight === 'function';

  function isOpen() {
    return !!host && !host.hidden;
  }

  function buildBar() {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.hidden = true;
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      ':host{all:initial;position:fixed;top:10px;right:16px;z-index:2147483647;' +
      'font:13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light dark}' +
      ':host([hidden]){display:none}' +
      '.bar{display:flex;align-items:center;gap:4px;padding:6px;border-radius:10px;' +
      'background:#fff;color:#111;border:1px solid rgba(0,0,0,.15);box-shadow:0 6px 24px rgba(0,0,0,.18)}' +
      'input{width:220px;padding:5px 8px;border-radius:6px;border:1px solid rgba(0,0,0,.2);' +
      'background:transparent;color:inherit;font:inherit;outline:none}' +
      'input:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.3)}' +
      '.count{min-width:64px;text-align:center;opacity:.7;font-variant-numeric:tabular-nums}' +
      '.count.none{color:#dc2626;opacity:1}' +
      'button{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:inherit;' +
      'font:inherit;font-size:15px;cursor:pointer;display:grid;place-items:center}' +
      'button:hover{background:rgba(127,127,127,.18)}' +
      'button:disabled{opacity:.35;cursor:default;background:transparent}' +
      '@media (prefers-color-scheme:dark){.bar{background:#1f2023;color:#eee;border-color:rgba(255,255,255,.15)}' +
      'input{border-color:rgba(255,255,255,.25)}}' +
      '</style>' +
      '<div class="bar" role="search">' +
      '<input type="text" placeholder="Find in page" aria-label="Find in page" spellcheck="false" autocomplete="off">' +
      '<span class="count" aria-live="polite"></span>' +
      '<button type="button" data-act="prev" title="Previous match (Shift+Enter)" aria-label="Previous match">&#8593;</button>' +
      '<button type="button" data-act="next" title="Next match (Enter)" aria-label="Next match">&#8595;</button>' +
      '<button type="button" data-act="close" title="Close (Esc)" aria-label="Close find bar">&#10005;</button>' +
      '</div>';
    input = root.querySelector('input');
    countLabel = root.querySelector('.count');

    input.addEventListener('input', function () {
      search(true);
    });
    root.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('button');
      if (!button) return;
      var act = button.getAttribute('data-act');
      if (act === 'close') close();
      else step(act === 'prev' ? -1 : 1);
      if (act !== 'close') input.focus();
    });
    // Keys typed in the bar stay in the bar: the page's own shortcuts must
    // not fire while the person types a search.
    host.addEventListener('keydown', function (event) {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'Enter' || event.key === 'F3' || (isMod(event) && keyIs(event, 'g'))) {
        event.preventDefault();
        step(event.shiftKey ? -1 : 1);
      } else if (isMod(event) && keyIs(event, 'f')) {
        event.preventDefault();
        input.select();
      }
    });
    ['keyup', 'keypress'].forEach(function (type) {
      host.addEventListener(type, function (event) {
        event.stopPropagation();
      });
    });
  }

  function isMod(event) {
    return (event.ctrlKey || event.metaKey) && !event.altKey;
  }

  function keyIs(event, letter) {
    return (event.key || '').toLowerCase() === letter || event.code === 'Key' + letter.toUpperCase();
  }

  function open() {
    if (!document.body) return;
    if (!host) buildBar();
    if (!host.isConnected) document.documentElement.appendChild(host);
    var wasOpen = isOpen();
    if (!wasOpen) {
      var active = document.activeElement;
      lastFocused = active && active !== document.body ? active : null;
    }
    var selected = String(window.getSelection ? window.getSelection() : '').trim();
    if (selected && selected.length <= 200 && selected.indexOf('\n') === -1) input.value = selected;
    host.hidden = false;
    if (!wasOpen) {
      ensurePageStyle();
      watchPage();
    }
    input.focus();
    input.select();
    search(true);
  }

  function close() {
    if (!isOpen()) return;
    host.hidden = true;
    clearHighlights();
    matches = [];
    current = -1;
    if (observer) observer.disconnect();
    observer = null;
    clearTimeout(refreshTimer);
    if (pageStyle) pageStyle.remove();
    pageStyle = null;
    var restore = lastFocused;
    lastFocused = null;
    if (restore && restore.isConnected && restore.focus) restore.focus();
  }

  function ensurePageStyle() {
    if (!canHighlight || pageStyle) return;
    pageStyle = document.createElement('style');
    pageStyle.textContent =
      '::highlight(' + HIGHLIGHT + '){background-color:#fde047;color:#111}' +
      '::highlight(' + ACTIVE + '){background-color:#fb923c;color:#111}';
    (document.head || document.documentElement).appendChild(pageStyle);
  }

  // Re-run the search when the page changes under an open bar (a route
  // change, a list that loads more), without jumping the scroll position.
  function watchPage() {
    if (typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].target !== host && !(host && host.contains(records[i].target))) {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(function () {
            if (isOpen()) search(false);
          }, 300);
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /** Every visible text node under body, with its offset in their joined text. */
  function collectText() {
    var nodes = [];
    var starts = [];
    var text = '';
    var visible = new Map();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent || !node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (!isShown(parent, visible)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push(node);
      starts.push(text.length);
      text += node.nodeValue;
    }
    return { nodes: nodes, starts: starts, text: text };
  }

  function isShown(element, cache) {
    if (cache.has(element)) return cache.get(element);
    var shown = true;
    if (SKIP[element.tagName] || element === host) shown = false;
    else if (typeof element.checkVisibility === 'function') shown = element.checkVisibility();
    else if (element.parentElement && element.parentElement !== document.body) shown = isShown(element.parentElement, cache);
    cache.set(element, shown);
    return shown;
  }

  /** Index of the text node that holds joined-text offset `offset`. */
  function nodeAt(starts, offset) {
    var low = 0;
    var high = starts.length - 1;
    while (low < high) {
      var mid = (low + high + 1) >> 1;
      if (starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  function search(scroll) {
    var query = input.value;
    var anchor = current >= 0 ? matches[current] : null;
    clearHighlights();
    matches = [];
    current = -1;
    if (query) {
      var page = collectText();
      var haystack = page.text.toLowerCase();
      var needle = query.toLowerCase();
      var at = haystack.indexOf(needle);
      while (at !== -1 && matches.length < MAX_MATCHES) {
        var end = at + needle.length;
        var startIndex = nodeAt(page.starts, at);
        var endIndex = nodeAt(page.starts, end - 1);
        var range = document.createRange();
        range.setStart(page.nodes[startIndex], at - page.starts[startIndex]);
        range.setEnd(page.nodes[endIndex], end - page.starts[endIndex]);
        matches.push(range);
        at = haystack.indexOf(needle, end);
      }
    }
    if (matches.length) current = pickStart(anchor, scroll);
    paint(scroll);
  }

  /** The match to show first: the one at or after the previous match, else the first. */
  function pickStart(anchor, fromViewport) {
    if (anchor && anchor.startContainer.isConnected) {
      for (var i = 0; i < matches.length; i++) {
        if (matches[i].compareBoundaryPoints(Range.START_TO_START, anchor) >= 0) return i;
      }
    }
    if (fromViewport && !anchor) {
      // A new search starts at the first match on screen, as a browser's does.
      for (var j = 0; j < matches.length; j++) {
        var rect = matches[j].getBoundingClientRect ? matches[j].getBoundingClientRect() : null;
        if (rect && rect.bottom >= 0 && (rect.width || rect.height)) return j;
      }
    }
    return 0;
  }

  function step(direction) {
    if (!input.value) return;
    var stale = !matches.length || matches.some(function (range) {
      return !range.startContainer.isConnected;
    });
    if (stale) search(false);
    if (!matches.length) return;
    current = (current + direction + matches.length) % matches.length;
    paint(true);
  }

  function paint(scroll) {
    var total = matches.length;
    countLabel.textContent = !input.value ? '' : total ? current + 1 + ' of ' + total + (total >= MAX_MATCHES ? '+' : '') : 'No results';
    countLabel.className = 'count' + (input.value && !total ? ' none' : '');
    host.shadowRoot.querySelectorAll('button[data-act="prev"],button[data-act="next"]').forEach(function (button) {
      button.disabled = total === 0;
    });
    if (!total) return;
    var active = matches[current];
    if (canHighlight) {
      var all = new Highlight();
      matches.forEach(function (range, index) {
        if (index !== current) all.add(range);
      });
      CSS.highlights.set(HIGHLIGHT, all);
      CSS.highlights.set(ACTIVE, new Highlight(active));
    } else if (scroll) {
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(active.cloneRange());
    }
    if (scroll) scrollToRange(active);
  }

  function scrollToRange(range) {
    var element = range.startContainer.parentElement;
    if (element && element.scrollIntoView) element.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  function clearHighlights() {
    if (!canHighlight) return;
    CSS.highlights.delete(HIGHLIGHT);
    CSS.highlights.delete(ACTIVE);
  }

  window.addEventListener('keydown', function (event) {
    if (event.target === host) return;
    var opensFind = isMod(event) && !event.shiftKey && keyIs(event, 'f');
    var stepsFind = isOpen() && (event.key === 'F3' || (isMod(event) && keyIs(event, 'g')));
    var closesFind = isOpen() && event.key === 'Escape';
    if (!opensFind && !stepsFind && !closesFind) return;
    if (event.defaultPrevented) return;
    if (stepsFind) {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
      return;
    }
    // Wait until every handler has seen the key: one registered after this
    // script (an editor's own Ctrl+F) claims it by calling preventDefault().
    // The same goes for Escape, which a page's open dialog may want first.
    setTimeout(function () {
      if (event.defaultPrevented) return;
      if (closesFind) close();
      else open();
    }, 0);
  });

  window.__nativeFindBar = { open: open, close: close, isOpen: isOpen };
})();
