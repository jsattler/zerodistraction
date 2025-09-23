// Centralized storage interface for DistractionBlock extension

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined' && browser) || (typeof chrome !== 'undefined' && chrome);

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
    try {
      const result = await browser.storage.local.get(['zerodistraction.settings']);
      const storedSettings = result && result['zerodistraction.settings'];
      const settings = storedSettings ? { ...this.DEFAULT_SETTINGS, ...storedSettings } : { ...this.DEFAULT_SETTINGS };
      return settings;
    } catch (error) {
      console.error('Error loading timer settings:', error);
      return { ...this.DEFAULT_SETTINGS };
    }
  },

  // Save timer settings to local storage
  async saveTimerSettings(settings) {
    try {
      await browser.storage.local.set({ 'zerodistraction.settings': settings });
    } catch (error) {
      console.error('Error saving timer settings:', error);
      throw error;
    }
  },

  // Load user options from local storage
  async loadUserOptions() {
    try {
      const result = await browser.storage.local.get(['zerodistraction.options']);
      const storedOptions = result && result['zerodistraction.options'];
      const finalOptions = storedOptions ? { ...this.DEFAULT_OPTIONS, ...storedOptions } : { ...this.DEFAULT_OPTIONS };
      return finalOptions;
    } catch (error) {
      console.error('Error loading user options:', error);
      return { ...this.DEFAULT_OPTIONS };
    }
  },

  // Save user options to local storage
  async saveUserOptions(options) {
    try {
      await browser.storage.local.set({ 'zerodistraction.options': options });
    } catch (error) {
      console.error('Error saving user options:', error);
      throw error;
    }
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