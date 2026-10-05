import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/chain.js';

describe('chain.parse', () => {
    it('CN-01：chain:54 → 同表引用', () => {
        const result = parse('chain:54');
        expect(result.type).toBe('chain');
        expect(result.subtype).toBe('same_table');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
        expect(result.targetId).toBe(54);
    });

    it('CN-02：Chain:100 → 大小写不区分', () => {
        const result = parse('Chain:100');
        expect(result.subtype).toBe('same_table');
        expect(result.targetId).toBe(100);
    });

    it('CN-03：chain : 200 → 空格容许', () => {
        const result = parse('chain : 200');
        expect(result.subtype).toBe('same_table');
        expect(result.targetId).toBe(200);
    });

    it('CN-04：spell:140 → 跨表 spell', () => {
        const result = parse('spell:140');
        expect(result.subtype).toBe('cross_table');
        expect(result.tableName).toBe('spell');
        expect(result.targetId).toBe(140);
    });

    it('CN-05：ITEM:42 → 跨表 大小写→小写', () => {
        const result = parse('ITEM:42');
        expect(result.subtype).toBe('cross_table');
        expect(result.tableName).toBe('item');
        expect(result.targetId).toBe(42);
    });

    it('CN-06：Race_Feature:5 → 跨表 下划线表名', () => {
        const result = parse('Race_Feature:5');
        expect(result.subtype).toBe('cross_table');
        expect(result.tableName).toBe('race_feature');
        expect(result.targetId).toBe(5);
    });

    it('CN-07：chain:0 → targetId=0 边界', () => {
        const result = parse('chain:0');
        expect(result.subtype).toBe('same_table');
        expect(result.targetId).toBe(0);
    });

    it('CN-08：chain:99999 → 大ID', () => {
        const result = parse('chain:99999');
        expect(result.subtype).toBe('same_table');
        expect(result.targetId).toBe(99999);
    });

    it('CN-09：chain: → 缺ID', () => {
        const result = parse('chain:');
        expect(result.success).toBe(false);
    });

    it('CN-10：chain:abc → 非数字ID', () => {
        const result = parse('chain:abc');
        expect(result.success).toBe(false);
    });

    it('CN-11：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('CN-12：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});