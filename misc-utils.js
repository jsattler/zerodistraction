const MiscUtils = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  clearIntervalSafely(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      return null;
    }
    return intervalId;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MiscUtils;
} else {
  window.MiscUtils = MiscUtils;
}