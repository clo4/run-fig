import { assertEquals } from "../deps/std_testing_asserts.ts";
import { execute } from "./run.ts";

Deno.test({
  name: "run: return 1 with no action",
  async fn() {
    const out = await execute({ name: "test" }, []);
    assertEquals(out, 1);
  },
});

Deno.test({
  name: "run: return action result",
  async fn() {
    for (const result of [0, 1, 2, 3]) {
      const out = await execute({
        name: "test",
        action() {
          return result;
        },
      }, []);
      assertEquals(out, result);
    }
  },
});

Deno.test({
  name: "run: use deepest subcommand",
  async fn() {
    const out = await execute({
      name: "test",
      action: () => 0,
      subcommands: [{
        name: "1",
        action: () => 1,
        subcommands: [{
          name: "2",
          action: () => 2,
        }],
      }],
    }, ["1", "2"]);
    assertEquals(out, 2);
  },
});

Deno.test({
  name: "run: prefer first option action",
  async fn() {
    const out = await execute({
      name: "test",
      action: () => 0,
      options: [
        { name: "--alpha", isPersistent: true, action: () => 123 },
        { name: "--beta", isPersistent: true, action: () => 234 },
      ],
      subcommands: [{
        name: "1",
        action: () => 1,
        subcommands: [{
          name: "2",
          action: () => 2,
          options: [
            { name: "--test", action: () => 210 },
          ],
        }],
      }],
    }, ["1", "--beta", "2", "--test", "--alpha"]);
    assertEquals(out, 123);
  },
});
