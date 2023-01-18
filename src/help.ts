import type {
  Action,
  Arg,
  Command,
  NonEmptyArray,
  Option,
  SingleOrArray,
} from "./types.ts";
import { makeArray, makeArray1 } from "./collections.ts";
import { closest } from "./deps/fastest_levenshtein.ts";

function getNamed<T extends { name: SingleOrArray<string> }>(
  named: readonly T[],
  name: string,
): T | null {
  return named.find((obj) => makeArray(obj.name).includes(name)) ?? null;
}

function getParserDirective<
  Key extends keyof NonNullable<Command["parserDirectives"]>,
>(
  path: readonly Command[],
  key: Key,
): NonNullable<Command["parserDirectives"]>[Key] | undefined {
  return path.findLast(
    (command) => command.parserDirectives && key in command.parserDirectives,
  )?.parserDirectives?.[key];
}

function dedent(str: string) {
  if (str[0] !== "\n") {
    return str;
  }
  const lines = str.split("\n").slice(1, -1);
  const margin = lines[0].length - lines[0].trimStart().length;
  return lines.map((line) => line.slice(margin)).join("\n");
}

export interface GetHelpOptions {
  /** Include the top-level description? (default: true) */
  description?: boolean;

  /** Include the usage summary? (default: true) */
  usage?: boolean;

  /** Ask if the user intended the `input` to be one of `choices` */
  didYouMean?: {
    input: string;
    choices: readonly string[];
  };
}

/**
 * Get the help message that `CLI.help` and `CLI.helpCommand` would print.
 *
 * The intended use of this function is to allow you to print the help message
 * on failure, or to re-implement the `CLI.help`/`CLI.helpCommand` builtins
 * with slightly different semantics (eg. requiring `--verbose`)
 *
 * ## Example
 * ```ts
 * export const spec: CLI.Spec = {
 *   name: "fig",
 *   options: [
 *     { name: "--verbose" },
 *     {
 *       name: "--help",
 *       usage({ options, path }) {
 *         const msg = options.has("--verbose")
 *           ? getHelp(path)
 *           : `
 * Usage: fig [command]
 *
 * Command Commands:
 *  o  doctor      Check CLI is properly configured
 *  o  settings    Customize appearance and behavior
 *  o  issue       Create a new GitHub issue
 * `.trim());
 *         console.log(msg);
 *       },
 *     },
 *   ],
 * };
 * ```
 */
export function getHelp(
  path: NonEmptyArray<Command>,
  options: GetHelpOptions = {},
): string {
  const { description = true, usage = true, didYouMean } = options;
  const sections = getSections(path);
  if (didYouMean && didYouMean.choices.length > 0) {
    sections.didYouMean = closest(
      didYouMean.input,
      // The `closest` function actually takes a `readonly string[]` but it
      // isn't typed correctly
      didYouMean.choices as string[],
    );
  }
  if (!description) {
    sections.description = undefined;
  }
  if (!usage) {
    sections.usage = undefined;
  }
  return formatHelpSections(sections);
}

/**
 * An action that prints the help message, then exits
 *
 * This is intended to be used for commands where a command _must_ be
 * provided. Usually this will be the root command, such as `git`.
 *
 * ## Example
 * ```ts
 * export const spec: CLI.Spec = {
 *   name: "git",
 *   subcommands: [
 *     { name: "commit" },
 *     { name: "switch" },
 *     { name: "restore" },
 *     { name: "stash" },
 *     // ...
 *   ],
 * };
 * ```
 */
export const usage: Action = ({ path, args: [command], error, help }) => {
  // If there is no value for `command`, then the usage action has been
  // invoked correctly and the user should see the regular help message.
  if (command === undefined) {
    console.log(help());
    return 0;
  }

  if (command === "") {
    error(
      `Expected a command, but the value was empty\n\n${
        help({
          description: false,
        })
      }`,
    );
    return 1;
  }

  // If this command was invoked with any value for `command`,
  // that's an error because the user was intending to run a
  // command.

  const subcommands = path
    .at(-1)
    ?.subcommands?.filter((cmd) => !cmd.hidden)
    .flatMap((cmd) => cmd.name);

  if (subcommands && subcommands.length > 0) {
    const matchPrefix = getParserDirective(
      path,
      "subcommandsMatchUniquePrefix",
    );
    if (matchPrefix) {
      const possible = subcommands.filter((name) => name.startsWith(command));

      // There could be zero matches if the given command name wasn't the prefix
      // of a command. In this case, show the generic 'unknown' message
      // instead of the more specific 'ambiguous' message
      if (possible.length > 0) {
        error(
          `Ambiguous command '${command}', could be: ${
            possible.join(
              ", ",
            )
          }\n\n${
            help({
              description: false,
            })
          }`,
        );
        return 1;
      }
    }

    error(
      `Unknown command '${command}'\n\n${
        help({
          description: false,
          didYouMean: {
            input: command,
            choices: subcommands,
          },
        })
      }`,
    );
    return 1;
  }
  // This case is possible when there are subcommands but
  // they're all hidden.
  error(
    `Unknown command '${command}'\n\n${
      help({
        description: false,
      })
    }`,
  );

  return 1;
};

/**
 * A command that will print help text and then exit
 *
 * This command takes an optional argument, which is the command
 * to get help for. This must be the name of a command on this command's
 * parent. If the argument isn't provided, a help message for the parent
 * will be printed to stdout.
 *
 * ## Example
 * ```ts
 * const spec: CLI.Spec = {
 *   name: "deno",
 *   subcommands: [
 *     { name: "repl" },
 *     { name: "run" },
 *     CLI.helpCommand,
 *   ],
 * };
 * ```
 */
export const helpCommand: Command = {
  name: "help",
  description: "Print a help message",
  args: {
    name: "command",
    isOptional: true,
  },
  action({ path, args: [commandName], error, help }) {
    // This is guaranteed to have at least one element in it
    const helpRoot = path.slice(0, -1) as unknown as NonEmptyArray<Command>;

    // If there's no command to get help for, get help for the parent
    // of this command.
    if (!commandName) {
      console.log(
        help({
          path: helpRoot,
        }),
      );
      return 0;
    }

    // Looking up the command can fail in two main ways:
    // 1. There are no subcommands
    // 2. There are no subcommands with that name

    // Have to check the list of subcommands on the parent command,
    // which is the second-to-last element in the path. The final element
    // is the `help` command itself.
    const parent = path[path.length - 2];

    if (!parent.subcommands || parent.subcommands.length === 1) {
      error(
        `No subcommands, try using 'help' with nothing after it\n\n${
          help({
            description: false,
            path: helpRoot,
          })
        }`,
      );
      return 1;
    }

    // If the user messed up the name of the command, this is the part that can fail.
    const command = getNamed(parent.subcommands, commandName);
    if (!command) {
      // The error message will be different depending on whether there
      // are visible subcommands or not.
      const subcommands = parent.subcommands
        .filter((cmd) => !cmd.hidden)
        .flatMap((cmd) => cmd.name);

      // If there are visible subcommands, suggesting the closest one
      // gives the user a clear indication of how the issue can be resolved.
      if (subcommands.length > 0) {
        error(
          `There is no command named '${commandName}'\n\n${
            help({
              path: helpRoot,
              didYouMean: {
                input: commandName,
                choices: subcommands,
              },
            })
          }`,
        );
        return 1;
      } else {
        error(
          `There is no command named '${commandName}'\n\n${
            help({
              description: false,
              path: helpRoot,
            })
          }`,
        );
        return 1;
      }
    }

    // Everything went smoothly, the lookup succeeded. To build the
    // correct path, take every command until *before* this help command
    // (which is guaranteed to be at -1), then concat with the command.
    console.log(
      help({
        path: [...helpRoot, command],
      }),
    );
  },
};

/**
 * A persistent help-option that will print help text and then exit
 *
 * This only needs to be added to the root command (spec) object.
 *
 * ## Example
 * ```ts
 * const spec: CLI.Spec = {
 *   name: "fish",
 *   options: [
 *     CLI.help,
 *     { name: ["-c", "--command"], args: {} },
 *     { name: ["-C", "--init-command"], args: {} },
 *     { name: ["-i", "--interactive"] },
 *     { name: ["-l", "--login"] },
 *   ],
 * };
 * ```
 */
export const help: Option = {
  name: ["-h", "--help"],
  description: "Print a help message",
  isPersistent: true,
  action({ path, help }) {
    console.log(help({ path }));
    const sections = getSections(path);
    const text = formatHelpSections(sections);
    console.log(text);
    return 0;
  },
};

type HelpSections = {
  description?: string;
  usage?: string;
  didYouMean?: string;
  options: [formattedName: string, description: string][];
  persistentOptions: [formattedName: string, description: string][];
  subcommands: [formattedName: string, description: string][];
};

function getCommandPathString(commands: NonEmptyArray<Command>): string {
  return commands
    .map((command) => getLongestString(makeArray1(command.name)))
    .join(" ");
}

function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function generateHelpString(
  path: NonEmptyArray<Command>,
  options: {
    noDescription?: true;
    didYouMean?: {
      userInput: string;
      choices: string[];
    };
    noUsage?: true;
  } = {},
): string {
  // This is a long function because it has to do a lot of work to
  // format the output correctly, but the long version is actually
  // much easier to read and maintain than the shorter one.
  const command = path[path.length - 1];
  const desc = command.description ?? "No description";

  // 📍 Subcommands
  const subcommands: readonly Command[] = command.subcommands ?? [];

  // 📍 Options
  const persistentOptions: Option[] = [];
  const normalOptions: Option[] = [];

  // Because the options should be displayed in a way that's easy to digest,
  // and because options can also be inherited, there is some more complicated
  // logic for this. TL;DR: Only display persistent options as persistent when
  // it's actually relevant (meaning not at root level)

  // 1. Extract the options
  if (path.length === 1) {
    // At the root level, there is no meaningful distinction between
    // persistent and normal options, so we can just put them all into
    // the normal options array.
    if (command.options) {
      normalOptions.push(...command.options);
    }
  } else {
    // This is either a nested command or a command with visible subcommands,
    // so the distinction between persistent and normal options is important.
    for (const subcommand of subcommands) {
      if (!subcommand.options) {
        continue;
      }
      const options = subcommand.options;
      for (const option of options) {
        if (option.hidden) {
          continue;
        }
        if (!option.isPersistent) {
          continue;
        }
        persistentOptions.push(option);
      }
    }
    if (command.options) {
      for (const option of command.options) {
        if (option.hidden) {
          continue;
        }
        if (option.isPersistent) {
          continue;
        }
        normalOptions.push(option);
      }
    }
  }

  // 📍 Usage
  const usage = (() => {
    if (options.noUsage) {
      return null;
    }
    const parts: string[] = [];

    const requiredOptions: Option[] = [];
    for (const option of normalOptions) {
      if (option.isRequired) {
        requiredOptions.push(option);
      }
    }
    for (const option of persistentOptions) {
      if (option.isRequired) {
        requiredOptions.push(option);
      }
    }
    if (requiredOptions.length > 0) {
      for (const option of requiredOptions) {
        parts.push(optionToString(option));
      }
    }

    if (
      normalOptions.length + persistentOptions.length >
        requiredOptions.length
    ) {
      parts.push("[flags]");
    }

    if (command.requiresSubcommand) {
      parts.push("<command>");
    } else {
      const args = makeArray(command.args);
      if (args.length > 0) {
        parts.push(summarizeArguments(args));
      }
    }

    const usageString = parts.join(" ");
    return usageString;
  })();

  const indent = "  ";
  const deepIndent = indent.repeat(2);

  const longestOptionName = "";

  return "";
}

function getSections(commands: NonEmptyArray<Command>): HelpSections {
  const command = commands[commands.length - 1];

  const description = command.description;
  const defaultDesc = "No description";

  const subcommands: HelpSections["subcommands"] = command.subcommands
    ? command.subcommands
      .filter((command) => !command.hidden)
      .map((command) => [
        makeArray1(command.name)
          .sort((a, b) => a.length - b.length)
          .join(", "),
        command.description ?? defaultDesc,
      ])
    : [];

  let persistentOptionObjects: Option[] = [];
  let optionObjects: Option[] = [];

  let persistentOptions: HelpSections["persistentOptions"] = [];
  let options: HelpSections["options"] = [];

  // The concept of "persistent options" makes no sense if there are
  // no subcommands, so all options should go in the options section.
  if (commands.length === 1 && subcommands.length === 0) {
    optionObjects = command.options
      ? command.options.filter((option) => !option.hidden)
      : [];
    options = optionObjects.map((option) => [
      optionToString(option),
      option.description ?? defaultDesc,
    ]);
  } else {
    persistentOptionObjects = commands
      .map((command) => command.options)
      .filter(nonNullable)
      .flat()
      .filter((option) => option.isPersistent && !option.hidden);

    persistentOptions = persistentOptionObjects.map((option) => [
      optionToString(option),
      option.description ?? defaultDesc,
    ]);

    optionObjects = (command.options ?? []).filter(
      (option) => !option.hidden && !option.isPersistent,
    );

    options = optionObjects.map((option) => [
      optionToString(option),
      option.description ?? defaultDesc,
    ]);
  }

  const usage = (() => {
    const parts = [];
    parts.push(getCommandPathString(commands));
    const required = [
      ...optionObjects.filter((option) => option.isRequired),
      ...persistentOptionObjects.filter((option) => option.isRequired),
    ];
    if (required.length) {
      for (const option of required) {
        parts.push(optionToString(option));
      }
    }
    if (options.length || persistentOptions.length) {
      parts.push("[flags]");
    }
    if (command.requiresSubcommand) {
      parts.push("<command>");
    } else {
      const args = makeArray(command.args);
      if (args.length > 0) {
        parts.push(summarizeArguments(args));
      }
    }
    return parts.join(" ");
  })();

  return {
    usage,
    description,
    persistentOptions,
    options,
    subcommands,
  };
}

export function formatHelpSections(sections: HelpSections): string {
  const parts = [];

  const indent = "  ";

  if (sections.didYouMean) {
    parts.push(`    Did you mean '${sections.didYouMean}'?`);
  }

  if (sections.description) {
    parts.push(dedent(sections.description));
  }

  if (sections.usage) {
    parts.push(`Usage:\n${indent}${sections.usage}`);
  }

  const longestOptionName = Math.max(
    ...sections.options.map(([name]) => name.length),
    ...sections.persistentOptions.map(([name]) => name.length),
  );
  const minSpacingBetweenNameAndDesc = 2;

  const formatOptions = (options: [string, string][]) => {
    const lines = [];
    const newline = indent +
      " ".repeat(longestOptionName + minSpacingBetweenNameAndDesc);
    for (const [name, desc] of options) {
      const spaces = " ".repeat(
        longestOptionName - name.length + minSpacingBetweenNameAndDesc,
      );
      const [head, ...tail] = desc.split("\n");
      const description = [head, ...tail.map((line) => newline + line)].join(
        "\n",
      );
      lines.push(`${indent}${name}${spaces}${description}`);
    }
    return lines;
  };

  if (sections.subcommands.length > 0) {
    const lines = ["Commands:"];
    const longestName = Math.max(
      ...sections.subcommands.map(([name]) => name.length),
    );
    const newline = indent +
      " ".repeat(longestName + minSpacingBetweenNameAndDesc);
    for (const [name, desc] of sections.subcommands) {
      const spaces = " ".repeat(
        longestName - name.length + minSpacingBetweenNameAndDesc,
      );
      const [head, ...tail] = desc.split("\n\n")[0].split("\n");
      const description = [head, ...tail.map((line) => newline + line)].join(
        "\n",
      );
      lines.push(`${indent}${name}${spaces}${description}`);
    }
    parts.push(lines.join("\n"));
  }

  if (sections.options.length > 0) {
    const lines = ["Flags:", ...formatOptions(sections.options)];
    parts.push(lines.join("\n"));
  }

  if (sections.persistentOptions.length > 0) {
    const lines = [
      "Global flags:",
      ...formatOptions(sections.persistentOptions),
    ];
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n") + "\n";
}

export function getLongestString(strings: NonEmptyArray<string>): string {
  let longest = strings[0];
  for (let i = 1; i < strings.length; i++) {
    const string = strings[i];
    if (string.length > longest.length) {
      longest = string;
    }
  }
  return longest;
}

export function optionToString(option: Option): string {
  const name = makeArray1(option.name)
    .sort((a, b) => a.length - b.length)
    .join(", ");

  const optArgs = makeArray(option.args);

  if (optArgs.length === 0) {
    return name;
  }

  if (option.requiresSeparator) {
    const separator = option.requiresSeparator === true
      ? "="
      : option.requiresSeparator;
    if (optArgs[0].isOptional) {
      return `${name}[${separator}${optArgs[0].name || "argument"}]`;
    } else {
      return `${name}${separator}<${optArgs[0].name || "argument"}>`;
    }
  }
  const args = summarizeArguments(optArgs);
  return `${name} ${args}`;
}

export function summarizeArguments(args: readonly Arg[]) {
  return args.map((arg) => argToString(arg)).join(" ");
}

export function argToString(arg: Arg): string {
  const name = arg.name || "argument";
  let lhs = "<";
  let rhs = ">";
  let suffix = "";
  if (arg.isOptional) {
    lhs = "[";
    rhs = "]";
  }
  if (arg.isVariadic) {
    suffix = "...";
  }
  return `${lhs}${name}${rhs}${suffix}`;
}
