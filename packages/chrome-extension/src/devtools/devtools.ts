/**
 * Inspector Jake DevTools entry point.
 * Creates a full DevTools panel tab with Vue-based UI.
 */

// Notify background that DevTools is open for this tab
chrome.runtime.sendMessage({
  type: 'DEVTOOLS_OPENED',
  tabId: chrome.devtools.inspectedWindow.tabId,
});

// Create full DevTools panel tab
chrome.devtools.panels.create(
  "Jake",
  'icons/icon.svg',
  'src/devtools/panel.html',
  (_panel) => {
    // Panel created successfully
  }
);

// Track element selection and notify panel/background
chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
  chrome.devtools.inspectedWindow.eval(
    `(() => {
      const el = $0;
      if (!el) return null;

      function computeSelector(element) {
        if (element.id) {
          return '#' + element.id;
        }

        const path = [];
        let current = element;

        while (current && current !== document.body && path.length < 4) {
          let selector = current.tagName.toLowerCase();

          if (current.id) {
            path.unshift('#' + current.id);
            break;
          }

          if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\\s+/).filter(c => c);
            if (classes.length > 0) {
              selector += '.' + classes.slice(0, 2).join('.');
            }
          }

          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(
              (s) => s.tagName === current.tagName
            );
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              selector += ':nth-of-type(' + index + ')';
            }
          }

          path.unshift(selector);
          current = current.parentElement;
        }

        return path.join(' > ');
      }

      const rect = el.getBoundingClientRect();

      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className : null,
        selector: computeSelector(el),
        innerText: el.innerText ? el.innerText.slice(0, 200) : null,
        attributes: Array.from(el.attributes).map(a => ({
          name: a.name,
          value: a.value
        })),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left
        }
      };
    })()`,
    (result, isException) => {
      // Send to background script for caching (and panel will listen)
      chrome.runtime.sendMessage({
        type: 'DEVTOOLS_ELEMENT_SELECTED',
        element: isException ? null : result,
        tabId: chrome.devtools.inspectedWindow.tabId,
      });
    }
  );
});

// Notify background when DevTools is closed
window.addEventListener('unload', () => {
  chrome.runtime.sendMessage({
    type: 'DEVTOOLS_CLOSED',
    tabId: chrome.devtools.inspectedWindow.tabId,
  });
});
