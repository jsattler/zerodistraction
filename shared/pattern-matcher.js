const PatternMatcher = {
  matchPattern(pattern, url) {
    try {
      const urlObj = new URL(url);
      const config = this.parseSimplifiedPattern(pattern);
      if (!config) return false;

      // Check protocol
      if (config.protocol !== '*' && config.protocol !== urlObj.protocol.slice(0, -1)) {
        return false;
      }

      // Check hostname
      if (!this.matchHostname(config.hostname, urlObj.hostname)) {
        return false;
      }

      // Check pathname
      if (!this.matchPathname(config.pathname, urlObj.pathname + urlObj.search)) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Pattern matching error:', error);
      return false;
    }
  },

  parseSimplifiedPattern(pattern) {
    if (!pattern || typeof pattern !== 'string') {
      return null;
    }

    pattern = pattern.trim();

    // Handle full URLs with scheme
    const fullUrlMatch = pattern.match(/^(https?):\/\/(.+)$/);
    if (fullUrlMatch) {
      const [, protocol, rest] = fullUrlMatch;
      const pathIndex = rest.indexOf('/');

      if (pathIndex === -1) {
        // No path specified: https://domain.com
        const hostname = this.expandHostname(rest);
        return {
          protocol,
          hostname,
          pathname: '*'
        };
      } else {
        // Path specified: https://domain.com/path
        const hostname = this.expandHostname(rest.substring(0, pathIndex));
        const pathname = this.expandPath(rest.substring(pathIndex));
        return {
          protocol,
          hostname,
          pathname
        };
      }
    }

    // Handle URLs without scheme
    const pathIndex = pattern.indexOf('/');
    if (pathIndex === -1) {
      // Just domain: domain.com
      return {
        protocol: '*',
        hostname: this.expandHostname(pattern),
        pathname: '*'
      };
    } else {
      // Domain with path: domain.com/path
      const hostname = this.expandHostname(pattern.substring(0, pathIndex));
      const pathname = this.expandPath(pattern.substring(pathIndex));
      return {
        protocol: '*',
        hostname,
        pathname
      };
    }
  },

  matchHostname(pattern, hostname) {
    if (pattern === '*') return true;
    if (pattern === hostname) return true;

    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.slice(2);
      return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    }

    return false;
  },

  matchPathname(pattern, pathname) {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return pathname.startsWith(pattern.slice(0, -1));
    }
    return pathname === pattern;
  },

  expandHostname(hostname) {
    // If hostname already has wildcard, use as-is
    if (hostname.includes('*')) {
      return hostname;
    }

    // If hostname has subdomain (more than 2 parts), match exactly
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return hostname;
    }

    // Otherwise, match all subdomains
    return `*.${hostname}`;
  },

  expandPath(path) {
    // If path already ends with *, use as-is
    if (path.endsWith('*')) {
      return path;
    }

    // Otherwise, match this path and all sub-paths
    return `${path}*`;
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

    try {
      const config = this.parseSimplifiedPattern(pattern);
      return config !== null;
    } catch (error) {
      return false;
    }
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
