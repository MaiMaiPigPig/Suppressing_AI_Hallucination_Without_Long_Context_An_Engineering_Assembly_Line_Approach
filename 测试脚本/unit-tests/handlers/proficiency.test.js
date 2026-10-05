import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/proficiency.js';

describe('proficiency.parse', () => {
    it('PF-01：Proficiency>pure+2 → 选2个', () => {
        const result = parse('Proficiency>pure+2');
        expect(result.type).toBe('proficiency');
        expect(result.subtype).toBe('pure_add');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(true);
        expect(result.count).toBe(2);
    });

    it('PF-02：Proficiency>pure+1 → 选1个', () => {
        const result = parse('Proficiency>pure+1');
        expect(result.subtype).toBe('pure_add');
        expect(result.count).toBe(1);
    });

    it('PF-03：Proficiency>pure+99 → 大数值', () => {
        const result = parse('Proficiency>pure+99');
        expect(result.subtype).toBe('pure_add');
        expect(result.count).toBe(99);
    });

    it('PF-04：Proficiency>pure(1,10,17)+1 → 指定列表', () => {
        const result = parse('Proficiency>pure(1,10,17)+1');
        expect(result.subtype).toBe('pure_list');
        expect(result.needUserSelect).toBe(true);
        expect(result.skillIds).toEqual([1, 10, 17]);
        expect(result.count).toBe(1);
    });

    it('PF-05：Proficiency>pure(1, 10, 17)+2 → 列表内空格', () => {
        const result = parse('Proficiency>pure(1, 10, 17)+2');
        expect(result.subtype).toBe('pure_list');
        expect(result.skillIds).toEqual([1, 10, 17]);
        expect(result.count).toBe(2);
    });

    it('PF-06：Proficiency>pure(1)+3 → 单ID列表', () => {
        const result = parse('Proficiency>pure(1)+3');
        expect(result.subtype).toBe('pure_list');
        expect(result.skillIds).toEqual([1]);
        expect(result.count).toBe(3);
    });

    it('PF-07：Proficiency>pure → 全部升级，不需选择', () => {
        const result = parse('Proficiency>pure');
        expect(result.subtype).toBe('pure_all');
        expect(result.needUserSelect).toBe(false);
    });

    it('PF-08：proficiency>pure+1 → 小写不区分', () => {
        const result = parse('proficiency>pure+1');
        expect(result.subtype).toBe('pure_add');
        expect(result.count).toBe(1);
    });

    it('PF-09：Proficiency > pure + 3 → 空格>不匹配，回退失败', () => {
        const result = parse('Proficiency > pure + 3');
        expect(result.success).toBe(false);
    });

    it('PF-10：Proficiency>pure+ → 缺数量', () => {
        const result = parse('Proficiency>pure+');
        expect(result.success).toBe(false);
    });

    it('PF-11：random → 无关输入', () => {
        const result = parse('random');
        expect(result.success).toBe(false);
    });

    it('PF-12：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('PF-13：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});