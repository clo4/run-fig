/**
 * Write your command-line app as a _declarative_ schema that specifies its
 * `options`, `args`, and `subcommands`.
 *
 * A JavaScript library for building your command-line app. In three points:
 *
 * - **Declarative, not builder:** define options, args, and subcommands in a simple structure
 * - **Fast (for JavaScript):** beats Cliffy Command and Deno's std/flags in benchmarks
 * - **Documentation optional:** once you read the example in the README, you can figure it out on your own
 *
 * There's already a repository of over 400 commands built using the same schema.
 * It has proven to be very easy to maintain, quick to write, easy to read, and simple to scale.
 *
 * Visit the repository to learn more, or read on for the technical documentation.
 *
 * @module
 */

import * as Fig from "./src/mod.ts";

// Default namespaced export, because this module exports a *lot* of stuff
// and it's better to have a canonical import name and reduce the space taken
// up by importing this module.
export default Fig;

// You can also import items individually, like the types. Also required for
// the documentation generator, which doesn't support exported namespaces.
export * from "./src/mod.ts";

export const version = "0.0.1";
