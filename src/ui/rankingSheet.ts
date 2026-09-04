import { formatTimer } from '../domain/timer';
import type { Leaderboard, RankingError } from '../data/cloud/leaderboard';
import { t } from '../i18n';

export function openRankingSheet(host: HTMLElement, board: Leaderboard | null, error: RankingError) {
  const overlay = document.createElement('div');
  overlay.className = 'hud-overlay hud-board-overlay';
  const sheet = document.createElement('div');
  sheet.className = 'hud-card hud-board';
  const title = document.createElement('h2');
  title.textContent = t('rank.title');
  sheet.appendChild(title);

  if (board && board.top.length > 0) {
    const list = document.createElement('ol');
    list.className = 'hud-board-list';
    for (const row of board.top) {
      const li = document.createElement('li');
      if (board.my_rank === row.rank) li.classList.add('is-you');
      li.innerHTML = `<span class="hud-board-rank">#${row.rank}</span><span class="hud-board-name">${escapeHtml(row.nickname)}</span><span class="hud-board-time">${formatTimer(row.best_ms)}</span>`;
      list.appendChild(li);
    }
    sheet.appendChild(list);
    if (board.my_rank !== null && board.my_rank > 10 && board.my_ms !== null) {
      const you = document.createElement('p');
      you.className = 'hud-board-you';
      you.textContent = t('rank.you', {
        n: board.my_rank,
        name: board.my_nickname ?? t('rank.youFallback'),
        time: formatTimer(board.my_ms),
      });
      sheet.appendChild(you);
    }
  } else {
    const empty = document.createElement('p');
    empty.className = 'hud-board-empty';
    empty.textContent = error ? t('rank.saveFailed') : t('rank.empty');
    sheet.appendChild(empty);
  }

  const close = document.createElement('button');
  close.className = 'btn btn-mint';
  close.type = 'button';
  close.textContent = t('menu.close');
  close.onclick = () => overlay.remove();
  sheet.appendChild(close);
  overlay.appendChild(sheet);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) overlay.remove();
  });
  host.appendChild(overlay);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}
