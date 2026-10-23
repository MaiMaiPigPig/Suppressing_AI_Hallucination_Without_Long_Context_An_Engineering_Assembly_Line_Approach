import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(BASE, 'data', 'json')

# 1. 建立映射: name_en → id
with open(os.path.join(JSON_DIR, 'subclasses.json'), 'r', encoding='utf-8') as f:
    subclasses = json.load(f)

name_to_id = {}
for sc in subclasses:
    name_to_id[sc['name_en']] = sc['id']

print(f'[映射] subclasses.json 共 {len(name_to_id)} 条')

# 2. 处理 class_features.json
with open(os.path.join(JSON_DIR, 'class_features.json'), 'r', encoding='utf-8') as f:
    features = json.load(f)

total = 0
replaced = 0
not_found = []

for feat in features:
    subclass_val = feat.get('subclass', '0')
    if subclass_val == '0' or subclass_val == 0 or subclass_val is None:
        continue
    total += 1
    subclass_str = str(subclass_val).strip()
    if subclass_str in name_to_id:
        feat['subclass'] = name_to_id[subclass_str]
        replaced += 1
    else:
        not_found.append(f"id={feat.get('id')}, name={feat.get('name')}, subclass={subclass_val}")

print(f'[结果] 需替换 {total} 条, 成功 {replaced} 条')

if not_found:
    print(f'[警告] {len(not_found)} 条未匹配:')
    for line in not_found:
        print(f'  - {line}')
else:
    print('[通过] 全部匹配成功, 无遗漏')

# 3. 写回
with open(os.path.join(JSON_DIR, 'class_features.json'), 'w', encoding='utf-8') as f:
    json.dump(features, f, ensure_ascii=False, indent=2)

print('[完成] class_features.json 已更新')