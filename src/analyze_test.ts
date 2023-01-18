import {
  $arg,
  $argSeparator,
  $command,
  $option,
  $optionArg,
  $unknownOption,
  analyze,
  AnalyzeResult,
  Token,
} from "./analyze.ts";
import { assertEquals } from "./deps/std_testing_asserts.ts";
import type { Command, Flag } from "./types.ts";

const assertEqualsTokens = <Command, Option>(
  a: AnalyzeResult<Command, Option>,
  b: Token<Command, Option>[],
): void => {
  assertEquals(a.tokens, b);
};

Deno.test({
  name: "analyze: empty",
  fn() {
    assertEqualsTokens(analyze([], { name: "test" }), []);
  },
});

Deno.test({
  name: "analyze: args",
  fn() {
    assertEqualsTokens(analyze(["one", "two"], { name: "test" }), [
      $arg(0, 0, 3, "one"),
      $arg(1, 0, 3, "two"),
    ]);
  },
});

Deno.test({
  name: "analyze: arg separator",
  fn() {
    assertEqualsTokens(analyze(["one", "--", "two"], { name: "test" }), [
      $arg(0, 0, 3, "one"),
      $argSeparator(1, 0, 2, "--"),
      $arg(2, 0, 3, "two"),
    ]);
  },
});

Deno.test({
  name: "analyze: known option",
  fn() {
    assertEqualsTokens(
      analyze(["--option"], {
        name: "test",
        options: [{ name: "--option" }],
      }),
      [$option(0, 0, 8, "--option", { name: "--option" })],
    );
  },
});

Deno.test({
  name: "analyze: known option with inline arg",
  fn() {
    const spec: Command = {
      name: "test",
      flags: [{ name: "--option" }],
    };
    assertEqualsTokens(analyze(["--option=abc"], spec), [
      $option(0, 0, 8, "--option", spec.flags![0]),
      $optionArg(0, 9, 12, "abc", "--option", "="),
    ]);
  },
});

Deno.test({
  name: "analyze: unknown option",
  fn() {
    const spec = {
      name: "test",
    };
    assertEqualsTokens(analyze(["--option"], spec), [
      $unknownOption(0, 0, 8, "--option", []),
    ]);
  },
});

Deno.test({
  name: "analyze: unknown option with inline arg",
  fn() {
    const spec = {
      name: "test",
    };
    assertEqualsTokens(analyze(["--option=abc"], spec), [
      $unknownOption(0, 0, 8, "--option", []),
      $optionArg(0, 9, 12, "abc", "--option", "="),
    ]);
  },
});

Deno.test({
  name: "analyze: posix-noncompliant options with unknown option",
  fn() {
    const spec: Command = {
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
    };
    assertEqualsTokens(analyze(["arg", "--option"], spec), [
      $arg(0, 0, 3, "arg"),
      $arg(1, 0, 8, "--option"),
    ]);
  },
});

Deno.test({
  name: "analyze: posix-noncompliant options with known option",
  fn() {
    const spec: Command = {
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
      flags: [{ name: "option" }],
    };
    assertEqualsTokens(analyze(["arg", "option", "option=value"], spec), [
      $arg(0, 0, 3, "arg"),
      $option(1, 0, 6, "option", spec.flags![0]),
      $option(2, 0, 6, "option", spec.flags![0]),
      $optionArg(2, 7, 12, "value", "option", "="),
    ]);
  },
});

Deno.test({
  name: "analyze: option arg separators",
  fn() {
    const spec: Command = {
      name: "test",
      parserDirectives: {
        optionArgSeparators: ["=", ":"],
        flagsArePosixNoncompliant: true,
      },
      flags: [{ name: "option" }],
    };
    assertEqualsTokens(analyze(["arg", "option", "option:value"], spec), [
      $arg(0, 0, 3, "arg"),
      $option(1, 0, 6, "option", spec.flags![0]),
      $option(2, 0, 6, "option", spec.flags![0]),
      $optionArg(2, 7, 12, "value", "option", ":"),
    ]);
  },
});

Deno.test({
  name: "analyze: anonymous options",
  fn() {
    const spec: Command = {
      name: "test",
      flags: [
        { name: "-", args: {} },
        { name: "+", args: {} },
        { name: "-x" },
        { name: "-y" },
      ],
    };
    assertEqualsTokens(analyze(["-123", "+abc", "-xy"], spec), [
      $option(0, 0, 1, "-", spec.flags![0]),
      $optionArg(0, 1, 4, "123", "-", ""),
      $option(1, 0, 1, "+", spec.flags![1]),
      $optionArg(1, 1, 4, "abc", "+", ""),
      $option(2, 1, 2, "-x", spec.flags![2]),
      $option(2, 2, 3, "-y", spec.flags![3]),
    ]);
  },
});

Deno.test({
  name: "analyze: chained options",
  fn() {
    const spec: Command = {
      name: "test",
      flags: [
        { name: "-x" },
        { name: "-y" },
        { name: "-z" },
        { name: "+x" },
        { name: "+y" },
        { name: "+z" },
      ],
    };
    assertEqualsTokens(analyze(["-xyz", "+xyz"], spec), [
      $option(0, 1, 2, "-x", spec.flags![0]),
      $option(0, 2, 3, "-y", spec.flags![1]),
      $option(0, 3, 4, "-z", spec.flags![2]),
      $option(1, 1, 2, "+x", spec.flags![3]),
      $option(1, 2, 3, "+y", spec.flags![4]),
      $option(1, 3, 4, "+z", spec.flags![5]),
    ]);
  },
});

Deno.test({
  name: "analyze: command",
  fn() {
    const spec: Command = {
      name: "test",
      subcommands: [
        {
          name: "cmd",
          flags: [
            {
              name: "--option",
            },
          ],
        },
      ],
    } as const;
    assertEqualsTokens(analyze(["cmd", "--option"], spec), [
      $command<Command, Flag>(0, 0, 3, "cmd", spec.subcommands![0]),
      $option(1, 0, 8, "--option", spec.subcommands![0].flags![0]),
    ]);
  },
});

Deno.test({
  name: "analyze: persistent options",
  fn() {
    const spec: Command = {
      name: "test",
      flags: [
        {
          name: "--option",
          isPersistent: true,
        },
      ],
      subcommands: [
        {
          name: "cmd",
        },
      ],
    } as const;
    assertEqualsTokens(analyze(["cmd", "--option"], spec), [
      $command<Command, Flag>(0, 0, 3, "cmd", spec.subcommands![0]),
      $option(1, 0, 8, "--option", spec.flags![0]),
    ]);
  },
});

Deno.test({
  name: "analyze: option with args",
  fn() {
    const spec: Command = {
      name: "test",
      flags: [
        {
          name: "--option",
          isPersistent: true,
        },
      ],
      subcommands: [
        {
          name: "cmd",
        },
      ],
    };
    assertEqualsTokens(analyze(["cmd", "--option"], spec), [
      $command<Command, Flag>(0, 0, 3, "cmd", spec.subcommands![0]),
      $option(1, 0, 8, "--option", spec.flags![0]),
    ]);
  },
});

Deno.test({
  name: "analyze: optionsMustPrecedeArgs",
  fn() {
    const spec: Command = {
      name: "test",
      parserDirectives: {
        optionsMustPrecedeArguments: true,
      },
      flags: [
        {
          name: "--option",
          isPersistent: true,
        },
      ],
      subcommands: [
        {
          name: "cmd",
        },
      ],
    };
    assertEqualsTokens(analyze(["cmd", "--option", "arg", "--option"], spec), [
      $command<Command, Flag>(0, 0, 3, "cmd", spec.subcommands![0]),
      $option(1, 0, 8, "--option", spec.flags![0]),
      $arg(2, 0, 3, "arg"),
      $arg(3, 0, 8, "--option"),
    ]);
  },
});

Deno.test({
  name: "analyze: subcommandsMatchUniquePrefix",
  fn() {
    const spec: Command = {
      name: "test",
      parserDirectives: {
        subcommandsMatchUniquePrefix: true,
      },
      subcommands: [
        { name: ["long-name", "name"] },
        { name: "long-time" },
        { name: ["abc-def", "abc-xyz"] },
        { name: "abc" },
      ],
    };
    // matches one exactly
    assertEqualsTokens(analyze(["long-name"], spec), [
      $command<Command, Flag>(0, 0, 9, "long-name", spec.subcommands![0]),
    ]);
    // Matches one exactly, even when it is the prefix of another command
    assertEqualsTokens(analyze(["abc"], spec), [
      $command<Command, Flag>(0, 0, 3, "abc", spec.subcommands![3]),
    ]);
    // Match a command when it has two names that share the same prefix
    assertEqualsTokens(analyze(["abc-"], spec), [
      $command<Command, Flag>(0, 0, 4, "abc-", spec.subcommands![2]),
    ]);
    // should match both, so no unique command, fails command check.
    // on commands with requiresSubcommand, this will still fail at runtime
    assertEqualsTokens(analyze(["long-"], spec), [$arg(0, 0, 5, "long-")]);
    // should match only one
    assertEqualsTokens(analyze(["long-n"], spec), [
      $command<Command, Flag>(0, 0, 6, "long-n", spec.subcommands![0]),
    ]);
    // should match only one
    assertEqualsTokens(analyze(["n"], spec), [
      $command<Command, Flag>(0, 0, 1, "n", spec.subcommands![0]),
    ]);
  },
});
