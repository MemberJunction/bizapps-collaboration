/** @type {import('@memberjunction/config').MJConfig} */
//
// CodeGen and migrate for BizApps Collaboration. Credentials come from the
// environment. includeSchemas is the blast radius: this run generates only
// __mj_BizAppsCollaboration.
//
module.exports = {
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  dbDatabase: process.env.DB_DATABASE,
  dbUsername: process.env.DB_USERNAME,
  dbPassword: process.env.DB_PASSWORD,
  dbTrustServerCertificate:
    process.env.DB_TRUST_SERVER_CERTIFICATE === '1' ||
    process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  coreSchema: process.env.MJ_CORE_SCHEMA || '__mj',

  entityPackageName: '@mj-biz-apps/collaboration-entities',

  testing: {
    checkModules: ['@mj-biz-apps/collaboration-integration-tests'],
  },

  output: [
    { type: 'SQL', directory: './SQL Scripts/generated', appendOutputCode: true },
    {
      type: 'Angular',
      directory: './packages/Angular/src/lib/generated',
      options: [{ name: 'maxComponentsPerModule', value: 20 }],
    },
    { type: 'GraphQLServer', directory: './packages/Server/src/generated' },
    { type: 'ActionSubclasses', directory: './packages/Actions/src/generated' },
    { type: 'EntitySubclasses', directory: './packages/Entities/src/generated' },
    { type: 'DBSchemaJSON', directory: './Schema Files' },
  ],

  newEntityDefaults: {
    NameRulesBySchema: [
      { SchemaName: '${mj_core_schema}', EntityNamePrefix: 'MJ: ' },
      {
        SchemaName: '__mj_BizAppsCollaboration',
        EntityNamePrefix: 'MJ_BizApps_Collaboration: ',
        EntityNameSuffix: '',
      },
    ],
  },

  includeSchemas: ['__mj_BizAppsCollaboration'],
  excludeSchemas: ['sys', 'staging', 'dbo', '__mj'],

  advancedGeneration: {
    enableAdvancedGeneration: false,
  },

  fileEmit: {
    perSchema: true,
  },

  SQLOutput: {
    enabled: true,
    folderPath: './migrations/codegen/',
    appendToFile: false,
    convertCoreSchemaToFlywayMigrationFile: true,
    omitRecurringScriptsFromLog: false,
    schemaPlaceholders: [
      { schema: '__mj_BizAppsCollaboration', placeholder: '${flyway:defaultSchema}' },
      { schema: '__mj', placeholder: '${mjSchema}' },
    ],
  },
};
