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


import { mjBizAppsCollabExamplesExampleBoardEntity, mjBizAppsCollabExamplesExampleRoomEntity } from '@mj-biz-apps/collaboration-example-space-types-entities';
    

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration_Examples: Example Boards
//****************************************************************************
@ObjectType({ description: `A board: a space of the example-board type, with the terms its members sit under. Shares its primary key with the Space row it specialises.` })
export class mjBizAppsCollabExamplesExampleBoard_ {
    @Field({description: `The Space this board specialises: the same value as Space.ID.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The term the board sits for, for example "2026 to 2027".`}) 
    @MaxLength(100)
    TermName?: string;
        
    @Field({nullable: true, description: `How often the board meets, in words: "Monthly", "First Tuesday".`}) 
    @MaxLength(100)
    MeetingCadence?: string;
        
    @Field({nullable: true, description: `When the next meeting is.`}) 
    NextMeetingDate?: Date;
        
    @Field({nullable: true, description: `Where the next meeting is.`}) 
    @MaxLength(255)
    NextMeetingLocation?: string;
        
    @Field(() => Int, {nullable: true, description: `The percentage of members who must attend for a vote to count. Defaults to 50.`}) 
    QuorumPercentage?: number;
        
    @Field({nullable: true, description: `A link to the board charter.`}) 
    @MaxLength(500)
    BoardCharterUrl?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ParentID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OwnerID?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    InheritsMembership?: boolean;
        
    @Field({nullable: true}) 
    @MaxLength(30)
    AgentRetrieval?: string;
        
    @Field({nullable: true}) 
    StartedAt?: Date;
        
    @Field({nullable: true}) 
    ClosedAt?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    Retention?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    AllowParentAssignees?: boolean;
        
    @Field({nullable: true}) 
    PlannedCloseAt?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    IconClass?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Color?: string;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    BackgroundImageURL?: string;
        
    @Field({nullable: true}) 
    Configuration?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    AnchorEntityID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(450)
    AnchorRecordID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    PostCloseAccess?: string;
        
    @Field(() => Int, {nullable: true}) 
    PostCloseAccessDays?: number;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Boards
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollabExamplesExampleBoardInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    TermName?: string;

    @Field({ nullable: true })
    MeetingCadence: string | null;

    @Field({ nullable: true })
    NextMeetingDate: Date | null;

    @Field({ nullable: true })
    NextMeetingLocation: string | null;

    @Field(() => Int, { nullable: true })
    QuorumPercentage?: number;

    @Field({ nullable: true })
    BoardCharterUrl: string | null;

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
    AnchorEntityID: string | null;

    @Field({ nullable: true })
    AnchorRecordID: string | null;

    @Field({ nullable: true })
    PostCloseAccess: string | null;

    @Field(() => Int, { nullable: true })
    PostCloseAccessDays: number | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Boards
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollabExamplesExampleBoardInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    TermName?: string;

    @Field({ nullable: true })
    MeetingCadence?: string | null;

    @Field({ nullable: true })
    NextMeetingDate?: Date | null;

    @Field({ nullable: true })
    NextMeetingLocation?: string | null;

    @Field(() => Int, { nullable: true })
    QuorumPercentage?: number;

    @Field({ nullable: true })
    BoardCharterUrl?: string | null;

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
    AnchorEntityID?: string | null;

    @Field({ nullable: true })
    AnchorRecordID?: string | null;

    @Field({ nullable: true })
    PostCloseAccess?: string | null;

    @Field(() => Int, { nullable: true })
    PostCloseAccessDays?: number | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration_Examples: Example Boards
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollabExamplesExampleBoardViewResult {
    @Field(() => [mjBizAppsCollabExamplesExampleBoard_])
    Results: mjBizAppsCollabExamplesExampleBoard_[];

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

@Resolver(mjBizAppsCollabExamplesExampleBoard_)
export class mjBizAppsCollabExamplesExampleBoardResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollabExamplesExampleBoardViewResult)
    async RunmjBizAppsCollabExamplesExampleBoardViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleBoardViewResult)
    async RunmjBizAppsCollabExamplesExampleBoardViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleBoardViewResult)
    async RunmjBizAppsCollabExamplesExampleBoardDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration_Examples: Example Boards';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollabExamplesExampleBoard_, { nullable: true })
    async mjBizAppsCollabExamplesExampleBoard(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollabExamplesExampleBoard_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration_Examples: Example Boards', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollabExamples', 'vwExampleBoards')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration_Examples: Example Boards', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration_Examples: Example Boards', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleBoard_)
    async CreatemjBizAppsCollabExamplesExampleBoard(
        @Arg('input', () => CreatemjBizAppsCollabExamplesExampleBoardInput) input: CreatemjBizAppsCollabExamplesExampleBoardInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration_Examples: Example Boards', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollabExamplesExampleBoard_)
    async UpdatemjBizAppsCollabExamplesExampleBoard(
        @Arg('input', () => UpdatemjBizAppsCollabExamplesExampleBoardInput) input: UpdatemjBizAppsCollabExamplesExampleBoardInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration_Examples: Example Boards', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleBoard_)
    async DeletemjBizAppsCollabExamplesExampleBoard(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration_Examples: Example Boards', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration_Examples: Example Rooms
//****************************************************************************
@ObjectType({ description: `A deal room: a space of the example-room type, holding what is known about one deal. Shares its primary key with the Space row it specialises.` })
export class mjBizAppsCollabExamplesExampleRoom_ {
    @Field({description: `The Space this deal room specialises: the same value as Space.ID.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: `The deal, as the system that owns it names it.`}) 
    @MaxLength(100)
    DealID?: string;
        
    @Field({nullable: true, description: `The account the deal is with.`}) 
    @MaxLength(255)
    AccountName?: string;
        
    @Field({nullable: true, description: `The stage the deal is at, in the seller's words.`}) 
    @MaxLength(50)
    DealStage?: string;
        
    @Field({nullable: true, description: `When the deal is expected to close.`}) 
    CloseDate?: Date;
        
    @Field(() => Float, {nullable: true, description: `What the deal is worth.`}) 
    DealValue?: number;
        
    @Field(() => Int, {nullable: true, description: `The seller's estimate of the chance of winning, as a percentage.`}) 
    WinProbability?: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SpaceTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ParentID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OwnerID?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    InheritsMembership?: boolean;
        
    @Field({nullable: true}) 
    @MaxLength(30)
    AgentRetrieval?: string;
        
    @Field({nullable: true}) 
    StartedAt?: Date;
        
    @Field({nullable: true}) 
    ClosedAt?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    Retention?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    AllowParentAssignees?: boolean;
        
    @Field({nullable: true}) 
    PlannedCloseAt?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    IconClass?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Color?: string;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    BackgroundImageURL?: string;
        
    @Field({nullable: true}) 
    Configuration?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    AnchorEntityID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(450)
    AnchorRecordID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    PostCloseAccess?: string;
        
    @Field(() => Int, {nullable: true}) 
    PostCloseAccessDays?: number;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Rooms
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollabExamplesExampleRoomInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    AccountName?: string;

    @Field({ nullable: true })
    DealStage?: string;

    @Field({ nullable: true })
    CloseDate: Date | null;

    @Field(() => Float, { nullable: true })
    DealValue: number | null;

    @Field(() => Int, { nullable: true })
    WinProbability: number | null;

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
    AnchorEntityID: string | null;

    @Field({ nullable: true })
    AnchorRecordID: string | null;

    @Field({ nullable: true })
    PostCloseAccess: string | null;

    @Field(() => Int, { nullable: true })
    PostCloseAccessDays: number | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Rooms
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollabExamplesExampleRoomInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    AccountName?: string;

    @Field({ nullable: true })
    DealStage?: string;

    @Field({ nullable: true })
    CloseDate?: Date | null;

    @Field(() => Float, { nullable: true })
    DealValue?: number | null;

    @Field(() => Int, { nullable: true })
    WinProbability?: number | null;

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
    AnchorEntityID?: string | null;

    @Field({ nullable: true })
    AnchorRecordID?: string | null;

    @Field({ nullable: true })
    PostCloseAccess?: string | null;

    @Field(() => Int, { nullable: true })
    PostCloseAccessDays?: number | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration_Examples: Example Rooms
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollabExamplesExampleRoomViewResult {
    @Field(() => [mjBizAppsCollabExamplesExampleRoom_])
    Results: mjBizAppsCollabExamplesExampleRoom_[];

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

@Resolver(mjBizAppsCollabExamplesExampleRoom_)
export class mjBizAppsCollabExamplesExampleRoomResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollabExamplesExampleRoomViewResult)
    async RunmjBizAppsCollabExamplesExampleRoomViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleRoomViewResult)
    async RunmjBizAppsCollabExamplesExampleRoomViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleRoomViewResult)
    async RunmjBizAppsCollabExamplesExampleRoomDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration_Examples: Example Rooms';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollabExamplesExampleRoom_, { nullable: true })
    async mjBizAppsCollabExamplesExampleRoom(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollabExamplesExampleRoom_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration_Examples: Example Rooms', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollabExamples', 'vwExampleRooms')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration_Examples: Example Rooms', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration_Examples: Example Rooms', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleRoom_)
    async CreatemjBizAppsCollabExamplesExampleRoom(
        @Arg('input', () => CreatemjBizAppsCollabExamplesExampleRoomInput) input: CreatemjBizAppsCollabExamplesExampleRoomInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration_Examples: Example Rooms', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollabExamplesExampleRoom_)
    async UpdatemjBizAppsCollabExamplesExampleRoom(
        @Arg('input', () => UpdatemjBizAppsCollabExamplesExampleRoomInput) input: UpdatemjBizAppsCollabExamplesExampleRoomInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration_Examples: Example Rooms', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleRoom_)
    async DeletemjBizAppsCollabExamplesExampleRoom(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration_Examples: Example Rooms', key, options, provider, userPayload, pubSub);
    }
    
}