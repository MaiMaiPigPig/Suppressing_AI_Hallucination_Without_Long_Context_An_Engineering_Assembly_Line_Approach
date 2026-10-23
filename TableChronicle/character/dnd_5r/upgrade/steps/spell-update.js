import { upgradeState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { getSpellDataFromProficiency, getMethodNameById } from '../../core/spells/spell-system.js';
import { saveScrollAncestors, restoreScrollAncestors } from './spell-update-interactions.js';

// ===== upgrade/steps/spell-update.js =====
// 升级法术步骤——渲染部分：按施法方式渲染已知法术 / 准备法术 / 法术书三个分区。
// 交互回调见 spell-update-interactions.js。

function renderUpgradeSpellSection($content) {
    const cls = character.class;
    if (!cls) return;

    const scCfg = (dataCache.spellcasting || []).find(s => s.class === cls.id);
    if (!scCfg || !cls.spellcaster || cls.spellcaster <= 0) return;

    const classId = cls.id;
    const methodRaw = String(scCfg.preparation_method || '');
    const eqIdx = methodRaw.indexOf('=');
    const methodId = eqIdx !== -1 ? parseInt(methodRaw.substring(0, eqIdx)) : parseInt(methodRaw);
    const methodName = getMethodNameById(methodId);

    const scInfo = upgradeState.spellcastingInfo || {};
    const currentLevel = character.level || 1;
    const newLevel = upgradeState.newLevel || (currentLevel + 1);

    const spellData = getSpellDataFromProficiency(classId, currentLevel);
    const newSpellData = getSpellDataFromProficiency(classId, newLevel);

    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });

    const selected = character.selectedSpells || [];
    const locked = character.lockedSpells || [];

    const isSpellbook = methodName === 'spellbook' && newSpellData.spellbook_start > 0;

    if (methodId === 1) {
        renderKnownSpellsSection($content, allSpells, selected, locked, spellData, newSpellData, scInfo, scCfg, isSpellbook, newLevel);
    } else if (methodId === 2) {
        renderPreparedSpellsSection($content, allSpells, selected, locked, spellData, newSpellData, scInfo, scCfg, isSpellbook, newLevel);
    } else if (methodId === 3) {
        renderSpellbookSection($content, allSpells, selected, locked, spellData, newSpellData, scInfo, scCfg, isSpellbook, newLevel);
    }
}

function renderKnownSpellsSection($content, allSpells, selected, locked, spellData, newSpellData, scInfo, scCfg, isSpellbook, newLevel) {
    if (upgradeState._replaceCountRemaining === undefined) {
        upgradeState._replaceCountRemaining = 1;
    }
    if (upgradeState._cantripReplaceRemaining === undefined) {
        upgradeState._cantripReplaceRemaining = 1;
    }
    if (upgradeState._isInReplaceMode === undefined) {
        upgradeState._isInReplaceMode = false;
    }
    if (upgradeState._replaceTargetId === undefined) {
        upgradeState._replaceTargetId = null;
    }
    if (upgradeState._replaceNewId === undefined) {
        upgradeState._replaceNewId = null;
    }
    if (upgradeState._upgradeNewSpells === undefined) {
        upgradeState._upgradeNewSpells = [];
    }
    if (upgradeState._upgradeNewCantrips === undefined) {
        upgradeState._upgradeNewCantrips = [];
    }
    if (upgradeState._upgradeRemovedSpells === undefined) {
        upgradeState._upgradeRemovedSpells = [];
    }
    if (upgradeState._upgradeReplacedSpells === undefined) {
        upgradeState._upgradeReplacedSpells = [];
    }

    const replaceRemaining = upgradeState._replaceCountRemaining;
    const isInReplaceMode = upgradeState._isInReplaceMode;
    const replaceTargetId = upgradeState._replaceTargetId;
    const replaceNewId = upgradeState._replaceNewId;

    const hasTarget = replaceTargetId !== null;
    const hasNew = replaceNewId !== null;
    const canConfirm = hasTarget && hasNew;

    const oldSpells = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id);
        return s && s.level > 0;
    });
    // 被替换操作移除的法术（来自 _upgradeRemovedSpells）
    const removedSpells = upgradeState._upgradeRemovedSpells || [];
    // 剔除已移除的后，真正显示为"已有"的法术
    const effectiveOldSpells = oldSpells.filter(id => !removedSpells.includes(id));

    // 替换模式下的"当前有效已选"：再进一步去掉待移除的法术
    const effectiveSelected = hasTarget ? effectiveOldSpells.filter(id => id !== replaceTargetId) : effectiveOldSpells;

    const oldCantrips = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id);
        return s && s.level === 0;
    });

    const newSpellGain = scInfo.preparedGain || 0;
    const newCantripGain = scInfo.cantripGain || 0;

    const newSpellIds = upgradeState._upgradeNewSpells;
    const newCantripIds = upgradeState._upgradeNewCantrips;

    const replacedSpells = upgradeState._upgradeReplacedSpells || [];
    // 常规新增（不含替换新增），用于计算剩余可增次数
    const currentNewSpells = newSpellIds.filter(id => !effectiveOldSpells.includes(id) && !replacedSpells.includes(id));
    // 用于总数显示 = 所有旧法术（剔除已移除） + 所有新增（含替换）
    const totalNewSpells = newSpellIds.filter(id => !effectiveOldSpells.includes(id));
    const currentNewCantrips = newCantripIds.filter(id => !oldCantrips.includes(id));

    const spellLimit = newSpellData.prepared || 0;
    const newSpellsRemaining = Math.max(0, spellLimit - effectiveOldSpells.length - currentNewSpells.length);
    const newCantripsRemaining = Math.max(0, newCantripGain - currentNewCantrips.length);
    const cantripReplaceRemaining = upgradeState._cantripReplaceRemaining !== undefined ? upgradeState._cantripReplaceRemaining : 0;

    // 替换模式选中目标后，"可选项" = 不在 effectiveSelected 中的法术（包括目标自己、所有未选中的）
    const isCandidateInReplace = (spellId) => {
        return hasTarget && !effectiveSelected.includes(spellId) && !locked.includes(spellId);
    };

    const spellsByLevel = {};
    for (let i = 1; i <= 9; i++) {
        const maxSlots = newSpellData.slots[i] || 0;
        if (maxSlots > 0) {
            spellsByLevel[i] = allSpells.filter(s => s.level === i);
        }
    }
    const cantrips = allSpells.filter(s => s.level === 0);

    let levelsHTML = '';
    for (let i = 1; i <= 9; i++) {
        const spells = spellsByLevel[i];
        if (!spells || spells.length === 0) continue;
        const maxSlots = newSpellData.slots[i] || 0;
        if (maxSlots === 0) continue;
        levelsHTML += `
        <div class="spell-left-section">
            <div class="spell-left-section-title">${i}环法术（${spells.length}）</div>
            <div class="spell-btn-grid">
                ${spells.map(s => {
                    const isLocked = locked.includes(s.id);
                    const isOldSelected = effectiveOldSpells.includes(s.id);
                    const isNewSelected = newSpellIds.includes(s.id);
                    const isEffective = effectiveSelected.includes(s.id);
                    const isTarget = replaceTargetId === s.id;
                    const isCandidate = isCandidateInReplace(s.id);
                    const isReplacement = replaceNewId === s.id;

                    const isReplaced = (upgradeState._upgradeReplacedSpells || []).includes(s.id);
                    let disabled;
                    let extraClass = '';
                    let title = '';
                    if (isInReplaceMode) {
                        if (!hasTarget) {
                            // 等选目标：只有 old spells 可点
                            disabled = !isOldSelected;
                            if (isOldSelected) title = '点击标记为待移除';
                        } else {
                            // 已有目标：非 effective 的可点
                            if (isTarget) {
                                extraClass = 'replacing';
                                title = '点击取消移除';
                                disabled = false;
                            } else if (isReplacement) {
                                extraClass = 'replacing-new';
                                title = '点击取消选择';
                                disabled = false;
                            } else if (isCandidate) {
                                disabled = false;
                                title = hasNew ? '点击改选此法术' : '点击选为替换法术';
                            } else {
                                disabled = true;
                            }
                        }
                    } else {
                        disabled = (!isOldSelected && !isNewSelected && newSpellsRemaining <= 0) || isReplaced;
                        if (isOldSelected) title = '已有法术';
                        if (isReplaced) title = '替换新增，不可取消';
                    }

                    const clickHandler = isLocked ? '' : `onclick="upgradeToggleSpell(${s.id}, ${i}, 'spell')"`;
                    return `
                        <div class="spell-btn ${isOldSelected ? 'selected' : ''} ${isNewSelected && !isOldSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked || isReplaced ? 'locked' : ''} ${extraClass}"
                             ${clickHandler}
                             onmouseenter="previewUpgradeSpell(${s.id})"
                             title="${isLocked ? '特性自动添加，不可更改' : title}">
                            ${s.name}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    }

    // 替换模式提示文字
    let replaceHint = '';
    if (isInReplaceMode) {
        if (!hasTarget) {
            replaceHint = '<span style="color:#ff9640;">（请点击一个已有法术来取消它）</span>';
        } else if (!hasNew) {
            replaceHint = '<span style="color:#ff9640;">（请选择一个新法术来替换）</span>';
        } else {
            replaceHint = '<span style="color:#4fc3f7;">（已选择替换方案，点击"确认"完成替换）</span>';
        }
    }

    // 替换模式按钮 — 替换原来的"开始替换"按钮位置
    //（按钮直接放在 .spell-counters 内，见下方模板）

    var _savedScrolls = saveScrollAncestors($content);
    $content.html(`
        <div class="spell-step upgrade-spell-step">
            <div class="ability-header">
                <h2>法术更新</h2>
                <div class="spell-header-info">
                    <span class="spell-casting-ability">施法属性：${newSpellData.ability}</span>
                    <span class="spell-casting-ability">已知法术制</span>
                </div>
                <div class="spell-rule">
                    <span class="spell-rule-text">
                        新增 ${newSpellGain} 个已知法术，可替换 ${replaceRemaining} 个旧法术
                        ${replaceHint}
                    </span>
                </div>
            </div>

            <div class="spell-counters">
                <div class="spell-counter ${effectiveOldSpells.length + totalNewSpells.length >= spellLimit && !isInReplaceMode ? 'full' : ''}">
                    <span class="spell-counter-label">已知法术</span>
                    <span class="spell-counter-value">${effectiveOldSpells.length + totalNewSpells.length} / ${spellLimit}</span>
                </div>
                <div class="spell-counter ${newSpellsRemaining <= 0 ? 'full' : ''}">
                    <span class="spell-counter-label">新增剩余</span>
                    <span class="spell-counter-value">${newSpellsRemaining}</span>
                </div>
                <div class="spell-counter ${replaceRemaining <= 0 ? 'full' : ''}">
                    <span class="spell-counter-label">可替换次数</span>
                    <span class="spell-counter-value">${replaceRemaining}</span>
                </div>
                ${replaceRemaining > 0 && !isInReplaceMode ? `
                <div style="grid-column:1/-1;display:flex;justify-content:center;margin-top:4px;">
                    <button class="btn btn-secondary" onclick="startReplace()" style="font-size:0.85rem;padding:6px 18px;">
                        🔄 点击这里，开始替换法术
                    </button>
                </div>
                ` : ''}
                ${isInReplaceMode ? `
                <div style="grid-column:1/-1;display:flex;gap:10px;justify-content:center;margin-top:4px;">
                    <button class="btn btn-primary" onclick="confirmReplace()" style="font-size:0.85rem;padding:6px 18px;${canConfirm ? '' : 'opacity:0.5;cursor:not-allowed;'}" ${canConfirm ? '' : 'disabled'}>
                        确认替换
                    </button>
                    <button class="btn btn-secondary" onclick="cancelReplace()" style="font-size:0.85rem;padding:6px 18px;">
                        取消
                    </button>
                </div>
                ` : ''}
            </div>

            <div class="spell-body">
                <div class="spell-left">
                    ${cantrips.length > 0 && newCantripGain > 0 ? `
                    <div class="spell-left-section">
                        <div class="spell-left-section-title">戏法（${cantrips.length}）  |  可替换：${cantripReplaceRemaining}</div>
                        <div class="spell-btn-grid">
                            ${cantrips.map(s => {
                                const isLocked = locked.includes(s.id);
                                const isOldSelected = oldCantrips.includes(s.id);
                                const isNewSelected = newCantripIds.includes(s.id);
                                const isTarget = false; // 戏法单独处理，暂不实现
                                let disabled;
                                let extraClass = '';
                                if (isInReplaceMode) {
                                    disabled = true; // 替换模式中禁用戏法
                                } else {
                                    disabled = !isOldSelected && !isNewSelected && (newCantripsRemaining <= 0);
                                }
                                const clickHandler = isLocked ? '' : `onclick="upgradeToggleSpell(${s.id}, 0, 'cantrip')"`;
                                return `
                                    <div class="spell-btn ${isOldSelected ? 'selected' : ''} ${isNewSelected && !isOldSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''} ${extraClass}"
                                         ${clickHandler}
                                         onmouseenter="previewUpgradeSpell(${s.id})"
                                         title="${isLocked ? '特性自动添加，不可更改' : ''}${isOldSelected ? '已知戏法' : ''}">
                                        ${s.name}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${levelsHTML}

                    ${Object.keys(spellsByLevel).length === 0 ? `
                    <div class="spell-empty">该职业目前没有可选择的法术</div>
                    ` : ''}
                </div>

                <div class="spell-right" id="upgradeSpellDetailPanel">
                    <div class="spell-detail-empty">请选择一个法术查看详情</div>
                </div>
            </div>
        </div>
    `);
    requestAnimationFrame(function() {
        restoreScrollAncestors(_savedScrolls);
    });
}

function renderPreparedSpellsSection($content, allSpells, selected, locked, spellData, newSpellData, scInfo, scCfg, isSpellbook, newLevel) {
    if (upgradeState._upgradeNewSpells === undefined) {
        upgradeState._upgradeNewSpells = [...selected.filter(id => {
            const s = allSpells.find(sp => sp.id === id);
            return s && s.level > 0;
        })];
    }
    if (upgradeState._upgradeNewCantrips === undefined) {
        upgradeState._upgradeNewCantrips = [...selected.filter(id => {
            const s = allSpells.find(sp => sp.id === id);
            return s && s.level === 0;
        })];
    }

    const newSpellIds = upgradeState._upgradeNewSpells;
    const newCantripIds = upgradeState._upgradeNewCantrips;
    const oldSpells = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id);
        return s && s.level > 0;
    });
    const oldCantrips = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id);
        return s && s.level === 0;
    });

    const preparedLimit = newSpellData.prepared || 0;
    const cantripLimit = newSpellData.cantrips || 0;

    const spellsByLevel = {};
    for (let i = 1; i <= 9; i++) {
        const maxSlots = newSpellData.slots[i] || 0;
        if (maxSlots > 0) {
            spellsByLevel[i] = allSpells.filter(s => s.level === i);
        }
    }
    const cantrips = allSpells.filter(s => s.level === 0);

    let levelsHTML = '';
    for (let i = 1; i <= 9; i++) {
        const spells = spellsByLevel[i];
        if (!spells || spells.length === 0) continue;
        levelsHTML += `
        <div class="spell-left-section">
            <div class="spell-left-section-title">${i}环法术（${spells.length}）</div>
            <div class="spell-btn-grid">
                ${spells.map(s => {
                    const isSelected = newSpellIds.includes(s.id);
                    const isLocked = locked.includes(s.id);
                    const disabled = !isSelected && newSpellIds.filter(id => !locked.includes(id)).length >= preparedLimit;
                    const clickHandler = isLocked ? '' : `onclick="upgradePreparedToggle(${s.id}, ${i})"`;
                    return `
                        <div class="spell-btn ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''}"
                             ${clickHandler}
                             onmouseenter="previewUpgradeSpell(${s.id})"
                             title="${isLocked ? '特性自动添加，不可更改' : ''}">
                            ${s.name}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    }

    const nonLockedPrep = newSpellIds.filter(id => !locked.includes(id)).length;

    var _prepSavedScrolls = saveScrollAncestors($content);
    $content.html(`
        <div class="spell-step upgrade-spell-step">
            <div class="ability-header">
                <h2>法术准备</h2>
                <div class="spell-header-info">
                    <span class="spell-casting-ability">施法属性：${newSpellData.ability}</span>
                    <span class="spell-casting-ability">准备施法制</span>
                </div>
                <div class="spell-rule">
                    <span class="spell-rule-text">
                        可从当前环位及以下的完整法表中自由选择，上限 ${preparedLimit} 个准备法术
                    </span>
                </div>
            </div>

            <div class="spell-counters">
                <div class="spell-counter ${nonLockedPrep >= preparedLimit ? 'full' : ''}">
                    <span class="spell-counter-label">准备法术</span>
                    <span class="spell-counter-value">${nonLockedPrep} / ${preparedLimit}</span>
                </div>
            </div>

            <div class="spell-body">
                <div class="spell-left">
                    ${cantrips.length > 0 && cantripLimit > 0 ? `
                    <div class="spell-left-section">
                        <div class="spell-left-section-title">戏法（${cantrips.length}）</div>
                        <div class="spell-btn-grid">
                            ${cantrips.map(s => {
                                const isSelected = newCantripIds.includes(s.id);
                                const isLocked = locked.includes(s.id);
                                const disabled = !isSelected && newCantripIds.filter(id => !locked.includes(id)).length >= cantripLimit;
                                const clickHandler = isLocked ? '' : `onclick="upgradePreparedToggle(${s.id}, 0)"`;
                                return `
                                    <div class="spell-btn ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''}"
                                         ${clickHandler}
                                         onmouseenter="previewUpgradeSpell(${s.id})">
                                        ${s.name}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${levelsHTML}
                </div>

                <div class="spell-right" id="upgradeSpellDetailPanel">
                    <div class="spell-detail-empty">请选择一个法术查看详情</div>
                </div>
            </div>
        </div>
    `);
    requestAnimationFrame(function() {
        restoreScrollAncestors(_prepSavedScrolls);
    });
}

function renderSpellbookSection($content, allSpells, selected, locked, spellData, newSpellData, scInfo, scCfg, isSpellbook, newLevel) {
    if (upgradeState._upgradeNewSpells === undefined) {
        upgradeState._upgradeNewSpells = [];
    }
    if (upgradeState._upgradeNewCantrips === undefined) {
        upgradeState._upgradeNewCantrips = [];
    }
    if (upgradeState._cantripReplaceRemaining === undefined) {
        upgradeState._cantripReplaceRemaining = 1;
    }
    if (upgradeState._replaceCantripId === undefined) {
        upgradeState._replaceCantripId = null;
    }

    const newSpellIds = upgradeState._upgradeNewSpells;
    const newCantripIds = upgradeState._upgradeNewCantrips;
    const cantripReplaceRemaining = upgradeState._cantripReplaceRemaining;
    const replaceCantripId = upgradeState._replaceCantripId;

    const oldSpells = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id);
        return s && s.level > 0;
    });
    const oldCantrips = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id);
        return s && s.level === 0;
    });

    const spellbookGain = newSpellData.spellbook_gain_per_level || 2;
    const newSpellsRemaining = Math.max(0, spellbookGain - newSpellIds.length);
    const cantripLimit = newSpellData.cantrips || 0;

    const spellsByLevel = {};
    for (let i = 1; i <= 9; i++) {
        const maxSlots = newSpellData.slots[i] || 0;
        if (maxSlots > 0) {
            spellsByLevel[i] = allSpells.filter(s => s.level === i);
        }
    }
    const cantrips = allSpells.filter(s => s.level === 0);

    let levelsHTML = '';
    for (let i = 1; i <= 9; i++) {
        const spells = spellsByLevel[i];
        if (!spells || spells.length === 0) continue;
        levelsHTML += `
        <div class="spell-left-section">
            <div class="spell-left-section-title">${i}环法术（${spells.length}）</div>
            <div class="spell-btn-grid">
                ${spells.map(s => {
                    const isOldSelected = oldSpells.includes(s.id);
                    const isNewSelected = newSpellIds.includes(s.id);
                    const isLocked = locked.includes(s.id);
                    const disabled = !isOldSelected && !isNewSelected && newSpellsRemaining <= 0;
                    const clickHandler = isLocked ? '' : (!isOldSelected ? `onclick="upgradeSpellbookAdd(${s.id})"` : '');
                    return `
                        <div class="spell-btn ${isOldSelected ? 'selected' : ''} ${isNewSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''}"
                             ${clickHandler}
                             onmouseenter="previewUpgradeSpell(${s.id})"
                             title="${isLocked ? '特性自动添加，不可更改' : ''}${isOldSelected ? '法术书中已有法术' : ''}">
                            ${s.name}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;

    }

    var _bookSavedScrolls = saveScrollAncestors($content);
    $content.html(`
        <div class="spell-step upgrade-spell-step">
            <div class="ability-header">
                <h2>法术书更新</h2>
                <div class="spell-header-info">
                    <span class="spell-casting-ability">施法属性：${newSpellData.ability}</span>
                    <span class="spell-casting-ability">法术书施法制</span>
                </div>
                <div class="spell-rule">
                    <span class="spell-rule-text">
                        升级时法术书自动获得 ${spellbookGain} 个新法术，已有法术不可更改
                    </span>
                </div>
            </div>

            <div class="spell-counters">
                <div class="spell-counter ${newSpellIds.length >= spellbookGain ? 'full' : ''}">
                    <span class="spell-counter-label">新增法术</span>
                    <span class="spell-counter-value">${newSpellIds.length} / ${spellbookGain}</span>
                </div>
                <div class="spell-counter">
                    <span class="spell-counter-label">法术书总计</span>
                    <span class="spell-counter-value">${oldSpells.length + newSpellIds.length}</span>
                </div>
            </div>

            <div class="spell-body">
                <div class="spell-left">
                    ${cantrips.length > 0 && cantripLimit > 0 ? `
                    <div class="spell-left-section">
                        <div class="spell-left-section-title">戏法（${cantrips.length}）  |  可替换：${cantripReplaceRemaining}</div>
                        <div class="spell-btn-grid">
                            ${cantrips.map(s => {
                                const isOldSelected = oldCantrips.includes(s.id);
                                const isNewSelected = newCantripIds.includes(s.id);
                                const isLocked = locked.includes(s.id);
                                const isReplacingTarget = replaceCantripId === s.id;
                                const disabled = !isOldSelected && !isNewSelected && newCantripIds.filter(id => !oldCantrips.includes(id)).length >= (scInfo.cantripGain || 0);
                                const clickHandler = isLocked ? '' : `onclick="upgradeToggleSpell(${s.id}, 0, 'cantrip')"`;
                                return `
                                    <div class="spell-btn ${isOldSelected ? 'selected' : ''} ${isNewSelected && !isOldSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''} ${isReplacingTarget ? 'replacing' : ''}"
                                         ${clickHandler}
                                         onmouseenter="previewUpgradeSpell(${s.id})"
                                         title="${isLocked ? '特性自动添加，不可更改' : ''}${isOldSelected ? '已知戏法，点击可替换' : ''}">
                                        ${s.name}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${levelsHTML}
                </div>

                <div class="spell-right" id="upgradeSpellDetailPanel">
                    <div class="spell-detail-empty">请选择一个法术查看详情</div>
                </div>
            </div>

            <div style="margin-top:10px;text-align:center;color:var(--text-muted);font-size:0.8rem;">
                <button class="btn btn-secondary" onclick="upgradeSpellbookAddExtra()" style="font-size:0.85rem;padding:6px 18px;">
                    + 额外添加法术
                </button>
                <span style="display:block;margin-top:4px;">请根据实际跑团情况使用</span>
            </div>
        </div>
    `);
    requestAnimationFrame(function() {
        restoreScrollAncestors(_bookSavedScrolls);
    });
}

export {
    renderUpgradeSpellSection,
    renderKnownSpellsSection,
    renderPreparedSpellsSection,
    renderSpellbookSection
};