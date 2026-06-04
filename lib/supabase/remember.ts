// "Remember me" cookie persistence.
// When the user opts out of "remember me", their Supabase auth cookies (the
// chunked `sb-*` cookies) are written WITHOUT maxAge/expires, making them
// session cookies that the browser clears on close. All other cookies, and the
// persistent case, are left untouched.

type CookieOptions = Record<string, unknown> & { maxAge?: number; expires?: Date };

export function sessionPersist<T extends CookieOptions | undefined>(
  name: string,
  options: T,
  sessionOnly: boolean,
): T {
  if (!sessionOnly || !name.startsWith("sb-")) return options;
  return { ...(options ?? {}), maxAge: undefined, expires: undefined } as T;
}
