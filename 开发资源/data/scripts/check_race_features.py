import json

fp = r'f:\跑团工具\TableChronicle\data\json\race_features.json'
data = json.load(open(fp, encoding='utf-8'))
found = [row for row in data if row.get('rules', '') and 'spells' in str(row.get('rules', ''))]
for r in found[:5]:
    print(f"id={r['id']} rules={r['rules'][:120]}")
print(f"共 {len(found)} 条")
print()

found2 = [row for row in data if row.get('rules', '')]
print(f"有 rules 字段的: {len(found2)} 条")
for r in found2[:10]:
    print(f"  id={r['id']} rules={r['rules'][:120]}")