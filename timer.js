const Timer = {
  timerInterval: null,
  isRunning: false,
  onTimerUpdate: null,
  onTimerExpired: null,

  async start(durationMinutes) {
    const settings = await Storage.loadTimerSettings();

    settings.enabled = true;
    settings.startTime = Date.now();
    settings.duration = durationMinutes;

    await Storage.saveTimerSettings(settings);
    this.isRunning = true;

    return settings;
  },

  async stop() {
    const settings = await Storage.loadTimerSettings();

    settings.enabled = false;
    settings.startTime = null;

    await Storage.saveTimerSettings(settings);
    this.isRunning = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Stop any ongoing updates
    this.stopUpdates();

    return settings;
  },

  async getStatus() {
    const settings = await Storage.loadTimerSettings();
    return this.calculateTimerStatus(settings);
  },

  calculateTimerStatus(settings) {
    if (!settings.enabled || !settings.startTime || !settings.duration) {
      return {
        isActive: false,
        timeRemaining: 0,
        totalDuration: settings.duration || 30,
        progress: 0,
        endTime: null
      };
    }

    const now = Date.now();
    const endTime = settings.startTime + (settings.duration * 60 * 1000);
    const timeRemaining = Math.max(0, endTime - now);
    const totalDuration = settings.duration * 60 * 1000;
    const elapsed = totalDuration - timeRemaining;
    const progress = elapsed / totalDuration;

    return {
      isActive: timeRemaining > 0,
      timeRemaining,
      totalDuration,
      progress: Math.min(1, Math.max(0, progress)),
      endTime,
      expired: timeRemaining <= 0
    };
  },

  async isActive() {
    const status = await this.getStatus();
    return status.isActive;
  },

  startUpdates(updateCallback, expiredCallback) {
    this.onTimerUpdate = updateCallback;
    this.onTimerExpired = expiredCallback;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.updateTimer();

    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  },

  stopUpdates() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.onTimerUpdate = null;
    this.onTimerExpired = null;
  },

  async updateTimer() {
    const settings = await Storage.loadTimerSettings();
    const status = this.calculateTimerStatus(settings);

    if (status.expired && settings.enabled) {
      await this.stop();
      if (this.onTimerExpired) {
        this.onTimerExpired();
      }
      return;
    }

    if (this.onTimerUpdate) {
      this.onTimerUpdate(status);
    }
  },

  onTimerChanged(callback) {
    Storage.onTimerSettingsChanged((newSettings) => {
      const status = this.calculateTimerStatus(newSettings);
      callback(status);
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Timer;
} else {
  window.Timer = Timer;
}
