/**
 * core/data/dictionary.js
 * 翻译映射工具函数：伤害类型、武器属性、法术学派、专长类型、武器类型
 */

// 模块级映射表（由 initDictionaryMaps 构建）
let _damageTypeMap = {};
let _propertyMap = {};
let _schoolMap = {};
let _featTypeMap = {};
let _weaponTypeMap = {};

/**
 * 从 dataCache 初始化所有映射表
 * 由 loader.js 在数据加载完成后调用；测试环境手动调用
 * @param {Object} cache - dataCache 对象（{ dictionary: [...], weaponProperties: [...] }）
 */
export function initDictionaryMaps(cache) {
    const dict = (cache && cache.dictionary) || [];
    const weaponProps = (cache && cache.weaponProperties) || [];

    _damageTypeMap = {};
    dict.forEach(item => {
        if (item.id >= 47 && item.id <= 59 && item.name_en) {
            _damageTypeMap[item.name_en.toLowerCase()] = item.name;
        }
    });

    _propertyMap = {};
    weaponProps.forEach(item => {
        _propertyMap[item.id] = item.name;
    });

    _schoolMap = {};
    dict.forEach(item => {
        if (item.id >= 7 && item.id <= 14) {
            _schoolMap[item.id] = item.name;
        }
    });

    _featTypeMap = {};
    dict.forEach(item => {
        if (item.id >= 42 && item.id <= 46) {
            _featTypeMap[item.id] = item.name;
        }
    });

    _weaponTypeMap = {};
    dict.forEach(item => {
        if (item.id >= 61 && item.id <= 65) {
            _weaponTypeMap[item.id] = item.name;
        }
    });
}

/**
 * 翻译伤害类型：英文名 → 中文名
 * @param {string} type - 伤害类型英文名（如 'cold'）
 * @returns {string} 中文名或原值
 */
export function translateDamageType(type) {
    if (!type || type === '—') return '—';
    return _damageTypeMap[type.toLowerCase()] || type;
}

/**
 * 翻译武器属性：数字 ID 或逗号分隔的 ID 列表 → 中文名
 * @param {string|Array} props - 如 '1,2,3' 或 [1, 2, 3]
 * @returns {string} 中文名，用顿号连接
 */
export function translateProperties(props) {
    if (!props || props === '—' || props === '---') return '—';
    const propStr = Array.isArray(props) ? props.join(',') : String(props);
    const parts = propStr.split(',').map(p => p.trim()).filter(Boolean);
    return parts.map(part => {
        const match = part.match(/^(\d+)(.*)$/);
        if (match) {
            const id = parseInt(match[1]);
            const name = _propertyMap[id];
            if (name) {
                const extra = match[2] || '';
                return name + extra;
            }
        }
        return part;
    }).join('、');
}

/**
 * 获取法术学派映射表
 * @returns {Object} { id: name }
 */
export function getSchoolMap() {
    return _schoolMap;
}

/**
 * 获取专长类型映射表
 * @returns {Object} { id: name }
 */
export function getFeatTypeMap() {
    return _featTypeMap;
}

/**
 * 获取武器类型映射表
 * @returns {Object} { id: name }
 */
export function getWeaponTypeMap() {
    return _weaponTypeMap;
}