/**
 * core/data/loader.js
 * 数据加载 + 占位符预处理
 */

import { dataCache, _fullDataCache, setDataCache, setFullDataCache } from './cache.js';
import { buildDataIndexes } from './indexes.js';
import { initDictionaryMaps, translateDamageType } from './dictionary.js';

const DATA_PATH = '/data/json/';

/**
 * 加载所有数据文件
 * @param {Array<string>} dlcList - 启用的 DLC 列表（可选）
 * @returns {Promise<Object>} dataCache
 */
export async function loadData(dlcList) {
    const files = [
        'dlc.json',
        'dictionary.json',
        'races.json',
        'race_features.json',
        'classes.json',
        'class_features.json',
        'subclasses.json',
        'backgrounds.json',
        'packages.json',
        'package_details.json',
        'feats.json',
        'spells.json',
        'skills.json',
        'items.json',
        'weapons.json',
        'armors.json',
        'tools.json',
        'magic_items.json',
        'languages.json',
        'alignments.json',
        'proficiency.json',
        'spellcasting.json',
        'spellcasting_methods.json',
        'spellcasting_formulas.json',
        'lookup_table.json',
        'class_extra.json',
        'weapon_properties.json',
        'monsters.json'
    ];

    const names = ['dlc', 'dictionary', 'races', 'raceFeatures', 'classes', 'classFeatures', 'subclasses', 'backgrounds', 'packages', 'packageDetails', 'feats', 'spells', 'skills', 'items', 'weapons', 'armors', 'tools', 'magic_items', 'languages', 'alignments', 'proficiency', 'spellcasting', 'spellcastingMethods', 'spellcastingFormulas', 'lookupTable', 'classExtra', 'weaponProperties', 'monsters'];

    const results = await Promise.allSettled(
        files.map(f => fetch(DATA_PATH + f, { cache: 'no-cache' }).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${f}`);
            return r.json();
        }))
    );

    const newCache = {};
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            newCache[names[i]] = result.value;
        } else {
            console.warn(`加载 ${names[i]} 失败:`, result.reason);
            newCache[names[i]] = [];
        }
    });

    setDataCache(newCache);

    // 初始化字典映射表（必须在预处理占位符之前，translateDamageType 依赖此数据）
    initDictionaryMaps(dataCache);

    // 预处理占位符
    preprocessAllPlaceholders();

    // 保存完整数据副本，用于DLC过滤
    const fullCache = {};
    Object.keys(newCache).forEach(key => {
        fullCache[key] = JSON.parse(JSON.stringify(newCache[key]));
    });
    setFullDataCache(fullCache);

    // 构建数据索引
    buildDataIndexes();

    console.log('数据加载完成:', Object.keys(dataCache).map(k => `${k}: ${dataCache[k].length}条`));
    return dataCache;
}

/**
 * 预处理占位符，将 %x%、%y%、%x1%、%y2% 等占位符替换为实际值
 * 在数据加载时执行一次，后续显示直接取用即可
 */
function preprocessAllPlaceholders() {
    function preprocess(item, textField) {
        if (!item || !item[textField]) return;
        item[textField] = replacePlaceholdersInText(item[textField], item);
    }

    const spells = dataCache.spells || [];
    spells.forEach(spell => {
        preprocess(spell, 'desc');
        preprocess(spell, 'upcast');
    });

    const races = dataCache.races || [];
    races.forEach(race => preprocess(race, 'desc'));

    const subraces = dataCache.races || [];
    subraces.forEach(sub => preprocess(sub, 'desc'));

    const raceFeatures = dataCache.raceFeatures || [];
    raceFeatures.forEach(rf => preprocess(rf, 'desc'));

    const classFeatures = dataCache.classFeatures || [];
    classFeatures.forEach(cf => preprocess(cf, 'desc'));
}

/**
 * 通用：替换文本中的 %x% / %y% / %xN% / %yN% 占位符
 */
/**
 * 非伤害类型的效果关键词映射（penalty/temporary_hp/bonus/healing 等）
 * 这些值出现在 damage_type 字段中，但不是真正的伤害类型，而是法术的附加效果类型
 */
const EFFECT_KEYWORD_MAP = {
    'penalty': '减值',
    'temporary_hp': '临时生命',
    'bonus': '加值',
    'healing': '治疗'
};

/**
 * 翻译 yValues 中的伤害类型值。
 * 处理三种情况：
 * 1. choose_xxx_yyy 格式 → translateDamageType 翻译每个部分
 * 2. xxx/yyy 格式 → 按 / 拆分后逐段翻译再合并
 * 3. 普通值 → 直接 translateDamageType
 */
function translateYValue(raw) {
    if (!raw) return raw;

    if (raw.startsWith('choose_')) {
        const parts = raw.split('_').slice(1).map(p => translateDamageType(p));
        return parts.join('/');
    }

    if (raw.includes('/')) {
        return raw.split('/').map(p => {
            const trimmed = p.trim();
            return EFFECT_KEYWORD_MAP[trimmed] || translateDamageType(trimmed);
        }).join('/');
    }

    return EFFECT_KEYWORD_MAP[raw] || translateDamageType(raw);
}

export function replacePlaceholdersInText(text, item) {
    if (!text || !item) return text || '';

    let xRaw;
    if (Object.prototype.hasOwnProperty.call(item, 'rules') && item['rules'] != null && String(item['rules']).trim() !== '') {
        xRaw = String(item['rules']);
    } else {
        xRaw = String(item['dice'] ?? '');
    }

    let yRaw;
    if (Object.prototype.hasOwnProperty.call(item, 'damage_type') && item['damage_type'] != null && String(item['damage_type']).trim() !== '') {
        yRaw = String(item['damage_type']);
    } else {
        yRaw = String(item['dice'] ?? '');
    }

    const xValues = xRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const yValues = yRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const yValuesTranslated = yValues.map(v => translateYValue(v));
    if (xValues.length === 0 && yValues.length === 0) return text;

    let result = text;
    result = result.replace(/%x%/g, xValues[0] || '?');
    result = result.replace(/%x(\d+)%/g, (m, idx) => {
        const i = parseInt(idx) - 1;
        return i >= 0 && i < xValues.length ? xValues[i] : m;
    });
    result = result.replace(/%y%/g, yValuesTranslated[0] || '?');
    result = result.replace(/%y(\d+)%/g, (m, idx) => {
        const flat = yValuesTranslated.flatMap(v => v.split('/'));
        const i = parseInt(idx) - 1;
        return i >= 0 && i < flat.length ? flat[i].trim() : m;
    });
    return result;
}