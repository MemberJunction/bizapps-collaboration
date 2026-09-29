/**
 * Example Space Types Package - Entities Entrypoint
 *
 * Only the subtype entity classes (ExampleBoard and ExampleRoom), with nothing else the package loads: no drivers, no components. A
 * process that reads and writes the subtypes over GraphQL but must not run the server's rules imports this to register them.
 */
export * from './generated/entities/entity_subclasses.js';
