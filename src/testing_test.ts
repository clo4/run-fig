import * as CLI from "./testing.ts";
import { helpCommand } from "./help.ts";
import type { Option } from "./types.ts";
import { assertThrows } from "./deps/std_testing_asserts.ts";

// This should succeed. If it fails, there's either a bug with the command
// or the testing logic, but either way it's a bug.
Deno.test("testing: Run CLI.test on CLI.help", CLI.test(helpCommand));

Deno.test("testing: assertOptionsHaveLocallyUniqueNames", () => {
  // Valid specs
  CLI.assertOptionsHaveLocallyUniqueNames({ name: "test" });
  CLI.assertOptionsHaveLocallyUniqueNames({
    name: "test",
    options: [{ name: "one" }],
  });
  CLI.assertOptionsHaveLocallyUniqueNames({
    name: "test",
    options: [{ name: "one" }, { name: "two" }],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertOptionsHaveLocallyUniqueNames({
      name: "test",
      options: [{ name: "one" }, { name: "one" }],
    });
  });
  assertThrows(() => {
    CLI.assertOptionsHaveLocallyUniqueNames({
      name: "test",
      options: [{ name: ["one", "one"] }],
    });
  });
});

Deno.test("testing: assertRepeatableOptionsHaveNoArguments", () => {
  // Valid specs
  CLI.assertRepeatableOptionsHaveNoArguments({ name: "test" });
  CLI.assertRepeatableOptionsHaveNoArguments({
    name: "test",
    options: [{ name: "one" }],
  });
  CLI.assertRepeatableOptionsHaveNoArguments({
    name: "test",
    options: [
      { name: "one", isRepeatable: true },
      { name: "two", isRepeatable: 2 },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertRepeatableOptionsHaveNoArguments({
      name: "test",
      options: [{ name: "one", isRepeatable: true, args: {} }],
    });
  });
});

Deno.test("testing: assertCommandsHaveLocallyUniqueNames", () => {
  // Valid specs
  CLI.assertCommandsHaveLocallyUniqueNames({ name: "test" });
  CLI.assertCommandsHaveLocallyUniqueNames({
    name: "test",
    subcommands: [{ name: "one" }, { name: "two" }],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertCommandsHaveLocallyUniqueNames({
      name: "test",
      subcommands: [{ name: "one" }, { name: "one" }],
    });
  });
  assertThrows(() => {
    CLI.assertCommandsHaveLocallyUniqueNames({
      name: "test",
      subcommands: [{ name: ["one", "one"] }],
    });
  });
});

Deno.test("testing: assertOptionsDoNotShadowPersistentOptions", () => {
  // Valid specs
  CLI.assertOptionsDoNotShadowPersistentOptions({ name: "test" });
  CLI.assertOptionsDoNotShadowPersistentOptions({
    name: "test",
    options: [{ name: "one", isPersistent: true }, { name: "two" }],
  });
  CLI.assertOptionsDoNotShadowPersistentOptions({
    name: "test",
    options: [{ name: "one", isPersistent: true }],
    subcommands: [
      {
        name: "command",
        options: [{ name: "two" }],
      },
    ],
  });
  CLI.assertOptionsDoNotShadowPersistentOptions({
    name: "test",
    options: [
      // This assertion actually doesn't care about this, because it should
      // be checked by assertOptionsHaveLocallyUniqueNames instead.
      { name: "one", isPersistent: true },
      { name: "one" },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertOptionsDoNotShadowPersistentOptions({
      name: "test",
      options: [{ name: "one", isPersistent: true }],
      subcommands: [
        {
          name: "command",
          options: [{ name: "one" }],
        },
      ],
    });
  });
});

Deno.test("testing: assertRepeatableOptionsArePositiveIntegers", () => {
  // Valid specs
  CLI.assertRepeatableOptionsArePositiveIntegers({ name: "test" });
  CLI.assertRepeatableOptionsArePositiveIntegers({
    name: "test",
    options: [
      { name: "one" },
      { name: "two", isRepeatable: 2 },
      { name: "three", isRepeatable: 2 },
    ],
  });
  CLI.assertRepeatableOptionsArePositiveIntegers({
    name: "test",
    options: [{ name: "one", isRepeatable: true }],
    subcommands: [
      {
        name: "command",
        options: [{ name: "two" }],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [{ name: "one", isRepeatable: 0 }],
    });
  });
  assertThrows(() => {
    CLI.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [{ name: "one", isRepeatable: 1 }],
    });
  });
  assertThrows(() => {
    CLI.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [{ name: "one", isRepeatable: -1 }],
    });
  });
  assertThrows(() => {
    CLI.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [{ name: "one", isRepeatable: NaN }],
    });
  });
  assertThrows(() => {
    CLI.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [{ name: "one", isRepeatable: Infinity }],
    });
  });
  assertThrows(() => {
    CLI.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [{ name: "one", isRepeatable: 2.1 }],
    });
  });
});

Deno.test(
  "testing: assertRequiredArgumentsDoNotFollowOptionalArguments",
  () => {
    // Valid specs
    CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({ name: "test" });
    CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      options: [
        { name: "one" },
        { name: "two", args: {} },
        { name: "two", args: { isOptional: true } },
        { name: "three", args: [{}, {}] },
        { name: "four", args: [{}, { isOptional: true }] },
        { name: "four", args: [{ isOptional: true }, { isOptional: true }] },
      ],
    });
    CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      args: {},
    });
    CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      args: { isOptional: true },
    });
    CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      args: [{}, {}],
    });
    CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      args: [{}, { isOptional: true }],
    });
    CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      args: [{ isOptional: true }, { isOptional: true }],
    });
    // Invalid specs
    assertThrows(() => {
      CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
        name: "test",
        args: [{ isOptional: true }, {}],
      });
    });
    assertThrows(() => {
      CLI.assertRequiredArgumentsDoNotFollowOptionalArguments({
        name: "test",
        options: [{ name: "one", args: [{ isOptional: true }, {}] }],
      });
    });
  }
);

Deno.test("testing: assertLongOptionNamesDoNotStartWithSingleDash", () => {
  // Valid specs
  CLI.assertLongOptionNamesDoNotStartWithSingleDash({ name: "test" });
  CLI.assertLongOptionNamesDoNotStartWithSingleDash({
    name: "test",
    options: [
      { name: "one" },
      { name: "--one" },
      { name: "-o" },
      { name: "+o" },
      { name: "-" },
      { name: "--" },
    ],
    subcommands: [
      {
        name: "example",
        options: [{ name: ["-", "--"] }],
      },
    ],
  });
  CLI.assertLongOptionNamesDoNotStartWithSingleDash({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    options: [{ name: "-one" }],
  });
  CLI.assertLongOptionNamesDoNotStartWithSingleDash({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    subcommands: [
      {
        name: "example",
        options: [{ name: "-one" }],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertLongOptionNamesDoNotStartWithSingleDash({
      name: "test",
      options: [{ name: "-one" }],
    });
  });
  assertThrows(() => {
    CLI.assertLongOptionNamesDoNotStartWithSingleDash({
      name: "test",
      subcommands: [
        {
          name: "example",
          options: [{ name: "-one" }],
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertLongOptionNamesDoNotStartWithSingleDash({
      name: "test",
      subcommands: [
        {
          name: "example",
          options: [{ name: "+one" }],
        },
      ],
    });
  });
});

Deno.test("testing: assertOptionNamesStartWithDashes", () => {
  // Valid specs
  CLI.assertOptionNamesStartWithDashes({ name: "test" });
  CLI.assertOptionNamesStartWithDashes({
    name: "test",
    options: [{ name: "--one" }, { name: "-o" }, { name: "-" }, { name: "--" }],
    subcommands: [
      {
        name: "example",
        options: [{ name: ["-", "--"] }],
      },
    ],
  });
  CLI.assertOptionNamesStartWithDashes({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    options: [{ name: "example" }],
    subcommands: [
      {
        name: "example",
        options: [{ name: "one" }],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertOptionNamesStartWithDashes({
      name: "test",
      options: [{ name: "one" }],
    });
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertOptionNamesStartWithDashes({
      name: "test",
      subcommands: [
        {
          name: "example",
          options: [{ name: "one" }],
        },
      ],
    });
  });
});

Deno.test("testing: assertNothingIsNamedDashDash", () => {
  // Valid specs
  CLI.assertNothingIsNamedDashDash({ name: "test" });
  CLI.assertNothingIsNamedDashDash({
    name: "test",
    options: [{ name: "example" }],
    subcommands: [
      {
        name: "example",
        options: [{ name: "one" }],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertNothingIsNamedDashDash({
      name: "test",
      options: [{ name: "--" }],
    });
  });
  assertThrows(() => {
    CLI.assertNothingIsNamedDashDash({
      name: "test",
      subcommands: [{ name: "--" }],
    });
  });
  assertThrows(() => {
    CLI.assertNothingIsNamedDashDash({
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
      options: [{ name: "--" }],
    });
  });
  assertThrows(() => {
    CLI.assertNothingIsNamedDashDash({
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
      subcommands: [{ name: "--" }],
    });
  });
});

Deno.test("testing: assertOptionArgSeparatorsHaveCharacters", () => {
  // Valid specs
  CLI.assertOptionArgSeparatorsHaveCharacters({ name: "test" });
  CLI.assertOptionArgSeparatorsHaveCharacters({
    name: "test",
    parserDirectives: {
      optionArgSeparators: ":",
    },
    subcommands: [
      {
        name: "1",
        parserDirectives: {
          optionArgSeparators: [],
        },
      },
      {
        name: "2",
        parserDirectives: {
          optionArgSeparators: [":", "="],
        },
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      parserDirectives: {
        optionArgSeparators: "",
      },
    });
  });
  assertThrows(() => {
    CLI.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      parserDirectives: {
        optionArgSeparators: [":", ""],
      },
    });
  });
  assertThrows(() => {
    CLI.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      subcommands: [
        {
          name: "example",
          parserDirectives: {
            optionArgSeparators: "",
          },
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      subcommands: [
        {
          name: "example",
          parserDirectives: {
            optionArgSeparators: [":", ""],
          },
        },
      ],
    });
  });
});

Deno.test("testing: assertPlusMinusOptionsTakeOneArg", () => {
  // Valid specs
  CLI.assertPlusMinusOptionsTakeOneArg({ name: "test" });
  CLI.assertPlusMinusOptionsTakeOneArg({
    name: "test",
    options: [
      { name: "+", args: {} },
      { name: "-", args: {} },
    ],
  });
  CLI.assertPlusMinusOptionsTakeOneArg({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    options: [{ name: "+" }, { name: "-" }],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [{ name: "+" }],
    });
  });
  assertThrows(() => {
    CLI.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [{ name: "-" }],
    });
  });
  assertThrows(() => {
    CLI.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [{ name: "+", args: [{}, { isOptional: true }] }],
    });
  });
  assertThrows(() => {
    CLI.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [{ name: "-", args: [{}, { isOptional: true }] }],
    });
  });
});

Deno.test("testing: assertNamesHaveNoExtraWhitespace", () => {
  // Valid specs
  CLI.assertNamesHaveNoExtraWhitespace({ name: "test" });
  CLI.assertNamesHaveNoExtraWhitespace({
    name: "test",
    options: [{ name: "--option", args: { name: "arg" } }],
    args: {
      name: "no space",
    },
    subcommands: [
      {
        name: "command",
        options: [{ name: "opt" }],
        args: [{ name: "no additional space" }, {}],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertNamesHaveNoExtraWhitespace({
      name: "test ",
    });
  });
  assertThrows(() => {
    CLI.assertNamesHaveNoExtraWhitespace({
      name: " test",
    });
  });
  assertThrows(() => {
    CLI.assertNamesHaveNoExtraWhitespace({
      name: "test",
      options: [{ name: "--option " }],
    });
  });
  assertThrows(() => {
    CLI.assertNamesHaveNoExtraWhitespace({
      name: "test",
      options: [{ name: "--option", args: { name: "arg " } }],
    });
  });
  assertThrows(() => {
    CLI.assertNamesHaveNoExtraWhitespace({
      name: "test",
      subcommands: [
        {
          name: "example ",
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertNamesHaveNoExtraWhitespace({
      name: "test",
      subcommands: [
        {
          name: "example",
          options: [
            {
              name: " -o",
            },
          ],
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertNamesHaveNoExtraWhitespace({
      name: "test",
      options: [{ name: "--option", args: { name: "arg " } }],
    });
  });
});

Deno.test("testing: assertEverythingHasDescription", () => {
  // Valid specs
  CLI.assertEverythingHasDescription({ name: "test", description: "test" });
  CLI.assertEverythingHasDescription({
    name: "test",
    description: "test",
    options: [{ name: "--option", description: "test", args: { name: "arg" } }],
    args: {},
    subcommands: [
      {
        name: "command",
        description: "test",
        options: [{ name: "opt", description: "opt" }],
        args: {},
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertEverythingHasDescription({
      name: "test",
    });
  });
  assertThrows(() => {
    CLI.assertEverythingHasDescription({
      name: "test",
      description: "test",
      options: [
        {
          name: "test",
        },
      ],
    });
  });
});

Deno.test("testing: assertDescriptionLineLengthUnder69", () => {
  // Valid specs
  CLI.assertDescriptionLineLengthUnder69({ name: "test" });
  CLI.assertDescriptionLineLengthUnder69({
    name: "test",
    description: "test",
    options: [{ name: "--option", description: "test", args: { name: "arg" } }],
    args: {},
    subcommands: [
      {
        name: "command",
        description: "test",
        options: [{ name: "opt", description: "opt" }],
        args: {},
      },
    ],
  });
  CLI.assertDescriptionLineLengthUnder69({
    name: "test",
    description: "a".repeat(68),
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertDescriptionLineLengthUnder69({
      name: "test",
      description: "a".repeat(69),
    });
  });
  assertThrows(() => {
    CLI.assertDescriptionLineLengthUnder69({
      name: "test",
      options: [
        {
          name: "test",
          description: "a".repeat(69),
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertDescriptionLineLengthUnder69({
      name: "test",
      subcommands: [
        {
          name: "test",
          description: "a".repeat(69),
        },
      ],
    });
  });
});

Deno.test("testing: assertRequiresSeparatorTakesOneArg", () => {
  // Valid specs
  CLI.assertRequiresSeparatorTakesOneArg({ name: "test" });
  CLI.assertRequiresSeparatorTakesOneArg({
    name: "test",
    options: [
      { name: "option" },
      { name: "option", args: {} },
      { name: "option", args: [{}, {}] },
    ],
  });
  CLI.assertRequiresSeparatorTakesOneArg({
    name: "test",
    options: [
      { name: "1", requiresSeparator: true, args: {} },
      { name: "2", requiresSeparator: "=", args: {} },
    ],
  });
  // Invalid specs
  const options: Option[] = [
    { name: "option", requiresSeparator: true },
    { name: "option", requiresSeparator: "=" },
    { name: "option", requiresSeparator: true, args: [{}, {}] },
    { name: "option", requiresSeparator: "=", args: [{}, {}] },
    { name: "option", requiresSeparator: "=", args: { isVariadic: true } },
    {
      name: "option",
      requiresSeparator: "=",
      args: [{}, { isOptional: true }],
    },
  ];
  for (const option of options) {
    assertThrows(() => {
      CLI.assertRequiresSeparatorTakesOneArg({
        name: "test",
        options: [option],
      });
    });
  }
});

Deno.test("testing: assertCommonOptionsArePersistent", () => {
  // Valid specs
  CLI.assertCommonOptionsArePersistent({ name: "test" });
  CLI.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "option" }],
  });
  CLI.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a" }],
    subcommands: [
      {
        name: "command",
        options: [{ name: "b" }],
      },
    ],
  });
  CLI.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a" }],
    subcommands: [
      {
        name: "command",
        options: [{ name: "a" }],
      },
      {
        name: "another",
      },
    ],
  });
  CLI.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a", isPersistent: true }],
    subcommands: [
      {
        name: "command",
      },
    ],
  });
  CLI.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a" }],
    subcommands: [
      {
        name: "command",
        options: [{ name: "a" }],
        subcommands: [{ name: "another" }],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertCommonOptionsArePersistent({
      name: "test",
      options: [{ name: "a" }],
      subcommands: [
        {
          name: "command",
          options: [{ name: "a" }],
        },
        {
          name: "another",
          options: [{ name: "a" }],
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertCommonOptionsArePersistent({
      name: "test",
      options: [{ name: "a" }],
      subcommands: [
        {
          name: "command",
          options: [{ name: "a" }],
          subcommands: [{ name: "another", options: [{ name: "a" }] }],
        },
      ],
    });
  });
});

Deno.test("testing: assertOptionNameReferencesExist", () => {
  // Valid specs
  CLI.assertOptionNameReferencesExist({ name: "test" });
  CLI.assertOptionNameReferencesExist({
    name: "test",
    options: [{ name: "a" }, { name: "b" }],
  });
  CLI.assertOptionNameReferencesExist({
    name: "test",
    options: [
      { name: "a", dependsOn: ["b"] },
      { name: "b", exclusiveOn: ["a"] },
    ],
  });
  CLI.assertOptionNameReferencesExist({
    name: "test",
    options: [{ name: "a", isPersistent: true }],
    subcommands: [
      {
        name: "cmd",
        options: [
          { name: "b", dependsOn: ["a"] },
          { name: "c", exclusiveOn: ["b"] },
        ],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertOptionNameReferencesExist({
      name: "test",
      options: [{ name: "a", dependsOn: ["b"] }],
    });
  });
  assertThrows(() => {
    CLI.assertOptionNameReferencesExist({
      name: "test",
      options: [{ name: "a", exclusiveOn: ["b"] }],
    });
  });
  assertThrows(() => {
    CLI.assertOptionNameReferencesExist({
      name: "test",
      options: [{ name: "a" }],
      subcommands: [
        {
          name: "cmd",
          options: [{ name: "b", dependsOn: ["a"] }],
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertOptionNameReferencesExist({
      name: "test",
      options: [{ name: "a" }],
      subcommands: [
        {
          name: "cmd",
          options: [{ name: "b", exclusiveOn: ["a"] }],
        },
      ],
    });
  });
});

Deno.test("testing: assertPrefixMatchCommandsHaveNoArguments", () => {
  // Valid specs
  CLI.assertPrefixMatchCommandsHaveNoArguments({ name: "test" });
  CLI.assertPrefixMatchCommandsHaveNoArguments({
    name: "test",
    parserDirectives: {
      subcommandsMatchUniquePrefix: true,
    },
    subcommands: [{ name: "something" }, { name: "another" }],
  });
  CLI.assertPrefixMatchCommandsHaveNoArguments({
    name: "test",
    parserDirectives: {
      subcommandsMatchUniquePrefix: true,
    },
    args: {},
  });
  CLI.assertPrefixMatchCommandsHaveNoArguments({
    name: "test",
    parserDirectives: {
      subcommandsMatchUniquePrefix: true,
    },
    subcommands: [
      {
        name: "test",
        args: { name: "args" },
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    CLI.assertPrefixMatchCommandsHaveNoArguments({
      name: "test",
      parserDirectives: {
        subcommandsMatchUniquePrefix: true,
      },
      subcommands: [
        {
          name: "test",
          args: { name: "args" },
          subcommands: [{ name: "test" }],
        },
      ],
    });
  });
  assertThrows(() => {
    CLI.assertPrefixMatchCommandsHaveNoArguments({
      name: "test",
      parserDirectives: {
        subcommandsMatchUniquePrefix: true,
      },
      args: { name: "test" },
      subcommands: [{ name: "test" }],
    });
  });
});
