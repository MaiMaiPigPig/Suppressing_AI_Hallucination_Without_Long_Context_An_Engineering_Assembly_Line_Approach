/**
 * core/state/character-model.js
 * 角色数据对象结构定义 + 快照/恢复
 */

// 角色数据对象（creation 和 upgrade 共用）
export let character = {
    race: null,
    subrace: null,
    class: null,
    subclass: null,
    background: null,
    abilities: null,
    classSkills: [],
    backgroundSkills: [],
    allSkills: [],
    backgroundBonus: null,
    selectedFeat: null,
    selectedSpells: [],
    lockedSpells: [],
    classPackage: null,
    bgPackage: null,
    shoppingItems: [],
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    name: '',
    player: '',
    alignment: '',
    level: 1,
    personalTraits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    backstory: '',
    pendingSelections: [],
    featureSelections: { tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: [] },
    selectedLanguages: [],
    enabledDLCs: ['phb'],
    // 职业额外资源（如战士额外武器精通）：升级流程按等级累积后写入，车卡流程不读
    classExtraAll: []
};

/**
 * 重置角色数据（新角色时使用）
 */
export function resetCharacter() {
    character = {
        race: null,
        subrace: null,
        class: null,
        subclass: null,
        background: null,
        abilities: null,
        classSkills: [],
        backgroundSkills: [],
        allSkills: [],
        backgroundBonus: null,
        selectedFeat: null,
        selectedSpells: [],
        lockedSpells: [],
        classPackage: null,
        bgPackage: null,
        shoppingItems: [],
        currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
        name: '',
        player: '',
        alignment: '',
        level: 1,
        personalTraits: '',
        ideals: '',
        bonds: '',
        flaws: '',
        backstory: '',
        pendingSelections: [],
        featureSelections: { tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: [] },
        selectedLanguages: [],
        enabledDLCs: ['phb'],
        classExtraAll: []
    };
}

/**
 * 创建角色快照（用于保存/导出）
 * @returns {Object}
 */
export function createCharacterSnapshot() {
    return JSON.parse(JSON.stringify(character));
}

/**
 * 从快照恢复角色数据
 * @param {Object} data
 */
export function restoreCharacterFromSnapshot(data) {
    Object.assign(character, data);
}