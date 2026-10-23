import { escapeHtml } from '../utils/html.js';

// 翻译：属性ID列表，对应 D&D 的六项属性（力量、敏捷、体质、智力、感知、魅力）
var ABILITY_NAMES = [1, 4, 9, 11, 18, 25];

// ===== 升级状态 =====
let upgradeState = {
    newLevel: 2,
    classId: null,
    subClassId: null,
    gainedFeatures: [],
    gainedFeats: [],
    abilityImprovement: false,
    subclassFeatures: [],
    spellcastingType: 0,
    newSpellSlots: {},
    totalLevelsGained: 0,
    maxLevel: 20,
    hpGain: 0,
    newMaxHp: 0,
    proficiencyBonusChange: null,
    pendingSelections: [],       // 待用户选择的选项
    selectedOptions: {},         // 用户已选结果 { featureId: [selectedIds] }
    classExtraGroups: []         // class_extra 分组信息
};

// ===== 步骤定义 =====
const STEPS = [
    { id: 'import',      label: '导入角色' },
    { id: 'overview',    label: '升级概览' },
    { id: 'features',    label: '新增特性' },
    { id: 'subclass',    label: '子职选择' },
    { id: 'selections',  label: '选择确认' },
    { id: 'sheet',       label: '角色详情' },
    { id: 'export',      label: '保存导出' }
];

// ===== 步骤指示器 =====

// ============================================================
// 步骤导航
// ============================================================
// 翻译：记录当前所在的步骤索引（0-6），用对象包装以实现跨模块可变引用
const stepState = { current: 0 };

/**
 * 翻译：根据属性值计算调整值（D&D 公式：(属性值-10)/2 向下取整）
 * @param {number} val - 翻译：属性值（如力量 15）
 * @returns {number} - 翻译：调整值（如 +2）
 */
function calculateModifier(val) { return Math.floor((val - 10) / 2); }

export {
    ABILITY_NAMES,
    upgradeState,
    STEPS,
    stepState,
    calculateModifier,
    escapeHtml
};