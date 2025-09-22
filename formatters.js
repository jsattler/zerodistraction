const Formatters = {
  formatTimeRemaining(milliseconds) {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  formatDuration(minutes) {
    if (minutes === 0) return '0 minutes';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  },

  calculateProgress(elapsed, total) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Formatters;
} else {
  window.Formatters = Formatters;
}