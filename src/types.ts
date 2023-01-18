/**
 * Defines the CLI schema. This is a subset of valid autocomplete specs.
 *
 * Autocomplete specs are located here: https://github.com/withfig/autocomplete
 *
 * Most specs work without changing much, usually you only need to remove
 * generators. Some specs, such as rustup, require no changes at all.
 *
 * Typically, this uses stricter types instead of lint rules. Where the type
 * system can't enforce something, tests do (`CLI.test`).
 *
 * @module
 */

/**
 * A non-existent object key to break structural compatibility between types
 */
declare const kind: unique symbol;

/** An array with at least one value in it */
export type NonEmptyArray<T> = readonly [T, ...T[]];

/** A single value, or an array with least two values */
export type SingleOrArray<T> = T | readonly [T, T, ...T[]];

/** A single value, or an array with either zero or two values */
export type SingleOrArrayOrEmpty<T> = T | [] | readonly [T, T, ...T[]];

/**
 * An action is a function that's associated with a command or option
 *
 * It can be async, and returns either nothing or the desired exit code.
 * Simple CLIs can put all the logic into this function, but a more
 * complex CLI should instead use this to validate the inputs and
 * dispatch to a function defined elsewhere. This allows you to separate
 * concerns -- keep the CLI in one place, and the logic elsewhere.
 *
 * ## Example
 * ```ts
 * export const spec: CLI.Spec = {
 *   name: "rm",
 *   args: { name: "path", isVariadic: true },
 *   options: [
 *     { name: "-r", description: "Recursive" },
 *     { name: "-f", description: "Force" },
 *   ],
 *   action({ options, args }) {
 *     const force = options.has("-f");
 *     const recursive = options.has("-r");
 *     for (const path of args) {
 *       // ...
 *     }
 *   },
 * };
 * ```
 */
export interface Action {
  (init: ActionInit): Promise<number | void> | number | void;

  /**
   * This property never exists. It's used purely to break compatibility
   * between otherwise compatible interfaces, so that accidental assignments
   * don't happen.
   *
   * In reality, the types _are_ compatible, but assigning one to another is
   * most likely a mistake.
   *
   * @ignore
   */
  [kind]?: "Action";
}

/** Use the current options */
export interface OptionArgs {
  /** Escape hatch: the actual map of option names to values */
  readonly options: Map<string, string[]>;

  /** Get the option's arguments, with a guard variable as the first value */
  get(name: string): [true, ...string[]] | [false];

  /** Check if the option was provided */
  has(name: string): boolean;

  /** Count the number of arguments, useful for `isRepeatable` */
  count(name: string): number;
}

/**
 * The data an action will be called with
 */
export interface ActionInit {
  /**
   * The options that were found
   *
   * This is not a `Map`, but the underlying map can be accessed with the
   * `options` property.
   */
  options: OptionArgs;

  /**
   * Arguments found for the command
   *
   * This is just an array of strings. Reconciling the arg values to the
   * argument definitions is done in the action. It's easiest to do this with
   * array destructuring.
   *
   * ## Example Destructuring with a variadic argument last
   * ```ts
   * const spec: CLI.Spec = {
   *   name: "find-text",
   *   args: [
   *     { name: "text" },
   *     { name: "files", isVariadic: true },
   *   ],
   *   action({ args: [text, ...files] }) {
   *     // ...
   *   }
   * }
   * ```
   *
   * ## Example Using a variadic argument first
   * ```ts
   * const spec: CLI.Spec = {
   *   name: "mv",
   *   args: [
   *     { name: "source", isVariadic: true },
   *     { name: "target" },
   *   ],
   *   // mv <sources...> <target>
   *   action({ args }) {
   *     const source = args.slice(0, -1);
   *     const target = args.at(-1);
   *     // ...
   *   }
   * }
   * ```
   */
  args: string[];

  /**
   * Array of commands used leading up to the action invocation
   *
   * There's always at least one item in the array. The first (0th)
   * item is always the root command, the `CLI.Spec`.
   *
   * This is useful to perform introspection.
   */
  path: NonEmptyArray<Command>;

  /**
   * The index of the argument separator (`--`), or -1 if it was not
   * provided. This is useful to manually reconcile the arguments to
   * multiple variadic arguments.
   *
   * ## Example Using two variadic arguments
   * ```ts
   * const spec: CLI.Spec = {
   *   name: "example",
   *   args: [
   *     { name: "one", isVariadic: true },
   *     { name: "two", isVariadic: true },
   *   ],
   *   action({ args, argSeparatorIndex: idx }) {
   *     if (!(0 < idx && idx <= args.length)) {
   *       throw new Error(
   *         "Separator ('--') is required to separate variadic args",
   *       );
   *     }
   *     const one = args.slice(0, idx);
   *     const two = args.slice(idx);
   *     // ...
   *   }
   * }
   * ```
   */
  argSeparatorIndex: number;

  /**
   * Write an error message to stderr, prefixed by red text saying "Error"
   *
   * This is the same error message that the runtime uses.
   */
  error(...strings: string[]): void;

  /**
   * Get help text for the currently executing command
   *
   * This is useful for customizing the help message, or showing how the app
   * should be used when it is used incorrectly.
   *
   * ## Example
   * ```
   * const spec: CLI.Spec = {
   *   name: "example",
   *   requiresCommand: true,
   *   action({ help }) {
   *     console.log("A command is required");
   *     console.log(help({ usage: false }));
   *   },
   *   subcommands: [
   *     // ...
   *   ],
   * };
   * ```
   */
  help(options?: {
    /** Include the command description? (default: true) */
    description?: boolean;

    /** Include the usage summary? (default: true) */
    usage?: boolean;

    /**
     * Ask the user if they meant a different command.
     */
    didYouMean?: {
      /** The incorrect input that the user provided */
      input: string;
      /** The correct choices that could be used instead */
      choices: readonly string[];
    };

    /**
     * Provide a custom path to get help for.
     *
     * By default, if path isn't provided, the current path is used.
     */
    path?: NonEmptyArray<Command>;
  }): string;
}

/**
 * A top-level command. This is the entrypoint to your CLI.
 *
 * This is identical to a Command, except the name must be a single string
 * instead of an array of strings.
 *
 * Specs can have infinitely-nested subcommands. If a command doesn't define
 * an action, it inherits the action from its parent. If no actions are defined,
 * running the CLI will return a status code of 1.
 *
 * ## Example
 * ```ts
 * export const spec: CLI.Spec = {
 *   name: "rm",
 *   args: { name: "path", isVariadic: true },
 *   options: [
 *     { name: "-r", description: "Recursive" },
 *     { name: "-f", description: "Force" },
 *   ],
 *   action({ options, args }) {
 *     const force = options.has("-f");
 *     const recursive = options.has("-r");
 *     for (const path of args) {
 *       // ...
 *     }
 *   },
 * };
 * ```
 */
export interface Spec extends Omit<Command, "name"> {
  /** Name of the CLI */
  name?: string;
}

/**
 * Parser directives for subcommands. These are options defined on the command
 * that control how the parser works, without having to touch the parser itself.
 */
export interface CommandParserDirectives {
  /**
   * Makes all option names literal, disables option chaining, and disables
   * unknown options.
   *
   * If it's false, option names can only start with `-`, `+`, or `--`. When
   * it's true, option names are treated literally, which means you can use
   * names such as `abc` instead of `--abc`.
   *
   * This is inherited for all subcommands unless a child command sets it
   * to false.
   */
  flagsArePosixNoncompliant?: boolean;

  /**
   * Disallow mixing options and arguments
   *
   * Once an argument has been provided, all following tokens will be
   * treated as arguments, regardless of whether they are valid options.
   */
  optionsMustPrecedeArguments?: boolean;

  /**
   * The separators that can be used for an option argument
   *
   * To disable option arg separators, set this value to an empty array.
   *
   * This is inherited for all subcommands unless overridden.
   */
  optionArgSeparators?: SingleOrArrayOrEmpty<string>;

  /**
   * Match command names on the shortest unique segment instead of
   * requiring exact matches
   */
  subcommandsMatchUniquePrefix?: boolean;
}

/**
 * A command is something that can be executed
 *
 * Think of it like an API endpoint. You've used subcommands before, such
 * as `git commit` (`commit` is the command), and `deno run`.
 *
 * Commands can have infinitely-nested subcommands. If a command doesn't define
 * an action, it inherits the action from its parent. If no actions are defined,
 * running the CLI will return a status code of 1.
 *
 * Commands can only be invoked if there are no arguments or non-persistent
 * options preceding it. In the example below, you can use `--unstable` before
 * `run`, and still invoke the command.
 *
 * ## Example modelling the `deno run` command
 * ```ts
 * export const spec: CLI.Spec = {
 *   name: "deno",
 *   options: [
 *     { name: "--unstable", isPersistent: true },
 *     { name: ["-q", "--quiet"], isPersistent: true },
 *   ],
 *   subcommands: [
 *     {
 *       name: "run",
 *       options: [
 *         { name: ["-A", "--allow-all"] },
 *         { name: "--allow-read" },
 *       ],
 *       args: [
 *         { name: "script" },
 *         { name: "args", isVariadic: true, isOptional: true },
 *       ],
 *       parserDirectives: {
 *         optionsMustPrecedeArguments: true,
 *       },
 *       action({ options, args: [script, ...args] }) {
 *         // ...
 *       }
 *     },
 *   ],
 * };
 * ```
 */
export interface Command {
  /** Name of the command, used for matching and filtering */
  name: SingleOrArray<string>;

  /**
   * Insert this string instead of the name
   *
   * This is only used in fig completions.
   */
  insertValue?: string;

  /**
   * Display this string instead of the name
   *
   * This is only used in fig completions.
   */
  displayName?: string;

  /**
   * Description of the command
   *
   * If more than one paragraph is provided (separated by two newlines,
   * eg. `\n\n`), the first one will be used as the short description. This
   * is shown as the description next to the command in the `--help` menu.
   *
   * The description is literal. It won't be dedented.
   *
   * ## Example
   * ```ts
   * const spec: CLI.Spec = {
   *   name: "deno",
   *   description: `
   * A modern JavaScript and TypeScript runtime
   *
   * Docs: https://deno.land/manual
   * Modules: https://deno.land/std/ https://deno.land/x/
   * Bugs: https://github.com/denoland/deno/issues
   *
   * To start the REPL:
   *
   *   deno
   *
   * `.trim(),
   *   // ...
   * }
   * ```
   */
  description?: string;

  /** The icon to display next to the suggestion (URL, base64, or `fig://` icon) */
  icon?: string;

  /** How high should the suggestion be ranked? (0 - 100) */
  priority?: number;

  /**
   * Arguments allow you to take some data, such as file names
   *
   * If this command can take both subcommands and arguments, it can either
   * be invoked with subcommands _or_ arguments. Commands are preferred,
   * but the name must match exactly.
   */
  args?: SingleOrArray<Arg>;

  /**
   * Optional flags to modify the command's `action` behavior
   *
   * The presence of these options is checked at runtime in the `action`,
   * using the `options` property.
   *
   * ```ts
   * const spec: CLI.Spec = {
   *   name: "deno",
   *   subcommands: [{
   *     name: "run",
   *     options: [
   *       {
   *         name: "--allow-read",
   *         requiresSeparator: true,
   *         args: {
   *           name: "files",
   *           isOptional: true,
   *         },
   *       },
   *     ],
   *     action({ options }) {
   *       const [allowRead, readable = "/"] = options.values("--allow-read");
   *       if (allowRead) {
   *         console.log("I can read", readable);
   *       } else {
   *         console.log("I can't read :)");
   *       }
   *     }
   *   }],
   * };
   * ```
   */
  options?: NonEmptyArray<Option>;

  /**
   * Commands of this command
   *
   * If this command can take both subcommands and arguments, it can either
   * be invoked with subcommands **OR** arguments. The parser decides to
   * use a command if the first "argument" provided is the name of a
   * command.
   *
   * Note that _this_ command's options are _not_ automatically inherited by
   * subcommands, unless the option is persistent (`isPersistent: true`)
   */
  subcommands?: NonEmptyArray<Command>;

  /** Directly control parser behavior, such as "what counts as an option" */
  parserDirectives?: CommandParserDirectives;

  /** Hide this command from any place it may be displayed */
  hidden?: true;

  /**
   * If there is no action on this command, print usage information instead
   *
   * If the _is_ an action, the action will be executed instead of printing the
   * help information. This allows you to customize the behavior while still
   * informing the autocomplete engine.
   *
   * When this property is true, autocomplete will always insert a space after
   * the command name.
   *
   * Note that actions are optional if using `requiresCommand`.
   *
   * NOTE: When `requiresCommand` is true, arguments are allowed even if
   * the command doesn't allow them. This is so the runtime can implement a
   * more useful error message for typos.
   */
  requiresCommand?: true;

  /**
   * Run this action when the command is used
   *
   * An action is just a normal function. It takes a predefined bag of arguments.
   *
   * You can use method-definition syntax to define the action, eg.
   * `action() {...}`. This is how all examples are formatted.
   *
   * Note that actions are optional if using `requiresCommand`.
   *
   * ## Example
   * ```ts
   * const spec: CLI.Spec = {
   *   name: "sprint",
   *   description: "Execute a command",
   *   args: [
   *     { name: "command", isCommand: true },
   *     { name: "args", isVariadic: true, isOptional: true },
   *   ],
   *   options: [
   *     { name: "--time", description: "Time the execution" },
   *     { name: "--output", args: { name: "path" } },
   *     { name: "--censor", args: { name: "words", isVariadic: true } },
   *     { name: ["-v", "--verbose"], isRepeatable: true },
   *   ],
   *   action({ args: [command, ...args], options, error }) {
   *     commands; // => string
   *     args; // => string[]
   *
   *     // The `options` object has methods available to get data about
   *     // the options, like args, presence, and number of usages.
   *
   *     options.has("--time"); // => boolean
   *     options.get("--output"); // => string
   *     options.all("--censor"); // => string[]
   *     options.count("--verbose"); // => number
   *   },
   * };
   * ```
   */
  action?: Action;

  /**
   * This property never exists. It's used purely to break compatibility
   * between `Option` and `Command`, so that accidental assignments
   * don't happen.
   *
   * In reality, the types _are_ compatible, but assigning one to another is
   * most likely a mistake.
   *
   * @ignore
   */
  [kind]?: "Command";
}

/**
 * Options are used to modify how a command executes
 *
 * These are provided after the command and belong specifically to their
 * parent command. You've used these before, such as the permissions flags in
 * a `deno` command, eg. `deno run --allow-read --allow-net server.ts`.
 *
 * Options can have multiple names, and each name is literal. Names that
 * begin with a single dash, eg. `-x`, can be chained with other single-dash
 * options, eg. `-xyz` is the same as `-x -y -z`.
 *
 * By default, options must start with `-` (eg. `-a`), `+` (`+o`), or `--` (`--abc`).
 * Option names that start with anything else won't be found unless a parent
 * command has `parserDirectives.flagsArePosixNoncompliant` set to `true`,
 * which enables literal option names.
 *
 * Options can also have actions, which will be executed _instead of the subcommand_.
 * These actions should not be used for slight changes in behavior, but instead for
 * entirely different things, such as `--help` and `--version`.
 *
 * ## Example
 * ```ts
 * const spec: CLI.Spec = {
 *   name: "sort",
 *   options: [
 *     { name: "-s", description: "Stable sort" },
 *     { name: ["-u", "--unique"], description: "Unique keys (implies -s)" },
 *     {
 *       name: ["-S", "--buffer-size"],
 *       description: "Use this as the maximum size of the memory buffer",
 *       args: { name: "size" },
 *     },
 *     {
 *       name: "--version",
 *       action() {
 *         console.log("0.1.0 CLI");
 *       },
 *     },
 *     // ...
 *   ],
 *   action({ options }) {
 *     const unique = options.has("--unique");
 *     const stable = options.has("--stable");
 *     const [size] = options.get("--buffer-size")
 *   }
 * };
 * ```
 */
export interface Option {
  /**
   * Name(s) of the option, including leading dashes
   *
   * The option can be invoked with any of these names. You should include the leading dashes.
   */
  name: SingleOrArray<string>;

  /** Insert this string instead of the name */
  insertValue?: string;

  /** Display this string instead of the name */
  displayName?: string;

  /** Description of the option */
  description?: string;

  /** The icon to display next to the suggestion (URL, base64, or `fig://` icon) */
  icon?: string;

  /** How high should the suggestion be ranked? (0 - 100) */
  priority?: number;

  /**
   * Arguments this option takes
   *
   * All arguments after an optional argument must also be optional.
   */
  args?: SingleOrArray<Arg>;

  /** Allow this option to be used for all descendent subcommands */
  isPersistent?: true;

  /** Hide this option from any place it may be displayed */
  hidden?: true;

  /** Only allow arguments to be provided with a separator */
  requiresSeparator?: true | string;

  /**
   * Allow this option to be provided multiple times
   *
   * Due to limitations with parsing, repeatable options cannot take arguments.
   * For example, with `{ name: "-i", args: { isOptional: true }, isRepeatable: true }`, is
   * `-iii` the same as `-i -i -i` or `-i ii`?
   *
   * Instead of using a repeatable option with an argument, use a non-repeatable
   * option with a variadic argument.
   *
   * A repeatable option will have multiple empty strings in the array to count
   * the number of repetitions.
   *
   * ## Example
   * ```ts
   * // example -vvv
   * const spec: CLI.Spec = {
   *   name: "example",
   *   options: [{
   *     name: "-v",
   *     isRepeatable: 3,
   *   }],
   *   action({ options }) {
   *     // If omitted, it will be `undefined`. If `-v` is provided, it
   *     // will be an array of empty strings (as many as usages of `-v`)
   *     const verbosity = options.get("-v").length;
   *   },
   * };
   * ```
   */
  isRepeatable?: true | number;

  /**
   * Fail if the option isn't provided
   *
   * ## Don't use this if you can avoid it
   *
   * "Required option" is an oxymoron, it isn't obvious that an *option* would be
   * mandatory. It means that the user will run the command, see it fail,
   * run `--help` to understand what the required option is for, *then*
   * finally run the command correctly.
   *
   * There are some cases where a required option makes sense:
   * - Forcing confirmation of an action, such as `typescript-language-server --stdio`
   *   which makes sure you don't end up in a confusing state by default.
   *   - Note that this would still be better suited to a command.
   * - Knowing that the default behavior, ie. _without_ the option, isn't
   *   implemented yet but will be in the future.
   */
  isRequired?: true;

  /**
   * Fail parsing if these options are provided
   *
   * You only need to use one name of the option.
   *
   * ## Example
   * ```ts
   * // Succeeds: example -a
   * // Succeeds: example -x
   * // Fails:    example -ax
   * // Fails:    example -xa
   * const spec: CLI.Spec = {
   *   name: "example",
   *   options: [
   *     { name: ["-a", "--abc"] },
   *     { name: ["-x", "--xyz"], exclusiveOn: ["--abc"] },
   *   ],
   * };
   * ```
   */
  exclusiveOn?: NonEmptyArray<string>;

  /**
   * Fail parsing if these options are _not_ provided
   *
   * You only need to use one name of the option. The options can be
   * provided in any order.
   *
   * ## Example
   * ```ts
   * // Succeeds: example -a
   * // Succeeds: example -ax
   * // Succeeds: example -xa
   * // Fails:    example -x
   * const spec: CLI.Spec = {
   *   name: "example",
   *   options: [
   *     { name: ["-a", "--abc"] },
   *     { name: ["-x", "--xyz"], dependsOn: ["--abc"] },
   *   ],
   * };
   * ```
   */
  dependsOn?: NonEmptyArray<string>;

  /**
   * Action performed when this option is provided
   *
   * The command and remaining options/args will continue to be parsed.
   * Option actions are executed instead of command actions -- the final
   * option action will be used.
   *
   * This shouldn't be used to slightly change the behavior of an option.
   * It also disables checking the minimum number of arguments. The intended
   * use for option actions is to replicate the behavior of a command,
   * like `--help` and `--version`.
   */
  action?: Action;

  /**
   * This property never exists. It's used purely to break compatibility
   * between `Option` and `Command`, so that accidental assignments
   * don't happen.
   *
   * In reality, the types _are_ compatible, but assigning one to another is
   * almost definitely a mistake.
   *
   * @ignore
   */
  [kind]?: "Option";
}

/**
 * Args are used to provide values to an option or command
 *
 * This is the script name in `deno run script.ts`, or the text in `grep TODO`.
 *
 * Args are required by default. To make them optional, set `isOptional: true`.
 * They can also be variadic with `isVariadic: true`, meaning they take an
 * infinite number of values instead of only one.
 *
 * Variadic option arguments are ended by finding another option.
 */
export interface Arg {
  /** Name of the argument */
  name?: string;

  /** Description of the argument */
  description?: string;

  /**
   * Allow this argument to take unlimited values
   *
   * A variadic argument _without_ `isOptional: true` requires at least
   * one value.
   */
  isVariadic?: true;

  /**
   * Allow this argument to be omitted
   *
   * All following arguments must also be optional.
   */
  isOptional?: true;
}
