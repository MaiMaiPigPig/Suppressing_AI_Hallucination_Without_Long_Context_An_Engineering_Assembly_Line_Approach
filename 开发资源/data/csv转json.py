"""
CSV 转 JSON 脚本
==================
功能：将 data/csv导出/ 目录下的所有 CSV 文件转换为 JSON 格式
输出：每个 CSV 文件对应一个 JSON 文件，保存到 data/json/ 目录

用法：双击运行或 python csv_to_json.py
"""

import csv
import json
import os
import sys
import re

# ============ 配置 ============
CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'csv导出')
# 注意：脚本在开发资源/data/ 下，但 JSON 需要输出到 TableChronicle/data/json/
JSON_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'TableChronicle', 'data', 'json')

# 需要跳过的文件（不转换）
SKIP_FILES = set()

# 映射表单独输出到开发资源目录（不混入正式项目数据）
MAPPING_JSON_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'json')

# 文件名映射（csv导出中的中文名 → json中的英文名）
NAME_MAP = {
    '专长': 'feats',
    '法术': 'spells',
    '职业': 'classes',
    '职业特性': 'class_features',
    '职业额外资源': 'class_extra',
    '种族': 'races',
    '种族特性': 'race_features',
    '背景': 'backgrounds',
    '技能': 'skills',
    '工具': 'tools',
    '护甲': 'armors',
    '武器': 'weapons',
    '武器特性': 'weapon_properties',
    '背包': 'items',
    '套装': 'packages',
    '套装详情': 'package_details',
    '魔法物品': 'magic_items',
    '怪物数据': 'monsters',
    '环位熟练': 'proficiency',
    '语言': 'languages',
    '阵营': 'alignments',
    '字典': 'dictionary',
    'dlc': 'dlc',
    '映射表': 'mapping',
    '子职': 'subclasses',
    '引用表': 'lookup_table',
    '法术字段映射': 'spell_field_mapping',
}

# 中文字段名 → 英文字段名映射
KEY_MAP = {
    # ===== 规则字段（检测核心） =====
    '车卡数据': 'rules',
    '骰娘互动': 'dice',
    '特性chain:': 'chain',
    '连锁': 'chain',
    'proficiency_type': 'proficiency_type',
    '选择': 'choice',
    '初始专长': 'feat',
    '技能': 'skills',
    '工匠熟练': 'tool',
    '武器熟练': 'weapon',
    '其他代码效果': 'code_effects',

    # ===== 名称类 =====
    '名字': 'name',
    '名称': 'name',
    '护甲': 'name',          # 护甲表的"护甲"列就是护甲名
    '物品名字': 'name',
    '中文名': 'name',
    '英文名': 'name_en',
    '英文': 'name_en',
    '阵营名称': 'name',

    # ===== 描述类 =====
    '详情': 'desc',
    '解释': 'desc',
    '描述': 'desc',
    '语言描述': 'desc',
    '内容': 'desc',

    # ===== 类型/分类类 =====
    '类型': 'type',
    '0/子职': 'subclass',
    '甲类型': 'armor',
    '简易/军用': 'weapon_category',
    '近战/远程': 'weapon_range',
    '珍稀级别': 'rarity',
    '主/次': 'type',

    # ===== 职业/等级类 =====
    '职业': 'class',
    '从属': 'subrace',
    '物种': 'species',
    '等级': 'level',
    '环位': 'level',
    '专长等级': 'feat_level',
    '子职等级': 'subclass_level',
    '主职特性': 'feature_levels',
    '是否施法者': 'spellcaster',

    # ===== 属性/数值类 =====
    '属性': 'attr',
    '重量': 'weight',
    '价格': 'cost',
    '钱（gp）': 'cost',
    '数量': 'count',
    '速度': 'speed',
    '生命骰': 'hit_dice',
    '升级生命值': 'hp_per_level',
    '先决': 'prerequisite',
    '代码': 'code',
    '套装id': 'suit_id',
    '包含': 'contains',
    '来源': 'source',
    '体型': 'size',
    '操作': 'operation',
    '制作': 'craft',
    '伤害骰': 'damage_dice',
    '伤害类型': 'damage_type',
    '词条': 'properties',
    '精通': 'mastery',
    '护甲等级（AC）': 'ac',
    '力量': 'strength',
    '隐匿': 'stealth',
    '学派': 'school',
    '施法时间': 'casting_time',
    '施法距离': 'range',
    '仪式': 'ritual',
    '施法成分_语言（V）': 'component_v',
    '姿势（S）': 'component_s',
    '材料（M）': 'component_m',
    '材料价值': 'material_cost',
    '是否消耗': 'consumed',
    '专注': 'concentration',
    '持续时间': 'duration',
    '强化': 'upcast',
    '效果/伤害类型': 'damage_type',
    # ===== 法术新字段（AI判定 + 目标表现） =====
    '目标类型': 'target_type',
    '目标尺寸': 'target_size',
    '目标尺寸2': 'target_size2',
    '目标数量': 'target_count',
    '豁免类型': 'save',
    '豁免成功': 'save_effect',
    '攻击检定': 'attack_roll',
    '效果类型': 'effect_type',
    'AI规则': 'ai_rule',
    '功能链接': 'link',
    '额外链接': 'link_extra',
    '1环': 'slot_1',
    '2环': 'slot_2',
    '3环': 'slot_3',
    '4环': 'slot_4',
    '5环': 'slot_5',
    '6环': 'slot_6',
    '7环': 'slot_7',
    '8环': 'slot_8',
    '9环': 'slot_9',
    '熟练价值': 'prof_bonus',
    '数值': 'value',
    '是否显示': 'visible',
    '数据': 'data',
    '喜好': 'preference',
    '主属性建议': 'primary_ability',
    '推荐属性': 'recommended_abilities',
    '豁免熟练': 'saving_throw_prof',
    '工具熟练': 'tool_prof',
    '技能熟练项': 'skill_prof',
    '物品选择(根据商品id选择)': 'item_choice',
    '武器': 'weapon',
    '甲': 'armor',
    '主': 'primary',

    # ===== 子职表字段 =====
    '子职ID': 'subclass_id',
    '职业ID': 'class_id',
    '子职描述': 'desc',
    '子职英文': 'name_en',

    # ===== 映射表字段 =====
    '类别': 'category',
    '表达式': 'expr',
    '含义': 'meaning',
    '示例': 'example',
}

# ===== 从外部文件加载法术字段映射 =====
# 法术字段映射表（csv导出/法术字段映射.csv）可编辑，运行时自动合并
SPELL_MAPPING_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'json', 'spell_field_mapping.json')
if os.path.exists(SPELL_MAPPING_FILE):
    try:
        with open(SPELL_MAPPING_FILE, 'r', encoding='utf-8') as f:
            spell_mappings = json.load(f)
        for item in spell_mappings:
            cn = item.get('中文列名', '').strip()
            en = item.get('英文键名', '').strip()
            if cn and en:
                KEY_MAP[cn] = en
        print(f'[加载] 法术字段映射: {len(spell_mappings)} 条')
    except Exception as e:
        print(f'[警告] 加载法术字段映射失败: {e}')

# ===== 字段值映射（将中文关键词映射为英文代码） =====
# 格式: 英文键名 → { 中文值原文: 英文代码 }
VALUE_MAP = {
    # ===== 护甲 =====
    'ac': {
        '敏捷调整值': 'AbilityModifiers(4)',
        '最大': 'max=',
        '（': '(',
        '）': ')',
    },
    'strength': {
        '力量': 'str',
        '—': '',
    },
    'stealth': {
        '劣势': 'disadvantage',
        '—': '',
    },
    # ===== 伤害类型（spells/weapons） =====
    'damage_type': {
        '火焰': 'fire',
        '钝击': 'bludgeoning',
        '穿刺': 'piercing',
        '挥砍': 'slashing',
        '心灵': 'psychic',
        '光耀': 'radiant',
        '暗蚀': 'necrotic',
        '冷冻': 'cold',
        '雷鸣': 'thunder',
        '强酸': 'acid',
        '闪电': 'lightning',
        '毒素': 'poison',
        '力场': 'force',
        '加血': 'healing',
        '减值': 'penalty',
        '寒冷': 'cold',
        '火焰/钝击': 'fire/bludgeoning',
        '雷鸣/强酸/闪电/钝击/寒冷': 'thunder/acid/lightning/bludgeoning/cold',
        '临时生命': 'temporary_hp',
        '治疗': 'healing',
        '跳跃': 'jump',
        '狂笑': 'hideous_laughter',
        '生命上限': 'max_hp',
        '速度+10尺': 'speed_+10ft',
        '加值/强酸、寒冷、火焰、闪电、雷鸣': 'bonus_acid_cold_fire_lightning_thunder',
        '生命/光耀': 'healing_radiant',
        '加值': 'bonus',
        '伤害减少': 'damage_reduction',
        '魅惑': 'charmed',
        '目盲': 'blinded',
        '命令': 'command',
        '造水/枯水': 'create_destroy_water',
        '云雾': 'fog',
        '类型由你选择：强酸,寒冷,火焰,闪电,毒素,心灵或雷鸣': 'choose_acid_cold_fire_lightning_poison_psychic_thunder',
        '多种（选：强酸/寒冷/火焰/闪电/毒素/雷鸣）': 'choose_acid_cold_fire_lightning_poison_thunder',
    },
    # ===== 技能属性（skills） =====
    'attr': {
        '力量': 'strength',
        '敏捷': 'dexterity',
        '体质': 'constitution',
        '智力': 'intelligence',
        '感知': 'wisdom',
        '魅力': 'charisma',
    },
    # ===== 法术学派（spells） =====
    'school': {
        '防护': 'abjuration',
        '咒法': 'conjuration',
        '预言': 'divination',
        '惑控': 'enchantment',
        '塑能': 'evocation',
        '幻术': 'illusion',
        '死灵': 'necromancy',
        '变化': 'transmutation',
        # 数据清洗：原CSV中部分行school列为法术名称
        '缓速': 'slow',
    },
    # ===== 强化（spells upcast） =====
    'upcast': {
        '等级:': 'level:',
        '等级：': 'level:',
        '环位：': 'level:',
        '环位:': 'level:',
        '升环：': 'level:',
        '升环:': 'level:',
        '环': '',
    },
    # ===== 骰娘互动（spells dice） =====
    'dice': {
        '目标': 'target',
        '环位': 'level',
        '时间：': 'duration:',
        '施法属性': 'spell_ability',
        '施法调整': 'spell_mod',
    },
    # ===== 专注（spells） =====
    'concentration': {
        '立即': 'instant',
        '是': 'yes',
        '否': 'no',
    },
    # ===== 职业熟练（proficiency） =====
    'class': {
        '吟游诗人': 'bard',
        '圣武士': 'paladin',
        '奥法骑士': 'eldritch_knight',
        '德鲁伊': 'druid',
        '战士': 'fighter',
        '术士': 'sorcerer',
        '武僧': 'monk',
        '法师': 'wizard',
        '游侠': 'ranger',
        '游荡者': 'rogue',
        '牧师': 'cleric',
        '诡术师': 'arcane_trickster',
        '野蛮人': 'barbarian',
        '魔契师': 'warlock',
    },
    'class_id': {
        '吟游诗人': 'bard',
        '圣武士': 'paladin',
        '奥法骑士': 'eldritch_knight',
        '德鲁伊': 'druid',
        '战士': 'fighter',
        '术士': 'sorcerer',
        '武僧': 'monk',
        '法师': 'wizard',
        '游侠': 'ranger',
        '游荡者': 'rogue',
        '牧师': 'cleric',
        '诡术师': 'arcane_trickster',
        '野蛮人': 'barbarian',
        '魔契师': 'warlock',
    },
    # ===== 熟练类型（proficiency） =====
    'type': {
        '偷袭': 'sneak_attack',
        '准备法术': 'spell_preparation',
        'rage伤害': 'rage_damage',
        '狂暴伤害': 'rage_damage',
        'rage': 'rage',
        '狂暴': 'rage',
        'wild_shape': 'wild_shape',
        '荒野变形': 'wild_shape',
        'bardic_inspiration': 'bardic_inspiration',
        '诗人骰': 'bardic_inspiration',
        'eldritch_invocations': 'eldritch_invocations',
        '魔能祈唤': 'eldritch_invocations',
        '魔能祈唤选项': '魔能祈唤选项',
        '战技选项': '战技选项',
        '超魔法选项': '超魔法选项',
        '猎杀技艺': '猎杀技艺',
        '防守战术': '防守战术',
        '追猎如风': '追猎如风',
        '刺客': '刺客',
        '专业渗透': '专业渗透',
        '无甲移动': 'unarmored_movement',
        '引导神力': 'channel_divinity',
        '宿敌': 'favored_enemy',
        '术法点': 'sorcery_points',
        '戏法': 'cantrip',
        '功力': 'ki',
        '回气': 'second_wind',
        '武器精通': 'weapon_mastery',
        '武艺骰': 'martial_arts_dice',
        '狂暴伤害': 'rage_damage',
    },
    # ===== 稀有度（magic_items） =====
    'rarity': {
        '普通': 'common',
        '非普通': 'uncommon',
        '稀有': 'rare',
        '极稀有': 'very_rare',
        '传说': 'legendary',
    },
    # ===== 专长来源（feats） =====
    'dlc': {
        '可重复': 'repeatable',
    },
    # ===== 规则表达式（class_features） =====
    'rules': {
        '不屈': 'indomitable',
        '战技': 'maneuver',
        '武器精通': 'weapon_mastery',
        '灵能骰': 'psychic_dice',
        '超魔法': 'metamagic',
    },
    # ===== 子职名称（class_features） =====
    'subclass': {
        '狂战士道途': 'path_of_the_berserker',
        '兽心道途': 'path_of_the_beast',
        '世界树道途': 'path_of_the_world_tree',
        '狂热者道途': 'path_of_the_zealot',
        '勇士': 'champion',
        '战斗大师': 'battle_master',
        '灵能武士': 'psi_warrior',
        '奥法骑士': 'eldritch_knight',
        '盗贼': 'thief',
        '刺客': 'assassin',
        '诡术师': 'arcane_trickster',
        '魂刃': 'soulknife',
        '生命领域': 'life_domain',
        '光明领域': 'light_domain',
        '战争领域': 'war_domain',
        '诡术领域': 'trickery_domain',
        '逸闻学院': 'college_of_lore',
        '勇气学院': 'college_of_valor',
        '舞蹈学院': 'college_of_dance',
        '魅心学院': 'college_of_glamour',
        '奉献之誓': 'oath_of_devotion',
        '古贤之誓': 'oath_of_the_ancients',
        '复仇之誓': 'oath_of_vengeance',
        '荣耀之誓': 'oath_of_glory',
        '猎人': 'hunter',
        '驯兽师': 'beast_master',
        '妖精漫游者': 'fey_wanderer',
        '幽域追猎者': 'gloom_stalker',
        '散打武者': 'way_of_the_open_hand',
        '暗影武者': 'way_of_shadow',
        '四象武者': 'way_of_the_four_elements',
        '命流武者': 'way_of_mercy',
        '大地结社': 'circle_of_the_land',
        '月亮结社': 'circle_of_the_moon',
        '星辰结社': 'circle_of_stars',
        '海洋结社': 'circle_of_the_sea',
        '畸变术法': 'aberrant_sorcery',
        '时械术法': 'clockwork_sorcery',
        '龙族术法': 'draconic_sorcery',
        '狂野术法': 'wild_magic_sorcery',
        '至高妖精宗主': 'archfey_patron',
        '天界宗主': 'celestial_patron',
        '邪魔宗主': 'fiend_patron',
        '旧日支配者宗主': 'great_old_one_patron',
        '防护师': 'school_of_abjuration',
        '预言师': 'school_of_divination',
        '塑能师': 'school_of_evocation',
        '幻术师': 'school_of_illusion',
    },
    # ===== 豁免类型（spells save：skill表ID） =====
    'save': {
        '力量豁免': 2,
        '敏捷豁免': 5,
        '体质豁免': 10,
        '智力豁免': 12,
        '感知豁免': 19,
        '魅力豁免': 26,
        '特殊': 'special',
        'special': 'special',
    },
}

# ============================================================
# ExpressionParser - 自描述表达式解析器
# ============================================================
# 用于解析、验证、标准化 10 种自描述表达式类型
# 替代旧的引用表 link(id) 机制

VALID_TABLES = {
    'feats', 'spells', 'classes', 'class_features', 'class_extra',
    'races', 'race_features', 'backgrounds', 'skills', 'tools',
    'armors', 'weapons', 'weapon_properties', 'items', 'packages',
    'package_details', 'magic_items', 'monsters',
    'proficiency', 'growup', 'languages', 'alignments', 'dictionary',
    'conditions', 'combat_actions', 'scenes', 'encounters',
    'subclasses', 'proficiency', 'basic',
}

class ExpressionParser:
    """自描述表达式解析器"""

    EXPR_TYPES = {
        'basic_ref': '基本引用',
        'filter': '多条件筛选',
        'choose': '手动列表选择',
        'range': '范围选择',
        'special': '特殊操作',
        'multi_choice': '多选一',
        'formula': '属性/数值运算',
        'prerequisite': '前置条件',
        'chain': '连锁引用',
        'code': '代码标记',
    }

    # 特殊操作关键词
    SPECIAL_KEYWORDS = {'all', 'proficiency>pure', 'half-prof', 'spell_slot'}

    @classmethod
    def parse(cls, expr):
        """
        解析自描述表达式
        :param expr: 字符串表达式
        :return: { type, table, conditions, count, success, message, ... }
        """
        if not expr or not isinstance(expr, str):
            return {'type': 'unknown', 'success': False, 'message': '空表达式'}
        expr = expr.strip()

        result = cls._parse_multi_choice(expr)
        if result['success']:
            return result

        result = cls._parse_code(expr)
        if result['success']:
            return result

        result = cls._parse_chain(expr)
        if result['success']:
            return result

        result = cls._parse_prerequisite(expr)
        if result['success']:
            return result

        result = cls._parse_special(expr)
        if result['success']:
            return result

        result = cls._parse_range(expr)
        if result['success']:
            return result

        result = cls._parse_choose(expr)
        if result['success']:
            return result

        result = cls._parse_basic_ref(expr)
        if result['success']:
            return result

        result = cls._parse_formula(expr)
        if result['success']:
            return result

        result = cls._parse_filter(expr)
        if result['success']:
            return result

        return {'type': 'unknown', 'success': False, 'message': f'无法解析: {expr}', 'raw': expr}

    @classmethod
    def _parse_multi_choice(cls, expr):
        """解析多选一: [1]exprA,[2]exprB 或 ①exprA,②exprB"""
        # 先尝试 [1]...[2]... 格式
        m = re.match(r'^\[1\](.+?)(?:,\[2\](.+?))?(?:,\[3\](.+?))?(?:,\[4\](.+?))?$', expr)
        if not m:
            return {'type': 'multi_choice', 'success': False}
        options = [g for g in m.groups() if g]
        parsed_options = [cls.parse(opt) for opt in options]
        return {
            'type': 'multi_choice',
            'success': True,
            'options': parsed_options,
            'option_count': len(options),
        }

    @classmethod
    def _parse_code(cls, expr):
        """解析代码标记: code(choose), code(二选一)"""
        m = re.match(r'^code\s*\((.+?)\)\s*$', expr)
        if not m:
            return {'type': 'code', 'success': False}
        return {'type': 'code', 'success': True, 'tag': m.group(1).strip()}

    @classmethod
    def _parse_chain(cls, expr):
        """解析连锁引用: chain:54"""
        m = re.match(r'^chain\s*:\s*(\d+)\s*$', expr)
        if not m:
            return {'type': 'chain', 'success': False}
        return {'type': 'chain', 'success': True, 'feature_id': int(m.group(1))}

    @classmethod
    def _parse_prerequisite(cls, expr):
        """解析前置条件: prerequisite(lv>=4), prerequisite(ability(1)>=13)"""
        m = re.match(r'^prerequisite\s*\((.+?)\)\s*$', expr)
        if not m:
            return {'type': 'prerequisite', 'success': False}
        cond = m.group(1).strip()
        return {'type': 'prerequisite', 'success': True, 'condition': cond}

    @classmethod
    def _parse_special(cls, expr):
        """解析特殊操作: all(skills), proficiency>pure+2, half-prof(skills), spell_slot(lv=1)+1"""
        # all(table)
        m = re.match(r'^all\s*\((\w+)\)\s*$', expr)
        if m:
            return {'type': 'special', 'success': True, 'operation': 'all', 'table': m.group(1)}

        # proficiency>pure[+N]
        m = re.match(r'^proficiency\s*>\s*pure(\+(\d+))?\s*$', expr)
        if m:
            cnt = int(m.group(2)) if m.group(2) else 1
            return {'type': 'special', 'success': True, 'operation': 'proficiency>pure', 'count': cnt}

        # half-prof(table/list)
        m = re.match(r'^half-prof\s*\((.+?)\)\s*$', expr)
        if m:
            return {'type': 'special', 'success': True, 'operation': 'half-prof', 'tables': m.group(1)}

        # spell_slot(lv=N)+M
        m = re.match(r'^spell_slot\s*\(lv\s*=\s*(\d+)\)\s*\+(\d+)\s*$', expr)
        if m:
            return {'type': 'special', 'success': True, 'operation': 'spell_slot', 'level': int(m.group(1)), 'count': int(m.group(2))}

        return {'type': 'special', 'success': False}

    @classmethod
    def _parse_range(cls, expr):
        """解析范围选择: growup(303→322)"""
        m = re.match(r'^(\w+)\s*\(\s*(\d+)\s*(?:→|->|\.\.|-)\s*(\d+)\s*\)\s*$', expr)
        if not m:
            return {'type': 'range', 'success': False}
        return {
            'type': 'range', 'success': True,
            'table': m.group(1), 'start': int(m.group(2)), 'end': int(m.group(3)),
        }

    @classmethod
    def _parse_choose(cls, expr):
        """
        解析手动列表选择: choose(skills(21,22))+1, choose(tools(type=66),tools(type=67))+1
        注意：choose() 内部可能嵌套复数个表达式片段
        """
        # 先提取数量后缀 +N
        count = 1
        m_count = re.match(r'^choose\s*\((.+)\)\s*\+(\d+)\s*$', expr)
        if m_count:
            inner = m_count.group(1)
            count = int(m_count.group(2))
        else:
            m = re.match(r'^choose\s*\((.+)\)\s*$', expr)
            if not m:
                return {'type': 'choose', 'success': False}
            inner = m.group(1)

        # 解析内部的选择项（逗号分隔，注意可能嵌套括号）
        items = cls._split_top_level(inner)
        return {
            'type': 'choose', 'success': True,
            'items': items, 'count': count,
        }

    @classmethod
    def _parse_filter(cls, expr):
        """
        解析多条件筛选: spells(class=4,lv=0)+2, feats(type=44)+1
        """
        m = re.match(
            r'^(\w+)\s*\((.+?)\)\s*(\+(\d+))?\s*$',
            expr
        )
        if not m:
            return {'type': 'filter', 'success': False}
        table = m.group(1)
        cond_str = m.group(2)
        count = int(m.group(4)) if m.group(4) else 1

        conditions = cls._parse_conditions(cond_str)
        if not conditions:
            return {'type': 'filter', 'success': False}
        return {
            'type': 'filter', 'success': True,
            'table': table, 'conditions': conditions, 'count': count,
        }

    @classmethod
    def _parse_basic_ref(cls, expr):
        """解析基本引用: feats(id=5), spells(id=56), weapons(type=63)"""
        m = re.match(
            r'^(\w+)\s*\(((?:id|name|type)\s*=\s*[^,)]+(?:,\s*(?:id|name|type)\s*=\s*[^,)]+)*)\)\s*$',
            expr
        )
        if not m:
            return {'type': 'basic_ref', 'success': False}
        table = m.group(1)
        cond_str = m.group(2)
        conditions = cls._parse_conditions(cond_str)
        return {
            'type': 'basic_ref', 'success': True,
            'table': table, 'conditions': conditions, 'count': 1,
        }

    @classmethod
    def _parse_formula(cls, expr):
        """解析公式类: AbilityModifiers(N), lv:class(N), Proficiency, 1d10+lv:class(5)"""
        formulas = [
            (r'^AbilityModifiers\s*\((\d+)\)\s*$', 'ability_modifier'),
            (r'^lv\s*:\s*class\s*\((\d+)\)\s*→\s*↓\s*$', 'half_class_level_down'),
            (r'^lv\s*:\s*class\s*\((\d+)\)\s*$', 'class_level'),
            (r'^Proficiency\s*$', 'proficiency_bonus'),
            (r'^speed\s*\+\s*(\d+)\s*$', 'speed_bonus'),
            (r'^hp_per_lv\s*\+\s*(\d+)\s*$', 'hp_per_level'),
            (r'^Character\s*\((.+?)\)\s*$', 'character_resource'),
        ]
        for pattern, ftype in formulas:
            m = re.match(pattern, expr)
            if m:
                result = {'type': 'formula', 'success': True, 'formula_type': ftype}
                groups = m.groups()
                if groups:
                    result['params'] = groups
                return result
        return {'type': 'formula', 'success': False}

    @classmethod
    def _parse_conditions(cls, cond_str):
        """解析条件字符串: class=4,lv=0,school=7 → [{key: class, value: 4}, ...]"""
        conditions = []
        parts = cls._split_top_level(cond_str)
        for part in parts:
            part = part.strip()
            m = re.match(r'^(\w+)\s*=\s*(.+)$', part)
            if m:
                key = m.group(1).strip()
                val_str = m.group(2).strip()
                vals = [v.strip() for v in val_str.split(',')]
                conditions.append({'key': key, 'values': vals})
        return conditions

    @classmethod
    def _split_top_level(cls, s):
        """按顶层逗号分割，忽略括号内的逗号"""
        parts = []
        depth = 0
        current = ''
        for ch in s:
            if ch == '(':
                depth += 1
                current += ch
            elif ch == ')':
                depth -= 1
                current += ch
            elif ch == ',' and depth == 0:
                parts.append(current)
                current = ''
            else:
                current += ch
        if current:
            parts.append(current)
        return parts

    @classmethod
    def validate(cls, expr):
        """验证表达式是否合法"""
        result = cls.parse(expr)
        return result['success']

    @classmethod
    def extract_table_names(cls, expr):
        """提取表达式中引用的所有表名"""
        result = cls.parse(expr)
        tables = set()
        if result.get('table'):
            tables.add(result['table'])
        if result.get('type') == 'multi_choice':
            for opt in result.get('options', []):
                tables.update(cls.extract_from_result(opt))
        return tables

    @classmethod
    def extract_from_result(cls, parsed):
        """从已解析结果递归提取表名"""
        tables = set()
        t = parsed.get('table')
        if t:
            tables.add(t)
        if parsed.get('type') == 'choose':
            for item in parsed.get('items', []):
                sub = cls.parse(item)
                if sub.get('table'):
                    tables.add(sub['table'])
        return tables


# ===== 文件特定字段映射（覆盖全局 KEY_MAP） =====
# 格式: 文件名(不含扩展名) → { CSV列名: JSON键名 }
# 用于同一CSV列名在不同文件中映射到不同JSON键名的情况
FILE_KEY_MAP = {
    '环位熟练': {
        '职业': 'class_id',
    },
    '子职': {
        '职业': 'class_id',
    },
}

# ===== 文件特定默认值 =====
# 格式: 文件名(不含扩展名) → { JSON键名: 默认值 }
# 当CSV中缺少某列时，自动填充默认值
FILE_DEFAULT_VALUES = {
    '环位熟练': {
        'subclass_id': 0,
    },
}

# ===== 字段拆分器（将中英混合值拆为数值+单位两个字段） =====
# 格式: 英文键名 → { 解析函数 }
# 解析函数接受 (原始值字符串) → (数值, 单位代码)
# 返回 None 表示不拆分（保持原值）

def parse_weight(value):
    """解析重量字段，如 '10磅' → (10, 'lb')"""
    if not value or value in ('—', '-', 'null', ''):
        return None, ''  # 已解析为空
    value = value.strip()
    # '半磅' → 0.5 lb
    if value == '半磅':
        return 0.5, 'lb'
    # 纯数字（无单位）
    import re
    m = re.match(r'^([\d.]+)$', value)
    if m:
        num = float(m.group(1)) if '.' in m.group(1) else int(m.group(1))
        return num, ''
    # '5磅（满）' → 5 lb
    m = re.match(r'^([\d.]+)\s*磅(?:\s*[（(]\s*(.*?)\s*[）)])?\s*$', value)
    if m:
        num = float(m.group(1)) if '.' in m.group(1) else int(m.group(1))
        return num, 'lb'
    # '1/4磅' → 0.25 lb
    m = re.match(r'^(\d+)/(\d+)\s*磅\s*$', value)
    if m:
        return float(m.group(1)) / float(m.group(2)), 'lb'
    return None, None  # 解析失败


def parse_casting_time(value):
    """解析施法时间，如 '1分钟' → (1, 'minute')，'动作' → (None, 'action')"""
    if not value:
        return None, ''
    value = value.strip()
    import re
    
    # 纯中文关键词
    keywords = {
        '动作': (None, 'action'),
        '附赠动作': (None, 'bonus_action'),
        '反应': (None, 'reaction'),
        '1反应': (1, 'reaction'),
        '动作或仪式': (None, 'action_or_ritual'),
        '附赠动作（命中后）': (None, 'bonus_action_after_hit'),
        '附赠': (None, 'bonus_action'),
        '1分钟或仪式': (1, 'minute_or_ritual'),
        '随即': (None, 'random'),
        '特殊': (None, 'special'),
    }
    if value in keywords:
        return keywords[value]
    
    # 数字+单位
    m = re.match(r'^(\d+)\s*(分钟|小时|反应|轮|回合|天|年)\s*$', value)
    if m:
        num = int(m.group(1))
        unit_map = {'分钟': 'minute', '小时': 'hour', '反应': 'reaction', '轮': 'round', '回合': 'round', '天': 'day', '年': 'year'}
        return num, unit_map[m.group(2)]
    
    # 中文数字 "一" 开头
    m = re.match(r'^一\s*(分钟|小时|轮|回合|天)\s*$', value)
    if m:
        unit_map = {'分钟': 'minute', '小时': 'hour', '轮': 'round', '回合': 'round', '天': 'day'}
        return 1, unit_map[m.group(1)]
    
    return None, None  # 解析失败


def parse_range(value):
    """解析法术距离，如 '60尺' → (60, 'feet')，'自身' → (None, 'self')"""
    if not value:
        return None, ''
    value = value.strip()
    import re
    
    keywords = {
        '自身': (None, 'self'),
        '触碰': (None, 'touch'),
        '无限': (None, 'unlimited'),
        '特殊': (None, 'special'),
        '视线': (None, 'line_of_sight'),
        '视野': (None, 'sight'),
        '非本人': (None, 'other'),
    }
    if value in keywords:
        return keywords[value]
    
    # 数字+尺（注意：原文可能有空格，如 "60 尺"）
    m = re.match(r'^(\d+)\s*尺\s*$', value.replace(' ', ''))
    if m:
        return int(m.group(1)), 'feet'
    
    # 数字+里/英里
    m = re.match(r'^(\d+)\s*(里|英里)\s*$', value)
    if m:
        return int(m.group(1)), 'mile'
    
    # 中文数字 "一" 开头
    m = re.match(r'^一\s*(里|英里)\s*$', value)
    if m:
        return 1, 'mile'
    
    # 自身（半径 N 尺）→ 复杂格式，保持原值
    if '半径' in value or '范围' in value:
        return None, None
    
    return None, None  # 解析失败


def parse_duration(value):
    """解析持续时间，如 '1小时' → (1, 'hour')，'立即' → (None, 'instant')"""
    if not value:
        return None, ''
    value = value.strip()
    import re
    
    keywords = {
        '立即': (None, 'instant'),
        '直至解除': (None, 'until_dispelled'),
        '直至被消耗': (None, 'until_consumed'),
        '永久': (None, 'permanent'),
        '特殊': (None, 'special'),
        '至多': (None, 'at_most'),
    }
    if value in keywords:
        return keywords[value]
    
    # 至多N分钟/小时
    m = re.match(r'^至多\s*(\d+)\s*(分钟|小时|轮|回合|天)\s*$', value)
    if m:
        num = int(m.group(1))
        unit_map = {'分钟': 'minute', '小时': 'hour', '轮': 'round', '回合': 'round', '天': 'day'}
        return num, unit_map[m.group(2)]
    
    # 数字d数字+数字回合
    m = re.match(r'^(\d+d\d+\+?\d*)\s*(回合|轮)\s*$', value)
    if m:
        return m.group(1), 'round'
    
    # 数字+单位
    m = re.match(r'^(\d+)\s*(分钟|小时|轮|回合|天|年|日)\s*$', value)
    if m:
        num = int(m.group(1))
        unit_map = {'分钟': 'minute', '小时': 'hour', '轮': 'round', '回合': 'round', '天': 'day', '年': 'year', '日': 'day'}
        return num, unit_map[m.group(2)]
    
    # 中文数字 "一" 开头
    m = re.match(r'^一\s*(分钟|小时|轮|回合|天|日)\s*$', value)
    if m:
        unit_map = {'分钟': 'minute', '小时': 'hour', '轮': 'round', '回合': 'round', '天': 'day', '日': 'day'}
        return 1, unit_map[m.group(1)]
    
    # 直到/直至被解除/触发
    for phrase in ['直到被解除', '直至被解除', '直到被解除或触发', '直至被解除或触发']:
        if value == phrase:
            return None, 'until_dispelled'
    
    # 7日, 30日 等
    m = re.match(r'^(\d+)\s*日\s*$', value)
    if m:
        return int(m.group(1)), 'day'
    
    return None, None  # 解析失败


def parse_value(value):
    """解析熟练数值，如 '+10尺' → (10, 'feet')，纯数字保持原样"""
    if not value:
        return None, ''
    value = value.strip()
    import re
    
    # +数字尺
    m = re.match(r'^\+(\d+)\s*尺\s*$', value)
    if m:
        return int(m.group(1)), 'feet'
    
    # 纯数字
    try:
        return int(value), ''
    except ValueError:
        pass
    
    return None, ''


# 字段拆分器配置：字段名 → 解析函数
# 解析函数返回 (数值, 单位代码)，如果返回 (None, '') 则保持原值
FIELD_SPLITTERS = {
    'weight': parse_weight,
    'casting_time': parse_casting_time,
    'range': parse_range,
    'duration': parse_duration,
    'value': parse_value,
}


def parse_name(value):
    """
    解析中英混合的名称，如 '布甲Padded Armor' → ('布甲', 'Padded Armor')
    返回: (name, name_en) 元组
    - 中英混合 → (中文部分, 英文部分)
    - 纯中文 → (原值, '')
    - 纯英文 → ('', 原值)
    - 空/无效 → (None, None) 表示不拆分
    """
    if not value or not isinstance(value, str):
        return None, None
    value = value.strip()
    if not value:
        return None, None

    has_chinese = bool(re.search(r'[\u4e00-\u9fff（）]', value))
    has_english = bool(re.search(r'[A-Za-z]', value))

    # 只有中文或只有英文，不拆分
    if not has_chinese or not has_english:
        return None, None

    # 格式：中文开头 + 英文结尾（如 "布甲Padded Armor"）
    m = re.match(r'^([\u4e00-\u9fff（）]+)\s*([A-Za-z0-9].*)$', value)
    if m:
        return m.group(1).strip(), m.group(2).strip()

    # 备用：中文开头 + 空格 + 英文
    m = re.match(r'^([\u4e00-\u9fff（）\s]+?)\s+([A-Za-z].*)$', value)
    if m:
        return m.group(1).strip(), m.group(2).strip()

    return None, None


def apply_value_map(mapped_key, value):
    """
    对字段值进行中→英映射替换。
    例如 damage_type="火焰" → "fire"
    
    匹配策略：
    1. 先尝试精确匹配（避免"魔能祈唤"误匹配"魔能祈唤选项"）
    2. 无精确匹配时，回退到子串替换（用于复合值如"火焰/钝击"）
    """
    if not isinstance(value, str) or value == '':
        return value
    
    mapper = VALUE_MAP.get(mapped_key)
    if not mapper:
        return value
    
    # 策略1：精确匹配
    if value in mapper:
        return mapper[value]
    
    # 策略2：子串替换（用于复合值，如"火焰/钝击"）
    result = value
    for chinese_text, english_text in sorted(mapper.items(), key=lambda x: len(x[0]), reverse=True):
        if chinese_text in result:
            result = result.replace(chinese_text, english_text)
    return result


def apply_field_splitter(mapped_key, value):
    """
    对字段值进行拆分，将中英混合值拆为数值+单位两个字段。
    返回: (主字段值, 单位字段值) 的元组
    如果不需要拆分，返回 (value, None)
    """
    if not isinstance(value, str) or value == '':
        return value, None
    
    splitter = FIELD_SPLITTERS.get(mapped_key)
    if not splitter:
        return value, None
    
    num_val, unit_val = splitter(value)
    # 解析器返回 (None, '') 表示"已解析为空"（如 null/—等占位符）
    if num_val is None and unit_val == '':
        return None, ''
    # 解析器返回 (None, None) 表示"解析失败，保持原值"
    if num_val is None and unit_val is None:
        return value, None
    
    return num_val, unit_val


def parse_csv_lines(raw):
    """
    手动解析 CSV 文本，支持多行引号字段。
    返回: 解析后的行列表（每行是一个字段列表）
    """
    lines = raw.split('\n')
    all_rows = []
    current_row = []
    current_field = ''
    in_quotes = False

    for line in lines:
        line = line.rstrip('\r')
        chars = list(line)

        i = 0
        while i < len(chars):
            c = chars[i]

            if c == '"':
                if in_quotes and i + 1 < len(chars) and chars[i + 1] == '"':
                    # 转义引号 ""
                    current_field += '"'
                    i += 2
                    continue
                else:
                    in_quotes = not in_quotes
                    i += 1
                    continue
            elif c == ',' and not in_quotes:
                current_row.append(current_field)
                current_field = ''
                i += 1
                continue
            else:
                current_field += c
                i += 1

        if in_quotes:
            # 引号未闭合，说明字段跨行
            current_field += '\n'
        else:
            # 行结束
            current_row.append(current_field)
            current_field = ''
            all_rows.append(current_row)
            current_row = []

    return all_rows


def read_csv_file(filepath):
    """
    读取 CSV 文件，支持多行引号字段。
    特殊处理：合并两行表头（如法术表的施法成分子表头）
    返回: (headers, rows) 其中 rows 是字典列表
    """
    # 先用 utf-8-sig 读取（自动去除 BOM），再以 utf-8 回退
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        raw = f.read()

    # 双重保险：如果 BOM 还在则手动去除
    if len(raw) > 0 and raw[0] == '\ufeff':
        raw = raw[1:]

    # 去除末尾空白
    raw = raw.rstrip()

    # 解析 CSV
    all_rows = parse_csv_lines(raw)

    if not all_rows:
        return [], []

    # 第一行是表头
    headers = all_rows[0]
    # 清理表头中的不可见字符（如 BOM 残留）
    headers = [re.sub(r'^[\ufeff\x00-\x1f\x7f-\x9f]+', '', h) for h in headers]

    # 从第二行开始处理
    data_rows = all_rows[1:]
    if not data_rows:
        return headers, []

    # 检查第二行是否是子表头
    has_sub = False
    for idx, val in enumerate(data_rows[0]):
        if idx < len(headers) and headers[idx].strip() == '' and val.strip() != '':
            has_sub = True
            break

    if has_sub:
        # 合并子表头到主表头
        sub_row = data_rows[0]
        for idx, val in enumerate(sub_row):
            if idx < len(headers):
                main_h = headers[idx].strip()
                sub_h = val.strip()
                if main_h == '' and sub_h != '':
                    headers[idx] = sub_h
                elif main_h != '' and sub_h != '':
                    headers[idx] = f'{main_h}_{sub_h}'
        # 跳过子表头行
        data_rows = data_rows[1:]

    # 将数据行转为字典
    rows = []
    for row in data_rows:
        # 补全长度
        while len(row) < len(headers):
            row.append('')

        row_dict = {}
        for idx, h in enumerate(headers):
            row_dict[h] = row[idx] if idx < len(row) else ''

        # 过滤掉全空行
        if any(v.strip() != '' for v in row_dict.values()):
            rows.append(row_dict)

    return headers, rows


def convert_value(value, header):
    """
    尝试将字段值转换为合适的类型：
    - 纯数字字符串 → int/float
    - 空字符串 → 保留为空字符串
    - 否则保留字符串
    - 如果已经是数字类型，直接返回
    """
    if value is None:
        return None

    # 如果已经是数字类型，直接返回
    if isinstance(value, (int, float)):
        return value

    value = value.strip()

    if value == '':
        return ''

    # 尝试转为数字
    try:
        if '.' in value:
            return float(value)
        else:
            return int(value)
    except (ValueError, TypeError):
        pass

    return value


def csv_to_json(csv_path, json_path, filename):
    """将单个 CSV 文件转换为 JSON"""
    try:
        headers, rows = read_csv_file(csv_path)
    except Exception as e:
        print(f'  ✗ 读取失败: {e}')
        return False

    if not headers:
        print(f'  ⚠ 文件为空或无有效数据')
        return False

    # 过滤掉空列名的列
    valid_headers = [h for h in headers if h.strip() != '']

    # 获取文件名（不含扩展名），用于文件特定映射
    base_name = os.path.splitext(filename)[0]
    file_key_overrides = FILE_KEY_MAP.get(base_name, {})
    file_defaults = FILE_DEFAULT_VALUES.get(base_name, {})

    # 将每一行转为字典（自动类型转换 + 键名映射）
    result = []
    for row in rows:
        converted = {}
        # 先处理文件特定默认值
        for key, default_val in file_defaults.items():
            converted[key] = default_val

        for h in valid_headers:
            h_clean = h.strip()
            # 应用中文字段名 → 英文字段名映射（先全局映射，再文件特定覆盖）
            if h_clean in file_key_overrides:
                mapped_key = file_key_overrides[h_clean]
            else:
                mapped_key = KEY_MAP.get(h_clean, h_clean)
            raw_value = row.get(h, '')
            # 应用字段值映射（中文值 → 英文/代码值）
            mapped_value = apply_value_map(mapped_key, raw_value)
            # 应用字段拆分器（将中英混合值拆为数值+单位两个字段）
            split_val, unit_val = apply_field_splitter(mapped_key, mapped_value)
            # 应用名称拆分器（将中英混合名拆为 name + name_en）
            if mapped_key == 'name':
                cn_name, en_name = parse_name(split_val)
                if cn_name is not None:
                    converted['name'] = convert_value(cn_name, h_clean)
                    converted['name_en'] = convert_value(en_name, h_clean) if en_name else ''
                else:
                    converted[mapped_key] = convert_value(split_val, h_clean)
            else:
                converted[mapped_key] = convert_value(split_val, h_clean)
            if unit_val is not None:
                converted[mapped_key + '_unit'] = unit_val
        result.append(converted)

    # ===== 自描述表达式校验（只报告，不拦截，不改变数据） =====
    expr_ok = 0
    expr_unknown = 0
    for row in result:
        rules_val = row.get('rules', '')
        if not rules_val or not isinstance(rules_val, str) or not rules_val.strip():
            continue
        parsed = ExpressionParser.parse(rules_val.strip())
        if parsed['success']:
            expr_ok += 1
        else:
            expr_unknown += 1
            item_id = row.get('id', '?')
            print(f'    [表达式未知] id={item_id}: {rules_val[:100]}')
    if expr_ok or expr_unknown:
        print(f'    [表达式校验] 已识别: {expr_ok}, 未知格式: {expr_unknown}（可能是旧link()或复合公式）')

    # 写入 JSON
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f'  ✓ {len(result)} 条 → {os.path.basename(json_path)}')
    return True


def main():
    print('=' * 60)
    print('  CSV → JSON 转换工具')
    print('=' * 60)
    print()

    # 检查目录
    if not os.path.exists(CSV_DIR):
        print(f'错误：找不到目录 {CSV_DIR}')
        print('请确保脚本位于 data/ 目录下，且 csv导出/ 子目录存在')
        sys.exit(1)

    # 获取所有 CSV 文件
    csv_files = [f for f in os.listdir(CSV_DIR)
                 if f.endswith('.csv') and f not in SKIP_FILES]
    csv_files.sort()

    if not csv_files:
        print(f'在 {CSV_DIR} 中未找到 CSV 文件')
        sys.exit(0)

    print(f'源目录: {CSV_DIR}')
    print(f'目标目录: {JSON_DIR}')
    print(f'找到 {len(csv_files)} 个 CSV 文件')
    print()

    # 创建输出目录
    os.makedirs(JSON_DIR, exist_ok=True)
    os.makedirs(MAPPING_JSON_DIR, exist_ok=True)

    # 转换每个文件
    success_count = 0
    for csv_file in csv_files:
        csv_path = os.path.join(CSV_DIR, csv_file)
        base_name = os.path.splitext(csv_file)[0]

        # 确定输出文件名和路径
        if base_name == '映射表':
            # 映射表单独输出到开发资源目录
            json_name = 'mapping'
            json_path = os.path.join(MAPPING_JSON_DIR, f'{json_name}.json')
        else:
            # 其他文件正常输出到正式项目目录
            json_name = NAME_MAP.get(base_name, base_name)
            json_path = os.path.join(JSON_DIR, f'{json_name}.json')

        print(f'处理: {csv_file} → {os.path.relpath(json_path, os.path.dirname(CSV_DIR))}')

        if csv_to_json(csv_path, json_path, csv_file):
            success_count += 1

    print()
    print('=' * 60)
    print(f'  完成！{success_count}/{len(csv_files)} 个文件转换成功')
    print(f'  JSON 文件保存在: {JSON_DIR}')
    print('=' * 60)

    # 列出生成的 JSON 文件（正式项目目录）
    json_files = sorted([f for f in os.listdir(JSON_DIR) if f.endswith('.json')])
    if json_files:
        print()
        print('正式项目 JSON 文件:')
        for jf in json_files:
            jp = os.path.join(JSON_DIR, jf)
            size = os.path.getsize(jp)
            print(f'  • {jf} ({size:,} bytes)')

    # 列出生成的 JSON 文件（开发资源目录）
    dev_json_files = sorted([f for f in os.listdir(MAPPING_JSON_DIR) if f.endswith('.json')])
    if dev_json_files:
        print()
        print('开发资源 JSON 文件:')
        for jf in dev_json_files:
            jp = os.path.join(MAPPING_JSON_DIR, jf)
            size = os.path.getsize(jp)
            print(f'  • {jf} ({size:,} bytes)')


if __name__ == '__main__':
    main()