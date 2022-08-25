import { findGenerator } from "./completion.ts";
import { assertEquals, assertThrows } from "./deps/std_testing_asserts.ts";

Deno.test("completion: findGenerator", () => {
  const invalidSyntax = [
    "",
    ":",
    ":,",
    ",",
    "2",
    ":2",
    "2:",
    "j",
    "g",
  ];
  for (const path of invalidSyntax) {
    assertThrows(() => {
      findGenerator(path, {
        name: "test",
      });
    });
  }
  findGenerator("a:0,g:0", {
    name: "test",
    args: {
      name: "arg",
      generators: {},
    },
  });
  assertThrows(() => {
    findGenerator("a:0,g:0", {
      name: "test",
      args: {
        name: "arg",
      },
    });
  });
  const gen = {};
  assertEquals(
    findGenerator("o:1,a:1,g:1", {
      name: "test",
      options: [
        { name: "0" },
        {
          name: "1",
          args: [
            {},
            { generators: [{}, gen] },
          ],
        },
      ],
    }),
    gen,
  );
  assertThrows(() => {
    findGenerator("o:1,a:1,g:1", {
      name: "test",
      options: [
        { name: "0" },
        {
          name: "1",
          args: [
            {},
            { generators: {} },
          ],
        },
      ],
    });
  });
});
