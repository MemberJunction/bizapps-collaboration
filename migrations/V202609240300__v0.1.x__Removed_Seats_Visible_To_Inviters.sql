-- An inviter has to read a Removed seat in order to restore it. The same
-- people who can see a pending invite can see a removed one. Guests still
-- see neither. The removed person still sees their own row.

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Description = N'The caller''s own roster rows, active seats on spaces they reach, and invited or removed seats where their reaching role can invite.',
    FilterText = N'((Status = N''Active'' AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))) OR UserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) OR (Status IN (N''Invited'', N''Removed'') AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)) WHERE CanInvite = 1)))'
WHERE ID = '7D2320C1-4106-434B-A789-15E34C3B0F15';
GO
