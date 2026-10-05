import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/operation.js';

describe('operation.parse', () => {
    it('OP-01：skill+1 → 技能+1', () => {
        const result = parse('skill+1');
        expect(result.type).toBe('operation');
        expect(result.category).toBe('skills');
        expect(result.subtype).toBe('skill_add');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(true);
        expect(result.count).toBe(1);
    });

    it('OP-02：技能+2 → 中文+2', () => {
        const result = parse('技能+2');
        expect(result.subtype).toBe('skill_add');
        expect(result.count).toBe(2);
    });

    it('OP-03：skill+0 → +0 边界', () => {
        const result = parse('skill+0');
        expect(result.subtype).toBe('skill_add');
        expect(result.count).toBe(0);
    });

    it('OP-04：skill(all) → 全部技能', () => {
        const result = parse('skill(all)');
        expect(result.subtype).toBe('skill_all');
        expect(result.needUserSelect).toBe(false);
    });

    it('OP-05：Skill( All ) → 大小写+空格', () => {
        const result = parse('Skill( All )');
        expect(result.subtype).toBe('skill_all');
        expect(result.needUserSelect).toBe(false);
    });

    it('OP-06：工具+1 → 工具熟练', () => {
        const result = parse('工具+1');
        expect(result.category).toBe('tools');
        expect(result.subtype).toBe('tool_add');
        expect(result.count).toBe(1);
    });

    it('OP-07：工具+3 → 工具选3', () => {
        const result = parse('工具+3');
        expect(result.subtype).toBe('tool_add');
        expect(result.count).toBe(3);
    });

    it('OP-08：language+2 → 语言', () => {
        const result = parse('language+2');
        expect(result.category).toBe('languages');
        expect(result.subtype).toBe('language_add');
        expect(result.count).toBe(2);
    });

    it('OP-09：Language+5 → 大小写不区分', () => {
        const result = parse('Language+5');
        expect(result.subtype).toBe('language_add');
        expect(result.count).toBe(5);
    });

    it('OP-10：skill+ → 缺数量', () => {
        const result = parse('skill+');
        expect(result.success).toBe(false);
    });

    it('OP-11：random → 无关输入', () => {
        const result = parse('random');
        expect(result.success).toBe(false);
    });

    it('OP-12：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('OP-13：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});