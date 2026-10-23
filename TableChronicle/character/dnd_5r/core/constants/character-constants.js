/**
 * core/constants/character-constants.js
 * 角色车卡/升级共用常量
 */

// 属性 ID 列表（用于能力值计算）
export const ABILITY_NAMES = [1, 4, 9, 11, 18, 25];

// 每个步骤设置的角色数据字段（用于 clearDataAfterStep）
// creation 车卡流程，17 步
export const STEP_DATA_FIELDS = {
    1:  ['race', 'subrace', 'lockedSpells'],
    2:  ['subrace'],
    3:  ['class', 'subclass'],
    4:  ['classPackage'],
    5:  ['background'],
    6:  ['bgPackage'],
    7:  ['abilities'],
    8:  ['backgroundBonus'],
    9:  ['pendingSelections', 'featureSelections', 'lockedSpells'],
    10: ['classSkills', 'backgroundSkills', 'allSkills'],
    11: ['selectedFeat'],
    12: ['selectedSpells', 'lockedSpells'],
    13: ['currency', 'shoppingItems'],
    14: [],
    15: ['name', 'player', 'alignment', 'personalTraits', 'ideals', 'bonds', 'flaws', 'backstory', 'selectedLanguages'],
    16: [],
    17: []
};

// 升级步骤数据字段映射（upgrade 升级流程，7 步）
// 步骤：0:import, 1:overview, 2:subclass, 3:features, 4:confirm, 5:details, 6:export
export const UPGRADE_STEP_DATA_FIELDS = {
    0: ['subclass', 'newFeatures', 'featureSelections', 'selectedSpells', 'shoppingItems'],
    1: ['subclass', 'newFeatures', 'featureSelections', 'selectedSpells', 'shoppingItems'],
    2: ['newFeatures', 'featureSelections', 'selectedSpells', 'shoppingItems'],
    3: ['featureSelections', 'selectedSpells', 'shoppingItems'],
    4: ['selectedSpells', 'shoppingItems'],
    5: ['shoppingItems'],
    6: []
};