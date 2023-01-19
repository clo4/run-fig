import type { Action, Command, Flag, NonEmptyArray } from "./types.ts";
import { analyze, BaseToken, TokenCommand, TokenFlag } from "./analyze.ts";
import { isArray, makeArray, setEach } from "./collections.ts";
import {
  ErrorContext,
  InvalidFlagArg,
  MissingRequiredFlag,
  ParseError,
  TooFewArguments,
  TooFewFlagArguments,
  TooManyArguments,
  UnknownFlag,
} from "./errors.ts";
import { usage as builtinUsageAction } from "./help.ts";

export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new Error(msg);
  }
}

export interface ParseResult {
  args: string[];
  argSeparatorIndex: number;
  flags: Map<string, string[]>;
  path: NonEmptyArray<Command>;
  actions: Action[];
  flagActions: Action[];
}

const enum State {
  ParseArgs,
  ParseFlagArgs,
  ParseFlagArgRequireSeparator,
}

/** Get the minimum number of values that can satisfy the args array */
export function getMinArgs(args: readonly { isOptional?: boolean }[]): number {
  let count = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i].isOptional) {
      break;
    }
    count++;
  }
  return count;
}

/** Get the maximum number of values that can satisfy the args array */
export function getMaxArgs(args: readonly { isVariadic?: boolean }[]): number {
  // Loop over the array backwards because variadic arguments are
  // more likely to be at the end of the array. They don't _need_
  // to be, but it's more idiomatic.
  for (let i = 0; i < args.length; i++) {
    if (args[args.length - 1 - i].isVariadic) {
      return Infinity;
    }
  }
  // None of the arguments are variadic, max is the number of args
  return args.length;
}

/** Check if a map has a key or any key from an array */
function has<K>(map: Map<K, unknown>, key: K | NonEmptyArray<K>): boolean {
  if (isArray(key)) {
    return map.has(key[0]);
  }
  return map.has(key);
}

/** Get a value from a map by a key or any key from an array */
function get<K, V>(map: Map<K, V>, key: K | NonEmptyArray<K>): V | undefined {
  if (isArray(key)) {
    return map.get(key[0]);
  }
  return map.get(key);
}

// TODO: Replace all instances of ParseError with a bespoke error type

/**
 * Parse the input tokens using the given CLI spec.
 *
 * This returns a `ParseResult`, which contains the array of
 * subcommands used, the provided options, and the arguments.
 *
 * If parsing fails, this function throws.
 *
 * This function is exposed to make it easier to build a custom runner.
 */
export function parse(input: readonly string[], spec: Command): ParseResult {
  const path: [Command, ...Command[]] = [spec];
  const actions: Action[] = [];
  const flagActions: Action[] = [];

  if (spec.action) {
    actions.push(spec.action);
  } else if (spec.requiresSubcommand) {
    actions.push(builtinUsageAction);
  }

  let commandArgsMin: number;
  let commandArgsMax: number;

  {
    const args = makeArray(spec.args);
    commandArgsMin = getMinArgs(args);
    commandArgsMax = getMaxArgs(args);
  }

  const foundArgs: string[] = [];
  const foundFlags: Map<string, string[]> = new Map();

  // These have to be type assertions otherwise TS will incorrectly
  // infer that the variables are never reassigned
  let state = State.ParseArgs as State;
  let flagArgs = null as string[] | null;
  let flagArgsMin = 0;
  let optionArgsMax = 0;
  let requiredSeparator = false as string | boolean;
  let argSeparatorIndex = -1;

  // Each item in this set must be provided
  const dependsOnFlags = [] as Flag[];
  // Each item in this set cannot be provided
  const exclusiveOnFlags = [] as Flag[];

  const parseFlag = (token: TokenFlag<Flag>) => {
    const option = token.option;

    // Don't allow repeating non-repeatable options
    if (!option.isRepeatable && has(foundFlags, option.name)) {
      throw new ParseError(ctx(), "Repeated option");
    }

    if (option.exclusiveOn) {
      exclusiveOnFlags.push(option);
    }

    if (option.dependsOn) {
      dependsOnFlags.push(option);
    }

    if (option.action) {
      flagActions.push(option.action);
    }

    // Repeatable options are treated differently so we *have* to branch on this.
    if (option.isRepeatable) {
      const maxRepeat = option.isRepeatable === true
        ? Infinity
        : option.isRepeatable;
      let arr = get(foundFlags, option.name);
      if (!arr) {
        arr = [];
        setEach(foundFlags, option.name, arr);
      }
      if (arr.length >= maxRepeat) {
        throw new ParseError(ctx(), "Too many repetitions");
      }
      arr.push("");
      return;
    }

    const args = makeArray(option.args);
    flagArgsMin = getMinArgs(args);
    optionArgsMax = getMaxArgs(args);

    flagArgs = [];
    setEach(foundFlags, option.name, flagArgs);

    if (optionArgsMax === 0) {
      flagArgs = null;
      state = State.ParseArgs;
      return;
    }

    if (option.requiresSeparator) {
      state = State.ParseFlagArgRequireSeparator;
      requiredSeparator = option.requiresSeparator;
    } else {
      state = State.ParseFlagArgs;
    }
    return;
  };

  const parseArg = (token: BaseToken) => {
    // If the final command requires a command, providing too
    // many arguments is allowed because the user has made a typo
    // (they were intending to use a command)
    if (
      !path[path.length - 1].requiresSubcommand &&
      foundArgs.length >= commandArgsMax
    ) {
      throw new TooManyArguments(token, ctx());
    }
    foundArgs.push(token.literal);
  };

  const parseArgSeparator = () => {
    if (foundArgs.length >= commandArgsMax) {
      throw new ParseError(
        ctx(),
        "Unexpected argument '--', did you mean to use a flag instead?",
      );
    }
    argSeparatorIndex = foundArgs.length;
    state = State.ParseArgs;
  };

  const parseCommand = (token: TokenCommand<Command>) => {
    path.push(token.command);
    const args = makeArray(token.command.args);
    commandArgsMin = getMinArgs(args);
    commandArgsMax = getMaxArgs(args);
    if (token.command.action) {
      actions.push(token.command.action);
    } else if (token.command.requiresSubcommand) {
      actions.push(builtinUsageAction);
    }
  };

  const ctx = () => ({ path } as ErrorContext);

  const { finalState, tokens } = analyze<Command, Flag>(input, spec);

  for (const token of tokens) {
    switch (state) {
      case State.ParseArgs: {
        switch (token.kind) {
          case "command": {
            parseCommand(token);
            break;
          }
          case "arg": {
            parseArg(token);
            break;
          }
          case "flag": {
            parseFlag(token);
            break;
          }
          case "unknown-flag": {
            throw new UnknownFlag(token, ctx());
          }
          case "flag-arg": {
            throw new InvalidFlagArg(token, ctx());
          }
          case "arg-separator": {
            parseArgSeparator();
            break;
          }
          default: {
            throw new ParseError(ctx(), "Unreachable");
          }
        }
        break;
      }
      case State.ParseFlagArgs: {
        assert(
          Array.isArray(flagArgs),
          "Invalid state, must have an array to store option arguments",
        );
        switch (token.kind) {
          case "flag-arg":
          case "arg": {
            if (flagArgs.length < optionArgsMax) {
              flagArgs.push(token.literal);
            } else {
              flagArgs = null;
              state = State.ParseArgs;
              parseArg(token);
            }
            break;
          }
          case "flag": {
            if (flagArgs.length < flagArgsMin) {
              throw new TooFewFlagArguments(
                flagArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            parseFlag(token);
            break;
          }
          case "unknown-flag": {
            if (flagArgs.length < optionArgsMax) {
              flagArgs.push(token.literal);
            } else {
              throw new UnknownFlag(token, ctx());
            }
            break;
          }
          case "arg-separator": {
            if (flagArgs.length < flagArgsMin) {
              throw new TooFewFlagArguments(
                flagArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            parseArgSeparator();
            break;
          }
          case "command": {
            throw new ParseError(ctx(), "Unexpected token");
          }
          // The analyzer can't output a command here, and if it does
          // then that's an error anyway
          default: {
            throw new ParseError(ctx(), "Unreachable");
          }
        }
        break;
      }
      case State.ParseFlagArgRequireSeparator: {
        assert(
          Array.isArray(flagArgs),
          "Invalid state, must have an array to store option arguments",
        );
        assert(requiredSeparator, "Invalid state, a separator must be set");
        switch (token.kind) {
          case "flag-arg": {
            if (
              typeof requiredSeparator === "string" &&
              token.separator !== requiredSeparator
            ) {
              throw new ParseError(
                ctx(),
                `Incorrect separator, use '${requiredSeparator}' instead of '${token.separator}'`,
              );
            }
            // If this is true, we know thanks to the test suite that
            // the option takes a minimum of one argument
            flagArgs.push(token.literal);
            state = State.ParseArgs;
            break;
          }
          case "arg": {
            if (flagArgsMin > 0) {
              throw new TooFewFlagArguments(
                flagArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            flagArgs = null;
            state = State.ParseArgs;
            parseArg(token);
            break;
          }
          case "flag": {
            if (flagArgsMin > 0) {
              throw new TooFewFlagArguments(
                flagArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            parseFlag(token);
            break;
          }
          case "unknown-flag": {
            throw new UnknownFlag(token, ctx());
          }
          case "arg-separator": {
            throw new ParseError(ctx(), "Unexpected token");
          }
          case "command": {
            if (flagArgsMin > 0) {
              throw new TooFewFlagArguments(
                flagArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            parseCommand(token);
            state = State.ParseArgs;
            break;
          }
          default: {
            throw new ParseError(ctx(), "Unreachable");
          }
        }
        break;
      }
    }
  }

  if (flagActions.length === 0 && foundArgs.length < commandArgsMin) {
    throw new TooFewArguments(commandArgsMin, commandArgsMax, ctx());
  }
  if (flagArgs && flagArgs.length < flagArgsMin) {
    throw new TooFewFlagArguments(flagArgsMin, optionArgsMax, ctx());
  }

  // Flags in the `{depends,exclusive}OnFlags` arrays definitely have the
  // corresponding array, so it's safe to assert non-null in this situation.
  for (const option of dependsOnFlags) {
    for (const name of option.dependsOn!) {
      if (!foundFlags.has(name)) {
        throw new ParseError(
          ctx(),
          `${option.name} requires ${name}, add it to fix this error`,
        );
      }
    }
  }
  for (const option of exclusiveOnFlags) {
    for (const name of option.exclusiveOn!) {
      if (foundFlags.has(name)) {
        throw new ParseError(
          ctx(),
          `${option.name} can't be used together with ${name}`,
        );
      }
    }
  }
  for (const name of finalState.localRequiredFlags.keys()) {
    if (!foundFlags.has(name)) {
      throw new MissingRequiredFlag(name, ctx());
    }
  }
  for (const name of finalState.persistentRequiredFlags.keys()) {
    if (!foundFlags.has(name)) {
      throw new MissingRequiredFlag(name, ctx());
    }
  }

  return {
    path,
    actions,
    flagActions,
    argSeparatorIndex,
    args: foundArgs,
    flags: foundFlags,
  };
}
