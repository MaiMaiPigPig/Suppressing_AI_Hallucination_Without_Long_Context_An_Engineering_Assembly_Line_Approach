import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/feat-require.js';

describe('featRequire.parse', () => {
    it('FR-01：1,4,9,11,18,25+2 → 全属性+2', () => {
        const result = parse('1,4,9,11,18,25+2');
        expect(result.type).toBe('feat-require');
        expect(result.subtype).toBe('ability_boost');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(true);
        expect(result.abilityIds).toEqual([1, 4, 9, 11, 18, 25]);
        expect(result.boost).toBe(2);
        expect(result.count).toBe(1);
    });

    it('FR-02：1, 4+1 → 部分属性提升', () => {
        const result = parse('1, 4+1');
        expect(result.type).toBe('feat-require');
        expect(result.category).toBe('ability');
        expect(result.subtype).toBe('ability_boost');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(true);
        expect(result.abilityIds).toEqual([1, 4]);
        expect(result.boost).toBe(1);
        expect(result.count).toBe(1);
    });

    it('FR-03：lv=4 → 等级等于', () => {
        const result = parse('lv=4');
        expect(result.subtype).toBe('level_equal');
        expect(result.needUserSelect).toBe(false);
        expect(result.requiredLevel).toBe(4);
    });

    it('FR-04：lv=1 → 最小等级', () => {
        const result = parse('lv=1');
        expect(result.subtype).toBe('level_equal');
        expect(result.requiredLevel).toBe(1);
    });

    it('FR-05：lv>=4 → 等级最低', () => {
        const result = parse('lv>=4');
        expect(result.subtype).toBe('level_min');
        expect(result.requiredLevel).toBe(4);
    });

    it('FR-06：lv>=20 → 最高等级要求', () => {
        const result = parse('lv>=20');
        expect(result.subtype).toBe('level_min');
        expect(result.requiredLevel).toBe(20);
    });

    it('FR-07：ability(4)>=13 → 单属性要求', () => {
        const result = parse('ability(4)>=13');
        expect(result.subtype).toBe('ability_min');
        expect(result.abilityId).toBe(4);
        expect(result.requiredValue).toBe(13);
    });

    it('FR-08：ability(4|18)>=13 → 多属性任选', () => {
        const result = parse('ability(4|18)>=13');
        expect(result.subtype).toBe('ability_or');
        expect(result.abilityIds).toEqual([4, 18]);
        expect(result.requiredValue).toBe(13);
    });

    it('FR-09：feature(战斗风格：防御) → 特性要求', () => {
        const result = parse('feature(战斗风格：防御)');
        expect(result.subtype).toBe('feature_required');
        expect(result.featureNames).toEqual(['战斗风格：防御']);
    });

    it('FR-10：feature(Defense|Protection) → 多选项', () => {
        const result = parse('feature(Defense|Protection)');
        expect(result.subtype).toBe('feature_required');
        expect(result.featureNames).toEqual(['Defense', 'Protection']);
    });

    it('FR-11：armor_trained(light) → 护甲受训', () => {
        const result = parse('armor_trained(light)');
        expect(result.subtype).toBe('armor_trained');
        expect(result.armorType).toBe('light');
    });

    it('FR-12：armor_trained(Heavy) → 大小写→小写', () => {
        const result = parse('armor_trained(Heavy)');
        expect(result.subtype).toBe('armor_trained');
        expect(result.armorType).toBe('heavy');
    });

    it('FR-13：Lv=4 → 大小写不区分', () => {
        const result = parse('Lv=4');
        expect(result.subtype).toBe('level_equal');
        expect(result.requiredLevel).toBe(4);
    });

    it('FR-14：1,2,3+5 → 非属性ID列表', () => {
        const result = parse('1,2,3+5');
        expect(result.success).toBe(false);
    });

    it('FR-15：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('FR-16：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});