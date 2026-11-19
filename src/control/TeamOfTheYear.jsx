import { useEffect, useMemo, useState } from 'react';
import { TotyPitch } from '../shared/TotyPitch.jsx';

const api = window.wflMedal;

function TotyPicker({
  position,
  roster,
  usedIds,
  currentId,
  currentCaptainId,
  captainRoles,
  onPick,
  onClear,
  onSetCaptain,
  onClose,
}) {
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
                      {player.photoImported ? ' · imported photo' : ''}
                      {used ? ' · already picked' : ''}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!list.length ? <p className="muted">No matching players. Sync from the website if the list is empty.</p> : null}
        {currentId ? (
          <div className="toty-captain-pick">
            <p className="muted">Team leadership for this player</p>
            <div className="toty-captain-roles">
              <button
                type="button"
                className={!currentCaptainId ? 'active' : ''}
                onClick={() => onSetCaptain(currentId, null)}
              >
                None
              </button>
              {(captainRoles ?? []).map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={currentCaptainId === role.id ? 'active' : ''}
                  onClick={() => onSetCaptain(currentId, role.id)}
                  title={role.label}
                >
                  <b>{role.short}</b>
                  <span>{role.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
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

function TotyLeaders({ picks, captainRoles, gradeId }) {
  const leaders = useMemo(() => {
    const byRole = new Map((captainRoles ?? []).map((role) => [role.id, []]));
    for (const player of Object.values(picks ?? {})) {
      const role = player?.totyCaptain;
      if (!player || !role || !byRole.has(role.id)) continue;
      byRole.get(role.id).push(player);
    }
    return (captainRoles ?? [])
      .map((role) => ({ role, players: byRole.get(role.id) ?? [] }))
      .filter((row) => row.players.length);
  }, [picks, captainRoles]);

  if (!leaders.length) {
    return (
      <p className="muted toty-leaders-empty">
        Open a picked player to set Captain, Co-captain, Vice captain, or Deputy vice captain.
      </p>
    );
  }

  return (
    <ul className="toty-leaders">
      {leaders.map(({ role, players }) => (
        <li key={role.id}>
          <b title={role.label}>{role.short}</b>
          <span>
            <strong>{role.label}</strong>
            <small>
              {players.map((player) => player.name).join(' · ')}
            </small>
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              for (const player of players) api.setTotyCaptain(gradeId, player.id, null);
            }}
          >
            Clear
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TeamOfTheYear({ state }) {
  const [picking, setPicking] = useState(null);
  const picks = state.toty?.picks ?? {};
  const roster = state.toty?.roster ?? state.roster ?? [];
  const captainRoles = state.toty?.captainRoles ?? [];
  const usedIds = new Set(Object.values(picks).filter(Boolean).map((player) => player.id));
  const filled = state.toty?.filled ?? 0;
  const total = state.toty?.total ?? 22;
  const gradeId = state.toty?.gradeId;
  const gradeName = state.toty?.gradeName || 'League';
  const sponsorId = state.toty?.sponsor?.id ?? null;
  const currentPick = picking ? picks[picking.id] : null;

  return (
    <div className="toty">
      <div className="toty-bar">
        <p>
          Click a position on the field, then choose a League player. Set Captain / Vice / Co-captain in the picker. Use Add / × on Interchange to grow or shrink the bench. Pick a sponsor below — it shows on each player announce and on the full team.
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

      <TotyLeaders picks={picks} captainRoles={captainRoles} gradeId={gradeId} />

      <TotyPitch
        picks={picks}
        onPick={setPicking}
        benchCount={state.toty?.benchCount}
        onAddBench={() => api.addTotyInterchange(gradeId)}
        onRemoveBench={(pos) => api.removeTotyInterchange(gradeId, pos.id)}
      />

      {picking ? (
        <TotyPicker
          position={picking}
          roster={roster}
          usedIds={usedIds}
          currentId={currentPick?.id ?? null}
          currentCaptainId={currentPick?.totyCaptain?.id ?? null}
          captainRoles={captainRoles}
          onPick={(playerId) => {
            api.setTotyPlayer(gradeId, picking.id, playerId);
          }}
          onClear={() => {
            api.setTotyPlayer(gradeId, picking.id, null);
            setPicking(null);
          }}
          onSetCaptain={(playerId, roleId) => api.setTotyCaptain(gradeId, playerId, roleId)}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </div>
  );
}
