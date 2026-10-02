#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ExpressionParser unit tests - covers all 10 expression types."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from csv转json import ExpressionParser

def check(name, expr, expected_type, **kw):
    r = ExpressionParser.parse(expr)
    ok = r['success'] and r['type'] == expected_type
    for k, v in kw.items():
        if r.get(k) != v:
            ok = False
            break
    st = 'PASS' if ok else 'FAIL'
    if not ok:
        print(f'  [{st}] {name}: {expr}')
        print(f'       want: type={expected_type} {kw}')
        print(f'       got:  {r}')
    else:
        print(f'  [{st}] {name}: {expr}')
    return ok

def main():
    p = 0
    f = 0
    print('=' * 60)
    print('  ExpressionParser Tests')
    print('=' * 60)

    # 1. basic ref
    print('\n[1] basic_ref')
    cases = [
        ('feats(id=5)',     'basic_ref', dict(table='feats')),
        ('spells(id=56)',   'basic_ref', dict(table='spells')),
        ('weapons(type=63)','basic_ref', dict(table='weapons')),
    ]
    for e,t,k in cases:
        if check(e, e, t, **k): p+=1
        else: f+=1

    # 2. filter
    print('\n[2] filter')
    cases = [
        ('spells(class=4,lv=0)+2', 'filter', dict(count=2)),
        ('feats(type=44)+1',        'filter', dict(count=1)),
        ('spells(class=12,school=7)+2', 'filter', dict(count=2)),
    ]
    for e,t,k in cases:
        if check(e, e, t, **k): p+=1
        else: f+=1

    # 3. choose
    print('\n[3] choose')
    cases = [
        ('choose(skills(21,22))+1', 'choose', dict(count=1)),
        ('choose(tools(type=66),tools(type=67))+1', 'choose', dict(count=1)),
    ]
    for e,t,k in cases:
        if check(e, e, t, **k): p+=1
        else: f+=1

    # 4. range
    print('\n[4] range')
    r = ExpressionParser.parse('growup(303->322)')
    if r['success'] and r['type']=='range' and r['start']==303 and r['end']==322:
        print('  [PASS] range: growup(303->322)')
        p+=1
    else:
        print(f'  [FAIL] range: {r}')
        f+=1

    # 5. special
    print('\n[5] special')
    cases = [
        ('all(skills)', 'special', dict(operation='all', table='skills')),
        ('proficiency>pure+2', 'special', dict(operation='proficiency>pure', count=2)),
        ('proficiency>pure', 'special', dict(operation='proficiency>pure', count=1)),
        ('half-prof(skills)', 'special', dict(operation='half-prof')),
        ('spell_slot(lv=1)+1', 'special', dict(operation='spell_slot', level=1, count=1)),
    ]
    for e,t,k in cases:
        if check(e, e, t, **k): p+=1
        else: f+=1

    # 6. multi-choice
    print('\n[6] multi_choice')
    r = ExpressionParser.parse('[1]feats(type=44)+1,[2]spells(class=3,lv=0)+2')
    if r['success'] and r['type']=='multi_choice' and r['option_count']==2:
        print('  [PASS] multi_choice: [1]feats(type=44)+1,[2]spells(class=3,lv=0)+2')
        p+=1
    else:
        print(f'  [FAIL] multi_choice: {r}')
        f+=1

    # 7. formula
    print('\n[7] formula')
    cases = [
        ('AbilityModifiers(1)', 'formula', dict(formula_type='ability_modifier')),
        ('lv:class(6)', 'formula', dict(formula_type='class_level')),
        ('Proficiency', 'formula', dict(formula_type='proficiency_bonus')),
        ('speed+10', 'formula', dict(formula_type='speed_bonus')),
        ('Character(unyielding)', 'formula', dict(formula_type='character_resource')),
    ]
    for e,t,k in cases:
        if check(e, e, t, **k): p+=1
        else: f+=1

    # 8. prerequisite
    print('\n[8] prerequisite')
    cases = [
        ('prerequisite(lv>=4)', 'prerequisite', dict(condition='lv>=4')),
        ('prerequisite(ability(1)>=13)', 'prerequisite', dict(condition='ability(1)>=13')),
        ('prerequisite(feature(spellcasting))', 'prerequisite', dict(condition='feature(spellcasting)')),
    ]
    for e,t,k in cases:
        if check(e, e, t, **k): p+=1
        else: f+=1

    # 9. chain
    print('\n[9] chain')
    r = ExpressionParser.parse('chain:54')
    if r['success'] and r['type']=='chain' and r['feature_id']==54:
        print('  [PASS] chain: chain:54')
        p+=1
    else:
        print(f'  [FAIL] chain: {r}')
        f+=1

    # 10. code
    print('\n[10] code')
    cases = [
        ('code(choose)', 'code', dict(tag='choose')),
    ]
    for e,t,k in cases:
        if check(e, e, t, **k): p+=1
        else: f+=1

    # 11. real CSV samples
    print('\n[11] real_data')
    samples = [
        ('feats(type=44)+1', True),
        ('spells(class=3,lv=0)+2', True),
        ('spells(lv=6,class=11)+1', True),
        ('skills(id=1),skills(id=9)', True),
        ('languages(id=18)', True),
        ('all(skills)', True),
        ('spell_slot(lv=1)+1', True),
        ('prerequisite(lv:class(11)=2)', True),
        ('spells(class=12,school=7)+2', True),
    ]
    for e, ok in samples:
        r = ExpressionParser.parse(e)
        ok2 = r['success']==ok
        st = 'PASS' if ok2 else 'FAIL'
        print(f'  [{st}] {e} -> {r["type"]}')
        if ok2: p+=1
        else: f+=1

    print(f'\n{"="*60}')
    print(f'  Results: {p} passed, {f} failed ({p+f} total)')
    if f:
        print('  FAILED!')
        sys.exit(1)
    else:
        print('  ALL PASSED!')
    print('='*60)

if __name__=='__main__':
    main()