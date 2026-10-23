import { upgradeState, STEPS, stepState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { renderStep } from './step-router.js';
import { continueUpgrade } from './lifecycle.js';
import { applyUpgradeSelections } from '../steps/selection-apply.js';

// ===== upgrade/flow/navigation.js =====
// 升级导航：进度条/指示器/按钮刷新、前进后退跳转。

// ===== 步骤指示器 =====
function updateProgress(step) {
    $('#stepProgress .step-item').each(function() {
        const s = parseInt($(this).data('step'));
        $(this).toggleClass('active', s === step)
               .toggleClass('completed', s < step);
    });
}

function updateStepIndicator(step) {
    const totalGained = upgradeState.totalLevelsGained;
    // 翻译：拼出职业等级信息（如"野蛮人 Lv.2 → Lv.3"）
    const clsName = character.class ? character.class.name : '—';
    const curLevel = character.level || 1;
    const newLevel = upgradeState.newLevel || (curLevel + 1);

    if (step === 0) {
        $('#stepIndicator').text(`${clsName} Lv.${curLevel}`);
    } else if (step >= 1 && step <= 4) {
        $('#stepIndicator').text(`${clsName} Lv.${curLevel} → Lv.${newLevel}  · 第 ${totalGained + 1} 次升级`);
    } else {
        $('#stepIndicator').text(`${clsName} Lv.${newLevel}  · 已升级 ${totalGained} 级`);
    }
}

function updateNavButtons(step) {
    $('#prevBtn').css('visibility', 'hidden');
    if (step === 0) {
        $('#prevBtn').css('visibility', 'visible');
        $('#prevBtn').text('← 返回角色');
        $('#nextBtn').css('visibility', 'hidden');
    } else if (step === 1) {
        $('#prevBtn').css('visibility', 'visible');
        $('#prevBtn').text('← 上一步');
        $('#nextBtn').css('visibility', 'visible');
        if (upgradeState.needsSubclassSelection) {
            $('#nextBtn').text('选择子职 →');
        } else {
            $('#nextBtn').text('查看特性 →');
        }
    } else if (step === 2) {
        $('#prevBtn').css('visibility', 'visible');
        $('#nextBtn').css('visibility', 'visible');
        $('#nextBtn').text('查看特性 →');
    } else if (step === 3) {
        $('#prevBtn').css('visibility', 'visible');
        $('#nextBtn').css('visibility', 'visible');
        $('#nextBtn').text('进行选择 →');
    } else if (step === 4) {
        $('#prevBtn').css('visibility', 'visible');
        $('#nextBtn').css('visibility', 'visible');
        $('#nextBtn').text('⬆️ 确认升级');
    } else if (step === 5) {
        $('#prevBtn').css('visibility', 'visible');
        $('#nextBtn').css('visibility', 'visible');
        $('#nextBtn').text('下一页 →');
    } else {
        $('#prevBtn').css('visibility', 'visible');
        $('#nextBtn').css('visibility', 'visible');
        $('#nextBtn').text('继续升级 →');
    }
}

// ===== 渲染步骤 =====

/**
 * 翻译：点击"下一步"按钮时的处理逻辑
 * 根据当前步骤决定下一步做什么
 */
function nextStep() {
    var fromStep = stepState.current;
    var fromName = ['导入角色','升级概览','子职选择','新增特性','选择确认','角色详情','保存导出'][fromStep] || '未知';
    console.log('[升级] nextStep 从 %d(%s) 出发', fromStep, fromName);

    if (stepState.current === 0) {
        // 翻译：导入页 → 升级概览
        stepState.current = 1;
        renderStep(1);
    } else if (stepState.current === 1) {
        // 翻译：升级概览 → 子职选择（如果需要）或新增特性
        if (upgradeState.needsSubclassSelection) {
            stepState.current = 2;
        } else {
            stepState.current = 3;
        }
        renderStep(stepState.current);
    } else if (stepState.current === 2) {
        // 翻译：子职选择 → 新增特性
        // 翻译：先检查是否已选择子职
        if (upgradeState._pendingSubclasses && !upgradeState._subclassSelectedId) {
            alert('请先选择一个子职业！');
            return;
        }
        // 翻译：如果选了子职，先应用到角色数据
        if (upgradeState._pendingSubclasses && upgradeState._subclassSelectedId) {
            var sc = (dataCache.subclasses || []).find(function(s) { return s.id === upgradeState._subclassSelectedId; });
            if (sc) {
                character.subclass = sc;
                console.log('[升级] 子职已选择:', sc.name);
                // 翻译：选中子职后清除收益缓存，确保 step 3 重新计算含子职特性的数据
                delete upgradeState.levelGains;
                // 翻译：清除临时选择状态
                delete upgradeState._pendingSubclasses;
                delete upgradeState._subclassSelectedId;
            }
        }
        stepState.current = 3;
        renderStep(3);
    } else if (stepState.current === 3) {
        // 翻译：新增特性 → 选择确认
        stepState.current = 4;
        // 翻译：选择确认 → 检查选择 → 应用 → 角色详情

        // 翻译：如果这一级必须选子职业却还没选，先拦下来（防止有人从进度条直接跳过来）
        if (upgradeState.needsSubclassSelection && !upgradeState._subclassSelectedId && !character.subclass) {
            alert('请先选择子职业！');
            stepState.current = 2;
            renderStep(2);
            return;
        }

        // 翻译：检查是否有待选择项未完成
        var hasPending = upgradeState.pendingSelections && upgradeState.pendingSelections.length > 0;
        var hasExtra = upgradeState.classExtraGroups && upgradeState.classExtraGroups.length > 0;

        // 翻译：有施法能力的职业也需要经过选择确认页（用于法术选择）
        var hasSpellcasting = character.class && character.class.spellcaster && character.class.spellcaster > 0;

        // 翻译：如果既没有待选项也没有施法能力，直接跳到角色详情
        if (!hasPending && !hasExtra && !hasSpellcasting) {
            // 翻译：应用用户的选择到角色数据
            applyUpgradeSelections();

            // 翻译：正式应用升级：更新角色等级和 HP
            character.level = upgradeState.newLevel;
            if (upgradeState.hpGain && upgradeState.hpGain > 0) {
                character.hp_max = (character.hp_max || 0) + upgradeState.hpGain;
            }
            // 翻译：累计已升级次数
            upgradeState.totalLevelsGained++;

            stepState.current = 5;
            renderStep(5);
            return;
        }

        // 翻译：有施法能力或待选项，进入选择确认页
        stepState.current = 4;
        renderStep(4);
        return;
    } else if (stepState.current === 4) {
        // 翻译：选择确认 → 检查选择 → 应用 → 角色详情

        // 翻译：验证所有待选项都已选够数量
        var hasPending = upgradeState.pendingSelections && upgradeState.pendingSelections.length > 0;
        var hasExtra = upgradeState.classExtraGroups && upgradeState.classExtraGroups.length > 0;
        var allSelected = true;
        if (hasPending) {
            upgradeState.pendingSelections.forEach(function(sel, idx) {
                var key = 'upgrade_sel_' + idx;
                var selected = upgradeState.selectedOptions[key] || [];
                if (selected.length < sel.count) {
                    allSelected = false;
                }
            });
        }
        if (hasExtra) {
            upgradeState.classExtraGroups.forEach(function(group, gi) {
                var key = 'upgrade_extra_' + gi;
                var selected = upgradeState.selectedOptions[key] || [];
                if (selected.length < group.count) {
                    allSelected = false;
                }
            });
        }

        // 翻译：如果有待选项但未选完，提示用户
        if ((hasPending || hasExtra) && !allSelected) {
            alert('请完成所有选择后再确认升级！');
            return;
        }

        // 翻译：应用用户的选择到角色数据
        applyUpgradeSelections();

        // 翻译：正式应用升级：更新角色等级和 HP
        character.level = upgradeState.newLevel;
        if (upgradeState.hpGain && upgradeState.hpGain > 0) {
            character.hp_max = (character.hp_max || 0) + upgradeState.hpGain;
        }
        // 翻译：累计已升级次数
        upgradeState.totalLevelsGained++;

        stepState.current = 5;
        renderStep(5);
    } else if (stepState.current === 5) {
        // 翻译：角色详情 → 保存导出
        stepState.current = 6;
        renderStep(6);
    } else if (stepState.current === 6) {
        // 翻译：保存导出页 → 继续升级
        continueUpgrade();
    }
}

/**
 * 翻译：点击"上一步"按钮时的处理逻辑
 * 逐级后退，智能跳过不需要的子职选择页
 */

/**
 * 翻译：点击"上一步"按钮时的处理逻辑
 * 逐级后退，智能跳过不需要的子职选择页
 */
function prevStep() {
    console.log('[升级] prevStep 当前步骤 %d', stepState.current);
    if (stepState.current > 0) {
        stepState.current--;
        // 翻译：如果上一步是子职选择但当前角色不需要选子职，再往前跳
        if (stepState.current === 2 && !upgradeState.needsSubclassSelection) {
            stepState.current--;
        }
        console.log('[升级] prevStep 后退到步骤 %d', stepState.current);
        renderStep(stepState.current);
    } else {
        // 翻译：在导入页再按"上一步" → 切换到角色详情页查看当前角色
        console.log('[升级] prevStep 从 step 0 切换到角色详情');
        stepState.current = 5;
        renderStep(5);
    }
}

/**
 * 翻译：直接跳转到指定步骤（点击进度条上的步骤时调用）
 * @param {number} step - 翻译：目标步骤索引
 */

/**
 * 翻译：直接跳转到指定步骤（点击进度条上的步骤时调用）
 * @param {number} step - 翻译：目标步骤索引
 */
function goToStep(step) {
    var stepName = ['导入角色','升级概览','子职选择','新增特性','选择确认','角色详情','保存导出'][step] || '未知';
    console.log('[升级] goToStep 跳转到 %d(%s)', step, stepName);
    if (step >= 0 && step < STEPS.length) {
        stepState.current = step;
        renderStep(step);
    }
}

/**
 * 翻译：返回角色页面（取消升级，回到车卡页查看原角色数据）
 * 原始角色数据保存在 sessionStorage 中，跳转后车卡页自动加载
 */
function goBackToCharacter() {
    window.location.href = '/character/dnd_5r/creation/character.html?loadFromSession=1';
}

export {
    updateProgress,
    updateStepIndicator,
    updateNavButtons,
    nextStep,
    prevStep,
    goToStep,
    goBackToCharacter
};