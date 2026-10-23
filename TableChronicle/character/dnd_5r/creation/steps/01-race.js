// ===== 步骤1: 选择种族 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { replacePlaceholdersInText } from '../../core/data/loader.js';
import { collectChainedRaceFeatures } from '../../handlers/data-query.js';

export function renderRaceStep(container) {
    const races = (dataCache.races || []).filter(r => r.subrace === 0);
    console.log('[调试] renderRaceStep, dataCache.races 总数:', (dataCache.races || []).length, '基础种族数:', races.length);
    races.forEach(r => console.log('[调试]   种族:', r.id, r.name, 'dlc:', r.dlc));

    // 检查阿斯莫（id=1）是否存在
    const aasimar = (dataCache.races || []).find(r => r.id === 1);
    console.log('[调试]   阿斯莫(dataCache):', aasimar ? '找到' : '未找到', aasimar ? 'subrace=' + aasimar.subrace : '');
    console.log('[调试]   阿斯莫(过滤后):', races.find(r => r.id === 1) ? '在列表中' : '不在列表中');

    container.innerHTML = `
        <div class="race-step">
            <div class="race-grid" id="raceGrid">
                ${races.map(r => `
                    <div class="race-card ${character.race?.id === r.id ? 'selected' : ''}"
                         onclick="selectRace(${r.id})" data-race-id="${r.id}">
                        <div class="race-name">${r.name}</div>
                        <div class="race-subtitle">速度 ${r.speed} 尺</div>
                    </div>
                `).join('')}
            </div>
            <div class="race-detail" id="raceDetail">
                ${character.race
                    ? buildRaceDetail(character.race)
                    : '<div class="empty-detail">点击左侧种族查看详情</div>'}
            </div>
        </div>
    `;
}

function selectRace(raceId) {
    const race = (dataCache.races || []).find(r => r.id === raceId);
    if (!race) return;

    console.log('[调试] selectRace 被调用，选中:', race.name, 'chain:', race.chain);

    // 清除之前种族的待选数据，并清空后续步骤的所有数据
    window.clearDataAfterStep(1);

    character.race = race;
    character.subrace = null; // 重置亚种
    // 特性收集已移至步骤14（特性总览）统一处理，此处不再重复调用

    // 更新卡片选中状态
    document.querySelectorAll('.race-card').forEach(card => {
        card.classList.toggle('selected', parseInt(card.dataset.raceId) === raceId);
    });

    // 更新详情面板
    document.getElementById('raceDetail').innerHTML = buildRaceDetail(race);

    // 检查是否有亚种
    const hasSubraces = (dataCache.races || []).filter(r => r.subrace === race.id && r.level <= character.level).length > 0;

    // 更新进度条（标记已选）
    window.updateProgress();

    // 无亚种时自动跳到职业步骤
    if (!hasSubraces) {
        // 延迟一下让进度条先更新
        setTimeout(() => {
            if (window.currentStep === 2) {
                window.currentStep = 3;
                window.renderStep(3);
                window.updateProgress();
                window.updateButtons();
                document.getElementById('stepContent').scrollTop = 0;
            }
        }, 100);
    }
}

function buildRaceDetail(race) {
    const sizeMap = { 2: '小型', 3: '中型', 4: '中型', 5: '中型', 6: '中型', 7: '大型', 8: '大型' };
    const sizes = (race.size || '').split(',').map(s => sizeMap[parseInt(s)] || s).filter(Boolean).join(' / ');

    // 种族本身的描述（解释）
    const desc = race.desc || '';

    // 按等级分组获取特性
    const featuresByLevel = getFeaturesByLevel(race);

    // 构建特性 HTML
    let featuresHtml = '';
    const levels = Object.keys(featuresByLevel).sort((a, b) => Number(a) - Number(b));
    levels.forEach(level => {
        const feats = featuresByLevel[level];
        if (feats.length === 0) return;

        if (level === '1') {
            featuresHtml += `<div class="detail-features"><h4>特性</h4>`;
        } else {
            featuresHtml += `<div class="detail-features" style="margin-top:16px;"><h4>${level}级特性</h4>`;
        }

        feats.forEach(f => {
            featuresHtml += `
                <div class="detail-feature">
                    <div class="feat-name">${f.name}</div>
                    <div class="feat-desc">${replacePlaceholdersInText(f.desc || '暂无说明', f)}</div>
                </div>
            `;
        });
        featuresHtml += `</div>`;
    });

    if (!featuresHtml) {
        featuresHtml = '<div class="empty-detail">该种族暂无特性数据</div>';
    }

    return `
        <h3>${race.name}</h3>
        <div class="detail-subtitle">速度 ${race.speed} 尺${sizes ? ` · ${sizes}` : ''}</div>

        ${desc ? `<div class="detail-desc">${replacePlaceholdersInText(desc, race)}</div>` : ''}

        ${featuresHtml}
    `;
}

function getFeaturesByLevel(race) {
    if (!race || !dataCache.raceFeatures) return {};

    // 找到该种族所有等级条目（同名条目，如阿斯莫有1级和3级两行）
    const allEntries = (dataCache.races || []).filter(r =>
        r.name === race.name
    );

    // 按等级分组
    const featuresByLevel = {};
    allEntries.forEach(entry => {
        const level = entry.level || 1;
        const ids = String(entry.chain).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        var feats = ids.map(id => dataCache.raceFeatures.find(f => f.id === id)).filter(Boolean);
        // 递归收集同表链引用的特性
        if (typeof collectChainedRaceFeatures === 'function') {
            feats.slice().forEach(function(f) {
                collectChainedRaceFeatures(f, feats);
            });
        }
        if (feats.length > 0) {
            if (!featuresByLevel[level]) featuresByLevel[level] = [];
            featuresByLevel[level] = featuresByLevel[level].concat(feats);
        }
    });

    return featuresByLevel;
}

export function getRaceFeatures(race) {
    if (!race || !dataCache.raceFeatures) return [];
    const ids = String(race.chain).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    return ids.map(id => dataCache.raceFeatures.find(f => f.id === id)).filter(Boolean);
}

// ===== 步骤2: 选择亚种 =====
export function renderSubraceStep(container) {
    const race = character.race;
    if (!race) {
        container.innerHTML = `
            <div class="subrace-step">
                <h2>请先选择种族</h2>
                <p>返回上一步选择一个种族</p>
            </div>
        `;
        return;
    }

    const subraces = (dataCache.races || []).filter(r => r.subrace === race.id && r.level <= character.level);

    if (subraces.length === 0) {
        // 无亚种，自动跳过
        character.subrace = null;
        container.innerHTML = `
            <div class="subrace-step">
                <h2>${race.name}</h2>
                <p>该种族没有亚种选择，继续下一步</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="race-step">
            <div class="race-grid" id="subraceGrid">
                ${subraces.map(s => `
                    <div class="race-card ${character.subrace?.id === s.id ? 'selected' : ''}"
                         onclick="selectSubrace(${s.id})" data-subrace-id="${s.id}">
                        <div class="race-name">${s.name}</div>
                        <div class="race-subtitle">${getSubraceSummary(s)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="race-detail" id="subraceDetail">
                ${character.subrace
                    ? buildSubraceDetail(character.subrace)
                    : '<div class="empty-detail">点击左侧亚种查看详情</div>'}
            </div>
        </div>
    `;
}

function selectSubrace(subraceId) {
    const subrace = (dataCache.races || []).find(r => r.id === subraceId);
    if (!subrace) return;

    // 清除之前亚种的待选数据，并清空后续步骤的所有数据
    window.clearDataAfterStep(2);

    character.subrace = subrace;
    // 特性收集已移至步骤14（特性总览）统一处理，此处不再重复调用

    document.querySelectorAll('.race-card[data-subrace-id]').forEach(card => {
        card.classList.toggle('selected', parseInt(card.dataset.subraceId) === subraceId);
    });

    document.getElementById('subraceDetail').innerHTML = buildSubraceDetail(subrace);
    window.updateProgress();
}

function buildSubraceDetail(subrace) {
    var features = getRaceFeatures(subrace);
    // 递归收集同表链引用的特性（如"岩石侏儒"→"法术:魔法伎俩"）
    if (typeof collectChainedRaceFeatures === 'function') {
        features.slice().forEach(function(f) {
            collectChainedRaceFeatures(f, features);
        });
    }

    var featuresHtml = '';
    features.forEach(function(f) {
        featuresHtml += '\n            <div class="detail-feature">\n                <div class="feat-name">' + f.name + '</div>\n                <div class="feat-desc">' + (f.desc || '暂无说明') + '</div>\n            </div>\n        ';
    });

    if (!featuresHtml) {
        featuresHtml = '<div class="empty-detail">该亚种暂无特性数据</div>';
    }

    return `
        <h3>${subrace.name}</h3>
        <div class="detail-subtitle">${character.race?.name || ''} 亚种</div>
        <div class="detail-features">
            <h4>特性</h4>
            ${featuresHtml}
        </div>
    `;
}

function getSubraceSummary(subrace) {
    var features = getRaceFeatures(subrace);
    // 递归收集同表链引用的特性
    if (typeof collectChainedRaceFeatures === 'function') {
        features.slice().forEach(function(f) {
            collectChainedRaceFeatures(f, features);
        });
    }
    return features.length > 0
        ? features.map(function(f) { return f.name; }).join('、')
        : '暂无特性';
}

window.selectRace = selectRace;
window.selectSubrace = selectSubrace;
window.buildRaceDetail = buildRaceDetail;
window.buildSubraceDetail = buildSubraceDetail;