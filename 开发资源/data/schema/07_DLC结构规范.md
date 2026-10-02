# 07_DLC 结构规范

本文档定义 DLC 数据包的目录结构、文件格式和加载规则。

---

## 一、DLC 目录结构

每个 DLC 是一个独立目录，命名格式：`dlc_{编号}_{名称}/`

```
dlc_01_深海秘境/
├── manifest.json              ← 必须：DLC 元数据
├── README.md                  ← 可选：DLC 说明文档
├── schema/                    ← 可选：本 DLC 特有的 Schema 说明
│   └── 法术_扩展.md           ← 只写和本体不同的地方
└── csv/                       ← 必须：数据文件
    ├── 法术.csv               ← 只包含本 DLC 新增/覆盖的数据
    ├── 种族.csv
    └── 种族特性.csv
```

### 目录说明

| 文件/目录 | 必须？ | 说明 |
|---|---|---|
| manifest.json | ✅ 必须 | DLC 的身份证，引擎靠它识别和加载 |
| README.md | ❌ 可选 | 人类可读的 DLC 说明，AI 不需要读 |
| schema/ | ❌ 可选 | 如果本 DLC 有特殊的字段或规则，在这里说明 |
| csv/ | ✅ 必须 | 数据文件，每个文件对应一个表 |

---

## 二、manifest.json 格式

```json
{
  "id": "dlc_01",
  "name": "深海秘境",
  "version": "1.0.0",
  "depends_on": ["phb"],
  "author": "AI 生成",
  "description": "新增海洋主题种族、法术和怪物",
  "tables": {
    "新增": ["races", "race_features", "spells"],
    "覆盖": []
  },
  "id_prefix": 10000,
  "compatibility": {
    "min_engine_version": "0.5.0",
    "max_engine_version": "1.0.0"
  },
  "tags": ["海洋", "种族", "法术"]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | 是 | DLC 唯一标识，格式：dlc_数字 |
| name | string | 是 | 人类可读的 DLC 名称 |
| version | string | 是 | 语义化版本（x.y.z） |
| depends_on | array | 是 | 依赖的 DLC 列表，至少包含 "phb" |
| author | string | 否 | 作者信息 |
| description | string | 否 | 简短描述 |
| tables.新增 | array | 是 | 本 DLC 新增了哪些表的数据 |
| tables.覆盖 | array | 是 | 本 DLC 覆盖了哪些已有数据（可为空数组） |
| id_prefix | int | 是 | 本 DLC 的数据 ID 前缀，≥10000 |
| compatibility | object | 否 | 兼容的引擎版本范围 |
| tags | array | 否 | 标签，方便分类和搜索 |

### 依赖规则

```
DLC-A 依赖 DLC-B → 引擎先加载 DLC-B，再加载 DLC-A
DLC-A 覆盖 DLC-B 的数据 → DLC-A 的版本生效
循环依赖 → 引擎报错，拒绝加载
缺失依赖 → 引擎报错，拒绝加载
```

---

## 三、CSV 文件规则

### 3.1 文件名

CSV 文件名必须和标准表名一致：

```
✅ 正确：法术.csv、种族.csv、职业.csv
❌ 错误：spells.csv、新法术.csv、法术数据.csv
```

### 3.2 文件内容

每个 CSV 文件**只包含本 DLC 新增或覆盖的数据**，不包含本体数据。

```
❌ 错误：DLC 的 法术.csv 包含火球术（本体数据）
✅ 正确：DLC 的 法术.csv 只包含 DLC 新增的法术
```

### 3.3 覆盖规则

覆盖本体数据时，使用**相同的 id**：

```csv
// dlc_01/csv/法术.csv
// 覆盖本体的火球术（id=1）
id,名字,...
1,火球术（削弱版）,...  // 和本体相同的 id=1
```

引擎加载时：
1. 先加载本体火球术（id=1）
2. 再加载 DLC 火球术（id=1）
3. DLC 版本覆盖本体版本

### 3.4 新增规则

新增数据时，使用 DLC 分配的 ID 范围：

```csv
// dlc_01/csv/法术.csv
// 新增法术
id,名字,...
10000,水压爆裂,...  // DLC 前缀 10000
10001,深海之触,...  // DLC 前缀 10001
```

---

## 四、Schema 扩展规则

如果本 DLC 需要新增字段或修改字段含义：

### 4.1 新增字段

在 `schema/表名_扩展.md` 中说明：

```markdown
# 法术表扩展（深海秘境 DLC）

## 新增字段

| 列名 | 英文名 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 水压深度 | water_pressure | int | 否 | 法术在水下时的额外效果深度（英尺） |

## 字段修改

无。

## 特殊规则

本 DLC 的法术在水下施法时：
- 火焰伤害法术自动转为闪电伤害
- 范围增加 50%
```

### 4.2 引擎处理

引擎读取 DLC 时：
1. 读取本体的 Schema（知道基础字段）
2. 读取 DLC 的 Schema 扩展（知道新增字段）
3. 合并字段列表
4. 读取 CSV 数据
5. 对于本体没有的字段，填充默认值

---

## 五、DLC 加载流程

```
引擎启动
  ↓
读取所有 DLC 的 manifest.json
  ↓
构建依赖图，检查循环依赖
  ↓
拓扑排序，确定加载顺序
  ↓
按顺序加载每个 DLC：
  1. 读取 Schema 扩展
  2. 读取 CSV 数据
  3. 合并到全局数据表
  4. 相同 id 的数据：后加载的覆盖先加载的
  ↓
验证所有引用是否有效
  ↓
输出合并后的 JSON 供前端使用
```

---

## 六、DLC 示例

### 示例 1：纯新增 DLC

```
dlc_02_费伦怪物图鉴/
├── manifest.json
│   {
│     "id": "dlc_02",
│     "name": "费伦怪物图鉴",
│     "version": "1.0.0",
│     "depends_on": ["phb"],
│     "tables": {
│       "新增": ["monsters"],
│       "覆盖": []
│     },
│     "id_prefix": 20000
│   }
└── csv/
    └── 怪物数据.csv
        id,名字,...
        20000,地精战士,...
        20001,地精法师,...
```

### 示例 2：覆盖+新增 DLC

```
dlc_03_平衡补丁/
├── manifest.json
│   {
│     "id": "dlc_03",
│     "name": "平衡补丁",
│     "version": "1.0.0",
│     "depends_on": ["phb"],
│     "tables": {
│       "新增": [],
│       "覆盖": ["spells", "class_features"]
│     },
│     "id_prefix": 30000
│   }
└── csv/
    ├── 法术.csv
    │   id,名字,...
    │   1,火球术（削弱版）,...  // 覆盖本体 id=1
    │   3,闪电束（增强版）,...  // 覆盖本体 id=3
    └── 职业特性.csv
        id,名字,...
        1,狂暴（重做）,...      // 覆盖本体 id=1
```

### 示例 3：依赖其他 DLC

```
dlc_04_深海冒险模组/
├── manifest.json
│   {
│     "id": "dlc_04",
│     "name": "深海冒险模组",
│     "version": "1.0.0",
│     "depends_on": ["phb", "dlc_01"],
│     "tables": {
│       "新增": ["scenes", "encounters"],
│       "覆盖": []
│     },
│     "id_prefix": 40000
│   }
└── csv/
    ├── 场景.csv
    └── 遭遇.csv
```

---

## 七、版本管理

### 7.1 DLC 版本升级

```
1.0.0 → 1.0.1  修复错误（bugfix）
1.0.0 → 1.1.0  新增内容（新增怪物、法术）
1.0.0 → 2.0.0  不兼容变更（修改已有数据格式）
```

### 7.2 引擎兼容性

```json
{
  "compatibility": {
    "min_engine_version": "0.5.0",
    "max_engine_version": "1.0.0"
  }
}
```

- 引擎版本 < min → 拒绝加载，提示升级引擎
- 引擎版本 > max → 警告可能不兼容，但允许加载

---

## 八、给 AI 的总结

> 你正在创建一个 DLC 数据包。
> 1. 创建 `manifest.json`，声明 id、版本、依赖、id_prefix
> 2. 在 `csv/` 目录下放置数据文件，只放新增/覆盖的数据
> 3. 新增数据用 DLC 前缀的 ID（如 10000+）
> 4. 覆盖数据用和本体相同的 ID
> 5. 如果有特殊字段，在 `schema/` 下写扩展说明
> 6. 确保所有引用的 ID 存在于本体或依赖 DLC 中