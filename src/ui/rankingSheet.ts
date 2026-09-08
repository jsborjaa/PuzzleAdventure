import { formatTimer } from '../domain/timer';
import type { Leaderboard, RankingError } from '../data/cloud/leaderboard';
import { t } from '../i18n';
import { button, el } from './dom';
import { escapeHtml } from './escapeHtml';

export function openRankingSheet(host: HTMLElement, board: Leaderboard | null, error: RankingError) {
  const overlay = el('div', 'hud-overlay hud-board-overlay');
  const sheet = el('div', 'hud-card hud-board');
  const title = el('h2');
  title.textContent = t('rank.title');
  sheet.appendChild(title);

  if (board && board.top.length > 0) {
    const list = el('ol', 'hud-board-list');
    for (const row of board.top) {
      const li = el('li');
      if (board.my_rank === row.rank) li.classList.add('is-you');
      li.innerHTML = `<span class="hud-board-rank">#${row.rank}</span><span class="hud-board-name">${escapeHtml(row.nickname)}</span><span class="hud-board-time">${formatTimer(row.best_ms)}</span>`;
      list.appendChild(li);
    }
    sheet.appendChild(list);
    if (board.my_rank !== null && board.my_rank > 10 && board.my_ms !== null) {
      const you = el('p', 'hud-board-you');
      you.textContent = t('rank.you', {
        n: board.my_rank,
        name: board.my_nickname ?? t('rank.youFallback'),
        time: formatTimer(board.my_ms),
      });
      sheet.appendChild(you);
    }
  } else {
    const empty = el('p', 'hud-board-empty');
    empty.textContent = error ? t('rank.saveFailed') : t('rank.empty');
    sheet.appendChild(empty);
  }

  const close = button(t('menu.close'), 'btn btn-mint');
  close.addEventListener('click', () => overlay.remove());
  sheet.appendChild(close);
  overlay.appendChild(sheet);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) overlay.remove();
  });
  host.appendChild(overlay);
}
