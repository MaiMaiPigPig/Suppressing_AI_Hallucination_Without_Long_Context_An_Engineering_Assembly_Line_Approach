import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/special.js';

describe('special.parse', () => {
    it('SP-01：二选一 → choose_one 中文', () => {
        const result = parse('二选一');
        expect(result.type).toBe('special');
        expect(result.subtype).toBe('choose_one');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
    });

    it('SP-02：choose → choose_one 英文', () => {
        const result = parse('choose');
        expect(result.subtype).toBe('choose_one');
        expect(result.success).toBe(true);
    });

    it('SP-03：环位：+1 → upcast +1', () => {
        const result = parse('环位：+1');
        expect(result.subtype).toBe('upcast');
        expect(result.success).toBe(true);
        expect(result.value).toBe(1);
    });

    it('SP-04：环位：+5 → upcast +5', () => {
        const result = parse('环位：+5');
        expect(result.subtype).toBe('upcast');
        expect(result.value).toBe(5);
    });

    it('SP-05：环位： + 3 → 空格容许', () => {
        const result = parse('环位： + 3');
        expect(result.subtype).toBe('upcast');
        expect(result.value).toBe(3);
    });

    it('SP-06：环位： → 缺少数值', () => {
        const result = parse('环位：');
        expect(result.success).toBe(false);
    });

    it('SP-07：random → 无关输入', () => {
        const result = parse('random');
        expect(result.success).toBe(false);
    });

    it('SP-08：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('SP-09：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});