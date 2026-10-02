import json,os

for fn in ['feats.json','class_features.json']:
    fp=os.path.join(r'f:\跑团工具\TableChronicle\data\json',fn)
    if not os.path.exists(fp): continue
    data=json.load(open(fp,encoding='utf-8'))
    prereqs=[r for r in data if r.get('prerequisite','')]
    print(f'\n=== {fn}: {len(prereqs)} 条有 prerequisite ===')
    for r in prereqs[:8]:
        print(f'  id={r["id"]} prerequisite={r["prerequisite"][:150]}')