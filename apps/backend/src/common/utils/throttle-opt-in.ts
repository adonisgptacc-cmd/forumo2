import type { ExecutionContext } from "@nestjs/common";

// Same key @nestjs/throttler's @Throttle() writes (not exported by the package).
const THROTTLER_LIMIT = "THROTTLER:LIMIT";

/**
 * @nestjs/throttler applies every named throttler to every route, so a route
 * that only wants `auth-resend` (3/hour) would still be counted against it -
 * and every other route would be too. Use as a throttler's `skipIf` so it
 * applies only where a handler/controller opts in with `@Throttle({ name: {} })`.
 */
export const skipUnlessOptedIn =
  (name: string) =>
  (context: ExecutionContext): boolean => {
    const key = THROTTLER_LIMIT + name;
    return !(
      Reflect.hasMetadata(key, context.getHandler()) ||
      Reflect.hasMetadata(key, context.getClass())
    );
  };
