/* ============================================================
   DarkPrint core — canonical JSON
   One value, exactly one serialization, so that two cards that
   say the same thing collapse onto the same hash (design doc §4,
   "deduplicazione gratuita"). RFC-8785 in spirit. Engine spec §6.
   ============================================================ */

/** Code-unit order, the ordering RFC 8785 prescribes — never `localeCompare`, which is host dependent. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Where a failure happened, for the thrown message: `<root>` at the top, "params.retries" inside. */
function describePath(path: string): string {
  return path === "" ? "<root>" : path;
}

function child(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function isObjectLike(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/** `undefined`, functions and symbols have no JSON form; in a value position they become null. */
function isSkippable(value: unknown): boolean {
  return value === undefined || typeof value === "function" || typeof value === "symbol";
}

/**
 * Serialize a number the way JSON can read back. `String` already produces the
 * shortest round-tripping form (ES Number::toString), and it renders -0 as "0",
 * which is the normalization we want: -0 and 0 must never hash differently.
 */
function serializeNumber(value: number, path: string): string {
  if (!Number.isFinite(value)) {
    // A programmer error, not user data: NaN/Infinity have no JSON form at all.
    throw new Error(
      `canonicalJson: ${String(value)} has no JSON representation (at ${describePath(path)})`,
    );
  }
  return value === 0 ? "0" : String(value);
}

/** JSON.stringify owns string escaping — deterministic, and well-formed (lone surrogates escaped). */
function serializeString(value: string): string {
  return JSON.stringify(value);
}

/** Honour `toJSON` exactly as `JSON.stringify` would, so a Date in `params` serializes sensibly. */
function unwrap(value: object): unknown {
  if (!("toJSON" in value)) return value;
  const toJson: unknown = Reflect.get(value, "toJSON");
  if (typeof toJson !== "function") return value;
  const replaced: unknown = toJson.call(value);
  return replaced;
}

/**
 * How many `toJSON` replacements to follow before giving up. One is the normal case
 * (Date); a value that keeps replacing itself would otherwise loop forever.
 */
const MAX_TOJSON_CHAIN = 64;

/** Follow `toJSON` until the value stops replacing itself, exactly as JSON.stringify does. */
function unwrapAll(value: unknown, path: string): unknown {
  let current = value;
  for (let i = 0; i < MAX_TOJSON_CHAIN; i += 1) {
    if (!isObjectLike(current)) return current;
    const replaced = unwrap(current);
    if (replaced === current) return current;
    current = replaced;
  }
  throw new Error(
    `canonicalJson: \`toJSON\` never settles on a plain value (at ${describePath(path)})`,
  );
}

/** A value is either finished text or a container the walk has to descend into. */
type Encoded = { readonly text: string } | { readonly container: object };

/** Everything that can be decided without looking inside the value. */
function encode(raw: unknown, path: string): Encoded {
  const value = unwrapAll(raw, path);
  if (value === null || isSkippable(value)) return { text: "null" };
  if (typeof value === "boolean") return { text: value ? "true" : "false" };
  if (typeof value === "number") return { text: serializeNumber(value, path) };
  if (typeof value === "string") return { text: serializeString(value) };
  if (typeof value === "bigint") {
    // Deliberately not stringified: a bigint cannot survive a JSON round-trip, so
    // accepting it would make the digest lie about what it hashed.
    throw new Error(
      `canonicalJson: bigint has no JSON representation (at ${describePath(path)})`,
    );
  }
  if (!isObjectLike(value)) {
    // Unreachable: every other `typeof` was handled above or by isSkippable.
    throw new Error(`canonicalJson: unsupported value of type ${typeof value}`);
  }
  return { container: value };
}

/** One container the walk has opened but not yet closed. */
type Frame =
  | {
      readonly kind: "array";
      readonly node: object;
      readonly path: string;
      readonly items: readonly unknown[];
      index: number;
      readonly parts: string[];
    }
  | {
      readonly kind: "object";
      readonly node: object;
      readonly path: string;
      readonly keys: readonly string[];
      index: number;
      readonly parts: string[];
      /** The key whose value is currently being serialized. */
      pendingKey: string;
    };

/**
 * Depth-first walk with an explicit stack rather than recursion: `params` is user data
 * and JSON nests deeper than the JS stack of either host does. Depth costs heap here.
 */
function serialize(root: unknown): string {
  const stack: Frame[] = [];
  /** The containers on `stack`, for O(1) cycle detection — scanning it would be quadratic. */
  const open = new Set<object>();
  let finished: string | undefined;

  /** Hand a completed value to the container that asked for it, or to the caller. */
  const deliver = (text: string): void => {
    const top = stack[stack.length - 1];
    if (top === undefined) {
      finished = text;
      return;
    }
    if (top.kind === "object") top.parts.push(`${serializeString(top.pendingKey)}:${text}`);
    else top.parts.push(text);
  };

  /** Either finish the value outright, or open a frame for its members. */
  const request = (raw: unknown, path: string): void => {
    const encoded = encode(raw, path);
    if ("text" in encoded) {
      deliver(encoded.text);
      return;
    }
    const node = encoded.container;
    if (open.has(node)) {
      throw new Error(`canonicalJson: circular reference (at ${describePath(path)})`);
    }
    open.add(node);
    stack.push(
      Array.isArray(node)
        ? { kind: "array", node, path, items: node, index: 0, parts: [] }
        : {
            kind: "object",
            node,
            path,
            keys: Object.keys(node).sort(byCodeUnit),
            index: 0,
            parts: [],
            pendingKey: "",
          },
    );
  };

  request(root, "");
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top.kind === "array") {
      if (top.index < top.items.length) {
        const index = top.index;
        top.index += 1;
        // Indexed, not `for..of`: a hole must serialize as null, exactly like JSON.stringify.
        request(top.items[index], child(top.path, String(index)));
        continue;
      }
      stack.pop();
      // Only siblings sharing a node are fine, so a node stops being "open" as soon as
      // it closes: a repeated but acyclic reference is not a cycle.
      open.delete(top.node);
      deliver(`[${top.parts.join(",")}]`);
      continue;
    }
    if (top.index < top.keys.length) {
      const key = top.keys[top.index];
      top.index += 1;
      const member: unknown = Reflect.get(top.node, key);
      // A property with no JSON form is dropped, not nulled — the opposite of the
      // array rule, and again what JSON.stringify does.
      if (isSkippable(member)) continue;
      top.pendingKey = key;
      request(member, child(top.path, key));
      continue;
    }
    stack.pop();
    open.delete(top.node);
    deliver(`{${top.parts.join(",")}}`);
  }

  if (finished === undefined) {
    // Impossible: the walk delivers exactly one value to the empty stack.
    throw new Error("canonicalJson: nothing was serialized");
  }
  return finished;
}

/**
 * Deterministic JSON: object keys sorted by code unit, no whitespace, `undefined`
 * properties dropped, `undefined` and holes inside arrays nulled, -0 normalized to 0.
 *
 * Throws on values that have no JSON form at all — non-finite numbers, bigints,
 * circular references. Those are programmer errors (a card's `params` is typed
 * `JsonValue`), never user data, so a Diagnostic would only hide the bug. Nesting
 * depth is not among them: the walk is iterative and bounded only by memory.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}
