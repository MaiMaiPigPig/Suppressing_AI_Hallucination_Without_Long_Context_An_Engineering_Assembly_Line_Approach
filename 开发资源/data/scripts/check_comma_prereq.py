import json, os

d = r'f:\跑团工具\TableChronicle\data\json'
for fn in sorted(os.listdir(d)):
    if not fn.endswith('.json'): continue
    fp = os.path.join(d, fn)
    data = json.load(open(fp, encoding='utf-8'))
    if isinstance(data, list):
        found = [r for r in data if isinstance(r.get('prereq', r.get('prerequisite', '')), str) and ',' in str(r.get('prereq', r.get('prerequisite', '')))]
        if found:
            print(f'{fn}:')
            for r in found[:5]:
                val = r.get('prereq') or r.get('prerequisite', '')
                print(f'  id={r.get("id","?")} = {val[:150]}')