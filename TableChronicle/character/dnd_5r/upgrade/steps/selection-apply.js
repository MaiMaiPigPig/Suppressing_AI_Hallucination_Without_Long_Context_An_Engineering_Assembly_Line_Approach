import { escapeHtml, upgradeState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';

/**
 * 翻译：在升级预览页面渲染选择 UI（技能、武器、class_extra 等）
 * @param {object} $container - 翻译：jQuery 容器对象
 * @param {array} pendingSelections - 翻译：待选择项列表
 * @param {array} classExtraGroups - 翻译：class_extra 分组列表
 */
function renderUpgradeSelections($container, pendingSelections, classExtraGroups) {
    // 翻译：如果没有任何待选择项，直接返回
    if ((!pendingSelections || pendingSelections.length === 0) && 
        (!classExtraGroups || classExtraGroups.length === 0)) return;

    var html = '';
    
    // 渲染 handler 解析出的选择项（技能专精、工具熟练等）
    if (pendingSelections && pendingSelections.length > 0) {
        pendingSelections.forEach(function(sel, idx) {
            if (sel.type === 'proficiency' && sel.subtype === 'pure_list') {
                // 技能专精（学者）
                var skillIds = sel.skillIds || sel.availableIds || [];
                var skills = skillIds.map(function(id) {
                    var s = (dataCache.skills || []).find(function(sk) { return sk.id === id; });
                    return s ? { id: s.id, name: s.name } : { id: id, name: '技能#' + id };
                });
                var selectId = 'upgrade_sel_' + idx;
                var savedSel = upgradeState.selectedOptions['rule_' + idx] || [];
                
                html += '<div class="section" style="max-width:640px;">';
                html += '<div class="section-title"><span class="icon">🎯</span> ' + (sel.sourceName || '选择') + '</div>';
                html += '<div class="upgrade-selection-desc">选择 ' + sel.count + ' 项（来自：' + (sel.sourceName || '特性') + '）</div>';
                html += '<div class="upgrade-option-grid" data-select-id="' + selectId + '" data-max="' + sel.count + '">';
                skills.forEach(function(sk) {
                    var checked = savedSel.indexOf(sk.id) !== -1 ? ' checked' : '';
                    html += '<label class="upgrade-option-item' + checked + '">';
                    html += '<input type="checkbox" value="' + sk.id + '"' + checked + '>';
                    html += '<span>' + sk.name + '</span>';
                    html += '</label>';
                });
                html += '</div>';
                html += '<div class="upgrade-selection-hint" id="hint_' + selectId + '">已选 0/' + sel.count + '</div>';
                html += '</div>';
            } else if (sel.type === 'filter' && sel.category === 'weapons') {
                // 武器精通选择
                var weaponData = dataCache.weapons || [];
                var weaponProfIds = (sel.filterParams && sel.filterParams.category) || [];
                var availableWeapons = weaponData.filter(function(w) {
                    if (!w.mastery) return false;
                    if (weaponProfIds.length > 0 && weaponProfIds.indexOf(w.weapon_category) === -1) return false;
                    return true;
                });
                var selectId = 'upgrade_sel_' + idx;
                var savedSel = upgradeState.selectedOptions[selectId] || [];

                var featureDesc = '';
                if (sel.featureId) {
                    var featData = (dataCache.classFeatures || []).find(function(cf) { return String(cf.id) === String(sel.featureId); });
                    if (featData && featData.desc) {
                        featureDesc = '<div class="upgrade-feature-desc">' + escapeHtml(featData.desc) + '</div>';
                    }
                }
                
                html += '<div class="section" style="max-width:640px;">';
                html += '<div class="section-title"><span class="icon">⚔️</span> ' + (sel.sourceName || '武器精通') + '</div>';
                html += featureDesc;
                html += '<div class="upgrade-selection-desc">选择 ' + sel.count + ' 种武器获得精通</div>';
                html += '<div class="upgrade-option-grid" data-select-id="' + selectId + '" data-max="' + sel.count + '">';
                availableWeapons.forEach(function(w) {
                    var checked = savedSel.indexOf(w.id) !== -1 ? ' checked' : '';
                    html += '<label class="upgrade-option-item' + checked + '">';
                    html += '<input type="checkbox" value="' + w.id + '"' + checked + '>';
                    html += '<span>' + w.name + '</span>';
                    html += '</label>';
                });
                html += '</div>';
                html += '<div class="upgrade-selection-hint" id="hint_' + selectId + '">已选 0/' + sel.count + '</div>';
                html += '</div>';
            } else if (sel.type === 'operation' && sel.subtype === 'skill_add') {
                // 技能熟练
                var allSkills = dataCache.skills || [];
                var selectId = 'upgrade_sel_op_' + idx;
                var savedSel = upgradeState.selectedOptions['rule_' + idx] || [];
                
                html += '<div class="section" style="max-width:640px;">';
                html += '<div class="section-title"><span class="icon">📖</span> 技能熟练</div>';
                html += '<div class="upgrade-selection-desc">选择 ' + sel.count + ' 个技能获得熟练</div>';
                html += '<div class="upgrade-option-grid" data-select-id="' + selectId + '" data-max="' + sel.count + '">';
                allSkills.forEach(function(sk) {
                    var checked = savedSel.indexOf(sk.id) !== -1 ? ' checked' : '';
                    html += '<label class="upgrade-option-item' + checked + '">';
                    html += '<input type="checkbox" value="' + sk.id + '"' + checked + '>';
                    html += '<span>' + sk.name + '</span>';
                    html += '</label>';
                });
                html += '</div>';
                html += '<div class="upgrade-selection-hint" id="hint_' + selectId + '">已选 0/' + sel.count + '</div>';
                html += '</div>';
            }
        });
    }

    // 渲染 class_extra 选项（战技选项、魔能祈唤等）
    if (classExtraGroups && classExtraGroups.length > 0) {
        classExtraGroups.forEach(function(group, gi) {
            var selectId = 'upgrade_extra_' + gi;
            var savedSel = upgradeState.selectedOptions['extra_' + gi] || [];
            
            html += '<div class="class-extra-group" style="max-width:640px;">';
            html += '<div class="class-extra-group-title">' + group.groupName + '</div>';
            if (group.sourceName) {
                html += '<div class="class-extra-group-source">来源：' + group.sourceName + '</div>';
            }
            html += '<div class="upgrade-selection-desc">选择 ' + group.count + ' 项</div>';
            html += '<div class="upgrade-option-grid" data-select-id="' + selectId + '" data-max="' + group.count + '">';
            group.candidates.forEach(function(item) {
                var checked = savedSel.indexOf(item.id) !== -1 ? ' checked' : '';
                html += '<label class="upgrade-option-item' + checked + '">';
                html += '<input type="checkbox" value="' + item.id + '"' + checked + '>';
                html += '<span>' + (item.name || item.选项名字 || '选项#' + item.id) + '</span>';
                html += '</label>';
            });
            html += '</div>';
            html += '<div class="upgrade-selection-hint" id="hint_' + selectId + '">已选 0/' + group.count + '</div>';
            html += '</div>';
        });
    }

    $container.append(html);

    // 绑定选择事件
    $('.upgrade-option-grid').each(function() {
        var $grid = $(this);
        var selectId = $grid.data('select-id');
        var maxSel = $grid.data('max');
        var hintId = 'hint_' + selectId;

        $grid.on('change', 'input[type="checkbox"]', function() {
            var $checked = $grid.find('input:checked');
            if ($checked.length > maxSel) {
                $(this).prop('checked', false);
                return;
            }
            $grid.find('.upgrade-option-item').removeClass('checked');
            $grid.find('input:checked').each(function() {
                $(this).closest('.upgrade-option-item').addClass('checked');
            });
            $('#' + hintId).text('已选 ' + $checked.length + '/' + maxSel);
            var selected = [];
            $grid.find('input:checked').each(function() { selected.push(parseInt($(this).val())); });
            var prefix = selectId.replace(/^(upgrade_sel_\d+|upgrade_extra_\d+)$/, function(m) {
                if (m.indexOf('upgrade_sel_') === 0) return 'rule_';
                if (m.indexOf('upgrade_extra_') === 0) return 'extra_';
                return m;
            });
            upgradeState.selectedOptions[selectId] = selected;
        });
    });
}

// 应用升级选择到角色

// 应用升级选择到角色
function applyUpgradeSelections() {
    var ruleIdx = 0;
    var extraIdx = 0;

    upgradeState.pendingSelections.forEach(function(sel, idx) {
        var key = 'upgrade_sel_' + idx;
        var selected = upgradeState.selectedOptions[key] || [];
        
        if (sel.type === 'proficiency' && sel.subtype === 'pure_list') {
            selected.forEach(function(skillId) {
                var exists = character.featureSelections.expertise.some(function(e) {
                    return (typeof e === 'object' ? e.id === skillId : e === skillId);
                });
                if (!exists) {
                    var skillItem = (dataCache.skills || []).find(function(s) { return s.id === skillId; });
                    character.featureSelections.expertise.push({
                        id: skillId,
                        name: skillItem ? skillItem.name : '',
                        source: 'upgrade',
                        sourceLabel: sel.sourceName || '',
                        link: sel.featureId || null
                    });
                }
            });
            selected.forEach(function(skillId) {
                if (!character.allSkills) character.allSkills = [];
                var found = character.allSkills.find(function(s) {
                    return (typeof s === 'object' ? s.id === skillId : s === skillId);
                });
                if (!found) character.allSkills.push(skillId);
            });
        } else if (sel.type === 'operation' && sel.subtype === 'skill_add') {
            selected.forEach(function(skillId) {
                var exists = character.featureSelections.skills.some(function(s) {
                    return (typeof s === 'object' ? s.id === skillId : s === skillId);
                });
                if (!exists) {
                    var skillItem = (dataCache.skills || []).find(function(s) { return s.id === skillId; });
                    character.featureSelections.skills.push({
                        id: skillId,
                        name: skillItem ? skillItem.name : '',
                        source: 'upgrade',
                        sourceLabel: sel.sourceName || '',
                        link: sel.featureId || null
                    });
                }
            });
        } else if (sel.type === 'filter' && sel.category === 'weapons') {
            selected.forEach(function(weaponId) {
                var exists = character.featureSelections.weapons.some(function(e) {
                    return (typeof e === 'object' ? e.weaponId === weaponId : e === weaponId);
                });
                if (!exists) {
                    var weaponItem = (dataCache.weapons || []).find(function(w) { return w.id === weaponId; });
                    character.featureSelections.weapons.push({
                        typeId: 0,
                        weaponId: weaponId,
                        featureId: sel.featureId || 0,
                        name: weaponItem ? weaponItem.name : '',
                        source: 'upgrade',
                        sourceLabel: sel.sourceName || '',
                        link: sel.featureId || null
                    });
                }
            });
        } else if (sel.type === 'weapon_mastery') {
            selected.forEach(function(weaponId) {
                var exists = character.featureSelections.weapons.some(function(e) {
                    return (typeof e === 'object' ? e.weaponId === weaponId : e === weaponId);
                });
                if (!exists) {
                    var weaponItem = (dataCache.weapons || []).find(function(w) { return w.id === weaponId; });
                    character.featureSelections.weapons.push({
                        typeId: 0,
                        weaponId: weaponId,
                        featureId: sel.featureId || 0,
                        name: weaponItem ? weaponItem.name : '',
                        source: 'upgrade',
                        sourceLabel: sel.sourceName || '',
                        link: sel.featureId || null
                    });
                }
            });
        }
        ruleIdx++;
    });

    upgradeState.classExtraGroups.forEach(function(group, gi) {
        var key = 'upgrade_extra_' + gi;
        var selected = upgradeState.selectedOptions[key] || [];
        
        selected.forEach(function(extraId) {
            var extraItem = group.candidates.find(function(c) { return c.id === extraId; });
            if (!extraItem) return;
            
            var exists = character.featureSelections.classExtra.some(function(e) {
                return (typeof e === 'object' ? e.id === extraId : e === extraId);
            });
            if (!exists) {
                character.featureSelections.classExtra.push({
                    id: extraId,
                    name: extraItem.name || '',
                    chain: extraItem.chain || null,
                    source: 'upgrade',
                    sourceLabel: group.groupName || '',
                    link: group.featureId || null
                });
            }
        });
    });
}

export {
    renderUpgradeSelections,
    applyUpgradeSelections
};