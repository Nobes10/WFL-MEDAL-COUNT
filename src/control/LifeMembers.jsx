import { useEffect, useMemo, useState } from 'react';

const api = window.wflMedal;

function uniqueNamedClubs(clubs) {
  const seen = new Set();
  const list = [];
  for (const club of clubs ?? []) {
    const key = String(club.name || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(club);
  }
  return list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
}

function CitationField({ member }) {
  const [note, setNote] = useState(member.note ?? '');

  useEffect(() => {
    setNote(member.note ?? '');
  }, [member.id, member.note]);

  return (
    <input
      value={note}
      onChange={(event) => setNote(event.target.value)}
      onBlur={() => {
        if (note !== (member.note ?? '')) api.updateLifeMember(member.id, { note });
      }}
      placeholder="Citation or years of service (optional)"
    />
  );
}

function NameField({ member }) {
  const [name, setName] = useState(member.name ?? '');

  useEffect(() => {
    setName(member.name ?? '');
  }, [member.id, member.name]);

  return (
    <input
      className="life-name"
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => {
        const next = name.trim();
        if (next && next !== (member.name ?? '')) api.updateLifeMember(member.id, { name: next });
      }}
      placeholder="Name"
    />
  );
}

export function LifeMembers({ state }) {
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customClubId, setCustomClubId] = useState('');
  const members = state.lifeMembers?.members ?? [];
  const roster = state.roster ?? [];
  const clubs = state.leagueClubs?.length ? state.leagueClubs : uniqueNamedClubs(state.clubs);
  const usedIds = new Set(members.map((member) => member.playerId).filter(Boolean));
  const matches = useMemo(() => {
    const hay = query.trim().toLowerCase();
    if (!hay) return [];
    return roster
      .filter((player) =>
        `${player.name} ${player.number} ${player.clubName} ${player.position} ${(player.gradeNames ?? []).join(' ')}`
          .toLowerCase()
          .includes(hay)
      )
      .slice(0, 12);
  }, [query, roster]);

  return (
    <div className="life">
      <div className="toty-bar">
        <p>
          Build the life members to award on the night. Search a player or type a name. Add or change a photo on each recipient. Presentation starts on a title card, then one recipient at a time
          {members.length > 1 ? ', then the full group' : ''}.
        </p>
        <div className="row">
          <span className="muted">
            {members.length} {members.length === 1 ? 'recipient' : 'recipients'}
          </span>
          <button className="primary" type="button" onClick={() => api.showLifeMembers(true)}>
            Present on audience
          </button>
          <button
            type="button"
            disabled={!members.length}
            onClick={() => {
              if (window.confirm('Clear every life member from this list?')) api.clearLifeMembers();
            }}
          >
            Clear list
          </button>
        </div>
      </div>

      <div className="life-add">
        <label className="life-field">
          <span>Search a player</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, number or club"
            autoComplete="off"
          />
        </label>
        {query.trim() ? (
          <ul className="life-search">
            {matches.map((player) => {
              const used = usedIds.has(player.id);
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    className={`toty-choice${used ? ' used' : ''}`}
                    disabled={used}
                    onClick={() => {
                      api.addLifeMember(player.id);
                      setQuery('');
                    }}
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
                        {used ? ' · already added' : ''}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
            {!matches.length ? <li className="muted">No matching players.</li> : null}
          </ul>
        ) : null}
        <form
          className="life-custom"
          onSubmit={(event) => {
            event.preventDefault();
            const name = customName.trim();
            if (!name) return;
            api.addLifeMemberCustom({ name, clubId: customClubId || null, year: state.season });
            setCustomName('');
          }}
        >
          <label className="life-field">
            <span>Or type a name</span>
            <input
              type="text"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Name not in the player list"
              autoComplete="off"
            />
          </label>
          <select value={customClubId} onChange={(event) => setCustomClubId(event.target.value)}>
            <option value="">Club (optional)</option>
            <option value="wfl-member">WFL Member</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!customName.trim()}>
            Add name
          </button>
        </form>
      </div>

      {members.length ? (
        <ol className="life-list">
          {members.map((member, index) => (
            <li key={member.id}>
              <span className="life-order">{index + 1}</span>
              <button
                type="button"
                className="life-photo-btn"
                onClick={() => api.setLifeMemberPhoto(member.id)}
                title={member.photoUrl ? 'Change photo' : 'Add photo'}
              >
                {member.photoUrl ? <img className="life-photo" src={member.photoUrl} alt="" /> : <i className="life-photo" />}
              </button>
              {member.logoUrl ? <img className="life-logo" src={member.logoUrl} alt="" /> : <i className="life-logo" />}
              <div className="life-who">
                <NameField member={member} />
                <small>
                  {[member.clubName, member.year].filter(Boolean).join(' · ')}
                </small>
                <CitationField member={member} />
              </div>
              <div className="life-actions">
                <button type="button" onClick={() => api.setLifeMemberPhoto(member.id)}>
                  {member.photoUrl ? 'Change photo' : 'Add photo'}
                </button>
                {member.photoCustom ? (
                  <button type="button" onClick={() => api.clearLifeMemberPhoto(member.id)}>
                    Remove photo
                  </button>
                ) : null}
                <button disabled={index === 0} onClick={() => api.moveLifeMember(member.id, -1)}>
                  Up
                </button>
                <button disabled={index === members.length - 1} onClick={() => api.moveLifeMember(member.id, 1)}>
                  Down
                </button>
                <button onClick={() => api.removeLifeMember(member.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No life members on the list yet. Search a player or type a name. You can attach a photo on each recipient.</p>
      )}
    </div>
  );
}
