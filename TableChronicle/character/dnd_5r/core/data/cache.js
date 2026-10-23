/**
 * core/data/cache.js
 * 数据缓存管理：dataCache + _fullDataCache + applyDLCFilter
 */

// 当前使用的数据缓存（已过滤）
export let dataCache = {};

// 完整数据缓存（未过滤），用于DLC过滤后恢复
export let _fullDataCache = {};

/**
 * 重置缓存
 */
export function resetCache() {
    dataCache = {};
    _fullDataCache = {};
}

/**
 * 设置数据缓存
 * @param {Object} data
 */
export function setDataCache(data) {
    dataCache = data;
}

/**
 * 设置完整数据缓存
 * @param {Object} data
 */
export function setFullDataCache(data) {
    _fullDataCache = data;
}

// 支持 DLC 过滤的数据表白名单
const FILTERABLE_KEYS = [
    'races', 'classes', 'classFeatures', 'feats', 'spells',
    'items', 'armors', 'tools'
];

/**
 * 根据已启用的DLC，过滤 dataCache 中的数据
 * 只保留 enabledDLCs 中列出的DLC对应的数据项
 * @param {Array<string>} dlcList - 启用的 DLC 列表
 */
export function applyDLCFilter(dlcList) {
    const enabled = dlcList || ['phb'];
    console.log('[调试] 应用DLC过滤，启用的DLC:', enabled);

    // 从 _fullDataCache 中筛选出 dlcList 对应的数据，写入 dataCache
    // 只过滤 FILTERABLE_KEYS 中的表，其他表全量复制
    FILTERABLE_KEYS.forEach(key => {
        const fullData = _fullDataCache[key] || [];
        dataCache[key] = fullData.filter(item => {
            // 没有 dlc 字段 → 始终显示
            if (!item.dlc) return true;
            // dlc 在启用列表中 → 显示
            return enabled.includes(item.dlc);
        });
    });

    // 非过滤表全量复制
    Object.keys(_fullDataCache).forEach(key => {
        if (!FILTERABLE_KEYS.includes(key)) {
            dataCache[key] = JSON.parse(JSON.stringify(_fullDataCache[key]));
        }
    });

    console.log('[调试] DLC过滤完成:', Object.keys(dataCache).map(k => `${k}: ${dataCache[k].length}条`));
}