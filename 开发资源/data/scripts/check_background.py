import json

fp = r'f:\跑团工具\TableChronicle\data\json\backgrounds.json'
data = json.load(open(fp, encoding='utf-8'))

for field in ['tool', 'skill', 'equipment', 'rules', 'chain']:
    found = [r for r in data if isinstance(r.get(field, ''), str) and 'link(' in r.get(field, '')]
    if found:
        print(f'{field}: {len(found)} 条含 link()')
        for r in found[:3]:
            print(f'  id={r["id"]} {field}={r[field][:120]}')
    else:
        print(f'{field}: 0 条含 link()')