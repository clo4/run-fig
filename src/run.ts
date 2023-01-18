import type { ActionInit, Spec } from "./types.ts";
import { parse, ParseResult } from "./parse.ts";
import { getHelp } from "./help.ts";
import { ParseError, UnknownOption } from "./errors.ts";

export function printError(...strings: unknown[]): void {
  console.error("%cError:", "color: red", ...strings);
}

/**
 * Parses the input and executes the relevant action
 *
 * You might be looking for `run`, which will also exit the runtime.
 *
 * This function returns a number, which represents the expected
 * exit code of the program. You can combine this with `Deno.exit`.
 *
 * - If the subcommand doesn't have any action associated with it,
 *   it returns 1.
 * - If the action returns a number above 255, the value is 255.
 * - If the action returns a number below zero, the value is 0.
 *
 * The action that gets run is the final subcommand action. If an
 * option with an action was used, the final option action will be
 * executed instead.
 *
 * The intended use of this function is to serve as a reference for
 * creating your own `run`, and to provide plumbing for more complex
 * systems. The name is intentionally long to dissuade you from using
 * it instead of `run` by accident.
 *
 * ## Example
 * ```typescript
 * const spec: CLI.Spec = { name: "example" };
 * const code = await CLI.execute(spec, Deno.args);
 * console.log("Finished");
 * Deno.exit(code);
 * ```
 */
export async function execute(
  spec: Spec,
  args: readonly string[],
): Promise<number> {
  let result: ParseResult;
  try {
    result = parse(args, spec);
  } catch (error: unknown) {
    if (error instanceof UnknownOption) {
      const helpMessage = getHelp(error.context.path, {
        description: false,
        didYouMean: {
          input: error.option,
          choices: error.validOptions,
        },
      });
      printError(`${error.message}\n\n${helpMessage}`);
    } else if (error instanceof ParseError) {
      printError(
        `${error.message}\n\n${
          getHelp(error.context.path, {
            description: false,
          })
        }`,
      );
    } else {
      printError(`${error}`);
    }
    return 1;
  }

  const action = result.optionActions.at(-1) ?? result.actions.at(-1);

  if (!action) {
    return 1;
  }

  const options = result.options;
  const actionInit: ActionInit = {
    error: printError,
    help: (options) => getHelp(options?.path || result.path, options),
    args: result.args,
    path: result.path,
    argSeparatorIndex: result.argSeparatorIndex,
    options: {
      options,
      has: (name) => options.has(name),
      get: (name) => {
        const found = options.get(name);
        if (found === undefined) {
          return [false];
        }
        return [true, ...found];
      },
      count: (name) => options.get(name)?.length ?? 0,
    },
  };

  let exitCode;

  try {
    // An action can only return undefined, a number, or a promise.
    // Promises are the only valid return type where typeof === "object".
    // This means it's trivial to skip an await by checking this.
    const actionResult = action(actionInit);
    if (typeof actionResult === "object") {
      exitCode = (await actionResult) ?? 0;
    } else {
      exitCode = actionResult ?? 0;
    }
  } catch (error) {
    if (error instanceof Error) {
      printError(error.message);
    } else {
      throw error;
    }
    return 1;
  }

  return Math.min(Math.max(exitCode, 0), 255);
}

/**
 * Runs the CLI
 *
 * ## Example
 * ```ts
 * const spec: CLI.Spec = { name: "example" };
 * CLI.run(spec);
 * ```
 *
 * ## Example using a custom argument array
 * ```ts
 * const spec: CLI.Spec = { name: "example", args: {} };
 * CLI.run(spec, { args: ["first argument"] });
 * ```
 */
export async function run(
  spec: Spec,
  options: { args?: readonly string[] } = {},
): Promise<never> {
  const { args = Deno.args } = options;
  const code = await execute(spec, args);
  exit(code);
}

function exit(status: number): never {
  // deno-lint-ignore no-explicit-any
  const gt = globalThis as any;
  if (typeof gt.process === "object") {
    gt.process.exit(status);
  }
  if (typeof gt.Deno === "object") {
    gt.Deno.exit(status);
  }
  throw new Error("Cannot exit");
}
