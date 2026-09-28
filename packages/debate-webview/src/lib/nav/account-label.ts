/**
 * @fileoverview How the app dock's Settings menu names the signed-in user.
 *
 * The menu used to print the whole address under the name. It is the longest
 * string in the panel by some distance, and the panel is what a phone opens
 * the nav submenus *out of* — every pixel it takes is a pixel those submenus
 * do not have to open into, which is what left them running off the edge of
 * the screen. One line, and the address on hover, is enough to say who is
 * signed in.
 *
 * @module lib/nav/account-label
 */

/**
 * The part of an address before the `@` — what stands in for a name on an
 * account that carries none.
 *
 * @param email - The signed-in address, when there is one.
 * @returns E.g. `"alex91gul"` for `"alex91gul@gmail.com"`; `""` when absent.
 *   An address with nothing before the `@` is returned whole, since a bare
 *   `"@example.com"` names nobody.
 */
export function accountHandle(email: string | null | undefined): string {
  const address = email?.trim() ?? "";
  const at = address.indexOf("@");
  return at > 0 ? address.slice(0, at) : address;
}

/**
 * The one line the menu shows for the signed-in user.
 *
 * @param user - Name and address, either of which may be missing.
 * @returns The name, else the address's handle, else `"Signed in"`.
 */
export function accountLabel(user: {
  name?: string | null;
  email?: string | null;
}): string {
  return user.name?.trim() || accountHandle(user.email) || "Signed in";
}
