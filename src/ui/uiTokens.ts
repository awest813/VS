import type { CSSProperties } from 'react';

export const hud = {
  fontUi: `'DM Sans', system-ui, -apple-system, sans-serif`,
  fontMono: `'JetBrains Mono', ui-monospace, monospace`,
  label: (): CSSProperties => ({
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.14em',
    color: 'rgba(180, 198, 220, 0.75)',
  }),
  panel: (): CSSProperties => ({
    background: 'linear-gradient(160deg, rgba(18, 22, 32, 0.94) 0%, rgba(10, 12, 18, 0.96) 100%)',
    border: '1px solid rgba(160, 195, 255, 0.14)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(14px)',
  }),
  /** Small-caps rails (SHIP HUB, ACTIVE CONTRACT, weapon strip, OPS header). */
  sectionEyebrow: (tone: 'hub' | 'contract' | 'cool' | 'ops'): CSSProperties => {
    const color =
      tone === 'hub'
        ? 'rgba(150, 185, 220, 0.55)'
        : tone === 'contract'
          ? 'rgba(180, 200, 240, 0.55)'
          : tone === 'cool'
            ? 'rgba(160, 200, 255, 0.55)'
            : 'rgba(150, 180, 215, 0.55)';
    return {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.16em',
      color,
    };
  },
};

export function humanizeHudTarget(slug: string): string {
  const s = slug.replace(/_/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!s) return '';
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}
