import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/level.js';

describe('level.parse', () => {
    it('LV-01：lv:class(6) → simple 引用', () => {
        const result = parse('lv:class(6)');
        expect(result.type).toBe('level');
        expect(result.subtype).toBe('simple');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
        expect(result.classId).toBe(6);
    });

    it('LV-02：lv:class(1) → 不同职业ID', () => {
        const result = parse('lv:class(1)');
        expect(result.subtype).toBe('simple');
        expect(result.classId).toBe(1);
    });

    it('LV-03：lv:class(6)=10 → 等值判断', () => {
        const result = parse('lv:class(6)=10');
        expect(result.subtype).toBe('equal');
        expect(result.classId).toBe(6);
        expect(result.targetLevel).toBe(10);
    });

    it('LV-04：lv:class(1)=1 → 最小等级', () => {
        const result = parse('lv:class(1)=1');
        expect(result.subtype).toBe('equal');
        expect(result.classId).toBe(1);
        expect(result.targetLevel).toBe(1);
    });

    it('LV-05：lv:class(1)*0.5>↓ → 乘算向下取整', () => {
        const result = parse('lv:class(1)*0.5>↓');
        expect(result.subtype).toBe('multiply');
        expect(result.classId).toBe(1);
        expect(result.multiplier).toBe(0.5);
        expect(result.round).toBe('↓');
    });

    it('LV-06：lv:class(6)*2>↑ → 乘算向上取整', () => {
        const result = parse('lv:class(6)*2>↑');
        expect(result.subtype).toBe('multiply');
        expect(result.classId).toBe(6);
        expect(result.multiplier).toBe(2);
        expect(result.round).toBe('↑');
    });

    it('LV-07：Lv:Class(6) → 大小写不区分', () => {
        const result = parse('Lv:Class(6)');
        expect(result.subtype).toBe('simple');
        expect(result.classId).toBe(6);
    });

    it('LV-08：lv:class( 6 ) → 括号空格容许', () => {
        const result = parse('lv:class( 6 )');
        expect(result.classId).toBe(6);
    });

    it('LV-09：lv:class(6)*0.5 > ↓ → 全空格', () => {
        const result = parse('lv:class(6)*0.5 > ↓');
        expect(result.subtype).toBe('multiply');
        expect(result.multiplier).toBe(0.5);
        expect(result.round).toBe('↓');
    });

    it('LV-10：lv:class( 6 ) = 10 → 空格 around =', () => {
        const result = parse('lv:class( 6 ) = 10');
        expect(result.subtype).toBe('equal');
        expect(result.classId).toBe(6);
        expect(result.targetLevel).toBe(10);
    });

    it('LV-11：lv:class(0) → classId=0 边界', () => {
        const result = parse('lv:class(0)');
        expect(result.subtype).toBe('simple');
        expect(result.classId).toBe(0);
    });

    it('LV-12：lv:class(999) → 大ID', () => {
        const result = parse('lv:class(999)');
        expect(result.subtype).toBe('simple');
        expect(result.classId).toBe(999);
    });

    it('LV-13：lv:class() → 空括号不匹配', () => {
        const result = parse('lv:class()');
        expect(result.success).toBe(false);
    });

    it('LV-14：lv:class(1)*0.5> → 缺取整方向', () => {
        const result = parse('lv:class(1)*0.5>');
        expect(result.success).toBe(false);
    });

    it('LV-15：lv:class(6)= → 缺目标等级', () => {
        const result = parse('lv:class(6)=');
        expect(result.success).toBe(false);
    });

    it('LV-16：random_text → 无关输入', () => {
        const result = parse('random_text');
        expect(result.success).toBe(false);
    });

    it('LV-17：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('LV-18：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});