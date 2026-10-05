import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/selection.js';

describe('selection.parse', () => {
    it('SEL-01：[1]Feats(type=44)+1,[2]spell(class=3,lv=0)+2 → 二选一', () => {
        const result = parse('[1]Feats(type=44)+1,[2]spell(class=3,lv=0)+2');
        expect(result.type).toBe('selection');
        expect(result.subtype).toBe('numbered_choice');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(true);
        expect(result.options).toEqual(['Feats(type=44)+1', 'spell(class=3,lv=0)+2']);
    });

    it('SEL-02：[1]8,41,108\\n[2]20,64,128\\n[3]24,90,140 → 多行换行', () => {
        const result = parse('[1]8,41,108\n[2]20,64,128\n[3]24,90,140');
        expect(result.subtype).toBe('numbered_choice');
        expect(result.needUserSelect).toBe(true);
        expect(result.options.length).toBe(3);
    });

    it('SEL-03：303→322 → 范围选择', () => {
        const result = parse('303→322');
        expect(result.type).toBe('selection');
        expect(result.subtype).toBe('range');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(true);
        expect(result.startId).toBe(303);
        expect(result.endId).toBe(322);
    });

    it('SEL-04：growup(303→322) → growup 包裹', () => {
        const result = parse('growup(303→322)');
        expect(result.subtype).toBe('range');
        expect(result.needUserSelect).toBe(true);
        expect(result.startId).toBe(303);
        expect(result.endId).toBe(322);
    });

    it('SEL-05：growup( 303 → 322 ) → growup 带空格', () => {
        const result = parse('growup( 303 → 322 )');
        expect(result.subtype).toBe('range');
        expect(result.needUserSelect).toBe(true);
        expect(result.startId).toBe(303);
        expect(result.endId).toBe(322);
    });

    it('SEL-06：1→100 → 不同范围', () => {
        const result = parse('1→100');
        expect(result.subtype).toBe('range');
        expect(result.needUserSelect).toBe(true);
        expect(result.startId).toBe(1);
        expect(result.endId).toBe(100);
    });

    it('SEL-07：303,304,305 → ID列表', () => {
        const result = parse('303,304,305');
        expect(result.subtype).toBe('id_list');
        expect(result.needUserSelect).toBe(true);
        expect(result.ids).toEqual([303, 304, 305]);
    });

    it('SEL-08：1, 2, 3 → ID列表带空格', () => {
        const result = parse('1, 2, 3');
        expect(result.subtype).toBe('id_list');
        expect(result.needUserSelect).toBe(true);
        expect(result.ids).toEqual([1, 2, 3]);
    });

    it('SEL-09：→ → 无数字箭头', () => {
        const result = parse('→');
        expect(result.success).toBe(false);
    });

    it('SEL-10：abc → 非选择格式', () => {
        const result = parse('abc');
        expect(result.success).toBe(false);
    });

    it('SEL-11：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('SEL-12：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});