import { describe, it, expect, beforeAll } from 'vitest';
import { replacePlaceholdersInText } from '../../../TableChronicle/character/dnd_5r/core/data/loader.js';
import { initDictionaryMaps } from '../../../TableChronicle/character/dnd_5r/core/data/dictionary.js';

const mockCache = {
    dictionary: [
        { id: 47, name_en: 'Acid', name: '强酸' },
        { id: 49, name_en: 'Cold', name: '寒冷' },
        { id: 50, name_en: 'Fire', name: '火焰' },
        { id: 51, name_en: 'Force', name: '力场' },
        { id: 53, name_en: 'Lightning', name: '闪电' },
        { id: 54, name_en: 'Necrotic', name: '黯蚀' },
        { id: 55, name_en: 'Piercing', name: '穿刺' },
        { id: 57, name_en: 'Poison', name: '毒素' },
        { id: 58, name_en: 'Psychic', name: '心灵' }
    ],
    weaponProperties: []
};

describe('replacePlaceholdersInText', () => {
    beforeAll(() => {
        initDictionaryMaps(mockCache);
    });

    it('%x% 替换为 rules 字段值', () => {
        const result = replacePlaceholdersInText('伤害 %x% 点', { rules: '1d8', dice: '1d6' });
        expect(result).toBe('伤害 1d8 点');
    });

    it('%y% 替换为 damage_type，并翻译英文伤害类型 cold → 寒冷', () => {
        const result = replacePlaceholdersInText('伤害类型 %y%', { damage_type: 'cold' });
        expect(result).toBe('伤害类型 寒冷');
    });

    it('%y% 已是中文时不二次翻译', () => {
        const result = replacePlaceholdersInText('伤害类型 %y%', { damage_type: '寒冷' });
        expect(result).toBe('伤害类型 寒冷');
    });

    it('冷冻射线完整格式 "%x%点%y%伤害" → "1d8点寒冷伤害"', () => {
        const result = replacePlaceholdersInText('受到%x%点%y%伤害', { rules: '1d8', damage_type: 'cold', dice: '1d8,2d8,3d8,4d8' });
        expect(result).toBe('受到1d8点寒冷伤害');
    });

    it('%x1% 和 %x2% 逐个替换 rules 中逗号分隔的值', () => {
        const result = replacePlaceholdersInText('%x1% + %x2%', { rules: '1d8, 2d6' });
        expect(result).toBe('1d8 + 2d6');
    });

    it('%y1% 和 %y2% 逐个替换并翻译英文伤害类型', () => {
        const result = replacePlaceholdersInText('%y1% / %y2%', { damage_type: 'fire, cold' });
        expect(result).toBe('火焰 / 寒冷');
    });

    it('空 text 返回空字符串', () => {
        expect(replacePlaceholdersInText('', { rules: '1d8' })).toBe('');
    });

    it('null text 返回空字符串', () => {
        expect(replacePlaceholdersInText(null, { rules: '1d8' })).toBe('');
    });

    it('null item 返回原文本', () => {
        expect(replacePlaceholdersInText('伤害 %x%', null)).toBe('伤害 %x%');
    });

    it('空 item 无 rules/dice 返回原文本', () => {
        expect(replacePlaceholdersInText('伤害 %x%', {})).toBe('伤害 %x%');
    });

    it('%x% 无 rules 时回退到 dice', () => {
        const result = replacePlaceholdersInText('伤害 %x% 点', { dice: '1d6' });
        expect(result).toBe('伤害 1d6 点');
    });

    it('%y% 含 / 分隔复合值：psychic/penalty → 心灵/减值', () => {
        const result = replacePlaceholdersInText('%y%', { damage_type: 'psychic/penalty' });
        expect(result).toBe('心灵/减值');
    });

    it('%y1%/%y2% 索引展开 /：psychic/penalty → 心灵 / 减值', () => {
        const result = replacePlaceholdersInText('%y1% / %y2%', { damage_type: 'psychic/penalty' });
        expect(result).toBe('心灵 / 减值');
    });

    it('choose_ 格式：choose_acid_cold_fire → 强酸/寒冷/火焰', () => {
        const result = replacePlaceholdersInText('%y%', { damage_type: 'choose_acid_cold_fire' });
        expect(result).toBe('强酸/寒冷/火焰');
    });

    it('%x1%/%x2%/%x3% 三段索引替换', () => {
        const result = replacePlaceholdersInText('%x1%/%x2%/%x3%', { rules: '1d8,2d8,3d8' });
        expect(result).toBe('1d8/2d8/3d8');
    });

    it('%x99% 索引超出保留原文', () => {
        const result = replacePlaceholdersInText('伤害 %x99%', { rules: '1d8' });
        expect(result).toBe('伤害 %x99%');
    });

    it('%y99% 索引超出保留原文', () => {
        const result = replacePlaceholdersInText('伤害 %y99%', { damage_type: 'cold' });
        expect(result).toBe('伤害 %y99%');
    });

    it('环位效果: %x%点%y%伤害 → rules 第一段 + 翻译', () => {
        const result = replacePlaceholdersInText('环位效果: %x%点%y%伤害', { rules: '2d8', damage_type: 'fire' });
        expect(result).toBe('环位效果: 2d8点火焰伤害');
    });

    it('持续 %x% 轮：纯数字走 rules 第一段', () => {
        const result = replacePlaceholdersInText('持续 %x% 轮', { rules: '3' });
        expect(result).toBe('持续 3 轮');
    });

    it('伤害 %x% 空 item 无 rules/dice 返回原文', () => {
        const result = replacePlaceholdersInText('伤害 %x%', {});
        expect(result).toBe('伤害 %x%');
    });

    it('伤害 %y% 空 item 无 damage_type 返回原文', () => {
        const result = replacePlaceholdersInText('伤害 %y%', {});
        expect(result).toBe('伤害 %y%');
    });

    it('无占位符文本原样返回', () => {
        const result = replacePlaceholdersInText('无占位符文本', { rules: '1d8' });
        expect(result).toBe('无占位符文本');
    });
});