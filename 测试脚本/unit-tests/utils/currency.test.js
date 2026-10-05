/**
 * 单元测试：utils/currency.js — parsePrice / toCP / formatCurrency
 * 来源：测试用例-V0.8-001_单元测试用例设计.md 模块 2（C-01 ~ C-30）
 */
import { describe, it, expect } from 'vitest';
import { parsePrice, toCP, formatCurrency } from '../../../TableChronicle/character/dnd_5r/utils/currency.js';

describe('parsePrice', () => {
    it('C-01 小写英文单位: "5gp" → { value:5, unit:"GP" }', () => {
        expect(parsePrice('5gp')).toEqual({ value: 5, unit: 'GP' });
    });

    it('C-02 大写英文: "5GP" → { value:5, unit:"GP" }', () => {
        expect(parsePrice('5GP')).toEqual({ value: 5, unit: 'GP' });
    });

    it('C-03 小数空格分隔: "2.5 PP" → { value:2.5, unit:"PP" }', () => {
        expect(parsePrice('2.5 PP')).toEqual({ value: 2.5, unit: 'PP' });
    });

    it('C-04 小于1的小数: "0.5gp" → { value:0.5, unit:"GP" }', () => {
        expect(parsePrice('0.5gp')).toEqual({ value: 0.5, unit: 'GP' });
    });

    it('C-05 中文"金币" → GP: "10金币"', () => {
        expect(parsePrice('10金币')).toEqual({ value: 10, unit: 'GP' });
    });

    it('C-06 中文"银币" → SP: "10银币"', () => {
        expect(parsePrice('10银币')).toEqual({ value: 10, unit: 'SP' });
    });

    it('C-07 中文"铜币" → CP: "10铜币"', () => {
        expect(parsePrice('10铜币')).toEqual({ value: 10, unit: 'CP' });
    });

    it('C-08 中文"铂金币" → PP: "10铂金币"', () => {
        expect(parsePrice('10铂金币')).toEqual({ value: 10, unit: 'PP' });
    });

    it('C-09 中文"银金币" → EP: "10银金币"', () => {
        expect(parsePrice('10银金币')).toEqual({ value: 10, unit: 'EP' });
    });

    it('C-10 纯数字无单位默认GP: "100"', () => {
        expect(parsePrice('100')).toEqual({ value: 100, unit: 'GP' });
    });

    it('C-11 空字符串兜底: "" → { value:0, unit:"GP" }', () => {
        expect(parsePrice('')).toEqual({ value: 0, unit: 'GP' });
    });

    it('C-12 字符串"null"兜底: "null" → { value:0, unit:"GP" }', () => {
        expect(parsePrice('null')).toEqual({ value: 0, unit: 'GP' });
    });

    it('C-13 字符串"0"兜底: "0" → { value:0, unit:"GP" }', () => {
        expect(parsePrice('0')).toEqual({ value: 0, unit: 'GP' });
    });

    it('C-14 完全不匹配正则: "abc" → { value:0, unit:"GP" }', () => {
        expect(parsePrice('abc')).toEqual({ value: 0, unit: 'GP' });
    });

    it('C-15 多组货币只取第一组: "1sp 2cp" → { value:1, unit:"SP" }', () => {
        expect(parsePrice('1sp 2cp')).toEqual({ value: 1, unit: 'SP' });
    });
});

describe('toCP', () => {
    it('C-16 1pp = 1000cp', () => {
        expect(toCP('1pp')).toBe(1000);
    });

    it('C-17 1gp = 100cp', () => {
        expect(toCP('1gp')).toBe(100);
    });

    it('C-18 1ep = 50cp', () => {
        expect(toCP('1ep')).toBe(50);
    });

    it('C-19 1sp = 10cp', () => {
        expect(toCP('1sp')).toBe(10);
    });

    it('C-20 1cp = 1cp', () => {
        expect(toCP('1cp')).toBe(1);
    });

    it('C-21 多组货币只取第一组: "2GP 5SP" → 200', () => {
        expect(toCP('2GP 5SP')).toBe(200);
    });
});

describe('formatCurrency', () => {
    it('C-22 零值: 0 → "0GP"', () => {
        expect(formatCurrency(0)).toBe('0GP');
    });

    it('C-23 单CP不进位: 1 → "1CP"', () => {
        expect(formatCurrency(1)).toBe('1CP');
    });

    it('C-24 10cp=1sp: 10 → "1SP"', () => {
        expect(formatCurrency(10)).toBe('1SP');
    });

    it('C-25 50cp=1ep: 50 → "1EP"', () => {
        expect(formatCurrency(50)).toBe('1EP');
    });

    it('C-26 100cp=1gp: 100 → "1GP"', () => {
        expect(formatCurrency(100)).toBe('1GP');
    });

    it('C-27 1000cp=1pp: 1000 → "1PP"', () => {
        expect(formatCurrency(1000)).toBe('1PP');
    });

    it('C-28 150cp = 1GP + 1EP（50进位为EP）', () => {
        expect(formatCurrency(150)).toBe('1GP 1EP');
    });

    it('C-29 1160cp = 1PP + 1GP + 1EP + 1SP', () => {
        expect(formatCurrency(1160)).toBe('1PP 1GP 1EP 1SP');
    });

    it('C-30 1234cp完整进位: 1PP 2GP 3SP 4CP', () => {
        expect(formatCurrency(1234)).toBe('1PP 2GP 3SP 4CP');
    });
});