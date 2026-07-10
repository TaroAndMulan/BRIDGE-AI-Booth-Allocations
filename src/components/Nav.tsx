import { useEffect, useState } from 'react';

const CHULA_LOGO = 'https://lh3.googleusercontent.com/d/1zgJAXJ_RF--B8JRXSTkQHeDGxcMdv0xJ';
const BRIDGE_LOGO = 'https://lh3.googleusercontent.com/d/1z6m4H0pgNYYY9jeTqDuetTsPbT6BPbqS';

/**
 * Brand only. Category is a filter on the page below, not a destination, and the
 * manual download is a labelled card there — an icon up here lost its label on
 * phones, which is the one place it needed one.
 */
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-nav${scrolled ? ' is-scrolled' : ''}`}>
      <div className="nav-inner">
        <a
          className="brand"
          href="#top"
          aria-label="BRIDGE-AI Summit 2026 — Booth Allocations"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <img className="brand-logo" src={CHULA_LOGO} alt="Faculty of Medicine, Chulalongkorn University" />
          <img className="brand-logo" src={BRIDGE_LOGO} alt="BRIDGE-AI Summit 2026" />
        </a>
      </div>
    </header>
  );
}
