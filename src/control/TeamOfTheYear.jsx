import { useEffect, useMemo, useState } from 'react';
import { TotyPitch } from '../shared/TotyPitch.jsx';

const api = window.wflMedal;

function TotyPicker({ position, roster, usedIds, currentId, onPick, onClear, onClose }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = useMemo(() => {
    const hay = query.trim().toLowerCase();
    return (roster ?? []).filter((player) => {
      if (!hay) return true;
      return `${player.name} ${player.number} ${player.clubName} ${player.position} ${(player.gradeNames ?? []).join(' ')}`
        .toLowerCase()
        .includes(hay);
    });
  }, [query, roster]);

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal toty-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{position.name}</h3>
        <p className="muted">Choose a League player for this position.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search player, number or club"
          autoFocus
        />
        <ul className="picker toty-picker">
          {list.map((player) => {
            const used = usedIds.has(player.id) && player.id !== currentId;
            return (
              <li key={player.id}>
                <button
                  type="button"
                  className={`toty-choice${player.id === currentId ? ' selected' : ''}${used ? ' used' : ''}`}
                  onClick={() => onPick(player.id)}
                >
                  {player.photoUrl ? <img src={player.photoUrl} alt="" /> : <i />}
                  {player.logoUrl ? <img className="club" src={player.logoUrl} alt="" /> : <i className="club" />}
                  <span>
                    <strong>
                      {player.number ? `${player.number}. ` : ''}
                      {player.name}
                    </strong>
                    <small>
                      {player.clubName}
                      {player.position ? ` · ${player.position}` : ''}
                      {player.gradeNames?.length ? ` · ${player.gradeNames.join(', ')}` : ''}
                      {used ? ' · already picked' : ''}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!list.length ? <p className="muted">No matching players. Sync from the website if the list is empty.</p> : null}
        <div className="row">
          {currentId ? (
            <button onClick={onClear}>Clear this position</button>
          ) : null}
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeamOfTheYear({ state }) {
  const [picking, setPicking] = useState(null);
  const picks = state.toty?.picks ?? {};
  const roster = state.toty?.roster ?? state.roster ?? [];
  const usedIds = new Set(Object.values(picks).filter(Boolean).map((player) => player.id));
  const filled = state.toty?.filled ?? 0;
  const total = state.toty?.total ?? 22;
  const gradeId = state.toty?.gradeId;
  const gradeName = state.toty?.gradeName || 'League';
  const sponsorId = state.toty?.sponsor?.id ?? null;

  return (
    <div className="toty">
      <div className="toty-bar">
        <p>
          Click a position on the field, then choose a League player. Pick a sponsor below — it shows on each player announce and on the full team. Presentation reveals three cards one at a time, then the field.
        </p>
        <div className="row">
          <span className="muted">
            {gradeName} · {filled}/{total} selected
          </span>
            <button className="primary" onClick={() => api.showToty(true)}>
              Present on audience
            </button>
          <button
            disabled={!filled}
            onClick={() => {
              if (window.confirm('Clear the League team of the year?')) api.clearToty(gradeId);
            }}
          >
            Clear team
          </button>
        </div>
      </div>

      {(state.sponsors ?? []).length ? (
        <ul className="sponsor-picks">
          {(state.sponsors ?? []).map((sponsor) => (
            <li key={sponsor.id}>
              <button
                type="button"
                className={sponsor.id === sponsorId ? 'active' : ''}
                onClick={() => api.setTotySponsor(sponsor.id === sponsorId ? null : sponsor.id)}
              >
                {sponsor.imageUrl ? <img src={sponsor.imageUrl} alt="" /> : null}
                <span>{sponsor.name || 'Sponsor'}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Add a sponsor on the Sponsors tab to show with Team of the year.</p>
      )}

      <TotyPitch picks={picks} onPick={setPicking} />

      {picking ? (
        <TotyPicker
          position={picking}
          roster={roster}
          usedIds={usedIds}
          currentId={picks[picking.id]?.id ?? null}
          onPick={(playerId) => {
            api.setTotyPlayer(gradeId, picking.id, playerId);
            setPicking(null);
          }}
          onClear={() => {
            api.setTotyPlayer(gradeId, picking.id, null);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </div>
  );
}
