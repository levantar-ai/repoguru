import { detectBrowser } from './browserDetect';

export interface HumanizedError {
  title: string;
  body: string;
  tip?: string;
}

const FIREFOX_STORAGE_TIP =
  'Firefox limits IndexedDB to ~250 MB per site. You can increase this in about:config \u2192 dom.indexedDB.dataThreshold, or try Chrome which allows larger storage.';

export function humanizeCloneError(rawMessage: string): HumanizedError {
  const browser = detectBrowser();
  const msg = rawMessage.toLowerCase();

  // Storage / quota errors
  if (
    msg.includes('serialized value is too large') ||
    msg.includes('quotaexceedederror') ||
    msg.includes('quota')
  ) {
    return {
      title: 'This repository is too large for in-browser storage',
      body: 'The cloned data exceeds your browser\u2019s IndexedDB size limit. Try a smaller repository.',
      tip: browser === 'firefox' ? FIREFOX_STORAGE_TIP : undefined,
    };
  }

  // Timeout
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return {
      title: 'Clone timed out',
      body: 'This repository may be too large to clone in the browser. Try a smaller repo or check your network connection.',
    };
  }

  // Not found
  if (msg.includes('404') || msg.includes('not found')) {
    return {
      title: 'Repository not found',
      body: 'Check the owner/repo name. If the repo is private, add a GitHub token in Settings.',
    };
  }

  // Rate limit
  if (msg.includes('403') || msg.includes('rate limit') || msg.includes('rate_limit')) {
    return {
      title: 'GitHub rate limit reached',
      body: 'Add a GitHub token in Settings for 5,000 requests per hour (vs. 60 without a token).',
    };
  }

  // Auth errors
  if (msg.includes('401') || msg.includes('bad credentials') || msg.includes('unauthorized')) {
    return {
      title: 'GitHub token expired or revoked',
      body: 'Your session has been cleared. Reconnect via Settings to continue using private repos.',
    };
  }

  // Default fallback
  return {
    title: 'Something went wrong cloning this repository',
    body: rawMessage,
    tip:
      browser === 'firefox' && (msg.includes('indexeddb') || msg.includes('idb'))
        ? FIREFOX_STORAGE_TIP
        : undefined,
  };
}

/** Format a HumanizedError into a single error string with optional tip delimiter */
export function formatHumanizedError(err: HumanizedError): string {
  let result = `${err.title}. ${err.body}`;
  if (err.tip) {
    result += `|||${err.tip}`;
  }
  return result;
}

/** Parse a formatted error string back into parts */
export function parseErrorWithTip(error: string): { message: string; tip?: string } {
  const parts = error.split('|||');
  return {
    message: parts[0],
    tip: parts[1] || undefined,
  };
}
