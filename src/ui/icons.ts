export type IconName =
  | 'map'
  | 'events'
  | 'store'
  | 'workshop'
  | 'gear'
  | 'hint'
  | 'area'
  | 'sarea'
  | 'reveal_temp'
  | 'reveal_perm'
  | 'lucky'
  | 'solver'
  | 'peek'
  | 'replay'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronUp'
  | 'chevronDown'
  | 'cup'
  | 'commons'
  | 'rares';

const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" overflow="visible" aria-hidden="true">${path}</svg>`;

const piece =
  '<path d="M2.6 7.6h4.8V6a1.6 1.6 0 1 1 3.2 0v1.6h4.6v4.6h-1.5a1.6 1.6 0 1 0 0 3.2h1.5v4H10.6v-1.4a1.6 1.6 0 1 0-3.2 0V21H2.6V7.6z" fill="currentColor" fill-opacity=".22"/>';

export function iconHtml(name: IconName): string {
  switch (name) {
    case 'map':
      return svg(
        '<circle cx="12" cy="10" r="3"/><path d="M12 2C8 2 5 6 5 10c0 6 7 12 7 12s7-6 7-12c0-4-3-8-7-8z"/>',
      );
    case 'events':
      return svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 11h18"/>');
    case 'store':
      return svg('<path d="M4 9h16l-1 11H5L4 9z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>');
    case 'workshop':
      return svg('<path d="M14 7l3 3-8 8H6v-3z"/><path d="M12 9l3 3"/>');
    case 'gear':
      return svg(
        '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
      );
    case 'hint':
      return svg(
        `${piece}<path d="M17.6 8.4 22.2 12l-4.6 3.6" stroke-width="3"/><path d="M15.4 12H22.2" stroke-width="3"/>`,
      );
    case 'area':
      return svg(
        '<rect x="2.5" y="2.5" width="19" height="19" rx="2.2"/><path d="M8.8 2.5v19M15.2 2.5v19M2.5 8.8h19M2.5 15.2h19"/>',
      );
    case 'sarea':
      return svg(
        '<rect x="2" y="2" width="20" height="20" rx="2.2"/><path d="M7 2v20M12 2v20M17 2v20M2 7h20M2 12h20M2 17h20"/>',
      );
    case 'reveal_temp':
      return svg(
        '<path d="M2 8s3.4-5.2 10-5.2S22 8 22 8s-3.4 5.2-10 5.2S2 8 2 8z"/><circle cx="12" cy="8" r="2.3" fill="currentColor" stroke="none"/><text x="12" y="21.8" text-anchor="middle" font-size="12" font-weight="900" font-family="system-ui,Segoe UI,sans-serif" fill="currentColor" stroke="none">20</text>',
      );
    case 'reveal_perm':
      return svg(
        '<path d="M2 8s3.4-5.2 10-5.2S22 8 22 8s-3.4 5.2-10 5.2S2 8 2 8z"/><circle cx="12" cy="8" r="2.3" fill="currentColor" stroke="none"/><path d="M12 18.2c-1.35-2.4-2.9-3.6-5-3.6-2.4 0-4.2 1.7-4.2 3.6s1.8 3.6 4.2 3.6c2.1 0 3.65-1.2 5-3.6 1.35 2.4 2.9 3.6 5 3.6 2.4 0 4.2-1.7 4.2-3.6s-1.8-3.6-4.2-3.6c-2.1 0-3.65 1.2-5 3.6z" stroke-width="2.9"/>',
      );
    case 'lucky':
      return svg(
        `${piece}<path d="M17.4 6.4 21.6 3.6" stroke-width="3"/><path d="M16.8 12H22.6" stroke-width="3"/><path d="M17.4 17.6 21.6 20.4" stroke-width="3"/>`,
      );
    case 'solver':
      return svg(
        '<rect x="2.5" y="3.5" width="8" height="8" rx="1.6" fill="currentColor" fill-opacity=".22"/><rect x="13.5" y="3.5" width="8" height="8" rx="1.6" fill="currentColor" fill-opacity=".22"/><rect x="2.5" y="13.5" width="8" height="8" rx="1.6" fill="currentColor" fill-opacity=".22"/><path d="M14 16.2h7.5M16.4 13.8l5.6 5.6" stroke-width="3"/>',
      );
    case 'peek':
      return svg(
        '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>',
      );
    case 'replay':
      return svg('<path d="M4 7h6V4L4 7l6 3V7"/><path d="M20 12a8 8 0 1 1-2.2-5.5"/>');
    case 'chevronLeft':
      return svg('<path d="M15 5l-7 7 7 7"/>');
    case 'chevronRight':
      return svg('<path d="M9 5l7 7-7 7"/>');
    case 'chevronUp':
      return svg('<path d="M5 15l7-7 7 7"/>');
    case 'chevronDown':
      return svg('<path d="M5 9l7 7 7-7"/>');
    case 'cup':
      return svg(
        '<path d="M8 4h8v3a4 4 0 0 1-8 0V4z"/><path d="M16 5h3a3 3 0 0 1-3 4M8 5H5a3 3 0 0 0 3 4"/><path d="M10 15h4v3H10zM9 21h6"/>',
      );
    case 'commons':
      return svg(
        '<path d="M4 10h16v9H4z" fill="currentColor" fill-opacity=".22"/><path d="M4 10l2-3.5h12L20 10"/><path d="M8 6.5V10M12 4.5V10M16 6.5V10"/><path d="M10 15h4" stroke-width="3"/>',
      );
    case 'rares':
      return svg(
        '<path d="M12 3.6 19 11.5 12 21.2 5 11.5z" fill="currentColor" fill-opacity=".22"/><path d="M5 11.5h14M12 3.6v17.6"/>',
      );
  }
}
