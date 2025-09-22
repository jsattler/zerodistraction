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
  console.log('DistractionBlock extension installed');
});

browser.runtime.onStartup.addListener(() => {
  loadBlocklists();
});

loadBlocklists();

Storage.onUserOptionsChanged((changes) => {
  console.log('Blocking settings updated:', changes);
});

Storage.onTimerSettingsChanged((newSettings) => {
  console.log('Timer settings updated:', newSettings);
});
