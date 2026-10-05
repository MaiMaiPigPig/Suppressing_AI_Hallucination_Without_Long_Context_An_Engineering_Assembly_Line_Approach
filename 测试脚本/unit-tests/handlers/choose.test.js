import { describe, it, expect, beforeAll } from 'vitest';
import { splitArgs, parseCategory, parse } from '../../../TableChronicle/character/dnd_5r/handlers/choose.js';
import { initDictionaryMaps } from '../../../TableChronicle/character/dnd_5r/core/data/dictionary.js';

const mockCache = {
    dictionary: [
        { id: 61, name: '近战武器' },
        { id: 62, name: '远程武器' },
        { id: 63, name: '简易武器' },
        { id: 64, name: '军用武器' },
        { id: 65, name: '武器类型' },
        { id: 42, name: '起源专长' },
        { id: 44, name: '战斗风格专长' },
        { id: 45, name: '传奇恩惠专长' }
    ],
    weaponProperties: []
};

describe('choose.splitArgs', () => {
    it('CH-01：简单逗号分隔 "skill,tool(type=66)"', () => {
        const result = splitArgs('skill,tool(type=66)');
        expect(result).toEqual(['skill', 'tool(type=66)']);
    });

    it('CH-02："skill,language" → 两项', () => {
        const result = splitArgs('skill,language');
        expect(result).toEqual(['skill', 'language']);
    });

    it('CH-03：嵌套括号不被拆分 "weapon(type=61),skill"', () => {
        const result = splitArgs('weapon(type=61),skill');
        expect(result).toEqual(['weapon(type=61)', 'skill']);
    });

    it('CH-04：复杂嵌套 "spell(class=3,4,12,lv=0),skill"', () => {
        const result = splitArgs('spell(class=3,4,12,lv=0),skill');
        expect(result).toEqual(['spell(class=3,4,12,lv=0)', 'skill']);
    });

    it('CH-05：空字符串返回空数组', () => {
        const result = splitArgs('');
        expect(result).toEqual([]);
    });

    it('CH-06：单项无逗号', () => {
        const result = splitArgs('single');
        expect(result).toEqual(['single']);
    });

    it('CH-07：前后空格被 trim " skill , language "', () => {
        const result = splitArgs(' skill , language ');
        expect(result).toEqual(['skill', 'language']);
    });

    it('CH-08：多层嵌套括号 "a(b(c))"', () => {
        const result = splitArgs('a(b(c))');
        expect(result).toEqual(['a(b(c))']);
    });
});

describe('choose.parseCategory', () => {
    it('CH-09：skill 单数 → skills', () => {
        const result = parseCategory('skill');
        expect(result).not.toBeNull();
        expect(result.category).toBe('skills');
        expect(result.type).toBe('all');
        expect(result.jsonFile).toBe('skills');
    });

    it('CH-10：skills 复数 → skills', () => {
        const result = parseCategory('skills');
        expect(result).not.toBeNull();
        expect(result.category).toBe('skills');
        expect(result.type).toBe('all');
    });

    it('CH-11：language 单数 → languages', () => {
        const result = parseCategory('language');
        expect(result).not.toBeNull();
        expect(result.category).toBe('languages');
        expect(result.type).toBe('all');
        expect(result.jsonFile).toBe('languages');
    });

    it('CH-12：languages 复数 → languages', () => {
        const result = parseCategory('languages');
        expect(result).not.toBeNull();
        expect(result.category).toBe('languages');
        expect(result.type).toBe('all');
    });

    it('CH-13：tool(type=66) → 工匠工具', () => {
        const result = parseCategory('tool(type=66)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('tools');
        expect(result.typeId).toBe(66);
        expect(result.jsonFile).toBe('tools');
    });

    it('CH-14：tools(type=67) → 复数 tools', () => {
        const result = parseCategory('tools(type=67)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('tools');
        expect(result.typeId).toBe(67);
    });

    it('CH-15：weapon(type=61) → 近战武器', () => {
        const result = parseCategory('weapon(type=61)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('weapons');
        expect(result.typeId).toBe(61);
    });

    it('CH-16：weapons(type=62) → 复数 weapons', () => {
        const result = parseCategory('weapons(type=62)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('weapons');
        expect(result.typeId).toBe(62);
    });

    it('CH-17：spell(class=4,lv=0) → 德鲁伊戏法', () => {
        const result = parseCategory('spell(class=4,lv=0)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('spells');
        expect(result.classId).toBe(4);
        expect(result.level).toBe(0);
    });

    it('CH-18：spell(class=3,4,12) → 多职业无环位', () => {
        const result = parseCategory('spell(class=3,4,12)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('spells');
        expect(result.classIdList).toEqual([3, 4, 12]);
        expect(result.level).toBe(null);
    });

    it('CH-19：armor(type=10) → 护甲筛选', () => {
        const result = parseCategory('armor(type=10)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('armors');
        expect(result.typeId).toBe(10);
    });

    it('CH-20：feats(type=44) → 战斗风格专长', () => {
        const result = parseCategory('feats(type=44)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('feats');
        expect(result.typeId).toBe(44);
    });

    it('CH-21：feats(type=42) → 起源专长', () => {
        const result = parseCategory('feats(type=42)');
        expect(result).not.toBeNull();
        expect(result.category).toBe('feats');
        expect(result.typeId).toBe(42);
    });

    it('CH-22：unknown_type → null', () => {
        const result = parseCategory('unknown_type');
        expect(result).toBeNull();
    });

    it('CH-23：空字符串 → null', () => {
        const result = parseCategory('');
        expect(result).toBeNull();
    });
});

describe('choose.parse', () => {
    beforeAll(() => {
        initDictionaryMaps(mockCache);
    });

    it('CH-24：choose(skill,language)+2 → 基本多类别', () => {
        const result = parse('choose(skill,language)+2');
        expect(result.type).toBe('choose');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(true);
        expect(result.total).toBe(2);
        expect(result.categories).toHaveLength(2);
        expect(result.categories[0].category).toBe('skills');
        expect(result.categories[1].category).toBe('languages');
    });

    it('CH-25：choose(skill,tool(type=66))+3 → 含嵌套参数', () => {
        const result = parse('choose(skill,tool(type=66))+3');
        expect(result.success).toBe(true);
        expect(result.total).toBe(3);
        expect(result.categories).toHaveLength(2);
        expect(result.categories[1].typeId).toBe(66);
    });

    it('CH-26：choose(languages)+1 → 单类别', () => {
        const result = parse('choose(languages)+1');
        expect(result.success).toBe(true);
        expect(result.total).toBe(1);
        expect(result.categories).toHaveLength(1);
        expect(result.categories[0].category).toBe('languages');
    });

    it('CH-27：choose(weapon(type=61),armor(type=10))+2 → 武器+护甲', () => {
        const result = parse('choose(weapon(type=61),armor(type=10))+2');
        expect(result.success).toBe(true);
        expect(result.categories[0].category).toBe('weapons');
        expect(result.categories[1].category).toBe('armors');
    });

    it('CH-28：choose(feats(type=44))+1 → 专长单类别', () => {
        const result = parse('choose(feats(type=44))+1');
        expect(result.success).toBe(true);
        expect(result.categories[0].category).toBe('feats');
        expect(result.total).toBe(1);
    });

    it('CH-29：choose(spell(class=4,lv=0),skill)+2 → 法术+技能', () => {
        const result = parse('choose(spell(class=4,lv=0),skill)+2');
        expect(result.success).toBe(true);
        expect(result.categories[0].category).toBe('spells');
        expect(result.categories[1].category).toBe('skills');
    });

    it('CH-30：choose(skill) 缺少总数 → success=false', () => {
        const result = parse('choose(skill)');
        expect(result.type).toBe('choose');
        expect(result.success).toBe(false);
        expect(result.message).toContain('缺少总数');
    });

    it('CH-31：choose(skill,language 括号不匹配 → success=false', () => {
        const result = parse('choose(skill,language');
        expect(result.type).toBe('choose');
        expect(result.success).toBe(false);
        expect(result.message).toContain('括号不匹配');
    });

    it('CH-32：choose(xxx,unknown)+2 所有类别无法识别 → success=false', () => {
        const result = parse('choose(xxx,unknown)+2');
        expect(result.type).toBe('choose');
        expect(result.success).toBe(false);
    });

    it('CH-33：skill,language+2 无 choose 前缀 → success=false', () => {
        const result = parse('skill,language+2');
        expect(result.type).toBe('choose');
        expect(result.success).toBe(false);
    });

    it('CH-34：Choose(SKILL,Language)+2 大小写混合', () => {
        const result = parse('Choose(SKILL,Language)+2');
        expect(result.type).toBe('choose');
        expect(result.success).toBe(true);
    });
});