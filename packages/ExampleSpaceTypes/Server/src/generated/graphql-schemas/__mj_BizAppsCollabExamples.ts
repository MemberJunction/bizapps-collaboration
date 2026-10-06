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


import { mjBizAppsCollabExamplesExampleBoardEntity, mjBizAppsCollabExamplesExampleChapterMemberEntity, mjBizAppsCollabExamplesExampleChapterEntity } from '@mj-biz-apps/collaboration-example-space-types-entities';
    

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration_Examples: Example Boards
//****************************************************************************
@ObjectType({ description: "A board: a space of the example-board type, with the terms its members sit under. Shares its primary key with the Space row it specialises." })
export class mjBizAppsCollabExamplesExampleBoard_ {
    @Field({description: "The Space this board specialises: the same value as Space.ID."}) 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: "The term the board sits for, for example \"2026 to 2027\"."}) 
    @MaxLength(100)
    TermName?: string;
        
    @Field({nullable: true, description: "How often the board meets, in words: \"Monthly\", \"First Tuesday\"."}) 
    @MaxLength(100)
    MeetingCadence?: string;
        
    @Field({nullable: true, description: "When the next meeting is."}) 
    NextMeetingDate?: Date;
        
    @Field({nullable: true, description: "Where the next meeting is."}) 
    @MaxLength(255)
    NextMeetingLocation?: string;
        
    @Field(() => Int, {nullable: true, description: "The percentage of members who must attend for a vote to count. Defaults to 50."}) 
    QuorumPercentage?: number;
        
    @Field({nullable: true, description: "A link to the board charter."}) 
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
    StatusID?: string;
        
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
// ENTITY CLASS for MJ_BizApps_Collaboration_Examples: Example Chapter Members
//****************************************************************************
@ObjectType({ description: "A member of a chapter: the rows a chapter space's participants reach through the type's data reach on ChapterID (D28). Test-only." })
export class mjBizAppsCollabExamplesExampleChapterMember_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ChapterID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    FirstName?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    LastName?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Email?: string;
        
    @Field({nullable: true}) 
    JoinedAt?: Date;
        
    @Field({nullable: true}) 
    RenewalDate?: Date;
        
    @Field(() => Float, {nullable: true, description: "The member's dues balance. Outside the type's allow-list, so a participant never reads it."}) 
    DuesBalance?: number;
        
    @Field({nullable: true, description: "Active, Lapsed or Former."}) 
    @MaxLength(20)
    Status?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Chapter?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Chapter Members
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollabExamplesExampleChapterMemberInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    ChapterID?: string;

    @Field({ nullable: true })
    FirstName?: string;

    @Field({ nullable: true })
    LastName?: string;

    @Field({ nullable: true })
    Email: string | null;

    @Field({ nullable: true })
    JoinedAt: Date | null;

    @Field({ nullable: true })
    RenewalDate: Date | null;

    @Field(() => Float, { nullable: true })
    DuesBalance?: number;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Chapter Members
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollabExamplesExampleChapterMemberInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    ChapterID?: string;

    @Field({ nullable: true })
    FirstName?: string;

    @Field({ nullable: true })
    LastName?: string;

    @Field({ nullable: true })
    Email?: string | null;

    @Field({ nullable: true })
    JoinedAt?: Date | null;

    @Field({ nullable: true })
    RenewalDate?: Date | null;

    @Field(() => Float, { nullable: true })
    DuesBalance?: number;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration_Examples: Example Chapter Members
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollabExamplesExampleChapterMemberViewResult {
    @Field(() => [mjBizAppsCollabExamplesExampleChapterMember_])
    Results: mjBizAppsCollabExamplesExampleChapterMember_[];

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

@Resolver(mjBizAppsCollabExamplesExampleChapterMember_)
export class mjBizAppsCollabExamplesExampleChapterMemberResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollabExamplesExampleChapterMemberViewResult)
    async RunmjBizAppsCollabExamplesExampleChapterMemberViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleChapterMemberViewResult)
    async RunmjBizAppsCollabExamplesExampleChapterMemberViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleChapterMemberViewResult)
    async RunmjBizAppsCollabExamplesExampleChapterMemberDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration_Examples: Example Chapter Members';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollabExamplesExampleChapterMember_, { nullable: true })
    async mjBizAppsCollabExamplesExampleChapterMember(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollabExamplesExampleChapterMember_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration_Examples: Example Chapter Members', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollabExamples', 'vwExampleChapterMembers')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration_Examples: Example Chapter Members', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration_Examples: Example Chapter Members', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleChapterMember_)
    async CreatemjBizAppsCollabExamplesExampleChapterMember(
        @Arg('input', () => CreatemjBizAppsCollabExamplesExampleChapterMemberInput) input: CreatemjBizAppsCollabExamplesExampleChapterMemberInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration_Examples: Example Chapter Members', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollabExamplesExampleChapterMember_)
    async UpdatemjBizAppsCollabExamplesExampleChapterMember(
        @Arg('input', () => UpdatemjBizAppsCollabExamplesExampleChapterMemberInput) input: UpdatemjBizAppsCollabExamplesExampleChapterMemberInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration_Examples: Example Chapter Members', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleChapterMember_)
    async DeletemjBizAppsCollabExamplesExampleChapterMember(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration_Examples: Example Chapter Members', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Collaboration_Examples: Example Chapters
//****************************************************************************
@ObjectType({ description: "A chapter of the example association: the record a chapter space is anchored to (D26). Test-only, for the example-chapter type." })
export class mjBizAppsCollabExamplesExampleChapter_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true, description: "The region the chapter serves."}) 
    @MaxLength(100)
    Region?: string;
        
    @Field({nullable: true}) 
    CharterDate?: Date;
        
    @Field({nullable: true, description: "Active, Dormant or Closed."}) 
    @MaxLength(20)
    Status?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Chapters
//****************************************************************************
@InputType()
export class CreatemjBizAppsCollabExamplesExampleChapterInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Region: string | null;

    @Field({ nullable: true })
    CharterDate: Date | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Collaboration_Examples: Example Chapters
//****************************************************************************
@InputType()
export class UpdatemjBizAppsCollabExamplesExampleChapterInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Region?: string | null;

    @Field({ nullable: true })
    CharterDate?: Date | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Collaboration_Examples: Example Chapters
//****************************************************************************
@ObjectType()
export class RunmjBizAppsCollabExamplesExampleChapterViewResult {
    @Field(() => [mjBizAppsCollabExamplesExampleChapter_])
    Results: mjBizAppsCollabExamplesExampleChapter_[];

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

@Resolver(mjBizAppsCollabExamplesExampleChapter_)
export class mjBizAppsCollabExamplesExampleChapterResolver extends ResolverBase {
    @Query(() => RunmjBizAppsCollabExamplesExampleChapterViewResult)
    async RunmjBizAppsCollabExamplesExampleChapterViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleChapterViewResult)
    async RunmjBizAppsCollabExamplesExampleChapterViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsCollabExamplesExampleChapterViewResult)
    async RunmjBizAppsCollabExamplesExampleChapterDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Collaboration_Examples: Example Chapters';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsCollabExamplesExampleChapter_, { nullable: true })
    async mjBizAppsCollabExamplesExampleChapter(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsCollabExamplesExampleChapter_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Collaboration_Examples: Example Chapters', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsCollabExamples', 'vwExampleChapters')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Collaboration_Examples: Example Chapters', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Collaboration_Examples: Example Chapters', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleChapter_)
    async CreatemjBizAppsCollabExamplesExampleChapter(
        @Arg('input', () => CreatemjBizAppsCollabExamplesExampleChapterInput) input: CreatemjBizAppsCollabExamplesExampleChapterInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Collaboration_Examples: Example Chapters', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsCollabExamplesExampleChapter_)
    async UpdatemjBizAppsCollabExamplesExampleChapter(
        @Arg('input', () => UpdatemjBizAppsCollabExamplesExampleChapterInput) input: UpdatemjBizAppsCollabExamplesExampleChapterInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Collaboration_Examples: Example Chapters', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsCollabExamplesExampleChapter_)
    async DeletemjBizAppsCollabExamplesExampleChapter(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Collaboration_Examples: Example Chapters', key, options, provider, userPayload, pubSub);
    }
    
}