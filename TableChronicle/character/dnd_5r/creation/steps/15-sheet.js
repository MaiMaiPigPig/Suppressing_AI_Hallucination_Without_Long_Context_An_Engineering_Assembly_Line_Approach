// ===== sheet.js 入口 =====
// 本文件不承载实现，只做两件事：
//   1. 保持原对外接口（step-router.js / 其他模块的 import 路径无需改动）
//   2. 执行原文件里的顶层副作用（全局样式注入等）

export { renderSpellItem, formatSpellDetail, toggleSpellDetail, getFeatureProficiencyValues } from './15-sheet-renderer.js';
export { translateDamageType, translateProperties } from '../../core/data/dictionary.js';
export { renderCharacterSheet } from './15-sheet-main.js';