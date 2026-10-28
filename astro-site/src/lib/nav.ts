// The site's top-level destinations. The menu overlay and the bottom chapter nav both read this
// so they cannot drift apart. Voyages (collections) live only in the menu, as a secondary group.
/** Destinations drawn as a mark instead of their name (components/NavLabel.astro). */
export type NavIcon = "infinity" | "minidv";
export const NAV_ITEMS: readonly { label: string; href: string; icon?: NavIcon }[] = [
  { label: "Home", href: "/" },
  { label: "Places", href: "/places" },
  { label: "Years", href: "/years" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
  // An endless scroll of photographs over the Infinite Azure loop and music: drawn as the ∞ mark, not spelled out.
  { label: "Infinite Azure", href: "/infinite-azure", icon: "infinity" },
  // A desk, a drawer of Mini DV tapes and the Sony deck that plays them: drawn as a tape, not spelled out.
  { label: "Mini DV", href: "/mini-dv", icon: "minidv" },
];

export const isHere = (href: string, pathname: string) => {
  const here = pathname.replace(/\/$/, "") || "/";
  return href === "/" ? here === "/" : here === href || here.startsWith(`${href}/`);
};
