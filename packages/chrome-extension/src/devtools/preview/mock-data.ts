// Mock data fixtures for standalone preview mode.
// Provides realistic element selections, sessions, and screenshots.

export const MOCK_SESSIONS = [
  { name: 'kevin_agent_v2', port: 57490, status: 'ready' as const },
  { name: 'test_session', port: 57491, status: 'ready' as const },
];

export const MOCK_ELEMENT_NAV = {
  tagName: 'nav',
  selector: 'body > div.app-container > main.content > nav.main-navigation',
  a11yPath: '- document [html]\n  - main [main.content]\n    - navigation "Main navigation" [nav.main-navigation] \u2190 SELECTED\n      - list [ul.nav-links]\n        - listitem [li]\n          - link "Home" [a.nav-link]\n        - listitem [li]\n          - link "About" [a.nav-link]',
  attributes: [
    { name: 'class', value: 'main-navigation' },
    { name: 'role', value: 'navigation' },
    { name: 'aria-label', value: 'Main navigation' },
  ],
  computedStyles: {
    'display': 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    'padding': '1.5rem 2rem',
    'background': '#1f2937',
    'font-family': '"Inter", sans-serif',
    'border-radius': '0.5rem',
    'border': '1px solid #374151',
    'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  rect: { x: 0, y: 64, width: 384, height: 216 },
};

export const MOCK_ELEMENT_BUTTON = {
  tagName: 'button',
  selector: 'body > main > section.hero > button.cta-primary',
  a11yPath: '- document [html]\n  - main [main]\n    - region "Hero" [section.hero]\n      - button "Get started" [button.cta-primary] \u2190 SELECTED',
  attributes: [
    { name: 'class', value: 'cta-primary' },
    { name: 'type', value: 'submit' },
    { name: 'role', value: 'button' },
    { name: 'aria-label', value: 'Get started' },
    { name: 'aria-expanded', value: 'false' },
  ],
  computedStyles: {
    'display': 'inline-flex',
    'align-items': 'center',
    'padding': '0.75rem 1.5rem',
    'background': '#10b981',
    'color': '#ffffff',
    'font-weight': '600',
    'border-radius': '0.375rem',
    'cursor': 'pointer',
  },
  rect: { x: 120, y: 340, width: 160, height: 44 },
};

export const MOCK_ELEMENT_HERO = {
  tagName: 'div',
  selector: 'body > main > section.hero',
  a11yPath: '- document [html]\n  - main [main]\n    - region "Hero" [section.hero] \u2190 SELECTED\n      - heading "Welcome" [h1]\n      - paragraph [p]\n      - button "Get started" [button.cta-primary]',
  attributes: [
    { name: 'class', value: 'hero' },
  ],
  computedStyles: {
    'display': 'grid',
    'grid-template-columns': '1fr 1fr',
    'gap': '2rem',
    'padding': '4rem 2rem',
    'min-height': '60vh',
    'align-items': 'center',
  },
  rect: { x: 0, y: 64, width: 1280, height: 600 },
};

/** Generate a gradient screenshot as a data URL using canvas. */
export function generateMockScreenshot(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(width, 400);
  canvas.height = Math.min(height, 300);
  const ctx = canvas.getContext('2d')!;

  // Purple-blue gradient (matches mockup aesthetic)
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(0.3, '#8b5cf6');
  gradient.addColorStop(0.6, '#a855f7');
  gradient.addColorStop(1, '#3b82f6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add some abstract shapes for visual interest
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(canvas.width * 0.3, canvas.height * 0.6, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(canvas.width * 0.7, canvas.height * 0.4, 60, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/png');
}
