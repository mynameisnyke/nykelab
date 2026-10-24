// The site's top-level destinations. The menu overlay and the bottom chapter nav both read this
// so they cannot drift apart. Voyages (collections) live only in the menu, as a secondary group.
export const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Places", href: "/places" },
  { label: "Years", href: "/years" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
] as const;

export const isHere = (href: string, pathname: string) => {
  const here = pathname.replace(/\/$/, "") || "/";
  return href === "/" ? here === "/" : here === href || here.startsWith(`${href}/`);
};
