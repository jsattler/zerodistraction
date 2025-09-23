// Centralized storage interface for DistractionBlock extension

const Storage = {
  // Default settings structure
  DEFAULT_SETTINGS: {
    enabled: false,
    startTime: null,
    duration: 30,
    blocklists: {
      social: true,
      news: true,
      entertainment: true
    },
    exceptions: []
  },

  DEFAULT_OPTIONS: {
    socialEnabled: true,
    newsEnabled: true,
    entertainmentEnabled: true,
    exceptions: '',
    additionalUrls: ''
  },

  // Load timer settings from local storage
  async loadTimerSettings() {
    return new Promise((resolve) => {
      browser.storage.local.get(['zerodistraction.settings'], (result) => {
        const storedSettings = result && result['zerodistraction.settings'];
        const settings = storedSettings ? { ...this.DEFAULT_SETTINGS, ...storedSettings } : { ...this.DEFAULT_SETTINGS };
        resolve(settings);
      });
    });
  },

  // Save timer settings to local storage
  async saveTimerSettings(settings) {
    return new Promise((resolve) => {
      browser.storage.local.set({ 'zerodistraction.settings': settings }, () => {
        resolve();
      });
    });
  },

  // Load user options from local storage
  async loadUserOptions() {
    return new Promise((resolve, reject) => {
      browser.storage.local.get(['zerodistraction.options'], (result) => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
        } else {
          const storedOptions = result && result['zerodistraction.options'];
          const finalOptions = storedOptions ? { ...this.DEFAULT_OPTIONS, ...storedOptions } : { ...this.DEFAULT_OPTIONS };
          resolve(finalOptions);
        }
      });
    });
  },

  // Save user options to local storage
  async saveUserOptions(options) {
    return new Promise((resolve, reject) => {
      browser.storage.local.set({ 'zerodistraction.options': options }, () => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  // Get complete settings (merges timer settings with user options)
  async getCompleteSettings() {
    const [timerSettings, userOptions] = await Promise.all([
      this.loadTimerSettings(),
      this.loadUserOptions()
    ]);

    // Merge user options into timer settings
    timerSettings.blocklists = {
      social: userOptions.socialEnabled,
      news: userOptions.newsEnabled,
      entertainment: userOptions.entertainmentEnabled
    };

    // Parse exceptions and additional URLs
    timerSettings.exceptions = (userOptions.exceptions || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    timerSettings.additionalUrls = (userOptions.additionalUrls || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return timerSettings;
  },

  // Listen for storage changes
  onTimerSettingsChanged(callback) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes['zerodistraction.settings']) {
        const newValue = changes['zerodistraction.settings'].newValue || { ...this.DEFAULT_SETTINGS };
        callback(newValue);
      }
    });
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
} else {
  window.Storage = Storage;
}