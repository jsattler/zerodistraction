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
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MiscUtils;
} else {
  window.MiscUtils = MiscUtils;
}