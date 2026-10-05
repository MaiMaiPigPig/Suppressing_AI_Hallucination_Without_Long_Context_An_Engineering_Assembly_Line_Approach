/**
 * 单元测试：utils/html.js — escapeHtml
 * 来源：测试用例-V0.8-001_单元测试用例设计.md 模块 1（H-01 ~ H-13）
 */
import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../../TableChronicle/character/dnd_5r/utils/html.js';

describe('escapeHtml', () => {
    it('H-01 转义 < 和 > : "<script>" → "&lt;script&gt;"', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('H-02 转义 > : "a > b" → "a &gt; b"', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('H-03 转义 & : "&amp;" → "&amp;amp;"', () => {
        expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    });

    it('H-04 转义 " : \'"hello"\' → "&quot;hello&quot;"', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it("H-05 转义 ' : \"it's\" → \"it&#039;s\"", () => {
        expect(escapeHtml("it's")).toBe('it&#039;s');
    });

    it('H-06 混合多种特殊字符: "a & b \\"c\\"" → "a &amp; b &quot;c&quot;"', () => {
        expect(escapeHtml('a & b "c"')).toBe('a &amp; b &quot;c&quot;');
    });

    it('H-07 空字符串 → 空字符串', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('H-08 null → 空字符串', () => {
        expect(escapeHtml(null)).toBe('');
    });

    it('H-09 undefined → 空字符串', () => {
        expect(escapeHtml(undefined)).toBe('');
    });

    it('H-10 数字 0 → 空字符串（falsy 走短路）', () => {
        expect(escapeHtml(0)).toBe('');
    });

    it('H-11 false → 空字符串（falsy 走短路）', () => {
        expect(escapeHtml(false)).toBe('');
    });

    it('H-12 无特殊字符纯文本原样返回: "hello world"', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });

    it('H-13 非 falsy 数字先转字符串: 123 → "123"', () => {
        expect(escapeHtml(123)).toBe('123');
    });
});