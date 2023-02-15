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
 * 
 * TODO: Rename this to `copyAsArray` or something like that.
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
 */
export function makeArray1<T>(thing: T | NonEmptyArray<T>): NonEmptyArray<T> {
  if (isArray(thing)) {
    return thing;
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
