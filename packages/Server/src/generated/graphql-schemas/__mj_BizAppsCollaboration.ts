/********************************************************************************
* ALL ENTITIES - TypeGraphQL Type Class Definition - AUTO GENERATED FILE
* Generated Entities and Resolvers for Server
*
*   >>> DO NOT MODIFY THIS FILE!!!!!!!!!!!!
*   >>> YOUR CHANGES WILL BE OVERWRITTEN
*   >>> THE NEXT TIME THIS FILE IS GENERATED
*
**********************************************************************************/
import { Arg, Ctx, Int, Query, Resolver, Field, Float, ObjectType, InputType, Mutation,
            PubSub, PubSubEngine, ResolverBase, RunViewByIDInput, RunViewByNameInput, RunDynamicViewInput,
            AppContext, KeyValuePairInput, DeleteOptionsInput, GraphQLTimestamp as Timestamp,
            GetReadOnlyProvider, GetReadWriteProvider, RestoreContextInput } from '@memberjunction/server';
import { Metadata, EntityPermissionType, CompositeKey, UserInfo } from '@memberjunction/core'

import { MaxLength } from 'class-validator';
import * as mj_core_schema_server_object_types from '@memberjunction/server'


import { mjBizAppsCollaborationItemUseEntity, mjBizAppsCollaborationShareNoticeEntity, mjBizAppsCollaborationSpaceAnchorEntity, mjBizAppsCollaborationSpaceChatEntity, mjBizAppsCollaborationSpaceGrantEntity, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceMemberPinEntity, mjBizAppsCollaborationSpaceMemberEntity, mjBizAppsCollaborationSpaceNoteEntity, mjBizAppsCollaborationSpaceRoleTypeEntity, mjBizAppsCollaborationSpaceTypeStatusEntity, mjBizAppsCollaborationSpaceTypeEntity, mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
    

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Item Uses
//****************************************************************************
@ObjectType({ description: `A record that a member opened, uploaded, or promoted an item.` })
export class mjBizAppsCollaborationItemUse_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The space item that was used.`}) 
    @MaxLength(36)
    ItemID?: string;
        
    @Field({nullable: true, description: `The member who opened, uploaded, or promoted the item.`}) 
    @MaxLength(36)
    UserID?: string;
        
    @Field({nullable: true, description: `When the use happened.`}) 
    UsedAt?: Date;
        
    @Field({nullable: true, description: `open, upload, or promote.`}) 
    @MaxLength(20)
    Kind?: string;
        
    @Field({nullable: true, description: `The space the use happened in. Required so the read filter can keep the row inside spaces the caller reaches.`}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    User?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Item Uses
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationItemUseInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    ItemID?: string;

    @Field({ nullable: true })
    UserID?: string;

    @Field({ nullable: true })
    UsedAt?: Date;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Item Uses
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationItemUseInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    ItemID?: string;

    @Field({ nullable: true })
    UserID?: string;

    @Field({ nullable: true })
    UsedAt?: Date;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Item Uses
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationItemUseViewResult {
    @Field(() => [mjBizAppsCollaborationItemUse_])
    Results: mjBizAppsCollaborationItemUse_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationItemUse_)
export class mjBizAppsCollaborationItemUseResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationItemUseViewResult)
    async RunmjBizAppsCollaborationItemUseViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationItemUseViewResult)
    async RunmjBizAppsCollaborationItemUseViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationItemUseViewResult)
    async RunmjBizAppsCollaborationItemUseDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Item Uses';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationItemUse_, { nullable: true })
    async mjBizAppsCollaborationItemUse(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationItemUse_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Item Uses', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwItemUses')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Item Uses', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Item Uses', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationItemUse_)
    async CreatemjBizAppsCollaborationItemUse(
        @Arg('input', () => CreatemjBizAppsCollaborationItemUseInput) input: CreatemjBizAppsCollaborationItemUseInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Item Uses', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationItemUse_)
    async UpdatemjBizAppsCollaborationItemUse(
        @Arg('input', () => UpdatemjBizAppsCollaborationItemUseInput) input: UpdatemjBizAppsCollaborationItemUseInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Item Uses', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationItemUse_)
    async DeletemjBizAppsCollaborationItemUse(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Item Uses', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Share Notices
//****************************************************************************
@ObjectType({ description: `A notice that an item in this space was shared with a member.` })
export class mjBizAppsCollaborationShareNotice_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The space the notice belongs to. The read filter keeps a caller inside spaces they reach.`}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true, description: `The space item that was shared.`}) 
    @MaxLength(36)
    ItemID?: string;
        
    @Field({nullable: true, description: `The member the notice is for.`}) 
    @MaxLength(36)
    RecipientUserID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    RecipientUser?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Share Notices
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationShareNoticeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    ItemID?: string;

    @Field({ nullable: true })
    RecipientUserID?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Share Notices
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationShareNoticeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    ItemID?: string;

    @Field({ nullable: true })
    RecipientUserID?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Share Notices
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationShareNoticeViewResult {
    @Field(() => [mjBizAppsCollaborationShareNotice_])
    Results: mjBizAppsCollaborationShareNotice_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationShareNotice_)
export class mjBizAppsCollaborationShareNoticeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationShareNoticeViewResult)
    async RunmjBizAppsCollaborationShareNoticeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationShareNoticeViewResult)
    async RunmjBizAppsCollaborationShareNoticeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationShareNoticeViewResult)
    async RunmjBizAppsCollaborationShareNoticeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Share Notices';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationShareNotice_, { nullable: true })
    async mjBizAppsCollaborationShareNotice(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationShareNotice_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Share Notices', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwShareNotices')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Share Notices', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Share Notices', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationShareNotice_)
    async CreatemjBizAppsCollaborationShareNotice(
        @Arg('input', () => CreatemjBizAppsCollaborationShareNoticeInput) input: CreatemjBizAppsCollaborationShareNoticeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Share Notices', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationShareNotice_)
    async UpdatemjBizAppsCollaborationShareNotice(
        @Arg('input', () => UpdatemjBizAppsCollaborationShareNoticeInput) input: UpdatemjBizAppsCollaborationShareNoticeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Share Notices', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationShareNotice_)
    async DeletemjBizAppsCollaborationShareNotice(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Share Notices', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Anchors
//****************************************************************************
@ObjectType({ description: `A record a space is about (D26: a space may have several). The primary anchor is the one EnsureSpaceForRecord finds a space by; one per space, and one space per (type, record) as primary.` })
export class mjBizAppsCollaborationSpaceAnchor_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The space.`}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true, description: `The space's type, denormalized so the primary-per-type index can hold; the server keeps it equal to the space's and rewrites it when the type changes.`}) 
    @MaxLength(36)
    SpaceTypeID?: string;
        
    @Field({nullable: true, description: `The entity of the anchored record.`}) 
    @MaxLength(36)
    EntityID?: string;
        
    @Field({nullable: true, description: `The record's key, in the canonical shape SpaceItem.RecordID uses.`}) 
    @MaxLength(450)
    RecordID?: string;
        
    @Field({nullable: true, description: `What the record is to the space, in the type's vocabulary: chapter, sponsor, event. Data reach (D28) names an anchor by this role.`}) 
    @MaxLength(100)
    Role?: string;
        
    @Field(() => Boolean, {nullable: true, description: `The one anchor a space is found by. At most one per space.`}) 
    IsPrimary?: boolean;
        
    @Field(() => Int, {nullable: true, description: `Display order among the space's anchors.`}) 
    Sequence?: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SpaceType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Entity?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Anchors
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceAnchorInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    SpaceTypeID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    Role?: string;

    @Field(() => Boolean, { nullable: true })
    IsPrimary?: boolean;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Anchors
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceAnchorInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    SpaceTypeID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    Role?: string;

    @Field(() => Boolean, { nullable: true })
    IsPrimary?: boolean;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Anchors
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceAnchorViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceAnchor_])
    Results: mjBizAppsCollaborationSpaceAnchor_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceAnchor_)
export class mjBizAppsCollaborationSpaceAnchorResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceAnchorViewResult)
    async RunmjBizAppsCollaborationSpaceAnchorViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceAnchorViewResult)
    async RunmjBizAppsCollaborationSpaceAnchorViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceAnchorViewResult)
    async RunmjBizAppsCollaborationSpaceAnchorDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Anchors';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceAnchor_, { nullable: true })
    async mjBizAppsCollaborationSpaceAnchor(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceAnchor_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Anchors', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceAnchors')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Anchors', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Anchors', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceAnchor_)
    async CreatemjBizAppsCollaborationSpaceAnchor(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceAnchorInput) input: CreatemjBizAppsCollaborationSpaceAnchorInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Anchors', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceAnchor_)
    async UpdatemjBizAppsCollaborationSpaceAnchor(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceAnchorInput) input: UpdatemjBizAppsCollaborationSpaceAnchorInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Anchors', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceAnchor_)
    async DeletemjBizAppsCollaborationSpaceAnchor(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Anchors', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Chats
//****************************************************************************
@ObjectType()
export class mjBizAppsCollaborationSpaceChat_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ConversationID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Name?: string;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    Subject?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Kind?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Status?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Boolean, {nullable: true, description: `Indicates whether this space chat conversation was archived when its space was closed so it can be restored on reopen.`}) 
    ArchivedOnSpaceClose?: boolean;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Conversation?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Chats
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceChatInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    ConversationID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Subject: string | null;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Boolean, { nullable: true })
    ArchivedOnSpaceClose?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Chats
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceChatInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    ConversationID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Subject?: string | null;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => Boolean, { nullable: true })
    ArchivedOnSpaceClose?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Chats
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceChatViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceChat_])
    Results: mjBizAppsCollaborationSpaceChat_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceChat_)
export class mjBizAppsCollaborationSpaceChatResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceChatViewResult)
    async RunmjBizAppsCollaborationSpaceChatViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceChatViewResult)
    async RunmjBizAppsCollaborationSpaceChatViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceChatViewResult)
    async RunmjBizAppsCollaborationSpaceChatDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Chats';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceChat_, { nullable: true })
    async mjBizAppsCollaborationSpaceChat(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceChat_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Chats', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceChats')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Chats', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Chats', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceChat_)
    async CreatemjBizAppsCollaborationSpaceChat(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceChatInput) input: CreatemjBizAppsCollaborationSpaceChatInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Chats', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceChat_)
    async UpdatemjBizAppsCollaborationSpaceChat(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceChatInput) input: UpdatemjBizAppsCollaborationSpaceChatInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Chats', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceChat_)
    async DeletemjBizAppsCollaborationSpaceChat(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Chats', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Grants
//****************************************************************************
@ObjectType({ description: `Something the app, a space type or a space offers in its spaces (D27\'s seven kinds): an agent, an action, a query, a view, a dashboard, a component or a knowledge source, with the band that may use it, bindings from the space to the target\'s parameters, and an agent\'s narrowed settings. Replaces SpaceAgent, SpaceAgentSkill and SpaceKnowledgeSource.` })
export class mjBizAppsCollaborationSpaceGrant_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The type the grant belongs to; null with SpaceID null is the app's own row.`}) 
    @MaxLength(36)
    SpaceTypeID?: string;
        
    @Field({nullable: true, description: `The space the grant belongs to; never set together with SpaceTypeID.`}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true, description: `Agent, Action, Query, View, Dashboard, Component or KnowledgeSource. TargetEntityID must be the kind's entity.`}) 
    @MaxLength(30)
    Kind?: string;
        
    @Field({nullable: true, description: `The target's entity: MJ: AI Agents, MJ: Actions, MJ: Queries, MJ: User Views, MJ: Dashboards, MJ: Components or MJ: Content Sources, by Kind.`}) 
    @MaxLength(36)
    TargetEntityID?: string;
        
    @Field({nullable: true, description: `The target record's key.`}) 
    @MaxLength(450)
    TargetRecordID?: string;
        
    @Field({nullable: true, description: `What the space calls the target; null uses the target's own name.`}) 
    @MaxLength(200)
    Label?: string;
        
    @Field({nullable: true, description: `The band that may use the grant (D31). A Team grant is not offered in a chat where anyone cannot see Team.`}) 
    @MaxLength(10)
    Band?: string;
        
    @Field(() => Boolean, {nullable: true, description: `For an Agent grant: the agent a chat at this level starts with. One per level.`}) 
    IsDefault?: boolean;
        
    @Field({nullable: true, description: `JSON (SpaceGrantBindings): the target's parameter or property names mapped to where each value comes from: an anchor by role, a column of the space, a configuration key, the user, or a literal (D27).`}) 
    Bindings?: string;
        
    @Field({nullable: true, description: `JSON (AgentGrantSettings) for an Agent grant: skills, plan mode, effort, memory writes and per-run limits, each only narrowing the agent's own definition (D31). Null for the other kinds.`}) 
    Settings?: string;
        
    @Field({nullable: true, description: `Extend adds the target at this level; Remove takes a target granted above out of this level's list (D30).`}) 
    @MaxLength(10)
    Mode?: string;
        
    @Field(() => Int, {nullable: true, description: `Display order within the level.`}) 
    Sequence?: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SpaceType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    TargetEntity?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Grants
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceGrantInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceTypeID: string | null;

    @Field({ nullable: true })
    SpaceID: string | null;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    TargetEntityID?: string;

    @Field({ nullable: true })
    TargetRecordID?: string;

    @Field({ nullable: true })
    Label: string | null;

    @Field({ nullable: true })
    Band?: string;

    @Field(() => Boolean, { nullable: true })
    IsDefault?: boolean;

    @Field({ nullable: true })
    Bindings: string | null;

    @Field({ nullable: true })
    Settings: string | null;

    @Field({ nullable: true })
    Mode?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Grants
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceGrantInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceTypeID?: string | null;

    @Field({ nullable: true })
    SpaceID?: string | null;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    TargetEntityID?: string;

    @Field({ nullable: true })
    TargetRecordID?: string;

    @Field({ nullable: true })
    Label?: string | null;

    @Field({ nullable: true })
    Band?: string;

    @Field(() => Boolean, { nullable: true })
    IsDefault?: boolean;

    @Field({ nullable: true })
    Bindings?: string | null;

    @Field({ nullable: true })
    Settings?: string | null;

    @Field({ nullable: true })
    Mode?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Grants
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceGrantViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceGrant_])
    Results: mjBizAppsCollaborationSpaceGrant_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceGrant_)
export class mjBizAppsCollaborationSpaceGrantResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceGrantViewResult)
    async RunmjBizAppsCollaborationSpaceGrantViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceGrantViewResult)
    async RunmjBizAppsCollaborationSpaceGrantViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceGrantViewResult)
    async RunmjBizAppsCollaborationSpaceGrantDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Grants';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceGrant_, { nullable: true })
    async mjBizAppsCollaborationSpaceGrant(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceGrant_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Grants', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceGrants')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Grants', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Grants', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceGrant_)
    async CreatemjBizAppsCollaborationSpaceGrant(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceGrantInput) input: CreatemjBizAppsCollaborationSpaceGrantInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Grants', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceGrant_)
    async UpdatemjBizAppsCollaborationSpaceGrant(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceGrantInput) input: UpdatemjBizAppsCollaborationSpaceGrantInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Grants', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceGrant_)
    async DeletemjBizAppsCollaborationSpaceGrant(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Grants', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Items
//****************************************************************************
@ObjectType({ description: `An item in exactly one space: EntityID + RecordID, plus Team or Shared. Unique on (EntityID, RecordID) so an item cannot have two parents.` })
export class mjBizAppsCollaborationSpaceItem_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true, description: `The entity the item points at. Same polymorphic pair TaskLink uses.`}) 
    @MaxLength(36)
    EntityID?: string;
        
    @Field({nullable: true, description: `Primary key of the pointed-at record, as text, matching TaskLink.RecordID.`}) 
    @MaxLength(450)
    RecordID?: string;
        
    @Field({nullable: true, description: `Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).`}) 
    @MaxLength(20)
    Band?: string;
        
    @Field({nullable: true, description: `When a Shared item was promoted. Null on Team items.`}) 
    PromotedAt?: Date;
        
    @Field({nullable: true, description: `MJ user who promoted a Shared item. Required together with PromotedAt. Null on Team items.`}) 
    @MaxLength(36)
    PromotedByUserID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true, description: `Folder label inside the space. Null means Unfiled. Collections cannot say everyone in the space, so the folder lives on the item.`}) 
    @MaxLength(200)
    Folder?: string;
        
    @Field({nullable: true, description: `For a document in the Library: the MJ Artifact Version (ContentMode File) wrapping the MJ: Files row the item points at, so the document has a type, a viewer and versions. NULL for items that are not files. Artifact Permissions are not used by the Library; the roster is the one sharing model.`}) 
    @MaxLength(36)
    ArtifactVersionID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Entity?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    PromotedByUser?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    ArtifactVersion?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Items
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceItemInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    PromotedAt: Date | null;

    @Field({ nullable: true })
    PromotedByUserID: string | null;

    @Field({ nullable: true })
    Folder: string | null;

    @Field({ nullable: true })
    ArtifactVersionID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Items
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceItemInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    EntityID?: string;

    @Field({ nullable: true })
    RecordID?: string;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    PromotedAt?: Date | null;

    @Field({ nullable: true })
    PromotedByUserID?: string | null;

    @Field({ nullable: true })
    Folder?: string | null;

    @Field({ nullable: true })
    ArtifactVersionID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Items
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceItemViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceItem_])
    Results: mjBizAppsCollaborationSpaceItem_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceItem_)
export class mjBizAppsCollaborationSpaceItemResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceItemViewResult)
    async RunmjBizAppsCollaborationSpaceItemViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceItemViewResult)
    async RunmjBizAppsCollaborationSpaceItemViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceItemViewResult)
    async RunmjBizAppsCollaborationSpaceItemDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Items';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceItem_, { nullable: true })
    async mjBizAppsCollaborationSpaceItem(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceItem_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceItems')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Items', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceItem_)
    async CreatemjBizAppsCollaborationSpaceItem(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceItemInput) input: CreatemjBizAppsCollaborationSpaceItemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Items', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceItem_)
    async UpdatemjBizAppsCollaborationSpaceItem(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceItemInput) input: UpdatemjBizAppsCollaborationSpaceItemInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Items', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceItem_)
    async DeletemjBizAppsCollaborationSpaceItem(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Items', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Member Pins
//****************************************************************************
@ObjectType({ description: `Something a member keeps at the top of a space (B22): a record of the space (an item, a note, a task) or one of the space\'s grants (a view, a dashboard, a component). The member\'s own; Home lists pins from the spaces they still reach.` })
export class mjBizAppsCollaborationSpaceMemberPin_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The space the pin is in.`}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true, description: `Whose pin it is: the caller.`}) 
    @MaxLength(36)
    UserID?: string;
        
    @Field({nullable: true, description: `Record: a record of the space by entity and key. Grant: one of the space's grants.`}) 
    @MaxLength(20)
    Kind?: string;
        
    @Field({nullable: true, description: `For a Record pin: the record's entity.`}) 
    @MaxLength(36)
    TargetEntityID?: string;
        
    @Field({nullable: true, description: `For a Record pin: the record's key.`}) 
    @MaxLength(450)
    TargetRecordID?: string;
        
    @Field({nullable: true, description: `For a Grant pin: the grant in force for the member's space and band.`}) 
    @MaxLength(36)
    GrantID?: string;
        
    @Field(() => Int, {nullable: true, description: `The member's order of pins.`}) 
    Sequence?: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    User?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    TargetEntity?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Member Pins
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceMemberPinInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    UserID?: string;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    TargetEntityID: string | null;

    @Field({ nullable: true })
    TargetRecordID: string | null;

    @Field({ nullable: true })
    GrantID: string | null;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Member Pins
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceMemberPinInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    UserID?: string;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    TargetEntityID?: string | null;

    @Field({ nullable: true })
    TargetRecordID?: string | null;

    @Field({ nullable: true })
    GrantID?: string | null;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Member Pins
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceMemberPinViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceMemberPin_])
    Results: mjBizAppsCollaborationSpaceMemberPin_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceMemberPin_)
export class mjBizAppsCollaborationSpaceMemberPinResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceMemberPinViewResult)
    async RunmjBizAppsCollaborationSpaceMemberPinViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceMemberPinViewResult)
    async RunmjBizAppsCollaborationSpaceMemberPinViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceMemberPinViewResult)
    async RunmjBizAppsCollaborationSpaceMemberPinDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Member Pins';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceMemberPin_, { nullable: true })
    async mjBizAppsCollaborationSpaceMemberPin(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceMemberPin_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Member Pins', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceMemberPins')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Member Pins', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Member Pins', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceMemberPin_)
    async CreatemjBizAppsCollaborationSpaceMemberPin(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceMemberPinInput) input: CreatemjBizAppsCollaborationSpaceMemberPinInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Member Pins', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceMemberPin_)
    async UpdatemjBizAppsCollaborationSpaceMemberPin(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceMemberPinInput) input: UpdatemjBizAppsCollaborationSpaceMemberPinInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Member Pins', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceMemberPin_)
    async DeletemjBizAppsCollaborationSpaceMemberPin(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Member Pins', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Members
//****************************************************************************
@ObjectType({ description: `One roster row per user per space. Staff and outsiders are both MJ users. Status Active is the row the membership filter accepts.` })
export class mjBizAppsCollaborationSpaceMember_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    UserID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceRoleTypeID?: string;
        
    @Field({nullable: true, description: `Team or Shared. Set by the server from the role: CanSeeTeamBand seats the person on Team, otherwise Shared. The filter reads the role, not this column.`}) 
    @MaxLength(20)
    Band?: string;
        
    @Field({nullable: true, description: `Invited, Active, or Removed. New rows start Invited unless the type auto-approves.`}) 
    @MaxLength(20)
    Status?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    SyncSource?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    PersonID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    User?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SpaceRoleType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(201)
    Person?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Members
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceMemberInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    UserID?: string;

    @Field({ nullable: true })
    SpaceRoleTypeID?: string;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    SyncSource: string | null;

    @Field({ nullable: true })
    PersonID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Members
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceMemberInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    UserID?: string;

    @Field({ nullable: true })
    SpaceRoleTypeID?: string;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    Status?: string;

    @Field({ nullable: true })
    SyncSource?: string | null;

    @Field({ nullable: true })
    PersonID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Members
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceMemberViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceMember_])
    Results: mjBizAppsCollaborationSpaceMember_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceMember_)
export class mjBizAppsCollaborationSpaceMemberResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceMemberViewResult)
    async RunmjBizAppsCollaborationSpaceMemberViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceMemberViewResult)
    async RunmjBizAppsCollaborationSpaceMemberViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceMemberViewResult)
    async RunmjBizAppsCollaborationSpaceMemberDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Members';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceMember_, { nullable: true })
    async mjBizAppsCollaborationSpaceMember(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceMember_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Members', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceMembers')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Members', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Members', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceMember_)
    async CreatemjBizAppsCollaborationSpaceMember(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceMemberInput) input: CreatemjBizAppsCollaborationSpaceMemberInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Members', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceMember_)
    async UpdatemjBizAppsCollaborationSpaceMember(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceMemberInput) input: UpdatemjBizAppsCollaborationSpaceMemberInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Members', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceMember_)
    async DeletemjBizAppsCollaborationSpaceMember(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Members', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Notes
//****************************************************************************
@ObjectType({ description: `A light note in a space (B21): the space\'s own row on a band, not a library item, so the move-and-promote rules do not apply and it needs no ItemUse. Private notes are the author\'s alone.` })
export class mjBizAppsCollaborationSpaceNote_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The space the note belongs to.`}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true, description: `The note's title.`}) 
    @MaxLength(200)
    Title?: string;
        
    @Field({nullable: true, description: `The note's body, Markdown.`}) 
    Body?: string;
        
    @Field({nullable: true, description: `Team or Shared: who in the space may read it. A Team note moves to Shared only when the plan's call 15 allows it.`}) 
    @MaxLength(10)
    Band?: string;
        
    @Field({nullable: true, description: `Space: the band reads it. Private: the author alone, and then the band is Team.`}) 
    @MaxLength(10)
    Visibility?: string;
        
    @Field({nullable: true, description: `Who wrote the note: the caller on create, and the only one who edits or deletes it.`}) 
    @MaxLength(36)
    AuthorUserID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    AuthorUser?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Notes
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceNoteInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    Title?: string;

    @Field({ nullable: true })
    Body: string | null;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    Visibility?: string;

    @Field({ nullable: true })
    AuthorUserID?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Notes
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceNoteInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    Title?: string;

    @Field({ nullable: true })
    Body?: string | null;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    Visibility?: string;

    @Field({ nullable: true })
    AuthorUserID?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Notes
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceNoteViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceNote_])
    Results: mjBizAppsCollaborationSpaceNote_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceNote_)
export class mjBizAppsCollaborationSpaceNoteResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceNoteViewResult)
    async RunmjBizAppsCollaborationSpaceNoteViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceNoteViewResult)
    async RunmjBizAppsCollaborationSpaceNoteViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceNoteViewResult)
    async RunmjBizAppsCollaborationSpaceNoteDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Notes';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceNote_, { nullable: true })
    async mjBizAppsCollaborationSpaceNote(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceNote_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Notes', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceNotes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Notes', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Notes', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceNote_)
    async CreatemjBizAppsCollaborationSpaceNote(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceNoteInput) input: CreatemjBizAppsCollaborationSpaceNoteInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Notes', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceNote_)
    async UpdatemjBizAppsCollaborationSpaceNote(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceNoteInput) input: UpdatemjBizAppsCollaborationSpaceNoteInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Notes', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceNote_)
    async DeletemjBizAppsCollaborationSpaceNote(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Notes', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Role Types
//****************************************************************************
@ObjectType({ description: `What a space member is allowed to do. The engine reads Level and the BIT flags. It never compares Code or Name.` })
export class mjBizAppsCollaborationSpaceRoleType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Int, {nullable: true, description: `This role's own authority. A grant must be of a role whose Level is <= the grantor's MaxGrantableLevel.`}) 
    Level?: number;
        
    @Field(() => Int, {nullable: true, description: `Highest Level this role may grant. Always <= Level.`}) 
    MaxGrantableLevel?: number;
        
    @Field(() => Boolean, {nullable: true, description: `Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.`}) 
    CanInvite?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `Holder may move an item from Team to Shared.`}) 
    CanPromoteBand?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `Holder may read Team-band items. Shared-band items do not need this flag.`}) 
    CanSeeTeamBand?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `The role that defines ownership of a space. The engine reads the flag, not the name.`}) 
    IsOwnerRole?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Boolean, {nullable: true, description: `1 if the role may contribute content (create, update, or post items, tasks, and messages); 0 for read-only roles.`}) 
    CanContribute?: boolean;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Role Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceRoleTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Int, { nullable: true })
    Level?: number;

    @Field(() => Int, { nullable: true })
    MaxGrantableLevel?: number;

    @Field(() => Boolean, { nullable: true })
    CanInvite?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanPromoteBand?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanSeeTeamBand?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsOwnerRole?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanContribute?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Role Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceRoleTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Int, { nullable: true })
    Level?: number;

    @Field(() => Int, { nullable: true })
    MaxGrantableLevel?: number;

    @Field(() => Boolean, { nullable: true })
    CanInvite?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanPromoteBand?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanSeeTeamBand?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsOwnerRole?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanContribute?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Role Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceRoleTypeViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceRoleType_])
    Results: mjBizAppsCollaborationSpaceRoleType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceRoleType_)
export class mjBizAppsCollaborationSpaceRoleTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceRoleTypeViewResult)
    async RunmjBizAppsCollaborationSpaceRoleTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceRoleTypeViewResult)
    async RunmjBizAppsCollaborationSpaceRoleTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceRoleTypeViewResult)
    async RunmjBizAppsCollaborationSpaceRoleTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Role Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceRoleType_, { nullable: true })
    async mjBizAppsCollaborationSpaceRoleType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceRoleType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Role Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceRoleTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Role Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Role Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceRoleType_)
    async CreatemjBizAppsCollaborationSpaceRoleType(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceRoleTypeInput) input: CreatemjBizAppsCollaborationSpaceRoleTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Role Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceRoleType_)
    async UpdatemjBizAppsCollaborationSpaceRoleType(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceRoleTypeInput) input: UpdatemjBizAppsCollaborationSpaceRoleTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Role Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceRoleType_)
    async DeletemjBizAppsCollaborationSpaceRoleType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Role Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Type Status
//****************************************************************************
@ObjectType({ description: `A status a space type offers its spaces: Active, Paused, Closed and Archived ship for every type; a type may add its own. A space is in exactly one of its type\'s statuses (Space.StatusID) and may only choose among them. The attributes say what a space in the status allows; the type\'s driver may still refuse a change.` })
export class mjBizAppsCollaborationSpaceTypeStatus_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The type this status belongs to.`}) 
    @MaxLength(36)
    SpaceTypeID?: string;
        
    @Field({nullable: true, description: `The status's key within its type: active, paused, closed, archived, or a type's own.`}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true, description: `What the status is called on screen.`}) 
    @MaxLength(100)
    Name?: string;
        
    @Field(() => Int, {nullable: true, description: `The definitive order of the type's statuses, for display and for the rule that a terminal status may only move forward.`}) 
    Sequence?: number;
        
    @Field(() => Boolean, {nullable: true, description: `The status a new space of the type starts in; one per type.`}) 
    IsDefault?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `Members may read but not post, upload, assign or edit while the space is in this status.`}) 
    ReadOnly?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `The space is listed and reachable by its members; off hides it from everyone but its owner and staff.`}) 
    Visible?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `An agent may quote the space's material while it is in this status.`}) 
    AgentRetrieval?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `Once a space reaches this status it may still move to another; off freezes it there. A frozen status must be terminal.`}) 
    CanChangeAfter?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `Entering this status sends the space's "status changed" notice, one per member, through MJ's notification chain.`}) 
    NotifyMembersOnEnter?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `Entering this status stamps Space.ClosedAt; retention and the closed views count from it. From a terminal status a space may move only to a higher Sequence, never back to an open one.`}) 
    IsTerminal?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SpaceType?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Type Status
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceTypeStatusInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceTypeID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => Boolean, { nullable: true })
    IsDefault?: boolean;

    @Field(() => Boolean, { nullable: true })
    ReadOnly?: boolean;

    @Field(() => Boolean, { nullable: true })
    Visible?: boolean;

    @Field(() => Boolean, { nullable: true })
    AgentRetrieval?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanChangeAfter?: boolean;

    @Field(() => Boolean, { nullable: true })
    NotifyMembersOnEnter?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsTerminal?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Type Status
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceTypeStatusInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceTypeID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field(() => Int, { nullable: true })
    Sequence?: number;

    @Field(() => Boolean, { nullable: true })
    IsDefault?: boolean;

    @Field(() => Boolean, { nullable: true })
    ReadOnly?: boolean;

    @Field(() => Boolean, { nullable: true })
    Visible?: boolean;

    @Field(() => Boolean, { nullable: true })
    AgentRetrieval?: boolean;

    @Field(() => Boolean, { nullable: true })
    CanChangeAfter?: boolean;

    @Field(() => Boolean, { nullable: true })
    NotifyMembersOnEnter?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsTerminal?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Type Status
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceTypeStatusViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceTypeStatus_])
    Results: mjBizAppsCollaborationSpaceTypeStatus_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceTypeStatus_)
export class mjBizAppsCollaborationSpaceTypeStatusResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceTypeStatusViewResult)
    async RunmjBizAppsCollaborationSpaceTypeStatusViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceTypeStatusViewResult)
    async RunmjBizAppsCollaborationSpaceTypeStatusViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceTypeStatusViewResult)
    async RunmjBizAppsCollaborationSpaceTypeStatusDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Type Status';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceTypeStatus_, { nullable: true })
    async mjBizAppsCollaborationSpaceTypeStatus(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceTypeStatus_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Type Status', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceTypeStatus')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Type Status', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Type Status', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceTypeStatus_)
    async CreatemjBizAppsCollaborationSpaceTypeStatus(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceTypeStatusInput) input: CreatemjBizAppsCollaborationSpaceTypeStatusInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Type Status', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceTypeStatus_)
    async UpdatemjBizAppsCollaborationSpaceTypeStatus(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceTypeStatusInput) input: UpdatemjBizAppsCollaborationSpaceTypeStatusInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Type Status', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceTypeStatus_)
    async DeletemjBizAppsCollaborationSpaceTypeStatus(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Type Status', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Space Types
//****************************************************************************
@ObjectType({ description: `Kind of space: vocabulary, which panels are on, retention and agent defaults, and how outsiders join. Behavior lives in these columns, not in code branched on the name.` })
export class mjBizAppsCollaborationSpaceType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `Stable metadata key. The engine does not branch on it.`}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true, description: `Display name of the type.`}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true, description: `Human noun for spaces of this type (workspace, committee, cohort, community). Open set.`}) 
    @MaxLength(50)
    Vocabulary?: string;
        
    @Field({nullable: true, description: `Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.`}) 
    @MaxLength(20)
    Discoverability?: string;
        
    @Field({nullable: true, description: `InviteOnly, RequestToJoin, or SelfServe.`}) 
    @MaxLength(20)
    JoinMode?: string;
        
    @Field(() => Boolean, {nullable: true, description: `Conversation panel is on for spaces of this type.`}) 
    MessagingPanel?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `File library panel is on.`}) 
    LibraryPanel?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: `Task / work panel is on.`}) 
    WorkPanel?: boolean;
        
    @Field({nullable: true, description: `Default AgentRetrieval for a new space of this type.`}) 
    @MaxLength(30)
    DefaultAgentRetrieval?: string;
        
    @Field({nullable: true, description: `Default Team or Shared band for a new item in a space of this type.`}) 
    @MaxLength(20)
    DefaultBand?: string;
        
    @Field({nullable: true, description: `Approve: a new member stays Invited until an owner of the space sets them Active. AutoApprove: the server creates the member Active. The invited person does not activate themselves.`}) 
    @MaxLength(20)
    InviteApproval?: string;
        
    @Field(() => Int, {nullable: true, description: `Maximum members in one space of this type. Null means no cap.`}) 
    MemberCap?: number;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Boolean, {nullable: true, description: `Default AllowParentAssignees setting for new spaces of this type.`}) 
    DefaultAllowParentAssignees?: boolean;
        
    @Field({nullable: true, description: `Font Awesome icon class representing the space type (e.g., fa-solid fa-compass).`}) 
    @MaxLength(100)
    IconClass?: string;
        
    @Field({nullable: true, description: `Hex color code representing the space type (e.g., #0076b6).`}) 
    @MaxLength(50)
    Color?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    ServerDriverClass?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    UIDriverClass?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    SpaceExtensionEntity?: string;
        
    @Field({nullable: true}) 
    Configuration?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    Vocabulary?: string;

    @Field({ nullable: true })
    Discoverability?: string;

    @Field({ nullable: true })
    JoinMode?: string;

    @Field(() => Boolean, { nullable: true })
    MessagingPanel?: boolean;

    @Field(() => Boolean, { nullable: true })
    LibraryPanel?: boolean;

    @Field(() => Boolean, { nullable: true })
    WorkPanel?: boolean;

    @Field({ nullable: true })
    DefaultAgentRetrieval?: string;

    @Field({ nullable: true })
    DefaultBand?: string;

    @Field({ nullable: true })
    InviteApproval?: string;

    @Field(() => Int, { nullable: true })
    MemberCap: number | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => Boolean, { nullable: true })
    DefaultAllowParentAssignees?: boolean;

    @Field({ nullable: true })
    IconClass: string | null;

    @Field({ nullable: true })
    Color: string | null;

    @Field({ nullable: true })
    ServerDriverClass: string | null;

    @Field({ nullable: true })
    UIDriverClass: string | null;

    @Field({ nullable: true })
    SpaceExtensionEntity: string | null;

    @Field({ nullable: true })
    Configuration: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Space Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    Vocabulary?: string;

    @Field({ nullable: true })
    Discoverability?: string;

    @Field({ nullable: true })
    JoinMode?: string;

    @Field(() => Boolean, { nullable: true })
    MessagingPanel?: boolean;

    @Field(() => Boolean, { nullable: true })
    LibraryPanel?: boolean;

    @Field(() => Boolean, { nullable: true })
    WorkPanel?: boolean;

    @Field({ nullable: true })
    DefaultAgentRetrieval?: string;

    @Field({ nullable: true })
    DefaultBand?: string;

    @Field({ nullable: true })
    InviteApproval?: string;

    @Field(() => Int, { nullable: true })
    MemberCap?: number | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => Boolean, { nullable: true })
    DefaultAllowParentAssignees?: boolean;

    @Field({ nullable: true })
    IconClass?: string | null;

    @Field({ nullable: true })
    Color?: string | null;

    @Field({ nullable: true })
    ServerDriverClass?: string | null;

    @Field({ nullable: true })
    UIDriverClass?: string | null;

    @Field({ nullable: true })
    SpaceExtensionEntity?: string | null;

    @Field({ nullable: true })
    Configuration?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Space Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceTypeViewResult {
    @Field(() => [mjBizAppsCollaborationSpaceType_])
    Results: mjBizAppsCollaborationSpaceType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpaceType_)
export class mjBizAppsCollaborationSpaceTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceTypeViewResult)
    async RunmjBizAppsCollaborationSpaceTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceTypeViewResult)
    async RunmjBizAppsCollaborationSpaceTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceTypeViewResult)
    async RunmjBizAppsCollaborationSpaceTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Space Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpaceType_, { nullable: true })
    async mjBizAppsCollaborationSpaceType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpaceType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceType_)
    async CreatemjBizAppsCollaborationSpaceType(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceTypeInput) input: CreatemjBizAppsCollaborationSpaceTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Space Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpaceType_)
    async UpdatemjBizAppsCollaborationSpaceType(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceTypeInput) input: UpdatemjBizAppsCollaborationSpaceTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Space Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpaceType_)
    async DeletemjBizAppsCollaborationSpaceType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Space Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Spaces
//****************************************************************************
@ObjectType({ description: `The container. Permission boundary and agent retrieval boundary, as a tree: one root per relationship, sub-spaces for the work inside it.` })
export class mjBizAppsCollaborationSpace_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceTypeID?: string;
        
    @Field({nullable: true, description: `Parent space. Null on a root. It does not carry the IsHierarchy flag, so CodeGen emits no path columns.`}) 
    @MaxLength(36)
    ParentID?: string;
        
    @Field({nullable: true, description: `Designated name of the space.`}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true, description: `MJ user who owns the space.`}) 
    @MaxLength(36)
    OwnerID?: string;
        
    @Field(() => Boolean, {nullable: true, description: `1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.`}) 
    InheritsMembership?: boolean;
        
    @Field({nullable: true, description: `Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.`}) 
    @MaxLength(30)
    AgentRetrieval?: string;
        
    @Field({nullable: true, description: `When this space (usually a sub-space) started. The root outlives its children.`}) 
    StartedAt?: Date;
        
    @Field({nullable: true, description: `When this space closed. Closure is a timestamp on the sub-space, not a delete of the root.`}) 
    ClosedAt?: Date;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Boolean, {nullable: true, description: `1 if participants in this space may assign people seated on ancestor spaces whose membership reaches this space; 0 to restrict assignment to seats in this space or below. Only staff may change this switch.`}) 
    AllowParentAssignees?: boolean;
        
    @Field({nullable: true, description: `Target or planned close date/time for the space. Actual closure is recorded in ClosedAt.`}) 
    PlannedCloseAt?: Date;
        
    @Field({nullable: true, description: `Font Awesome icon class representing the space (e.g., fa-solid fa-folder-tree, fa-solid fa-briefcase). Overrides SpaceType.IconClass if set.`}) 
    @MaxLength(100)
    IconClass?: string;
        
    @Field({nullable: true, description: `Hex color code representing the space (e.g., #0076b6, #10b981). Overrides SpaceType.Color if set.`}) 
    @MaxLength(50)
    Color?: string;
        
    @Field({nullable: true, description: `URL of an optional hero banner or background image displayed in the space header and overview.`}) 
    @MaxLength(1000)
    BackgroundImageURL?: string;
        
    @Field({nullable: true}) 
    Configuration?: string;
        
    @Field({nullable: true, description: `The status the space is in, one of its type's (SpaceTypeStatus). NULL until the server stamps it: then the type's default while ClosedAt is null, and the type's first terminal status once ClosedAt is set, as fnCollaborationSpaceStatuses derives it.`}) 
    @MaxLength(36)
    StatusID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SpaceType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Parent?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    Owner?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    Status?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Spaces
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollaborationSpaceInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    SpaceTypeID?: string;

    @Field({ nullable: true })
    ParentID: string | null;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    OwnerID?: string;

    @Field(() => Boolean, { nullable: true })
    InheritsMembership?: boolean;

    @Field({ nullable: true })
    AgentRetrieval?: string;

    @Field({ nullable: true })
    StartedAt: Date | null;

    @Field({ nullable: true })
    ClosedAt: Date | null;

    @Field(() => Boolean, { nullable: true })
    AllowParentAssignees?: boolean;

    @Field({ nullable: true })
    PlannedCloseAt: Date | null;

    @Field({ nullable: true })
    IconClass: string | null;

    @Field({ nullable: true })
    Color: string | null;

    @Field({ nullable: true })
    BackgroundImageURL: string | null;

    @Field({ nullable: true })
    Configuration: string | null;

    @Field({ nullable: true })
    StatusID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration: Spaces
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollaborationSpaceInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    SpaceTypeID?: string;

    @Field({ nullable: true })
    ParentID?: string | null;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    OwnerID?: string;

    @Field(() => Boolean, { nullable: true })
    InheritsMembership?: boolean;

    @Field({ nullable: true })
    AgentRetrieval?: string;

    @Field({ nullable: true })
    StartedAt?: Date | null;

    @Field({ nullable: true })
    ClosedAt?: Date | null;

    @Field(() => Boolean, { nullable: true })
    AllowParentAssignees?: boolean;

    @Field({ nullable: true })
    PlannedCloseAt?: Date | null;

    @Field({ nullable: true })
    IconClass?: string | null;

    @Field({ nullable: true })
    Color?: string | null;

    @Field({ nullable: true })
    BackgroundImageURL?: string | null;

    @Field({ nullable: true })
    Configuration?: string | null;

    @Field({ nullable: true })
    StatusID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration: Spaces
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollaborationSpaceViewResult {
    @Field(() => [mjBizAppsCollaborationSpace_])
    Results: mjBizAppsCollaborationSpace_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsCollaborationSpace_)
export class mjBizAppsCollaborationSpaceResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollaborationSpaceViewResult)
    async RunmjBizAppsCollaborationSpaceViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceViewResult)
    async RunmjBizAppsCollaborationSpaceViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollaborationSpaceViewResult)
    async RunmjBizAppsCollaborationSpaceDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration: Spaces';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollaborationSpace_, { nullable: true })
    async mjBizAppsCollaborationSpace(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollaborationSpace_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Spaces', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaces')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Spaces', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Spaces', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollaborationSpace_)
    async CreatemjBizAppsCollaborationSpace(
        @Arg('input', () => CreatemjBizAppsCollaborationSpaceInput) input: CreatemjBizAppsCollaborationSpaceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration: Spaces', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollaborationSpace_)
    async UpdatemjBizAppsCollaborationSpace(
        @Arg('input', () => UpdatemjBizAppsCollaborationSpaceInput) input: UpdatemjBizAppsCollaborationSpaceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration: Spaces', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollaborationSpace_)
    async DeletemjBizAppsCollaborationSpace(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration: Spaces', key, options, provider, userPayload, pubSub);
    }
    
}