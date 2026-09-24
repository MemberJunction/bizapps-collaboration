/********************************************************************************
* ALL ENTITIES - TypeGraphQL Type Class Definition - AUTO GENERATED FILE
* Generated Entities and Resolvers for Server
*
*   >>> DO NOT MODIFY THIS FILE!!!!!!!!!!!!
*   >>> YOUR CHANGES WILL BE OVERWRITTEN
*   >>> THE NEXT TIME THIS FILE IS GENERATED
*
**********************************************************************************/
import { Arg, Ctx, Int, Query, Resolver, Field, Float, ObjectType, FieldResolver, Root, InputType, Mutation,
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
@ObjectType({ description: `A record that a member opened, uploaded, or promoted an item.` })
export class mjBizAppsCollaborationItemUse_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `The space item that was used.`}) 
    @MaxLength(36)
    ItemID: string;
        
    @Field({description: `The member who opened, uploaded, or promoted the item.`}) 
    @MaxLength(36)
    UserID: string;
        
    @Field({description: `When the use happened.`}) 
    UsedAt: Date;
        
    @Field({description: `open, upload, or promote.`}) 
    @MaxLength(20)
    Kind: string;
        
    @Field({description: `The space the use happened in. Required so the read filter can keep the row inside spaces the caller reaches.`}) 
    @MaxLength(36)
    SpaceID: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    User: string;
        
    @Field() 
    @MaxLength(200)
    Space: string;
        
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
        
    @Field({description: `The space the notice belongs to. The read filter keeps a caller inside spaces they reach.`}) 
    @MaxLength(36)
    SpaceID: string;
        
    @Field({description: `The space item that was shared.`}) 
    @MaxLength(36)
    ItemID: string;
        
    @Field({description: `The member the notice is for.`}) 
    @MaxLength(36)
    RecipientUserID: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    Space: string;
        
    @Field() 
    @MaxLength(100)
    RecipientUser: string;
        
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
        
    @Field() 
    @MaxLength(36)
    SpaceID: string;
        
    @Field({description: `The entity the item points at. Same polymorphic pair TaskLink uses.`}) 
    @MaxLength(36)
    EntityID: string;
        
    @Field({description: `Primary key of the pointed-at record, as text, matching TaskLink.RecordID.`}) 
    @MaxLength(450)
    RecordID: string;
        
    @Field({description: `Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).`}) 
    @MaxLength(20)
    Band: string;
        
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
        
    @Field() 
    @MaxLength(200)
    Space: string;
        
    @Field() 
    @MaxLength(255)
    Entity: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    PromotedByUser?: string;
        
    @Field(() => [mjBizAppsCollaborationItemUse_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_ItemUses_ItemIDArray: mjBizAppsCollaborationItemUse_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_ItemUses
    
    @Field(() => [mjBizAppsCollaborationShareNotice_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_ShareNotices_ItemIDArray: mjBizAppsCollaborationShareNotice_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_ShareNotices
    
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
    
    @FieldResolver(() => [mjBizAppsCollaborationItemUse_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_ItemUses_ItemIDArray(@Root() mjbizappscollaborationspaceitem_: mjBizAppsCollaborationSpaceItem_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Item Uses', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwItemUses')} WHERE ${provider.QuoteIdentifier('ItemID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Item Uses', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspaceitem_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Item Uses', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsCollaborationShareNotice_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_ShareNotices_ItemIDArray(@Root() mjbizappscollaborationspaceitem_: mjBizAppsCollaborationSpaceItem_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Share Notices', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwShareNotices')} WHERE ${provider.QuoteIdentifier('ItemID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Share Notices', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspaceitem_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Share Notices', rows, this.GetUserFromPayload(userPayload));
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
        
    @Field() 
    @MaxLength(36)
    SpaceID: string;
        
    @Field() 
    @MaxLength(36)
    UserID: string;
        
    @Field() 
    @MaxLength(36)
    SpaceRoleTypeID: string;
        
    @Field({description: `Team or Shared. Set by the server from the role: CanSeeTeamBand seats the person on Team, otherwise Shared. The filter reads the role, not this column.`}) 
    @MaxLength(20)
    Band: string;
        
    @Field({description: `Invited, Active, or Removed. New rows start Invited unless the type auto-approves.`}) 
    @MaxLength(20)
    Status: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    Space: string;
        
    @Field() 
    @MaxLength(100)
    User: string;
        
    @Field() 
    @MaxLength(200)
    SpaceRoleType: string;
        
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
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Int, {description: `This role's own authority. A grant must be of a role whose Level is <= the grantor's MaxGrantableLevel.`}) 
    Level: number;
        
    @Field(() => Int, {description: `Highest Level this role may grant. Always <= Level.`}) 
    MaxGrantableLevel: number;
        
    @Field(() => Boolean, {description: `Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.`}) 
    CanInvite: boolean;
        
    @Field(() => Boolean, {description: `Holder may move an item from Team to Shared.`}) 
    CanPromoteBand: boolean;
        
    @Field(() => Boolean, {description: `Holder may read Team-band items. Shared-band items do not need this flag.`}) 
    CanSeeTeamBand: boolean;
        
    @Field(() => Boolean, {description: `The role that defines ownership of a space. The engine reads the flag, not the name.`}) 
    IsOwnerRole: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Boolean, {description: `1 if the role may contribute content (create, update, or post items, tasks, and messages); 0 for read-only roles.`}) 
    CanContribute: boolean;
        
    @Field(() => [mjBizAppsCollaborationSpaceMember_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceMembers_SpaceRoleTypeIDArray: mjBizAppsCollaborationSpaceMember_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceMembers
    
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
    
    @FieldResolver(() => [mjBizAppsCollaborationSpaceMember_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceMembers_SpaceRoleTypeIDArray(@Root() mjbizappscollaborationspaceroletype_: mjBizAppsCollaborationSpaceRoleType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Members', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceMembers')} WHERE ${provider.QuoteIdentifier('SpaceRoleTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Members', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspaceroletype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Members', rows, this.GetUserFromPayload(userPayload));
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
        
    @Field({description: `Stable metadata key. The engine does not branch on it.`}) 
    @MaxLength(40)
    Code: string;
        
    @Field({description: `Display name of the type.`}) 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({description: `Human noun for spaces of this type (workspace, committee, cohort, community). Open set.`}) 
    @MaxLength(50)
    Vocabulary: string;
        
    @Field({description: `Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.`}) 
    @MaxLength(20)
    Discoverability: string;
        
    @Field({description: `InviteOnly, RequestToJoin, or SelfServe.`}) 
    @MaxLength(20)
    JoinMode: string;
        
    @Field(() => Boolean, {description: `Conversation panel is on for spaces of this type.`}) 
    MessagingPanel: boolean;
        
    @Field(() => Boolean, {description: `File library panel is on.`}) 
    LibraryPanel: boolean;
        
    @Field(() => Boolean, {description: `Task / work panel is on.`}) 
    WorkPanel: boolean;
        
    @Field(() => Boolean, {description: `Governance panel is on. Committees still owns motions and ballots; this only says the panel is part of the type.`}) 
    GovernancePanel: boolean;
        
    @Field({description: `Month, Year, or Indefinite. Used when the space itself has no Retention.`}) 
    @MaxLength(20)
    DefaultRetention: string;
        
    @Field({description: `Default AgentRetrieval for a new space of this type.`}) 
    @MaxLength(30)
    DefaultAgentRetrieval: string;
        
    @Field({description: `Default Team or Shared band for a new item in a space of this type.`}) 
    @MaxLength(20)
    DefaultBand: string;
        
    @Field({description: `Approve: a new member stays Invited until an owner of the space sets them Active. AutoApprove: the server creates the member Active. The invited person does not activate themselves.`}) 
    @MaxLength(20)
    InviteApproval: string;
        
    @Field(() => Int, {nullable: true, description: `Maximum members in one space of this type. Null means no cap.`}) 
    MemberCap?: number;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Boolean, {description: `Default AllowParentAssignees setting for new spaces of this type.`}) 
    DefaultAllowParentAssignees: boolean;
        
    @Field(() => [mjBizAppsCollaborationSpace_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_Spaces_SpaceTypeIDArray: mjBizAppsCollaborationSpace_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_Spaces
    
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

    @Field(() => Boolean, { nullable: true })
    DefaultAllowParentAssignees?: boolean;

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

    @Field(() => Boolean, { nullable: true })
    DefaultAllowParentAssignees?: boolean;

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
    
    @FieldResolver(() => [mjBizAppsCollaborationSpace_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_Spaces_SpaceTypeIDArray(@Root() mjbizappscollaborationspacetype_: mjBizAppsCollaborationSpaceType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Spaces', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaces')} WHERE ${provider.QuoteIdentifier('SpaceTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Spaces', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspacetype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Spaces', rows, this.GetUserFromPayload(userPayload));
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
        
    @Field() 
    @MaxLength(36)
    SpaceTypeID: string;
        
    @Field({nullable: true, description: `Parent space. Null on a root. It does not carry the IsHierarchy flag, so CodeGen emits no path columns.`}) 
    @MaxLength(36)
    ParentID?: string;
        
    @Field({description: `Designated name of the space.`}) 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({description: `MJ user who owns the space.`}) 
    @MaxLength(36)
    OwnerID: string;
        
    @Field(() => Boolean, {description: `1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.`}) 
    InheritsMembership: boolean;
        
    @Field({description: `Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.`}) 
    @MaxLength(30)
    AgentRetrieval: string;
        
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
        
    @Field(() => Boolean, {description: `1 if participants in this space may assign people seated on ancestor spaces whose membership reaches this space; 0 to restrict assignment to seats in this space or below. Only staff may change this switch.`}) 
    AllowParentAssignees: boolean;
        
    @Field() 
    @MaxLength(200)
    SpaceType: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Parent?: string;
        
    @Field() 
    @MaxLength(100)
    Owner: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    RootParentID?: string;
        
    @Field(() => [mjBizAppsCollaborationSpaceItem_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceItems_SpaceIDArray: mjBizAppsCollaborationSpaceItem_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceItems
    
    @Field(() => [mjBizAppsCollaborationSpace_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_Spaces_ParentIDArray: mjBizAppsCollaborationSpace_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_Spaces
    
    @Field(() => [mjBizAppsCollaborationSpaceMember_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceMembers_SpaceIDArray: mjBizAppsCollaborationSpaceMember_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceMembers
    
    @Field(() => [mjBizAppsCollaborationItemUse_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_ItemUses_SpaceIDArray: mjBizAppsCollaborationItemUse_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_ItemUses
    
    @Field(() => [mjBizAppsCollaborationShareNotice_])
    mjBizAppsCollaborationMJ_BizApps_Collaboration_ShareNotices_SpaceIDArray: mjBizAppsCollaborationShareNotice_[]; // Link to mjBizAppsCollaborationMJ_BizApps_Collaboration_ShareNotices
    
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

    @Field(() => Boolean, { nullable: true })
    AllowParentAssignees?: boolean;

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

    @Field(() => Boolean, { nullable: true })
    AllowParentAssignees?: boolean;

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
    
    @FieldResolver(() => [mjBizAppsCollaborationSpaceItem_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceItems_SpaceIDArray(@Root() mjbizappscollaborationspace_: mjBizAppsCollaborationSpace_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Items', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceItems')} WHERE ${provider.QuoteIdentifier('SpaceID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Items', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspace_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Items', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsCollaborationSpace_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_Spaces_ParentIDArray(@Root() mjbizappscollaborationspace_: mjBizAppsCollaborationSpace_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Spaces', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaces')} WHERE ${provider.QuoteIdentifier('ParentID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Spaces', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspace_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Spaces', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsCollaborationSpaceMember_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_SpaceMembers_SpaceIDArray(@Root() mjbizappscollaborationspace_: mjBizAppsCollaborationSpace_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Space Members', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwSpaceMembers')} WHERE ${provider.QuoteIdentifier('SpaceID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Space Members', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspace_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Space Members', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsCollaborationItemUse_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_ItemUses_SpaceIDArray(@Root() mjbizappscollaborationspace_: mjBizAppsCollaborationSpace_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Item Uses', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwItemUses')} WHERE ${provider.QuoteIdentifier('SpaceID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Item Uses', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspace_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Item Uses', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsCollaborationShareNotice_])
    async mjBizAppsCollaborationMJ_BizApps_Collaboration_ShareNotices_SpaceIDArray(@Root() mjbizappscollaborationspace_: mjBizAppsCollaborationSpace_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration: Share Notices', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollaboration', 'vwShareNotices')} WHERE ${provider.QuoteIdentifier('SpaceID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration: Share Notices', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappscollaborationspace_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Collaboration: Share Notices', rows, this.GetUserFromPayload(userPayload));
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