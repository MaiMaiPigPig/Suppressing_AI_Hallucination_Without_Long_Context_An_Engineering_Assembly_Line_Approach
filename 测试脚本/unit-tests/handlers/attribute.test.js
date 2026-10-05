import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/attribute.js';

describe('attribute.parse', () => {
    it('AT-01：AbilityModifiers(1) → 力量', () => {
        const result = parse('AbilityModifiers(1)');
        expect(result.type).toBe('attribute');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
        expect(result.abilityId).toBe(1);
        expect(result.abilityKey).toBe('strength');
    });

    it('AT-02：AbilityModifiers(4) → 敏捷', () => {
        const result = parse('AbilityModifiers(4)');
        expect(result.abilityId).toBe(4);
        expect(result.abilityKey).toBe('dexterity');
    });

    it('AT-03：AbilityModifiers(9) → 体质', () => {
        const result = parse('AbilityModifiers(9)');
        expect(result.abilityId).toBe(9);
        expect(result.abilityKey).toBe('constitution');
    });

    it('AT-04：AbilityModifiers(11) → 智力', () => {
        const result = parse('AbilityModifiers(11)');
        expect(result.abilityId).toBe(11);
        expect(result.abilityKey).toBe('intelligence');
    });

    it('AT-05：AbilityModifiers(18) → 感知', () => {
        const result = parse('AbilityModifiers(18)');
        expect(result.abilityId).toBe(18);
        expect(result.abilityKey).toBe('wisdom');
    });

    it('AT-06：AbilityModifiers(25) → 魅力', () => {
        const result = parse('AbilityModifiers(25)');
        expect(result.abilityId).toBe(25);
        expect(result.abilityKey).toBe('charisma');
    });

    it('AT-07：abilitymodifiers(1) → 小写不区分', () => {
        const result = parse('abilitymodifiers(1)');
        expect(result.abilityId).toBe(1);
        expect(result.abilityKey).toBe('strength');
    });

    it('AT-08：AbilityModifiers( 4 ) → 括号空格容许', () => {
        const result = parse('AbilityModifiers( 4 )');
        expect(result.abilityId).toBe(4);
    });

    it('AT-09：AbilityModifiers(99) → 无效ID，abilityKey为undefined', () => {
        const result = parse('AbilityModifiers(99)');
        expect(result.success).toBe(true);
        expect(result.abilityId).toBe(99);
        expect(result.abilityKey).toBeUndefined();
    });

    it('AT-10：AbilityModifiers() → 空括号不匹配', () => {
        const result = parse('AbilityModifiers()');
        expect(result.success).toBe(false);
        expect(result.needUserSelect).toBe(false);
    });

    it('AT-11：AbilityModifiers(abc) → 非数字参数', () => {
        const result = parse('AbilityModifiers(abc)');
        expect(result.success).toBe(false);
    });

    it('AT-12：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('AT-13：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});