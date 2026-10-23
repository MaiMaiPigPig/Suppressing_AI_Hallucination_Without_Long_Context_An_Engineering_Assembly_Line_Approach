/**
 * handlers/index.js
 * 规则解析统一入口（ES Module 版）
 *
 * 原全局 handlers 对象改为模块级常量，各子模块通过 import 引入。
 * 对外暴露 parseRule 和 processItemRules 两个核心函数。
 */

import { dataCache } from '../core/data/cache.js';
import * as basic from './basic.js';
import * as attribute from './attribute.js';
import * as level from './level.js';
import * as filter from './filter.js';
import * as operation from './operation.js';
import * as proficiency from './proficiency.js';
import * as chain from './chain.js';
import * as selection from './selection.js';
import * as resource from './resource.js';
import * as choose from './choose.js';
import * as special from './special.js';
import * as tableMap from './table-map.js';
import * as featRequire from './feat-require.js';
import * as weaponMastery from './weapon-mastery.js';

// ============================================================
// 子模块注册表
// ============================================================
export const handlerRegistry = {
    basic, attribute, level, filter, operation, proficiency,
    chain, selection, resource, choose, special, tableMap,
    featRequire, weaponMastery
};

// ============================================================
// 核心函数：parseRule(rule) — 解析单条规则字符串
// ============================================================
export function parseRule(rule) {
    rule = String(rule).trim();
    if (!rule) return null;

    var r = rule.toLowerCase();

    // 0-A. 自描述表达式预处理
    var pluralMap = { 'spells(': 'spell(', 'tools(': 'tool(', 'weapons(': 'weapon(', 'skills(': 'skill(', 'armors(': 'armor(', 'languages(': 'language(', 'feats(': 'feat(' };
    var rRoute = r;
    for (var pk in pluralMap) { if (Object.prototype.hasOwnProperty.call(pluralMap, pk) && rRoute.indexOf(pk) === 0) { rRoute = pluralMap[pk] + rRoute.substring(pk.length); break; } }

    var pm;

    if ((pm = r.match(/^prerequisite\s*\(\s*(.+)\s*\)\s*$/i))) { return parseRule(pm[1]); }

    if ((pm = r.match(/^code\s*[（(]\s*(.+)\s*[）)]\s*$/i))) {
        return { type: 'code', success: true, needUserSelect: true, tag: pm[1].trim(), expression: rule };
    }

    if ((pm = r.match(/^all\s*\(\s*(\w+)\s*\)\s*$/i))) {
        return { type: 'all', success: true, needUserSelect: false, table: pm[1].toLowerCase(), expression: rule };
    }

    if ((pm = r.match(/^half-prof\s*\(\s*(\w+)\s*\)\s*$/i))) {
        return { type: 'special', operation: 'half-prof', success: true, needUserSelect: true, table: pm[1].toLowerCase(), expression: rule };
    }

    if (r.match(/^choose\s*\(\s*(.+)\s*\)\s*(?:\+\s*(\d+))?\s*$/i)) {
        return choose ? choose.parse(rule) : null;
    }

    if (rRoute === 'hp' || rRoute.startsWith('hp_per_lv+') || rRoute.startsWith('ac=') || rRoute.startsWith('ac+') || rRoute.startsWith('speed+') || rRoute.includes('character(直接显示)') || /^ability\(\d+\)\s*[+-]/.test(rRoute)) {
        return basic ? basic.parse(rule) : null;
    }

    if (rRoute.startsWith('abilitymodifiers(')) {
        return attribute ? attribute.parse(rule) : null;
    }

    if (rRoute.startsWith('lv:')) {
        return level ? level.parse(rule) : null;
    }

    if (rRoute.startsWith('skill+') || rRoute.startsWith('技能+') || rRoute.startsWith('工具+') || rRoute.startsWith('language+')) {
        return operation ? operation.parse(rule) : null;
    }

    if (rRoute.startsWith('proficiency>') || rRoute.startsWith('技能+')) {
        if (rRoute.startsWith('proficiency>')) {
            return proficiency ? proficiency.parse(rule) : null;
        }
    }

    if (rRoute.startsWith('chain:')) {
        return chain ? chain.parse(rule) : null;
    }

    if (rRoute.match(/\[\d+\]/) || rRoute.indexOf('→') >= 0) {
        return selection ? selection.parse(rule) : null;
    }

    if (rRoute.startsWith('character(')) {
        return resource ? resource.parse(rule) : null;
    }

    if (rRoute === 'choose' || rRoute.startsWith('环位：')) {
        return special ? special.parse(rule) : null;
    }

    if (['race_feature','race_features','class_features','class_feature','growup','class_extra','shop','suit','magicitems'].indexOf(rRoute) >= 0) {
        return tableMap ? tableMap.parse(rule) : null;
    }

    if (rRoute.startsWith('lv=') || rRoute.startsWith('lv>=') || rRoute.startsWith('ability(') || rRoute.startsWith('feature(') || rRoute.startsWith('armor_trained(')) {
        return featRequire ? featRequire.parse(rule) : null;
    }

    var attrBoostCheck = rule.match(/^(\d+,\s*)+\d+\s*\+\s*\d+\s*$/);
    if (attrBoostCheck && featRequire) {
        return featRequire.parse(rule);
    }

    var spellSlotMatch = rRoute.match(/^spell_slot\s*\(\s*(\d+)\s*\)\s*\+\s*(\d+)\s*$/);
    if (spellSlotMatch) {
        return {
            type: 'spell_slot',
            success: true,
            needUserSelect: false,
            level: parseInt(spellSlotMatch[1]),
            count: parseInt(spellSlotMatch[2]),
            expression: rule
        };
    }

    if (rRoute.indexOf('weapon>mastery') >= 0 || rRoute.indexOf('weapon > mastery') >= 0) {
        return weaponMastery ? weaponMastery.parse(rule) : null;
    }

    if (/^d\d+\*n$/.test(rRoute)) {
        return { type: 'dice', success: true, needUserSelect: false, expression: rule, dice: rule, description: rule + '（每级/熟练加值枚骰子）' };
    }

    if (/^(\d+)?d\d+$/.test(rRoute)) {
        return { type: 'dice', success: true, needUserSelect: false, expression: rule, dice: rule, description: rule + '（骰子公式）' };
    }

    if (filter) {
        var filterResult = filter.parse(rule);
        if (filterResult && filterResult.success) {
            return filterResult;
        }
        if (rRoute !== r) {
            var normalizedRule = rule;
            for (var pk2 in pluralMap) {
                if (Object.prototype.hasOwnProperty.call(pluralMap, pk2) && normalizedRule.toLowerCase().indexOf(pk2) === 0) {
                    normalizedRule = pluralMap[pk2] + normalizedRule.substring(pk2.length);
                    break;
                }
            }
            filterResult = filter.parse(normalizedRule);
            if (filterResult && filterResult.success) {
                return filterResult;
            }
        }
    }

    console.warn('[handlers] 无法识别规则: ' + rule);
    return {
        type: 'unknown',
        rule: rule,
        needUserSelect: false,
        success: false,
        message: '无法识别规则: ' + rule
    };
}

// ============================================================
// 核心函数：processItemRules(item, character, options)
// ============================================================
export function processItemRules(item, character, options) {
    if (!item) return [];

    options = options || {};
    var results = [];
    var defaultFields = ['rules', 'tool', 'tool_prof', 'effects', 'code_effects', 'bonus', 'code', 'dice'];
    var fieldsToCheck = options.fields || defaultFields;

    for (var fi = 0; fi < fieldsToCheck.length; fi++) {
        var field = fieldsToCheck[fi];
        var data = String(item[field] || '').trim();
        if (!data) continue;

        if (field === 'code' && typeof window !== 'undefined' && window.CodeHandlers) {
            var handlerMatch = data.match(/^code\s*[（(]\s*([\w-]+)(?:\s*[（(][^）)]*[）)])?\s*[）)]$/);
            var handlerName = handlerMatch ? handlerMatch[1] : null;

            if (handlerName && window.CodeHandlers.has(handlerName)) {
                var reviewHandlerName = handlerName + '-review';
                var isReviewMode = window.CodeHandlers.has(reviewHandlerName);
                var activeHandler = isReviewMode ? reviewHandlerName : handlerName;
                var codeResult = window.CodeHandlers.execute(activeHandler, item, { character: character });
                if (codeResult) {
                    if (isReviewMode) {
                        codeResult.needUserSelect = true;
                    }
                    codeResult.success = true;
                    if (item && item.name && !codeResult.sourceName) {
                        codeResult.sourceName = item.name;
                    }
                    results.push(codeResult);
                }
                continue;
            }
        }

        var rules = [];
        var _depth = 0;
        var _buf = '';
        for (var _ci = 0; _ci < data.length; _ci++) {
            var _ch = data[_ci];
            if (_ch === '(' || _ch === '（') { _depth++; _buf += _ch; }
            else if (_ch === ')' || _ch === '）') { _depth--; _buf += _ch; }
            else if ((_ch === ',' || _ch === '，') && _depth === 0) {
                if (_buf.trim()) rules.push(_buf.trim());
                _buf = '';
            } else { _buf += _ch; }
        }
        if (_buf.trim()) rules.push(_buf.trim());
        for (var ri = 0; ri < rules.length; ri++) {
            var rule = rules[ri].trim();
            if (!rule) continue;
            if (/^\d+$/.test(rule)) continue;
            if (/[\u4e00-\u9fff]/.test(rule)) continue;
            var result = parseRule(rule);
            if (result) {
                results.push(result);
            }
        }
    }

    return results;
}

// ============================================================
// 全局桥接：兼容旧代码通过 window.handlers 访问
// upgrade.js 和 creation/steps 仍通过全局 handlers 对象调用
// ============================================================
if (typeof window !== 'undefined') {
    window.handlers = window.handlers || {};
    window.handlers.processItemRules = processItemRules;
    window.handlers.parseRule = parseRule;
}