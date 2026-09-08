import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('escapes markup and quotes in nicknames', () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>`)).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`Tom & "Jerry"'s`)).toBe('Tom &amp; &quot;Jerry&quot;&#39;s');
  });
});
