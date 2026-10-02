# 普查单 普查-004: link(id) 现状普查

## 1. 普查目标
- **要解决什么问题**：需求-001 要求全面废除 `link(id)`，但迁移前必须掌握 `link(id)` 在代码库中的全貌
- **普查范围**：`csv导出/` 目录下所有 CSV 文件、引用表、前端代码、脚本

## 2. 普查项

### 2.1 CSV 中 `link(id)` 出现次数及分布

| 文件 | 出现次数 | 关键行范围 |
|---|---|---|
| `职业特性.csv` | **245** | L42~L453+，密集分布在子职法术列 |
| `种族特性.csv` | **28** | rules 字段 |
| `专长.csv` | **20** | rules 字段 |
| `背景.csv` | **16** | 工匠熟练/初始专长等字段 |
| `职业额外资源.csv` | **9** | L45~L66，集中在魔契师魔能祈唤 |
| `职业.csv` | **7** | 武器/护甲/工具熟练字段 |
| **合计** | **325** | — |

CSV 中 `link(id)` 只出现在 **6 个文件**中，其他 CSV 不使用 link 引用。

### 2.2 引用表覆盖率

**引用表总条目**：约 340 条（id 范围 1~531，中间有跳号），虽然引用表的第一列标题是 `id`，但实际表头为 `id,source_table,mode,类型,target_id,数量,complex_logic,详情` 共 8 列。

**覆盖率分析**：

| 维度 | 数据 |
|---|---|
| 引用表定义的总 ID 数 | ~340 个（1~531，部分跳号） |
| 6 个活跃 CSV 引用次数 | 325 处 |
| 引用表中活跃被引用的 ID | 约 200~250 个（估算，因为一条 link(id) 可能被多处引用） |
| 可能从未被使用的 link ID | 约 90~140 个（引用表中定义但在所有活跃 CSV 中均未出现） |

**引用表 type 分布**：
| type | 用途 | 出现频次（估算） |
|---|---|---|
| `id` | 直接引用（法术、技能等） | ~250 条，占主体 |
| `filter` | 条件筛选（spell(class=...)+N） | ~40 条 |
| `type` | 按类型筛选（tools(type=66)） | ~15 条 |
| `choose` | 手动列表选择 | ~5 条 |
| `special` | 特殊操作（all/half-prof/...） | ~10 条 |
| `spell_slot` | 法术位增加 | ~1 条 |
| `prerequisite` | 前置条件 | ~15 条 |
| `rules` | 裸规则表达式 | ~5 条 |
| `rule` | 规则模式（hp_per_lv+2） | ~1 条 |

> 注：引用表中 `type=rule` (id=309) 和 `type=rules` (id=514-517) 是两个不同的 type 值，前者表示"规则模式（描述）"，后者表示"裸规则表达式（直接执行）"，两者语义不同。

**特殊发现：growup 范围选择未实装。**

`10_自描述表达式规范.md` 中定义了"范围选择"语法 `growup(303→322)`，但经普查确认：

| 检查项 | 结果 |
|---|---|
| 引用表中 `source_table=growup` 的条目 | **0 条**（整个 340 条引用表中没有任何 growup 条目） |
| ID 302-310 在引用表中的实际占用 | 全部为其他类型（spells/filter × 5、spell_slot × 1、basic/rule × 1、tools/special × 1），4 个 activeCSV 引用（link(304~308)出现在专长.csv 的魔法学徒系列） |
| 前端 selection.js 中的 growup 语法解析 | **代码已写**（L139 正则匹配 `growup(数字→数字)`，L83 加载 proficiency.json），但**无引用表数据支撑** |
| `10_规范`中的范围选择语法 | 规范写了，数据没跟上。属于远期规划，当前迁移不涉及 |

> 结论：范围选择(growup)在本次 link 迁移中**不需要处理**，它是独立的语法规划，不通过 `link(id)` 引用。

### 2.3 异常清单：CSV 中出现但引用表中未定义的 `link(id)` 列表

**未验证。** 需要编写交叉比对脚本：提取所有 CSV 中 `link(\d+)` 捕获的数字 → 去重 → 与引用表的 id 列表做差集。手工抽查样本未发现明显缺失，但 325 处 link 中有无未定义 ID 需要脚本验证。

### 2.4 硬编码清单：前端代码和脚本中出现 `link(` 的位置及上下文

#### 前端 JS（8 个文件）

| 文件 | 行号 | 上下文 |
|---|---|---|
| `handlers/link.js` | 全文 | **核心处理器**：parse() 解析 link(id) → 查引用表 → 路由到对应 handler（id/filter/type/choose/special/spell_slot 共 6 种分支） |
| `handlers/index.js` | L84-91 | **路由入口**：`if (r.startsWith('link('))` 优先匹配，调 link.parse() |
| `handlers/index.js` | L381 | **code 字段处理**：注释提到 `link(291),spell_slot(1)+1` 是 code 字段中的规则组合 |
| `creation/steps/spells.js` | L260 | 解析 `link(XXX)` 格式（法术选择步骤中的种族法术处理） |
| `creation/steps/review.js` | L652,655,674 | 先决条件展示：`lv:class(11)=2,link(500)` → 人可读描述 |
| `creation/steps/feature-selection.js` | L1572,1595,1607 | 先决条件检查：解析 `link(XXX)` 类型的中间表先决条件 |
| `creation/steps/feat.js` | L89 | 先决条件翻译：将 link(N) 转换为人可读的描述 |
| `creation/steps/background.js` | L94 | 格式3识别：`link(id)` 作为背景数据的一种格式 |
| `code-handlers/spell-level.js` | L12-13,19,75-79 | `extractLinkId()` 从 rules 列用正则 `/link\(\s*(\d+)\s*\)/` 提取 ID |

#### Python 脚本

**无。** 所有 `开发资源/data/*.py` 中均未出现 `link(` 硬编码。`csv转json.py` 作为数据通道只是透传 CSV 中的原始字符串，不对 `link()` 做任何解析或判断。

#### 升级模块（upgrade/）

**无。** 升级模块目录下的 JS 文件不含 `link(` 引用。

#### JSON 数据文件

| 目录 | 文件 | 出现次数 |
|---|---|---|
| `data/json/`（活跃） | `class_features.json` | 251 |
| | `feats.json` | 115 |
| | `class_extra.json` | 37 |
| | `race_features.json` | 28 |
| | `backgrounds.json` | 16 |
| | `classes.json` | 7 |
| `data/json/_bak/`（备份） | 同上 6 文件 + race_features, feats 等 | ~500+ |
| **活跃合计** | 6 个 JSON 文件 | **454 处** |

---

## 3. 验收标准（必须可验证）

- [x] 普查报告列出每个 CSV 文件中 `link(id)` 的出现次数（精确到文件级）
- [x] 引用表覆盖率：引用表中定义的 `link(id)` 约 340 条，活跃 CSV 引用 325 处（含重复），估算未被使用的 ID 约 90~140 个
- [ ] 异常清单：CSV 中出现但引用表中未定义的 `link(id)` 列表 — **未验证，需脚本交叉比对**
- [x] 硬编码清单：前端代码 8 个文件 11 处关键位置，Python 脚本无硬编码
- [x] 普查报告格式为 Markdown，存放于 `ai文档集合/当前工程/普查-004_link-id 现状普查.md`
- [x] growup 范围选择：引用表 **0 条** growup 条目，代码已写但数据未实装，迁移范围排除此项

## 4. 风险与依赖
- **技术风险**：前端代码未压缩/混淆，搜索结果可靠。JSON `_bak` 目录为历史备份，迁移时只需关注活跃 JSON。
- **依赖项**：CSV 引用表数据完整可读，脚本搜索结果已验证（Python 脚本零命中）。
- **发现**：`10_规范`中的 growup 范围选择(ID 302-322)在引用表中无对应数据，不影响本次迁移。