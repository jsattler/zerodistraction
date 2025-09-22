const DomUtils = {
  querySelector(selector, parent = document) {
    try {
      return parent.querySelector(selector);
    } catch (error) {
      console.warn(`Failed to query selector "${selector}":`, error);
      return null;
    }
  },

  querySelectorAll(selector, parent = document) {
    try {
      return parent.querySelectorAll(selector);
    } catch (error) {
      console.warn(`Failed to query selector all "${selector}":`, error);
      return [];
    }
  },

  addEventListener(element, event, handler, options = {}) {
    if (!element || !event || !handler) return null;

    element.addEventListener(event, handler, options);

    return () => {
      element.removeEventListener(event, handler, options);
    };
  },

  openOptionsPage() {
    if (browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else {
      window.open(browser.runtime.getURL('options.html'));
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DomUtils;
} else {
  window.DomUtils = DomUtils;
}