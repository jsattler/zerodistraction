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
    }
  },

  DEFAULT_OPTIONS: {
    socialEnabled: true,
    newsEnabled: true,
    entertainmentEnabled: true,
    exceptions: '',
    additionalUrls: ''
  },

  DEFAULT_SCHEDULE: {
    enabled: false,
    schedulePausedUntil: null,  // timestamp: schedule paused until this time (STOP button)
    days: {
      0: [],  // Sunday    - array of { start: "HH:MM", end: "HH:MM" }
      1: [],  // Monday
      2: [],  // Tuesday
      3: [],  // Wednesday
      4: [],  // Thursday
      5: [],  // Friday
      6: []   // Saturday
    }
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

  // Add a domain to the additional URLs blocklist
  async addAdditionalUrl(domain) {
    const options = await this.loadUserOptions();
    const existing = (options.additionalUrls || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (existing.includes(domain)) {
      return { added: false, duplicate: true };
    }

    existing.push(domain);
    options.additionalUrls = existing.join('\n');
    await this.saveUserOptions(options);
    return { added: true, duplicate: false };
  },

  // Load weekly schedule from local storage
  async loadSchedule() {
    try {
      const result = await browser.storage.local.get(['zerodistraction.schedule']);
      const storedSchedule = result && result['zerodistraction.schedule'];
      return storedSchedule ? { ...this.DEFAULT_SCHEDULE, ...storedSchedule } : { ...this.DEFAULT_SCHEDULE };
    } catch (error) {
      console.error('Error loading schedule:', error);
      return { ...this.DEFAULT_SCHEDULE };
    }
  },

  // Save weekly schedule to local storage
  async saveSchedule(schedule) {
    try {
      await browser.storage.local.set({ 'zerodistraction.schedule': schedule });
    } catch (error) {
      console.error('Error saving schedule:', error);
      throw error;
    }
  },

  // Listen for schedule changes
  onScheduleChanged(callback) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes['zerodistraction.schedule']) {
        const newValue = changes['zerodistraction.schedule'].newValue || { ...this.DEFAULT_SCHEDULE };
        callback(newValue);
      }
    });
  },

  // Listen for timer settings changes
  onTimerSettingsChanged(callback) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes['zerodistraction.settings']) {
        const newValue = changes['zerodistraction.settings'].newValue || { ...this.DEFAULT_SETTINGS };
        callback(newValue);
      }
    });
  },

  // Listen for user options changes (blocklists, exceptions, additional URLs)
  onUserOptionsChanged(callback) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes['zerodistraction.options']) {
        const newValue = changes['zerodistraction.options'].newValue || { ...this.DEFAULT_OPTIONS };
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