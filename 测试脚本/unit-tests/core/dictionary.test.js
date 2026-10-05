import { describe, it, expect, beforeEach } from 'vitest';
import {
    initDictionaryMaps,
    translateDamageType,
    translateProperties,
    getSchoolMap,
    getFeatTypeMap,
    getWeaponTypeMap
} from '../../../TableChronicle/character/dnd_5r/core/data/dictionary.js';

const mockCache = {
    dictionary: [
        { id: 47, name_en: 'Acid', name: '强酸' },
        { id: 49, name_en: 'Cold', name: '寒冷' },
        { id: 50, name_en: 'Fire', name: '火焰' },
        { id: 7, name: '防护' },
        { id: 8, name: '咒法' },
        { id: 9, name: '预言' },
        { id: 10, name: '惑控' },
        { id: 11, name: '塑能' },
        { id: 12, name: '幻术' },
        { id: 13, name: '死灵' },
        { id: 14, name: '变化' },
        { id: 42, name: '起源专长' },
        { id: 43, name: '通用专长' },
        { id: 44, name: '战斗风格专长' },
        { id: 45, name: '传奇恩惠专长' },
        { id: 46, name: '专长类型' },
        { id: 61, name: '近战武器' },
        { id: 62, name: '远程武器' },
        { id: 63, name: '简易武器' },
        { id: 64, name: '军用武器' },
        { id: 65, name: '武器类型' }
    ],
    weaponProperties: [
        { id: 1, name: '弹药' },
        { id: 2, name: '灵巧' },
        { id: 3, name: '重型' },
        { id: 6, name: '射程' },
        { id: 7, name: '触及' }
    ]
};

describe('translateDamageType', () => {
    beforeEach(() => {
        initDictionaryMaps(mockCache);
    });

    it('cold → 寒冷', () => {
        expect(translateDamageType('Cold')).toBe('寒冷');
    });

    it('acid → 强酸（小写输入）', () => {
        expect(translateDamageType('acid')).toBe('强酸');
    });

    it('FIRE → 火焰（全大写输入）', () => {
        expect(translateDamageType('FIRE')).toBe('火焰');
    });

    it('未映射返回原值', () => {
        expect(translateDamageType('nonexist')).toBe('nonexist');
    });

    it('null 返回 —', () => {
        expect(translateDamageType(null)).toBe('—');
    });

    it('空字符串返回 —', () => {
        expect(translateDamageType('')).toBe('—');
    });

    it('— 返回 —', () => {
        expect(translateDamageType('—')).toBe('—');
    });
});

describe('translateProperties', () => {
    beforeEach(() => {
        initDictionaryMaps(mockCache);
    });

    it('数组输入 [1, 2, 3] → 中文名顿号连接', () => {
        const result = translateProperties([1, 2, 3]);
        expect(result).toContain('弹药');
        expect(result).toContain('灵巧');
    });

    it('字符串输入 "1,2,3"', () => {
        const result = translateProperties('1,2,3');
        expect(result).toContain('弹药');
        expect(result).toContain('灵巧');
    });

    it('无效 ID 99 原样返回', () => {
        expect(translateProperties('99')).toBe('99');
    });

    it('混合有效/无效 ID "1,99" 同时包含翻译名和原值', () => {
        const result = translateProperties('1,99');
        expect(result).toContain('弹药');
        expect(result).toContain('99');
    });

    it('null 返回 —', () => {
        expect(translateProperties(null)).toBe('—');
    });

    it('— 返回 —', () => {
        expect(translateProperties('—')).toBe('—');
    });

    it('--- 归一化为 —', () => {
        expect(translateProperties('---')).toBe('—');
    });

    it('空字符串返回 —', () => {
        expect(translateProperties('')).toBe('—');
    });
});

describe('getSchoolMap', () => {
    beforeEach(() => {
        initDictionaryMaps(mockCache);
    });

    it('返回正确的学派映射', () => {
        const map = getSchoolMap();
        expect(map[7]).toBe('防护');
        expect(map[10]).toBe('惑控');
        expect(map[14]).toBe('变化');
    });
});

describe('getFeatTypeMap', () => {
    beforeEach(() => {
        initDictionaryMaps(mockCache);
    });

    it('返回正确的专长类型映射', () => {
        const map = getFeatTypeMap();
        expect(map[42]).toBe('起源专长');
        expect(map[44]).toBe('战斗风格专长');
        expect(map[45]).toBe('传奇恩惠专长');
    });
});

describe('getWeaponTypeMap', () => {
    beforeEach(() => {
        initDictionaryMaps(mockCache);
    });

    it('返回正确的武器类型映射', () => {
        const map = getWeaponTypeMap();
        expect(map[61]).toBe('近战武器');
        expect(map[65]).toBe('武器类型');
    });
});

describe('空数据回退', () => {
    it('空缓存不抛错，所有查询返回原值', () => {
        initDictionaryMaps({});
        expect(translateDamageType('cold')).toBe('cold');
        expect(translateProperties('1')).toBe('1');
        expect(getSchoolMap()).toEqual({});
    });

    it('undefined 缓存不抛错', () => {
        initDictionaryMaps(null);
        expect(translateDamageType('cold')).toBe('cold');
    });
});