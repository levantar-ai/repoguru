import { describe, it, expect } from 'vitest';
import { decodeBase64 } from '../base64';

describe('decodeBase64', () => {
  it('decodes a simple ASCII base64 string', () => {
    // "Hello, World!" in base64
    const encoded = btoa('Hello, World!');
    expect(decodeBase64(encoded)).toBe('Hello, World!');
  });

  it('decodes an empty base64 string', () => {
    expect(decodeBase64(btoa(''))).toBe('');
  });

  it('handles input with newlines by stripping them before decoding', () => {
    // Base64 content often comes with line breaks (e.g., from GitHub API)
    const original = 'This is a test string.';
    const encoded = btoa(original);
    // Insert newlines into the encoded string to simulate chunked base64
    const withNewlines = encoded.slice(0, 4) + '\n' + encoded.slice(4, 8) + '\n' + encoded.slice(8);
    expect(decodeBase64(withNewlines)).toBe(original);
  });

  it('handles input with multiple consecutive newlines', () => {
    const original = 'Multiple newlines test';
    const encoded = btoa(original);
    const withNewlines = encoded.slice(0, 2) + '\n\n\n' + encoded.slice(2);
    expect(decodeBase64(withNewlines)).toBe(original);
  });

  it('returns the decoded string correctly for longer content', () => {
    const original = 'The quick brown fox jumps over the lazy dog. 0123456789!@#$%^&*()';
    const encoded = btoa(original);
    expect(decodeBase64(encoded)).toBe(original);
  });

  it('decodes base64 with special ASCII characters', () => {
    const original = 'line1\nline2\ttab';
    const encoded = btoa(original);
    expect(decodeBase64(encoded)).toBe(original);
  });

  it('decodes a known base64 value', () => {
    // "SGVsbG8=" is base64 for "Hello"
    expect(decodeBase64('SGVsbG8=')).toBe('Hello');
  });

  it('handles base64 content without padding', () => {
    // "Zm9v" is base64 for "foo" (no padding needed)
    expect(decodeBase64('Zm9v')).toBe('foo');
  });
});
