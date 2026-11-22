-- =============================================================================
-- Migration: V202611211945__v0.2.x__Space_Agent_Source_Receipts.sql
-- Adds SpaceAgentSourceReceipt for CT-2 queryable relational source receipts
-- per space agent message, recording supplied space items and knowledge sources
-- as well as specifically cited sources within strict (space, band) reach.
-- =============================================================================

-- 1. Create SpaceAgentSourceReceipt table
CREATE TABLE [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] (
    [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_SpaceAgentSourceReceipt_ID] DEFAULT (newsequentialid()),
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceChatID] UNIQUEIDENTIFIER NOT NULL,
    [ConversationID] UNIQUEIDENTIFIER NOT NULL,
    [ConversationDetailID] UNIQUEIDENTIFIER NOT NULL,
    [AgentRunID] UNIQUEIDENTIFIER NULL,
    [SourceKind] NVARCHAR(30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [SpaceItemID] UNIQUEIDENTIFIER NULL,
    [ContentSourceID] UNIQUEIDENTIFIER NULL,
    [TargetEntityID] UNIQUEIDENTIFIER NULL,
    [TargetRecordID] NVARCHAR(450) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [SourceTitle] NVARCHAR(500) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Band] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [WasSupplied] BIT NOT NULL CONSTRAINT [DF_SpaceAgentSourceReceipt_WasSupplied] DEFAULT ((1)),
    [WasCited] BIT NOT NULL CONSTRAINT [DF_SpaceAgentSourceReceipt_WasCited] DEFAULT ((0)),
    [RetrievalRank] INT NULL,
    [RelevanceScore] DECIMAL(12, 6) NULL,
    [RankingMode] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL CONSTRAINT [DF_SpaceAgentSourceReceipt_RankingMode] DEFAULT (N'none'),
    [CitationOrdinal] INT NULL,
    [EstimatedTokens] INT NOT NULL CONSTRAINT [DF_SpaceAgentSourceReceipt_EstimatedTokens] DEFAULT ((0)),
    [WasTruncated] BIT NOT NULL CONSTRAINT [DF_SpaceAgentSourceReceipt_WasTruncated] DEFAULT ((0)),
    [Sequence] INT NOT NULL CONSTRAINT [DF_SpaceAgentSourceReceipt_Sequence] DEFAULT ((1)),
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAgentSourceReceipt___mj_CreatedAt] DEFAULT (getutcdate()),
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAgentSourceReceipt___mj_UpdatedAt] DEFAULT (getutcdate()),
    CONSTRAINT [PK_SpaceAgentSourceReceipt] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_SpaceChat] FOREIGN KEY ([SpaceChatID]) REFERENCES [${flyway:defaultSchema}].[SpaceChat] ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_Conversation] FOREIGN KEY ([ConversationID]) REFERENCES [${mjSchema}].[Conversation] ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_ConversationDetail] FOREIGN KEY ([ConversationDetailID]) REFERENCES [${mjSchema}].[ConversationDetail] ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_AgentRun] FOREIGN KEY ([AgentRunID]) REFERENCES [${mjSchema}].[AIAgentRun] ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_SpaceItem] FOREIGN KEY ([SpaceItemID]) REFERENCES [${flyway:defaultSchema}].[SpaceItem] ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_ContentSource] FOREIGN KEY ([ContentSourceID]) REFERENCES [${mjSchema}].[ContentSource] ([ID]),
    CONSTRAINT [FK_SpaceAgentSourceReceipt_TargetEntity] FOREIGN KEY ([TargetEntityID]) REFERENCES [${mjSchema}].[Entity] ([ID]),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_SourceKind] CHECK ([SourceKind] = N'SpaceItem' OR [SourceKind] = N'KnowledgeSource'),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_SourceTarget] CHECK (
        ([SourceKind] = N'SpaceItem' AND [SpaceItemID] IS NOT NULL AND [ContentSourceID] IS NULL)
        OR ([SourceKind] = N'KnowledgeSource' AND [ContentSourceID] IS NOT NULL AND [SpaceItemID] IS NULL)
    ),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_Band] CHECK ([Band] = N'Shared' OR [Band] = N'Team'),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_RankingMode] CHECK ([RankingMode] = N'vector' OR [RankingMode] = N'lexical' OR [RankingMode] = N'grant' OR [RankingMode] = N'none'),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_CitationOrdinal] CHECK (
        ([WasCited] = (0) AND [CitationOrdinal] IS NULL)
        OR ([WasCited] = (1) AND [CitationOrdinal] >= (1))
    ),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_RetrievalRank] CHECK ([RetrievalRank] IS NULL OR [RetrievalRank] >= (1)),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_EstimatedTokens] CHECK ([EstimatedTokens] >= (0)),
    CONSTRAINT [CK_SpaceAgentSourceReceipt_Sequence] CHECK ([Sequence] >= (1))
);
GO

-- 2. Idempotency & lookup indexes
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceAgentSourceReceipt_Detail_SpaceItem]
ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([ConversationDetailID], [SpaceItemID])
WHERE ([SpaceItemID] IS NOT NULL);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceAgentSourceReceipt_Detail_ContentSource]
ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([ConversationDetailID], [ContentSourceID])
WHERE ([ContentSourceID] IS NOT NULL);
GO

CREATE NONCLUSTERED INDEX [IX_SpaceAgentSourceReceipt_ConversationDetail]
ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([ConversationDetailID], [WasCited], [Sequence]);
GO

CREATE NONCLUSTERED INDEX [IX_SpaceAgentSourceReceipt_Space_Band]
ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([SpaceID], [Band], [ConversationID]);
GO

-- 3. Extended properties for table and columns
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Relational provenance receipt on a space agent answer message, recording each in-reach space item or knowledge source supplied to the turn and whether it was cited in the answer.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space that owns the source (for SpaceItem) or the chat anchor space (for KnowledgeSource).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The SpaceChat record in which the agent turn ran.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'SpaceChatID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The MJ Conversation in which the agent message was authored.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'ConversationID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The assistant ConversationDetail message this receipt belongs to.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'ConversationDetailID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The AI Agent Run associated with this answer turn, when available.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'AgentRunID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Discriminator identifying whether the source is a SpaceItem or a KnowledgeSource.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'SourceKind';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The in-reach SpaceItem supplied or cited when SourceKind is SpaceItem.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'SpaceItemID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The in-reach ContentSource supplied or cited when SourceKind is KnowledgeSource.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'ContentSourceID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The underlying target MJ Entity ID for this source (polymorphic pair with TargetRecordID).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'TargetEntityID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The canonical target record key (e.g. ID|<uuid>) for opening the in-reach source.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'TargetRecordID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display title of the validated in-reach source captured at turn execution time.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'SourceTitle';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Visibility band of the source (Shared or Team), strictly bounded by the chat audience.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'Band';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'True when this source was supplied into the agent turn prompt or tools context.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'WasSupplied';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'True when this in-reach source was specifically cited in the generated agent answer.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'WasCited';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1-based retrieval rank assigned during bounded top-k retrieval.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'RetrievalRank';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Relevance score computed by vector search or lexical BM25 fallback.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'RelevanceScore';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'How the source was selected for the turn: vector, lexical, grant, or none.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'RankingMode';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1-based citation order within the generated answer when WasCited is true.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'CitationOrdinal';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Estimated prompt tokens consumed by this source under the bounded context budget.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'EstimatedTokens';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'True when source content was truncated to fit the per-source token ceiling.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'WasTruncated';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Deterministic display sequence of the receipt on the assistant message.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAgentSourceReceipt', @level2type = N'COLUMN', @level2name = N'Sequence';
GO























































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Agent Source Receipts */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[Entity] WHERE [ID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' OR ([SchemaName] = '${flyway:defaultSchema}' AND [BaseTable] = 'SpaceAgentSourceReceipt'))
BEGIN
    INSERT INTO [${mjSchema}].[Entity] (
        [ID],
        [Name],
        [DisplayName],
        [Description],
        [NameSuffix],
        [BaseTable],
        [BaseView],
        [SchemaName],
        [IncludeInAPI],
        [AllowUserSearchAPI],
        [AllowCaching],
        [TrackRecordChanges],
        [AuditRecordAccess],
        [AuditViewRuns],
        [AllowAllRowsAPI],
        [AllowCreateAPI],
        [AllowUpdateAPI],
        [AllowDeleteAPI],
        [UserViewMaxRows],
        [__mj_CreatedAt],
        [__mj_UpdatedAt]
    )
    VALUES (
        'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31',
        'MJ_BizApps_Collaboration: Space Agent Source Receipts',
        'Space Agent Source Receipts',
        'Relational provenance receipt on a space agent answer message, recording each in-reach space item or knowledge source supplied to the turn and whether it was cited in the answer.',
        NULL,
        'SpaceAgentSourceReceipt',
        'vwSpaceAgentSourceReceipts',
        '${flyway:defaultSchema}',
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1000,
        GETUTCDATE(),
        GETUTCDATE()
    );
END;

/* SQL generated to add entity MJ_BizApps_Collaboration: Space Agent Source Receipts to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[ApplicationEntity]
    WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'
      AND [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'
)
BEGIN
    INSERT INTO [${mjSchema}].[ApplicationEntity]
        ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES
        (
            '94F5906B-38AB-4A9F-BFCA-3D395BBBC198',
            'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31',
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'),
            GETUTCDATE(),
            GETUTCDATE()
        );
END;

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Source Receipts for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
    ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission]
    WHERE [EntityID] = CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS uniqueidentifier)
      AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier)
      AND [Type] = 'Allow'
);

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Source Receipts for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
    ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission]
    WHERE [EntityID] = CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS uniqueidentifier)
      AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier)
      AND [Type] = 'Allow'
);

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Source Receipts for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
    ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission]
    WHERE [EntityID] = CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS uniqueidentifier)
      AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier)
      AND [Type] = 'Allow'
);

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 29 entity field(s) */

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000001-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'ID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000001-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ID', 'ID', NULL, 'uniqueidentifier', 16, 0, 0, 0, 'newsequentialid()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 1, 1, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000002-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'SpaceID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000002-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceID', 'Space ID', 'The space that owns the source (for SpaceItem) or the chat anchor space (for KnowledgeSource).', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000003-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'SpaceChatID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000003-7d3f-4e8a-9b12-4C6D8E0F2A31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceChatID', 'Space Chat ID', 'The SpaceChat record in which the agent turn ran.', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, '75E3ED25-C46B-45C1-96F7-91578D88DBE2', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000004-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'ConversationID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000004-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ConversationID', 'Conversation ID', 'The MJ Conversation in which the agent message was authored.', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, '13248F34-2837-EF11-86D4-6045BDEE16E6', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000005-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'ConversationDetailID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000005-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ConversationDetailID', 'Conversation Detail ID', 'The assistant ConversationDetail message this receipt belongs to.', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, '12248F34-2837-EF11-86D4-6045BDEE16E6', 'ID', 0, 0, 1, 0, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000006-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'AgentRunID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000006-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'AgentRunID', 'Agent Run ID', 'The AI Agent Run associated with this answer turn, when available.', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, '5190AF93-4C39-4429-BDAA-0AEB492A0256', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'SourceKind')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SourceKind', 'Source Kind', 'Discriminator identifying whether the source is a SpaceItem or a KnowledgeSource.', 'nvarchar', 60, 0, 0, 0, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000008-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'SpaceItemID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000008-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceItemID', 'Space Item ID', 'The in-reach SpaceItem supplied or cited when SourceKind is SpaceItem.', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, '41165FEC-A52B-469A-A880-3B108C39A65E', 'ID', 0, 0, 1, 0, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000009-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'ContentSourceID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000009-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ContentSourceID', 'Content Source ID', 'The in-reach ContentSource supplied or cited when SourceKind is KnowledgeSource.', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22', 'ID', 0, 0, 1, 0, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000010-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'TargetEntityID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000010-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'TargetEntityID', 'Target Entity ID', 'The underlying target MJ Entity ID for this source (polymorphic pair with TargetRecordID).', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000011-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'TargetRecordID')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000011-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'TargetRecordID', 'Target Record ID', 'The canonical target record key (e.g. ID|<uuid>) for opening the in-reach source.', 'nvarchar', 900, 0, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000012-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'SourceTitle')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000012-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SourceTitle', 'Source Title', 'Display title of the validated in-reach source captured at turn execution time.', 'nvarchar', 1000, 0, 0, 0, NULL, 0, 1, 0, 0, NULL, NULL, 1, 1, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'Band')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Band', 'Band', 'Visibility band of the source (Shared or Team), strictly bounded by the chat audience.', 'nvarchar', 40, 0, 0, 0, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000014-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'WasSupplied')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000014-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'WasSupplied', 'Was Supplied', 'True when this source was supplied into the agent turn prompt or tools context.', 'bit', 1, 1, 0, 0, '((1))', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000015-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'WasCited')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000015-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'WasCited', 'Was Cited', 'True when this in-reach source was specifically cited in the generated agent answer.', 'bit', 1, 1, 0, 0, '((0))', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000016-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'RetrievalRank')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000016-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'RetrievalRank', 'Retrieval Rank', '1-based retrieval rank assigned during bounded top-k retrieval.', 'int', 4, 10, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000017-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'RelevanceScore')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000017-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'RelevanceScore', 'Relevance Score', 'Relevance score computed by vector search or lexical BM25 fallback.', 'decimal', 9, 12, 6, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'RankingMode')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'RankingMode', 'Ranking Mode', 'How the source was selected for the turn: vector, lexical, grant, or none.', 'nvarchar', 40, 0, 0, 0, 'none', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000019-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'CitationOrdinal')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000019-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'CitationOrdinal', 'Citation Ordinal', '1-based citation order within the generated answer when WasCited is true.', 'int', 4, 10, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000020-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'EstimatedTokens')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000020-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'EstimatedTokens', 'Estimated Tokens', 'Estimated prompt tokens consumed by this source under the bounded context budget.', 'int', 4, 10, 0, 0, '((0))', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000021-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'WasTruncated')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000021-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'WasTruncated', 'Was Truncated', 'True when source content was truncated to fit the per-source token ceiling.', 'bit', 1, 1, 0, 0, '((0))', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000022-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'Sequence')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000022-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Sequence', 'Sequence', 'Deterministic display sequence of the receipt on the assistant message.', 'int', 4, 10, 0, 0, '((1))', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000023-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = '__mj_CreatedAt')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000023-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), '__mj_CreatedAt', 'Created At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000024-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = '__mj_UpdatedAt')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000024-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), '__mj_UpdatedAt', 'Updated At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000025-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'Space')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000025-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, 0, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000026-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'SpaceChat')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000026-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceChat', 'Space Chat', NULL, 'nvarchar', 510, 0, 0, 0, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000027-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'Conversation')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000027-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Conversation', 'Conversation', NULL, 'nvarchar', 510, 0, 0, 1, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000028-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'ContentSource')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000028-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ContentSource', 'Content Source', NULL, 'nvarchar', 510, 0, 0, 1, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1000029-7d3f-4e8a-9b12-4c6d8e0f2a31' OR (EntityID = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND Name = 'TargetEntity')) BEGIN
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('b1000029-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'TargetEntity', 'Target Entity', NULL, 'nvarchar', 510, 0, 0, 1, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE())
END;

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Value list entries for SourceKind */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000001-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000001-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 1, 'SpaceItem', 'SpaceItem', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000002-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000002-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 2, 'KnowledgeSource', 'KnowledgeSource', GETUTCDATE(), GETUTCDATE());

UPDATE [${mjSchema}].[EntityField] SET [ValueListType] = 'List' WHERE [ID] = 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31';

/* Value list entries for Band */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000003-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000003-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31', 1, 'Shared', 'Shared', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000004-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000004-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31', 2, 'Team', 'Team', GETUTCDATE(), GETUTCDATE());

UPDATE [${mjSchema}].[EntityField] SET [ValueListType] = 'List' WHERE [ID] = 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31';

/* Value list entries for RankingMode */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000005-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000005-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 1, 'vector', 'vector', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000006-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000006-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 2, 'lexical', 'lexical', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000007-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 3, 'grant', 'grant', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] WHERE [ID] = 'c1000008-7d3f-4e8a-9b12-4c6d8e0f2a31')
    INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('c1000008-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 4, 'none', 'none', GETUTCDATE(), GETUTCDATE());

UPDATE [${mjSchema}].[EntityField] SET [ValueListType] = 'List' WHERE [ID] = 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31';

/* Create Entity Relationships */
IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [ID] = 'd1000001-7d3f-4e8a-9b12-4c6d8e0f2a31'
       OR ([EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND [RelatedEntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND [RelatedEntityJoinField] = 'SpaceID')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('d1000001-7d3f-4e8a-9b12-4c6d8e0f2a31', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'SpaceID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'), GETUTCDATE(), GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [ID] = 'd1000002-7d3f-4e8a-9b12-4c6d8e0f2a31'
       OR ([EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND [RelatedEntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND [RelatedEntityJoinField] = 'SpaceChatID')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('d1000002-7d3f-4e8a-9b12-4c6d8e0f2a31', '75E3ED25-C46B-45C1-96F7-91578D88DBE2', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'SpaceChatID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'), GETUTCDATE(), GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [ID] = 'd1000003-7d3f-4e8a-9b12-4c6d8e0f2a31'
       OR ([EntityID] = '13248F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND [RelatedEntityJoinField] = 'ConversationID')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('d1000003-7d3f-4e8a-9b12-4c6d8e0f2a31', '13248F34-2837-EF11-86D4-6045BDEE16E6', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'ConversationID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '13248F34-2837-EF11-86D4-6045BDEE16E6'), GETUTCDATE(), GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [ID] = 'd1000004-7d3f-4e8a-9b12-4c6d8e0f2a31'
       OR ([EntityID] = '12248F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND [RelatedEntityJoinField] = 'ConversationDetailID')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('d1000004-7d3f-4e8a-9b12-4c6d8e0f2a31', '12248F34-2837-EF11-86D4-6045BDEE16E6', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'ConversationDetailID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '12248F34-2837-EF11-86D4-6045BDEE16E6'), GETUTCDATE(), GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [ID] = 'd1000005-7d3f-4e8a-9b12-4c6d8e0f2a31'
       OR ([EntityID] = '5190AF93-4C39-4429-BDAA-0AEB492A0256' AND [RelatedEntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND [RelatedEntityJoinField] = 'AgentRunID')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('d1000005-7d3f-4e8a-9b12-4c6d8e0f2a31', '5190AF93-4C39-4429-BDAA-0AEB492A0256', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'AgentRunID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '5190AF93-4C39-4429-BDAA-0AEB492A0256'), GETUTCDATE(), GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [ID] = 'd1000006-7d3f-4e8a-9b12-4c6d8e0f2a31'
       OR ([EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E' AND [RelatedEntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND [RelatedEntityJoinField] = 'SpaceItemID')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('d1000006-7d3f-4e8a-9b12-4c6d8e0f2a31', '41165FEC-A52B-469A-A880-3B108C39A65E', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'SpaceItemID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'), GETUTCDATE(), GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [ID] = 'd1000007-7d3f-4e8a-9b12-4c6d8e0f2a31'
       OR ([EntityID] = 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22' AND [RelatedEntityID] = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND [RelatedEntityJoinField] = 'ContentSourceID')
)
BEGIN
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('d1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'ContentSourceID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22'), GETUTCDATE(), GETUTCDATE());
END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for SpaceAgentSourceReceipt */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([SpaceID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceChatID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceChatID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([SpaceChatID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ConversationID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ConversationID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([ConversationID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ConversationDetailID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ConversationDetailID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([ConversationDetailID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_AgentRunID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_AgentRunID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([AgentRunID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceItemID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceItemID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([SpaceItemID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ContentSourceID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ContentSourceID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([ContentSourceID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_TargetEntityID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSourceReceipt]'))
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_TargetEntityID ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] ([TargetEntityID]);

/* Update related entity name field maps */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='b1000002-7d3f-4e8a-9b12-4c6d8e0f2a31', @RelatedEntityNameFieldMap='Space';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='b1000003-7d3f-4e8a-9b12-4c6d8e0f2a31', @RelatedEntityNameFieldMap='SpaceChat';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='b1000004-7d3f-4e8a-9b12-4c6d8e0f2a31', @RelatedEntityNameFieldMap='Conversation';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='b1000009-7d3f-4e8a-9b12-4c6d8e0f2a31', @RelatedEntityNameFieldMap='ContentSource';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='b1000010-7d3f-4e8a-9b12-4c6d8e0f2a31', @RelatedEntityNameFieldMap='TargetEntity';

/* Base View SQL for MJ_BizApps_Collaboration: Space Agent Source Receipts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agent Source Receipts
-- Item: vwSpaceAgentSourceReceipts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceAgentSourceReceipts]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceAgentSourceReceipts];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceAgentSourceReceipts]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    mjBizAppsCollaborationSpaceChat_SpaceChatID.[Name] AS [SpaceChat],
    MJConversation_ConversationID.[Name] AS [Conversation],
    MJContentSource_ContentSourceID.[Name] AS [ContentSource],
    MJEntity_TargetEntityID.[Name] AS [TargetEntity]
FROM
    [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[SpaceChat] AS mjBizAppsCollaborationSpaceChat_SpaceChatID
  ON
    [s].[SpaceChatID] = mjBizAppsCollaborationSpaceChat_SpaceChatID.[ID]
INNER JOIN
    [${mjSchema}].[Conversation] AS MJConversation_ConversationID
  ON
    [s].[ConversationID] = MJConversation_ConversationID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[ContentSource] AS MJContentSource_ContentSourceID
  ON
    [s].[ContentSourceID] = MJContentSource_ContentSourceID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Entity] AS MJEntity_TargetEntityID
  ON
    [s].[TargetEntityID] = MJEntity_TargetEntityID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAgentSourceReceipts] TO [cdp_UI], [cdp_Developer], [cdp_Integration];
GO

/* spCreate SQL for MJ_BizApps_Collaboration: Space Agent Source Receipts */
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceAgentSourceReceipt]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAgentSourceReceipt];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAgentSourceReceipt]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @SpaceChatID uniqueidentifier,
    @ConversationID uniqueidentifier,
    @ConversationDetailID uniqueidentifier,
    @AgentRunID_Clear bit = 0,
    @AgentRunID uniqueidentifier = NULL,
    @SourceKind nvarchar(30),
    @SpaceItemID_Clear bit = 0,
    @SpaceItemID uniqueidentifier = NULL,
    @ContentSourceID_Clear bit = 0,
    @ContentSourceID uniqueidentifier = NULL,
    @TargetEntityID_Clear bit = 0,
    @TargetEntityID uniqueidentifier = NULL,
    @TargetRecordID_Clear bit = 0,
    @TargetRecordID nvarchar(450) = NULL,
    @SourceTitle nvarchar(500),
    @Band nvarchar(20),
    @WasSupplied bit = NULL,
    @WasCited bit = NULL,
    @RetrievalRank_Clear bit = 0,
    @RetrievalRank int = NULL,
    @RelevanceScore_Clear bit = 0,
    @RelevanceScore decimal(12, 6) = NULL,
    @RankingMode nvarchar(20) = NULL,
    @CitationOrdinal_Clear bit = 0,
    @CitationOrdinal int = NULL,
    @EstimatedTokens int = NULL,
    @WasTruncated bit = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceAgentSourceReceipt]
            (
                [ID],
                [SpaceID],
                [SpaceChatID],
                [ConversationID],
                [ConversationDetailID],
                [AgentRunID],
                [SourceKind],
                [SpaceItemID],
                [ContentSourceID],
                [TargetEntityID],
                [TargetRecordID],
                [SourceTitle],
                [Band],
                [WasSupplied],
                [WasCited],
                [RetrievalRank],
                [RelevanceScore],
                [RankingMode],
                [CitationOrdinal],
                [EstimatedTokens],
                [WasTruncated],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @SpaceChatID,
                @ConversationID,
                @ConversationDetailID,
                CASE WHEN @AgentRunID_Clear = 1 THEN NULL ELSE ISNULL(@AgentRunID, NULL) END,
                @SourceKind,
                CASE WHEN @SpaceItemID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceItemID, NULL) END,
                CASE WHEN @ContentSourceID_Clear = 1 THEN NULL ELSE ISNULL(@ContentSourceID, NULL) END,
                CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE ISNULL(@TargetEntityID, NULL) END,
                CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE ISNULL(@TargetRecordID, NULL) END,
                @SourceTitle,
                @Band,
                ISNULL(@WasSupplied, 1),
                ISNULL(@WasCited, 0),
                CASE WHEN @RetrievalRank_Clear = 1 THEN NULL ELSE ISNULL(@RetrievalRank, NULL) END,
                CASE WHEN @RelevanceScore_Clear = 1 THEN NULL ELSE ISNULL(@RelevanceScore, NULL) END,
                ISNULL(@RankingMode, N'none'),
                CASE WHEN @CitationOrdinal_Clear = 1 THEN NULL ELSE ISNULL(@CitationOrdinal, NULL) END,
                ISNULL(@EstimatedTokens, 0),
                ISNULL(@WasTruncated, 0),
                ISNULL(@Sequence, 1)
            )
    END
    ELSE
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceAgentSourceReceipt]
            (
                [SpaceID],
                [SpaceChatID],
                [ConversationID],
                [ConversationDetailID],
                [AgentRunID],
                [SourceKind],
                [SpaceItemID],
                [ContentSourceID],
                [TargetEntityID],
                [TargetRecordID],
                [SourceTitle],
                [Band],
                [WasSupplied],
                [WasCited],
                [RetrievalRank],
                [RelevanceScore],
                [RankingMode],
                [CitationOrdinal],
                [EstimatedTokens],
                [WasTruncated],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @SpaceChatID,
                @ConversationID,
                @ConversationDetailID,
                CASE WHEN @AgentRunID_Clear = 1 THEN NULL ELSE ISNULL(@AgentRunID, NULL) END,
                @SourceKind,
                CASE WHEN @SpaceItemID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceItemID, NULL) END,
                CASE WHEN @ContentSourceID_Clear = 1 THEN NULL ELSE ISNULL(@ContentSourceID, NULL) END,
                CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE ISNULL(@TargetEntityID, NULL) END,
                CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE ISNULL(@TargetRecordID, NULL) END,
                @SourceTitle,
                @Band,
                ISNULL(@WasSupplied, 1),
                ISNULL(@WasCited, 0),
                CASE WHEN @RetrievalRank_Clear = 1 THEN NULL ELSE ISNULL(@RetrievalRank, NULL) END,
                CASE WHEN @RelevanceScore_Clear = 1 THEN NULL ELSE ISNULL(@RelevanceScore, NULL) END,
                ISNULL(@RankingMode, N'none'),
                CASE WHEN @CitationOrdinal_Clear = 1 THEN NULL ELSE ISNULL(@CitationOrdinal, NULL) END,
                ISNULL(@EstimatedTokens, 0),
                ISNULL(@WasTruncated, 0),
                ISNULL(@Sequence, 1)
            )
    END

    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceAgentSourceReceipts] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAgentSourceReceipt] TO [cdp_Developer], [cdp_Integration];
GO

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Agent Source Receipts */
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceAgentSourceReceipt]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAgentSourceReceipt];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAgentSourceReceipt]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @SpaceChatID uniqueidentifier = NULL,
    @ConversationID uniqueidentifier = NULL,
    @ConversationDetailID uniqueidentifier = NULL,
    @AgentRunID_Clear bit = 0,
    @AgentRunID uniqueidentifier = NULL,
    @SourceKind nvarchar(30) = NULL,
    @SpaceItemID_Clear bit = 0,
    @SpaceItemID uniqueidentifier = NULL,
    @ContentSourceID_Clear bit = 0,
    @ContentSourceID uniqueidentifier = NULL,
    @TargetEntityID_Clear bit = 0,
    @TargetEntityID uniqueidentifier = NULL,
    @TargetRecordID_Clear bit = 0,
    @TargetRecordID nvarchar(450) = NULL,
    @SourceTitle nvarchar(500) = NULL,
    @Band nvarchar(20) = NULL,
    @WasSupplied bit = NULL,
    @WasCited bit = NULL,
    @RetrievalRank_Clear bit = 0,
    @RetrievalRank int = NULL,
    @RelevanceScore_Clear bit = 0,
    @RelevanceScore decimal(12, 6) = NULL,
    @RankingMode nvarchar(20) = NULL,
    @CitationOrdinal_Clear bit = 0,
    @CitationOrdinal int = NULL,
    @EstimatedTokens int = NULL,
    @WasTruncated bit = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAgentSourceReceipt]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [SpaceChatID] = ISNULL(@SpaceChatID, [SpaceChatID]),
        [ConversationID] = ISNULL(@ConversationID, [ConversationID]),
        [ConversationDetailID] = ISNULL(@ConversationDetailID, [ConversationDetailID]),
        [AgentRunID] = CASE WHEN @AgentRunID_Clear = 1 THEN NULL ELSE ISNULL(@AgentRunID, [AgentRunID]) END,
        [SourceKind] = ISNULL(@SourceKind, [SourceKind]),
        [SpaceItemID] = CASE WHEN @SpaceItemID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceItemID, [SpaceItemID]) END,
        [ContentSourceID] = CASE WHEN @ContentSourceID_Clear = 1 THEN NULL ELSE ISNULL(@ContentSourceID, [ContentSourceID]) END,
        [TargetEntityID] = CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE ISNULL(@TargetEntityID, [TargetEntityID]) END,
        [TargetRecordID] = CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE ISNULL(@TargetRecordID, [TargetRecordID]) END,
        [SourceTitle] = ISNULL(@SourceTitle, [SourceTitle]),
        [Band] = ISNULL(@Band, [Band]),
        [WasSupplied] = ISNULL(@WasSupplied, [WasSupplied]),
        [WasCited] = ISNULL(@WasCited, [WasCited]),
        [RetrievalRank] = CASE WHEN @RetrievalRank_Clear = 1 THEN NULL ELSE ISNULL(@RetrievalRank, [RetrievalRank]) END,
        [RelevanceScore] = CASE WHEN @RelevanceScore_Clear = 1 THEN NULL ELSE ISNULL(@RelevanceScore, [RelevanceScore]) END,
        [RankingMode] = ISNULL(@RankingMode, [RankingMode]),
        [CitationOrdinal] = CASE WHEN @CitationOrdinal_Clear = 1 THEN NULL ELSE ISNULL(@CitationOrdinal, [CitationOrdinal]) END,
        [EstimatedTokens] = ISNULL(@EstimatedTokens, [EstimatedTokens]),
        [WasTruncated] = ISNULL(@WasTruncated, [WasTruncated]),
        [Sequence] = ISNULL(@Sequence, [Sequence])
    WHERE
        [ID] = @ID

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceAgentSourceReceipts] WHERE 1=0
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwSpaceAgentSourceReceipts] WHERE [ID] = @ID
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAgentSourceReceipt] TO [cdp_Developer], [cdp_Integration];
GO

/* TRIGGER FOR __mj_UpdatedAt field for SpaceAgentSourceReceipt */
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceAgentSourceReceipt]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceAgentSourceReceipt];
GO

CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceAgentSourceReceipt
ON [${flyway:defaultSchema}].[SpaceAgentSourceReceipt]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAgentSourceReceipt]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceAgentSourceReceipt] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spDelete SQL for MJ_BizApps_Collaboration: Space Agent Source Receipts */
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceAgentSourceReceipt]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAgentSourceReceipt];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAgentSourceReceipt]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceAgentSourceReceipt]
    WHERE
        [ID] = @ID

    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID]
    ELSE
        SELECT @ID AS [ID]
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAgentSourceReceipt] TO [cdp_Developer], [cdp_Integration];
GO
