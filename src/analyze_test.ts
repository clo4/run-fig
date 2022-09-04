import {
  $arg,
  $argSeparator,
  $option,
  $optionArg,
  $subcommand,
  $unknownOption,
  analyze,
  AnalyzeResult,
  Token,
} from "./analyze.ts";
import { assertEquals } from "../deps/std_testing_asserts.ts";
import { Option, Spec, Subcommand } from "./types.ts";

const assertEqualsTokens = <Subcommand, Option>(
  a: AnalyzeResult<Subcommand, Option>,
  b: Token<Subcommand, Option>[],
): void => {
  assertEquals(a.tokens, b);
};

Deno.test({
  name: "analyze: empty",
  fn() {
    assertEqualsTokens(
      analyze([], { name: "test" }),
      [],
    );
  },
});

Deno.test({
  name: "analyze: args",
  fn() {
    assertEqualsTokens(
      analyze(["one", "two"], { name: "test" }),
      [
        $arg(0, 0, 3, "one"),
        $arg(1, 0, 3, "two"),
      ],
    );
  },
});

Deno.test({
  name: "analyze: arg separator",
  fn() {
    assertEqualsTokens(
      analyze(["one", "--", "two"], { name: "test" }),
      [
        $arg(0, 0, 3, "one"),
        $argSeparator(1, 0, 2, "--"),
        $arg(2, 0, 3, "two"),
      ],
    );
  },
});

Deno.test({
  name: "analyze: known option",
  fn() {
    assertEqualsTokens(
      analyze(
        ["--option"],
        {
          name: "test",
          options: [{ name: "--option" }],
        },
      ),
      [
        $option(0, 0, 8, "--option", { name: "--option" }),
      ],
    );
  },
});

Deno.test({
  name: "analyze: known option with inline arg",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [{ name: "--option" }],
    };
    assertEqualsTokens(
      analyze(
        ["--option=abc"],
        spec,
      ),
      [
        $option(0, 0, 8, "--option", spec.options![0]),
        $optionArg(0, 9, 12, "abc", "--option", "="),
      ],
    );
  },
});

Deno.test({
  name: "analyze: unknown option",
  fn() {
    const spec = {
      name: "test",
    };
    assertEqualsTokens(
      analyze(
        ["--option"],
        spec,
      ),
      [
        $unknownOption(0, 0, 8, "--option", []),
      ],
    );
  },
});

Deno.test({
  name: "analyze: unknown option with inline arg",
  fn() {
    const spec = {
      name: "test",
    };
    assertEqualsTokens(
      analyze(
        ["--option=abc"],
        spec,
      ),
      [
        $unknownOption(0, 0, 8, "--option", []),
        $optionArg(0, 9, 12, "abc", "--option", "="),
      ],
    );
  },
});

Deno.test({
  name: "analyze: posix-noncompliant options with unknown option",
  fn() {
    const spec: Spec = {
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
    };
    assertEqualsTokens(
      analyze(
        ["arg", "--option"],
        spec,
      ),
      [
        $arg(0, 0, 3, "arg"),
        $arg(1, 0, 8, "--option"),
      ],
    );
  },
});

Deno.test({
  name: "analyze: posix-noncompliant options with known option",
  fn() {
    const spec: Spec = {
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
      options: [{ name: "option" }],
    };
    assertEqualsTokens(
      analyze(
        ["arg", "option", "option=value"],
        spec,
      ),
      [
        $arg(0, 0, 3, "arg"),
        $option(1, 0, 6, "option", spec.options![0]),
        $option(2, 0, 6, "option", spec.options![0]),
        $optionArg(2, 7, 12, "value", "option", "="),
      ],
    );
  },
});

Deno.test({
  name: "analyze: option arg separators",
  fn() {
    const spec: Spec = {
      name: "test",
      parserDirectives: {
        optionArgSeparators: ["=", ":"],
        flagsArePosixNoncompliant: true,
      },
      options: [{ name: "option" }],
    };
    assertEqualsTokens(
      analyze(
        ["arg", "option", "option:value"],
        spec,
      ),
      [
        $arg(0, 0, 3, "arg"),
        $option(1, 0, 6, "option", spec.options![0]),
        $option(2, 0, 6, "option", spec.options![0]),
        $optionArg(2, 7, 12, "value", "option", ":"),
      ],
    );
  },
});

Deno.test({
  name: "analyze: anonymous options",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-", args: {} },
        { name: "+", args: {} },
        { name: "-x" },
        { name: "-y" },
      ],
    };
    assertEqualsTokens(
      analyze(
        ["-123", "+abc", "-xy"],
        spec,
      ),
      [
        $option(0, 0, 1, "-", spec.options![0]),
        $optionArg(0, 1, 4, "123", "-", ""),
        $option(1, 0, 1, "+", spec.options![1]),
        $optionArg(1, 1, 4, "abc", "+", ""),
        $option(2, 1, 2, "-x", spec.options![2]),
        $option(2, 2, 3, "-y", spec.options![3]),
      ],
    );
  },
});

Deno.test({
  name: "analyze: chained options",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-x" },
        { name: "-y" },
        { name: "-z" },
        { name: "+x" },
        { name: "+y" },
        { name: "+z" },
      ],
    };
    assertEqualsTokens(
      analyze(
        ["-xyz", "+xyz"],
        spec,
      ),
      [
        $option(0, 1, 2, "-x", spec.options![0]),
        $option(0, 2, 3, "-y", spec.options![1]),
        $option(0, 3, 4, "-z", spec.options![2]),
        $option(1, 1, 2, "+x", spec.options![3]),
        $option(1, 2, 3, "+y", spec.options![4]),
        $option(1, 3, 4, "+z", spec.options![5]),
      ],
    );
  },
});

Deno.test({
  name: "analyze: subcommand",
  fn() {
    const spec: Spec = {
      name: "test",
      subcommands: [{
        name: "cmd",
        options: [{
          name: "--option",
        }],
      }],
    } as const;
    assertEqualsTokens(
      analyze(
        ["cmd", "--option"],
        spec,
      ),
      [
        $subcommand<Subcommand, Option>(
          0,
          0,
          3,
          "cmd",
          spec.subcommands![0],
        ),
        $option(1, 0, 8, "--option", spec.subcommands![0].options![0]),
      ],
    );
  },
});

Deno.test({
  name: "analyze: persistent options",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [{
        name: "--option",
        isPersistent: true,
      }],
      subcommands: [{
        name: "cmd",
      }],
    } as const;
    assertEqualsTokens(
      analyze(
        ["cmd", "--option"],
        spec,
      ),
      [
        $subcommand<Subcommand, Option>(
          0,
          0,
          3,
          "cmd",
          spec.subcommands![0],
        ),
        $option(1, 0, 8, "--option", spec.options![0]),
      ],
    );
  },
});

Deno.test({
  name: "analyze: option with args",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [{
        name: "--option",
        isPersistent: true,
      }],
      subcommands: [{
        name: "cmd",
      }],
    };
    assertEqualsTokens(
      analyze(
        ["cmd", "--option"],
        spec,
      ),
      [
        $subcommand<Subcommand, Option>(
          0,
          0,
          3,
          "cmd",
          spec.subcommands![0],
        ),
        $option(1, 0, 8, "--option", spec.options![0]),
      ],
    );
  },
});

Deno.test({
  name: "analyze: optionsMustPrecedeArgs",
  fn() {
    const spec: Spec = {
      name: "test",
      parserDirectives: {
        optionsMustPrecedeArguments: true,
      },
      options: [{
        name: "--option",
        isPersistent: true,
      }],
      subcommands: [{
        name: "cmd",
      }],
    };
    assertEqualsTokens(
      analyze(
        ["cmd", "--option", "arg", "--option"],
        spec,
      ),
      [
        $subcommand<Subcommand, Option>(
          0,
          0,
          3,
          "cmd",
          spec.subcommands![0],
        ),
        $option(1, 0, 8, "--option", spec.options![0]),
        $arg(2, 0, 3, "arg"),
        $arg(3, 0, 8, "--option"),
      ],
    );
  },
});

Deno.test({
  name: "analyze: subcommandsMatchUniquePrefix",
  fn() {
    const spec: Spec = {
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
    assertEqualsTokens(
      analyze(["long-name"], spec),
      [
        $subcommand<Subcommand, Option>(
          0,
          0,
          9,
          "long-name",
          spec.subcommands![0],
        ),
      ],
    );
    // Matches one exactly, even when it is the prefix of another command
    assertEqualsTokens(
      analyze(["abc"], spec),
      [
        $subcommand<Subcommand, Option>(
          0,
          0,
          3,
          "abc",
          spec.subcommands![3],
        ),
      ],
    );
    // Match a command when it has two names that share the same prefix
    assertEqualsTokens(
      analyze(["abc-"], spec),
      [
        $subcommand<Subcommand, Option>(
          0,
          0,
          4,
          "abc-",
          spec.subcommands![2],
        ),
      ],
    );
    // should match both, so no unique subcommand, fails subcommand check.
    // on commands with requiresSubcommand, this will still fail at runtime
    assertEqualsTokens(
      analyze(["long-"], spec),
      [$arg(0, 0, 5, "long-")],
    );
    // should match only one
    assertEqualsTokens(
      analyze(["long-n"], spec),
      [$subcommand<Subcommand, Option>(
        0,
        0,
        6,
        "long-n",
        spec.subcommands![0],
      )],
    );
    // should match only one
    assertEqualsTokens(
      analyze(["n"], spec),
      [$subcommand<Subcommand, Option>(
        0,
        0,
        1,
        "n",
        spec.subcommands![0],
      )],
    );
  },
});
