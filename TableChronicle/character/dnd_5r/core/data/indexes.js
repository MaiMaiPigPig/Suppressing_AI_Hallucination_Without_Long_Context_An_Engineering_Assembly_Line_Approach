/**
 * core/data/indexes.js
 * 数据查询索引构建
 *
 * 注意：handlers/data-query.js 中曾有同名函数，现统一到此文件。
 * handlers/data-query.js 改为 import { buildDataIndexes } from '../../core/data/indexes.js'
 */

import { dataCache } from './cache.js';

/**
 * 构建数据查询索引
 * 原位置：creation/character.js（内联在 loadData 中）
 * 原位置：handlers/data-query.js（已迁移至此）
 */
export function buildDataIndexes() {
    dataCache.extraByFeatureId = {};
    (dataCache.classExtra || []).forEach(function(e) {
        var fid = e['chain'];
        if (fid) {
            if (!dataCache.extraByFeatureId[fid]) {
                dataCache.extraByFeatureId[fid] = [];
            }
            dataCache.extraByFeatureId[fid].push(e);
        }
    });
}

/**
 * 查找数据项属于哪个数据表
 * @param {object} item - 数据项（必须有 id 字段）
 * @returns {string|null} 表名，如 'raceFeatures'、'classFeatures' 等
 */
export function findItemSourceTable(item) {
    if (!item || !item.id) return null;
    var tableMap = {
        'raceFeatures': dataCache.raceFeatures,
        'classFeatures': dataCache.classFeatures,
        'feats': dataCache.feats,
        'backgrounds': dataCache.backgrounds,
        'races': dataCache.races,
        'classes': dataCache.classes,
        'spells': dataCache.spells,
        'skills': dataCache.skills,
        'tools': dataCache.tools,
        'weapons': dataCache.weapons,
        'armors': dataCache.armors,
        'items': dataCache.items,
        'packages': dataCache.packages,
        'packageDetails': dataCache.packageDetails,
        'languages': dataCache.languages
    };
    for (var tableName in tableMap) {
        var table = tableMap[tableName];
        if (table && Array.isArray(table)) {
            if (table.some(function(row) { return row && row.id === item.id; })) {
                return tableName;
            }
        }
    }
    return null;
}

/**
 * 按 id 查找种族
 * @param {string} id
 * @returns {object|undefined}
 */
export function findRaceById(id) {
    return (dataCache.races || []).find(function(r) { return r && r.id === id; });
}

/**
 * 按 id 查找职业
 * @param {string} id
 * @returns {object|undefined}
 */
export function findClassById(id) {
    return (dataCache.classes || []).find(function(c) { return c && c.id === id; });
}

/**
 * 按 id 查找特性（跨所有特性表）
 * @param {string} id
 * @returns {object|undefined}
 */
export function findFeatureById(id) {
    var tables = [
        dataCache.raceFeatures,
        dataCache.classFeatures,
        dataCache.feats,
        dataCache.backgrounds
    ];
    for (var i = 0; i < tables.length; i++) {
        var table = tables[i];
        if (!table) continue;
        var found = table.find(function(f) { return f && f.id === id; });
        if (found) return found;
    }
    return undefined;
}