import type {
  BaseToken,
  TokenOptionArg,
  TokenUnknownOption,
} from "./analyze.ts";
import type { Command, NonEmptyArray } from "./types.ts";

const repr = JSON.stringify as (str: string) => string;

export interface ErrorContext {
  path: NonEmptyArray<Command>;
}

export class ParseError extends Error {
  readonly context: ErrorContext;
  constructor(
    context: ErrorContext,
    ...args: ConstructorParameters<ErrorConstructor>
  ) {
    super(...args);
    this.context = context;
    this.name = this.constructor.name;
  }
}

export class UnknownOption extends ParseError {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly option: string;
  readonly validOptions: string[];
  constructor(token: TokenUnknownOption, context: ErrorContext) {
    // deno-fmt-ignore
    const msg = `${repr(
      token.literal
    )} looks like a flag, but is unknown in this context`;
    super(context, msg);
    this.option = token.literal;
    this.validOptions = token.validOptions;
    this.index = token.index;
    this.start = token.start;
    this.end = token.end;
  }
}

export class InvalidOptionArg extends ParseError {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly arg: string;
  readonly option: string;
  constructor(token: TokenOptionArg, context: ErrorContext) {
    // deno-fmt-ignore
    const msg = `Option ${token.literal} doesn't take arguments`;
    super(context, msg);
    this.index = token.index;
    this.start = token.start;
    this.end = token.end;
    this.option = token.option;
    this.arg = token.literal;
  }
}

export class TooManyArguments extends ParseError {
  readonly index: number;
  readonly value: string;
  constructor(token: BaseToken, context: ErrorContext) {
    // deno-fmt-ignore
    const msg = `Too many arguments, ${repr(token.literal)} was unexpected`;
    super(context, msg);
    this.index = token.index;
    this.value = token.literal;
  }
}

export class TooFewOptionArguments extends ParseError {
  constructor(min: number, max: number, context: ErrorContext) {
    const msg = min === max
      ? `Option needs ${min} argument${min === 1 ? "" : "s"}`
      : !Number.isFinite(max)
      ? `Option needs at least ${min} argument${min === 1 ? "" : "s"}`
      : `Option needs between ${min} and ${max} arguments`;
    super(context, msg);
  }
}

export class TooFewArguments extends ParseError {
  constructor(min: number, max: number, context: ErrorContext) {
    const msg = min === max
      ? `Expected ${min} argument${min === 1 ? "" : "s"}`
      : !Number.isFinite(max)
      ? `Expected at least ${min} argument${min === 1 ? "" : "s"}`
      : `Expected between ${min} and ${max} arguments`;
    super(context, msg);
  }
}

export class MissingRequiredOption extends ParseError {
  constructor(name: string, context: ErrorContext) {
    const msg = `Option ${name} is required, but wasn't found`;
    super(context, msg);
  }
}
