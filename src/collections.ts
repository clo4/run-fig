import type { NonEmptyArray } from "./types.ts";

/**
 * Check if the value is an array, and act as a type guard.
 */
export function isArray<T>(thing: T | readonly T[]): thing is readonly T[] {
  return Array.isArray(thing);
}

/**
 * Convert the value, if any, to an array with 0 or more elements
 *
 * If the input is an array, it will be shallow-cloned to allow mutation.
 */
export function makeArray<T>(thing: T | readonly T[] | undefined): T[] {
  if (thing === undefined) return [];
  if (isArray(thing)) {
    return thing.slice();
  }
  return [thing];
}

/**
 * Convert the value to an array with at least one element
 *
 * If the input is an array, it will be shallow-cloned to allow mutation.
 */
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
