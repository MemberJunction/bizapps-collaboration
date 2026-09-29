import { BaseEntity, EntitySaveOptions, EntityDeleteOptions, CompositeKey, ValidationResult, ValidationErrorInfo, ValidationErrorType, Metadata, ProviderType, DatabaseProviderBase, RunView } from "@memberjunction/core";
import { RegisterClass } from "@memberjunction/global";
import { z } from "zod";

     
 
/**
 * zod schema definition for the entity MJ_BizApps_Collaboration_Examples: Example Boards
 */
export const mjBizAppsCollabExamplesExampleBoardSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The Space this board specialises: the same value as Space.ID.`),
    TermName: z.string().describe(`
        * * Field Name: TermName
        * * Display Name: Term Name
        * * SQL Data Type: nvarchar(100)
        * * Description: The term the board sits for, for example "2026 to 2027".`),
    MeetingCadence: z.string().nullable().describe(`
        * * Field Name: MeetingCadence
        * * Display Name: Meeting Cadence
        * * SQL Data Type: nvarchar(100)
        * * Description: How often the board meets, in words: "Monthly", "First Tuesday".`),
    NextMeetingDate: z.date().nullable().describe(`
        * * Field Name: NextMeetingDate
        * * Display Name: Next Meeting Date
        * * SQL Data Type: datetimeoffset
        * * Description: When the next meeting is.`),
    NextMeetingLocation: z.string().nullable().describe(`
        * * Field Name: NextMeetingLocation
        * * Display Name: Next Meeting Location
        * * SQL Data Type: nvarchar(255)
        * * Description: Where the next meeting is.`),
    QuorumPercentage: z.number().describe(`
        * * Field Name: QuorumPercentage
        * * Display Name: Quorum Percentage
        * * SQL Data Type: int
        * * Default Value: 50
        * * Description: The percentage of members who must attend for a vote to count. Defaults to 50.`),
    BoardCharterUrl: z.string().nullable().describe(`
        * * Field Name: BoardCharterUrl
        * * Display Name: Board Charter Url
        * * SQL Data Type: nvarchar(500)
        * * Description: A link to the board charter.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    SpaceTypeID: z.string().describe(`
        * * Field Name: SpaceTypeID
        * * Display Name: Space Type ID
        * * SQL Data Type: uniqueidentifier`),
    ParentID: z.string().nullable().describe(`
        * * Field Name: ParentID
        * * Display Name: Parent ID
        * * SQL Data Type: uniqueidentifier`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    OwnerID: z.string().describe(`
        * * Field Name: OwnerID
        * * Display Name: Owner ID
        * * SQL Data Type: uniqueidentifier`),
    InheritsMembership: z.boolean().describe(`
        * * Field Name: InheritsMembership
        * * Display Name: Inherits Membership
        * * SQL Data Type: bit`),
    AgentRetrieval: z.string().describe(`
        * * Field Name: AgentRetrieval
        * * Display Name: Agent Retrieval
        * * SQL Data Type: nvarchar(30)`),
    StartedAt: z.date().nullable().describe(`
        * * Field Name: StartedAt
        * * Display Name: Started At
        * * SQL Data Type: datetimeoffset`),
    ClosedAt: z.date().nullable().describe(`
        * * Field Name: ClosedAt
        * * Display Name: Closed At
        * * SQL Data Type: datetimeoffset`),
    Retention: z.string().nullable().describe(`
        * * Field Name: Retention
        * * Display Name: Retention
        * * SQL Data Type: nvarchar(20)`),
    AllowParentAssignees: z.boolean().describe(`
        * * Field Name: AllowParentAssignees
        * * Display Name: Allow Parent Assignees
        * * SQL Data Type: bit`),
    PlannedCloseAt: z.date().nullable().describe(`
        * * Field Name: PlannedCloseAt
        * * Display Name: Planned Close At
        * * SQL Data Type: datetimeoffset`),
    IconClass: z.string().nullable().describe(`
        * * Field Name: IconClass
        * * Display Name: Icon Class
        * * SQL Data Type: nvarchar(100)`),
    Color: z.string().nullable().describe(`
        * * Field Name: Color
        * * Display Name: Color
        * * SQL Data Type: nvarchar(50)`),
    BackgroundImageURL: z.string().nullable().describe(`
        * * Field Name: BackgroundImageURL
        * * Display Name: Background Image URL
        * * SQL Data Type: nvarchar(1000)`),
    Configuration: z.string().nullable().describe(`
        * * Field Name: Configuration
        * * Display Name: Configuration
        * * SQL Data Type: nvarchar(MAX)`),
    AnchorEntityID: z.string().nullable().describe(`
        * * Field Name: AnchorEntityID
        * * Display Name: Anchor Entity ID
        * * SQL Data Type: uniqueidentifier`),
    AnchorRecordID: z.string().nullable().describe(`
        * * Field Name: AnchorRecordID
        * * Display Name: Anchor Record ID
        * * SQL Data Type: nvarchar(450)`),
    PostCloseAccess: z.string().nullable().describe(`
        * * Field Name: PostCloseAccess
        * * Display Name: Post Close Access
        * * SQL Data Type: nvarchar(20)`),
    PostCloseAccessDays: z.number().nullable().describe(`
        * * Field Name: PostCloseAccessDays
        * * Display Name: Post Close Access Days
        * * SQL Data Type: int`),
});

export type mjBizAppsCollabExamplesExampleBoardEntityType = z.infer<typeof mjBizAppsCollabExamplesExampleBoardSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration_Examples: Example Rooms
 */
export const mjBizAppsCollabExamplesExampleRoomSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The Space this deal room specialises: the same value as Space.ID.`),
    DealID: z.string().describe(`
        * * Field Name: DealID
        * * Display Name: Deal ID
        * * SQL Data Type: nvarchar(100)
        * * Description: The deal, as the system that owns it names it.`),
    AccountName: z.string().describe(`
        * * Field Name: AccountName
        * * Display Name: Account Name
        * * SQL Data Type: nvarchar(255)
        * * Description: The account the deal is with.`),
    DealStage: z.string().describe(`
        * * Field Name: DealStage
        * * Display Name: Deal Stage
        * * SQL Data Type: nvarchar(50)
        * * Description: The stage the deal is at, in the seller's words.`),
    CloseDate: z.date().nullable().describe(`
        * * Field Name: CloseDate
        * * Display Name: Close Date
        * * SQL Data Type: datetimeoffset
        * * Description: When the deal is expected to close.`),
    DealValue: z.number().nullable().describe(`
        * * Field Name: DealValue
        * * Display Name: Deal Value
        * * SQL Data Type: decimal(18, 2)
        * * Description: What the deal is worth.`),
    WinProbability: z.number().nullable().describe(`
        * * Field Name: WinProbability
        * * Display Name: Win Probability
        * * SQL Data Type: int
        * * Description: The seller's estimate of the chance of winning, as a percentage.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    SpaceTypeID: z.string().describe(`
        * * Field Name: SpaceTypeID
        * * Display Name: Space Type ID
        * * SQL Data Type: uniqueidentifier`),
    ParentID: z.string().nullable().describe(`
        * * Field Name: ParentID
        * * Display Name: Parent ID
        * * SQL Data Type: uniqueidentifier`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    OwnerID: z.string().describe(`
        * * Field Name: OwnerID
        * * Display Name: Owner ID
        * * SQL Data Type: uniqueidentifier`),
    InheritsMembership: z.boolean().describe(`
        * * Field Name: InheritsMembership
        * * Display Name: Inherits Membership
        * * SQL Data Type: bit`),
    AgentRetrieval: z.string().describe(`
        * * Field Name: AgentRetrieval
        * * Display Name: Agent Retrieval
        * * SQL Data Type: nvarchar(30)`),
    StartedAt: z.date().nullable().describe(`
        * * Field Name: StartedAt
        * * Display Name: Started At
        * * SQL Data Type: datetimeoffset`),
    ClosedAt: z.date().nullable().describe(`
        * * Field Name: ClosedAt
        * * Display Name: Closed At
        * * SQL Data Type: datetimeoffset`),
    Retention: z.string().nullable().describe(`
        * * Field Name: Retention
        * * Display Name: Retention
        * * SQL Data Type: nvarchar(20)`),
    AllowParentAssignees: z.boolean().describe(`
        * * Field Name: AllowParentAssignees
        * * Display Name: Allow Parent Assignees
        * * SQL Data Type: bit`),
    PlannedCloseAt: z.date().nullable().describe(`
        * * Field Name: PlannedCloseAt
        * * Display Name: Planned Close At
        * * SQL Data Type: datetimeoffset`),
    IconClass: z.string().nullable().describe(`
        * * Field Name: IconClass
        * * Display Name: Icon Class
        * * SQL Data Type: nvarchar(100)`),
    Color: z.string().nullable().describe(`
        * * Field Name: Color
        * * Display Name: Color
        * * SQL Data Type: nvarchar(50)`),
    BackgroundImageURL: z.string().nullable().describe(`
        * * Field Name: BackgroundImageURL
        * * Display Name: Background Image URL
        * * SQL Data Type: nvarchar(1000)`),
    Configuration: z.string().nullable().describe(`
        * * Field Name: Configuration
        * * Display Name: Configuration
        * * SQL Data Type: nvarchar(MAX)`),
    AnchorEntityID: z.string().nullable().describe(`
        * * Field Name: AnchorEntityID
        * * Display Name: Anchor Entity ID
        * * SQL Data Type: uniqueidentifier`),
    AnchorRecordID: z.string().nullable().describe(`
        * * Field Name: AnchorRecordID
        * * Display Name: Anchor Record ID
        * * SQL Data Type: nvarchar(450)`),
    PostCloseAccess: z.string().nullable().describe(`
        * * Field Name: PostCloseAccess
        * * Display Name: Post Close Access
        * * SQL Data Type: nvarchar(20)`),
    PostCloseAccessDays: z.number().nullable().describe(`
        * * Field Name: PostCloseAccessDays
        * * Display Name: Post Close Access Days
        * * SQL Data Type: int`),
});

export type mjBizAppsCollabExamplesExampleRoomEntityType = z.infer<typeof mjBizAppsCollabExamplesExampleRoomSchema>;
 
 

/**
 * MJ_BizApps_Collaboration_Examples: Example Boards - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollabExamples
 * * Base Table: ExampleBoard
 * * Base View: vwExampleBoards
 * * @description A board: a space of the example-board type, with the terms its members sit under. Shares its primary key with the Space row it specialises.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration_Examples: Example Boards')
export class mjBizAppsCollabExamplesExampleBoardEntity extends BaseEntity<mjBizAppsCollabExamplesExampleBoardEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration_Examples: Example Boards record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration_Examples: Example Boards record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollabExamplesExampleBoardEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The Space this board specialises: the same value as Space.ID.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: TermName
    * * Display Name: Term Name
    * * SQL Data Type: nvarchar(100)
    * * Description: The term the board sits for, for example "2026 to 2027".
    */
    get TermName(): string {
        return this.Get('TermName');
    }
    set TermName(value: string) {
        this.Set('TermName', value);
    }

    /**
    * * Field Name: MeetingCadence
    * * Display Name: Meeting Cadence
    * * SQL Data Type: nvarchar(100)
    * * Description: How often the board meets, in words: "Monthly", "First Tuesday".
    */
    get MeetingCadence(): string | null {
        return this.Get('MeetingCadence');
    }
    set MeetingCadence(value: string | null) {
        this.Set('MeetingCadence', value);
    }

    /**
    * * Field Name: NextMeetingDate
    * * Display Name: Next Meeting Date
    * * SQL Data Type: datetimeoffset
    * * Description: When the next meeting is.
    */
    get NextMeetingDate(): Date | null {
        return this.Get('NextMeetingDate');
    }
    set NextMeetingDate(value: Date | null) {
        this.Set('NextMeetingDate', value);
    }

    /**
    * * Field Name: NextMeetingLocation
    * * Display Name: Next Meeting Location
    * * SQL Data Type: nvarchar(255)
    * * Description: Where the next meeting is.
    */
    get NextMeetingLocation(): string | null {
        return this.Get('NextMeetingLocation');
    }
    set NextMeetingLocation(value: string | null) {
        this.Set('NextMeetingLocation', value);
    }

    /**
    * * Field Name: QuorumPercentage
    * * Display Name: Quorum Percentage
    * * SQL Data Type: int
    * * Default Value: 50
    * * Description: The percentage of members who must attend for a vote to count. Defaults to 50.
    */
    get QuorumPercentage(): number {
        return this.Get('QuorumPercentage');
    }
    set QuorumPercentage(value: number) {
        this.Set('QuorumPercentage', value);
    }

    /**
    * * Field Name: BoardCharterUrl
    * * Display Name: Board Charter Url
    * * SQL Data Type: nvarchar(500)
    * * Description: A link to the board charter.
    */
    get BoardCharterUrl(): string | null {
        return this.Get('BoardCharterUrl');
    }
    set BoardCharterUrl(value: string | null) {
        this.Set('BoardCharterUrl', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: SpaceTypeID
    * * Display Name: Space Type ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get SpaceTypeID(): string {
        return this.Get('SpaceTypeID');
    }
    set SpaceTypeID(value: string) {
        this.Set('SpaceTypeID', value);
    }

    /**
    * * Field Name: ParentID
    * * Display Name: Parent ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get ParentID(): string | null {
        return this.Get('ParentID');
    }
    set ParentID(value: string | null) {
        this.Set('ParentID', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: OwnerID
    * * Display Name: Owner ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get OwnerID(): string {
        return this.Get('OwnerID');
    }
    set OwnerID(value: string) {
        this.Set('OwnerID', value);
    }

    /**
    * * Field Name: InheritsMembership
    * * Display Name: Inherits Membership
    * * SQL Data Type: bit
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get InheritsMembership(): boolean {
        return this.Get('InheritsMembership');
    }
    set InheritsMembership(value: boolean) {
        this.Set('InheritsMembership', value);
    }

    /**
    * * Field Name: AgentRetrieval
    * * Display Name: Agent Retrieval
    * * SQL Data Type: nvarchar(30)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AgentRetrieval(): string {
        return this.Get('AgentRetrieval');
    }
    set AgentRetrieval(value: string) {
        this.Set('AgentRetrieval', value);
    }

    /**
    * * Field Name: StartedAt
    * * Display Name: Started At
    * * SQL Data Type: datetimeoffset
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get StartedAt(): Date | null {
        return this.Get('StartedAt');
    }
    set StartedAt(value: Date | null) {
        this.Set('StartedAt', value);
    }

    /**
    * * Field Name: ClosedAt
    * * Display Name: Closed At
    * * SQL Data Type: datetimeoffset
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get ClosedAt(): Date | null {
        return this.Get('ClosedAt');
    }
    set ClosedAt(value: Date | null) {
        this.Set('ClosedAt', value);
    }

    /**
    * * Field Name: Retention
    * * Display Name: Retention
    * * SQL Data Type: nvarchar(20)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Retention(): string | null {
        return this.Get('Retention');
    }
    set Retention(value: string | null) {
        this.Set('Retention', value);
    }

    /**
    * * Field Name: AllowParentAssignees
    * * Display Name: Allow Parent Assignees
    * * SQL Data Type: bit
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AllowParentAssignees(): boolean {
        return this.Get('AllowParentAssignees');
    }
    set AllowParentAssignees(value: boolean) {
        this.Set('AllowParentAssignees', value);
    }

    /**
    * * Field Name: PlannedCloseAt
    * * Display Name: Planned Close At
    * * SQL Data Type: datetimeoffset
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get PlannedCloseAt(): Date | null {
        return this.Get('PlannedCloseAt');
    }
    set PlannedCloseAt(value: Date | null) {
        this.Set('PlannedCloseAt', value);
    }

    /**
    * * Field Name: IconClass
    * * Display Name: Icon Class
    * * SQL Data Type: nvarchar(100)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get IconClass(): string | null {
        return this.Get('IconClass');
    }
    set IconClass(value: string | null) {
        this.Set('IconClass', value);
    }

    /**
    * * Field Name: Color
    * * Display Name: Color
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Color(): string | null {
        return this.Get('Color');
    }
    set Color(value: string | null) {
        this.Set('Color', value);
    }

    /**
    * * Field Name: BackgroundImageURL
    * * Display Name: Background Image URL
    * * SQL Data Type: nvarchar(1000)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get BackgroundImageURL(): string | null {
        return this.Get('BackgroundImageURL');
    }
    set BackgroundImageURL(value: string | null) {
        this.Set('BackgroundImageURL', value);
    }

    /**
    * * Field Name: Configuration
    * * Display Name: Configuration
    * * SQL Data Type: nvarchar(MAX)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Configuration(): string | null {
        return this.Get('Configuration');
    }
    set Configuration(value: string | null) {
        this.Set('Configuration', value);
    }

    /**
    * * Field Name: AnchorEntityID
    * * Display Name: Anchor Entity ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AnchorEntityID(): string | null {
        return this.Get('AnchorEntityID');
    }
    set AnchorEntityID(value: string | null) {
        this.Set('AnchorEntityID', value);
    }

    /**
    * * Field Name: AnchorRecordID
    * * Display Name: Anchor Record ID
    * * SQL Data Type: nvarchar(450)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AnchorRecordID(): string | null {
        return this.Get('AnchorRecordID');
    }
    set AnchorRecordID(value: string | null) {
        this.Set('AnchorRecordID', value);
    }

    /**
    * * Field Name: PostCloseAccess
    * * Display Name: Post Close Access
    * * SQL Data Type: nvarchar(20)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get PostCloseAccess(): string | null {
        return this.Get('PostCloseAccess');
    }
    set PostCloseAccess(value: string | null) {
        this.Set('PostCloseAccess', value);
    }

    /**
    * * Field Name: PostCloseAccessDays
    * * Display Name: Post Close Access Days
    * * SQL Data Type: int
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get PostCloseAccessDays(): number | null {
        return this.Get('PostCloseAccessDays');
    }
    set PostCloseAccessDays(value: number | null) {
        this.Set('PostCloseAccessDays', value);
    }
}


/**
 * MJ_BizApps_Collaboration_Examples: Example Rooms - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollabExamples
 * * Base Table: ExampleRoom
 * * Base View: vwExampleRooms
 * * @description A deal room: a space of the example-room type, holding what is known about one deal. Shares its primary key with the Space row it specialises.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration_Examples: Example Rooms')
export class mjBizAppsCollabExamplesExampleRoomEntity extends BaseEntity<mjBizAppsCollabExamplesExampleRoomEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration_Examples: Example Rooms record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration_Examples: Example Rooms record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollabExamplesExampleRoomEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The Space this deal room specialises: the same value as Space.ID.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DealID
    * * Display Name: Deal ID
    * * SQL Data Type: nvarchar(100)
    * * Description: The deal, as the system that owns it names it.
    */
    get DealID(): string {
        return this.Get('DealID');
    }
    set DealID(value: string) {
        this.Set('DealID', value);
    }

    /**
    * * Field Name: AccountName
    * * Display Name: Account Name
    * * SQL Data Type: nvarchar(255)
    * * Description: The account the deal is with.
    */
    get AccountName(): string {
        return this.Get('AccountName');
    }
    set AccountName(value: string) {
        this.Set('AccountName', value);
    }

    /**
    * * Field Name: DealStage
    * * Display Name: Deal Stage
    * * SQL Data Type: nvarchar(50)
    * * Description: The stage the deal is at, in the seller's words.
    */
    get DealStage(): string {
        return this.Get('DealStage');
    }
    set DealStage(value: string) {
        this.Set('DealStage', value);
    }

    /**
    * * Field Name: CloseDate
    * * Display Name: Close Date
    * * SQL Data Type: datetimeoffset
    * * Description: When the deal is expected to close.
    */
    get CloseDate(): Date | null {
        return this.Get('CloseDate');
    }
    set CloseDate(value: Date | null) {
        this.Set('CloseDate', value);
    }

    /**
    * * Field Name: DealValue
    * * Display Name: Deal Value
    * * SQL Data Type: decimal(18, 2)
    * * Description: What the deal is worth.
    */
    get DealValue(): number | null {
        return this.Get('DealValue');
    }
    set DealValue(value: number | null) {
        this.Set('DealValue', value);
    }

    /**
    * * Field Name: WinProbability
    * * Display Name: Win Probability
    * * SQL Data Type: int
    * * Description: The seller's estimate of the chance of winning, as a percentage.
    */
    get WinProbability(): number | null {
        return this.Get('WinProbability');
    }
    set WinProbability(value: number | null) {
        this.Set('WinProbability', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: SpaceTypeID
    * * Display Name: Space Type ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get SpaceTypeID(): string {
        return this.Get('SpaceTypeID');
    }
    set SpaceTypeID(value: string) {
        this.Set('SpaceTypeID', value);
    }

    /**
    * * Field Name: ParentID
    * * Display Name: Parent ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get ParentID(): string | null {
        return this.Get('ParentID');
    }
    set ParentID(value: string | null) {
        this.Set('ParentID', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: OwnerID
    * * Display Name: Owner ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get OwnerID(): string {
        return this.Get('OwnerID');
    }
    set OwnerID(value: string) {
        this.Set('OwnerID', value);
    }

    /**
    * * Field Name: InheritsMembership
    * * Display Name: Inherits Membership
    * * SQL Data Type: bit
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get InheritsMembership(): boolean {
        return this.Get('InheritsMembership');
    }
    set InheritsMembership(value: boolean) {
        this.Set('InheritsMembership', value);
    }

    /**
    * * Field Name: AgentRetrieval
    * * Display Name: Agent Retrieval
    * * SQL Data Type: nvarchar(30)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AgentRetrieval(): string {
        return this.Get('AgentRetrieval');
    }
    set AgentRetrieval(value: string) {
        this.Set('AgentRetrieval', value);
    }

    /**
    * * Field Name: StartedAt
    * * Display Name: Started At
    * * SQL Data Type: datetimeoffset
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get StartedAt(): Date | null {
        return this.Get('StartedAt');
    }
    set StartedAt(value: Date | null) {
        this.Set('StartedAt', value);
    }

    /**
    * * Field Name: ClosedAt
    * * Display Name: Closed At
    * * SQL Data Type: datetimeoffset
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get ClosedAt(): Date | null {
        return this.Get('ClosedAt');
    }
    set ClosedAt(value: Date | null) {
        this.Set('ClosedAt', value);
    }

    /**
    * * Field Name: Retention
    * * Display Name: Retention
    * * SQL Data Type: nvarchar(20)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Retention(): string | null {
        return this.Get('Retention');
    }
    set Retention(value: string | null) {
        this.Set('Retention', value);
    }

    /**
    * * Field Name: AllowParentAssignees
    * * Display Name: Allow Parent Assignees
    * * SQL Data Type: bit
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AllowParentAssignees(): boolean {
        return this.Get('AllowParentAssignees');
    }
    set AllowParentAssignees(value: boolean) {
        this.Set('AllowParentAssignees', value);
    }

    /**
    * * Field Name: PlannedCloseAt
    * * Display Name: Planned Close At
    * * SQL Data Type: datetimeoffset
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get PlannedCloseAt(): Date | null {
        return this.Get('PlannedCloseAt');
    }
    set PlannedCloseAt(value: Date | null) {
        this.Set('PlannedCloseAt', value);
    }

    /**
    * * Field Name: IconClass
    * * Display Name: Icon Class
    * * SQL Data Type: nvarchar(100)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get IconClass(): string | null {
        return this.Get('IconClass');
    }
    set IconClass(value: string | null) {
        this.Set('IconClass', value);
    }

    /**
    * * Field Name: Color
    * * Display Name: Color
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Color(): string | null {
        return this.Get('Color');
    }
    set Color(value: string | null) {
        this.Set('Color', value);
    }

    /**
    * * Field Name: BackgroundImageURL
    * * Display Name: Background Image URL
    * * SQL Data Type: nvarchar(1000)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get BackgroundImageURL(): string | null {
        return this.Get('BackgroundImageURL');
    }
    set BackgroundImageURL(value: string | null) {
        this.Set('BackgroundImageURL', value);
    }

    /**
    * * Field Name: Configuration
    * * Display Name: Configuration
    * * SQL Data Type: nvarchar(MAX)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get Configuration(): string | null {
        return this.Get('Configuration');
    }
    set Configuration(value: string | null) {
        this.Set('Configuration', value);
    }

    /**
    * * Field Name: AnchorEntityID
    * * Display Name: Anchor Entity ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AnchorEntityID(): string | null {
        return this.Get('AnchorEntityID');
    }
    set AnchorEntityID(value: string | null) {
        this.Set('AnchorEntityID', value);
    }

    /**
    * * Field Name: AnchorRecordID
    * * Display Name: Anchor Record ID
    * * SQL Data Type: nvarchar(450)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get AnchorRecordID(): string | null {
        return this.Get('AnchorRecordID');
    }
    set AnchorRecordID(value: string | null) {
        this.Set('AnchorRecordID', value);
    }

    /**
    * * Field Name: PostCloseAccess
    * * Display Name: Post Close Access
    * * SQL Data Type: nvarchar(20)
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get PostCloseAccess(): string | null {
        return this.Get('PostCloseAccess');
    }
    set PostCloseAccess(value: string | null) {
        this.Set('PostCloseAccess', value);
    }

    /**
    * * Field Name: PostCloseAccessDays
    * * Display Name: Post Close Access Days
    * * SQL Data Type: int
    * * IS-A Source: Inherited from MJ_BizApps_Collaboration: Spaces
    */
    get PostCloseAccessDays(): number | null {
        return this.Get('PostCloseAccessDays');
    }
    set PostCloseAccessDays(value: number | null) {
        this.Set('PostCloseAccessDays', value);
    }
}
