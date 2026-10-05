import { describe, it, expect } from 'vitest';
import { parse } from '../../../TableChronicle/character/dnd_5r/handlers/table-map.js';

describe('tableMap.parse', () => {
    it('TM-01：growup → proficiency', () => {
        const result = parse('growup');
        expect(result.type).toBe('table-map');
        expect(result.success).toBe(true);
        expect(result.needUserSelect).toBe(false);
        expect(result.tableName).toBe('growup');
        expect(result.jsonFile).toBe('proficiency');
    });

    it('TM-02：race_features → race_features', () => {
        const result = parse('race_features');
        expect(result.tableName).toBe('race_features');
        expect(result.jsonFile).toBe('race_features');
    });

    it('TM-03：race_feature → race_features', () => {
        const result = parse('race_feature');
        expect(result.tableName).toBe('race_feature');
        expect(result.jsonFile).toBe('race_features');
    });

    it('TM-04：class_features → class_features', () => {
        const result = parse('class_features');
        expect(result.tableName).toBe('class_features');
        expect(result.jsonFile).toBe('class_features');
    });

    it('TM-05：class_feature → class_features', () => {
        const result = parse('class_feature');
        expect(result.tableName).toBe('class_feature');
        expect(result.jsonFile).toBe('class_features');
    });

    it('TM-06：class_extra → class_extra', () => {
        const result = parse('class_extra');
        expect(result.tableName).toBe('class_extra');
        expect(result.jsonFile).toBe('class_extra');
    });

    it('TM-07：shop → items', () => {
        const result = parse('shop');
        expect(result.tableName).toBe('shop');
        expect(result.jsonFile).toBe('items');
    });

    it('TM-08：suit → packages', () => {
        const result = parse('suit');
        expect(result.tableName).toBe('suit');
        expect(result.jsonFile).toBe('packages');
    });

    it('TM-09：magicitems → magic_items', () => {
        const result = parse('magicitems');
        expect(result.tableName).toBe('magicitems');
        expect(result.jsonFile).toBe('magic_items');
    });

    it('TM-10：magic_items → magic_items', () => {
        const result = parse('magic_items');
        expect(result.tableName).toBe('magic_items');
        expect(result.jsonFile).toBe('magic_items');
    });

    it('TM-11：Growup → 大小写转小写', () => {
        const result = parse('Growup');
        expect(result.tableName).toBe('growup');
        expect(result.jsonFile).toBe('proficiency');
    });

    it('TM-12：unknown_table → success=false', () => {
        const result = parse('unknown_table');
        expect(result.success).toBe(false);
    });

    it('TM-13：空字符串 → success=false', () => {
        const result = parse('');
        expect(result.success).toBe(false);
    });

    it('TM-14：null → success=false', () => {
        const result = parse(null);
        expect(result.success).toBe(false);
    });
});