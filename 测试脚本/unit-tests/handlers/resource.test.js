import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/resource.js';

describe('resource.parse', () => {
    it('R-01：Character(狂暴)+1 → add 子模式', () => {
        const result = parse('Character(狂暴)+1');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('add');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
        expect(result.resourceName).toBe('狂暴');
        expect(result.value).toBe(1);
    });

    it('R-02：Character(气) → reference 子模式', () => {
        const result = parse('Character(气)');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('reference');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
        expect(result.resourceName).toBe('气');
        expect(result.value).toBe(0);
    });

    it('R-03：Character(动作如潮)+2 → 多中文字符资源名', () => {
        const result = parse('Character(动作如潮)+2');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('add');
        expect(result.resourceName).toBe('动作如潮');
        expect(result.value).toBe(2);
    });

    it('R-04：Character(生命骰) → 含生僻字资源名', () => {
        const result = parse('Character(生命骰)');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('reference');
        expect(result.resourceName).toBe('生命骰');
        expect(result.value).toBe(0);
    });

    it('R-05：character(狂暴)+1 → 小写不区分', () => {
        const result = parse('character(狂暴)+1');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('add');
        expect(result.resourceName).toBe('狂暴');
        expect(result.value).toBe(1);
    });

    it('R-06：Character( 狂暴 )+1 → 括号内空格容许', () => {
        const result = parse('Character( 狂暴 )+1');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('add');
        expect(result.resourceName).toBe('狂暴');
        expect(result.value).toBe(1);
    });

    it('R-07：Character(不屈)+0 → +0 边界', () => {
        const result = parse('Character(不屈)+0');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('add');
        expect(result.resourceName).toBe('不屈');
        expect(result.value).toBe(0);
    });

    it('R-08：Character(不屈)+999 → 大数值', () => {
        const result = parse('Character(不屈)+999');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('add');
        expect(result.resourceName).toBe('不屈');
        expect(result.value).toBe(999);
    });

    it('R-09：Character( 不屈 ) → 末尾+括号空格 trim', () => {
        const result = parse('Character( 不屈 ) ');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('reference');
        expect(result.resourceName).toBe('不屈');
        expect(result.value).toBe(0);
    });

    it('R-10：Character() → 空资源名不匹配', () => {
        const result = parse('Character()');
        expect(result.success).toBe(false);
        expect(result.needUserSelect).toBe(false);
    });

    it('R-11：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
        expect(result.needUserSelect).toBe(false);
    });

    it('R-12：null → success=false', () => {
        const result = parse(null);
        expect(result.type).toBe('resource');
        expect(result.success).toBe(false);
        expect(result.needUserSelect).toBe(false);
    });

    it('R-13：Character(获得黑暗视觉) → 中文资源名', () => {
        const result = parse('Character(获得黑暗视觉)');
        expect(result.type).toBe('resource');
        expect(result.subtype).toBe('reference');
        expect(result.success).toBe(true);
        expect(result.resourceName).toBe('获得黑暗视觉');
        expect(result.value).toBe(0);
    });

    it('R-14：some_random → 非 resource 格式', () => {
        const result = parse('some_random');
        expect(result.success).toBe(false);
        expect(result.needUserSelect).toBe(false);
    });
});