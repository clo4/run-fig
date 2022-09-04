import * as Fig from "./testing.ts";
import { helpCommand } from "./help.ts";
import type { Option } from "./types.ts";
import { assertThrows } from "../deps/std_testing_asserts.ts";

// This should succeed. If it fails, there's either a bug with the command
// or the testing logic, but either way it's a bug.
Deno.test(
  "testing: Run Fig.test on Fig.help",
  Fig.test(helpCommand),
);

Deno.test("testing: assertOptionsHaveLocallyUniqueNames", () => {
  // Valid specs
  Fig.assertOptionsHaveLocallyUniqueNames({ name: "test" });
  Fig.assertOptionsHaveLocallyUniqueNames({
    name: "test",
    options: [{ name: "one" }],
  });
  Fig.assertOptionsHaveLocallyUniqueNames({
    name: "test",
    options: [{ name: "one" }, { name: "two" }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertOptionsHaveLocallyUniqueNames({
      name: "test",
      options: [{ name: "one" }, { name: "one" }],
    });
  });
  assertThrows(() => {
    Fig.assertOptionsHaveLocallyUniqueNames({
      name: "test",
      options: [{ name: ["one", "one"] }],
    });
  });
});

Deno.test("testing: assertRepeatableOptionsHaveNoArguments", () => {
  // Valid specs
  Fig.assertRepeatableOptionsHaveNoArguments({ name: "test" });
  Fig.assertRepeatableOptionsHaveNoArguments({
    name: "test",
    options: [{ name: "one" }],
  });
  Fig.assertRepeatableOptionsHaveNoArguments({
    name: "test",
    options: [
      { name: "one", isRepeatable: true },
      { name: "two", isRepeatable: 2 },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertRepeatableOptionsHaveNoArguments({
      name: "test",
      options: [
        { name: "one", isRepeatable: true, args: {} },
      ],
    });
  });
});

Deno.test("testing: assertSubcommandsHaveLocallyUniqueNames", () => {
  // Valid specs
  Fig.assertSubcommandsHaveLocallyUniqueNames({ name: "test" });
  Fig.assertSubcommandsHaveLocallyUniqueNames({
    name: "test",
    subcommands: [{ name: "one" }, { name: "two" }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertSubcommandsHaveLocallyUniqueNames({
      name: "test",
      subcommands: [
        { name: "one" },
        { name: "one" },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertSubcommandsHaveLocallyUniqueNames({
      name: "test",
      subcommands: [
        { name: ["one", "one"] },
      ],
    });
  });
});

Deno.test("testing: assertOptionsDoNotShadowPersistentOptions", () => {
  // Valid specs
  Fig.assertOptionsDoNotShadowPersistentOptions({ name: "test" });
  Fig.assertOptionsDoNotShadowPersistentOptions({
    name: "test",
    options: [
      { name: "one", isPersistent: true },
      { name: "two" },
    ],
  });
  Fig.assertOptionsDoNotShadowPersistentOptions({
    name: "test",
    options: [
      { name: "one", isPersistent: true },
    ],
    subcommands: [{
      name: "subcommand",
      options: [{ name: "two" }],
    }],
  });
  Fig.assertOptionsDoNotShadowPersistentOptions({
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
    Fig.assertOptionsDoNotShadowPersistentOptions({
      name: "test",
      options: [
        { name: "one", isPersistent: true },
      ],
      subcommands: [{
        name: "subcommand",
        options: [{ name: "one" }],
      }],
    });
  });
});

Deno.test("testing: assertRepeatableOptionsArePositiveIntegers", () => {
  // Valid specs
  Fig.assertRepeatableOptionsArePositiveIntegers({ name: "test" });
  Fig.assertRepeatableOptionsArePositiveIntegers({
    name: "test",
    options: [
      { name: "one" },
      { name: "two", isRepeatable: 2 },
      { name: "three", isRepeatable: 2 },
    ],
  });
  Fig.assertRepeatableOptionsArePositiveIntegers({
    name: "test",
    options: [
      { name: "one", isRepeatable: true },
    ],
    subcommands: [{
      name: "subcommand",
      options: [{ name: "two" }],
    }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [
        { name: "one", isRepeatable: 0 },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [
        { name: "one", isRepeatable: 1 },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [
        { name: "one", isRepeatable: -1 },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [
        { name: "one", isRepeatable: NaN },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [
        { name: "one", isRepeatable: Infinity },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertRepeatableOptionsArePositiveIntegers({
      name: "test",
      options: [
        { name: "one", isRepeatable: 2.1 },
      ],
    });
  });
});

Deno.test("testing: assertRequiredArgumentsDoNotFollowOptionalArguments", () => {
  // Valid specs
  Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({ name: "test" });
  Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
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
  Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
    name: "test",
    args: {},
  });
  Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
    name: "test",
    args: { isOptional: true },
  });
  Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
    name: "test",
    args: [{}, {}],
  });
  Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
    name: "test",
    args: [{}, { isOptional: true }],
  });
  Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
    name: "test",
    args: [{ isOptional: true }, { isOptional: true }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      args: [{ isOptional: true }, {}],
    });
  });
  assertThrows(() => {
    Fig.assertRequiredArgumentsDoNotFollowOptionalArguments({
      name: "test",
      options: [
        { name: "one", args: [{ isOptional: true }, {}] },
      ],
    });
  });
});

Deno.test("testing: assertLongOptionNamesDoNotStartWithSingleDash", () => {
  // Valid specs
  Fig.assertLongOptionNamesDoNotStartWithSingleDash({ name: "test" });
  Fig.assertLongOptionNamesDoNotStartWithSingleDash({
    name: "test",
    options: [
      { name: "one" },
      { name: "--one" },
      { name: "-o" },
      { name: "+o" },
      { name: "-" },
      { name: "--" },
    ],
    subcommands: [{
      name: "example",
      options: [{ name: ["-", "--"] }],
    }],
  });
  Fig.assertLongOptionNamesDoNotStartWithSingleDash({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    options: [
      { name: "-one" },
    ],
  });
  Fig.assertLongOptionNamesDoNotStartWithSingleDash({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    subcommands: [{
      name: "example",
      options: [
        { name: "-one" },
      ],
    }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertLongOptionNamesDoNotStartWithSingleDash({
      name: "test",
      options: [
        { name: "-one" },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertLongOptionNamesDoNotStartWithSingleDash({
      name: "test",
      subcommands: [{
        name: "example",
        options: [
          { name: "-one" },
        ],
      }],
    });
  });
  assertThrows(() => {
    Fig.assertLongOptionNamesDoNotStartWithSingleDash({
      name: "test",
      subcommands: [{
        name: "example",
        options: [
          { name: "+one" },
        ],
      }],
    });
  });
});

Deno.test("testing: assertOptionNamesStartWithDashes", () => {
  // Valid specs
  Fig.assertOptionNamesStartWithDashes({ name: "test" });
  Fig.assertOptionNamesStartWithDashes({
    name: "test",
    options: [
      { name: "--one" },
      { name: "-o" },
      { name: "-" },
      { name: "--" },
    ],
    subcommands: [{
      name: "example",
      options: [{ name: ["-", "--"] }],
    }],
  });
  Fig.assertOptionNamesStartWithDashes({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    options: [{ name: "example" }],
    subcommands: [{
      name: "example",
      options: [
        { name: "one" },
      ],
    }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertOptionNamesStartWithDashes({
      name: "test",
      options: [
        { name: "one" },
      ],
    });
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertOptionNamesStartWithDashes({
      name: "test",
      subcommands: [{
        name: "example",
        options: [
          { name: "one" },
        ],
      }],
    });
  });
});

Deno.test("testing: assertNothingIsNamedDashDash", () => {
  // Valid specs
  Fig.assertNothingIsNamedDashDash({ name: "test" });
  Fig.assertNothingIsNamedDashDash({
    name: "test",
    options: [{ name: "example" }],
    subcommands: [{
      name: "example",
      options: [
        { name: "one" },
      ],
    }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertNothingIsNamedDashDash({
      name: "test",
      options: [
        { name: "--" },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertNothingIsNamedDashDash({
      name: "test",
      subcommands: [
        { name: "--" },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertNothingIsNamedDashDash({
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
      options: [
        { name: "--" },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertNothingIsNamedDashDash({
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
      subcommands: [
        { name: "--" },
      ],
    });
  });
});

Deno.test("testing: assertOptionArgSeparatorsHaveCharacters", () => {
  // Valid specs
  Fig.assertOptionArgSeparatorsHaveCharacters({ name: "test" });
  Fig.assertOptionArgSeparatorsHaveCharacters({
    name: "test",
    parserDirectives: {
      optionArgSeparators: ":",
    },
    subcommands: [{
      name: "1",
      parserDirectives: {
        optionArgSeparators: [],
      },
    }, {
      name: "2",
      parserDirectives: {
        optionArgSeparators: [":", "="],
      },
    }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      parserDirectives: {
        optionArgSeparators: "",
      },
    });
  });
  assertThrows(() => {
    Fig.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      parserDirectives: {
        optionArgSeparators: [":", ""],
      },
    });
  });
  assertThrows(() => {
    Fig.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      subcommands: [{
        name: "example",
        parserDirectives: {
          optionArgSeparators: "",
        },
      }],
    });
  });
  assertThrows(() => {
    Fig.assertOptionArgSeparatorsHaveCharacters({
      name: "test",
      subcommands: [{
        name: "example",
        parserDirectives: {
          optionArgSeparators: [":", ""],
        },
      }],
    });
  });
});

Deno.test("testing: assertPlusMinusOptionsTakeOneArg", () => {
  // Valid specs
  Fig.assertPlusMinusOptionsTakeOneArg({ name: "test" });
  Fig.assertPlusMinusOptionsTakeOneArg({
    name: "test",
    options: [
      { name: "+", args: {} },
      { name: "-", args: {} },
    ],
  });
  Fig.assertPlusMinusOptionsTakeOneArg({
    name: "test",
    parserDirectives: {
      flagsArePosixNoncompliant: true,
    },
    options: [
      { name: "+" },
      { name: "-" },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [
        { name: "+" },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [
        { name: "-" },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [
        { name: "+", args: [{}, { isOptional: true }] },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertPlusMinusOptionsTakeOneArg({
      name: "test",
      options: [
        { name: "-", args: [{}, { isOptional: true }] },
      ],
    });
  });
});

Deno.test("testing: assertNamesHaveNoExtraWhitespace", () => {
  // Valid specs
  Fig.assertNamesHaveNoExtraWhitespace({ name: "test" });
  Fig.assertNamesHaveNoExtraWhitespace({
    name: "test",
    options: [
      { name: "--option", args: { name: "arg" } },
    ],
    args: {
      name: "no space",
    },
    subcommands: [
      {
        name: "subcommand",
        options: [{ name: "opt" }],
        args: [
          { name: "no additional space" },
          {},
        ],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertNamesHaveNoExtraWhitespace({
      name: "test ",
    });
  });
  assertThrows(() => {
    Fig.assertNamesHaveNoExtraWhitespace({
      name: " test",
    });
  });
  assertThrows(() => {
    Fig.assertNamesHaveNoExtraWhitespace({
      name: "test",
      options: [
        { name: "--option " },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertNamesHaveNoExtraWhitespace({
      name: "test",
      options: [
        { name: "--option", args: { name: "arg " } },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertNamesHaveNoExtraWhitespace({
      name: "test",
      subcommands: [{
        name: "example ",
      }],
    });
  });
  assertThrows(() => {
    Fig.assertNamesHaveNoExtraWhitespace({
      name: "test",
      subcommands: [{
        name: "example",
        options: [{
          name: " -o",
        }],
      }],
    });
  });
  assertThrows(() => {
    Fig.assertNamesHaveNoExtraWhitespace({
      name: "test",
      options: [
        { name: "--option", args: { name: "arg " } },
      ],
    });
  });
});

Deno.test("testing: assertEverythingHasDescription", () => {
  // Valid specs
  Fig.assertEverythingHasDescription({ name: "test", description: "test" });
  Fig.assertEverythingHasDescription({
    name: "test",
    description: "test",
    options: [
      { name: "--option", description: "test", args: { name: "arg" } },
    ],
    args: {},
    subcommands: [
      {
        name: "subcommand",
        description: "test",
        options: [{ name: "opt", description: "opt" }],
        args: {},
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertEverythingHasDescription({
      name: "test",
    });
  });
  assertThrows(() => {
    Fig.assertEverythingHasDescription({
      name: "test",
      description: "test",
      options: [{
        name: "test",
      }],
    });
  });
});

Deno.test("testing: assertDescriptionLineLengthUnder69", () => {
  // Valid specs
  Fig.assertDescriptionLineLengthUnder69({ name: "test" });
  Fig.assertDescriptionLineLengthUnder69({
    name: "test",
    description: "test",
    options: [
      { name: "--option", description: "test", args: { name: "arg" } },
    ],
    args: {},
    subcommands: [
      {
        name: "subcommand",
        description: "test",
        options: [{ name: "opt", description: "opt" }],
        args: {},
      },
    ],
  });
  Fig.assertDescriptionLineLengthUnder69({
    name: "test",
    description: "a".repeat(68),
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertDescriptionLineLengthUnder69({
      name: "test",
      description: "a".repeat(69),
    });
  });
  assertThrows(() => {
    Fig.assertDescriptionLineLengthUnder69({
      name: "test",
      options: [{
        name: "test",
        description: "a".repeat(69),
      }],
    });
  });
  assertThrows(() => {
    Fig.assertDescriptionLineLengthUnder69({
      name: "test",
      subcommands: [{
        name: "test",
        description: "a".repeat(69),
      }],
    });
  });
});

Deno.test("testing: assertRequiresSeparatorTakesOneArg", () => {
  // Valid specs
  Fig.assertRequiresSeparatorTakesOneArg({ name: "test" });
  Fig.assertRequiresSeparatorTakesOneArg({
    name: "test",
    options: [
      { name: "option" },
      { name: "option", args: {} },
      { name: "option", args: [{}, {}] },
    ],
  });
  Fig.assertRequiresSeparatorTakesOneArg({
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
      Fig.assertRequiresSeparatorTakesOneArg({
        name: "test",
        options: [option],
      });
    });
  }
});

Deno.test("testing: assertCommonOptionsArePersistent", () => {
  // Valid specs
  Fig.assertCommonOptionsArePersistent({ name: "test" });
  Fig.assertCommonOptionsArePersistent({
    name: "test",
    options: [
      { name: "option" },
    ],
  });
  Fig.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a" }],
    subcommands: [{
      name: "subcommand",
      options: [{ name: "b" }],
    }],
  });
  Fig.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a" }],
    subcommands: [
      {
        name: "subcommand",
        options: [{ name: "a" }],
      },
      {
        name: "another",
      },
    ],
  });
  Fig.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a", isPersistent: true }],
    subcommands: [{
      name: "subcommand",
    }],
  });
  Fig.assertCommonOptionsArePersistent({
    name: "test",
    options: [{ name: "a" }],
    subcommands: [
      {
        name: "subcommand",
        options: [{ name: "a" }],
        subcommands: [
          { name: "another" },
        ],
      },
    ],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertCommonOptionsArePersistent({
      name: "test",
      options: [{ name: "a" }],
      subcommands: [
        {
          name: "subcommand",
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
    Fig.assertCommonOptionsArePersistent({
      name: "test",
      options: [{ name: "a" }],
      subcommands: [
        {
          name: "subcommand",
          options: [{ name: "a" }],
          subcommands: [
            { name: "another", options: [{ name: "a" }] },
          ],
        },
      ],
    });
  });
});

Deno.test("testing: assertOptionNameReferencesExist", () => {
  // Valid specs
  Fig.assertOptionNameReferencesExist({ name: "test" });
  Fig.assertOptionNameReferencesExist({
    name: "test",
    options: [
      { name: "a" },
      { name: "b" },
    ],
  });
  Fig.assertOptionNameReferencesExist({
    name: "test",
    options: [
      { name: "a", dependsOn: ["b"] },
      { name: "b", exclusiveOn: ["a"] },
    ],
  });
  Fig.assertOptionNameReferencesExist({
    name: "test",
    options: [
      { name: "a", isPersistent: true },
    ],
    subcommands: [{
      name: "cmd",
      options: [
        { name: "b", dependsOn: ["a"] },
        { name: "c", exclusiveOn: ["b"] },
      ],
    }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertOptionNameReferencesExist({
      name: "test",
      options: [
        { name: "a", dependsOn: ["b"] },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertOptionNameReferencesExist({
      name: "test",
      options: [
        { name: "a", exclusiveOn: ["b"] },
      ],
    });
  });
  assertThrows(() => {
    Fig.assertOptionNameReferencesExist({
      name: "test",
      options: [
        { name: "a" },
      ],
      subcommands: [{
        name: "cmd",
        options: [
          { name: "b", dependsOn: ["a"] },
        ],
      }],
    });
  });
  assertThrows(() => {
    Fig.assertOptionNameReferencesExist({
      name: "test",
      options: [
        { name: "a" },
      ],
      subcommands: [{
        name: "cmd",
        options: [
          { name: "b", exclusiveOn: ["a"] },
        ],
      }],
    });
  });
});

Deno.test("testing: assertPrefixMatchCommandsHaveNoArguments", () => {
  // Valid specs
  Fig.assertPrefixMatchCommandsHaveNoArguments({ name: "test" });
  Fig.assertPrefixMatchCommandsHaveNoArguments({
    name: "test",
    parserDirectives: {
      subcommandsMatchUniquePrefix: true,
    },
    subcommands: [
      { name: "something" },
      { name: "another" },
    ],
  });
  Fig.assertPrefixMatchCommandsHaveNoArguments({
    name: "test",
    parserDirectives: {
      subcommandsMatchUniquePrefix: true,
    },
    args: {},
  });
  Fig.assertPrefixMatchCommandsHaveNoArguments({
    name: "test",
    parserDirectives: {
      subcommandsMatchUniquePrefix: true,
    },
    subcommands: [{
      name: "test",
      args: { name: "args" },
    }],
  });
  // Invalid specs
  assertThrows(() => {
    Fig.assertPrefixMatchCommandsHaveNoArguments({
      name: "test",
      parserDirectives: {
        subcommandsMatchUniquePrefix: true,
      },
      subcommands: [{
        name: "test",
        args: { name: "args" },
        subcommands: [{ name: "test" }],
      }],
    });
  });
  assertThrows(() => {
    Fig.assertPrefixMatchCommandsHaveNoArguments({
      name: "test",
      parserDirectives: {
        subcommandsMatchUniquePrefix: true,
      },
      args: { name: "test" },
      subcommands: [{ name: "test" }],
    });
  });
});
