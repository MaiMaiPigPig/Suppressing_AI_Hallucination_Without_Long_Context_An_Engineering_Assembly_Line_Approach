#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量替换 CSV 中的 link(id) 为自描述表达式

用法：
    python replace_links.py

安全机制：
    1. 处理前自动备份原文件到 .bak
    2. 写入前验证 fieldnames 与行数据键一致
    3. 写入后验证输出文件行数 >= 输入行数
    4. 任何异常自动回滚

注意：直接修改源 CSV 文件，执行前请备份。
"""

import csv
import re
import os
import shutil


def load_mapping(mapping_path):
    """加载 link(id) → 新表达式的映射表"""
    mapping = {}
    with open(mapping_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row = {k.lstrip('\ufeff'): v for k, v in row.items()}
            mapping[row['old']] = row['new']
    return mapping


def replace_links_in_text(text, mapping):
    """替换文本中的所有 link(id)"""
    if not text:
        return text

    pattern = re.compile(r'link\((\d+)\)')

    def replacer(match):
        link_id = match.group(1)
        old_expr = f"link({link_id})"
        new_expr = mapping.get(old_expr)
        if new_expr is None:
            print(f"  警告：未找到 link({link_id}) 的映射，保留原样")
            return old_expr
        return new_expr

    return pattern.sub(replacer, text)


def strip_bom(obj):
    """递归清理字符串中的 BOM 字符"""
    if isinstance(obj, str):
        return obj.lstrip('\ufeff')
    if isinstance(obj, dict):
        return {strip_bom(k): strip_bom(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [strip_bom(item) for item in obj]
    return obj


def process_csv(filepath, mapping):
    """处理单个 CSV 文件，带安全保护"""
    # 1. 备份
    backup_path = filepath + '.bak'
    shutil.copy2(filepath, backup_path)

    # 2. 读取
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        raw_fieldnames = reader.fieldnames
        # 统一清理 BOM
        fieldnames = [fn.lstrip('\ufeff') for fn in raw_fieldnames]
        rows = []
        for row in reader:
            clean_row = {k.lstrip('\ufeff'): v for k, v in row.items()}
            rows.append(clean_row)

    input_row_count = len(rows)
    changed = 0

    # 3. 替换
    for row in rows:
        for key in row:
            if row[key]:
                new_val = replace_links_in_text(row[key], mapping)
                if new_val != row[key]:
                    row[key] = new_val
                    changed += 1

    # 4. 安全验证：确保所有行的键都在 fieldnames 中
    for i, row in enumerate(rows):
        extra_keys = set(row.keys()) - set(fieldnames)
        if extra_keys:
            raise ValueError(
                f"行 {i} 包含 fieldnames 中没有的键: {extra_keys}. "
                f"fieldnames={fieldnames}, row_keys={list(row.keys())}"
            )

    # 5. 写入临时文件
    temp_path = filepath + '.tmp'
    with open(temp_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # 6. 验证：输出文件行数 >= 输入行数 + 1（表头）
    with open(temp_path, 'r', encoding='utf-8') as f:
        output_lines = sum(1 for _ in f)
    expected_min = input_row_count + 1  # +1 for header
    if output_lines < expected_min:
        os.remove(temp_path)
        raise RuntimeError(
            f"输出文件行数异常: {output_lines} < {expected_min} (输入{input_row_count}行+表头). "
            f"已回滚，原文件在 {backup_path}"
        )

    # 7. 替换原文件
    os.replace(temp_path, filepath)
    # 清理备份（成功后才清理，如需保留可注释掉）
    # os.remove(backup_path)

    return changed


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mapping_path = os.path.join(base_dir, 'tools', 'link_mapping.csv')

    files = [
        'csv导出/职业特性.csv',
        'csv导出/种族特性.csv',
        'csv导出/背景.csv',
        'csv导出/专长.csv',
        'csv导出/职业.csv',
        'csv导出/职业额外资源.csv',
    ]

    mapping = load_mapping(mapping_path)
    print(f"已加载映射表：{len(mapping)} 条")

    total_changed = 0
    for rel_path in files:
        filepath = os.path.join(base_dir, rel_path)
        if not os.path.exists(filepath):
            print(f"跳过（不存在）：{rel_path}")
            continue
        try:
            changed = process_csv(filepath, mapping)
            total_changed += changed
            print(f"  ✓ {rel_path}: 修改了 {changed} 个单元格")
        except Exception as e:
            print(f"  ✗ {rel_path}: 失败 - {e}")

    print(f"\n总计修改：{total_changed} 个单元格")


if __name__ == '__main__':
    main()