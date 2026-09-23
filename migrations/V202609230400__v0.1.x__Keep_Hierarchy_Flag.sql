-- ParentID keeps the IsHierarchy flag. No path columns or traversal functions
-- ship with it: hosts do not run CodeGen. Access is fnCollaborationAccess.

UPDATE [${mjSchema}].[EntityField]
SET [Configuration] = N'{"Hierarchy":{"IsHierarchy":true}}'
WHERE [ID] = '5948F19F-70AA-49F4-BB6B-1FB059507477'
  AND [Name] = N'ParentID';
GO
