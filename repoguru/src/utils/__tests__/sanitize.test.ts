import { describe, it, expect } from 'vitest';
import { sanitizeText, escapeHtml } from '../sanitize';

describe('sanitizeText', () => {
  it('strips <script> tags', () => {
    const input = 'Hello <script>alert("xss")</script> world';
    const result = sanitizeText(input);
    expect(result).not.toContain('<script');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('strips <script> tags with attributes', () => {
    const input = '<script type="text/javascript">evil()</script>';
    const result = sanitizeText(input);
    expect(result).not.toContain('<script');
  });

  it('strips <script> tags case-insensitively', () => {
    const input = '<SCRIPT>bad()</SCRIPT>';
    const result = sanitizeText(input);
    expect(result).not.toContain('<SCRIPT');
    expect(result).not.toContain('<script');
  });

  it('strips onclick attributes', () => {
    const input = '<div onclick="evil()">Click</div>';
    const result = sanitizeText(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('Click');
  });

  it('strips onmouseover attributes', () => {
    const input = '<img onmouseover ="alert(1)" />';
    const result = sanitizeText(input);
    expect(result).not.toMatch(/onmouseover\s*=/);
  });

  it('strips onerror attributes', () => {
    const input = '<img onerror="hack()" src="x" />';
    const result = sanitizeText(input);
    expect(result).not.toMatch(/onerror\s*=/);
  });

  it('strips javascript: URIs', () => {
    const input = '<a href="javascript:void(0)">link</a>';
    const result = sanitizeText(input);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('link');
  });

  it('strips javascript: URIs case-insensitively', () => {
    const input = 'JAVASCRIPT:alert(1)';
    const result = sanitizeText(input);
    expect(result).not.toMatch(/javascript:/i);
  });

  it('preserves normal text without dangerous patterns', () => {
    const input = 'This is a perfectly safe string with <b>bold</b> text.';
    const result = sanitizeText(input);
    expect(result).toBe(input);
  });

  it('preserves an empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('handles multiple dangerous patterns in one string', () => {
    const input = '<script>x</script> onclick="y" javascript:z';
    const result = sanitizeText(input);
    expect(result).not.toContain('<script');
    expect(result).not.toMatch(/onclick\s*=/);
    expect(result).not.toContain('javascript:');
  });
});

describe('escapeHtml', () => {
  it('encodes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('encodes less-than sign', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('encodes greater-than sign', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('encodes double quotes', () => {
    expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
  });

  it('encodes single quotes', () => {
    expect(escapeHtml("a 'b' c")).toBe('a &#039;b&#039; c');
  });

  it('encodes all special characters together', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('preserves normal text without special characters', () => {
    const input = 'Hello World 123';
    expect(escapeHtml(input)).toBe(input);
  });

  it('handles an empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
