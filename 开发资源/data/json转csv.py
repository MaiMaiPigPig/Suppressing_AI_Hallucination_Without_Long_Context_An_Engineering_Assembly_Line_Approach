"""
JSON 转 CSV 脚本
==================
功能：将 TableChronicle/data/json/ 目录下的所有 JSON 文件转换为 CSV 格式
输出：每个 JSON 文件对应一个 CSV 文件，保存到 data/csv导出/ 目录

用法：双击运行或 python json转csv.py
"""

import json
import csv
import os
import sys

# ============ 配置 ============
# 注意：脚本在开发资源/data/ 下，JSON 从 TableChronicle/data/json/ 读取
JSON_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'TableChronicle', 'data', 'json')
CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'csv导出')

# 文件名映射（json中的英文名 → csv导出中的中文名）
NAME_MAP = {
    'feats': '专长',
    'spells': '法术',
    'classes': '职业',
    'class_features': '职业特性',
    'class_extra': '职业额外资源',
    'races': '种族',
    'race_features': '种族特性',
    'backgrounds': '背景',
    'skills': '技能',
    'tools': '工具',
    'armors': '护甲',
    'weapons': '武器',
    'weapon_properties': '武器特性',
    'items': '背包',
    'packages': '套装',
    'package_details': '套装详情',
    'magic_items': '魔法物品',
    'monsters': '怪物数据',
    'proficiency': '环位熟练',
    'languages': '语言',
    'alignments': '阵营',
    'dictionary': '字典',
    'dlc': 'dlc',
    'subclasses': '子职',
    'lookup_table': '引用表',
    'spell_field_mapping': '法术字段映射',
    'spellcasting': 'spellcasting',
    'spellcasting_formulas': 'spellcasting_formulas',
    'spellcasting_methods': 'spellcasting_methods',
}


# ===== 反向映射（英文键名 → 中文列名） =====
# 与 csv转json.py 中的 KEY_MAP 互为逆向
REVERSE_KEY_MAP = {
    'ac': '护甲等级（AC）',
    'ai_rule': 'AI规则',
    'attack_roll': '攻击检定',
    'armor': '甲类型',
    'attr': '属性',
    'casting_time': '施法时间',
    'category': '类别',
    'chain': '特性chain:',
    'choice': '选择',
    'class': '职业',
    'class_id': '职业',
    'code': '代码',
    'code_effects': '其他代码效果',
    'component_m': '材料（M）',
    'component_s': '姿势（S）',
    'component_v': '施法成分_语言（V）',
    'concentration': '专注',
    'consumed': '是否消耗',
    'contains': '包含',
    'cost': '价格',
    'count': '数量',
    'craft': '制作',
    'damage_dice': '伤害骰',
    'damage_type': '伤害类型',
    'data': '数据',
    'desc': '详情',
    'dice': '骰娘互动',
    'duration': '持续时间',
    'effect_type': '效果类型',
    'example': '示例',
    'expr': '表达式',
    'feat': '初始专长',
    'feat_level': '专长等级',
    'feature_levels': '主职特性',
    'spellcaster': '是否施法者',
    'hit_dice': '生命骰',
    'hp_per_level': '升级生命值',
    'item_choice': '物品选择(根据商品id选择)',
    'level': '等级',
    'link': '功能链接',
    'link_extra': '额外链接',
    'mastery': '精通',
    'material_cost': '材料价值',
    'meaning': '含义',
    'name': '名字',
    'name_en': '英文名',
    'operation': '操作',
    'preference': '喜好',
    'prerequisite': '先决',
    'primary': '主',
    'primary_ability': '主属性建议',
    'prof_bonus': '熟练价值',
    'properties': '词条',
    'range': '施法距离',
    'rarity': '珍稀级别',
    'recommended_abilities': '推荐属性',
    'ritual': '仪式',
    'rules': '车卡数据',
    'save': '豁免类型',
    'save_effect': '豁免成功',
    'saving_throw_prof': '豁免熟练',
    'school': '学派',
    'size': '体型',
    'skill_prof': '技能熟练项',
    'skills': '技能',
    'slot_1': '1环',
    'slot_2': '2环',
    'slot_3': '3环',
    'slot_4': '4环',
    'slot_5': '5环',
    'slot_6': '6环',
    'slot_7': '7环',
    'slot_8': '8环',
    'slot_9': '9环',
    'source': '来源',
    'species': '物种',
    'speed': '速度',
    'stealth': '隐匿',
    'strength': '力量',
    'subclass': '0/子职',
    'subclass_id': '子职ID',
    'subclass_level': '子职等级',
    'subrace': '从属',
    'suit_id': '套装id',
    'target_count': '目标数量',
    'target_size': '目标尺寸',
    'target_size2': '目标尺寸2',
    'target_type': '目标类型',
    'tool': '工匠熟练',
    'tool_prof': '工具熟练',
    'type': '类型',
    'upcast': '强化',
    'value': '数值',
    'visible': '是否显示',
    'weapon': '武器熟练',
    'weapon_category': '简易/军用',
    'weapon_range': '近战/远程',
    'weight': '重量',
}

# ===== 从外部文件加载法术字段映射 =====
# 法术字段映射表（json/spell_field_mapping.json）可编辑，运行时自动合并
SPELL_MAPPING_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'json', 'spell_field_mapping.json')
if os.path.exists(SPELL_MAPPING_FILE):
    try:
        with open(SPELL_MAPPING_FILE, 'r', encoding='utf-8') as f:
            spell_mappings = json.load(f)
        for item in spell_mappings:
            cn = item.get('中文列名', '').strip()
            en = item.get('英文键名', '').strip()
            if en:
                REVERSE_KEY_MAP[en] = cn if cn else en
        print(f'[加载] 法术字段映射: {len(spell_mappings)} 条')
    except Exception as e:
        print(f'[警告] 加载法术字段映射失败: {e}')


# ===== 自描述表达式序列化 =====
# 已知表达式类型（与 csv转json.py 中 ExpressionParser.EXPR_TYPES 一致）
EXPR_TYPES = {'basic_ref', 'filter', 'choose', 'range', 'special', 'multi_choice',
              'formula', 'prerequisite', 'chain', 'code'}


def serialize_expression(obj):
    """将表达式结构化对象还原为自描述表达式字符串"""
    typ = obj.get('type', '')

    if typ == 'basic_ref':
        table = obj.get('table', '')
        conds = ','.join(f'{c["key"]}={",".join(c["values"])}' for c in obj.get('conditions', []))
        return f'{table}({conds})'

    if typ == 'filter':
        table = obj.get('table', '')
        conds = ','.join(f'{c["key"]}={",".join(c["values"])}' for c in obj.get('conditions', []))
        cnt = obj.get('count', 1)
        return f'{table}({conds})+{cnt}'

    if typ == 'choose':
        items = obj.get('items', [])
        cnt = obj.get('count', 1)
        inner = ','.join(items)
        return f'choose({inner})+{cnt}' if cnt != 1 else f'choose({inner})'

    if typ == 'range':
        table = obj.get('table', '')
        start = obj.get('start', '')
        end = obj.get('end', '')
        return f'{table}({start}→{end})'

    if typ == 'special':
        op = obj.get('operation', '')
        if op == 'all':
            return f'all({obj.get("table", "")})'
        if op == 'proficiency>pure':
            cnt = obj.get('count', 1)
            return f'proficiency>pure+{cnt}' if cnt != 1 else 'proficiency>pure'
        if op == 'half-prof':
            return f'half-prof({obj.get("tables", "")})'
        if op == 'spell_slot':
            lv = obj.get('level', 0)
            cnt = obj.get('count', 1)
            return f'spell_slot(lv={lv})+{cnt}'
        return str(obj)

    if typ == 'multi_choice':
        opts = obj.get('options', [])
        parts = []
        for i, opt in enumerate(opts, 1):
            if isinstance(opt, dict):
                parts.append(f'[{i}]{serialize_expression(opt)}')
            else:
                parts.append(f'[{i}]{opt}')
        return ','.join(parts)

    if typ == 'formula':
        ftype = obj.get('formula_type', '')
        params = obj.get('params', [])
        if ftype == 'ability_modifier':
            return f'AbilityModifiers({params[0]})' if params else 'AbilityModifiers(?)'
        if ftype == 'class_level':
            return f'lv:class({params[0]})' if params else 'lv:class(?)'
        if ftype == 'half_class_level_down':
            return f'lv:class({params[0]})→↓' if params else 'lv:class(?)→↓'
        if ftype == 'proficiency_bonus':
            return 'Proficiency'
        if ftype == 'speed_bonus':
            return f'speed+{params[0]}' if params else 'speed+?'
        if ftype == 'hp_per_level':
            return f'hp_per_lv+{params[0]}' if params else 'hp_per_lv+?'
        if ftype == 'character_resource':
            return f'Character({params[0]})' if params else 'Character(?)'
        return str(obj)

    if typ == 'prerequisite':
        return f'prerequisite({obj.get("condition", "")})'

    if typ == 'chain':
        return f'chain:{obj.get("feature_id", "")}'

    if typ == 'code':
        return f'code({obj.get("tag", "")})'

    return str(obj)


def _is_expr_obj(val):
    """判断一个 dict 是否为表达式结构化对象"""
    return isinstance(val, dict) and val.get('type') in EXPR_TYPES and 'success' in val


def flatten_value(val):
    """将 JSON 值展平为 CSV 友好的字符串。
    
    规则：
    - 字符串：保持原样
    - 数字/布尔：转字符串
    - None：空字符串
    - list/tuple：用 `; ` 连接
    - dict：用 `; ` 连接 "key:value" 对
    """
    if val is None:
        return ''
    if isinstance(val, str):
        return val
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (list, tuple)):
        parts = []
        for item in val:
            f = flatten_value(item)
            if f:
                parts.append(f)
        return '; '.join(parts)
    if isinstance(val, dict):
        if _is_expr_obj(val):
            return serialize_expression(val)
        parts = []
        for k, v in val.items():
            fv = flatten_value(v)
            if fv:
                parts.append(f'{k}:{fv}')
        return '; '.join(parts)
    return str(val)


def json_to_csv(json_file):
    """单个 JSON 文件转 CSV"""
    file_path = os.path.join(JSON_DIR, json_file)
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list) or len(data) == 0:
        print(f'  ⚠ 跳过 {json_file}（空数组或非数组）')
        return

    # 收集所有字段（按第一个对象的 key 顺序，补全后续对象的缺失字段）
    all_keys = []
    seen = set()
    for obj in data:
        for k in obj:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)

    # 将英文键名映射为中文列名（表头），无映射则保留原键名
    cn_headers = [REVERSE_KEY_MAP.get(k, k) for k in all_keys]

    # 确定输出文件名（英文 → 中文映射）
    base_name = json_file.replace('.json', '')
    csv_name = NAME_MAP.get(base_name, base_name) + '.csv'
    out_path = os.path.join(CSV_DIR, csv_name)

    # 写入 CSV（使用 csv.writer 自动处理引号转义，BOM 让 Excel 识别 UTF-8）
    with open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(cn_headers)
        for obj in data:
            writer.writerow([flatten_value(obj.get(k, '')) for k in all_keys])

    print(f'  ✓ {json_file} → {csv_name}（{len(data)} 条，{len(all_keys)} 列）')


def main():
    # 确保 CSV 输出目录存在
    os.makedirs(CSV_DIR, exist_ok=True)

    # 获取命令行参数
    args = sys.argv[1:]
    all_json_files = sorted([f for f in os.listdir(JSON_DIR) if f.endswith('.json')])

    if args:
        print('📦 转换指定文件：')
        for name in args:
            json_file = name if name.endswith('.json') else name + '.json'
            json_path = os.path.join(JSON_DIR, json_file)
            if os.path.exists(json_path):
                json_to_csv(json_file)
            else:
                print(f'  ⚠ 找不到 {json_file}')
    else:
        print('📦 转换全部 JSON 文件：')
        for json_file in all_json_files:
            json_to_csv(json_file)

    print(f'✅ 完成！CSV 文件在 {CSV_DIR} 目录下，直接用 Excel 打开即可编辑。')


if __name__ == '__main__':
    main()