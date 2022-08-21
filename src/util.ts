import type { NonEmptyArray } from "./types.ts";

export function isArray<T>(o: T | readonly T[]): o is readonly T[] {
  return Array.isArray(o)
}

/** Convert the value, if any, to an array with 0 or more elements */
export function makeArray<T>(thing: T | readonly T[] | undefined): T[] {
  if (thing === undefined) return [];
  if (isArray(thing)) {
    return thing.slice();
  }
  return [thing];
}

/** Convert the value to an array with at least one element */
export function makeArray1<T>(thing: T | NonEmptyArray<T>): [T, ...T[]] {
  if (isArray(thing)) {
    // We know that this array has at least one element in it
    return thing.slice() as [T, ...T[]];
  }
  return [thing];
}

/** Set many keys in a Map to the same value */
export function setEach<K, V>(
  map: Map<K, V>,
  keys: K | readonly K[],
  value: V,
): void {
  if (isArray(keys)) {
    for (const key of keys) {
      map.set(key, value);
    }
  } else {
    map.set(keys, value);
  }
}

export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new Error(msg);
  }
}

export function error(...strings: unknown[]): void {
  console.error("%cError:", "color: red", ...strings);
}
