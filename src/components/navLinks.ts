/**
 * One list for the desktop nav and the offcanvas (spec app-header.md §3.1):
 * adding a link is one line and the two lists cannot drift. Home is only in
 * the offcanvas; on desktop the logo is the home link. About is not a nav
 * link: it lives in the footer and the user menu.
 */
export interface NavLinkDef {
  to: "/" | "/songs" | "/setlists" | "/shows" | "/rehearsals" | "/requests";
  labelKey: string;
  /** Bootstrap icon class, rendered in the offcanvas only. */
  icon: string;
  match: "exact" | "prefix";
  offcanvasOnly?: boolean;
}

export const NAV_LINKS: readonly NavLinkDef[] = [
  { to: "/", labelKey: "nav.home", icon: "bi-house-door", match: "exact", offcanvasOnly: true },
  { to: "/songs", labelKey: "nav.songs", icon: "bi-music-note-list", match: "prefix" },
  { to: "/setlists", labelKey: "nav.setlists", icon: "bi-collection", match: "prefix" },
  { to: "/shows", labelKey: "nav.shows", icon: "bi-calendar-event", match: "prefix" },
  { to: "/rehearsals", labelKey: "nav.rehearsals", icon: "bi-calendar-check", match: "prefix" },
  { to: "/requests", labelKey: "nav.requests", icon: "bi-lightbulb", match: "prefix" },
];

/** The one place the active rule lives: exact for `/`, prefix for sections. */
export function isNavLinkActive(link: NavLinkDef, pathname: string): boolean {
  return link.match === "exact" ? pathname === link.to : pathname.startsWith(link.to);
}
