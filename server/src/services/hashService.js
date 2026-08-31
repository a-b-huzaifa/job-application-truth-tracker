import crypto from 'crypto';

/**
 * Computes a SHA-256 hex digest of the normalized input text.
 * Trims leading/trailing whitespace to avoid cache misses due to superficial spacing.
 * 
 * @param {string} text - The input text (e.g. job description)
 * @returns {string} SHA-256 hex digest (64 characters)
 */
export function hashText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('hashText expects a string input');
  }
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

export default {
  hashText,
};
