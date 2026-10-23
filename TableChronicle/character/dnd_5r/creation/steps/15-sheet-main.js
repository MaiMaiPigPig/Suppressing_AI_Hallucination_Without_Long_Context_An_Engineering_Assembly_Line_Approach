/**
 * creation/steps/sheet-main.js
 * 角色卡主渲染流程：把角色全部数据拼成整页 HTML。
 *
 * 由设计-v0.4-004-001 从 sheet.js 拆分而来，对外接口由入口文件原样 re-export。
 */

import { ABILITY_NAMES } from '../../core/constants/character-constants.js';
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { collectChainedRaceFeatures } from '../../handlers/data-query.js';
import { escapeHtml } from '../../utils/html.js';
import { calculateModifier } from './07-ability.js';
import { collectAllFeatureBonuses, getRaceAbilityBonus } from './08-bonus.js';
import { getClassFeaturesAtLevel1 } from './03-class.js';
import { getRaceFeatures } from './01-race.js';
import { getFeatureProficiencyValues, renderSpellItem } from './15-sheet-renderer.js';
import { translateDamageType, translateProperties } from '../../core/data/dictionary.js';
import { parseSpellCounts } from './11-spells.js';
export function renderCharacterSheet(container) {
    // ===== 计算工具 =====
    const baseAbilities = character.abilities || {};
    const raceBonus = getRaceAbilityBonus();
    const bgBonus = (character.backgroundBonus && character.backgroundBonus.bonus) || {};

    // 兼容转换：中文名 → skill ID
    function toAbilityId(attr) {
        if (typeof attr === 'number') return attr;
        var s = (dataCache.skills || []).find(function(sk) { return sk.name === attr; });
        return s ? s.id : attr;
    }

    function getFinalAbility(attr) {
        var id = toAbilityId(attr);
        return (baseAbilities[id] || 8) + (raceBonus[id] || 0) + (bgBonus[id] || 0);
    }

    const profBonus = Math.ceil(character.level / 4) + 1;
    const cls = character.class;
    const race = character.subrace || character.race;

    // 翻译：生成种族显示名，有亚种时显示"种族名（亚种名）"
    function getRaceDisplayName() {
        if (!character.race) return '';
        if (character.subrace) return character.race.name + '（' + character.subrace.name + '）';
        return character.race.name;
    }

    // 收集所有特性的车卡数据加成
    const allFeatureBonuses = collectAllFeatureBonuses();

    // ID → 英文 attr 映射（skills.json 中的 type=1 属性条目用英文 attr 关联 save/skill）
    var abilityIdToAttr = { 1: 'strength', 4: 'dexterity', 9: 'constitution', 11: 'intelligence', 18: 'wisdom', 25: 'charisma' };

    // 豁免熟练映射：save skill ID → 属性ID
    var saveIdToAbility = { 2: 1, 5: 4, 10: 9, 13: 11, 22: 18, 31: 25 };
    const classSaveIds = cls ? String(cls['saving_throw_prof'] || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];

    function isSaveProficient(attr) {
        var id = toAbilityId(attr);
        var engAttr = abilityIdToAttr[id];
        const fromFeature = allFeatureBonuses.saveProf.includes(engAttr);
        const saveId = Object.keys(saveIdToAbility).find(function(k) { return saveIdToAbility[k] === id; });
        const fromClass = saveId && classSaveIds.includes(parseInt(saveId));
        return fromClass || fromFeature;
    }

    // 全局技能列表
    const allSkills = (dataCache.skills || []).filter(s => s.type === 3);
    const allSaves = (dataCache.skills || []).filter(s => s.type === 2);
    const proficientSkillNames = (character.allSkills || []);

    function isSkillProficient(skillName) {
        // 已选择熟练 或 特性给的熟练
        return proficientSkillNames.includes(skillName) || allFeatureBonuses.skillProf.includes(skillName);
    }

    function isSkillExpertise(skillName) {
        // 查技能ID → 判断是否有专精
        const skill = allSkills.find(s => s.name === skillName);
        if (!skill) return false;
        return (allFeatureBonuses.expertise || []).some(id => String(id) === String(skill.id));
    }

    function fmtNum(val) {
        return val >= 0 ? `+${val}` : `${val}`;
    }

    // 种族特性（含递归链引用）
    let raceFeatures = [];
    if (race) {
        raceFeatures = getRaceFeatures(race);
        // 递归收集同表链引用的特性（如"岩石侏儒"→"法术:魔法伎俩"）
        raceFeatures.slice().forEach(function(f) {
            if (typeof collectChainedRaceFeatures === 'function') {
                collectChainedRaceFeatures(f, raceFeatures);
            }
        });
    }

    // 职业特性（到当前等级）+ 递归收集同表链引用
    let classFeatures = [];
    if (cls && dataCache.classFeatures) {
        for (let lvl = 1; lvl <= character.level; lvl++) {
            var lvlFeats = getClassFeaturesAtLevel1(cls, lvl);
            lvlFeats.forEach(function(f) { classFeatures.push(f); });
            // 递归收集同表链引用
            lvlFeats.forEach(function(f) {
                if (typeof collectChainedRaceFeatures === 'function') {
                    collectChainedRaceFeatures(f, classFeatures);
                }
            });
        }
    }

    // 专长
    const feat = character.selectedFeat
        ? (dataCache.feats || []).find(f => f.id === character.selectedFeat)
        : null;

    // 装备清单
    function getPackageItems(pkg) {
        if (!pkg || !pkg.desc) return [];
        return pkg.desc.split('\n').filter(Boolean).map(line => {
            const match = line.match(/(\d+)\s*x?\s*([^\d].*)/);
            return match ? { qty: parseInt(match[1]), name: match[2].trim() } : { qty: 1, name: line.trim() };
        });
    }

    const classPkgItems = getPackageItems(character.classPackage);
    const bgPkgItems = getPackageItems(character.bgPackage);
    const allEquipment = [...classPkgItems, ...bgPkgItems, ...(character.shoppingItems || []).map(i => ({ qty: i.qty || 1, name: i.name }))];

    const equipMap = {};
    allEquipment.forEach(item => { const key = item.name; equipMap[key] ? equipMap[key].qty += item.qty : equipMap[key] = { ...item }; });
    const equipment = Object.values(equipMap);

    const currency = character.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    const currencyMap = { pp: 'PP', gp: 'GP', ep: 'EP', sp: 'SP', cp: 'CP' };
    const currencyOrder = ['pp', 'gp', 'ep', 'sp', 'cp'];

    function formatDesc(text) {
        if (!text) return '';
        // 如果描述中包含 HTML 标签（如 <table>），保留原始 HTML 结构，不做 <br> 转换
        if (/<[a-z][\s\S]*?>/i.test(text)) {
            return text;
        }
        return text.split('\n').filter(Boolean).join('<br>');
    }

    // 从 rules 中解析 spells(id=N) 获取法术真数据
    function resolveSpellFromRules(feature) {
        if (!feature || !feature.rules) return null;
        var m = String(feature.rules).match(/^spells?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*$/i);
        if (!m) return null;
        return (dataCache.spells || []).find(function(s) { return s.id === parseInt(m[1], 10); }) || null;
    }

    // 法术信息
    const spellInfo = cls ? parseSpellCounts(cls.id) : null;
    // 从映射表获取法术方式标签
    function getMethodLabel(method, spellInfo) {
        const entry = (dataCache.spellcastingMethods || []).find(m => m.name === method);
        if (method === 'spellbook' && spellInfo && spellInfo.spellbook_start) {
            return `法术书（${spellInfo.spellbook_start}个）`;
        }
        return entry ? entry.label : (method || '');
    }
    let selectedSpells = [];
    var allSpellIds = (character.selectedSpells || []).slice();
    (allFeatureBonuses.spells || []).forEach(function(s) {
        if (allSpellIds.indexOf(s.id) === -1) allSpellIds.push(s.id);
    });
    if (allSpellIds.length > 0) {
        selectedSpells = (dataCache.spells || []).filter(function(s) { return allSpellIds.indexOf(s.id) !== -1; });
    }
    const cantrips = selectedSpells.filter(s => s.level === 0);
    // 按环位分组的法术
    const spellsByLevel = {};
    for (let i = 1; i <= 9; i++) {
        spellsByLevel[i] = selectedSpells.filter(s => s.level === i);
    }

    const spellAbility = spellInfo && spellInfo.ability ? spellInfo.ability : null;
    const spellAbilityMod = spellAbility ? calculateModifier(getFinalAbility(spellAbility)) : 0;
    const spellAttackBonus = spellAbilityMod + profBonus;
    const spellDC = 8 + spellAbilityMod + profBonus;

    // HP：优先使用存档中的 hp_max（导入角色/升级后的角色），否则按公式计算
    let maxHP = character.hp_max || 0;
    let hpBreakdown = ''; // HP 计算明细
    if (cls) {
        const hitDieStr = cls.hit_dice || 'D8';
        const hitDieMax = parseInt(hitDieStr.replace('D', ''));
        const conMod = calculateModifier(getFinalAbility('体质'));

        if (!maxHP) {
            // 新创建角色：1级 HP = 最大生命骰 + 体质调整值
            maxHP = hitDieMax + conMod;
            hpBreakdown = `${hitDieMax} (${hitDieStr}) + ${conMod >= 0 ? '+' : ''}${conMod} (体质)`;
        } else {
            // 已有 hp_max：只生成明细说明
            hpBreakdown = `${hitDieMax} (${hitDieStr}) × ${character.level || 1} 级 + ${conMod >= 0 ? '+' : ''}${conMod} (体质) × ${character.level || 1}`;
        }
        // 专长等提供的每级额外生命值（如"健壮"专长的 hp_per_lv+2）
        if (character.hpPerLevelBonus) {
            const hpBonus = character.hpPerLevelBonus * (character.level || 1);
            maxHP += hpBonus;
            hpBreakdown += ` + ${character.hpPerLevelBonus}×${character.level || 1} (专长)`;
        }
    }

    // 被动感知
    const wisMod = calculateModifier(getFinalAbility('感知'));
    const perceptionSkill = allSkills.find(s => s.name === '察觉');
    const perceptionProficient = perceptionSkill ? isSkillProficient('察觉') : false;
    const passivePerception = 10 + wisMod + (perceptionProficient ? profBonus : 0);

    const dexMod = calculateModifier(getFinalAbility('敏捷'));

    // 计算AC：支持自定义公式或默认计算
    let baseAC;
    if (allFeatureBonuses.acFormula) {
        // 解析AC公式，支持：
        // 10 + 能力调整值(4) → AbilityModifiers(4) → 取ID=4属性的调整值
        let formula = allFeatureBonuses.acFormula;
        // 支持中英文括号：AbilityModifiers(4) 或 AbilityModifiers（4）
        formula = formula.replace(/AbilityModifiers\s*[（(]\s*(\d+)\s*[）)]/gi, (match, idStr) => {
            const id = parseInt(idStr);
            const skill = (dataCache.skills || []).find(s => s.id === id);
            if (skill && skill.type === 1) { // 类型1 = 属性
                const val = getFinalAbility(skill.name);
                return String(calculateModifier(val));
            }
            return '0';
        });
        // 直接计算结果
        try {
            baseAC = eval(formula);
        } catch (e) {
            console.warn('AC公式解析失败:', formula, e);
            baseAC = 10 + dexMod;
        }
    } else {
        // 默认：10 + 敏捷调整
        baseAC = 10 + dexMod;
    }
    // 加上固定AC加值
    baseAC += allFeatureBonuses.acBonus;

    const initiative = dexMod;

    // 匹配武器
    const weaponData = (dataCache.weapons || []);
    const characterWeapons = equipment.filter(eq => {
        return weaponData.find(w => eq.name.includes(w.name.replace(/[A-Za-z]/g, '').trim()) || w.name.includes(eq.name));
    }).map(eq => {
        const w = weaponData.find(w => eq.name.includes(w.name.replace(/[A-Za-z]/g, '').trim()) || w.name.includes(eq.name));
        const isMelee = w && (String(w['weapon_range']) === '61');
        const isFinesse = w && String(w.properties || '').includes('4');
        let atkAbility = isMelee ? getFinalAbility('力量') : getFinalAbility('敏捷');
        if (isFinesse) atkAbility = Math.max(getFinalAbility('力量'), getFinalAbility('敏捷'));
        const atkBonus = calculateModifier(atkAbility) + profBonus;
        return {
            name: w ? w.name : eq.name,
            atkBonus: fmtNum(atkBonus),
            damageDice: w ? (w.damage_dice || '—') : '—',
            damageType: w ? translateDamageType(w.damage_type || '') : '—',
            effect: w ? translateProperties(w.properties || '') : '',
        };
    });

    // 属性分组技能
    const abilitySkillMap = {};
    ABILITY_NAMES.forEach(function(id) {
        const attr = abilityIdToAttr[id];
        abilitySkillMap[id] = {
            save: allSaves.find(function(s) { return s.attr === attr; }),
            skills: allSkills.filter(function(s) { return s.attr === attr; })
        };
    });

    // 属性名显示
    function abilityDisplayLabel(id) {
        var s = (dataCache.skills || []).find(function(sk) { return sk.id === id; });
        return s ? s.name : String(id);
    }

    // ===== 构建HTML（新布局：战斗→属性→武器→法术→物品→特性） =====
    container.innerHTML = `
        <div class="sheet-container">
            <!-- ===== 头部 ===== -->
            <div class="sheet-header">
                <div class="sheet-title-row">
                    <h1 class="sheet-name">${escapeHtml(character.name) || '未命名角色'}</h1>
                    <span class="sheet-level">Lv.${character.level || 1}</span>
                </div>
                <div class="sheet-subtitle">
                    ${getRaceDisplayName() ? escapeHtml(getRaceDisplayName()) : '未选择种族'} ·
                    ${character.background ? escapeHtml(character.background.name) : '未选择背景'} ·
                    ${cls ? escapeHtml(cls.name || cls.class) + (character.subclass ? '（' + escapeHtml(character.subclass.name) + '）' : '') : '未选择职业'}
                    ${character.alignment ? ` · ${escapeHtml(character.alignment)}` : ''}
                </div>
                ${character.player ? `<div class="sheet-player">玩家：${escapeHtml(character.player)}</div>` : ''}
            </div>

            <div class="sheet-body">

                <!-- ===== 战斗面板（全宽，一行） ===== -->
                <div class="fl-section">
                    <div class="fl-section-title">战斗</div>
                    <div class="combat-bar">
                        <div class="cb-item cb-item-hp">
                            <span class="cb-label">HP</span>
                            <span class="cb-value">${maxHP}</span>
                            ${hpBreakdown ? `<span class="cb-hp-detail" title="${hpBreakdown}">${hpBreakdown}</span>` : ''}
                        </div>
                        <div class="cb-item">
                            <span class="cb-label">AC</span>
                            <span class="cb-value">${baseAC}</span>
                            ${allFeatureBonuses.acFormula ? '<span class="cb-ac-hint">特殊</span>' : ''}
                        </div>
                        <div class="cb-item">
                            <span class="cb-label">先攻</span>
                            <span class="cb-value">${fmtNum(initiative)}</span>
                        </div>
                        ${allFeatureBonuses.damageResist.length > 0 ? `
                        <div class="cb-item cb-item-wide">
                            <span class="cb-label">伤害抗性</span>
                            <span class="cb-value cb-value-sm">${allFeatureBonuses.damageResist.join('、')}</span>
                        </div>
                        ` : ''}
                        <div class="cb-item">
                            <span class="cb-label">熟练</span>
                            <span class="cb-value">${fmtNum(profBonus)}</span>
                        </div>
                        <div class="cb-item">
                            <span class="cb-label">速度</span>
                            <span class="cb-value">${30 + allFeatureBonuses.speedBonus}</span>
                        </div>
                        <div class="cb-item">
                            <span class="cb-label">被动感知</span>
                            <span class="cb-value">${passivePerception}</span>
                        </div>
                    </div>
                </div>

                <!-- ===== 属性 × 技能（全宽6列） ===== -->
                <div class="fl-section">
                    <div class="fl-section-title">属性 · 技能</div>
                    <div class="ability-grid">
                        ${ABILITY_NAMES.map(function(attr) {
                            const final = getFinalAbility(attr);
                            const mod = calculateModifier(final);
                            const save = abilitySkillMap[attr].save;
                            const skills = abilitySkillMap[attr].skills;
                            const saveProf = isSaveProficient(attr);
                            const saveVal = mod + (saveProf ? profBonus : 0);
                            const base = baseAbilities[attr] || 8;
                            const rb = raceBonus[attr] || 0;
                            const bb = bgBonus[attr] || 0;
                            const label = abilityDisplayLabel(attr);
                            return `
                                <div class="ag-col">
                                    <div class="ag-col-hd">
                                        <div class="ag-name">${label}</div>
                                        <div class="ag-val">${final}</div>
                                        <div class="ag-mod">${fmtNum(mod)}</div>
                                    </div>
                                    <div class="ag-col-bd">
                                        ${save ? `
                                            <div class="ag-row ${saveProf ? 'on' : ''}">
                                                <span class="ag-dot">${saveProf ? '●' : '○'}</span>
                                                <span class="ag-rl">豁免</span>
                                                <span class="ag-rv">${fmtNum(saveVal)}</span>
                                            </div>
                                        ` : ''}
                                        ${skills.map(skill => {
                                            const prof = isSkillProficient(skill.name);
                                            const exp = isSkillExpertise(skill.name);
                                            const val = mod + (exp ? 2 * profBonus : prof ? profBonus : 0);
                                            const dot = exp ? '★' : (prof ? '●' : '○');
                                            return `
                                                <div class="ag-row ${prof || exp ? 'on' : ''} ${exp ? 'exp' : ''}">
                                                    <span class="ag-dot">${dot}</span>
                                                    <span class="ag-rl">${skill.name}</span>
                                                    <span class="ag-rv">${fmtNum(val)}</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- ===== 武器 ===== -->
                ${characterWeapons.length > 0 ? `
                <div class="fl-section">
                    <div class="fl-section-title">武器</div>
                    <table class="wp-table">
                        <thead>
                            <tr>
                                <th>武器名</th>
                                <th>攻击加值</th>
                                <th>伤害骰</th>
                                <th>伤害类型</th>
                                <th>效果</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${characterWeapons.map(w => `
                                <tr>
                                    <td class="wp-n">${escapeHtml(w.name)}</td>
                                    <td class="wp-a">${w.atkBonus}</td>
                                    <td class="wp-d">${w.damageDice}</td>
                                    <td class="wp-t">${w.damageType}</td>
                                    <td class="wp-e">${w.effect ? escapeHtml(w.effect) : '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : ''}

                <!-- ===== 法术 + 施法能力 ===== -->
                ${selectedSpells.length > 0 && spellInfo && spellInfo.ability ? `
                <div class="fl-section">
                    <div class="fl-section-title">法术</div>
                    <div class="spell-cast-bar">
                        <div class="scb-item">
                            <span class="scb-label">施法属性</span>
                            <span class="scb-value">${spellInfo.ability}</span>
                        </div>
                        ${spellInfo.preparation_method ? `
                        <div class="scb-item">
                            <span class="scb-label">法术方式</span>
                            <span class="scb-value">${getMethodLabel(spellInfo.preparation_method, spellInfo)}</span>
                        </div>
                        ` : ''}
                        <div class="scb-item">
                            <span class="scb-label">法术攻击</span>
                            <span class="scb-value">${fmtNum(spellAttackBonus)}</span>
                        </div>
                        <div class="scb-item">
                            <span class="scb-label">法术DC</span>
                            <span class="scb-value">${spellDC}</span>
                        </div>
                        ${spellInfo.cantrips > 0 ? `
                        <div class="scb-item">
                            <span class="scb-label">戏法</span>
                            <span class="scb-value">${spellInfo.cantrips}</span>
                        </div>
                        ` : ''}
                        ${spellInfo.prepared > 0 ? `
                        <div class="scb-item">
                            <span class="scb-label">准备法术</span>
                            <span class="scb-value">${spellInfo.prepared}</span>
                        </div>
                        ` : ''}
                        ${Object.keys(spellInfo.slots).map(i => {
                            const maxSlots = spellInfo.slots[i];
                            if (maxSlots === 0) return '';
                            return `
                            <div class="scb-item">
                                <span class="scb-label">${i}环法术位</span>
                                <span class="scb-value">${maxSlots}</span>
                            </div>
                            `;
                        }).join('')}
                        ${spellInfo.preparation_rule ? `<div class="scb-note">${escapeHtml(spellInfo.preparation_rule)}</div>` : ''}
                        ${spellInfo.note ? `<div class="scb-note">${escapeHtml(spellInfo.note)}</div>` : ''}
                    </div>
                    <div class="spell-list">
                        ${cantrips.length > 0 ? `
                        <div class="sl-cat">
                            <div class="sl-cat-hd">戏法 <span class="sl-cat-c">${cantrips.length}</span></div>
                            ${cantrips.map(s => renderSpellItem(s, false)).join('')}
                        </div>
                        ` : ''}
                        ${[1,2,3,4,5,6,7,8,9].map(i => {
                            const spells = spellsByLevel[i];
                            if (!spells || spells.length === 0) return '';
                            return `
                            <div class="sl-cat">
                                <div class="sl-cat-hd">${i}环 <span class="sl-cat-c">${spells.length}</span></div>
                                ${spells.map(s => renderSpellItem(s, true)).join('')}
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ` : selectedSpells.length > 0 ? `
                <div class="fl-section">
                    <div class="fl-section-title">法术</div>
                    <div class="spell-list">
                        ${cantrips.length > 0 ? `
                        <div class="sl-cat">
                            <div class="sl-cat-hd">戏法 <span class="sl-cat-c">${cantrips.length}</span></div>
                            ${cantrips.map(s => renderSpellItem(s, false)).join('')}
                        </div>
                        ` : ''}
                        ${[1,2,3,4,5,6,7,8,9].map(i => {
                            const spells = spellsByLevel[i];
                            if (!spells || spells.length === 0) return '';
                            return `
                            <div class="sl-cat">
                                <div class="sl-cat-hd">${i}环 <span class="sl-cat-c">${spells.length}</span></div>
                                ${spells.map(s => renderSpellItem(s, true)).join('')}
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- ===== 物品 · 货币 ===== -->
                <div class="fl-section">
                    <div class="fl-section-title">物品 · 货币</div>
                    <div class="inv-row">
                        <div class="inv-equip">
                            ${equipment.length > 0 ? equipment.map(item => `
                                <span class="inv-tag">
                                    ${item.qty > 1 ? `<span class="inv-q">${item.qty}x</span>` : ''}
                                    <span>${escapeHtml(item.name)}</span>
                                </span>
                            `).join('') : '<span class="fl-empty">无装备</span>'}
                        </div>
                        <div class="inv-coin">
                            ${currencyOrder.filter(k => currency[k] > 0).map(k =>
                                `<span class="coin-tag coin-${k}">${currency[k]} ${currencyMap[k]}</span>`
                            ).join('') || '<span class="fl-empty">0 金</span>'}
                        </div>
                    </div>
                </div>

                <!-- ===== 角色详情 ===== -->
                ${character.personalTraits || character.ideals || character.bonds || character.flaws || character.backstory ? `
                <div class="fl-section">
                    <div class="fl-section-title">角色详情</div>
                    <div class="detail-list">
                        ${character.personalTraits ? `
                        <div class="detail-item">
                            <div class="detail-label">个人特点</div>
                            <div class="detail-text">${escapeHtml(character.personalTraits)}</div>
                        </div>
                        ` : ''}
                        ${character.ideals ? `
                        <div class="detail-item">
                            <div class="detail-label">理想</div>
                            <div class="detail-text">${escapeHtml(character.ideals)}</div>
                        </div>
                        ` : ''}
                        ${character.bonds ? `
                        <div class="detail-item">
                            <div class="detail-label">羁绊 / 心结</div>
                            <div class="detail-text">${escapeHtml(character.bonds)}</div>
                        </div>
                        ` : ''}
                        ${character.flaws ? `
                        <div class="detail-item">
                            <div class="detail-label">缺点</div>
                            <div class="detail-text">${escapeHtml(character.flaws)}</div>
                        </div>
                        ` : ''}
                        ${character.backstory ? `
                        <div class="detail-item">
                            <div class="detail-label">背景故事</div>
                            <div class="detail-text">${escapeHtml(character.backstory)}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- ===== 熟练·语言 ===== -->
                ${allFeatureBonuses.weaponProf.length > 0 || allFeatureBonuses.armorProf.length > 0 || allFeatureBonuses.toolProf.length > 0 || allFeatureBonuses.languages.length > 0 || allFeatureBonuses.feats.length > 0 || allFeatureBonuses.skillProf.length > 0 || proficientSkillNames.length > 0 ? `
                <div class="fl-section">
                    <div class="fl-section-title">熟练 · 语言</div>
                    <div class="prof-list">
                        ${allFeatureBonuses.skillProf.length > 0 || proficientSkillNames.length > 0 ? `
                        <div class="prof-item">
                            <span class="prof-label">技能熟练</span>
                            <span class="prof-value">${[...new Set([...proficientSkillNames, ...allFeatureBonuses.skillProf])].join('、')}</span>
                        </div>
                        ` : ''}
                        ${allFeatureBonuses.weaponProf.length > 0 ? `
                        <div class="prof-item">
                            <span class="prof-label">武器熟练</span>
                            <span class="prof-value">${allFeatureBonuses.weaponProf.map(w => w.name).join('、')}</span>
                        </div>
                        ` : ''}
                        ${allFeatureBonuses.armorProf.length > 0 ? `
                        <div class="prof-item">
                            <span class="prof-label">护甲熟练</span>
                            <span class="prof-value">${allFeatureBonuses.armorProf.map(a => a.name).join('、')}</span>
                        </div>
                        ` : ''}
                        ${allFeatureBonuses.toolProf.length > 0 ? `
                        <div class="prof-item">
                            <span class="prof-label">工具熟练</span>
                            <span class="prof-value">${allFeatureBonuses.toolProf.map(t => t.count > 1 ? t.name + '×' + t.count : t.name).join('、')}</span>
                        </div>
                        ` : ''}
                        ${allFeatureBonuses.languages.length > 0 ? `
                        <div class="prof-item">
                            <span class="prof-label">语言</span>
                            <span class="prof-value">${allFeatureBonuses.languages.map(l => l.name).join('、')}</span>
                        </div>
                        ` : ''}
                        ${allFeatureBonuses.feats.length > 0 ? `
                        <div class="prof-item">
                            <span class="prof-label">专长</span>
                            <span class="prof-value">${allFeatureBonuses.feats.map(f => f.name).join('、')}</span>
                        </div>
                        ` : ''}
                        ${allFeatureBonuses.expertise.length > 0 || allFeatureBonuses.expertiseCount > 0 ? `
                        <div class="prof-item">
                            <span class="prof-label">专精</span>
                            <span class="prof-value">${allFeatureBonuses.expertise.map(id => {
                                const sk = (dataCache.skills || []).find(s => s.id === id);
                                return sk ? sk.name : '技能(id=' + id + ')';
                            }).concat(allFeatureBonuses.expertiseCount > 0 ? ['可指定' + allFeatureBonuses.expertiseCount + '项'] : []).join('、')}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- ===== 特性 · 专长 ===== -->
                <div class="fl-section">
                    <div class="fl-section-title">特性 · 专长</div>
                    <div class="feat-list">
                        ${feat ? `
                        <div class="feat-item">
                            <div class="feat-n">${escapeHtml(feat.name)}<span class="feat-src">专长</span></div>
                            <div class="feat-d">${formatDesc(feat.desc || '')}</div>
                        </div>
                        ` : ''}
                        ${raceFeatures.filter(f => f).map(f => {
                            var spell = resolveSpellFromRules(f);
                            return `
                            <div class="feat-item">
                                <div class="feat-n">${escapeHtml(spell ? spell.name : f.name)}<span class="feat-src">${escapeHtml(getRaceDisplayName() || '种族')}</span></div>
                                <div class="feat-d">${formatDesc(spell ? spell.desc : (f.desc || ''))}</div>
                            </div>
                        `;}).join('')}
                        ${classFeatures.filter(f => f).map(f => {
                            var spell = resolveSpellFromRules(f);
                            if (spell) {
                                return `
                            <div class="feat-item">
                                <div class="feat-n">${escapeHtml(spell.name)}<span class="feat-src">${escapeHtml(cls ? (cls.name || cls.class) : '职业')}</span></div>
                                <div class="feat-d">${formatDesc(spell.desc)}</div>
                            </div>
                            `;
                            }
                            // 选择型特性（class_extra，如魔能祈唤）的熟练值标签是"可选计数"，不应作为熟练值展示
                            const profVals = (f.extra === 'class_extra') ? null : getFeatureProficiencyValues(f);
                            const profHtml = profVals ? `<div class="feat-prof">${profVals.map(function(p) {
                                var displayVal = p.value;
                                if (typeof displayVal !== 'string') {
                                    displayVal = String(displayVal);
                                }
                                // 伤害类数值加 + 前缀
                                if (String(p.label).indexOf('伤害') !== -1 && displayVal.indexOf('+') !== 0 && displayVal.indexOf('-') !== 0) {
                                    displayVal = '+' + displayVal;
                                }
                                return '<span class="feat-prof-tag">' + escapeHtml(p.label) + ': ' + displayVal + escapeHtml(p.unit) + '</span>';
                            }).join('')}</div>` : '';
                            // ===== 武器精通：显示已选武器及其精通描述 =====
                            var isWeaponMastery = f.rules && String(f.rules).toLowerCase().indexOf('weapon>mastery') >= 0;
                            var weaponHtml = '';
                            if (isWeaponMastery) {
                                var fs = character.featureSelections;
                                var selected = (fs && fs.weapons || []).filter(function(sel) {
                                    return sel.featureId === f.id;
                                });
                                if (selected.length > 0) {
                                    var weaponData = dataCache.weapons || [];
                                    var propData = dataCache.weaponProperties || [];
                                    var propMap = {};
                                    propData.forEach(function(p) { propMap[p.id] = p; });
                                    var masteryItems = selected.map(function(sel) {
                                        var w = weaponData.find(function(w2) { return w2.id === sel.weaponId; });
                                        if (!w) return '';
                                        var prop = propMap[w.mastery] || null;
                                        var propName = prop ? prop.name : '';
                                        var propDesc = prop ? prop.desc : '';
                                        var weaponLabel = w.name + (propName ? '(' + propName + ')' : '');
                                        return '<div class="weapon-mastery-item" style="margin-top:6px;padding-left:8px;border-left:2px solid rgba(100,180,255,0.25);font-size:0.75rem;color:#a89b8c;line-height:1.5;">' +
                                            '<strong style="color:#f0e6d3;font-weight:600;">' + escapeHtml(weaponLabel) + '</strong>' +
                                            (propDesc ? '：' + escapeHtml(propDesc) : '') +
                                            '</div>';
                                    }).filter(function(n) { return n !== ''; });
                                    if (masteryItems.length > 0) {
                                        weaponHtml = '<div class="weapon-mastery-list" style="margin-top:4px;">' +
                                            masteryItems.join('') +
                                            '</div>';
                                    }
                                }
                            }
                            return `
                            <div class="feat-item">
                                <div class="feat-n">${escapeHtml(f.name)}<span class="feat-src">${escapeHtml(cls ? (cls.name || cls.class) : '职业')}</span></div>
                                <div class="feat-d">${formatDesc(f.desc || '')}</div>
                                ${profHtml}${weaponHtml}
                            </div>
                            `;
                        }).join('')}
                        ${allFeatureBonuses.rawTexts && allFeatureBonuses.rawTexts.length > 0 ? allFeatureBonuses.rawTexts.map(text => `
                            <div class="feat-item">
                                <div class="feat-d">${formatDesc(text)}</div>
                            </div>
                        `).join('') : ''}
                        ${character.codeSelections ? Object.keys(character.codeSelections).map(function(key) {
                            var sel = character.codeSelections[key];
                            var displayName = sel.label || key;
                            var displayDesc = sel.desc || '';
                            return '<div class="feat-item">' +
                                '<div class="feat-n">' + escapeHtml(displayName) + '<span class="feat-src">选择</span></div>' +
                                (displayDesc ? '<div class="feat-d">' + formatDesc(displayDesc) + '</div>' : '') +
                                '</div>';
                        }).join('') : ''}
                        ${character.classExtraAll && character.classExtraAll.length > 0 ? character.classExtraAll.map(function(group) {
                            return group.items.map(function(e) {
                                var extraName = e.name || '';
                                var extraDesc = e.desc || '';
                                if (!extraName && !extraDesc) return '';
                                var effectName = e.category || group.featureName || '';
                                return '<div class="feat-item" style="margin-top:2px;">' +
                                    '<div class="feat-n" style="font-size:0.78rem;">' +
                                        escapeHtml(effectName) +
                                        (extraName ? '<span class="feat-src" style="font-size:0.55rem;">' + escapeHtml(extraName) + '</span>' : '') +
                                    '</div>' +
                                    (extraDesc ? '<div class="feat-d" style="font-size:0.72rem;">' + formatDesc(extraDesc) + '</div>' : '') +
                                    '</div>';
                            }).join('');
                        }).join('') : ''}
                        ${!feat && raceFeatures.length === 0 && classFeatures.length === 0 && (!allFeatureBonuses.rawTexts || allFeatureBonuses.rawTexts.length === 0) ? '<span class="fl-empty">暂无特性</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== 法术条目 =====