let blocklistCache = {
  social: [],
  news: [],
  entertainment: []
};

async function loadBlocklists() {
  try {
    const responses = await Promise.all([
      fetch(browser.runtime.getURL('blocklists/social.json')),
      fetch(browser.runtime.getURL('blocklists/news.json')),
      fetch(browser.runtime.getURL('blocklists/entertainment.json'))
    ]);

    const [socialData, newsData, entertainmentData] = await Promise.all(
      responses.map(response => response.json())
    );

    blocklistCache.social = socialData;
    blocklistCache.news = newsData;
    blocklistCache.entertainment = entertainmentData;

  } catch (error) {
    console.error('Error loading blocklists:', error);
  }
}

async function isBlockingActive() {
  const status = await Timer.getStatus();
  return status.isActive;
}

async function shouldBlockUrl(url) {
  if (!(await isBlockingActive())) {
    return false;
  }

  const settings = await Storage.getCompleteSettings();

  if (PatternMatcher.matchesAnyPattern(url, settings.exceptions)) {
    return false;
  }

  if (settings.additionalUrls && PatternMatcher.matchesAnyPattern(url, settings.additionalUrls)) {
    return true;
  }

  for (const [listName, enabled] of Object.entries(settings.blocklists)) {
    if (enabled && blocklistCache[listName]) {
      if (PatternMatcher.matchesAnyPattern(url, blocklistCache[listName])) {
        return true;
      }
    }
  }

  return false;
}

browser.webRequest.onBeforeRequest.addListener(
  async function(details) {
    if (details.type !== 'main_frame') {
      return {};
    }

    if (await shouldBlockUrl(details.url)) {
      browser.tabs.update(details.tabId, {
        url: browser.runtime.getURL('blocked.html')
      });

      return { cancel: true };
    }

    return {};
  },
  {
    urls: ['<all_urls>']
  },
  ['blocking']
);

browser.runtime.onInstalled.addListener(() => {
  loadBlocklists();
  console.log('ZeroDistraction extension installed');
});

browser.runtime.onStartup.addListener(() => {
  loadBlocklists();
});

loadBlocklists();

// Listen for storage changes to notify content scripts
browser.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes['zerodistraction.options']) {
    // User options changed
    try {
      const tabs = await browser.tabs.query({});
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, { action: 'settingsChanged' }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
    } catch (error) {
      console.error('Error sending settingsChanged message:', error);
    }
  }

  if (areaName === 'local' && changes['zerodistraction.settings']) {
    const newSettings = changes['zerodistraction.settings'].newValue;
    try {
      const tabs = await browser.tabs.query({});
      if (newSettings && newSettings.enabled) {
        // Timer started
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, { action: 'timerStarted' }).catch(() => {});
        });
      } else {
        // Timer stopped
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, { action: 'timerStopped' }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('Error sending timer status message:', error);
    }
  }
});

// Handle messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkUrl') {
    shouldBlockUrl(message.url).then(shouldBlock => {
      sendResponse({ shouldBlock });
    });
    return true; // Keep message channel open for async response
  }
});
