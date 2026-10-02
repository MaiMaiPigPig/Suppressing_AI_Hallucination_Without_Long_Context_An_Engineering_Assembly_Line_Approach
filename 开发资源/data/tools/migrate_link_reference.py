#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
迁移脚本参考：将引用表转换为自描述表达式映射

用法：
    python migrate_link_reference.py
输出：
    link_mapping.csv  —— 旧 link(id) → 新自描述表达式的映射表
    unknown_links.txt —— 未识别的 link 列表（如有）

注意：这是参考实现，开发可基于此重写或调整。
"""

import csv
import os

# 表名映射：引用表 source_table → 自描述表达式表名（复数）
TABLE_MAP = {
    'feats': 'feats',
    'spells': 'spells',
    'skills': 'skills',
    'tools': 'tools',
    'weapons': 'weapons',
    'armors': 'armors',
    'languages': 'languages',
    'packages': 'packages',
    'items': 'items',
    'monsters': 'monsters',
    'class_extra': 'class_extra',
    'spell_slot': 'spell_slot',
    'basic': '',           # 基础规则，无表名前缀
    'growup': 'growup',    # 范围选择，当前无引用表数据
}


def convert_link(row):
    """将引用表的一行转换为自描述表达式"""
    link_id = row['id']
    source_table = row['source_table']
    mode = row['mode']
    type_ = row['类型']
    target_id = row['target_id']
    count = row['数量']
    complex_logic = row.get('complex_logic', '') or ''

    table = TABLE_MAP.get(source_table, source_table)

    # type=id → 直接引用
    if type_ == 'id':
        if table:
            return f"{table}(id={target_id})"
        return f"id={target_id}"

    # type=type → 按类型筛选
    if type_ == 'type':
        if count and count != '0':
            return f"{table}(type={target_id})+{count}"
        return f"{table}(type={target_id})"

    # type=filter → 条件筛选
    if type_ == 'filter':
        # complex_logic 中逗号后可能缺空格，统一规范化
        normalized = complex_logic.replace(',', ', ')
        if count and count != '0':
            return f"{table}({normalized})+{count}"
        return f"{table}({normalized})"

    # type=choose → 手动列表选择
    if type_ == 'choose':
        # complex_logic 格式如 "21,22" 或 "27,29,30"
        return f"choose({table}({complex_logic}))+{count}"

    # type=special → 特殊操作
    if type_ == 'special':
        if complex_logic == 'all':
            return f"all({table})"
        if complex_logic == 'half-prof':
            return f"half-prof({table})"
        if complex_logic.startswith('proficiency>pure'):
            if '(' in complex_logic:
                # proficiency>pure(13,14,15,22,16,17)+1
                ids = complex_logic.split('(')[1].split(')')[0]
                return f"proficiency>pure({ids})+{count}"
            return f"proficiency>pure+{count}"
        if complex_logic.startswith('choose('):
            # choose(tool(type=66),tool(type=67)) → choose(tools(type=66),tools(type=67))
            expr = complex_logic.replace('tool(', 'tools(').replace('skill(', 'skills(')
            # 原始数据: choose(tool(type=66),tool(type=67))
            # 替换后:   choose(tools(type=66),tools(type=67))
            # 注意原始数据中参数间已有逗号，不需要额外处理
            if count and count != '0':
                return f"{expr}+{count}"
            return expr
        return complex_logic

    # type=spell_slot → 法术位
    if type_ == 'spell_slot':
        return f"spell_slot(lv={target_id})+{count}"

    # type=prerequisite → 前置条件
    if type_ == 'prerequisite':
        return f"prerequisite({complex_logic})"

    # type=rules → 裸规则表达式（直接输出 complex_logic）
    if type_ == 'rules':
        return complex_logic

    # type=rule → 规则模式（如 hp_per_lv+[N]）
    if type_ == 'rule':
        return complex_logic

    return f"UNKNOWN_TYPE({type_},{link_id})"


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    lookup_path = os.path.join(base_dir, 'csv导出', '引用表.csv')
    output_path = os.path.join(base_dir, 'tools', 'link_mapping.csv')
    unknown_path = os.path.join(base_dir, 'tools', 'unknown_links.txt')

    links = {}
    with open(lookup_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 处理 BOM 导致的列名问题
            row = {k.lstrip('\ufeff'): v for k, v in row.items()}
            links[row['id']] = row

    mapping = []
    unknown = []

    for link_id, row in links.items():
        expr = convert_link(row)
        if expr.startswith('UNKNOWN'):
            unknown.append(f"link({link_id}) → {expr}  |  row={row}")
        mapping.append({
            'id': link_id,
            'old': f"link({link_id})",
            'new': expr,
            'source_table': row['source_table'],
            'type': row['类型'],
            'detail': row.get('详情', '')
        })

    # 写入映射表
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'old', 'new', 'source_table', 'type', 'detail'])
        writer.writeheader()
        writer.writerows(mapping)

    # 写入未知项
    if unknown:
        with open(unknown_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(unknown))
        print(f"警告：发现 {len(unknown)} 个未识别的 link，见 {unknown_path}")
    else:
        print("全部识别成功，无未知项")

    print(f"映射表已生成：{output_path}（共 {len(mapping)} 条）")

    # 打印几个示例
    print("\n示例：")
    for link_id in ['1', '58', '103', '257', '296', '306', '506', '514', '310']:
        if link_id in links:
            print(f"  link({link_id}) → {convert_link(links[link_id])}")


if __name__ == '__main__':
    main()