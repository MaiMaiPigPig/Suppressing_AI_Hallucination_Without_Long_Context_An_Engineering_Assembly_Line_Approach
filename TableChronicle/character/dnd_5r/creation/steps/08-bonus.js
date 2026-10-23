// ===== 步骤8: 背景加值 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { unbind } from '../../core/state/character-state.js';
import { ABILITY_NAMES } from '../../core/constants/character-constants.js';
import { processItemRules } from '../../handlers/index.js';
import { collectChainedRaceFeatures } from '../../handlers/data-query.js';
import { getRaceFeatures } from './01-race.js';
import { getClassFeaturesAtLevel1 } from './03-class.js';

export function renderBackgroundBonusStep(container) {
    const bg = character.background;
    if (!bg) {
        container.innerHTML = `<div class="subrace-step"><h2>请先选择背景</h2><p>返回上一步完成选择</p></div>`;
        return;
    }

    // 解析属性ID列表（bg.attr = "11,18,25"）
    const bgAttrIds = (bg.attr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const bgAttrNames = bgAttrIds.map(function(id) { return getSkillName(id); });
    const currentBonus = character.backgroundBonus || { bonus: {} };

    // 计算最终属性预览
    const baseAbilities = character.abilities || {};
    const raceBonus = getRaceAbilityBonus();
    const bonusValues = currentBonus.bonus || {};

    function getFinal(id) {
        return (baseAbilities[id] || 8) + (raceBonus[id] || 0) + (bonusValues[id] || 0);
    }

    container.innerHTML = `
        <div class="bonus-step">
            <div class="ability-header">
                <h2>背景加值</h2>
                <label class="unbind-toggle ${unbind.bonus ? 'active' : ''}" onclick="toggleUnbind('bonus')">
                    <span class="unbind-icon">🔓</span> 解绑属性
                </label>
                <span class="unbind-hint">请先与你的DM商议后再决定是否解绑</span>
            </div>

            <div class="bonus-desc">你的背景「${bg.name}」提供了以下属性：<strong>${bgAttrNames.join('、')}</strong></div>

            <div class="bonus-mode-select">
                <span class="bonus-mode-text">选两个不同的属性 +2、+1，或不同的属性各 +1</span>
            </div>

            <div class="bonus-assign">
                ${(unbind.bonus ? ABILITY_NAMES : bgAttrIds).map(function(id) {
                    const label = getSkillName(id);
                    const val = bonusValues[id] || 0;
                    const maxReached = getFinal(id) >= 20;
                    return `
                        <div class="bonus-row">
                            <span class="bonus-label">${label}</span>
                            <div class="bonus-controls">
                                <button class="bonus-btn" onclick="adjustBonus(${id}, -1)" ${val <= 0 ? 'disabled' : ''}>−</button>
                                <span class="bonus-value">+${val}</span>
                                <button class="bonus-btn" onclick="adjustBonus(${id}, 1)" ${maxReached ? 'disabled' : ''}>+</button>
                            </div>
                            <span class="bonus-preview">${baseAbilities[id] || 8} → ${getFinal(id)}</span>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="bonus-total">已分配：${Object.values(bonusValues).reduce(function(a, b) { return a + b; }, 0)} / 3</div>
        </div>
    `;
}

function setBonusMode(mode) {
    character.backgroundBonus = { bonus: {} };
    renderBackgroundBonusStep(document.getElementById('stepContent'));
}

function adjustBonus(attrId, delta) {
    const bg = character.background;
    const bgAttrIds = (bg.attr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const allowed = unbind.bonus ? ABILITY_NAMES : bgAttrIds;
    if (allowed.indexOf(attrId) < 0) return;

    let bonus = character.backgroundBonus || { bonus: {} };
    const current = bonus.bonus[attrId] || 0;
    const newVal = current + delta;
    if (newVal < 0) return;

    // 检查上限20
    const base = (character.abilities || {})[attrId] || 8;
    const raceBonus = getRaceAbilityBonus();
    if (base + (raceBonus[attrId] || 0) + newVal > 20) return;

    // 总分配点数不能超过3
    const total = Object.values(bonus.bonus).reduce(function(a, b) { return a + b; }, 0);
    if (delta > 0 && total >= 3) return;

    // 单个属性最多+2
    if (delta > 0 && current >= 2) return;

    // 最多只能有一个属性为+2（如果提升到+2，检查是否已有其他+2）
    if (delta > 0 && newVal === 2) {
        const hasAnotherPlus2 = Object.keys(bonus.bonus).some(function(k) {
            return Number(k) !== attrId && bonus.bonus[k] >= 2;
        });
        if (hasAnotherPlus2) return;
    }

    bonus.bonus[attrId] = newVal;
    character.backgroundBonus = bonus;
    renderBackgroundBonusStep(document.getElementById('stepContent'));
}

/**
 * 收集所有特性（种族+亚种+种族特性+职业特性）的车卡数据并解析
 * 返回解析后的各种加成：属性加成、AC调整、熟练列表等
 */
export function collectAllFeatureBonuses() {
    const result = {
        abilityBonus: {},      // 属性加成 {力量: +2, ...}
        acFormula: null,       // AC自定义公式 "ac=10+AbilityModifiers(4)+AbilityModifiers(9)"
        acBonus: 0,           // AC固定加值
        speedBonus: 0,        // 速度增加
        skillProf: [],        // 技能熟练列表（已选定具体技能名称）
        saveProf: [],         // 豁免熟练列表  [属性名称, ...]
        skillProfCount: 0,    // 额外技能熟练次数（技能+N）
        toolProf: [],         // 工具熟练列表 [{type: 工具类型id, name: 工具名, count: 数量}]
        weaponProf: [],       // 武器熟练列表 [{type: 武器类型id, name: 武器名}]
        armorProf: [],        // 护甲熟练列表 [{id: 护甲id, name: 护甲名}]
        languages: [],        // 语言列表 [{id: 语言id, name: 语言名}]
        spells: [],           // 法术引用 [{id: 法术id, name: 法术名, class: 职业id, lv: 环位}]
        feats: [],            // 专长引用 [{id: 专长id, name: 专长名}]
        damageResist: [],     // 伤害抗性  [火焰, ...]
        rawTexts: [],         // 直接显示文本 [直接显示内容, ...]
        expertise: [],        // 专精列表 [技能id, ...]
        expertiseCount: 0,    // 额外专精次数
    };

    // 收集所有特性列表
    const allFeatures = [];
    // 种族本身
    const race = character.race;
    if (race) allFeatures.push(race);
    // 亚种
    const subrace = character.subrace;
    if (subrace) allFeatures.push(subrace);
    // 种族特性（连锁）+ 递归收集同表链引用
    if (race) {
        var raceFeats = getRaceFeatures(race);
        raceFeats.forEach(function(f) { allFeatures.push(f); });
        raceFeats.forEach(function(f) { collectChainedRaceFeatures(f, allFeatures); });
    }
    if (subrace) {
        var subraceFeats = getRaceFeatures(subrace);
        subraceFeats.forEach(function(f) { allFeatures.push(f); });
        subraceFeats.forEach(function(f) { collectChainedRaceFeatures(f, allFeatures); });
    }
    // 职业特性（到当前等级）+ 递归收集同表链引用
    const cls = character.class;
    if (cls && dataCache.classFeatures) {
        for (let lvl = 1; lvl <= character.level; lvl++) {
            const lvlFeatures = getClassFeaturesAtLevel1(cls, lvl);
            lvlFeatures.forEach(function(f) { allFeatures.push(f); });
            lvlFeatures.forEach(function(f) { collectChainedRaceFeatures(f, allFeatures); });
        }
    }

    // ===== 额外收集：职业的基础熟练（武器、护甲、豁免） =====
    // 这些信息存在 classes.json 的 weapon/armor/saving_throw_prof 字段中，
    // 但不会通过特性规则解析，需要手动读取并添加到结果中
    if (cls) {
        // ---- 武器熟练：cls.weapon 是武器分类ID（63=简易武器，64=军用武器） ----
        // 显示分类名称而非逐个列出所有武器（如"简易武器"代替20+个武器名）
        if (cls.weapon) {
            const weaponCatIds = String(cls.weapon).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            weaponCatIds.forEach(function(catId) {
                // 从 lookup_table 获取分类显示名称
                var lookupEntry = (dataCache.lookupTable || []).find(function(lt) { return lt.source_table === 'weapons' && lt.target_id === catId; });
                var catName = lookupEntry ? lookupEntry.desc : ('武器分类(' + catId + ')');
                // 按分类名去重（同一分类只显示一次）
                if (!result.weaponProf.some(function(p) { return p.name === catName; })) {
                    result.weaponProf.push({ type: catId, id: 0, name: catName });
                }
            });
        }
        // ---- 护甲熟练：cls.armor 是护甲分类ID列表（如 "2,3,5"=轻甲、中甲、盾牌） ----
        // 显示分类名称而非逐个列出所有护甲（如"轻甲"代替皮甲、布甲等）
        if (cls.armor) {
            const armorCatIds = String(cls.armor).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            armorCatIds.forEach(function(catId) {
                // armors.json 中 armor 字段 = catId，取第一个该分类的 armor 的 type 字段作为显示名
                var catName = '';
                if (catId === 2) catName = '轻甲';
                else if (catId === 3) catName = '中甲';
                else if (catId === 4) catName = '重甲';
                else if (catId === 5) catName = '盾牌';
                else catName = '护甲分类(' + catId + ')';
                if (!result.armorProf.some(function(p) { return p.name === catName; })) {
                    result.armorProf.push({ id: catId, name: catName });
                }
            });
        }
        // ---- 豁免熟练：cls.saving_throw_prof 是 skills.json 中的ID列表 ----
        if (cls.saving_throw_prof) {
            const saveIds = String(cls.saving_throw_prof).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            saveIds.forEach(function(skillId) {
                const skill = (dataCache.skills || []).find(function(s) { return s.id === skillId; });
                if (skill && skill.attr) {
                    if (!result.saveProf.includes(skill.attr)) {
                        result.saveProf.push(skill.attr);
                    }
                }
            });
        }
    }

    // ===== 额外收集：已选的职业选项所带来的熟练项 =====
    // 用户在职业特性中选择的选项（如"保护者"给军用武器+重甲、"卫士"给军用武器+中甲），
    // 会保存到 character.codeSelections 中。
    // 对应的选项条目（如 id=471, 476）上有 weapon_prof/armor_prof 字段，
    // 这里读取这些字段并应用到熟练项结果中。
    if (character.codeSelections) {
        Object.keys(character.codeSelections).forEach(function(key) {
            var sel = character.codeSelections[key];
            if (!sel || !sel.label) return;
            // 根据 label 名匹配 classFeatures 中的选项条目
            var opt = (dataCache.classFeatures || []).find(function(f) { return f.name === sel.label; });
            if (!opt) return;

            // 武器熟练（分类级别，如 64=军用武器）
            if (opt.weapon_prof) {
                var wpIds = String(opt.weapon_prof).split(',').map(function(id) { return parseInt(id.trim()); }).filter(function(n) { return !isNaN(n); });
                wpIds.forEach(function(catId) {
                    var entry = (dataCache.lookupTable || []).find(function(lt) { return lt.source_table === 'weapons' && lt.target_id === catId; });
                    var catName = entry ? entry.desc : ('武器分类(' + catId + ')');
                    if (!result.weaponProf.some(function(p) { return p.name === catName; })) {
                        result.weaponProf.push({ type: catId, id: 0, name: catName });
                    }
                });
            }
            // 护甲熟练（分类级别，如 2=轻甲, 3=中甲, 4=重甲, 5=盾牌）
            if (opt.armor_prof) {
                var apIds = String(opt.armor_prof).split(',').map(function(id) { return parseInt(id.trim()); }).filter(function(n) { return !isNaN(n); });
                apIds.forEach(function(catId) {
                    var catName = '';
                    if (catId === 2) catName = '轻甲';
                    else if (catId === 3) catName = '中甲';
                    else if (catId === 4) catName = '重甲';
                    else if (catId === 5) catName = '盾牌';
                    else catName = '护甲分类(' + catId + ')';
                    if (!result.armorProf.some(function(p) { return p.name === catName; })) {
                        result.armorProf.push({ id: catId, name: catName });
                    }
                });
            }
        });
    }

    // 记录初始特性数量，后续classExtra新增的特性需要重新解析
    const originalAllFeaturesLength = allFeatures.length;

    // 逐个解析车卡数据（使用 handlers 统一解析）
    // handlers.processItemRules() 会自动扫描 rules/tool/effects/code_effects/bonus/code 字段
    allFeatures.forEach(f => {
        const results = processItemRules(f, character);
        results.forEach(parsed => {
            applyParsedResultToBonus(parsed, result);
        });
    });

    // ===== 额外收集：背景的熟练项 =====
    const bg = character.background;
    if (bg) {
        // 背景的工具熟练：如 tool(type=67) 或 tool=4
        const bgTool = String(bg.tool || '').trim();
        if (bgTool) {
            // 格式1: tool(type=67) 或 tools(type=67)+N — 按类型选择（如"乐器"）
            const toolTypeMatch = bgTool.match(/^tools?\s*\(\s*type\s*=\s*(\d+)\s*\)\s*(?:\+(\d+))?\s*$/i);
            if (toolTypeMatch) {
                const typeId = parseInt(toolTypeMatch[1]);
                const count = toolTypeMatch[2] ? parseInt(toolTypeMatch[2]) : 1;
                // 从临时页选择中查找用户已选的具体工具
                const selected = (character.featureSelections?.tools || []).filter(t => t.typeId === typeId);
                if (selected.length > 0) {
                    selected.forEach(sel => {
                        const tool = (dataCache.tools || []).find(t => t.id === sel.toolId);
                        if (tool) {
                            result.toolProf.push({ type: typeId, id: tool.id, name: tool.name, count: 1 });
                        }
                    });
                } else {
                    // 未选择时，显示工具类型名称
                    const typeNames = { 66: '工匠工具', 67: '乐器', 68: '赌具', 69: '其他工具' };
                    result.toolProf.push({ type: typeId, id: 0, name: typeNames[typeId] || '工具(type=' + typeId + ')', count: 1 });
                }
            }
            // 格式2: tool=4 — 直接指定具体工具ID
            else {
                const toolIdMatch = bgTool.match(/^tool\s*=\s*(\d+)$/i);
                if (toolIdMatch) {
                    const toolId = parseInt(toolIdMatch[1]);
                    const tool = (dataCache.tools || []).find(t => t.id === toolId);
                    if (tool) {
                        result.toolProf.push({ type: tool.type || 0, id: tool.id, name: tool.name, count: 1 });
                    }
                }
                // 格式3: tools(id=N)+N — 通过id直接指定工具（带数量）
                else {
                    const toolIdExplicit = bgTool.match(/^tools?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*(?:\+(\d+))?\s*$/i);
                    if (toolIdExplicit) {
                        const explicitToolId = parseInt(toolIdExplicit[1]);
                        const explicitCount = toolIdExplicit[2] ? parseInt(toolIdExplicit[2]) : 1;
                        const tool = (dataCache.tools || []).find(t => t.id === explicitToolId);
                        if (tool) {
                            result.toolProf.push({ type: tool.type || 0, id: tool.id, name: tool.name, count: explicitCount });
                        }
                    }
                }
            }
        }
    }

    // ===== 额外收集：已选专长 =====
    if (character.selectedFeat) {
        const feat = (dataCache.feats || []).find(f => f.id === character.selectedFeat);
        if (feat && !result.feats.some(f => f.id === feat.id)) {
            result.feats.push({ id: feat.id, name: feat.name });
        }
    }

    // ===== 兼容新旧格式提取 ID =====
    function extractId(val) {
        if (val != null && typeof val === 'object') return val.id;
        return val;
    }

    // ===== 额外收集：临时页选择的各种熟练项 =====
    // 工具（从featureSelections中补充）
    const selTools = character.featureSelections?.tools || [];
    selTools.forEach(sel => {
        if (!result.toolProf.some(t => t.id === sel.toolId && t.type === sel.typeId)) {
            const tool = (dataCache.tools || []).find(t => t.id === sel.toolId);
            if (tool) {
                result.toolProf.push({ type: sel.typeId, id: tool.id, name: tool.name, count: 1 });
            }
        }
    });

    // 武器（从featureSelections中补充）
    const selWeapons = character.featureSelections?.weapons || [];
    selWeapons.forEach(sel => {
        if (!result.weaponProf.some(w => w.id === sel.weaponId)) {
            const weapon = (dataCache.weapons || []).find(w => w.id === sel.weaponId);
            if (weapon) {
                result.weaponProf.push({ type: sel.typeId, id: weapon.id, name: weapon.name });
            }
        }
    });

    // 语言（从featureSelections中补充，兼容新旧格式）
    const selLanguages = character.featureSelections?.languages || [];
    selLanguages.forEach(item => {
        var langId = extractId(item);
        if (!result.languages.some(l => l.id === langId)) {
            const lang = (dataCache.languages || []).find(l => l.id === langId);
            if (lang) {
                result.languages.push({ id: lang.id, name: lang.name });
            }
        }
    });
    // 语言（从角色详情步骤中选择的3种语言补充）
    if (character.selectedLanguages && character.selectedLanguages.length > 0) {
        character.selectedLanguages.forEach(langId => {
            if (!result.languages.some(l => l.id === langId)) {
                const lang = (dataCache.languages || []).find(l => l.id === langId);
                if (lang) {
                    result.languages.push({ id: lang.id, name: lang.name });
                }
            }
        });
    }

    // 护甲（从featureSelections中补充，兼容新旧格式）
    const selArmors = character.featureSelections?.armors || [];
    selArmors.forEach(item => {
        var armorId = extractId(item);
        if (!result.armorProf.some(a => a.id === armorId)) {
            const armor = (dataCache.armors || []).find(a => a.id === armorId);
            if (armor) {
                result.armorProf.push({ id: armor.id, name: armor.name });
            }
        }
    });

    // 技能（从featureSelections中补充技能名到skillProf，兼容新旧格式）
    const selSkills = character.featureSelections?.skills || [];
    selSkills.forEach(item => {
        var skillId = extractId(item);
        const skillIdNum = parseInt(skillId) || skillId;
        const skill = (dataCache.skills || []).find(s => s.id === skillIdNum);
        if (skill && !result.skillProf.includes(skill.name)) {
            result.skillProf.push(skill.name);
        }
    });

    // 专长（从featureSelections中补充）
    const selFeats = character.featureSelections?.feats || [];
    selFeats.forEach(featSel => {
        const feat = (dataCache.feats || []).find(f => f.id === featSel.featId);
        if (feat && !result.feats.some(f => f.id === feat.id)) {
            result.feats.push({ id: feat.id, name: feat.name });
        }
    });

    // 专精（从featureSelections中补充，兼容新旧格式）
    const selExpertise = character.featureSelections?.expertise || [];
    selExpertise.forEach(item => {
        var skillId = extractId(item);
        if (!result.expertise.includes(skillId)) {
            result.expertise.push(parseInt(skillId) || skillId);
        }
    });

    // 职业额外选项（从featureSelections中补充）
    // 用户在特性选择页选择的职业额外选项（如战技、子职特性选项）
    const selClassExtra = character.featureSelections?.classExtra || [];
    selClassExtra.forEach(sel => {
        const extra = (dataCache.classExtra || []).find(e => e.id === parseInt(sel.extraId));
        if (extra) {
            // 如果有chain字段，则指向classFeatures中的具体特性数据
            // 该特性可能尚未被加入allFeatures（如子职特性需要先选子职才有）
            if (extra.chain && dataCache.classFeatures) {
                const chainedFeature = dataCache.classFeatures.find(f => f.id === extra.chain);
                if (chainedFeature && !allFeatures.some(f => f.id === chainedFeature.id)) {
                    allFeatures.push(chainedFeature);
                    // 递归处理连锁引用，确保嵌套选择也被处理
                    collectChainedRaceFeatures(chainedFeature, allFeatures);
                }
            }
            // 添加特性文本显示（选项名称和描述）
            let displayText = '';
            if (extra.category && extra.name) {
                displayText = `**${extra.category} - ${extra.name}**\n${extra.desc || ''}`;
            } else if (extra.name) {
                displayText = `**${extra.name}**\n${extra.desc || ''}`;
            } else if (extra.category) {
                displayText = `**${extra.category}**\n${extra.desc || ''}`;
            }
            if (displayText && !result.rawTexts.includes(displayText)) {
                result.rawTexts.push(displayText);
            }
        }
    });

    // 对新增的classExtra特性重新执行规则解析
    // 这样法术、工具、技能熟练等规则会被自动添加到result中
    allFeatures.slice(originalAllFeaturesLength).forEach(f => {
        const results = processItemRules(f, character);
        results.forEach(parsed => {
            applyParsedResultToBonus(parsed, result);
        });
    });

    return result;
}

/**
 * 将 handlers 解析结果应用到 bonus 对象上
 * handlers 解析后返回标准化的结果对象，本函数把这些结果填充到 collectAllFeatureBonuses 的 result 中
 *
 * @param {object} parsed - handlers.parseRule() 的返回值
 * @param {object} result - collectAllFeatureBonuses 的 result 对象
 */
function applyParsedResultToBonus(parsed, result) {
    if (!parsed || !parsed.success) return;

    switch (parsed.type) {
        // ===== 基础值 =====
        case 'basic':
            if (parsed.subtype === 'ability_bonus') {
                // ability(1)+2, ability(4)-1 等
                result.abilityBonus[parsed.abilityId] = (result.abilityBonus[parsed.abilityId] || 0) + parsed.value;
            } else if (parsed.subtype === 'ac') {
                // ac=10+AbilityModifiers(4)
                result.acFormula = parsed.formula;
            } else if (parsed.subtype === 'ac_bonus') {
                // ac+2
                result.acBonus += parsed.value;
            } else if (parsed.subtype === 'speed') {
                // speed+10
                result.speedBonus += parsed.value;
            } else if (parsed.subtype === 'display') {
                // Character(直接显示)
                result.rawTexts.push(parsed.expression);
            }
            // hp — 不处理，由角色生成时计算
            break;

        // ===== 条件筛选（需要用户选择，由 featureSelections 处理） =====
        case 'filter':
            // 不直接处理，后续 post-processing 会从 featureSelections 中读取用户已选结果

            // 种族/职业特性 spells(id=N) 直接收集：needUserSelect=false 表示无需用户选择
            if (parsed.category === 'spells' && !parsed.needUserSelect && parsed.id) {
                var spell = (dataCache.spells || []).find(function(s) { return s.id === parsed.id; });
                if (spell) {
                    if (!result.spells.some(function(s) { return s.id === spell.id; })) {
                        result.spells.push({
                            id: spell.id,
                            name: spell.name,
                            class: null,
                            lv: spell.level || 0
                        });
                    }
                }
            }
            break;

        // ===== 数值运算 =====
        case 'operation':
            if (parsed.subtype === 'skill_add') {
                // 技能+1：增加技能熟练可选次数
                result.skillProfCount += parsed.count;
            } else if (parsed.subtype === 'skill_all') {
                // skill(all)：所有技能熟练
                const allSkills = dataCache.skills || [];
                allSkills.forEach(s => {
                    if (s.type === 2) {
                        if (!result.saveProf.includes(s.attr)) result.saveProf.push(s.attr);
                    } else if (!result.skillProf.includes(s.name)) {
                        result.skillProf.push(s.name);
                    }
                });
            } else if (parsed.subtype === 'tool_add') {
                // 工具+1：由 featureSelections 处理
            } else if (parsed.subtype === 'language_add') {
                // language+1：由 featureSelections 处理
            }
            break;

        // ===== 熟练转专精 =====
        case 'proficiency':
            if (parsed.subtype === 'pure_add' || parsed.subtype === 'pure_list') {
                if (parsed.count > 0) result.expertiseCount += parsed.count;
            }
            // pure_all 由后续逻辑处理
            break;

        // ===== 角色资源 =====
        // 资源（如"狂暴使用次数"）不直接作为文本显示，
        // 后续由角色卡专门的资源管理区域处理
        case 'resource':
            // 不添加到 rawTexts，避免显示原始规则表达式
            break;

        // ===== 选择/范围/特殊标记 =====
        case 'selection':
        case 'choose':
        case 'special':
            // 由 UI 步骤处理，这里不处理
            break;

        default:
            break;
    }
}

/** 获取最终属性加成（来自种族特性和职业特性的车卡数据） */
export function getRaceAbilityBonus() {
    const allBonuses = collectAllFeatureBonuses();
    return allBonuses.abilityBonus;
}

// window 桥接：加值步骤的加减按钮由动态生成的 HTML 内联事件驱动，模块化后需显式挂到 window。
// （本文件 HTML 里的 toggleUnbind 由 skill.js 桥接，不在此处重复定义）
window.adjustBonus = adjustBonus;