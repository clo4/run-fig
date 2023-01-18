/**
 * Supplementary module to make testing your CLI easier.
 *
 * @module
 */

import { Arg, Option, SingleOrArray, Command } from "./types.ts";
import { isArray, makeArray } from "./collections.ts";
import { assert, getMaxArgs, getMinArgs } from "./parse.ts";

const repr = JSON.stringify;

// TODO: one decorators are stable (ts 4.9?), use decorators this file

/**
 * Run a function once for each `args` property in the spec (recursive)
 *
 * This will convert single args to an array with one item.
 */
function forEachArgArray(
  spec: Command,
  fn: (args: Arg[], path: Command[]) => void,
  path: Command[] = []
): void {
  path = path.concat(spec);
  fn(makeArray(spec.args), path);
  for (const option of makeArray(spec.options)) {
    fn(makeArray(option.args), path);
  }
  for (const command of makeArray(spec.subcommands)) {
    forEachArgArray(command, fn, path);
  }
}

/** Run a function once for each `options` property in the spec (recursive) */
function forEachOptionArray(
  spec: Command,
  fn: (options: Option[], path: Command[]) => void,
  path: Command[] = []
): void {
  path = path.concat(spec);
  fn(makeArray(spec.options), path);
  for (const command of makeArray(spec.subcommands)) {
    forEachOptionArray(command, fn, path);
  }
}

/**
 * Run a function once for each `subcommands` property in the spec (recursive)
 *
 * This will also run the function for the root spec itself.
 */
function forEachCommand(
  spec: Command,
  fn: (spec: Command, path: Command[]) => void,
  path: Command[] = []
): void {
  path = path.concat(spec);
  fn(spec, path);
  for (const command of makeArray(spec.subcommands)) {
    forEachCommand(command, fn, path);
  }
}

function joinNames(names: SingleOrArray<string>) {
  return makeArray(names)
    .sort((a, b) => a.length - b.length)
    .join("|");
}

function namedArrayToString(...parts: { name: SingleOrArray<string> }[]) {
  const names = parts.map((named) => joinNames(named.name));
  return `\`${names.join(" ")}\``;
}

/** Asserts that required arguments do not come after an optional argument */
export function assertRequiredArgumentsDoNotFollowOptionalArguments(
  spec: Command
): void {
  forEachArgArray(spec, (args, path) => {
    let remainingMustBeOptional = false;
    let firstOptionalArgIndex: number | null = null;
    for (const [index, arg] of args.entries()) {
      if (remainingMustBeOptional) {
        // deno-fmt-ignore
        assert(
          arg.isOptional,
          `In ${namedArrayToString(...path)}, argument ${
            arg.name || index
          } is required, but it must be optional since the argument at index ${firstOptionalArgIndex} is optional`
        );
      } else if (arg.isOptional) {
        remainingMustBeOptional = true;
        firstOptionalArgIndex ??= index;
      }
    }
  });
}

/** Asserts that options with `isRepeatable: true` don't have arguments */
export function assertRepeatableOptionsHaveNoArguments(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    for (const [index, option] of options.entries()) {
      // deno-fmt-ignore
      assert(
        !(option.args && option.isRepeatable),
        `The option ${namedArrayToString(
          ...path,
          option
        )} (index ${index}) has arguments and is repeatable. Repeatable options cannot have arguments, but you can use a variadic argument instead.`
      );
    }
  });
}

/** Asserts that `isRepeatable` is only assigned a positive integer */
export function assertRepeatableOptionsArePositiveIntegers(
  spec: Command
): void {
  forEachOptionArray(spec, (options, path) => {
    for (const [index, option] of options.entries()) {
      if (typeof option.isRepeatable === "number") {
        // deno-fmt-ignore
        assert(
          Number.isSafeInteger(option.isRepeatable),
          `The option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) has its \`isRepeatable\` value set to a number that is not an integer`
        );
        // deno-fmt-ignore
        assert(
          !(option.isRepeatable < 1),
          `The option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) has its \`isRepeatable\` value set to a number below 1, which means it can't be used at all`
        );
        // deno-fmt-ignore
        assert(
          option.isRepeatable !== 1,
          `The option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) has its \`isRepeatable\` value set to 1, which is no different that omitting the property entirely`
        );
      }
    }
  });
}

/** Asserts that options have unique names in their scope */
export function assertOptionsHaveLocallyUniqueNames(spec: Command): void {
  forEachCommand(spec, (spec, path) => {
    const optionNames = new Set<string>();
    for (const [index, option] of makeArray(spec.options).entries()) {
      for (const name of makeArray(option.name)) {
        // deno-fmt-ignore
        assert(
          !optionNames.has(name),
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) has a non-unique name, '${name}'. Option names must be unique.`
        );
        optionNames.add(name);
      }
    }
  });
}

/** Asserts that options don't shadow a persistent option */
export function assertOptionsDoNotShadowPersistentOptions(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    const persistentOptionNames = new Set(
      path
        .slice(0, -1)
        .flatMap((command) =>
          command.options
            ? command.options
                .filter((option) => option.isPersistent)
                .flatMap((option) => option.name)
            : []
        )
    );
    for (const [index, option] of makeArray(options).entries()) {
      for (const name of makeArray(option.name)) {
        // deno-fmt-ignore
        assert(
          !persistentOptionNames.has(name),
          `The option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) shadows the name of a persistent option, ${repr(
            name
          )}. Option names can't shadow persistent options.`
        );
      }
    }
  });
}

/** Asserts that subcommands don't share a name with a sibling command */
export function assertCommandsHaveLocallyUniqueNames(spec: Command): void {
  forEachCommand(spec, (spec, path) => {
    const names = new Set<string>();
    for (const [index, command] of makeArray(spec.subcommands).entries()) {
      for (const name of makeArray(command.name)) {
        // deno-fmt-ignore
        assert(
          !names.has(name),
          `The command ${namedArrayToString(
            ...path,
            command
          )} (index ${index}) has a non-unique name, ${repr(
            name
          )}. Command names must be unique among the subcommands in the same array.`
        );
        names.add(name);
      }
    }
  });
}

/**
 * Asserts that option names starting with a single dash aren't longer
 * than two characters, unless parserDirectives.flagsArePosixNoncompliant is
 * set on an ancestor command.
 */
export function assertLongOptionNamesDoNotStartWithSingleDash(
  spec: Command
): void {
  forEachOptionArray(spec, (options, path) => {
    // TODO: check if this is correct
    const skip =
      path
        .map((command) => command.parserDirectives?.flagsArePosixNoncompliant)
        .filter((value) => value !== undefined)
        .at(-1) || false;

    if (skip) return;

    for (const [index, option] of makeArray(options).entries()) {
      for (const name of makeArray(option.name)) {
        // deno-fmt-ignore
        assert(
          !(
            (name.startsWith("-") || name.startsWith("+")) &&
            !name.startsWith("--") &&
            name.length > 2
          ),
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) has a name that the parser is unable to parse, as it starts with a single '${
            name[0]
          }'. Tokens starting with that character are interpreted as short options, so passing '${name}' will be interpreted as '${[
            ...name.slice(1),
          ]
            .map((letter) => name[0] + letter)
            .join(
              " "
            )}'. \`parserDirectives.flagsArePosixNoncompliant\` must be \`true\` on an ancestor command.`
        );
      }
    }
  });
}

/**
 * Asserts that all option names start with dashes
 */
export function assertOptionNamesStartWithDashes(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    // TODO: check if this is correct
    const skip =
      path
        .map((command) => command.parserDirectives?.flagsArePosixNoncompliant)
        .filter((value) => value !== undefined)
        .at(-1) || false;

    if (skip) return;

    for (const [index, option] of makeArray(options).entries()) {
      for (const name of makeArray(option.name)) {
        // deno-fmt-ignore
        assert(
          name.startsWith("-") || name.startsWith("+"),
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) doesn't start with a dash or plus, the parser will be unable to find matching options without \`parserDirectives.flagsAreNonPosixCompliant\` being set to 'true' on an ancestor command`
        );
      }
    }
  });
}

/**
 * Asserts that nothing is named exactly '--'
 */
export function assertNothingIsNamedDashDash(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    for (const [index, option] of makeArray(options).entries()) {
      for (const name of makeArray(option.name)) {
        // deno-fmt-ignore
        assert(
          name !== "--",
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) is named '--', which is a special instruction to the parser to treat all following tokens as arguments. This will never be matched`
        );
      }
    }
  });
  forEachCommand(spec, (subcommands, path) => {
    for (const [index, command] of makeArray(subcommands).entries()) {
      for (const name of makeArray(command.name)) {
        // deno-fmt-ignore
        assert(
          name !== "--",
          `Command ${namedArrayToString(
            ...path,
            command
          )} (index ${index}) is named '--', which is a special instruction to the parser to treat all following tokens as arguments. This will never be matched`
        );
      }
    }
  });
}

/**
 * Asserts that no option arg separator is an empty string
 */
export function assertOptionArgSeparatorsHaveCharacters(spec: Command): void {
  // FIXME: `subcommands` isn't an array
  forEachCommand(spec, (subcommands, path) => {
    for (const [index, command] of makeArray(subcommands).entries()) {
      const separators = makeArray(
        command.parserDirectives?.optionArgSeparators
      );
      for (const [sepIndex, separator] of separators.entries()) {
        // deno-fmt-ignore
        assert(
          separator !== "",
          `Command ${namedArrayToString(
            ...path,
            command
          )} (index ${index}) has an empty string for an option arg separator at index ${sepIndex}. If you wanted to disable option arg separators, use an empty array.`
        );
      }
    }
  });
}

/**
 * Asserts that options named "+" or "-" takes one arg
 */
export function assertPlusMinusOptionsTakeOneArg(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    // TODO: check if this is correct
    const skip =
      path
        .map((command) => command.parserDirectives?.flagsArePosixNoncompliant)
        .filter((value) => value !== undefined)
        .at(-1) || false;

    if (skip) return;

    for (const [index, option] of makeArray(options).entries()) {
      for (const name of makeArray(option.name)) {
        if (name !== "-" && name !== "+") {
          continue;
        }
        // deno-fmt-ignore
        assert(
          option.args && !Array.isArray(option.args),
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) must take exactly one argument`
        );
      }
    }
  });
}

/**
 * Asserts that names do not have leading or trailing whitespace
 */
export function assertNamesHaveNoExtraWhitespace(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    for (const [index, option] of makeArray(options).entries()) {
      for (const name of makeArray(option.name)) {
        // deno-fmt-ignore
        assert(
          name === name.trim(),
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) has a name with extra whitespace`
        );
      }
    }
  });
  // FIXME: `subcommands` isn't an array
  forEachCommand(spec, (subcommands, path) => {
    for (const [index, command] of makeArray(subcommands).entries()) {
      for (const name of makeArray(command.name)) {
        // deno-fmt-ignore
        assert(
          name === name.trim(),
          `Command ${namedArrayToString(
            ...path,
            command
          )} (index ${index}) has a name with extra whitespace`
        );
      }
    }
  });
  forEachArgArray(spec, (args, path) => {
    for (const [index, arg] of makeArray(args).entries()) {
      for (const name of makeArray(arg.name)) {
        // deno-fmt-ignore
        assert(
          name === name.trim(),
          `Arg in ${namedArrayToString(
            ...path
          )} (at index ${index}) has a name with extra whitespace`
        );
      }
    }
  });
}

/**
 * Asserts that everything has a description
 */
export function assertEverythingHasDescription(spec: Command): void {
  assert(spec.description, `Spec has no description`);
  forEachOptionArray(spec, (options, path) => {
    for (const [index, option] of makeArray(options).entries()) {
      // deno-fmt-ignore
      assert(
        option.description,
        `Option ${namedArrayToString(
          ...path,
          option
        )} (index ${index}) has no description`
      );
    }
  });
  // FIXME: `subcommands` isn't an array
  forEachCommand(spec, (subcommands, path) => {
    for (const [index, command] of makeArray(subcommands).entries()) {
      // deno-fmt-ignore
      assert(
        command.description,
        `Command ${namedArrayToString(
          ...path,
          command
        )} (index ${index}) has no description`
      );
    }
  });
}

/**
 * Asserts that descriptions have line length < 69
 */
export function assertDescriptionLineLengthUnder69(spec: Command): void {
  if (spec.description) {
    // deno-fmt-ignore
    assert(
      spec.description.split("\n").every((line) => line.length <= 68),
      `Spec has a description line over 68 characters`
    );
  }
  forEachOptionArray(spec, (options, path) => {
    for (const [index, option] of makeArray(options).entries()) {
      if (option.description) {
        // deno-fmt-ignore
        assert(
          option.description.split("\n").every((line) => line.length <= 68),
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) has a description line over 68 characters`
        );
      }
    }
  });
  // FIXME: `subcommands` isn't an array
  forEachCommand(spec, (subcommands, path) => {
    for (const [index, command] of makeArray(subcommands).entries()) {
      if (command.description) {
        // deno-fmt-ignore
        assert(
          command.description.split("\n").every((line) => line.length <= 68),
          `Command ${namedArrayToString(
            ...path,
            command
          )} (index ${index}) has a description line over 68 characters`
        );
      }
    }
  });
}

export function assertRequiresSeparatorTakesOneArg(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    for (const [index, option] of makeArray(options).entries()) {
      if (option.requiresSeparator) {
        const args = makeArray(option.args);
        // deno-fmt-ignore
        assert(
          getMinArgs(args) <= 1,
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) takes a minimum of ${getMinArgs(
            args
          )} arg(s), but because of requiresSeparator, it must instead be 0 or 1`
        );
        // deno-fmt-ignore
        assert(
          getMaxArgs(args) === 1,
          `Option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) takes a maximum of ${getMaxArgs(
            args
          )} arg(s), but because of requiresSeparator, it's only able to take 1`
        );
      }
    }
  });
}

export function assertCommonOptionsArePersistent(spec: Command): void {
  const isSameName = (
    a: string | readonly string[],
    b: string | readonly string[]
  ) => {
    if (isArray(a) && isArray(b)) {
      return (
        a.every((item) => b.includes(item)) &&
        b.every((item) => a.includes(item))
      );
    }
    // This might compare a string to an array, but if that happens the correct
    // result is `false` anyway, so this behaves correctly
    return a === b;
  };
  const failures: [string | readonly string[], string][] = [];
  forEachCommand(spec, (command, path) => {
    if (!command.subcommands) {
      return;
    }
    for (const option of makeArray(command.options)) {
      const allChildCommands: Command[] = [];
      forEachCommand(command, (cmd) => allChildCommands.push(cmd));

      const allShareOption = allChildCommands.every((cmd) =>
        makeArray(cmd.options).some((o) => isSameName(option.name, o.name))
      );

      if (
        allShareOption &&
        !failures.some(([name]) => isSameName(name, option.name))
      ) {
        failures.push([option.name, namedArrayToString(...path, option)]);
      }
    }
  });
  assert(
    failures.length === 0,
    `The following options were also defined by all subcommands. Instead, define the option once, and use \`isPersistent: true\` to persist it across all subcommands.
${failures.map(([_, line]) => " * " + line).join("\n")}
`
  );
}

/**
 * Asserts that references to other options by name actually refer to options
 * that exist in scope
 */
export function assertOptionNameReferencesExist(spec: Command): void {
  forEachOptionArray(spec, (options, path) => {
    const optionNames = new Set([
      ...path
        .slice(0, -1)
        .flatMap((command) =>
          command.options
            ? command.options
                .filter((option) => option.isPersistent)
                .flatMap((option) => option.name)
            : []
        ),
      ...options.flatMap((option) => option.name),
    ]);
    for (const [index, option] of makeArray(options).entries()) {
      for (const name of makeArray(option.dependsOn)) {
        // deno-fmt-ignore
        assert(
          optionNames.has(name),
          `The option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) depends on an option named ${repr(
            name
          )}, which doesn't exist in its scope`
        );
      }
      for (const name of makeArray(option.exclusiveOn)) {
        // deno-fmt-ignore
        assert(
          optionNames.has(name),
          `The option ${namedArrayToString(
            ...path,
            option
          )} (index ${index}) is exclusive on an option named ${repr(
            name
          )}, which doesn't exist in its scope`
        );
      }
    }
  });
}

/**
 * Asserts that commands that will match subcommands by prefix do not take arguments
 */
export function assertPrefixMatchCommandsHaveNoArguments(spec: Command): void {
  forEachCommand(spec, (command, path) => {
    // Skip if the final parser directive in the chain is false
    // TODO: this could probably be a utility function, `isParserDirectiveOn`
    const skip =
      path
        .map((cmd) => cmd.parserDirectives?.subcommandsMatchUniquePrefix)
        .filter((value) => value !== undefined)
        .at(-1) === false;

    if (skip) return;

    assert(
      !(command.subcommands && command.args),
      `The command ${namedArrayToString(
        ...path
      )} has at least one argument and command, but matches subcommands based on unique prefixes. To fix this, use \`parserDirectives: { subcommandsMatchUniquePrefix: false }\``
    );
  });
}

export type TestNamingStyle = "sentence" | "function";

/** Options that can be provided to `test` */
export interface TestOptions {
  /**
   * Allows options to shadow persistent options.
   *
   * This behavior may be desirable if you want to override an option on a
   * particular command, but not for others.
   *
   * Be aware that this is not idiomatic.
   */
  allowShadowingPersistentOptions?: boolean;

  /**
   * Allows subcommands and options to not have a description
   */
  allowNoDescription?: boolean;

  /**
   * Allows descriptions to have lines over 68 characters long
   */
  allowLongDescriptionLines?: boolean;

  /**
   * Allow commands to have `parserDirectives.subcommandsMatchUniquePrefix` with args
   *
   * This is not allowed by default because it's probably a mistake. It makes
   * arguments ambiguous, users may not know if their invocation will run a
   * command or the command.
   */
  allowMatchingCommandPrefixAndArgs?: boolean;

  /**
   * Change the naming style of the tests.
   *
   * - `sentence`: Use proper sentence casing, punctuation, etc
   * - `function`: Use the name of the assert function that will be executed
   */
  namingStyle?: TestNamingStyle;
}

function getName(
  namingStyle: TestNamingStyle,
  names: { [K in TestNamingStyle]: string }
) {
  return names[namingStyle];
}

/**
 * Validate your CLI in your test suite
 *
 * This enforces certain constraints that the type system cannot. The parser
 * may ignore these issues, producing correct output that _appears_ to be
 * wrong.
 */
export function test(
  spec: Command,
  options: TestOptions = {}
): (t: Deno.TestContext) => Promise<void> {
  const {
    allowShadowingPersistentOptions = false,
    allowNoDescription = false,
    allowLongDescriptionLines = false,
    allowMatchingCommandPrefixAndArgs = false,
    namingStyle = "sentence",
  } = options;
  return async (t) => {
    await t.step(
      getName(namingStyle, {
        sentence: "Required arguments don't follow optional arguments",
        function: "assertRequiredArgumentsDoNotFollowOptionalArguments",
      }),
      () => {
        assertRequiredArgumentsDoNotFollowOptionalArguments(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Repeatable options don't have arguments",
        function: "assertRepeatableOptionsHaveNoArguments",
      }),
      () => {
        assertRepeatableOptionsHaveNoArguments(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence:
          "Repeatable options that are numbers are integers greater than 1",
        function: "assertRepeatableOptionsArePositiveIntegers",
      }),
      () => {
        assertRepeatableOptionsArePositiveIntegers(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Long option names don't start with a single dash",
        function: "assertLongOptionNamesDoNotStartWithSingleDash",
      }),
      () => {
        assertLongOptionNamesDoNotStartWithSingleDash(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Option names all start with dashes",
        function: "assertOptionNamesStartWithDashes",
      }),
      () => {
        assertOptionNamesStartWithDashes(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Options have locally unique names",
        function: "assertOptionsHaveLocallyUniqueNames",
      }),
      () => {
        assertOptionsHaveLocallyUniqueNames(spec);
      }
    );
    if (!allowShadowingPersistentOptions) {
      await t.step(
        getName(namingStyle, {
          sentence: "Options don't shadow persistent options",
          function: "assertOptionsDoNotShadowPersistentOptions",
        }),
        () => {
          assertOptionsDoNotShadowPersistentOptions(spec);
        }
      );
    }
    await t.step(
      getName(namingStyle, {
        sentence: "Commands have locally unique names",
        function: "assertCommandsHaveLocallyUniqueNames",
      }),
      () => {
        assertCommandsHaveLocallyUniqueNames(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Nothing is named '--'",
        function: "assertNothingIsNamedDashDash",
      }),
      () => {
        assertNothingIsNamedDashDash(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Option arg separators are not an empty string",
        function: "assertOptionArgSeparatorsHaveCharacters",
      }),
      () => {
        assertOptionArgSeparatorsHaveCharacters(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Options named '-' or '+' take exactly one argument",
        function: "assertPlusMinusOptionsTakeOneArg",
      }),
      () => {
        assertPlusMinusOptionsTakeOneArg(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Names have no extra leading or trailing whitespace",
        function: "assertNamesHaveNoExtraWhitespace",
      }),
      () => {
        assertNamesHaveNoExtraWhitespace(spec);
      }
    );
    if (!allowNoDescription) {
      await t.step(
        getName(namingStyle, {
          sentence: "Everything has a description",
          function: "assertEverythingHasDescription",
        }),
        () => {
          assertEverythingHasDescription(spec);
        }
      );
    }
    if (!allowLongDescriptionLines) {
      await t.step(
        getName(namingStyle, {
          sentence:
            "Each line in descriptions is less than or equal to 68 characters",
          function: "assertDescriptionLineLengthUnder69",
        }),
        () => {
          assertDescriptionLineLengthUnder69(spec);
        }
      );
    }
    await t.step(
      getName(namingStyle, {
        sentence: "Options with `requiresSeparator` take exactly one argument",
        function: "assertRequiresSeparatorTakesOneArg",
      }),
      () => {
        assertRequiresSeparatorTakesOneArg(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "Common options are not defined on every command",
        function: "assertCommonOptionsArePersistent",
      }),
      () => {
        assertCommonOptionsArePersistent(spec);
      }
    );
    await t.step(
      getName(namingStyle, {
        sentence: "References to other options by name are valid",
        function: "assertOptionNameReferencesExist",
      }),
      () => {
        assertOptionNameReferencesExist(spec);
      }
    );
    if (!allowMatchingCommandPrefixAndArgs) {
      await t.step(
        getName(namingStyle, {
          sentence:
            "Commands with `subcommandsMatchUniquePrefix` don't have arguments and subcommands",
          function: "assertPrefixMatchCommandsHaveNoArguments",
        }),
        () => {
          assertPrefixMatchCommandsHaveNoArguments(spec);
        }
      );
    }
  };
}
