import { describe, it, expect } from 'vitest';
import { parseRule } from '../../../TableChronicle/character/dnd_5r/handlers/index.js';

describe('parseRule — 路由分发', () => {
    describe('basic 路由', () => {
        it('I-01：hp → basic.hp', () => {
            const result = parseRule('hp');
            expect(result.type).toBe('basic');
            expect(result.subtype).toBe('hp');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
        });

        it('I-02：speed+10 → basic.speed', () => {
            const result = parseRule('speed+10');
            expect(result.type).toBe('basic');
            expect(result.subtype).toBe('speed');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.value).toBe(10);
        });

        it('I-03：ac=10+2 → basic.ac', () => {
            const result = parseRule('ac=10+2');
            expect(result.type).toBe('basic');
            expect(result.subtype).toBe('ac');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.formula).toBe('10+2');
        });
    });

    describe('filter 路由', () => {
        it('I-04：spell(class=4,lv=0)+2 → filter.spells', () => {
            const result = parseRule('spell(class=4,lv=0)+2');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('spells');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.classId).toBe(4);
            expect(result.level).toBe(0);
            expect(result.count).toBe(2);
        });

        it('I-05：Spells(class=4,lv=0)+1 → 大小写+复数', () => {
            const result = parseRule('Spells(class=4,lv=0)+1');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('spells');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.classId).toBe(4);
            expect(result.level).toBe(0);
            expect(result.count).toBe(1);
        });

        it('I-06：Tools(type=66)+1 → filter.tools', () => {
            const result = parseRule('Tools(type=66)+1');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('tools');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.typeId).toBe(66);
            expect(result.count).toBe(1);
        });

        it('I-07：Weapons(type=63)+1 → filter.weapons', () => {
            const result = parseRule('Weapons(type=63)+1');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('weapons');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.typeId).toBe(63);
            expect(result.count).toBe(1);
        });

        it('I-08：Skills(type=3)+1 → filter.skills', () => {
            const result = parseRule('Skills(type=3)+1');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('skills');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.typeId).toBe(3);
            expect(result.count).toBe(1);
        });

        it('I-09：Feats(type=44)+1 → filter.feats', () => {
            const result = parseRule('Feats(type=44)+1');
            expect(result.type).toBe('filter');
            expect(result.category).toBe('feats');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.typeId).toBe(44);
            expect(result.count).toBe(1);
        });
    });

    describe('choose 路由', () => {
        it('I-10：choose(skill,language)+2 → choose', () => {
            const result = parseRule('choose(skill,language)+2');
            expect(result.type).toBe('choose');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.total).toBe(2);
        });
    });

    describe('resource 路由', () => {
        it('I-14：Character(狂暴)+1 → resource.add', () => {
            const result = parseRule('Character(狂暴)+1');
            expect(result.type).toBe('resource');
            expect(result.subtype).toBe('add');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.resourceName).toBe('狂暴');
            expect(result.value).toBe(1);
        });

        it('I-15：Character(气) → resource.reference', () => {
            const result = parseRule('Character(气)');
            expect(result.type).toBe('resource');
            expect(result.subtype).toBe('reference');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.resourceName).toBe('气');
            expect(result.value).toBe(0);
        });
    });

    describe('attribute 路由', () => {
        it('I-16：AbilityModifiers(1) → attribute', () => {
            const result = parseRule('AbilityModifiers(1)');
            expect(result.type).toBe('attribute');
            expect(result.success).toBe(true);
            expect(result.abilityId).toBe(1);
            expect(result.abilityKey).toBe('strength');
        });
    });

    describe('level 路由', () => {
        it('I-17：lv:class(6) → level.simple', () => {
            const result = parseRule('lv:class(6)');
            expect(result.type).toBe('level');
            expect(result.subtype).toBe('simple');
            expect(result.classId).toBe(6);
        });

        it('I-18：lv:class(1)*0.5>↓ → level.multiply', () => {
            const result = parseRule('lv:class(1)*0.5>↓');
            expect(result.type).toBe('level');
            expect(result.subtype).toBe('multiply');
            expect(result.classId).toBe(1);
            expect(result.multiplier).toBe(0.5);
            expect(result.round).toBe('↓');
        });
    });

    describe('operation 路由', () => {
        it('I-19：skill+1 → operation', () => {
            const result = parseRule('skill+1');
            expect(result.type).toBe('operation');
            expect(result.subtype).toBe('skill_add');
            expect(result.count).toBe(1);
        });
    });

    describe('proficiency 路由', () => {
        it('I-20：Proficiency>pure+2 → proficiency', () => {
            const result = parseRule('Proficiency>pure+2');
            expect(result.type).toBe('proficiency');
            expect(result.subtype).toBe('pure_add');
            expect(result.count).toBe(2);
        });
    });

    describe('chain 路由', () => {
        it('I-21：chain:54 → chain.same_table', () => {
            const result = parseRule('chain:54');
            expect(result.type).toBe('chain');
            expect(result.subtype).toBe('same_table');
            expect(result.targetId).toBe(54);
        });

        it('I-22：spell:140 → unknown（不匹配 chain: 前缀）', () => {
            const result = parseRule('spell:140');
            expect(result.type).toBe('unknown');
            expect(result.success).toBe(false);
        });
    });

    describe('selection 路由', () => {
        it('I-23：[1]Feats(type=44)+1,[2]spell(class=3,lv=0)+2 → selection.numbered_choice', () => {
            const result = parseRule('[1]Feats(type=44)+1,[2]spell(class=3,lv=0)+2');
            expect(result.type).toBe('selection');
            expect(result.subtype).toBe('numbered_choice');
        });

        it('I-24：303→322 → selection.range', () => {
            const result = parseRule('303→322');
            expect(result.type).toBe('selection');
            expect(result.subtype).toBe('range');
            expect(result.startId).toBe(303);
            expect(result.endId).toBe(322);
        });
    });

    describe('special 路由', () => {
        it('I-25：choose → special.choose_one', () => {
            const result = parseRule('choose');
            expect(result.type).toBe('special');
            expect(result.subtype).toBe('choose_one');
        });

        it('I-26：环位：+1 → special.upcast', () => {
            const result = parseRule('环位：+1');
            expect(result.type).toBe('special');
            expect(result.subtype).toBe('upcast');
            expect(result.value).toBe(1);
        });
    });

    describe('table-map 路由', () => {
        it('I-27：growup → table-map', () => {
            const result = parseRule('growup');
            expect(result.type).toBe('table-map');
            expect(result.tableName).toBe('growup');
            expect(result.jsonFile).toBe('proficiency');
        });

        it('I-28：race_features → table-map', () => {
            const result = parseRule('race_features');
            expect(result.type).toBe('table-map');
            expect(result.tableName).toBe('race_features');
            expect(result.jsonFile).toBe('race_features');
        });
    });

    describe('feat-require 路由', () => {
        it('I-29：lv=4 → feat-require.level_equal', () => {
            const result = parseRule('lv=4');
            expect(result.type).toBe('feat-require');
            expect(result.subtype).toBe('level_equal');
            expect(result.requiredLevel).toBe(4);
        });

        it('I-30：ability(4)>=13 → feat-require.ability_min', () => {
            const result = parseRule('ability(4)>=13');
            expect(result.type).toBe('feat-require');
            expect(result.subtype).toBe('ability_min');
            expect(result.abilityId).toBe(4);
            expect(result.requiredValue).toBe(13);
        });

        it('I-31：feature(战斗风格：防御) → feat-require.feature_required', () => {
            const result = parseRule('feature(战斗风格：防御)');
            expect(result.type).toBe('feat-require');
            expect(result.subtype).toBe('feature_required');
        });

        it('I-32：armor_trained(light) → feat-require.armor_trained', () => {
            const result = parseRule('armor_trained(light)');
            expect(result.type).toBe('feat-require');
            expect(result.subtype).toBe('armor_trained');
            expect(result.armorType).toBe('light');
        });

        it('I-33：1,4,9,11,18,25+2 → feat-require.ability_boost', () => {
            const result = parseRule('1,4,9,11,18,25+2');
            expect(result.type).toBe('feat-require');
            expect(result.subtype).toBe('ability_boost');
            expect(result.boost).toBe(2);
        });
    });

    describe('weapon-mastery 路由', () => {
        it('I-34：Weapon>mastery → weapon_mastery', () => {
            const result = parseRule('Weapon>mastery');
            expect(result.type).toBe('weapon_mastery');
            expect(result.success).toBe(true);
        });
    });

    describe('code / all / dice / spell_slot / prerequisite 路由', () => {
        it('I-35：code(choose) → code', () => {
            const result = parseRule('code(choose)');
            expect(result.type).toBe('code');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(true);
            expect(result.tag).toBe('choose');
        });

        it('I-36：all(skills) → all', () => {
            const result = parseRule('all(skills)');
            expect(result.type).toBe('all');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.table).toBe('skills');
        });

        it('I-37：2d6 → dice（骰子公式）', () => {
            const result = parseRule('2d6');
            expect(result.type).toBe('dice');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.dice).toBe('2d6');
        });

        it('I-38：d6*n → dice（骰子×熟练）', () => {
            const result = parseRule('d6*n');
            expect(result.type).toBe('dice');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.dice).toBe('d6*n');
        });

        it('I-39：prerequisite(lv=4) → 预处理后路由到 feat-require', () => {
            const result = parseRule('prerequisite(lv=4)');
            expect(result.type).toBe('feat-require');
            expect(result.subtype).toBe('level_equal');
            expect(result.requiredLevel).toBe(4);
        });

        it('I-40：spell_slot(1)+4 → spell_slot', () => {
            const result = parseRule('spell_slot(1)+4');
            expect(result.type).toBe('spell_slot');
            expect(result.success).toBe(true);
            expect(result.needUserSelect).toBe(false);
            expect(result.level).toBe(1);
            expect(result.count).toBe(4);
        });
    });

    describe('边界 / 错误路由', () => {
        it('I-11：无法识别规则 → type unknown', () => {
            const result = parseRule('unknown_rule_xyz');
            expect(result.type).toBe('unknown');
            expect(result.success).toBe(false);
            expect(result.needUserSelect).toBe(false);
        });

        it('I-12：空字符串 → null', () => {
            expect(parseRule('')).toBe(null);
        });

        it('I-13：null → type unknown', () => {
            const result = parseRule(null);
            expect(result.type).toBe('unknown');
            expect(result.success).toBe(false);
            expect(result.needUserSelect).toBe(false);
        });
    });
});