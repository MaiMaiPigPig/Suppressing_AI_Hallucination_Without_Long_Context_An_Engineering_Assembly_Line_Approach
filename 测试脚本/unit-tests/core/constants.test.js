import { describe, it, expect } from 'vitest';
import {
    ABILITY_NAMES,
    STEP_DATA_FIELDS,
    UPGRADE_STEP_DATA_FIELDS
} from '../../../TableChronicle/character/dnd_5r/core/constants/character-constants.js';

describe('ABILITY_NAMES', () => {
    it('长度为 6', () => {
        expect(ABILITY_NAMES).toHaveLength(6);
    });

    it('值为 [1, 4, 9, 11, 18, 25]', () => {
        expect(ABILITY_NAMES).toEqual([1, 4, 9, 11, 18, 25]);
    });
});

describe('STEP_DATA_FIELDS', () => {
    it('包含步骤 1-17 的键', () => {
        for (let i = 1; i <= 17; i++) {
            expect(STEP_DATA_FIELDS).toHaveProperty(String(i));
        }
    });

    it('每个值为数组', () => {
        Object.values(STEP_DATA_FIELDS).forEach(val => {
            expect(Array.isArray(val)).toBe(true);
        });
    });

    it('步骤 1 包含 race', () => {
        expect(STEP_DATA_FIELDS['1']).toContain('race');
    });

    it('步骤 7 包含 abilities', () => {
        expect(STEP_DATA_FIELDS['7']).toContain('abilities');
    });

    it('步骤 14/16/17 可以为空数组', () => {
        expect(Array.isArray(STEP_DATA_FIELDS['14'])).toBe(true);
        expect(Array.isArray(STEP_DATA_FIELDS['16'])).toBe(true);
        expect(Array.isArray(STEP_DATA_FIELDS['17'])).toBe(true);
    });
});

describe('UPGRADE_STEP_DATA_FIELDS', () => {
    it('包含步骤 0-6 的键', () => {
        for (let i = 0; i <= 6; i++) {
            expect(UPGRADE_STEP_DATA_FIELDS).toHaveProperty(String(i));
        }
    });

    it('每个值为数组', () => {
        Object.values(UPGRADE_STEP_DATA_FIELDS).forEach(val => {
            expect(Array.isArray(val)).toBe(true);
        });
    });
});