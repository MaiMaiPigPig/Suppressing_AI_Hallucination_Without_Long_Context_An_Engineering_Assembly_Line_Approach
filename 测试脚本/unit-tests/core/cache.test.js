import { describe, it, expect, beforeEach } from 'vitest';
import {
    dataCache,
    _fullDataCache,
    setDataCache,
    setFullDataCache,
    resetCache,
    applyDLCFilter
} from '../../../TableChronicle/character/dnd_5r/core/data/cache.js';

describe('dataCache', () => {
    beforeEach(() => {
        resetCache();
    });

    it('初始为空对象', () => {
        expect(dataCache).toEqual({});
        expect(_fullDataCache).toEqual({});
    });

    it('setDataCache 后 dataCache 更新', () => {
        setDataCache({ key: 'val' });
        expect(dataCache).toEqual({ key: 'val' });
    });

    it('setFullDataCache 后 _fullDataCache 更新', () => {
        setFullDataCache({ key: 'val' });
        expect(_fullDataCache).toEqual({ key: 'val' });
    });

    it('resetCache 后 dataCache 和 _fullDataCache 均为空', () => {
        setDataCache({ key: 'val' });
        setFullDataCache({ key: 'val2' });
        resetCache();
        expect(dataCache).toEqual({});
        expect(_fullDataCache).toEqual({});
    });
});

describe('applyDLCFilter', () => {
    beforeEach(() => {
        resetCache();
    });

    it('_fullDataCache 在过滤后保持不变', () => {
        const full = {
            spells: [
                { id: 1, name: 'PHB 法术', dlc: 'phb' },
                { id: 2, name: 'XGE 法术', dlc: 'xge' }
            ],
            classes: [{ id: 1, name: '法师' }]
        };
        setFullDataCache(full);
        applyDLCFilter(['phb']);

        expect(_fullDataCache).toEqual(full);
        expect(_fullDataCache.spells).toHaveLength(2);
    });

    it('过滤表按 dlc 筛选', () => {
        const full = {
            spells: [
                { id: 1, name: 'PHB', dlc: 'phb' },
                { id: 2, name: 'XGE', dlc: 'xge' }
            ]
        };
        setFullDataCache(full);
        applyDLCFilter(['phb']);

        expect(dataCache.spells).toHaveLength(1);
        expect(dataCache.spells[0].name).toBe('PHB');
    });

    it('无 dlc 字段的数据始终保留', () => {
        const full = {
            spells: [
                { id: 1, name: '无DLC标记' },
                { id: 2, name: 'PHB', dlc: 'phb' }
            ]
        };
        setFullDataCache(full);
        applyDLCFilter(['xge']);

        expect(dataCache.spells).toHaveLength(1);
        expect(dataCache.spells[0].name).toBe('无DLC标记');
    });

    it('非过滤表全量复制', () => {
        const full = {
            classes: [{ id: 1, name: '法师' }],
            dictionary: [{ id: 1, name: '测试' }]
        };
        setFullDataCache(full);
        applyDLCFilter(['phb']);

        expect(dataCache.classes).toHaveLength(1);
        expect(dataCache.dictionary).toHaveLength(1);
    });

    it('null / [] 默认等效 phb 过滤', () => {
        const full = {
            spells: [
                { id: 1, name: 'PHB 法术', dlc: 'phb' },
                { id: 2, name: 'XGE 法术', dlc: 'xge' }
            ]
        };
        setFullDataCache(full);
        applyDLCFilter(null);

        expect(dataCache.spells).toHaveLength(1);
        expect(dataCache.spells[0].name).toBe('PHB 法术');
    });
});