import { upgradeState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { getSpellDataFromProficiency } from '../../core/spells/spell-system.js';
import { buildSpellDetailHTML } from '../../creation/steps/11-spells.js';
import { renderKnownSpellsSection, renderPreparedSpellsSection, renderSpellbookSection } from './spell-update.js';

// ===== upgrade/steps/spell-update-interactions.js =====
// 升级法术步骤——交互部分：法术勾选、替换、法术书增删、滚动位置保持。

// 构造一个可用于重定位的选择器
function buildSelector($elem) {
    var el = $elem[0];
    if (!el || el === document || el === window) return null;
    var id = $elem.attr('id');
    if (id) return '#' + id;
    var cls = $elem.attr('class');
    if (cls) {
        var firstCls = cls.split(/\s+/)[0];
        if (firstCls) return '.' + firstCls;
    }
    return el.tagName;
}

// 保存 $el 及其所有祖先、后代可滚动元素、BODY、HTML、window 的滚动位置
function saveScrollAncestors($el) {
    var saved = [];
    var seen = [];

    function pushScroll($elem, label, isDescendant) {
        var el = $elem[0];
        if (!el || el === document || seen.indexOf(el) !== -1) return;
        seen.push(el);
        var st = $elem.scrollTop();
        var sh = el.scrollHeight || 0;
        var ch = el.clientHeight || 0;
        if (st > 0 || sh > ch) {
            var entry = { el: $elem, top: st, tag: label, sh: sh, ch: ch };
            if (isDescendant) {
                entry.selector = buildSelector($elem);
                entry.scope = $el;
            }
            saved.push(entry);
        }
    }

    // 自身
    pushScroll($el, 'SELF:' + ($el.attr('id') || $el.attr('class') || $el.prop('tagName')), false);

    // 所有后代中可能滚动的元素（overflow-y: auto/scroll）
    $el.find('*').each(function() {
        var $this = $(this);
        var el = this;
        var oy = $this.css('overflow-y');
        if (oy === 'auto' || oy === 'scroll') {
            var lbl = 'DESC:' + el.tagName + ($this.attr('id') ? '#' + $this.attr('id') : '') + ($this.attr('class') ? '.' + $this.attr('class').split(' ')[0] : '');
            pushScroll($this, lbl, true);
        }
    });

    // 祖先
    var $cur = $el.parent();
    while ($cur.length && $cur[0] !== document) {
        var lbl = $cur.prop('tagName') + ($cur.attr('id') ? '#' + $cur.attr('id') : '') + ($cur.attr('class') ? '.' + $cur.attr('class').split(' ')[0] : '');
        pushScroll($cur, lbl, false);
        $cur = $cur.parent();
    }
    // BODY / HTML / window（这些不一定有 overflow CSS，但浏览器仍可能在此滚动）
    pushScroll($(document.body), 'BODY', false);
    pushScroll($(document.documentElement), 'HTML', false);
    pushScroll($(window), 'WINDOW', false);

    return saved;
}

// 恢复保存的滚动位置（后代元素会通过选择器重新定位到新 DOM 中的元素）
function restoreScrollAncestors(saved) {
    saved.forEach(function(s) {
        var $target = s.el;
        // 后代元素可能已被 html() 替换而脱离 DOM，用 scope + 选择器重新查找
        if (s.selector && !document.contains($target[0])) {
            if (s.scope && s.scope.length) {
                $target = s.scope.find(s.selector);
            } else {
                $target = $(s.selector);
            }
            if ($target.length) {
                s.el = $target;
            }
        }
        if (!$target.length) return;
        $target.scrollTop(s.top);
    });
}

function upgradeToggleSpell(id, level, type) {
    const cls = character.class;
    const classId = cls ? cls.id : 0;
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });
    const locked = character.lockedSpells || [];
    if (locked.includes(id)) return;

    const selected = character.selectedSpells || [];
    const scInfo = upgradeState.spellcastingInfo || {};
    const newLevel = upgradeState.newLevel || (character.level + 1);
    const newSpellData = getSpellDataFromProficiency(classId, newLevel);

    if (type === 'cantrip') {
        // 戏法：暂不支持替换模式
        const oldCantrips = selected.filter(cid => {
            const s = allSpells.find(sp => sp.id === cid);
            return s && s.level === 0;
        });
        const newCantripIds = upgradeState._upgradeNewCantrips || [];
        const isOld = oldCantrips.includes(id);
        const isNew = newCantripIds.includes(id);

        if (isNew) {
            upgradeState._upgradeNewCantrips = newCantripIds.filter(cid => cid !== id);
        } else if (!isOld) {
            const newCantripGain = scInfo.cantripGain || 0;
            const currentNew = newCantripIds.filter(cid => !oldCantrips.includes(cid));
            if (currentNew.length < newCantripGain) {
                newCantripIds.push(id);
            }
        }
    } else {
        const oldSpells = selected.filter(sid => {
            const s = allSpells.find(sp => sp.id === sid);
            return s && s.level > 0;
        });

        if (upgradeState._isInReplaceMode) {
            const targetId = upgradeState._replaceTargetId;
            const newId = upgradeState._replaceNewId;

            if (targetId === null) {
                // 步骤1：等待选目标 — 点击 old spell 标记为待移除
                if (oldSpells.includes(id)) {
                    upgradeState._replaceTargetId = id;
                }
            } else {
                if (id === targetId) {
                    // 点击目标自身 → 取消移除
                    upgradeState._replaceTargetId = null;
                    upgradeState._replaceNewId = null;
                } else if (id === newId) {
                    // 点击已选的替换候选 → 取消选择
                    upgradeState._replaceNewId = null;
                } else {
                    // 点击其他法术
                    const effectiveSelected = oldSpells.filter(sid => sid !== targetId);
                    if (!effectiveSelected.includes(id)) {
                        // 是一个可选项 → 设为替换候选
                        upgradeState._replaceNewId = id;
                    }
                }
            }
        } else {
            const newSpellIds = upgradeState._upgradeNewSpells || [];
            // 替换新增的法术不可取消
            const replacedSpells = upgradeState._upgradeReplacedSpells || [];
            if (replacedSpells.includes(id)) return;

            const isOld = oldSpells.includes(id);
            const isNew = newSpellIds.includes(id);

            if (isNew) {
                upgradeState._upgradeNewSpells = newSpellIds.filter(sid => sid !== id);
            } else if (!isOld) {
                const replacedSpells = upgradeState._upgradeReplacedSpells || [];
                const currentNew = newSpellIds.filter(sid => !oldSpells.includes(sid) && !replacedSpells.includes(sid));
                const spellLimit = newSpellData.prepared || 0;
                const remaining = Math.max(0, spellLimit - oldSpells.length - currentNew.length);
                if (remaining > 0) {
                    newSpellIds.push(id);
                }
            }
        }
    }

    const scCfg = (dataCache.spellcasting || []).find(s => s.class === classId);
    const methodRaw = String(scCfg.preparation_method || '');
    const eqIdx = methodRaw.indexOf('=');
    const methodId = eqIdx !== -1 ? parseInt(methodRaw.substring(0, eqIdx)) : parseInt(methodRaw);
    if (methodId === 1) {
        renderKnownSpellsSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
    }
}

function startReplace() {
    upgradeState._isInReplaceMode = true;
    upgradeState._replaceTargetId = null;
    upgradeState._replaceNewId = null;

    const cls = character.class;
    const classId = cls ? cls.id : 0;
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });
    const selected = character.selectedSpells || [];
    const locked = character.lockedSpells || [];
    const newLevel = upgradeState.newLevel || (character.level + 1);
    const newSpellData = getSpellDataFromProficiency(classId, newLevel);
    const scCfg = (dataCache.spellcasting || []).find(s => s.class === classId);
    const scInfo = upgradeState.spellcastingInfo || {};
    renderKnownSpellsSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
}

function confirmReplace() {
    if (upgradeState._replaceTargetId === null || upgradeState._replaceNewId === null) return;

    const targetId = upgradeState._replaceTargetId;
    const newId = upgradeState._replaceNewId;

    // 记录被替换掉的法术（已知法术制用 _upgradeRemovedSpells 追踪）
    if (!upgradeState._upgradeRemovedSpells) {
        upgradeState._upgradeRemovedSpells = [];
    }
    if (!upgradeState._upgradeRemovedSpells.includes(targetId)) {
        upgradeState._upgradeRemovedSpells.push(targetId);
    }

    // 记录替换新增的法术（标记为不可取消）
    if (!upgradeState._upgradeReplacedSpells) {
        upgradeState._upgradeReplacedSpells = [];
    }
    if (!upgradeState._upgradeReplacedSpells.includes(newId)) {
        upgradeState._upgradeReplacedSpells.push(newId);
    }

    // 添加新法术到 _upgradeNewSpells（同时从 _upgradeNewSpells 移除旧法术，用于准备制/法术书制）
    const newList = [...(upgradeState._upgradeNewSpells || [])];
    const oldIdx = newList.indexOf(targetId);
    if (oldIdx !== -1) {
        newList.splice(oldIdx, 1);
    }
    if (!newList.includes(newId)) {
        newList.push(newId);
    }
    upgradeState._upgradeNewSpells = newList;

    // 扣除替换次数
    upgradeState._replaceCountRemaining = Math.max(0, (upgradeState._replaceCountRemaining || 1) - 1);

    // 退出替换模式
    upgradeState._isInReplaceMode = false;
    upgradeState._replaceTargetId = null;
    upgradeState._replaceNewId = null;

    // 刷新界面
    const cls = character.class;
    const classId = cls ? cls.id : 0;
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });
    const selected = character.selectedSpells || [];
    const locked = character.lockedSpells || [];
    const newLevel = upgradeState.newLevel || (character.level + 1);
    const newSpellData = getSpellDataFromProficiency(classId, newLevel);
    const scCfg = (dataCache.spellcasting || []).find(s => s.class === classId);
    const scInfo = upgradeState.spellcastingInfo || {};
    renderKnownSpellsSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
}

function cancelReplace() {
    upgradeState._isInReplaceMode = false;
    upgradeState._replaceTargetId = null;
    upgradeState._replaceNewId = null;

    const cls = character.class;
    const classId = cls ? cls.id : 0;
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });
    const selected = character.selectedSpells || [];
    const locked = character.lockedSpells || [];
    const newLevel = upgradeState.newLevel || (character.level + 1);
    const newSpellData = getSpellDataFromProficiency(classId, newLevel);
    const scCfg = (dataCache.spellcasting || []).find(s => s.class === classId);
    const scInfo = upgradeState.spellcastingInfo || {};

    const methodRaw = String(scCfg.preparation_method || '');
    const eqIdx = methodRaw.indexOf('=');
    const methodId = eqIdx !== -1 ? parseInt(methodRaw.substring(0, eqIdx)) : parseInt(methodRaw);
    if (methodId === 1) {
        renderKnownSpellsSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
    } else if (methodId === 3) {
        renderSpellbookSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
    }
}

function upgradePreparedToggle(id, level) {
    const cls = character.class;
    const classId = cls ? cls.id : 0;
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });
    const locked = character.lockedSpells || [];
    if (locked.includes(id)) return;

    const newLevel = upgradeState.newLevel || (character.level + 1);
    const newSpellData = getSpellDataFromProficiency(classId, newLevel);
    const preparedLimit = newSpellData.prepared || 0;
    const cantripLimit = newSpellData.cantrips || 0;

    if (level === 0) {
        const newCantripIds = upgradeState._upgradeNewCantrips || [];
        const idx = newCantripIds.indexOf(id);
        if (idx !== -1) {
            newCantripIds.splice(idx, 1);
        } else {
            const nonLocked = newCantripIds.filter(cid => !locked.includes(cid));
            if (nonLocked.length < cantripLimit) {
                newCantripIds.push(id);
            }
        }
    } else {
        const newSpellIds = upgradeState._upgradeNewSpells || [];
        const idx = newSpellIds.indexOf(id);
        if (idx !== -1) {
            newSpellIds.splice(idx, 1);
        } else {
            const nonLocked = newSpellIds.filter(sid => !locked.includes(sid));
            if (nonLocked.length < preparedLimit) {
                newSpellIds.push(id);
            }
        }
    }

    const selected = character.selectedSpells || [];
    const scCfg = (dataCache.spellcasting || []).find(s => s.class === classId);
    const scInfo = upgradeState.spellcastingInfo || {};
    renderPreparedSpellsSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
}

function upgradeSpellbookAdd(id) {
    const cls = character.class;
    const classId = cls ? cls.id : 0;
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });
    const newLevel = upgradeState.newLevel || (character.level + 1);
    const newSpellData = getSpellDataFromProficiency(classId, newLevel);
    const spellbookGain = newSpellData.spellbook_gain_per_level || 2;

    const newSpellIds = upgradeState._upgradeNewSpells || [];
    const idx = newSpellIds.indexOf(id);
    if (idx !== -1) {
        newSpellIds.splice(idx, 1);
    } else {
        if (newSpellIds.length < spellbookGain) {
            newSpellIds.push(id);
        }
    }

    const selected = character.selectedSpells || [];
    const locked = character.lockedSpells || [];
    const scCfg = (dataCache.spellcasting || []).find(s => s.class === classId);
    const scInfo = upgradeState.spellcastingInfo || {};
    renderSpellbookSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
}

function upgradeSpellbookAddExtra() {
    const cls = character.class;
    const classId = cls ? cls.id : 0;
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });

    const extraSpell = allSpells.find(s => !(upgradeState._upgradeNewSpells || []).includes(s.id));
    if (extraSpell && upgradeState._upgradeNewSpells) {
        upgradeState._upgradeNewSpells.push(extraSpell.id);
        const selected = character.selectedSpells || [];
        const locked = character.lockedSpells || [];
        const newLevel = upgradeState.newLevel || (character.level + 1);
        const newSpellData = getSpellDataFromProficiency(classId, newLevel);
        const scCfg = (dataCache.spellcasting || []).find(s => s.class === classId);
        const scInfo = upgradeState.spellcastingInfo || {};
        renderSpellbookSection($('#upgradeSpellSectionTarget'), allSpells, selected, locked, null, newSpellData, scInfo, scCfg, false, newLevel);
    }
}

function previewUpgradeSpell(id) {
    const allSpells = dataCache.spells || [];
    const spell = allSpells.find(s => s.id === id);
    if (!spell) return;
    const html = buildSpellDetailHTML(spell);
    $('#upgradeSpellDetailPanel').html(html);
}

export {
    buildSelector,
    saveScrollAncestors,
    restoreScrollAncestors,
    upgradeToggleSpell,
    startReplace,
    confirmReplace,
    cancelReplace,
    upgradePreparedToggle,
    upgradeSpellbookAdd,
    upgradeSpellbookAddExtra,
    previewUpgradeSpell
};