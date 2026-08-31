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
  | 'peek'
  | 'replay';

const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

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
      return svg('<path d="M9 18h6M10 21h4"/><path d="M8 14a5 5 0 1 1 8 0c-1 1.2-2 2-2 4h-4c0-2-1-2.8-2-4z"/>');
    case 'area':
      return svg(
        '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
      );
    case 'sarea':
      return svg(
        '<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="3"/><path d="M7.5 3v18M12 3v18M16.5 3v18M3 7.5h18M3 12h18M3 16.5h18"/>',
      );
    case 'reveal_temp':
      return svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 4h6"/>');
    case 'reveal_perm':
      return svg('<path d="M4.5 12c2.2-3.5 4.4-3.5 7.5 0 3.1 3.5 5.3 3.5 7.5 0M4.5 12c2.2 3.5 4.4 3.5 7.5 0 3.1-3.5 5.3-3.5 7.5 0"/>');
    case 'peek':
      return svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
    case 'replay':
      return svg('<path d="M4 7h6V4L4 7l6 3V7"/><path d="M20 12a8 8 0 1 1-2.2-5.5"/>');
  }
}
