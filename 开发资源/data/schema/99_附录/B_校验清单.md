# 附录 B：AI 自检清单

AI 填写完数据后，必须逐条检查以下项目。

---

## 通用校验（所有表）

```
□ ID 检查
  □ ID 是否为数字？
  □ 本体数据 ID 是否在 1-9999 范围内？
  □ DLC 数据 ID 是否 ≥10000？
  □ 同一 DLC 内是否有重复 ID？

□ 必填字段
  □ 所有标记为"必填"的字段是否已填写？
  □ 是否有意外的空值？

□ 引用检查（v1.0 新规则）
  □ 是否使用了自描述表达式？（不是旧的 link(id)）
  □ 所有表名是否在标准表名列表中？
  □ 所有条件中的 key 是否存在于目标表？
  □ 所有字典表引用是否存在于字典表？

□ 格式检查
  □ 列表是否使用英文逗号分隔？（不是中文顿号）
  □ 文本中的逗号是否用双引号包裹整列？
  □ 数值字段是否没有混入文本？（如 "20尺" → 应该是 20）
  □ 布尔值是否用 0/1？（不是 true/false/是/否）

□ 编码检查
  □ 文件是否为 UTF-8 without BOM？
  □ 是否有乱码字符？
```

---

## 自描述表达式专项校验（v1.0 新增）

```
□ 基本引用
  □ 格式是否为 "表名(条件)+数量"？
  □ 表名是否在标准列表中？（feats/spells/skills/tools/weapons/armors 等）
  □ 条件格式是否为 "key=value"？
  □ 多个条件是否用逗号分隔？
  □ 数量是否为数字？（如果没有数量，默认为 1）

□ 手动选择
  □ 格式是否为 "choose(表名(id1,id2))+数量"？
  □ ID 列表是否用逗号分隔？
  □ 数量是否 ≤ ID 列表长度？

□ 范围选择
  □ 格式是否为 "表名(id→id)"？（注意：→ 是特殊箭头字符）
  □ 起始 ID 是否 < 结束 ID？

□ 特殊操作
  □ all(表名) → 表名是否有效？
  □ half-prof(表名) → 表名是否为 skills 或 tools？
  □ spell_slot(lv=N)+M → lv 是否为 1-9 的数字？
  □ proficiency>pure+N → N 是否为数字？
  □ proficiency>pure(id1,id2)+N → ID 是否存在于目标表？

□ 多选一
  □ 是否用 ①②③ 标记选项？
  □ 每个选项是否为有效的自描述表达式？

□ 公式
  □ AbilityModifiers(id) → id 是否为 1/4/9/11/18/25？
  □ lv:class(id) → id 是否为有效的职业 ID？
  □ Proficiency → 是否单独使用？
  □ 数值运算是否合理？（如 speed+10, hp_per_lv+2）

□ 前置条件
  □ 格式是否为 "prerequisite(条件)"？
  □ 条件是否可解析？（如 lv>=4, ability(1)>=13）

□ 连锁引用
  □ 格式是否为 "chain:数字"？
  □ 数字是否为正整数？

□ 代码标记
  □ 格式是否为 "code(标记)"？
  □ 标记是否在标准列表中？（choose/二选一 等）
```

---

## 法术表专项校验

```
□ 目标类型
  □ target_type 是否在允许值列表中？
    （self/single/touch/multiple/sphere/cone/line/cube/cylinder/wall/self_radius/special）
  □ 如果 target_type 是 sphere/cone/line/cube/cylinder/wall/self_radius：
    □ target_size 是否已填写？
    □ target_size 是否为纯数字？
    □ target_size 是否合理？（如 sphere 通常 5-60）
  □ 如果 target_type 是 single/touch/self：
    □ target_size 是否留空？（不应该有值）

□ 效果类型
  □ effect_type 是否在允许值列表中？
    （damage/healing/buff/debuff/control/utility/teleport/summon/transform/create_destroy）
  □ 如果 effect_type = damage：
    □ damage_type 是否已填写？
    □ dice_interaction 是否已填写？
  □ 如果 effect_type = healing：
    □ dice_interaction 是否已填写？

□ 豁免
  □ 如果有豁免（save_type 有值）：
    □ save_success 是否已填写？（不是留空）
    □ save_success 是否在允许值列表中？（none/half/damage_zero/effect_zero）
  □ 如果无豁免（save_type 留空）：
    □ save_success 应该 = none 或留空
    □ attack_roll 应该 = 1（需要攻击检定替代）

□ 职业
  □ classes 是否用英文逗号分隔？
  □ 每个职业 ID 是否存在于职业表？
  □ 是否有重复的职业 ID？

□ 升环
  □ 如果 upcast 有值：
    □ 格式是否为 "level:[条件],[效果]"？
    □ 条件是否合理？（如 +1 表示每升一环）

□ AI规则
  □ 是否包含：目标、判定、效果、特殊？
  □ 是否简洁明了，没有复制整个详情？
```

---

## 状态效果表专项校验

```
□ 持续时间
  □ duration_type 是否在允许值列表中？
  □ 如果 duration_type = round/minute/hour/day：
    □ duration_value 是否已填写且为数字？
  □ 如果 duration_type = instant/permanent/long_rest/short_rest/concentration/special：
    □ duration_value 是否留空？

□ 叠加
  □ 如果 stackable = 1：
    □ stack_rule 是否已填写？
    □ stack_rule 是否在允许值列表中？（max/sum/replace/duration）
  □ 如果 stackable = 0：
    □ stack_rule 是否留空？

□ 属性影响
  □ stat_effects 是否为有效 JSON？
  □ JSON 中的 type 是否在允许值列表中？（set/bonus/advantage/disadvantage/half/immunity/resistance/vulnerability）
  □ 数值是否合理？

□ 动作影响
  □ action_effects 中的每个值是否在标准列表中？
  □ 多个值是否用英文逗号分隔？

□ 检定影响
  □ check_effects 中的每个值是否在标准列表中？

□ 自动解除
  □ auto_remove 是否在允许值列表中？
    （damage/attack_caster/save_success/action/bonus_action/reaction/ally_action/spell_end/long_rest/custom）
```

---

## 战斗动作表专项校验

```
□ 动作类型
  □ action_type 是否在允许值列表中？
    （action/bonus_action/reaction/free_action/movement/interaction/special）

□ 来源
  □ source_type 是否在允许值列表中？
    （class_feature/race_feature/feat/spell/item/condition/basic）
  □ source_id 是否存在于对应的源表？

□ 消耗
  □ 如果 cost 有值：
    □ 格式是否为 "资源名:数量"？
    □ 资源名是否标准？（rage_charge/spell_slot/ki_point/sorcery_point 等）

□ 使用条件
  □ prerequisites 中的每个条件是否可解析？
  □ 多个条件是否用分号分隔？

□ 效果数据
  □ effect_data 是否为有效 JSON？
  □ JSON 中的 type 是否在允许值列表中？
```

---

## 怪物表专项校验

```
□ 基础属性
  □ abilities 是否为 "str,dex,con,int,wis,cha" 格式？
  □ 共 6 个数字，用逗号分隔？
  □ 每个数字是否在 1-30 范围内？

□ 护甲
  □ armor_type 是否在允许值列表中？
    （natural/leather/leather_shield/chain_shirt/scale/breastplate/half_plate/plate/mage_armor/unarmored）

□ 速度
  □ speed 是否为纯数字？
  □ special_speed 格式是否正确？（如 "fly:30,swim:40"）

□ 伤害类型
  □ damage_immunities/resistances/vulnerabilities 中的每个值是否在标准列表中？
    （acid/bludgeoning/cold/fire/force/lightning/necrotic/piercing/poison/psychic/radiant/slashing/thunder）

□ 状态免疫
  □ condition_immunities 中的每个 ID 是否存在于状态效果表？

□ 感官
  □ senses 格式是否正确？（如 "darkvision:60,blindsight:10"）

□ 挑战等级
  □ cr 是否在标准列表中？（0, 1/8, 1/4, 1/2, 1-30）
  □ xp 是否与 cr 匹配？

□ AI行为
  □ ai_behavior 是否为有效 JSON？
  □ priority 是否在允许值列表中？（aggressive/defensive/supportive/cowardly/tactical/berserk）
  □ target_selection 是否在允许值列表中？（weakest/strongest/closest/farthest/spellcaster/healer/damaged/flanked/lowest_ac）
  □ tactics 中的 condition 是否可解析？
  □ tactics 中的 action 是否有效？
```

---

## DLC 包校验

```
□ manifest.json
  □ id 是否唯一？
  □ version 是否符合语义化版本？（x.y.z）
  □ depends_on 中的每个 DLC 是否已存在？
  □ id_prefix 是否 ≥10000？
  □ tables.新增 中的表名是否标准？
  □ tables.覆盖 中的 id 是否存在于本体或依赖 DLC？

□ CSV 文件
  □ 文件名是否和标准表名一致？
  □ 是否只包含本 DLC 新增/覆盖的数据？（不包含本体数据）
  □ 所有数据的 DLC 列是否 = 本 DLC 的 id？

□ Schema 文档（如果有）
  □ 是否只描述和本体不同的地方？
  □ 是否引用了本体的 Schema？
```

---

## 最终输出格式检查

AI 完成数据填写后，输出应该包含：

```
1. CSV 数据（可直接保存为 .csv 文件）
2. 自检结果（逐条打勾）
3. 已知问题/不确定项（如果有）
```

示例输出格式：

```
=== CSV 数据 ===
id,名字,...
10000,水压爆裂,...

=== 自检结果 ===
✅ ID 在范围内（10000）
✅ 所有必填字段已填
✅ 使用了自描述表达式（spells(class=3,lv=0)+2）
✅ 目标类型正确（sphere）
✅ 列表使用英文逗号
⚠️ 职业字段不确定：只写了德鲁伊和法师，可能还有其他职业可以学这个法术

=== 已知问题 ===
- 职业列表可能不完整，需要人工确认
```