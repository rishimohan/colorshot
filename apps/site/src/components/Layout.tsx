import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { FLAT_NAV, GITHUB_URL, NAV, ORSHOT_URL } from "../nav";
import { useTheme, type ThemePref } from "../lib/theme";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Colorshot home">
      <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3E5CEB" />
            <stop offset=".6" stopColor="#F97316" />
            <stop offset="1" stopColor="#FDE68A" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
        <circle cx="16" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.5" />
      </svg>
      <span>Colorshot</span>
    </Link>
  );
}

const THEME_ICONS: Record<ThemePref, ReactNode> = {
  system: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 13.75h5M8 11v2.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
};

function ThemeSwitch() {
  const { pref, setPref } = useTheme();
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Theme">
      {(["system", "light", "dark"] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={pref === p}
          aria-label={`${p[0].toUpperCase()}${p.slice(1)} theme`}
          title={`${p[0].toUpperCase()}${p.slice(1)} theme`}
          onClick={() => setPref(p)}
        >
          {THEME_ICONS[p]}
        </button>
      ))}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export function Header({ onMenu, menuOpen }: { onMenu?: () => void; menuOpen?: boolean }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        {onMenu && (
          <button type="button" className="menu-btn" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={onMenu}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              {menuOpen ? (
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        )}
        <Logo />
        <a className="by-orshot" href={ORSHOT_URL} target="_blank" rel="noreferrer">
          by Orshot
        </a>
        <nav className="header-nav" aria-label="Main">
          <NavLink to="/docs/getting-started" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Docs
          </NavLink>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="icon-link" aria-label="GitHub">
            <GitHubIcon />
          </a>
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p>
          Colorshot is open source under the MIT license. Built by{" "}
          <a href={ORSHOT_URL} target="_blank" rel="noreferrer">
            Orshot
          </a>
          , the API for automated image, PDF and video generation.
        </p>
        <nav aria-label="Footer">
          <Link to="/docs/getting-started">Docs</Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={ORSHOT_URL} target="_blank" rel="noreferrer">
            orshot.com
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** Scroll to the top on page change, or to the #hash target when there is one. */
export function useScrollRestore() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
}

export function SiteLayout() {
  useScrollRestore();
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="sidebar-nav" aria-label="Docs">
      {NAV.map((group) => (
        <div key={group.title} className="nav-group">
          <p className="nav-group-title">{group.title}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.slug}>
                <NavLink to={`/docs/${item.slug}`} onClick={onNavigate} className={({ isActive }) => (isActive ? "active" : undefined)}>
                  {item.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsLayout() {
  useScrollRestore();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const slug = pathname.split("/")[2] ?? "";
  const index = FLAT_NAV.findIndex((n) => n.slug === slug);
  const prev = index > 0 ? FLAT_NAV[index - 1] : null;
  const next = index >= 0 && index < FLAT_NAV.length - 1 ? FLAT_NAV[index + 1] : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Header onMenu={() => setOpen((v) => !v)} menuOpen={open} />
      <div className="docs">
        <aside className="sidebar" data-open={open ? "" : undefined}>
          <Sidebar onNavigate={() => setOpen(false)} />
        </aside>
        {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden />}
        <main className="docs-main" id="main">
          <article className="prose">
            <Outlet />
          </article>
          {(prev || next) && (
            <nav className="pager" aria-label="Pages">
              {prev ? (
                <Link to={`/docs/${prev.slug}`} className="pager-link prev">
                  <span>Previous</span>
                  {prev.title}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link to={`/docs/${next.slug}`} className="pager-link next">
                  <span>Next</span>
                  {next.title}
                </Link>
              )}
            </nav>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
