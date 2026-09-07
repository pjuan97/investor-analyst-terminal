/**
 * Serializes Prisma results into plain JSON-safe values.
 *
 * Prisma returns `BigInt` (e.g. `PriceDaily.volume`) and `Decimal` values that
 * `JSON.stringify` cannot handle on its own: BigInt throws
 * `TypeError: Do not know how to serialize a BigInt`. Run any Prisma payload
 * through this helper before handing it to `NextResponse.json()` or passing it
 * from a Server Component to a Client Component.
 *
 * BigInt and Decimal both come out as strings, so read them back with
 * `Number(...)` / `parseFloat(...)` on the consumer side.
 */
export function serialize<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}
