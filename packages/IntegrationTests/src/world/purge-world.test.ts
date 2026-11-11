/**
 * The purge removes every file on the Collaboration storage provider, not only the world's (finding 16): a stray upload
 * must not block the provider's delete, and what shows it in a space must go first.
 */
import { describe, it, expect } from 'vitest';
import { providerFilesPurgeSql } from './purge-world.js';

describe('providerFilesPurgeSql', () => {
    const sqlText = providerFilesPurgeSql('__mj', 'F3000001-0000-4000-8000-000000000001');

    it("selects the files by the provider the purge is about to delete, not by the world's items", () => {
        expect(sqlText).toContain("FROM [__mj].[File] WHERE ProviderID = 'F3000001-0000-4000-8000-000000000001'");
        expect(sqlText).not.toContain('#worldfiles');
    });

    it('removes what hangs on a file before the file: its items in any space, their uses and notices, its record links', () => {
        const steps = [
            '#strayitems FROM __mj_BizAppsCollaboration.SpaceItem',
            'DELETE FROM __mj_BizAppsCollaboration.ItemUse',
            'DELETE FROM __mj_BizAppsCollaboration.ShareNotice',
            'DELETE FROM __mj_BizAppsCollaboration.SpaceItem',
            'DELETE FROM [__mj].FileEntityRecordLink',
            'DELETE FROM [__mj].[File]',
        ];
        const positions = steps.map((needle) => sqlText.indexOf(needle));
        expect(positions.every((pos) => pos >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it("removes the Content Items the pipeline ingested a file into, with what hangs on them, before the file", () => {
        const steps = [
            '#fileitems FROM ingested',
            'DELETE FROM [__mj].ContentItemChunk',
            'DELETE FROM [__mj].ContentItemAttribute',
            'DELETE FROM [__mj].ContentItemTag',
            'DELETE FROM [__mj].ContentItemDuplicate',
            'DELETE FROM [__mj].TagSuggestion',
            'DELETE FROM [__mj].ContentItem WHERE ID IN',
            'DELETE FROM [__mj].[File]',
        ];
        const positions = steps.map((needle) => sqlText.indexOf(needle));
        expect(positions.every((pos) => pos >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it('reads the item-to-file column only where the core schema has it, so the purge compiles on a schema from before the pipeline', () => {
        const guard = sqlText.indexOf("IF COL_LENGTH('[__mj].[ContentItem]', 'FileID') IS NOT NULL");
        expect(guard).toBeGreaterThan(0);
        expect(sqlText.indexOf('ContentItem WHERE FileID IN')).toBeGreaterThan(guard);
        expect(sqlText.slice(0, guard)).not.toContain('ContentItem');
    });
});
