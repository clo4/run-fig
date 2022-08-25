/**
 * Defines the Fig schema. This is a subset of valid autocomplete specs.
 *
 * Autocomplete specs are located here: https://github.com/withfig/autocomplete
 *
 * Most specs work without changing much, usually you only need to remove
 * generators. Some specs, such as rustup, require no changes at all.
 *
 * Typically, this uses stricter types instead of lint rules. Where the type
 * system can't enforce something, tests do (`Fig.test`).
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
 * An action is a function that's associated with a subcommand or option
 *
 * It can be async, and returns either nothing or the desired exit code.
 * Simple CLIs can put all the logic into this function, but a more
 * complex CLI should instead use this to validate the inputs and
 * dispatch to a function defined elsewhere. This allows you to separate
 * concerns -- keep the CLI in one place, and the logic elsewhere.
 *
 * @example
 * ```ts
 * export const spec: Fig.Spec = {
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

/**
 * An array of commands, starting with the root spec
 *
 * This is useful to perform introspection. This could be used to execute
 * actions of parent commands, or implement a custom help message.
 */
export type CommandPath = readonly [Spec, ...Subcommand[]];

/** Use the current options */
export interface OptionArgs {
  /** Escape hatch: the actual map of option names to values */
  readonly options: Map<string, string[]>;

  /** Get all of the options arguments */
  all(name: string): string[] | undefined;

  /** Get the option's first argument */
  get(name: string): string | undefined;

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
   * Arguments found for the subcommand
   *
   * This is just an array of strings. Reconciling the arg values to the
   * argument definitions is done in the action. It's easiest to do this with
   * array destructuring.
   *
   * @example Destructuring with a variadic argument last
   * ```ts
   * const spec: Fig.Spec = {
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
   * @example Using a variadic argument first
   * ```ts
   * const spec: Fig.Spec = {
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
   * item is always the root command, the `Fig.Spec`.
   *
   * This is useful to perform introspection.
   */
  path: CommandPath;

  /**
   * The index of the argument separator (`--`), or -1 if it was not
   * provided. This is useful to manually reconcile the arguments to
   * multiple variadic arguments.
   *
   * @example Using two variadic arguments
   * ```ts
   * const spec: Fig.Spec = {
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
   * @example
   * ```
   * const spec: Fig.Spec = {
   *   name: "example",
   *   requiresSubcommand: true,
   *   action({ help }) {
   *     console.log("A subcommand is required");
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

    /** Find the closest string from `choices` and ask the user if they meant that */
    didYouMean?: {
      /** The incorrect input */
      input: string;
      /** The correct choices that could be used instead */
      choices: readonly string[];
    };

    /** Alternative path to get help for */
    path?: NonEmptyArray<Subcommand>;
  }): string;
}

/**
 * A top-level command. This is the entrypoint to your CLI.
 *
 * This is identical to a Subcommand, except the name must be a single string
 * instead of an array of strings.
 *
 * Specs can have infinitely-nested subcommands. If a subcommand doesn't define
 * an action, it inherits the action from its parent. If no actions are defined,
 * running the CLI will return a status code of 1.
 *
 * @example
 * ```ts
 * export const spec: Fig.Spec = {
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
export interface Spec extends Omit<Subcommand, "name"> {
  /** Name of the CLI */
  name: string;
}

/**
 * A subcommand is something that can be executed
 *
 * Think of it like an API endpoint. You've used subcommands before, such
 * as `git commit` (`commit` is the subcommand), and `deno run`.
 *
 * Subcommands can have infinitely-nested subcommands. If a subcommand doesn't define
 * an action, it inherits the action from its parent. If no actions are defined,
 * running the CLI will return a status code of 1.
 *
 * Subcommands can only be invoked if there are no arguments or non-persistent
 * options preceding it. In the example below, you can use `--unstable` before
 * `run`, and still invoke the command.
 *
 * @example modelling the `deno run` command
 * ```ts
 * export const spec: Fig.Spec = {
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
export interface Subcommand {
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
   * is shown as the description next to the subcommand in the `--help` menu.
   *
   * The description is literal. It won't be dedented.
   *
   * @example
   * ```ts
   * const spec: Fig.Spec = {
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
   * be invoked with subcommands _or_ arguments. Subcommands are preferred,
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
   * const spec: Fig.Spec = {
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
   * Subcommands of this command
   *
   * If this command can take both subcommands and arguments, it can either
   * be invoked with subcommands **OR** arguments. The parser decides to
   * use a subcommand if the first "argument" provided is the name of a
   * subcommand.
   *
   * Note that _this_ command's options are _not_ automatically inherited by
   * subcommands, unless the option is persistent (`isPersistent: true`)
   */
  subcommands?: NonEmptyArray<Subcommand>;

  /** Directly control parser behavior, such as "what counts as an option" */
  parserDirectives?: {
    /**
     * Makes all option names literal, disables option chaining, and disables
     * unknown options.
     *
     * If it's false, option names can only start with `-`, `+`, or `--`. When
     * it's true, option names are treated literally, which means you can use
     * names such as `abc` instead of `--abc`.
     *
     * This is inherited for all subcommands unless a child subcommand sets it
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
  };

  /** Hide this command from any place it may be displayed */
  hidden?: true;

  /** Use a specific kind of matching for suggestions on this subcommand */
  filterStrategy?: "fuzzy" | "prefix" | "default";

  /**
   * If there is no action on this command, print usage information instead
   *
   * If the _is_ an action, the action will be executed instead of printing the
   * help information. This allows you to customize the behavior while still
   * informing the autocomplete engine.
   *
   * When this property is true, autocomplete will always insert a space after
   * the subcommand name.
   *
   * Note that actions are optional if using `requiresSubcommand`.
   *
   * NOTE: When `requiresSubcommand` is true, arguments are allowed even if
   * the command doesn't allow them. This is so the runtime can implement a
   * more useful error message for typos.
   */
  requiresSubcommand?: true;

  /**
   * Run this action when the command is used
   *
   * An action is just a normal function. It takes a predefined bag of arguments.
   *
   * You can use method-definition syntax to define the action, eg.
   * `action() {...}`. This is how all examples are formatted.
   *
   * Note that actions are optional if using `requiresSubcommand`.
   *
   * @example
   * ```ts
   * const spec: Fig.Spec = {
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
   * between `Option` and `Subcommand`, so that accidental assignments
   * don't happen.
   *
   * In reality, the types _are_ compatible, but assigning one to another is
   * most likely a mistake.
   *
   * @ignore
   */
  [kind]?: "Subcommand";
}

/**
 * Options are used to modify how a command executes
 *
 * These are provided after the subcommand and belong specifically to their
 * parent command. You've used these before, such as the permissions flags in
 * a `deno` command, eg. `deno run --allow-read --allow-net server.ts`.
 *
 * Options can have multiple names, and each name is literal. Names that
 * begin with a single dash, eg. `-x`, can be chained with other single-dash
 * options, eg. `-xyz` is the same as `-x -y -z`.
 *
 * By default, options must start with `-` (eg. `-a`), `+` (`+o`), or `--` (`--abc`).
 * Option names that start with anything else won't be found unless a parent
 * subcommand has `parserDirectives.flagsArePosixNoncompliant` set to `true`,
 * which enables literal option names.
 *
 * Options can also have actions, which will be executed _instead of the subcommand_.
 * These actions should not be used for slight changes in behavior, but instead for
 * entirely different things, such as `--help` and `--version`.
 *
 * @example
 * ```ts
 * const spec: Fig.Spec = {
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
 *         console.log("0.1.0 Fig");
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
   * @example
   * ```ts
   * // example -vvv
   * const spec: Fig.Spec = {
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
   * "Required option" is an oxymoron, it isn't obvious that an option would be
   * mandatory. It means that a user will run the command, it will fail,
   * they'll run `--help` to understand what the required option is for, then
   * finally run the command correctly.
   *
   * There are some cases where a required option makes sense:
   * - Forcing confirmation of an action, such as `typescript-language-server --stdio`
   *   which makes sure you don't end up in a confusing state by default.
   * - Knowing that the default behavior, ie. _without_ the option, isn't
   *   implemented yet but will be in the future.
   */
  isRequired?: true;

  /**
   * Fail parsing if these options are provided
   *
   * You only need to use one name of the option.
   *
   * @example
   * ```ts
   * // Succeeds: example -a
   * // Succeeds: example -x
   * // Fails:    example -ax
   * // Fails:    example -xa
   * const spec: Fig.Spec = {
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
   * @example
   * ```ts
   * // Succeeds: example -a
   * // Succeeds: example -ax
   * // Succeeds: example -xa
   * // Fails:    example -x
   * const spec: Fig.Spec = {
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
   * The subcommand and remaining options/args will continue to be parsed.
   * Option actions are executed instead of subcommand actions -- the final
   * option action will be used.
   *
   * This shouldn't be used to slightly change the behavior of an option.
   * It also disables checking the minimum number of arguments. The intended
   * use for option actions is to replicate the behavior of a subcommand,
   * like `--help` and `--version`.
   */
  action?: Action;

  /**
   * This property never exists. It's used purely to break compatibility
   * between `Option` and `Subcommand`, so that accidental assignments
   * don't happen.
   *
   * In reality, the types _are_ compatible, but assigning one to another is
   * most likely a mistake.
   *
   * @ignore
   */
  [kind]?: "Option";
}

/**
 * Args are used to provide values to an option or subcommand
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

  /** The icon to display next to the suggestion (URL, base64, or `fig://` icon) */
  icon?: string;

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

  /**
   * Template used for Fig completions
   *
   * This has no effect on parsing and is purely for use in completions.
   */
  template?: Template;

  /** Wait 100ms before running generators */
  debounce?: true;

  /**
   * When the argument is written, attempt to load suggestions for that command
   *
   * This has no effect on parsing and is purely for use in completions.
   *
   * This property is typically used for command-runners, like `time`, `exec`
   * and `xargs`.
   *
   * @example
   * import { readLines } from "https://deno.land/std/io/buffer.ts";
   * ```ts
   * // eg:  ls -la1 | append-arg rm -rf
   * const spec: Fig.Spec = {
   *   name: "append-arg",
   *   description: "Like xargs, but line-based",
   *   args: {
   *     name: "command",
   *     isVariadic: true,
   *     isCommand: true
   *   },
   *   async action({ args: [cmd, ...rest] }) {
   *     const td = new TextDecoder();
   *     for await (const line of readLines(Deno.stdin)) {
   *       const output = await Deno.spawn(cmd, {
   *         args: [...rest, line],
   *       });
   *       console.log(td.decode(output.stdout));
   *     }
   *   }
   * };
   * ```
   */
  isCommand?: true;

  /**
   * Load suggestions from .fig/autocomplete/build relative to the typed path
   *
   * This has no effect on parsing and is purely for use in completions.
   */
  isScript?: true;

  /**
   * Provide a suggestion at the top of the list with the currently typed token
   *
   * This has no effect on parsing and is purely for use in completions.
   */
  suggestCurrentToken?: true;

  /**
   * Static suggestions that should be displayed while typing this argument
   *
   * This has no effect on parsing and is purely for use in completions.
   */
  suggestions?: readonly string[] | readonly Suggestion[];

  /**
   * Generate dynamic suggestions while typing this argument
   *
   * Because generators are invoked on the CLI itself, they're relatively
   * expensive. For this reason, if it is possible to have a static list
   * of suggestions, you should use `suggestions` instead.
   *
   * If you have to have dynamic suggestions, use `script` and `splitOn` if
   * possible - try to avoid `custom`. Using `custom` incurs the cost of:
   *   Fig > Encode > Deno > Decode > Run generator > Encode > Fig > Decode
   * Using `script` and `splitOn` looks more like:
   *   Fig > Bash > Fig
   *
   * This has no effect on parsing and is purely for use in completions.
   */
  generators?: SingleOrArray<Generator>;

  /**
   * ⚠️  This value is ONLY used for documentation ⚠️
   *
   * Default value for the argument
   *
   * This has no effect on parsing and is purely for use in completions.
   * **Using this property will not provide a default value.**
   */
  default?: string;
}

type Template =
  | "help"
  | "history"
  | "folders"
  | "filepaths"
  | ["folders", "filepaths"]
  | ["filepaths", "folders"];

type GeneratorCache =
  | {
    strategy: "stale-while-revalidate";
    ttl?: number;
    cacheByDirectory?: true;
  }
  | {
    strategy: "max-age";
    ttl: number;
    cacheByDirectory?: true;
  };

export type Trigger =
  | {
    /** Trigger on every keystroke */
    on: "change";
  }
  | {
    /** Trigger when a matching string's index is changed */
    on: "match";
    string: SingleOrArray<string>;
  }
  | {
    /** Trigger when the token's length hits or passes a given length */
    on: "threshold";
    length: number;
  };

/**
 * Generators create suggestions to be displayed in Fig's autocomplete
 */
export interface Generator {
  /** Use everything after this string as the search filter */
  getQueryTerm?: string;

  /**
   * Defines when the generator logic will be executed
   *
   * If it's a string, run the generator every time the last
   * index of that string in the input changes.
   *
   * It can also be a `Fig.Trigger` object, which declaratively
   * defines when the generator should run.
   */
  trigger?: string | Trigger;

  /** Use a template  */
  template?: Template;

  /** Run this script */
  script?: string;

  /** Split the script output on this string */
  splitOn?: string;

  /** Execution timeout for the generator */
  scriptTimeout?: number;

  /** The function that gets executed when the generator is triggered */
  custom?: (tokens: string[]) =>
    | (Suggestion | string)[]
    | Promise<(Suggestion | string)[]>;

  /** Cache the result of running the generator until the next time it's run */
  cache?: GeneratorCache;
}

/** A suggestion displayed in the Fig autocomplete UI */
export interface Suggestion {
  /** Name that the Fig parser will match on */
  name: SingleOrArray<string>;

  /** How the suggestion will be displayed in the UI */
  displayName?: string;

  /** The value inserted when the suggestion is accepted */
  insertValue?: string;

  /** Additional information that should be displayed */
  description?: string;

  /** Hide the suggestion until the `name` is typed entirely */
  hidden?: true;

  /** The icon to display next to the suggestion (URL, base64, or `fig://` icon) */
  icon?: string;

  /** How high should the suggestion be ranked? (0 - 100) */
  priority?: number;

  /** The type of suggestion (changes interaction and icon) */
  type?:
    | "folder"
    | "file"
    | "arg"
    | "subcommand"
    | "option"
    | "special"
    | "shortcut";
}
