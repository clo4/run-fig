import type { Action, Command, Flag, NonEmptyArray } from "./types.ts";
import { analyze, BaseToken, TokenCommand, TokenOption } from "./analyze.ts";
import { isArray, makeArray, setEach } from "./collections.ts";
import {
  ErrorContext,
  InvalidOptionArg,
  MissingRequiredOption,
  ParseError,
  TooFewArguments,
  TooFewOptionArguments,
  TooManyArguments,
  UnknownOption,
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
  options: Map<string, string[]>;
  path: NonEmptyArray<Command>;
  actions: Action[];
  optionActions: Action[];
}

const enum State {
  ParseArgs,
  ParseOptionArgs,
  ParseOptionArgRequireSeparator,
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
  const optionActions: Action[] = [];

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
  const foundOptions: Map<string, string[]> = new Map();

  // These have to be type assertions otherwise TS will incorrectly
  // infer that the variables are never reassigned
  let state = State.ParseArgs as State;
  let optionArgs = null as string[] | null;
  let optionArgsMin = 0;
  let optionArgsMax = 0;
  let requiredSeparator = false as string | boolean;
  let argSeparatorIndex = -1;

  // Each item in this set must be provided
  const dependsOnOptions = [] as Flag[];
  // Each item in this set cannot be provided
  const exclusiveOnOptions = [] as Flag[];

  const parseOption = (token: TokenOption<Flag>) => {
    const option = token.option;

    // Don't allow repeating non-repeatable options
    if (!option.isRepeatable && has(foundOptions, option.name)) {
      throw new ParseError(ctx(), "Repeated option");
    }

    if (option.exclusiveOn) {
      exclusiveOnOptions.push(option);
    }

    if (option.dependsOn) {
      dependsOnOptions.push(option);
    }

    if (option.action) {
      optionActions.push(option.action);
    }

    // Repeatable options are treated differently so we
    // *have* to branch on this.
    if (option.isRepeatable) {
      const maxRepeat = option.isRepeatable === true
        ? Infinity
        : option.isRepeatable;
      let arr = get(foundOptions, option.name);
      if (!arr) {
        arr = [];
        setEach(foundOptions, option.name, arr);
      }
      if (arr.length >= maxRepeat) {
        throw new ParseError(ctx(), "Too many repetitions");
      }
      arr.push("");
      return;
    }

    const args = makeArray(option.args);
    optionArgsMin = getMinArgs(args);
    optionArgsMax = getMaxArgs(args);

    optionArgs = [];
    setEach(foundOptions, option.name, optionArgs);

    if (optionArgsMax === 0) {
      optionArgs = null;
      state = State.ParseArgs;
      return;
    }

    if (option.requiresSeparator) {
      state = State.ParseOptionArgRequireSeparator;
      requiredSeparator = option.requiresSeparator;
    } else {
      state = State.ParseOptionArgs;
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
        "Unexpected argument '--', did you mean to use an option instead?",
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
          case "option": {
            parseOption(token);
            break;
          }
          case "unknown-option": {
            throw new UnknownOption(token, ctx());
          }
          case "option-arg": {
            throw new InvalidOptionArg(token, ctx());
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
      case State.ParseOptionArgs: {
        assert(
          Array.isArray(optionArgs),
          "Invalid state, must have an array to store option arguments",
        );
        switch (token.kind) {
          case "option-arg":
          case "arg": {
            if (optionArgs.length < optionArgsMax) {
              optionArgs.push(token.literal);
            } else {
              optionArgs = null;
              state = State.ParseArgs;
              parseArg(token);
            }
            break;
          }
          case "option": {
            if (optionArgs.length < optionArgsMin) {
              throw new TooFewOptionArguments(
                optionArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            parseOption(token);
            break;
          }
          case "unknown-option": {
            if (optionArgs.length < optionArgsMax) {
              optionArgs.push(token.literal);
            } else {
              throw new UnknownOption(token, ctx());
            }
            break;
          }
          case "arg-separator": {
            if (optionArgs.length < optionArgsMin) {
              throw new TooFewOptionArguments(
                optionArgsMin,
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
      case State.ParseOptionArgRequireSeparator: {
        assert(
          Array.isArray(optionArgs),
          "Invalid state, must have an array to store option arguments",
        );
        assert(requiredSeparator, "Invalid state, a separator must be set");
        switch (token.kind) {
          case "option-arg": {
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
            optionArgs.push(token.literal);
            state = State.ParseArgs;
            break;
          }
          case "arg": {
            if (optionArgsMin > 0) {
              throw new TooFewOptionArguments(
                optionArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            optionArgs = null;
            state = State.ParseArgs;
            parseArg(token);
            break;
          }
          case "option": {
            if (optionArgsMin > 0) {
              throw new TooFewOptionArguments(
                optionArgsMin,
                optionArgsMax,
                ctx(),
              );
            }
            parseOption(token);
            break;
          }
          case "unknown-option": {
            throw new UnknownOption(token, ctx());
          }
          case "arg-separator": {
            throw new ParseError(ctx(), "Unexpected token");
          }
          case "command": {
            if (optionArgsMin > 0) {
              throw new TooFewOptionArguments(
                optionArgsMin,
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

  if (optionActions.length === 0 && foundArgs.length < commandArgsMin) {
    throw new TooFewArguments(commandArgsMin, commandArgsMax, ctx());
  }
  if (optionArgs && optionArgs.length < optionArgsMin) {
    throw new TooFewOptionArguments(optionArgsMin, optionArgsMax, ctx());
  }

  // Options in the `{depends,exclusive}OnOptions` arrays definitely have the
  // corresponding array, so it's safe to assert non-null in this situation.
  for (const option of dependsOnOptions) {
    for (const name of option.dependsOn!) {
      if (!foundOptions.has(name)) {
        throw new ParseError(
          ctx(),
          `${option.name} requires ${name}, add it to fix this error`,
        );
      }
    }
  }
  for (const option of exclusiveOnOptions) {
    for (const name of option.exclusiveOn!) {
      if (foundOptions.has(name)) {
        throw new ParseError(
          ctx(),
          `${option.name} can't be used together with ${name}`,
        );
      }
    }
  }
  for (const name of finalState.localRequiredOptions.keys()) {
    if (!foundOptions.has(name)) {
      throw new MissingRequiredOption(name, ctx());
    }
  }
  for (const name of finalState.persistentRequiredOptions.keys()) {
    if (!foundOptions.has(name)) {
      throw new MissingRequiredOption(name, ctx());
    }
  }

  return {
    path,
    actions,
    optionActions,
    argSeparatorIndex,
    args: foundArgs,
    options: foundOptions,
  };
}
