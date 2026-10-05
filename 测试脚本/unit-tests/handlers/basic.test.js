import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/basic.js';

describe('basic.parse', () => {
    it('hp → subtype hp', () => {
        const result = parse('hp');
        expect(result.type).toBe('basic');
        expect(result.subtype).toBe('hp');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
    });

    it('ac=10+AbilityModifiers(4) → subtype ac', () => {
        const result = parse('ac=10+AbilityModifiers(4)');
        expect(result.type).toBe('basic');
        expect(result.subtype).toBe('ac');
        expect(result.success).toBe(true);
        expect(result.formula).toBe('10+AbilityModifiers(4)');
    });

    it('ac=10+DEX → 非标准公式', () => {
        const result = parse('ac=10+DEX');
        expect(result.type).toBe('basic');
        expect(result.subtype).toBe('ac');
        expect(result.success).toBe(true);
        expect(result.formula).toBe('10+DEX');
    });

    it('speed+10 → subtype speed，value=10', () => {
        const result = parse('speed+10');
        expect(result.subtype).toBe('speed');
        expect(result.value).toBe(10);
        expect(result.success).toBe(true);
    });

    it('speed+0 → value=0 边界', () => {
        const result = parse('speed+0');
        expect(result.subtype).toBe('speed');
        expect(result.value).toBe(0);
        expect(result.success).toBe(true);
    });

    it('hp_per_lv+2 → subtype hp_per_lv，value=2', () => {
        const result = parse('hp_per_lv+2');
        expect(result.subtype).toBe('hp_per_lv');
        expect(result.value).toBe(2);
        expect(result.success).toBe(true);
    });

    it('hp_per_lv+0 → value=0 边界', () => {
        const result = parse('hp_per_lv+0');
        expect(result.subtype).toBe('hp_per_lv');
        expect(result.value).toBe(0);
        expect(result.success).toBe(true);
    });

    it('hp_per_lv+abc → value=0 非数字后缀', () => {
        const result = parse('hp_per_lv+abc');
        expect(result.subtype).toBe('hp_per_lv');
        expect(result.value).toBe(0);
        expect(result.success).toBe(true);
    });

    it('ability(1)+2 → subtype ability_bonus', () => {
        const result = parse('ability(1)+2');
        expect(result.subtype).toBe('ability_bonus');
        expect(result.abilityId).toBe(1);
        expect(result.value).toBe(2);
        expect(result.success).toBe(true);
    });

    it('ability(4)-1 → 负值', () => {
        const result = parse('ability(4)-1');
        expect(result.subtype).toBe('ability_bonus');
        expect(result.abilityId).toBe(4);
        expect(result.value).toBe(-1);
    });

    it('ac+2 → subtype ac_bonus', () => {
        const result = parse('ac+2');
        expect(result.subtype).toBe('ac_bonus');
        expect(result.value).toBe(2);
        expect(result.success).toBe(true);
    });

    it('ability(25)+3 → 大 ID（魅力）', () => {
        const result = parse('ability(25)+3');
        expect(result.subtype).toBe('ability_bonus');
        expect(result.abilityId).toBe(25);
        expect(result.value).toBe(3);
        expect(result.success).toBe(true);
    });

    it('character(直接显示) → subtype display', () => {
        const result = parse('character(直接显示)');
        expect(result.subtype).toBe('display');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
    });

    it('character(获得黑暗视觉) → 不匹配直接显示，回退到未匹配', () => {
        const result = parse('character(获得黑暗视觉)');
        expect(result.type).toBe('basic');
        expect(result.success).toBe(false);
    });

    it('空字符串 → success=false', () => {
        const result = parse('');
        expect(result.type).toBe('basic');
        expect(result.success).toBe(false);
        expect(result.needUserSelect).toBe(false);
    });

    it('null → success=false', () => {
        const result = parse(null);
        expect(result.type).toBe('basic');
        expect(result.success).toBe(false);
        expect(result.needUserSelect).toBe(false);
    });

    it('未匹配规则 → success=false', () => {
        const result = parse('xxx_unmatched');
        expect(result.type).toBe('basic');
        expect(result.success).toBe(false);
    });
});