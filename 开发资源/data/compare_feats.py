# 对比 专长.csv 和 专长_转换后.csv 的差异
import csv
import os

base = os.path.dirname(os.path.abspath(__file__))
csv_dir = os.path.join(base, 'csv导出')

def read_csv(filename):
    path = os.path.join(csv_dir, filename)
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            rows.append(r)
        return reader.fieldnames, rows

headers1, rows1 = read_csv('专长.csv')
headers2, rows2 = read_csv('专长_转换后.csv')

# 按 id 索引
by_id1 = {r['id']: r for r in rows1}
by_id2 = {r['id']: r for r in rows2}

all_ids = sorted(set(list(by_id1.keys()) + list(by_id2.keys())))

print(f"{'ID':>3} | {'字段':<10} | {'专长.csv':<60} | {'专长_转换后.csv':<60}")
print("-" * 140)

diff_count = 0
for id in all_ids:
    r1 = by_id1.get(id, {})
    r2 = by_id2.get(id, {})
    
    # 检查是否缺少整行
    if not r1:
        print(f"{id:>3} | 缺失整行  | {'':<60} | {'存在但在专长.csv中缺失':<60}")
        diff_count += 1
        continue
    if not r2:
        print(f"{id:>3} | 缺失整行  | {'存在但在专长_转换后.csv中缺失':<60} | {'':<60}")
        diff_count += 1
        continue
    
    name1 = r1.get('名字', '')
    name2 = r2.get('名字', '')
    
    # 对比除 详情 外的字段
    for field in headers1:
        if field == '详情':
            continue
        v1 = r1.get(field, '')
        v2 = r2.get(field, '')
        if v1 != v2:
            print(f"{id:>3} | {field:<10} | {v1[:57]:<60} | {v2[:57]:<60}")
            diff_count += 1
    
    # 对比 详情 字段
    desc1 = r1.get('详情', '')
    desc2 = r2.get('详情', '')
    if desc1 != desc2:
        if len(desc2) < len(desc1):
            status = '⚠ 被截断'
        elif not desc2:
            status = '❌ 完全缺失'
        else:
            status = '↔ 内容不同'
        print(f"{id:>3} | 详情({status:<8}) | {desc1[:57]:<60} | {desc2[:57]:<60}")
        print(f"    | {'':10} | 完整长度={len(desc1):>3}: {desc1[:80]:<80}")
        print(f"    | {'':10} | 转换后长度={len(desc2):>3}: {desc2[:80]:<80}")
        diff_count += 1

print("-" * 140)
print(f"\n总计 {diff_count} 处差异")