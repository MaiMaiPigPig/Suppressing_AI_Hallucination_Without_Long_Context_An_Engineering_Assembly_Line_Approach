import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/filter.js';

describe('filter.parse', () => {
    describe('法术筛选', () => {
        it('F-01：spell(class=4,lv=0)+2 → 德鲁伊戏法选2', () => {
            const result = parse('spell(class=4,lv=0)+2');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('spells');
            expect(result.classId).toBe(4);
            expect(result.level).toBe(0);
            expect(result.count).toBe(2);
            expect(result.needUserSelect).toBe(true);
            expect(result.success).toBe(true);
        });

        it('F-02：spell(class=3,4,12)+2 → 多职业法术', () => {
            const result = parse('spell(class=3,4,12)+2');
            expect(result.success).toBe(true);
            expect(result.classIdList).toEqual([3, 4, 12]);
            expect(result.level).toBe(null);
            expect(result.count).toBe(2);
        });

        it('F-03：spell(id=56) → 直接指定ID，不需要用户选择', () => {
            const result = parse('spell(id=56)');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.selectMode).toBe('single');
            expect(result.id).toBe(56);
            expect(result.count).toBe(1);
        });

        it('F-04：spell(class=11,school=7)+1 → 单学派筛选', () => {
            const result = parse('spell(class=11,school=7)+1');
            expect(result.success).toBe(true);
            expect(result.school).toBe(7);
            expect(result.schoolList).toEqual([7]);
        });

        it('F-05：spell(class=12,school=9,10)+1 → 多学派筛选', () => {
            const result = parse('spell(class=12,school=9,10)+1');
            expect(result.success).toBe(true);
            expect(result.school).toBe(9);
            expect(result.schoolList).toEqual([9, 10]);
        });

        it('F-06：spell(class=11,lv=0,dice=1) → 有伤害骰筛选', () => {
            const result = parse('spell(class=11,lv=0,dice=1)');
            expect(result.success).toBe(true);
            expect(result.dice).toBe(1);
        });

        it('F-07：spell(class=11,lv=0,dice=0) → 无伤害骰筛选', () => {
            const result = parse('spell(class=11,lv=0,dice=0)');
            expect(result.success).toBe(true);
            expect(result.dice).toBe(0);
        });

        it('F-08：Spells 大写复数也能识别', () => {
            const result = parse('Spells(class=4,lv=0)+1');
            expect(result.success).toBe(true);
            expect(result.category).toBe('spells');
        });
    });

    describe('工具筛选', () => {
        it('F-09：tool(type=66)+1 → 工匠工具选1', () => {
            const result = parse('tool(type=66)+1');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('tools');
            expect(result.typeId).toBe(66);
            expect(result.count).toBe(1);
            expect(result.needUserSelect).toBe(true);
            expect(result.success).toBe(true);
        });

        it('F-10：tool(type=67) → 无数量默认1', () => {
            const result = parse('tool(type=67)');
            expect(result.success).toBe(true);
            expect(result.typeId).toBe(67);
            expect(result.count).toBe(1);
        });

        it('F-11：tool(id=35) → 直接指定工具ID', () => {
            const result = parse('tool(id=35)');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.id).toBe(35);
        });
    });

    describe('武器筛选', () => {
        it('F-12：weapon(type=61) → 近战武器选1（默认）', () => {
            const result = parse('weapon(type=61)');
            expect(result.type).toBe('filter');
            expect(result.success).toBe(true);
            expect(result.category).toBe('weapons');
            expect(result.typeId).toBe(61);
            expect(result.count).toBe(1);
            expect(result.needUserSelect).toBe(true);
        });

        it('F-13：weapon(type=63)+2 → 简易武器指定数量', () => {
            const result = parse('weapon(type=63)+2');
            expect(result.success).toBe(true);
            expect(result.typeId).toBe(63);
            expect(result.count).toBe(2);
        });

        it('F-14：weapon(type=62)+3 → 远程武器指定数量', () => {
            const result = parse('weapon(type=62)+3');
            expect(result.success).toBe(true);
            expect(result.typeId).toBe(62);
            expect(result.count).toBe(3);
        });

        it('F-15：weapon(category=63,64;range=61)+2 → 复合筛选', () => {
            const result = parse('weapon(category=63,64;range=61)+2');
            expect(result.success).toBe(true);
            expect(result.filterParams.category).toEqual([63, 64]);
            expect(result.filterParams.range).toBe(61);
            expect(result.count).toBe(2);
        });

        it('F-16：weapon(category=63,64)+1 → 复合筛选（只有category）', () => {
            const result = parse('weapon(category=63,64)+1');
            expect(result.success).toBe(true);
            expect(result.filterParams.category).toEqual([63, 64]);
            expect(result.filterParams.range).toBeUndefined();
            expect(result.count).toBe(1);
        });

        it('F-17：weapon(id=10)+1 → 直接指定武器ID', () => {
            const result = parse('weapon(id=10)+1');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.id).toBe(10);
        });
    });

    describe('专长筛选', () => {
        it('F-18：feats(type=44)+1 → 战斗风格专长选1', () => {
            const result = parse('feats(type=44)+1');
            expect(result.type).toBe('filter');
            expect(result.success).toBe(true);
            expect(result.category).toBe('feats');
            expect(result.typeId).toBe(44);
            expect(result.count).toBe(1);
            expect(result.needUserSelect).toBe(true);
        });

        it('F-19：feats(type=45) → 无+N默认1', () => {
            const result = parse('feats(type=45)');
            expect(result.success).toBe(true);
            expect(result.typeId).toBe(45);
            expect(result.count).toBe(1);
        });

        it('F-20：feats(id=99) → 直接指定专长ID', () => {
            const result = parse('feats(id=99)');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.id).toBe(99);
        });
    });

    describe('技能筛选', () => {
        it('F-21：skill(type=3)+1 → 技能Type筛选', () => {
            const result = parse('skill(type=3)+1');
            expect(result.success).toBe(true);
            expect(result.category).toBe('skills');
            expect(result.typeId).toBe(3);
            expect(result.count).toBe(1);
            expect(result.needUserSelect).toBe(true);
        });

        it('F-22：skill(11,12,18)+1 → 技能ID列表', () => {
            const result = parse('skill(11,12,18)+1');
            expect(result.success).toBe(true);
            expect(result.skillIds).toEqual([11, 12, 18]);
            expect(result.count).toBe(1);
        });

        it('F-23：skill(id=4) → 直接指定技能ID', () => {
            const result = parse('skill(id=4)');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.id).toBe(4);
        });
    });

    describe('边界 / 无法识别', () => {
        it('F-24：xxx → success=false', () => {
            const result = parse('xxx');
            expect(result.success).toBe(false);
        });

        it('F-25：空字符串 → success=false', () => {
            const result = parse('');
            expect(result.success).toBe(false);
        });

        it('F-26：null → success=false', () => {
            const result = parse(null);
            expect(result.type).toBe('filter');
            expect(result.success).toBe(false);
            expect(result.needUserSelect).toBe(false);
        });
    });
});