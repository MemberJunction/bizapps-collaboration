-- The Sharing Center asks a permission domain by class name.
-- CollaborationSpacePermissionProvider answers from the roster.

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[PermissionDomain] WHERE ID = 'F1000001-0000-4000-8000-000000000001')
    INSERT INTO [${mjSchema}].[PermissionDomain]
        (ID, Name, Description, ProviderClassName, SupportedGranteeTypes, SupportedActions, SupportsDeny, SupportsExpiration, SupportsHierarchyInheritance, IsActive, DisplayOrder, Icon)
    VALUES (
        'F1000001-0000-4000-8000-000000000001',
        N'Collaboration Spaces',
        N'Who reaches a space. Read follows an active membership. Update and Share follow the owner role.',
        N'CollaborationSpacePermissionProvider',
        N'User',
        N'Read,Update,Share',
        0, 0, 1, 1, 40,
        N'fa-solid fa-people-group'
    );
GO
