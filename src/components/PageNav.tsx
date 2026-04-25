import Link from "next/link";

export type PageNavSlug =
  | "about"
  | "history"
  | "DevHelp"
  | "projectplan"
  | "how-it-works";

const PAGES: { slug: PageNavSlug; href: string; label: string }[] = [
  { slug: "projectplan", href: "/projectplan", label: "Project plan" },
  { slug: "how-it-works", href: "/how-it-works", label: "How it works" },
  { slug: "DevHelp", href: "/DevHelp", label: "Bucket A & B" },
  { slug: "history", href: "/history", label: "Build history" },
  { slug: "about", href: "/about", label: "About / pitch" },
];

export function PageNav({ current }: { current?: PageNavSlug }) {
  return (
    <nav
      aria-label="Planning pages"
      className="mb-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
    >
      <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Quick links
      </span>
      {PAGES.map((p) => {
        const active = p.slug === current;
        return (
          <Link
            key={p.slug}
            href={p.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                : "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-teal-300 hover:text-teal-700"
            }
          >
            {p.label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="ml-auto inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
      >
        Manager dashboard →
      </Link>
    </nav>
  );
}
