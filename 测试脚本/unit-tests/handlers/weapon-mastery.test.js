import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/weapon-mastery.js';

describe('weaponMastery.parse', () => {
    it('WM-01：Weapon>mastery → 基本格式', () => {
        const result = parse('Weapon>mastery');
        expect(result.type).toBe('weapon_mastery');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
    });

    it('WM-02：weapon>mastery → 小写不区分', () => {
        const result = parse('weapon>mastery');
        expect(result.success).toBe(true);
    });

    it('WM-03：Weapon > mastery → 空格容许', () => {
        const result = parse('Weapon > mastery');
        expect(result.success).toBe(true);
    });

    it('WM-04：Weapon>Mastery → 大小写混合', () => {
        const result = parse('Weapon>Mastery');
        expect(result.success).toBe(true);
    });

    it('WM-05：Weapon>master → 拼写不完整', () => {
        const result = parse('Weapon>master');
        expect(result.success).toBe(false);
        expect(result.message).toContain('格式错误');
    });

    it('WM-06：weaponmastery → 无 > 分隔', () => {
        const result = parse('weaponmastery');
        expect(result.success).toBe(false);
        expect(result.message).toContain('格式错误');
    });

    it('WM-07：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('WM-08：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
        expect(result.message).toContain('格式错误');
    });
});