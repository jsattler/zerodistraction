// TODO: The URL matching should be solid and use something that does not require a breaking change.
// I need to do some research on this.
const PatternMatcher = {
  matchPattern(pattern, url) {
    if (!pattern.includes('://') && !pattern.includes('/')) {
      return this.matchDomain(pattern, url);
    }

    try {
      const urlObj = new URL(url);

      const patternMatch = pattern.match(/^([^:]+):\/\/([^\/]+)(.*)$/);
      if (!patternMatch) {
        return false;
      }

      const [, scheme, host, path] = patternMatch;

      if (scheme !== '*' && scheme !== urlObj.protocol.slice(0, -1)) {
        return false;
      }

      if (scheme === '*' && !['http', 'https'].includes(urlObj.protocol.slice(0, -1))) {
        return false;
      }

      if (!this.matchHost(host, urlObj.hostname)) {
        return false;
      }

      const urlPath = urlObj.pathname + urlObj.search;
      if (!this.matchPath(path, urlPath)) {
        return false;
      }

      return true;
    } catch (error) {
      return this.matchDomain(pattern, url);
    }
  },

  matchHost(hostPattern, hostname) {
    if (hostPattern === '*') {
      return true;
    }

    if (hostPattern === hostname) {
      return true;
    }

    if (hostPattern.startsWith('*.')) {
      const baseDomain = hostPattern.slice(2);
      return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    }

    return false;
  },

  matchPath(pathPattern, urlPath) {
    if (!pathPattern || pathPattern === '') {
      pathPattern = '/*';
    }

    if (pathPattern === '/*') {
      return true;
    }

    const regexPattern = pathPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    const regex = new RegExp('^' + regexPattern + '$');
    return regex.test(urlPath);
  },

  matchDomain(pattern, url) {
    const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const cleanPattern = pattern.replace(/^https?:\/\//, '');

    let matchPattern = cleanPattern;
    if (!matchPattern.startsWith('*')) {
      matchPattern = '*.' + matchPattern;
    }

    const regexPattern = matchPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp('^' + regexPattern + '$', 'i');
    const result = regex.test(cleanUrl) || cleanUrl === cleanPattern; // Also match exact domain

    return result;
  },

  globMatch(pattern, url) {
    return this.matchPattern(pattern, url);
  },

  matchesAnyPattern(url, patterns) {
    return patterns.some(pattern => this.matchPattern(pattern, url));
  },

  isValidUrlPattern(pattern) {
    if (!pattern || typeof pattern !== 'string') return false;

    pattern = pattern.trim();
    if (pattern.length === 0) return false;

    if (pattern.includes('://')) {
      try {
        const match = pattern.match(/^([^:]+):\/\/([^\/]+)(.*)$/);
        if (!match) return false;

        const [, scheme, host, path] = match;

        if (scheme !== '*' && !['http', 'https', 'ws', 'wss', 'ftp'].includes(scheme)) {
          return false;
        }

        if (!host || host.length === 0) return false;

        if (path && !path.startsWith('/')) return false;

        return true;
      } catch (error) {
        return false;
      }
    }

    return pattern.includes('.') || pattern.includes('*') || pattern.length > 3;
  },

  parsePatterns(input) {
    if (!input || typeof input !== 'string') return [];

    return input
      .split('\n')
      .map(line => line.trim())
      .filter(line => this.isValidUrlPattern(line));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PatternMatcher;
} else {
  window.PatternMatcher = PatternMatcher;
}
