import { makeArray, setEach } from "./collections.ts";

interface MinOption {
  name: string | readonly string[];
  args?: unknown;
  isPersistent?: boolean;
  isRequired?: boolean;
}

interface MinSubcommand<Option extends MinOption> {
  name: string | readonly string[];
  args?: unknown;
  options?: readonly Option[];
  subcommands?: readonly this[];
  parserDirectives?: {
    optionArgSeparators?: string | readonly string[];
    flagsArePosixNoncompliant?: boolean;
    optionsMustPrecedeArguments?: boolean;
    subcommandsMatchUniquePrefix?: boolean;
  };
}

export type BaseToken = {
  /** The index in the input that that contains this token */
  index: number;
  /** Inclusive start index */
  start: number;
  /** Non-inclusive (exclusive) end index */
  end: number;
  /** The literal text value */
  literal: string;
};

/** Something that looks like an option but isn't one */
export type TokenUnknownOption = BaseToken & {
  kind: "unknown-option";
  validOptions: string[];
};

/** A value that belongs to either an option or the current command */
export type TokenArg = BaseToken & {
  kind: "arg";
};

/** A token that denotes that all following tokens are arguments */
export type TokenArgSeparator = BaseToken & {
  kind: "arg-separator";
};

/** Some text that is guaranteed to belong to the preceding option (eg. -I%, --config=file.json) */
export type TokenOptionArg = BaseToken & {
  kind: "option-arg";
  option: string;
  separator: string;
};

/** A subcommand, and all the relevant information */
export type TokenSubcommand<Subcommand> = BaseToken & {
  kind: "subcommand";
  subcommand: Subcommand;
};

/** An option */
export type TokenOption<Option> = BaseToken & {
  kind: "option";
  option: Option;
};

/** Any kind of token */
export type Token<Subcommand, Option> =
  | TokenArg
  | TokenArgSeparator
  | TokenSubcommand<Subcommand>
  | TokenOption<Option>
  | TokenUnknownOption
  | TokenOptionArg;

export const $optionArg = (
  index: number,
  start: number,
  end: number,
  literal: string,
  option: string,
  separator: string,
): TokenOptionArg => ({
  kind: "option-arg",
  index,
  literal,
  start,
  end,
  option,
  separator,
});

export const $unknownOption = (
  index: number,
  start: number,
  end: number,
  literal: string,
  validOptions: string[],
): TokenUnknownOption => ({
  kind: "unknown-option",
  index,
  start,
  end,
  literal,
  validOptions,
});

export const $arg = (
  index: number,
  start: number,
  end: number,
  literal: string,
): TokenArg => ({
  kind: "arg",
  index,
  start,
  end,
  literal,
});

export const $argSeparator = (
  index: number,
  start: number,
  end: number,
  literal: string,
): TokenArgSeparator => ({
  kind: "arg-separator",
  index,
  start,
  end,
  literal,
});

export const $subcommand = <
  Subcommand extends MinSubcommand<Option>,
  Option extends MinOption,
>(
  index: number,
  start: number,
  end: number,
  literal: string,
  subcommand: Subcommand,
): TokenSubcommand<Subcommand> => {
  return {
    kind: "subcommand",
    index,
    start,
    end,
    literal,
    subcommand,
  };
};

export const $option = <Option extends MinOption>(
  index: number,
  start: number,
  end: number,
  literal: string,
  option: Option,
): TokenOption<Option> => {
  return {
    kind: "option",
    index,
    start,
    end,
    literal,
    option,
  };
};

export interface AnalyzeResult<Subcommand, Option> {
  /** The state after the final token has been processed */
  finalState: {
    localOptions: Map<string, Option>;
    persistentOptions: Map<string, Option>;
    localRequiredOptions: Map<string, Option>;
    persistentRequiredOptions: Map<string, Option>;
  };

  /** The list of tokens and their data */
  tokens: Token<Subcommand, Option>[];
}

/**
 * Lex the input, output some tokens
 *
 * This generator uses the options and subcommands to categorize the
 * input tokens. It will not track or reject arguments - tokens that
 * don't match an option or subcommand are yielded as arguments.
 */
export function analyze<
  Subcommand extends MinSubcommand<Option>,
  Option extends MinOption,
>(
  input: readonly string[],
  spec: Subcommand,
): AnalyzeResult<Subcommand, Option> {
  const tokens = [] as Token<Subcommand, Option>[];

  if (input.length === 0) {
    const localOptions = new Map();
    const localRequiredOptions = new Map();
    const persistentOptions = new Map();
    const persistentRequiredOptions = new Map();
    if (spec.options) {
      for (const option of spec.options) {
        if (option.isPersistent) {
          setEach(persistentOptions, option.name, option);
          if (option.isRequired) {
            setEach(persistentRequiredOptions, option.name, option);
          }
        } else {
          setEach(localOptions, option.name, option);
          if (option.isRequired) {
            setEach(localRequiredOptions, option.name, option);
          }
        }
      }
    }
    return {
      finalState: {
        localOptions,
        persistentOptions,
        localRequiredOptions,
        persistentRequiredOptions,
      },
      tokens,
    };
  }

  // This is initialized by the call to `updateCurrentCommand`
  let localSubcommands: readonly Subcommand[] | undefined;

  // TODO: Check if this would be faster as an array for a Deno-sized spec
  const localOptions: Map<string, Option> = new Map();
  const persistentOptions: Map<string, Option> = new Map();
  const localRequiredOptions: Map<string, Option> = new Map();
  const persistentRequiredOptions: Map<string, Option> = new Map();
  let separators = ["="];
  let hasFoundArg = false;
  let posixCompliantOptions = true;
  let subcommandsMatchUniquePrefix = false;
  let optionsMustPrecedeArguments = false;
  let hasUsedNonPersistentOption = false;

  const getOption = (name: string) =>
    localOptions.get(name) ?? persistentOptions.get(name) ?? null;

  const hasOption = (name: string) =>
    localOptions.has(name) || persistentOptions.has(name);

  const getSubcommand = (name: string) => {
    if (!localSubcommands) {
      return null;
    }

    if (!subcommandsMatchUniquePrefix) {
      // Only find exact matches.
      return (
        localSubcommands.find((command) =>
          typeof command.name === "string"
            ? command.name === name
            : command.name.includes(name)
        ) ?? null
      );
    } else {
      // Prefer exact matches, but also find commands with a matching prefix.
      const matchingPrefixCommands = [];

      // Have to iterate over every command because a literal match should
      // always take precedence over a partial/prefix match.
      commands:
      for (const command of localSubcommands) {
        if (typeof command.name === "string") {
          // Exact matches can short-circuit and return immediately
          if (command.name === name) {
            return command;
          }
          if (command.name.startsWith(name)) {
            matchingPrefixCommands.push(command);
          }
        } else {
          // This is the exact same logic as above, but for each name
          for (const cmdName of command.name) {
            if (cmdName === name) {
              return command;
            }
            if (cmdName.startsWith(name)) {
              matchingPrefixCommands.push(command);
              // If there's a match for one of the names, there's no need to
              // check the other names. Checking more can result in adding the
              // same command to the matches again, which would be an error.
              continue commands;
            }
          }
        }
      }

      // If there are no matches, or more than one match, then the prefix
      // wasn't unique, so there's no unambiguous subcommand to return.
      if (matchingPrefixCommands.length !== 1) {
        return null;
      }

      return matchingPrefixCommands[0];
    }
  };

  // Update state to a new subcommand (without clearing maps).
  // Returns the new "internal state" which is a byproduct of processing
  // the subcommand.
  const updateCurrentCommand = (command: Subcommand) => {
    if (command.options) {
      for (const option of command.options) {
        if (option.isPersistent) {
          setEach(persistentOptions, option.name, option);
          if (option.isRequired) {
            setEach(persistentRequiredOptions, option.name, option);
          }
        } else {
          setEach(localOptions, option.name, option);
          if (option.isRequired) {
            setEach(localRequiredOptions, option.name, option);
          }
        }
      }
    }

    localSubcommands = command.subcommands;

    const directives = command.parserDirectives;

    if (directives?.optionArgSeparators) {
      separators = makeArray(directives.optionArgSeparators);
    }

    if (directives?.subcommandsMatchUniquePrefix) {
      subcommandsMatchUniquePrefix = directives.subcommandsMatchUniquePrefix;
    }

    if (directives?.optionsMustPrecedeArguments) {
      optionsMustPrecedeArguments = directives.optionsMustPrecedeArguments;
    }

    if (typeof directives?.flagsArePosixNoncompliant === "boolean") {
      posixCompliantOptions = !directives.flagsArePosixNoncompliant;
    }
  };

  // The maps are already empty, no reason to clear them.
  updateCurrentCommand(spec);

  tokens:
  for (let index = 0; index < input.length; index++) {
    const token = input[index];

    // "--" as a token disables option & subcommand parsing, so this needs
    // to be checked first.
    if (token === "--") {
      tokens.push($argSeparator(index, 0, token.length, token));
      index += 1;
      for (; index < input.length; index++) {
        const tok = input[index];
        tokens.push($arg(index, 0, tok.length, tok));
      }
      break tokens;
    }

    // 1. Try to parse as a subcommand
    // A common case is for the first argument to be a subcommand,
    // so we can exit early instead of building the whole map if the
    // argument is a subcommand.
    if (!hasFoundArg && !hasUsedNonPersistentOption && localSubcommands) {
      const command = getSubcommand(token);
      if (command) {
        localOptions.clear();
        updateCurrentCommand(command);
        tokens.push($subcommand(index, 0, token.length, token, command));
        continue tokens;
      }
    }

    // 2. Try to parse as an option
    if (!(optionsMustPrecedeArguments && hasFoundArg)) {
      if (
        posixCompliantOptions &&
        token.length > 1 &&
        (token.startsWith("-") || token.startsWith("+")) &&
        !token.startsWith("--")
      ) {
        const leadingChar = token[0];

        // 2.a. Parse as a single dash or plus with an arg
        // Try dash and plus options first if:
        // - the options exist
        // - the options take args
        // - the first non-leading character isn't an option
        const dashOption = getOption(leadingChar);
        if (dashOption?.args && !hasOption(token.slice(0, 2))) {
          tokens.push($option(index, 0, 1, leadingChar, dashOption));
          tokens.push(
            $optionArg(index, 1, token.length, token.slice(1), leadingChar, ""),
          );
          continue tokens;
        }

        // 2.b. Parse as a chainable short option
        // If we fell through, the option wasn't `-` or `+`
        chars:
        for (let char = 1; char < token.length; char++) {
          const optionName = `${leadingChar}${token[char]}`;
          const option = getOption(optionName);
          if (!option) {
            tokens.push(
              $unknownOption(index, char, char + 1, optionName, [
                ...localOptions.keys(),
                ...persistentOptions.keys(),
              ]),
            );
            continue chars;
          }

          if (!hasUsedNonPersistentOption && !option.isPersistent) {
            hasUsedNonPersistentOption = true;
          }

          tokens.push($option(index, char, char + 1, optionName, option));

          if (option.args && char < token.length - 1) {
            const remainingChars = token.slice(char + 1);
            const sep = separators.find((sep) =>
              remainingChars.startsWith(sep)
            ) || "";
            const argStartOffset = char + sep.length;
            tokens.push(
              $optionArg(
                index,
                argStartOffset + 1,
                token.length,
                token.slice(argStartOffset + 1),
                optionName,
                sep,
              ),
            );
            break;
          }
        }
        continue tokens;
      }

      if (
        !posixCompliantOptions ||
        (token.length > 2 && token.startsWith("--"))
      ) {
        // 2.c. Parse as a long option or posix-noncompliant option

        // POSIX-noncompliant option means that there's nothing "option-like".
        // Any token can be an option if it matches an option name, and if it's
        // not an option then it's just a regular argument.

        let foundSep = null;
        let foundSepIndex = -1;

        separators:
        for (const sep of separators) {
          const index = token.indexOf(sep);
          if (index === -1) {
            continue separators;
          }
          foundSep = sep;
          foundSepIndex = index;
        }

        if (foundSep) {
          const optionName = token.slice(0, foundSepIndex);
          const option = getOption(optionName);
          if (option) {
            if (!hasUsedNonPersistentOption && !option.isPersistent) {
              hasUsedNonPersistentOption = true;
            }
            tokens.push(
              $option(
                index,
                0,
                foundSepIndex,
                token.slice(0, foundSepIndex),
                option,
              ),
            );
            tokens.push(
              $optionArg(
                index,
                foundSepIndex + foundSep.length,
                token.length,
                token.slice(foundSepIndex + foundSep.length),
                optionName,
                foundSep,
              ),
            );
            continue tokens;
          } else if (posixCompliantOptions) {
            // If we're here, we know the option is invalid and we're parsing a
            // posix-compliant option, so that's an "unknown option" instead of arg.
            const optionName = token.slice(0, foundSepIndex);
            tokens.push(
              $unknownOption(index, 0, foundSepIndex, optionName, [
                ...localOptions.keys(),
                ...persistentOptions.keys(),
              ]),
            );
            tokens.push(
              $optionArg(
                index,
                foundSepIndex + foundSep.length,
                token.length,
                token.slice(foundSepIndex + foundSep.length),
                optionName,
                foundSep,
              ),
            );
            continue tokens;
          }
          // Posix noncompliant options should fall through
        } else {
          const option = getOption(token);
          if (option) {
            if (!hasUsedNonPersistentOption && !option.isPersistent) {
              hasUsedNonPersistentOption = true;
            }
            tokens.push($option(index, 0, token.length, token, option));
            continue tokens;
          } else if (posixCompliantOptions) {
            // If we're here, we know the option is invalid and we're parsing a
            // posix-compliant option, so that's an "unknown option" instead of arg.
            tokens.push(
              $unknownOption(index, 0, token.length, token, [
                ...localOptions.keys(),
                ...persistentOptions.keys(),
              ]),
            );
            continue tokens;
          }
        }
      }
    }

    if (!hasFoundArg) {
      hasFoundArg = true;
    }
    tokens.push($arg(index, 0, token.length, token));
  }

  return {
    finalState: {
      localOptions,
      persistentOptions,
      localRequiredOptions,
      persistentRequiredOptions,
    },
    tokens,
  };
}
