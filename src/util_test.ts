import { assertEquals } from "../deps/std_testing_asserts.ts";
import { makeArray, makeArray1 } from "./util.ts";

Deno.test({
  name: "makeArray transforms input to arrays",
  fn() {
    assertEquals(makeArray(undefined), []);
    assertEquals(makeArray([]), []);
    assertEquals(makeArray(1), [1]);
    assertEquals(makeArray([1]), [1]);
  },
});

Deno.test({
  name: "makeArray1 transforms input to arrays",
  fn() {
    assertEquals(makeArray1(1), [1]);
    assertEquals(makeArray1([1]), [1]);
  },
});
