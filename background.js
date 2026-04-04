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
  const timerStatus = await Timer.getStatus();
  if (timerStatus.isActive) return true;

  // Check weekly schedule
  const isScheduled = await Schedule.isInScheduledWindow();
  if (isScheduled) return true;

  return false;
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

// Update badge based on timer or schedule status
async function updateBadge() {
  const timerStatus = await Timer.getStatus();
  if (timerStatus.isActive) {
    browser.browserAction.setBadgeText({ text: "✅" });
    browser.browserAction.setBadgeBackgroundColor({ color: "#22c55e" });
    return;
  }

  // Check schedule
  const scheduleActive = await Schedule.isInScheduledWindow();
  if (scheduleActive) {
    browser.browserAction.setBadgeText({ text: "✅" });
    browser.browserAction.setBadgeBackgroundColor({ color: "#22c55e" });
  } else {
    browser.browserAction.setBadgeText({ text: "" });
  }
}

// Initialize badge on startup
updateBadge();

// If timer is already active on startup, start background polling for expiration
Timer.getStatus().then(status => {
  if (status.isActive) {
    Timer.startUpdates(updateBadge, () => {
      updateBadge();
    });
  }
});

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

    // Update badge when timer status changes
    updateBadge();

    try {
      const tabs = await browser.tabs.query({});
      if (newSettings && newSettings.enabled) {
        // Timer started — begin background polling for expiration
        Timer.startUpdates(updateBadge, () => {
          updateBadge();
        });
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, { action: 'timerStarted' }).catch(() => { });
        });
      } else {
        // Timer stopped — stop background polling
        Timer.stopUpdates();
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, { action: 'timerStopped' }).catch(() => { });
        });
      }
    } catch (error) {
      console.error('Error sending timer status message:', error);
    }
  }
});

// Schedule polling: check every 30 seconds if schedule state changed
let schedulePollingInterval = null;
let lastScheduleActive = false;

async function checkScheduleState() {
  const isActive = await Schedule.isInScheduledWindow();

  if (isActive !== lastScheduleActive) {
    lastScheduleActive = isActive;
    updateBadge();

    // Notify all tabs
    try {
      const tabs = await browser.tabs.query({});
      const action = isActive ? 'timerStarted' : 'timerStopped';
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, { action }).catch(() => {});
      });
    } catch (error) {
      console.error('Error notifying tabs of schedule change:', error);
    }
  }
}

function startSchedulePolling() {
  if (schedulePollingInterval) return;
  schedulePollingInterval = setInterval(checkScheduleState, 30000);
  checkScheduleState(); // Run immediately
}

function stopSchedulePolling() {
  if (schedulePollingInterval) {
    clearInterval(schedulePollingInterval);
    schedulePollingInterval = null;
  }
}

// Start schedule polling if schedule is enabled
Storage.loadSchedule().then(schedule => {
  if (schedule && schedule.enabled) {
    startSchedulePolling();
  }
});

// Listen for schedule changes
Storage.onScheduleChanged((newSchedule) => {
  if (newSchedule && newSchedule.enabled) {
    startSchedulePolling();
  } else {
    stopSchedulePolling();
    lastScheduleActive = false;
  }
  updateBadge();
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

// Context menu: "Block this site"
browser.menus.create({
  id: 'block-current-site',
  title: 'Add to blocklist',
  contexts: ['page'],
  icons: {
    '16': 'icons/blob.svg'
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'block-current-site') return;

  if (!tab || !tab.url || !tab.url.startsWith('http')) return;

  try {
    const url = new URL(tab.url);
    let domain = url.hostname;

    // Strip www. prefix so the pattern matches all subdomains
    if (domain.startsWith('www.')) {
      domain = domain.slice(4);
    }

    const result = await Storage.addAdditionalUrl(domain);

    // Flash badge feedback: "+" for newly added, "=" for already blocked
    browser.browserAction.setBadgeText({ text: result.added ? '+' : '=' });
    browser.browserAction.setBadgeBackgroundColor({ color: result.added ? '#22c55e' : '#f59e0b' });

    setTimeout(() => {
      updateBadge();
    }, 2000);
  } catch (error) {
    console.error('Error blocking site from context menu:', error);
  }
});
