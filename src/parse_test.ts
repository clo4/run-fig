import { usage } from "./help.ts";
import { getMaxArgs, getMinArgs, parse } from "./parse.ts";
import { Spec, Subcommand } from "./types.ts";
import { assertEquals, assertThrows } from "../deps/std_testing_asserts.ts";

function makeMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
}

Deno.test("getMinArgs", () => {
  assertEquals(getMinArgs([]), 0);
  assertEquals(getMinArgs([{}]), 1);
  assertEquals(getMinArgs([{}, {}]), 2);
  assertEquals(getMinArgs([{}, { isOptional: true }]), 1);
  assertEquals(getMinArgs([{ isOptional: true }]), 0);
  assertEquals(getMinArgs([{ isOptional: true }, {}]), 0);
});

Deno.test("getMaxArgs", () => {
  assertEquals(getMaxArgs([]), 0);
  assertEquals(getMaxArgs([{}]), 1);
  assertEquals(getMaxArgs([{}, {}]), 2);
  assertEquals(getMaxArgs([{}, { isVariadic: true }]), Infinity);
  assertEquals(getMaxArgs([{ isVariadic: true }]), Infinity);
  assertEquals(getMaxArgs([{ isVariadic: true }, {}]), Infinity);
});

Deno.test({
  name: "parse: no args and no values executes action",
  fn() {
    const spec: Spec = {
      name: "test",
    };
    const result = parse([], spec);
    assertEquals(result.args, []);
  },
});

Deno.test({
  name: "parse: one arg with one value succeeds",
  fn() {
    const spec: Spec = {
      name: "test",
      args: {},
    };
    const result = parse(["value"], spec);
    const wantArgs = ["value"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: no args with one value fails",
  fn() {
    const spec: Spec = { name: "test" };
    assertThrows(() => {
      parse(["value"], spec);
    });
  },
});

Deno.test({
  name: "parse: one arg with two values fails",
  fn() {
    const spec: Spec = {
      name: "test",
      args: {},
    };
    assertThrows(() => {
      parse(["value1", "value2"], spec);
    });
  },
});

Deno.test({
  name: "parse: single arg with no values fails",
  fn() {
    const spec: Spec = {
      name: "test",
      args: {},
    };
    assertThrows(() => {
      parse([], spec);
    });
  },
});

Deno.test({
  name: "parse: two args arg with one value fails",
  fn() {
    const spec: Spec = {
      name: "test",
      args: [{ name: "arg1" }, { name: "arg2" }],
    };
    assertThrows(() => {
      parse(["value"], spec);
    });
  },
});

Deno.test({
  name: "parse: two args with two values succeeds",
  fn() {
    const spec: Spec = {
      name: "test",
      args: [{}, {}],
    };
    const result = parse(["value1", "value2"], spec);
    const wantArgs = ["value1", "value2"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: variadic arg succeeds with one value",
  fn() {
    const spec: Spec = {
      name: "test",
      args: { isVariadic: true },
    };
    const result = parse(["value1", "value2", "value3"], spec);
    const wantArgs = ["value1", "value2", "value3"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: variadic arg fails with zero values",
  fn() {
    const spec: Spec = {
      name: "test",
      args: { isVariadic: true },
    };
    assertThrows(() => {
      parse([], spec);
    });
  },
});

Deno.test({
  name: "parse: variadic+optional arg succeeds with zero values",
  fn() {
    const spec: Spec = {
      name: "test",
      args: { isVariadic: true, isOptional: true },
    };
    const result = parse([], spec);
    assertEquals(result.args, []);
  },
});

Deno.test({
  name: "parse: options without args are [] when present",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: ["--present", "--alias"] },
        { name: "--missing" },
        { name: ["--another", "--another-alias"] },
      ],
    };
    const result = parse(["--present"], spec);
    const wantOptions = makeMap({
      "--present": [],
      "--alias": [],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: options and args can be interspersed",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [{ name: "--option" }],
      args: [{}, {}],
    };

    const result = parse(["value1", "--option", "value2"], spec);

    const wantOptions = makeMap({ "--option": [] });
    assertEquals(result.options, wantOptions);

    const wantArgs = ["value1", "value2"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: options can have values as the next argument",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "--arg", args: { name: "optionarg" } },
      ],
      args: [
        { name: "arg1" },
        { name: "arg2" },
      ],
    };

    const result = parse(["value1", "--arg", "optargval", "value2"], spec);

    const wantOptions = makeMap({ "--arg": ["optargval"] });
    assertEquals(result.options, wantOptions);

    const wantArgs = ["value1", "value2"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: options can take multiple arguments",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        {
          name: "--arg",
          args: [
            { name: "optionarg1" },
            { name: "optionarg2" },
          ],
        },
      ],
    };

    const result = parse(["--arg", "value1", "value2"], spec);

    const wantOptions = makeMap({
      "--arg": ["value1", "value2"],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: action on spec gets returned",
  fn() {
    const action: Spec["action"] = () => {};
    const spec: Spec = {
      name: "test",
      action,
    };
    const result = parse([], spec);
    assertEquals(result.actions, [action]);
  },
});

Deno.test({
  name: "parse: action on subcommand gets returned",
  fn() {
    const specAction: Spec["action"] = () => {};
    const subcommandAction: Spec["action"] = () => {};
    const spec: Spec = {
      name: "test",
      action: specAction,
      subcommands: [{
        name: "example",
        action: subcommandAction,
      }],
    };
    const result = parse(["example"], spec);
    assertEquals(result.actions, [specAction, subcommandAction]);
  },
});

Deno.test({
  name: "parse: action on option is preferred to spec action",
  fn() {
    const specAction: Spec["action"] = () => {};
    const optionAction: Spec["action"] = () => {};
    const spec: Spec = {
      name: "test",
      action: specAction,
      options: [
        {
          name: "--opt",
          action: optionAction,
        },
      ],
    };

    const result = parse(["--opt"], spec);

    assertEquals(result.actions, [specAction]);
    assertEquals(result.optionActions, [optionAction]);
  },
});

Deno.test({
  name: "parse: final option action is preferred",
  fn() {
    const specAction: Spec["action"] = () => {};
    const optionAction: Spec["action"] = () => {};
    const finalAction: Spec["action"] = () => {};
    const spec: Spec = {
      name: "test",
      action: specAction,
      options: [
        {
          name: "--opt",
          action: optionAction,
        },
        {
          name: "--final",
          action: finalAction,
        },
      ],
    };
    const result = parse(["--opt", "--final"], spec);
    assertEquals(result.actions, [specAction]);
    assertEquals(result.optionActions, [optionAction, finalAction]);
  },
});

Deno.test({
  name: "parse: option actions allow incorrect arguments",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        {
          name: "--opt",
          action: () => {},
        },
      ],
      args: {},
    };
    parse(["--opt"], spec);
  },
});

Deno.test({
  name: "parse: option arguments can be separated with an equals",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "--arg", args: { name: "optionarg" } },
      ],
      args: {},
    };

    const result = parse(["--arg=value", "test"], spec);

    const wantOptions = makeMap({ "--arg": ["value"] });
    assertEquals(result.options, wantOptions);

    const wantArgs = ["test"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: option arg separator cannot be used with more than 1 arg",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "--plain", args: {} },
        { name: "--empty", args: {} },
        { name: "--optional", args: [{}, { isOptional: true }] },
        { name: "--variadic", args: { isVariadic: true } },
        { name: "--fail", args: [{}, {}] },
      ],
    };

    const result = parse([
      "--plain=value",
      "--empty=",
      "--optional=value",
      "--variadic=value",
    ], spec);

    const wantOptions = makeMap({
      "--plain": ["value"],
      "--empty": [""],
      "--optional": ["value"],
      "--variadic": ["value"],
    });
    assertEquals(result.options, wantOptions);

    assertThrows(() => {
      parse(["--fail=value"], spec);
    });
  },
});

Deno.test({
  name: "parse: unknown options are rejected",
  fn() {
    const spec: Spec = {
      name: "test",
      args: {},
    };

    assertThrows(() => {
      parse(["-a"], spec);
    });
    assertThrows(() => {
      parse(["-test"], spec);
    });
    assertThrows(() => {
      parse(["--test"], spec);
    });
  },
});

Deno.test({
  name: "parse: '-' is a valid option name",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-", args: {} },
      ],
    };
    const result = parse(["-123"], spec);
    const wantOptions = makeMap({
      "-": ["123"],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: '+' is a valid option name",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "+", args: {} },
      ],
    };
    const result = parse(["+123"], spec);
    const wantOptions = makeMap({
      "+": ["123"],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: '-' option is used if the following character isn't an option",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-", args: {} },
        { name: "-a", args: {} },
      ],
    };

    const result = parse(["-1a"], spec);
    const wantOptions = makeMap({
      "-": ["1a"],
    });
    assertEquals(result.options, wantOptions);

    const result2 = parse(["-a1"], spec);
    const wantOptions2 = makeMap({
      "-a": ["1"],
    });
    assertEquals(result2.options, wantOptions2);
  },
});

Deno.test({
  name: "parse: '+' option is used if the following character isn't an option",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "+", args: {} },
        { name: "+a", args: {} },
      ],
    };

    const result = parse(["+1a"], spec);
    const wantOptions = makeMap({
      "+": ["1a"],
    });
    assertEquals(result.options, wantOptions);

    const result2 = parse(["+a1"], spec);
    const wantOptions2 = makeMap({
      "+a": ["1"],
    });
    assertEquals(result2.options, wantOptions2);
  },
});

Deno.test({
  name: "parse: '+' and '-' are treated as args if they aren't valid options",
  fn() {
    const spec: Spec = {
      name: "test",
      args: [{}, {}],
    };
    const wantArgs = ["-", "+"];
    const result = parse(wantArgs, spec);
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: '+' and '-' are treated as args if there is no argument",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "+", args: {} },
        { name: "-", args: {} },
      ],
      args: [{}, {}],
    };
    const wantArgs = ["-", "+"];
    const result = parse(wantArgs, spec);
    assertEquals(result.args, wantArgs);
    assertEquals(result.options, new Map());
  },
});

Deno.test({
  name: "parse: options starting with '+ can be chained",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "+a" },
        { name: "+b" },
        { name: "+c" },
      ],
    };
    const result = parse(["+abc"], spec);
    const wantOptions = makeMap({
      "+a": [],
      "+b": [],
      "+c": [],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: options starting with a single dash can be chained",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-a" },
        { name: "-b" },
        { name: "-c" },
      ],
    };

    const result = parse(["-abc"], spec);

    const wantOptions = makeMap({
      "-a": [],
      "-b": [],
      "-c": [],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name:
    "parse: chained options can have arguments in the same value with no separator",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-a" },
        { name: "-b", args: {} },
        { name: "-c" },
      ],
    };
    const result = parse(["-abc"], spec);
    const wantOptions = makeMap({
      "-a": [],
      "-b": ["c"],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: chained options ignore separators",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-a" },
        { name: "-b", args: {} },
        { name: "-c" },
      ],
    };
    const result = parse(["-ab=c"], spec);
    const wantOptions = makeMap({
      "-a": [],
      "-b": ["c"],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: chained options can have arguments in the next token",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "-a" },
        { name: "-b", args: {} },
        { name: "-c" },
      ],
    };
    const result = parse(["-ab", "c"], spec);
    const wantOptions = makeMap({
      "-a": [],
      "-b": ["c"],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name:
    "parse: tokens starting with '--' that don't match an option is an error",
  fn() {
    const spec: Spec = {
      name: "test",
      args: {}, // just to make sure that it won't fail because it's an argument
    };
    assertThrows(() => {
      parse(["--fail"], spec);
    });
  },
});

Deno.test({
  name: "parse: POSIX noncompliance disables throwing on unknown options",
  fn() {
    const spec: Spec = {
      name: "test",
      args: {}, // just to make sure that it won't fail because it's an argument
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
    };
    const result = parse(["--succeed"], spec);
    const wantArgs = ["--succeed"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: POSIX-noncompliant options work as expected",
  fn() {
    const spec: Spec = {
      name: "test",
      parserDirectives: {
        flagsArePosixNoncompliant: true,
      },
      options: [
        { name: ["present", "alias"] },
        { name: "missing" },
        { name: ["another", "another-alias"], args: {} },
      ],
    };
    const result = parse(["present", "another=value"], spec);
    const wantOptions = makeMap({
      "present": [],
      "alias": [],
      "another": ["value"],
      "another-alias": ["value"],
    });
    assertEquals(result.options, wantOptions);
  },
});

Deno.test({
  name: "parse: option arguments can have another separator",
  fn() {
    const spec: Spec = {
      name: "test",
      parserDirectives: {
        optionArgSeparators: ":",
      },
      options: [
        { name: "--arg", args: { name: "optionarg" } },
      ],
      args: {},
    };

    const result = parse(["--arg:value", "test"], spec);

    const wantOptions = makeMap({ "--arg": ["value"] });
    assertEquals(result.options, wantOptions);

    const wantArgs = ["test"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: subcommands are optional",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [
        { name: "--arg", args: { name: "optionarg" } },
      ],
      args: {},
      subcommands: [
        { name: "subcommand" },
      ],
    };

    const result = parse(["test"], spec);

    const wantPath: [Spec, ...Subcommand[]] = [spec];
    assertEquals(result.path, wantPath);

    const wantOptions = new Map();
    assertEquals(result.options, wantOptions);

    const wantArgs = ["test"];
    assertEquals(result.args, wantArgs);
  },
});

Deno.test({
  name: "parse: path is correct",
  fn() {
    const two: Subcommand = { name: "two" };
    const one: Subcommand = { name: "one", subcommands: [two] };
    const spec: Spec = {
      name: "test",
      subcommands: [
        one,
      ],
    };

    const result = parse(["one", "two"], spec);

    const wantPath: [Spec, ...Subcommand[]] = [spec, one, two];
    assertEquals(result.path, wantPath);
  },
});

Deno.test({
  name: "parse: subcommands are preferred over arguments",
  fn() {
    const subcommand: Subcommand = { name: "subcommand" };
    const spec: Spec = {
      name: "test",
      subcommands: [subcommand],
      args: {},
    };
    const result = parse(["subcommand"], spec);
    assertEquals(result.path, [spec, subcommand]);
    assertEquals(result.args, []);
  },
});

Deno.test({
  name: "parse: persistent options are carried through into subcommands",
  fn() {
    const subcommand: Subcommand = {
      name: "subcommand",
      options: [{ name: "--sub" }],
    };
    const spec: Spec = {
      name: "test",
      options: [{ name: "--top", isPersistent: true }],
      subcommands: [subcommand],
    };
    const result = parse(["subcommand", "--top"], spec);
    assertEquals(result.path, [spec, subcommand]);
    assertEquals(result.args, []);
  },
});

Deno.test({
  name: "parse: persistent options can be used before a subcommand",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [{ name: "--persistent", isPersistent: true }],
      subcommands: [{ name: "subcommand" }],
    };
    const result = parse(["--persistent", "subcommand"], spec);
    assertEquals(result.options, makeMap({ "--persistent": [] }));
  },
});

Deno.test({
  name: "parse: non-persistent options prevent subcommands from being used",
  fn() {
    const spec: Spec = {
      name: "test",
      options: [{ name: "--not-persistent" }],
      subcommands: [{ name: "subcommand" }],
    };
    // Should fail since the top level command doesn't take an arg
    assertThrows(() => {
      parse(["--not-persistent", "subcommand"], spec);
    });
  },
});

Deno.test({
  name: "parse: '--' token causes all tokens after it to become args",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [
        { name: "--one" },
        { name: "--two" },
      ],
      args: [{}, {}],
      subcommands: [{
        name: "subcommand",
        options: [
          { name: "--yes" },
        ],
      }],
    };
    const result1 = parse(["--one", "--", "--two", "--"], spec);
    assertEquals(result1.options, makeMap({ "--one": [] }));
    assertEquals(result1.args, ["--two", "--"]);
    const result2 = parse(["--one", "--", "subcommand", "--yes"], spec);
    assertEquals(result2.options, makeMap({ "--one": [] }));
    assertEquals(result2.args, ["subcommand", "--yes"]);
  },
});

Deno.test({
  name: "parse: '--' fails with too few arguments",
  fn() {
    const spec: Spec = {
      name: "command",
      args: [{}, { isOptional: true }],
    };
    assertThrows(() => {
      parse(["--"], spec);
    });
  },
});

Deno.test({
  name: "parse: '--' fails with too many arguments",
  fn() {
    const spec: Spec = {
      name: "command",
      args: [{}, { isOptional: true }],
    };
    assertThrows(() => {
      parse(["--", "arg", "arg", "arg"], spec);
    });
  },
});

Deno.test({
  name: "parse: '--' cannot be provided after all the arguments",
  fn() {
    const spec: Spec = {
      name: "command",
      args: {},
    };
    assertThrows(() => {
      parse(["arg", "--"], spec);
    });
    // Also want to validate that it doesn't work if the
    // command takes no arguments
    assertThrows(() => {
      parse(["--"], { name: "command" });
    });
  },
});

Deno.test({
  name: "parse: non-repeatable options cannot be repeated",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{ name: "--normal" }],
    };
    assertThrows(() => {
      parse(["--normal", "--normal"], spec);
    });
  },
});

Deno.test({
  name: "parse: repeatable options definitely have one item in the array",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{ name: ["-r", "--rep"], isRepeatable: true }],
    };
    const result1 = parse(["--rep"], spec);
    assertEquals(
      result1.options,
      makeMap({
        "--rep": [""],
        "-r": [""],
      }),
    );
  },
});

Deno.test({
  name: "parse: infinitely repeatable options work",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{ name: ["-r", "--rep"], isRepeatable: true }],
    };
    const result1 = parse(["--rep", "--rep", "--rep", "--rep"], spec);
    assertEquals(
      result1.options,
      makeMap({
        "--rep": ["", "", "", ""],
        "-r": ["", "", "", ""],
      }),
    );
    const result2 = parse(["-rrrr"], spec);
    assertEquals(
      result2.options,
      makeMap({
        "--rep": ["", "", "", ""],
        "-r": ["", "", "", ""],
      }),
    );
  },
});

Deno.test({
  name: "parse: finite repeatable options work",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{ name: ["-r", "--rep"], isRepeatable: 2 }],
    };
    const result1 = parse(["--rep", "--rep"], spec);
    assertEquals(
      result1.options,
      makeMap({
        "--rep": ["", ""],
        "-r": ["", ""],
      }),
    );
    const result2 = parse(["-rr"], spec);
    assertEquals(
      result2.options,
      makeMap({
        "--rep": ["", ""],
        "-r": ["", ""],
      }),
    );
    assertThrows(() => {
      parse(["--rep", "--rep", "--rep"], spec);
    });
    assertThrows(() => {
      parse(["-rrr"], spec);
    });
  },
});

Deno.test({
  name: "parse: requiresSeparator is true",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{ name: "--sep", requiresSeparator: true, args: {} }],
      args: { isOptional: true },
    };
    const result1 = parse(["--sep=val"], spec);
    assertEquals(
      result1.options,
      makeMap({
        "--sep": ["val"],
      }),
    );
    assertThrows(() => {
      parse(["--sep", "val"], spec);
    });
  },
});

Deno.test({
  name: "parse: requiresSeparator with optional argument",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{
        name: "--sep",
        requiresSeparator: true,
        args: { isOptional: true },
      }],
      args: { isOptional: true },
    };

    const result1 = parse(["--sep=val", "val"], spec);
    assertEquals(
      result1.options,
      makeMap({
        "--sep": ["val"],
      }),
    );
    assertEquals(result1.args, ["val"]);

    const result2 = parse(["--sep", "val"], spec);
    assertEquals(
      result2.options,
      makeMap({
        "--sep": [],
      }),
    );
    assertEquals(result2.args, ["val"]);
  },
});

Deno.test({
  name: "parse: requiresSeparator with optional argument and following option",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{
        name: "--sep",
        requiresSeparator: true,
        args: { isOptional: true },
      }, {
        name: "--example",
      }],
      args: { isOptional: true },
    };
    const result = parse(["--sep", "--example"], spec);
    assertEquals(
      result.options,
      makeMap({
        "--sep": [],
        "--example": [],
      }),
    );
  },
});

Deno.test({
  name:
    "parse: requiresSeparator with optional argument and following subcommand",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{
        name: "--sep",
        requiresSeparator: true,
        isPersistent: true,
        args: { isOptional: true },
      }],
      subcommands: [
        { name: "example" },
      ],
      args: { isOptional: true },
    };
    const result = parse(["--sep", "example"], spec);
    assertEquals(
      result.options,
      makeMap({
        "--sep": [],
      }),
    );
    assertEquals(result.path, [spec, spec.subcommands![0]]);
  },
});

Deno.test({
  name: "parse: requiresSeparator with variadic argument",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{
        name: "--sep",
        requiresSeparator: true,
        args: { isVariadic: true },
      }],
      args: { isOptional: true },
    };
    const result = parse(["--sep=val", "val"], spec);
    assertEquals(
      result.options,
      makeMap({
        "--sep": ["val"],
      }),
    );
    assertEquals(result.args, ["val"]);
  },
});

Deno.test({
  name: "parse: requiresSeparator is the correct string",
  fn() {
    const spec: Spec = {
      name: "command",
      parserDirectives: {
        optionArgSeparators: ["=", ":"],
      },
      options: [{ name: "--sep", requiresSeparator: ":", args: {} }],
    };
    const result = parse(["--sep:val"], spec);
    assertEquals(
      result.options,
      makeMap({
        "--sep": ["val"],
      }),
    );
    assertThrows(() => {
      parse(["--sep=val"], spec);
    });
  },
});

Deno.test({
  name: "parse: requiresSeparator option with following subcommand",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [{
        name: "--sep",
        requiresSeparator: true,
        isPersistent: true,
        args: {},
      }],
      subcommands: [{ name: "test" }],
    };
    assertThrows(() => {
      parse(["--sep", "test"], spec);
    });
  },
});

Deno.test({
  name: "parse: exclusiveOn, unidirectional",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [
        { name: "-a", exclusiveOn: ["-b"] },
        { name: "-b" },
      ],
    };
    parse(["-a"], spec);
    parse(["-b"], spec);
    assertThrows(() => {
      parse(["-ab"], spec);
    });
    assertThrows(() => {
      parse(["-a", "-b"], spec);
    });
    assertThrows(() => {
      parse(["-b", "-a"], spec);
    });
  },
});

Deno.test({
  name: "parse: exclusiveOn, bidirectional",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [
        { name: "-a", exclusiveOn: ["-b"] },
        { name: "-b", exclusiveOn: ["-a"] },
      ],
    };
    parse(["-a"], spec);
    parse(["-b"], spec);
    assertThrows(() => {
      parse(["-ab"], spec);
    });
    assertThrows(() => {
      parse(["-a", "-b"], spec);
    });
    assertThrows(() => {
      parse(["-b", "-a"], spec);
    });
  },
});

Deno.test({
  name: "parse: dependsOn, unidirectional",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [
        { name: "-a", dependsOn: ["-b"] },
        { name: "-b" },
      ],
    };
    assertThrows(() => {
      parse(["-a"], spec);
    });
    parse(["-b"], spec);
    parse(["-ab"], spec);
    parse(["-a", "-b"], spec);
    parse(["-b", "-a"], spec);
  },
});

Deno.test({
  name: "parse: dependsOn, bidirectional",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [
        { name: "-a", dependsOn: ["-b"] },
        { name: "-b", dependsOn: ["-a"] },
      ],
    };
    assertThrows(() => {
      parse(["-a"], spec);
    });
    assertThrows(() => {
      parse(["-b"], spec);
    });
    parse(["-ab"], spec);
    parse(["-a", "-b"], spec);
  },
});

Deno.test({
  name: "parse: requiresSubcommand is equivalent to usage",
  fn() {
    const spec: Spec = {
      name: "command",
      requiresSubcommand: true,
    };
    const result = parse([], spec);
    assertEquals(result.actions, [usage]);
  },
});

Deno.test({
  name:
    "parse: requiresSubcommand doesn't return Fig.usage when there is an action",
  fn() {
    const action = () => {};
    const spec: Spec = {
      name: "command",
      requiresSubcommand: true,
      action,
    };
    const result = parse([], spec);
    assertEquals(result.actions, [action]);
  },
});

Deno.test({
  name: "parse: Option.isRequired throws when not provided",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [
        { name: "--angry", isRequired: true },
      ],
    };
    assertThrows(() => {
      parse([], spec);
    });
    parse(["--angry"], spec);
  },
});

Deno.test({
  name: "parse: Option.isRequired works when persistent",
  fn() {
    const spec: Spec = {
      name: "command",
      options: [
        { name: "--angry", isRequired: true, isPersistent: true },
      ],
      subcommands: [
        { name: "cmd" },
      ],
    };
    assertThrows(() => {
      parse(["cmd"], spec);
    });
    parse(["cmd", "--angry"], spec);
  },
});

Deno.test({
  name: "parse: Option.isRequired on subcommands",
  fn() {
    const spec: Spec = {
      name: "command",
      subcommands: [
        {
          name: "cmd",
          options: [
            { name: "--angry", isRequired: true, isPersistent: true },
          ],
        },
      ],
    };
    parse([], spec);
    assertThrows(() => {
      parse(["cmd"], spec);
    });
    parse(["cmd", "--angry"], spec);
  },
});
