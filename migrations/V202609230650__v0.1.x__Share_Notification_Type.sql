-- In-app notification for a share. Email and SMS stay off: this type has no template.
-- The ShareNotice row is the record. This type is what NotificationEngine delivers.

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[UserNotificationType] WHERE ID = 'D3000001-0000-4000-8000-000000000001')
    INSERT INTO [${mjSchema}].[UserNotificationType]
        (ID, Name, Description, DefaultInApp, DefaultEmail, DefaultSMS, AllowUserPreference, __mj_CreatedAt, __mj_UpdatedAt)
    VALUES (
        'D3000001-0000-4000-8000-000000000001',
        N'Collaboration Share',
        N'An item was shared with a member of a space.',
        1, 0, 0, 1, GETUTCDATE(), GETUTCDATE()
    );
GO
