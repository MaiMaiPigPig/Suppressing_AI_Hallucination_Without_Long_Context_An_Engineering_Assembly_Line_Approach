import { upgradeState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { renderUpgradeSelections } from './selection-apply.js';
import { renderUpgradeSpellSection } from './spell-update.js';

// 渲染子职选择界面（车卡风格：左侧网格卡片，右侧详情面板）
function renderSubclassSelection($content) {
    const cls = character.class;
    if (!cls) return;

    var availableSubclasses = (dataCache.subclasses || []).filter(function(sc) {
        return sc.class_id === cls.id;
    });

    if (availableSubclasses.length === 0) {
        $content.append('<div class="section" style="max-width:640px;"><div class="section-title">⚠️ 无可选子职</div><div class="change-row"><span class="value" style="color:var(--text-muted);">该职业暂无子职数据</span></div></div>');
        return;
    }

    // 左侧：子职网格卡片
    var leftHtml = '<div class="upgrade-subclass-left">';
    availableSubclasses.forEach(function(sc) {
        var shortDesc = sc.desc || '';
        if (shortDesc.length > 50) shortDesc = shortDesc.substring(0, 50) + '…';
        leftHtml += '<label class="upgrade-subclass-item" data-sc-id="' + sc.id + '">';
        leftHtml += '<input type="radio" name="subclass_choice" value="' + sc.id + '">';
        leftHtml += '<div class="subclass-card-name">' + sc.name + '</div>';
        leftHtml += '<div class="subclass-card-desc">' + shortDesc + '</div>';
        leftHtml += '</label>';
    });
    leftHtml += '</div>';

    // 右侧：详情面板
    var rightHtml = '<div class="upgrade-subclass-right" id="subclass-detail-panel">' +
        '<div class="subclass-detail-placeholder">点击左侧子职查看详情</div>' +
    '</div>';

    var wrapperHtml = '<div class="upgrade-subclass-layout">' + leftHtml + rightHtml + '</div>';

    $content.append(wrapperHtml);

    upgradeState._pendingSubclasses = availableSubclasses;
    upgradeState._subclassSelectedId = null;

    // 左侧点击事件：高亮卡片 + 右侧显示详情
    $('.upgrade-subclass-item').on('click', function(e) {
        var $item = $(this);
        var id = parseInt($item.data('sc-id'));
        var sc = availableSubclasses.find(function(s) { return s.id === id; });
        if (!sc) return;

        console.log('[升级] 选择了子职:', sc.name, '(id=%d)', sc.id);
        upgradeState._subclassSelectedId = id;

        $('.upgrade-subclass-item').removeClass('selected');
        $item.addClass('selected');
        $item.find('input').prop('checked', true);

        // 右侧详情 + 子职特性列表
        var subclassFeatures = (dataCache.classFeatures || []).filter(function(f) {
            return f.class === cls.id && f.subclass === sc.id;
        });

        var detailHtml =
            '<h3 class="detail-title">' + sc.name + '</h3>' +
            '<div class="detail-desc-block">' +
            '<p>' + (sc.desc || '暂无描述') + '</p>' +
            '</div>';

        // 按等级分组显示子职特性
        if (subclassFeatures.length > 0) {
            var levels = {};
            subclassFeatures.forEach(function(f) {
                if (!levels[f.level]) levels[f.level] = [];
                levels[f.level].push(f);
            });

            var levelKeys = Object.keys(levels).sort(function(a, b) { return a - b; });
            levelKeys.forEach(function(lv) {
                detailHtml += '<div class="detail-features" style="margin-top:16px;">' +
                    '<h4>' + lv + '级特性</h4>';
                levels[lv].forEach(function(f) {
                    detailHtml +=
                        '<div class="detail-feature">' +
                        '<div class="feat-name">' + (f.name || '') + '</div>' +
                        '<div class="feat-desc">' + (f.desc || '') + '</div>' +
                        '</div>';
                });
                detailHtml += '</div>';
            });
        }

        $('#subclass-detail-panel').html(detailHtml);
    });
}

function renderSelectionsStep($content) {
    const hasSelections = (upgradeState.pendingSelections && upgradeState.pendingSelections.length > 0) ||
        (upgradeState.classExtraGroups && upgradeState.classExtraGroups.length > 0);
    const hasSpellcasting = character.class && character.class.spellcaster && character.class.spellcaster > 0;
    const showNoSelection = !hasSelections && !hasSpellcasting;

    $content.html(`
        <div class="upgrade-result" style="justify-content:flex-start;padding-top:10px;">
            <div class="upgrade-header">
                <h2>选择确认</h2>
                <p class="subtitle">完成升级所需的选择</p>
            </div>
        ${hasSelections
            ? '<div id="upgradeSelectionsTarget"></div>'
            : ''}
        ${showNoSelection
            ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">✅</span> 无需选择</div>
                <div class="change-row">
                    <span class="value" style="color:var(--text-muted);">该等级没有需要选择的内容</span>
                </div>
            </div>
            `
            : ''}
            <div id="upgradeSpellSectionTarget" style="width:100%;"></div>
        </div>
    `);

    if (hasSelections) {
        renderUpgradeSelections($('#upgradeSelectionsTarget'), upgradeState.pendingSelections, upgradeState.classExtraGroups);
    }

    if (hasSpellcasting) {
        renderUpgradeSpellSection($('#upgradeSpellSectionTarget'));
    }
}

/**
 * 翻译：通过 chain 字段找到对应的 class_extra 条目（使用索引加速，与车卡流程共用同一数据结构）
 * @param {number} featureId - 翻译：特性ID
 * @returns {array} - 翻译：匹配的 class_extra 条目列表
 */
function findExtraByChain(featureId) {
    if (!dataCache.classExtra) return null;
    // 翻译：优先用索引查，索引不存在时回退到线性扫描
    if (dataCache.extraByFeatureId && dataCache.extraByFeatureId[featureId]) {
        return dataCache.extraByFeatureId[featureId];
    }
    return dataCache.classExtra.filter(function(e) {
        var chainVal = e.chain;
        if (typeof chainVal === 'number') return chainVal === featureId;
        var chainIds = String(chainVal).split(',').map(function(s) { return parseInt(s.trim(), 10); });
        return chainIds.indexOf(featureId) !== -1;
    });
}

export {
    renderSubclassSelection,
    renderSelectionsStep,
    findExtraByChain
};