// Content script to handle blocking on page refresh/navigation only
(function() {
  let isPageFullyLoaded = false;
  let hasCheckedOnLoad = false;

  async function shouldCurrentPageBeBlocked() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'checkUrl',
        url: window.location.href
      });
      return response && response.shouldBlock;
    } catch (error) {
      return false;
    }
  }

  async function checkAndRedirectIfNeeded() {
    if (await shouldCurrentPageBeBlocked()) {
      // Store the current URL to pass to blocked.html
      const currentUrl = window.location.href;
      const blockedPageUrl = browser.runtime.getURL('blocked.html') + '?originalUrl=' + encodeURIComponent(currentUrl);

      // Use location.replace() to replace current entry instead of adding new one
      // This way, when user goes back from blocked.html, they'll go to the previous page
      // before the blocked page, not the blocked page itself
      window.location.replace(blockedPageUrl);
    }
  }

  // Only check when the page is initially loading or being refreshed
  function checkOnPageLoad() {
    if (!hasCheckedOnLoad) {
      hasCheckedOnLoad = true;
      checkAndRedirectIfNeeded();
    }
  }

  // Listen for page visibility changes (tab switches, etc.)
  function handleVisibilityChange() {
    // Only check if the page becomes visible and hasn't been fully loaded yet
    if (!document.hidden && !isPageFullyLoaded) {
      checkAndRedirectIfNeeded();
    }
  }

  // Listen for page load events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkOnPageLoad);
  } else {
    // Document already loaded, check immediately
    checkOnPageLoad();
  }

  // Mark page as fully loaded
  window.addEventListener('load', () => {
    isPageFullyLoaded = true;
  });

  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Listen for messages from background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'settingsChanged') {
      // Always check when settings change, regardless of page load status
      checkAndRedirectIfNeeded();
    } else if (message.action === 'timerStarted') {
      // When timer starts, only check if page is not fully loaded
      if (!isPageFullyLoaded) {
        checkAndRedirectIfNeeded();
      }
    }
    // Note: Removed timerStopped handling since we don't need to stop checking
  });
})();