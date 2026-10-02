import json, os

d = r'f:\跑团工具\TableChronicle\data\json'
for fn in sorted(os.listdir(d)):
    if not fn.endswith('.json'):
        continue
    fp = os.path.join(d, fn)
    data = json.load(open(fp, encoding='utf-8'))
    found = []
    for row in data:
        for k, v in row.items():
            if isinstance(v, str) and 'link(' in v:
                rid = row.get('id', '?')
                found.append(f'  id={rid} {k}: {v[:100]}')
                if len(found) >= 3:
                    break
        if len(found) >= 3:
            break
    if found:
        print(f'{fn}:')
        for f in found:
            print(f)
        print()

print('--- 统计 ---')
total = 0
for fn in sorted(os.listdir(d)):
    if not fn.endswith('.json'):
        continue
    fp = os.path.join(d, fn)
    data = json.load(open(fp, encoding='utf-8'))
    count = 0
    for row in data:
        for k, v in row.items():
            if isinstance(v, str) and 'link(' in v:
                count += 1
    if count:
        print(f'  {fn}: {count} 处 link()')
        total += count
print(f'  合计: {total} 处')