/**
 * Example Space Types Package - GraphQL Entrypoint
 *
 * The generated resolvers for the example subtype entities (ExampleBoard and ExampleRoom), so a host that loads the example
 * types can read and write their own columns over GraphQL. Not for shipping: a host loads this only where it loads the examples.
 */

export * from './generated/server/generated.js';
