// ===== 步骤3: 选择职业 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { replacePlaceholdersInText } from '../../core/data/loader.js';

export function renderClassStep(container) {
    const classes = dataCache.classes || [];

    container.innerHTML = `
        <div class="race-step">
            <div class="race-grid" id="classGrid">
                ${classes.map(c => `
                    <div class="race-card ${character.class?.id === c.id ? 'selected' : ''}"
                         onclick="selectClass(${c.id})" data-class-id="${c.id}">
                        <div class="race-name">${c.name || c.class}</div>
                        <div class="race-subtitle">${c.hit_dice} · ${window.formatAbilityDisplay(c.primary_ability)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="race-detail" id="classDetail">
                ${character.class
                    ? buildClassDetail(character.class)
                    : '<div class="empty-detail">点击左侧职业查看详情</div>'}
            </div>
        </div>
    `;
}

function selectClass(classId) {
    const cls = (dataCache.classes || []).find(c => c.id === classId);
    if (!cls) return;

    // 清除之前职业的待选数据，并清空后续步骤的所有数据
    window.clearDataAfterStep(3);

    character.class = cls;
    character.subclass = null;
    // 特性收集已移至步骤14（特性总览）统一处理，此处不再重复调用

    document.querySelectorAll('.race-card[data-class-id]').forEach(card => {
        card.classList.toggle('selected', parseInt(card.dataset.classId) === classId);
    });

    document.getElementById('classDetail').innerHTML = buildClassDetail(cls);
    window.updateProgress();
}

function buildClassDetail(cls) {
    const level1Features = getClassFeaturesAtLevel1(cls, 1);

    return `
        <h3>${cls.name || cls.class}</h3>
        <div class="detail-subtitle">${cls.hit_dice} · ${window.formatAbilityDisplay(cls.primary_ability)} · ${cls.preference}</div>

        ${buildClassStats(cls)}

        ${buildClassDescription(cls)}

        ${buildClassFeaturesList(level1Features)}
    `;
}

// ===== 职业数据卡片 =====
function buildClassStats(cls) {
    // 武器分类名
    function weaponCatName(catId) {
        var entry = (dataCache.lookupTable || []).find(function(lt) { return lt.source_table === 'weapons' && lt.target_id === catId; });
        return entry ? entry.desc : ('分类' + catId);
    }
    // 护甲分类名
    function armorCatName(catId) {
        var map = { 2: '轻甲', 3: '中甲', 4: '重甲', 5: '盾牌' };
        return map[catId] || ('分类' + catId);
    }
    // 豁免属性名（去掉"豁免"后缀）
    function saveName(skillId) {
        var sk = (dataCache.skills || []).find(function(s) { return s.id === skillId; });
        return sk ? (sk.name || '').replace('豁免', '') : '';
    }
    // 技能名
    function skillNameById(skillId) {
        var sk = (dataCache.skills || []).find(function(s) { return s.id === skillId; });
        return sk ? sk.name : '';
    }

    // 武器
    var weaponStr = '';
    if (cls.weapon) {
        var ids = String(cls.weapon).split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); });
        weaponStr = ids.map(weaponCatName).join('、');
    }
    // 护甲
    var armorStr = '';
    if (cls.armor) {
        var ids = String(cls.armor).split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); });
        armorStr = ids.map(armorCatName).join('、');
    }
    // 豁免
    var saveStr = '';
    if (cls.saving_throw_prof) {
        var ids = String(cls.saving_throw_prof).split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); });
        saveStr = ids.map(saveName).filter(function(n) { return n; }).join('、');
    }
    // 技能
    var skillStr = '';
    if (cls.skill_prof && cls.count) {
        if (String(cls.skill_prof) === 'all') {
            skillStr = '全部技能（选' + cls.count + '项）';
        } else {
            var ids = String(cls.skill_prof).split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); });
            var names = ids.map(skillNameById).filter(function(n) { return n; });
            if (names.length > 0) {
                skillStr = '从' + names.join('、') + '中选择' + cls.count + '项';
            }
        }
    }

    // 组装卡片
    var rows = [];
    rows.push('<div class="stat-row">' +
        '<div class="stat-cell"><span class="sc-label">生命骰</span><span class="sc-value">' + (cls.hit_dice || '—') + '</span></div>' +
        (saveStr ? '<div class="stat-cell"><span class="sc-label">豁免</span><span class="sc-value">' + saveStr + '</span></div>' : '') +
        '</div>');
    if (weaponStr || armorStr) {
        rows.push('<div class="stat-row">' +
            (weaponStr ? '<div class="stat-cell"><span class="sc-label">武器</span><span class="sc-value">' + weaponStr + '</span></div>' : '') +
            (armorStr ? '<div class="stat-cell"><span class="sc-label">护甲</span><span class="sc-value">' + armorStr + '</span></div>' : '') +
            '</div>');
    }
    if (skillStr) {
        rows.push('<div class="stat-row"><div class="stat-cell stat-cell-full"><span class="sc-label">技能</span><span class="sc-value">' + skillStr + '</span></div></div>');
    }

    return '<div class="detail-stats-card">' + rows.join('') + '</div>';
}

// ===== 背景介绍（折叠） =====
function buildClassDescription(cls) {
    if (!cls.desc) return '';
    var descText = replacePlaceholdersInText(cls.desc, cls);
    var preview = descText.length > 60 ? descText.substring(0, 60) + '…' : descText;
    var hasMore = descText.length > 60;

    var uid = 'cd' + (cls.id || 0);
    return '<div class="detail-desc-block">' +
        '<div class="detail-desc-preview" id="' + uid + 'p">' + preview + '</div>' +
        (hasMore ? '<div class="detail-desc-full" id="' + uid + 'f" style="display:none">' + descText + '</div>' : '') +
        (hasMore ? '<span class="detail-desc-toggle" onclick="toggleClassDesc(\'' + uid + '\')" id="' + uid + 'b">展开完整描述</span>' : '') +
        '</div>';
}

// ===== 特性列表（带选择项预览） =====
function buildClassFeaturesList(features) {
    if (!features || features.length === 0) {
        return '<div class="empty-detail">该职业暂无1级特性数据</div>';
    }

    var html = '<div class="detail-features"><h4>1级特性</h4>';
    features.forEach(function(f) {
        html += '<div class="detail-feature">' +
            '<div class="feat-name">' + f.name + '</div>' +
            '<div class="feat-desc">' + replacePlaceholdersInText(f.desc || '暂无说明', f) + '</div>';

        // 如果是 choose 类特性，内联预览选项
        var optsHtml = buildChoosePreview(f.code);
        if (optsHtml) html += optsHtml;

        html += '</div>';
    });
    html += '</div>';
    return html;
}

// ===== 解析 choose 选项并生成预览 =====
function buildChoosePreview(codeField) {
    if (!codeField) return '';
    var match = codeField.match(/choose\s*[（(]\s*([\d,\s]+)\s*[）)]/i);
    if (!match) return '';
    var ids = match[1].split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); });
    if (ids.length < 2) return '';

    var html = '<div class="feat-options">';
    ids.forEach(function(id) {
        var entry = (dataCache.classFeatures || []).find(function(f) { return f.id === id; });
        if (entry) {
            var shortDesc = (entry.desc || '');
            if (shortDesc.length > 50) shortDesc = shortDesc.substring(0, 50) + '…';
            html += '<div class="feat-option">' +
                '<span class="fo-name">' + entry.name + '</span>' +
                (shortDesc ? '<span class="fo-desc">' + shortDesc + '</span>' : '') +
                '</div>';
        }
    });
    html += '</div>';
    return html;
}

// ===== 折叠描述切换 =====
function toggleClassDesc(uid) {
    var preview = document.getElementById(uid + 'p');
    var full = document.getElementById(uid + 'f');
    var btn = document.getElementById(uid + 'b');
    if (!full || !btn) return;
    if (full.style.display === 'none') {
        preview.style.display = 'none';
        full.style.display = 'block';
        btn.textContent = '收起';
    } else {
        preview.style.display = 'block';
        full.style.display = 'none';
        btn.textContent = '展开完整描述';
    }
}

export function getClassFeaturesAtLevel1(cls, level) {
    if (!cls || !dataCache.classFeatures) return [];
    // 翻译：返回符合条件的特性（基础特性 subclass=0 + 已选子职的特性）
    return dataCache.classFeatures.filter(f => 
        f.class === cls.id && f.level === level && 
        (f.subclass === 0 || (character.subclass && f.subclass === character.subclass.id))
    );
}

window.selectClass = selectClass;
window.toggleClassDesc = toggleClassDesc;