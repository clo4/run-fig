import { getHelp, usage } from "./help.ts";
import { Spec } from "./types.ts";
import { assert } from "../deps/std_testing_asserts.ts";

/** An object that `includes` objects of type `T` (eg. string, array) */
interface Includer<T> {
  includes(item: T): boolean;
}

/** Assert that an object is included */
function assertIncludes<T>(includer: Includer<T>, included: T): void {
  assert(
    includer.includes(included),
    `Expected to find ${JSON.stringify(included)}`,
  );
}

/** Assert that an object is not included */
function assertNotIncludes<T>(includer: Includer<T>, notIncluded: T): void {
  assert(
    !includer.includes(notIncluded),
    `Found ${JSON.stringify(notIncluded)}`,
  );
}

Deno.test({
  name: "help: no path, no subcommands",
  fn() {
    const spec: Spec = {
      name: "TEST_NAME",
      description: "019283",
      options: [
        {
          name: ["-o", "--option"],
          description: "112233",
        },
        {
          name: ["--long-first", "--shorter", "-s"],
          description: "998877",
        },
      ],
    };
    const msg = getHelp([spec]);
    assert(msg.startsWith("019283"));
    assertIncludes(msg, "TEST_NAME [flags]\n");
    assertIncludes(msg, "-o, --option");
    assertIncludes(msg, "112233");
    assertIncludes(msg, "-s, --shorter, --long-first");
    assertIncludes(msg, "998877");
  },
});

Deno.test({
  name: "help: no path, with subcommands",
  fn() {
    const spec: Spec = {
      name: "TEST_NAME",
      options: [
        {
          name: ["-o", "--option"],
          description: "112233",
        },
      ],
      subcommands: [
        { name: "unique-name", description: "98765" },
        { name: "very-good", description: "12345" },
      ],
    };
    const msg = getHelp([spec]);
    assert(msg.startsWith("Usage:\n"));
    assertIncludes(msg, "\n  TEST_NAME [flags]\n");
    assertIncludes(msg, "\nCommands:\n");
    assertIncludes(msg, "unique-name");
    assertIncludes(msg, "98765");
    assertIncludes(msg, "very-good");
    assertIncludes(msg, "12345");
  },
});

Deno.test({
  name: "help: no path, with subcommands, requires subcommand",
  fn() {
    const spec: Spec = {
      name: "TEST_NAME",
      requiresSubcommand: true,
      options: [
        {
          name: ["-o", "--option"],
          description: "112233",
        },
      ],
      subcommands: [
        { name: "unique-name", description: "98765" },
        { name: "very-good", description: "12345" },
      ],
    };
    const msg = getHelp([spec]);
    assert(msg.startsWith("Usage:\n"));
    assertIncludes(msg, "TEST_NAME [flags] <command>");
    assertIncludes(msg, "\nCommands:\n");
    assertIncludes(msg, "unique-name");
    assertIncludes(msg, "98765");
    assertIncludes(msg, "very-good");
    assertIncludes(msg, "12345");
  },
});

Deno.test({
  name: "help: path with persistent options",
  fn() {
    const spec: Spec = {
      name: "TEST_NAME",
      action: usage,
      options: [
        {
          name: ["-o", "--option"],
          description: "112233",
          isPersistent: true,
        },
      ],
      subcommands: [
        {
          name: "unique-name",
          description: "98765",
          options: [{ name: "--silent", description: "888888" }],
        },
        {
          name: "very-good",
          description: "12345",
          options: [{ name: "--not-here", description: "DO NOT INCLUDE" }],
        },
      ],
    };
    const msg = getHelp([spec, spec.subcommands![0]]);
    assertIncludes(msg, "TEST_NAME unique-name");
    assertIncludes(msg, "\nFlags:\n");
    assertIncludes(msg, "\nGlobal flags:\n");
    //assertIncludes(msg, "Persistent flags:\n");
    assertIncludes(msg, "-o, --option");
    assertIncludes(msg, "112233");
    assertIncludes(msg, "--silent");
    assertIncludes(msg, "888888");
    assertNotIncludes(msg, "--not-here");
    assertNotIncludes(msg, "DO NOT INCLUDE");
  },
});

Deno.test({
  name: "help: path with persistent options and no option on command",
  fn() {
    const spec: Spec = {
      name: "TEST_NAME",
      action: usage,
      options: [{
        name: ["-o", "--option"],
        description: "112233",
        isPersistent: true,
      }],
      subcommands: [{
        name: "unique-name",
        description: "98765",
      }],
    };
    const msg = getHelp([spec, spec.subcommands![0]]);
    assertIncludes(msg, "TEST_NAME unique-name");
    assertNotIncludes(msg, "\nFlags:\n");
    assertIncludes(msg, "\nGlobal flags:\n");
    assertIncludes(msg, "-o, --option");
    assertIncludes(msg, "112233");
    assert(msg.indexOf("\nGlobal flags:\n") < msg.indexOf("-o, --option"));
  },
});
