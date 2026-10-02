import json,os

fp=os.path.join(r'f:\跑团工具\TableChronicle\data\json','class_extra.json')
data=json.load(open(fp,encoding='utf-8'))
prereqs=[r for r in data if r.get('prereq','') or r.get('prerequisite','')]
print(f'{len(prereqs)} 条有前置条件')
for r in prereqs[:10]:
    pre=r.get('prereq') or r.get('prerequisite','')
    print(f'  id={r.get("id","?")} pre={pre[:150]}')
print()

found_link=[r for r in data if 'link(' in str(r.get('prereq',''))+str(r.get('prerequisite',''))]
print(f'{len(found_link)} 条包含 link()')