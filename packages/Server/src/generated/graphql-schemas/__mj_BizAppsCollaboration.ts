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


import { mjBizAppsCollaborationItemUseEntity, mjBizAppsCollaborationShareNoticeEntity, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceMemberEntity, mjBizAppsCollaborationSpaceRoleTypeEntity, mjBizAppsCollaborationSpaceTypeEntity, mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
    

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration: Item Uses
//****************************************************************************
@ObjectType()
export class mjBizAppsCollaborationItemUse_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ItemID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    UserID?: string;
        
    @Field({nullable: true}) 
    UsedAt?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    Kind?: string;
        
    @Field({nullable: true}) 
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
@ObjectType()
export class mjBizAppsCollaborationShareNotice_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ItemID?: string;
        
    @Field({nullable: true}) 
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
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Entity?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    PromotedByUser?: string;
        
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
    @MaxLength(200)
    Space?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    User?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SpaceRoleType?: string;
        
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
        
    @Field(() => Boolean, {nullable: true}) 
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
        
    @Field(() => Boolean, {nullable: true, description: `Governance panel is on. Committees still owns motions and ballots; this only says the panel is part of the type.`}) 
    GovernancePanel?: boolean;
        
    @Field({nullable: true, description: `Month, Year, or Indefinite. Used when the space itself has no Retention.`}) 
    @MaxLength(20)
    DefaultRetention?: string;
        
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

    @Field(() => Boolean, { nullable: true })
    GovernancePanel?: boolean;

    @Field({ nullable: true })
    DefaultRetention?: string;

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

    @Field(() => Boolean, { nullable: true })
    GovernancePanel?: boolean;

    @Field({ nullable: true })
    DefaultRetention?: string;

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
        
    @Field({nullable: true, description: `Parent space. Null on the perpetual root. Self-reference is the hierarchy key CodeGen marks IsHierarchy.`}) 
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
        
    @Field({nullable: true, description: `Month, Year, or Indefinite. Null uses SpaceType.DefaultRetention.`}) 
    @MaxLength(20)
    Retention?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    SpaceType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Parent?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    Owner?: string;
        
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

    @Field({ nullable: true })
    Retention: string | null;

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

    @Field({ nullable: true })
    Retention?: string | null;

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