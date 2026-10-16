import { useEffect, useState } from 'react';
import { NormalizedLogo } from '../shared/NormalizedLogo.jsx';
import { TotyPitch } from '../shared/TotyPitch.jsx';
const api = window.wflMedal;

function Photo({ src, name }) {
  if (src) return <img className="hero-photo" src={src} alt={name} />;
  return <div className="hero-photo placeholder" aria-hidden="true" />;
}

function ScoreTile({ game }) {
  return (
    <article className={`score-tile${game.forfeit ? ' forfeit' : ''}`}>
      <div className="score-club home">
        {game.homeLogoUrl ? <NormalizedLogo src={game.homeLogoUrl} pad={0.06} /> : <i />}
        <strong>{game.homeName}</strong>
      </div>
      <div className="score-result">
        {game.forfeit ? (
          <b>{game.forfeitLine || 'Forfeit'}</b>
        ) : (
          <>
            <span>{game.homeScoreLine ?? '—'}</span>
            <em>–</em>
            <span>{game.awayScoreLine ?? '—'}</span>
          </>
        )}
      </div>
      <div className="score-club away">
        <strong>{game.awayName}</strong>
        {game.awayLogoUrl ? <NormalizedLogo src={game.awayLogoUrl} pad={0.06} /> : <i />}
      </div>
    </article>
  );
}

function Top8({ rows, live, topN = 8, full = false }) {
  const list = full ? (rows ?? []) : (rows ?? []).slice(0, topN);
  return (
    <aside className={`top8${live ? ' live' : ''}${full ? ' full' : ''}`}>
      <h3>
        {full ? 'Leaderboard' : live ? 'Live vote count' : `Top ${topN}`}
        {full ? <small>{list.length} {list.length === 1 ? 'player' : 'players'}</small> : null}
        {live && !full ? <small>Top {topN}</small> : null}
      </h3>
      {list.length ? (
        <ol>
          {list.map((row, index) => (
            <li key={row.id}>
              <span>{index + 1}</span>
              {row.photoUrl ? <img src={row.photoUrl} alt="" /> : <i className="photo-slot" />}
              {row.logoUrl ? <NormalizedLogo className="club" src={row.logoUrl} pad={0.04} /> : <i className="club" />}
              <div>
                <strong>{row.name}</strong>
                <small>
                  {row.number ? `No. ${row.number}` : ''}
                  {row.number && row.clubName ? ' · ' : ''}
                  {row.clubName}
                </small>
              </div>
              <b>{row.votes}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="top8-empty">No votes yet</p>
      )}
    </aside>
  );
}

function ScoreboardPanel({ roundName, games, top8, live, topN = 8, showTopBoard = true }) {
  const rows = showTopBoard ? (top8 ?? []).slice(0, topN) : [];
  const showBoard = Boolean(showTopBoard && rows.length);
  return (
    <div className={`scoreboard${showBoard ? ' has-top8' : ''}`}>
      <h2 className="round-title">{roundName || 'Select a round'}</h2>
      <div className="score-tiles">
        {games?.length ? (
          games.map((game) => <ScoreTile key={game.id} game={game} />)
        ) : (
          <div className="waiting">No games in this round</div>
        )}
      </div>
      {showBoard ? <Top8 rows={rows} live={live} topN={topN} /> : null}
    </div>
  );
}

function StageHeader({ state, title, live, season }) {
  const settings = state?.settings ?? {};
  return (
    <div className="stage-top">
      {settings.showWflLogo !== false && state?.wflLogoUrl ? (
        <img className="wfl" src={state.wflLogoUrl} alt="WFL" />
      ) : null}
      <div>
        {settings.showLeagueName !== false ? (
          <p>{settings.leagueName || 'Whyalla Football League'}</p>
        ) : null}
        <h1>{title}</h1>
      </div>
      {live ? <span className="live-pill">Live</span> : null}
      {settings.showSeasonYear !== false ? (
        <span className="year">{season || state?.scoreboard?.season || state?.season}</span>
      ) : null}
    </div>
  );
}

function SponsorStrip({ sponsors, className }) {
  if (!sponsors?.length) return null;
  return (
    <div className={`sponsor-bar${className ? ` ${className}` : ''}`}>
      {sponsors.map((sponsor) =>
        sponsor.imageUrl ? (
          <img key={sponsor.id} src={sponsor.imageUrl} alt={sponsor.name} />
        ) : (
          <span key={sponsor.id}>{sponsor.name}</span>
        )
      )}
    </div>
  );
}

function TotySponsorMark({ sponsor, compact }) {
  if (!sponsor) return null;
  return (
    <div className={`toty-sponsor-mark${compact ? ' compact' : ''}`}>
      <p>Presented by</p>
      {sponsor.imageUrl ? (
        <img src={sponsor.imageUrl} alt={sponsor.name || 'Sponsor'} />
      ) : (
        <strong>{sponsor.name}</strong>
      )}
    </div>
  );
}

function TotyLine({ picks, spots, reveal }) {
  const count = spots?.length || 3;
  const shown = typeof reveal === 'number' ? reveal : count;
  return (
    <div className={`votes-row toty-line-row cols-${count}`}>
      {(spots ?? []).map((spot, index) => {
        if (index >= shown) {
          return (
            <div key={spot.spotId} className="vote-col">
              <div className="vote-slot">
                <b>{spot.posLabel}</b>
              </div>
            </div>
          );
        }
        const player = picks?.[spot.spotId];
        const pick = {
          name: player?.name || 'To be announced',
          clubName: player?.clubName,
          clubLabel: [player?.clubName, player?.number ? `No. ${player.number}` : null].filter(Boolean).join(' · ') || spot.posName,
          photoUrl: player?.photoUrl || player?.logoUrl || null,
          logoUrl: player?.logoUrl || null,
          themeClubName: player?.themeClubName || player?.clubName,
        };
        return (
          <div key={spot.spotId} className={`vote-col shown${index === shown - 1 ? ' just-in' : ''}`}>
            <VoteCard
              pick={pick}
              countLabel={spot.posName || spot.posLabel}
              photoContain={!player?.photoUrl && Boolean(player?.logoUrl)}
            />
          </div>
        );
      })}
    </div>
  );
}

function TotyStage({ state }) {
  const toty = state.toty ?? {};
  const sponsor = toty.sponsor;
  const beat = toty.beat;
  if (beat?.type === 'line') {
    return (
      <div className="stage type-toty">
        <StageHeader state={state} title={beat.lineLabel || 'Team of the Year'} season={state?.season} />
        <TotyLine picks={toty.picks} spots={beat.spots} reveal={beat.reveal} />
        <TotySponsorMark sponsor={sponsor} compact />
      </div>
    );
  }
  return (
    <div className="stage type-toty">
      <StageHeader
        state={state}
        title="Team of the Year"
        season={state?.season}
      />
      <div className="toty-show">
        <TotyPitch picks={toty.picks ?? {}} revealStep={beat?.revealStep ?? 0}>
          <div className={`toty-presented${sponsor ? '' : ' empty'}`}>
            <p>Presented by</p>
            {sponsor?.imageUrl ? (
              <img src={sponsor.imageUrl} alt={sponsor.name || 'Sponsor'} />
            ) : (
              <strong>{sponsor?.name || 'Pick a sponsor'}</strong>
            )}
          </div>
        </TotyPitch>
      </div>
    </div>
  );
}

function SplashCrest({ team }) {
  return (
    <div className="splash-team" data-club={team.key || ''}>
      {team.logoUrl ? (
        <NormalizedLogo src={team.logoUrl} alt={team.name} pad={0.04} />
      ) : (
        <i>{(team.name || '?').slice(0, 1)}</i>
      )}
    </div>
  );
}

function SplashStage({ state }) {
  const splash = state.splash ?? {};
  const settings = state.settings ?? {};
  const teams = splash.teams ?? [];
  const fixtures = splash.fixtures ?? [];
  const wwfl = splash.competition === 'wwfl';
  return (
    <div className={`stage type-splash${wwfl ? ' wwfl' : ''}`}>
      <div className="splash-hero">
        {settings.showWflLogo !== false && state?.wflLogoUrl ? (
          <img className="splash-wfl" src={state.wflLogoUrl} alt={wwfl ? 'WWFL' : 'WFL'} />
        ) : null}
        <div className="splash-copy">
          {settings.showLeagueName !== false ? (
            <p>
              {splash.leagueName ||
                (wwfl ? "Whyalla Women's Football League" : settings.leagueName || 'Whyalla Football League')}
            </p>
          ) : null}
          <h1>{splash.title || (wwfl ? 'WWFL Medal Count' : 'WFL Medal Count')}</h1>
          {settings.showSeasonYear !== false ? <h2>{splash.season || state.season}</h2> : null}
        </div>
      </div>
      {teams.length ? (
        <div className="splash-teams" style={{ '--splash-n': Math.max(teams.length, 1) }}>
          {teams.map((team) => (
            <SplashCrest key={team.id || team.name} team={team} />
          ))}
        </div>
      ) : (
        <p className="splash-empty">Club logos appear after a season sync</p>
      )}
      <p className="splash-day">{splash.roundName || 'Grand Final'}</p>
      {fixtures.length ? (
        <ul
          className={`splash-fixtures${fixtures.length === 1 ? ' solo' : ''}`}
          style={{ '--gf-n': Math.max(fixtures.length, 1) }}
        >
          {fixtures.map((game) => (
            <li key={game.id}>
              <em>{game.gradeName}</em>
              <div className="splash-match">
                <span className="splash-side">
                  {game.homeLogoUrl ? <NormalizedLogo src={game.homeLogoUrl} pad={0.04} /> : <i />}
                </span>
                <span className="splash-v">
                  <em>v</em>
                </span>
                <span className="splash-side">
                  {game.awayLogoUrl ? <NormalizedLogo src={game.awayLogoUrl} pad={0.04} /> : <i />}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LifeMembersStage({ state }) {
  const life = state.lifeMembers ?? {};
  const members = life.members ?? [];
  const beat = life.beat;
  const current = life.current;

  return (
    <div className="stage type-lifemembers">
      <StageHeader state={state} title="Life Membership" season={state?.season} />
      {beat?.type === 'member' && current ? (
        <div className="winner-stage">
          <div className="winner-main">
            <WinnerCard winner={{ ...current, votes: null, number: current.number }} life />
            <aside className="winner-stats">
              <h3>Life member</h3>
              <dl>
                <div>
                  <dt>Award</dt>
                  <dd>Life membership</dd>
                </div>
                {current.year ? (
                  <div>
                    <dt>Season</dt>
                    <dd>{current.year}</dd>
                  </div>
                ) : null}
                {current.clubName ? (
                  <div>
                    <dt>Club</dt>
                    <dd>{current.clubName}</dd>
                  </div>
                ) : null}
                {current.number ? (
                  <div>
                    <dt>Jumper</dt>
                    <dd>No. {current.number}</dd>
                  </div>
                ) : null}
                {current.note ? (
                  <div>
                    <dt>Citation</dt>
                    <dd>{current.note}</dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </div>
        </div>
      ) : beat?.type === 'all' ? (
        <div className={`life-grid cols-${Math.min(4, members.length) || 1}`}>
          {members.map((member) => (
            <VoteCard key={member.id} pick={member} countLabel="Life member" />
          ))}
        </div>
      ) : (
        <div className="life-title">
          <p>To be awarded</p>
          <h2>Life membership</h2>
          <small>
            {members.length
              ? `${members.length} ${members.length === 1 ? 'recipient' : 'recipients'}`
              : 'Add recipients on the Life members tab'}
          </small>
        </div>
      )}
    </div>
  );
}

function VoteCountStage({ state }) {
  const board = state.scoreboard;
  const settings = state.settings ?? {};
  const sponsors = settings.showSponsors === false ? [] : board?.sponsors ?? [];
  const topN = board?.liveTopN ?? settings.liveVoteCount ?? 6;

  return (
    <div className="stage type-scoreboard">
      <StageHeader
        state={state}
        title={board?.medalTitle || board?.gradeName || 'Vote count'}
        live
        season={board?.season}
      />
      <div className="live-tally">
        <Top8 rows={board?.top8} live topN={topN} />
      </div>
      <SponsorStrip sponsors={sponsors} />
    </div>
  );
}

function LeaderboardStage({ state }) {
  const board = state.scoreboard;
  const settings = state.settings ?? {};
  const sponsors = settings.showSponsors === false ? [] : board?.leaderboardSponsors ?? [];
  const grades = board?.grades ?? [];
  const topN = board?.topN ?? settings.leaderboardSize ?? 8;
  const single = grades.length === 1;
  const heading = single
    ? grades[0].medalTitle || grades[0].name || 'Leaderboard'
    : 'Leaderboard';
  const rowCount = Math.max(
    1,
    ...grades.map((item) => Math.min((item.board ?? []).length, topN) || 1)
  );

  return (
    <div className="stage type-scoreboard type-leaderboard">
      <StageHeader
        state={state}
        title={heading}
        live
        season={board?.season || state?.season}
      />
      <div className="leaderboard-body">
        <div
          className={`grade-boards${single ? ' single' : ''}`}
          style={{ '--grade-cols': Math.max(grades.length, 1), '--row-count': rowCount }}
        >
          {grades.map((item) => {
            const rows = (item.board ?? []).slice(0, topN);
            return (
              <section key={item.id} className="grade-board">
                {single ? null : (
                  <header>
                    <h2>{item.medalTitle || item.name}</h2>
                    <p>{item.name}</p>
                  </header>
                )}
                {rows.length ? (
                  <ol style={{ '--row-count': Math.max(rows.length, 1) }}>
                    {rows.map((row, index) => (
                      <li key={row.id}>
                        <span>{index + 1}</span>
                        {row.photoUrl ? <img src={row.photoUrl} alt="" /> : <i className="photo-slot" />}
                        {row.logoUrl ? <NormalizedLogo className="club" src={row.logoUrl} pad={0.04} /> : <i className="club" />}
                        <div>
                          <strong>{row.name}</strong>
                        </div>
                        <b>{row.votes}</b>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="top8-empty">No votes yet</p>
                )}
              </section>
            );
          })}
        </div>
        <SponsorStrip sponsors={sponsors} className="leaderboard-sponsors" />
      </div>
    </div>
  );
}

function collectSlideMedia(slide) {
  if (!slide) return [];
  const urls = [];
  const push = (src) => {
    if (src && !urls.includes(src)) urls.push(src);
  };
  push(slide.photoUrl);
  push(slide.logoUrl);
  push(slide.homeLogoUrl);
  push(slide.awayLogoUrl);
  push(slide.winner?.photoUrl);
  push(slide.winner?.logoUrl);
  for (const pick of slide.picks ?? []) {
    push(pick.photoUrl);
    push(pick.logoUrl);
  }
  for (const row of slide.board ?? []) {
    push(row.photoUrl);
    push(row.logoUrl);
  }
  for (const game of slide.games ?? []) {
    push(game.homeLogoUrl);
    push(game.awayLogoUrl);
  }
  for (const sponsor of slide.sponsors ?? []) {
    push(sponsor.imageUrl);
  }
  return urls;
}

export function AudienceApp() {
  const [state, setState] = useState(null);

  useEffect(() => {
    api.getAudienceState().then(setState);
    return api.onAudience(setState);
  }, []);

  useEffect(() => {
    const peek = state?.presentation?.peek ?? [];
    const urls = peek.flatMap(collectSlideMedia);
    for (const src of urls) {
      const img = new Image();
      img.src = src;
    }
  }, [state?.presentation?.slideIndex, state?.presentation?.peek]);

  useEffect(() => {
    const onKey = (event) => {
      const view = state?.audienceView;
      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        if (view === 'leaderboard') api.showPresentation();
        else api.showLeaderboard('current');
        return;
      }
      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        if (view === 'scoreboard') api.showPresentation();
        else api.showScoreboard();
        return;
      }
      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        if (view === 'toty') api.showPresentation();
        else api.showToty();
        return;
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        if (view === 'lifemembers') api.showPresentation();
        else api.showLifeMembers();
        return;
      }
      if (event.key === 'p' || event.key === 'P' || (event.key === 'Escape' && view && view !== 'presentation')) {
        event.preventDefault();
        api.showPresentation();
        return;
      }
      if (event.key === 'F11') {
        event.preventDefault();
        api.updateSettings({ audienceFullscreen: state?.settings?.audienceFullscreen === false });
        return;
      }
      if (view === 'toty' || view === 'lifemembers' || view === 'splash') {
        if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          api.presentationStep(1);
        }
        if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
          event.preventDefault();
          api.presentationStep(-1);
        }
        return;
      }
      if (view && view !== 'presentation') return;
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        api.presentationStep(1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
        event.preventDefault();
        api.presentationStep(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.audienceView, state?.settings?.audienceFullscreen]);

  if (state?.audienceView === 'leaderboard') {
    return <LeaderboardStage state={state} />;
  }

  if (state?.audienceView === 'toty') {
    return <TotyStage state={state} />;
  }

  if (state?.audienceView === 'lifemembers') {
    return <LifeMembersStage state={state} />;
  }

  if (state?.audienceView === 'splash') {
    return <SplashStage state={state} />;
  }

  if (state?.audienceView === 'scoreboard') {
    return <VoteCountStage state={state} />;
  }

  const slide = state?.presentation?.current;
  const board = slide?.board ?? [];
  const settings = state?.settings ?? {};
  const topN = slide?.topN ?? settings.leaderboardSize ?? 8;
  const liveN = slide?.liveTopN ?? settings.liveVoteCount ?? 6;
  const season = slide?.season || state?.season;

  return (
    <div className={`stage type-${slide?.type ?? 'empty'}`}>
      <StageHeader state={state} title={slide?.medalTitle || 'Medal Count'} season={season} />

      {!slide && <div className="waiting">Open Presentation, then press Next</div>}

      {slide?.type === 'title' && (
        <div className="hero-copy">
          <p>Medal Count</p>
          <h2>{slide.medalTitle}</h2>
          {settings.showSeasonYear !== false ? <h3>{slide.season}</h3> : null}
        </div>
      )}

      {slide?.type === 'round' && (
        <ScoreboardPanel
          roundName={slide.roundName}
          games={slide.games}
          top8={slide.board}
          topN={liveN}
          live
        />
      )}

      {slide?.type === 'match' && (
        <div className="game-with-tally">
          <div className={`match-slide${slide.forfeit ? ' is-forfeit' : ''}`}>
            {slide.forfeit ? (
              <div className="forfeit-banner">
                <b>{slide.forfeitLine || 'Forfeit'}</b>
              </div>
            ) : null}
            <ClubSide logo={slide.homeLogoUrl} score={slide.forfeit ? null : slide.homeScoreLine} />
            <span className="vs">
              <em>v</em>
            </span>
            <ClubSide logo={slide.awayLogoUrl} score={slide.forfeit ? null : slide.awayScoreLine} />
          </div>
          <Top8 rows={slide.board} live topN={liveN} />
        </div>
      )}

      {slide?.type === 'votes' && (
        <div className="votes-stage has-tally">
          <div className="votes-main">
            {slide.showMatchScore !== false ? (
              <div className="votes-scoreboard">
                <ScoreTile game={slide} />
              </div>
            ) : null}
            <div className="votes-row">
              {[3, 2, 1].map((points) => {
                const pick = (slide.picks ?? []).find((item) => item.points === points);
                const shown = Boolean(pick) && typeof slide.reveal === 'number' && points >= slide.reveal;
                return (
                  <div
                    key={points}
                    className={`vote-col ${shown ? 'shown' : ''} ${shown && slide.reveal === points ? 'just-in' : ''}`}
                  >
                    {shown ? <VoteCard pick={pick} /> : <div className="vote-slot"><b>{points}</b></div>}
                  </div>
                );
              })}
            </div>
          </div>
          <Top8 rows={slide.board} live topN={liveN} />
        </div>
      )}

      {slide?.type === 'vote' && (
        <div className="vote-slide">
          <div className={`points p${slide.points}`}>{slide.points}</div>
          <Photo src={slide.photoUrl} name={slide.name} />
          <div className="vote-copy">
            {slide.logoUrl ? <img src={slide.logoUrl} alt="" /> : null}
            <h2>{slide.name}</h2>
            <p>{slide.clubName}{slide.number ? ` · No. ${slide.number}` : ''}</p>
            <small>
              {slide.homeName}
              {slide.homeScoreLine ? ` ${slide.homeScoreLine}` : ''}
              {' v '}
              {slide.awayScoreLine ? `${slide.awayScoreLine} ` : ''}
              {slide.awayName}
            </small>
          </div>
        </div>
      )}

      {slide?.type === 'leaderboard' && (
        <div className="board-slide">
          <h2>Top {topN} after {slide.throughRound}</h2>
          <ol>
            {board.slice(0, topN).map((row, index) => (
              <li key={row.id}>
                <span>{index + 1}</span>
                {row.photoUrl ? <img src={row.photoUrl} alt="" /> : <i />}
                {row.logoUrl ? <NormalizedLogo className="club" src={row.logoUrl} pad={0.04} /> : null}
                <div>
                  <strong>{row.name}</strong>
                </div>
                <b>{row.votes}</b>
              </li>
            ))}
          </ol>
        </div>
      )}

      {slide?.type === 'winner' && (
        <div className="winner-stage">
          <div className="winner-main">
            <WinnerCard winner={slide.winner} />
            <WinnerStats winner={slide.winner} medalTitle={slide.medalTitle} season={slide.season} />
          </div>
        </div>
      )}

      {settings.showSponsors !== false ? <SponsorStrip sponsors={slide?.sponsors} /> : null}
    </div>
  );
}

function winnerStatItems(winner, medalTitle, season) {
  if (!winner) return [];
  const items = [];
  const add = (label, value) => {
    if (value == null || value === '') return;
    items.push({ label, value });
  };
  add('Medal', medalTitle);
  add('Season', season);
  add('Club', winner.homeClubName || winner.clubName);
  add('Jumper', winner.number ? `No. ${winner.number}` : null);
  add('Games played', winner.gamesPlayed);
  if (winner.goals != null) add('Goals', Math.round(Number(winner.goals) * 10) / 10);
  add('Votes', winner.votes);
  add('Games polled', winner.gamesVoted ?? winner.games);
  add('3-vote games', winner.threes);
  add('2-vote games', winner.twos);
  add('1-vote games', winner.ones);
  return items;
}

function WinnerCard({ winner, life }) {
  if (!winner) return <div className="waiting">No winner yet</div>;
  const theme = clubTheme(winner.themeClubName || winner.clubName, winner);
  return (
    <article
      className={`vote-card winner-card ${theme.wfl ? 'wfl-wash' : theme.dark ? 'dark-wash' : 'light-wash'}`}
      style={{ backgroundColor: theme.primary, '--club-primary': theme.primary }}
    >
      <div className="vote-card-bg">
        {winner.logoUrl ? <img className="club-watermark" src={winner.logoUrl} alt="" /> : null}
      </div>
      <b className="vote-count">{life ? 'Life member' : 'Winner'}</b>
      <div className="player-stack">
        {winner.photoUrl ? (
          <img className="player-cutout" src={winner.photoUrl} alt={winner.name} />
        ) : winner.logoUrl ? (
          <img className="player-cutout contain" src={winner.logoUrl} alt="" />
        ) : (
          <div className="player-cutout placeholder" aria-hidden="true" />
        )}
        <div className="player-id">
          <strong>{winner.name}</strong>
          <small>
            {winner.clubName}
            {winner.number ? ` · No. ${winner.number}` : ''}
            {winner.votes != null ? ` · ${winner.votes} votes` : ''}
          </small>
        </div>
      </div>
    </article>
  );
}

function WinnerStats({ winner, medalTitle, season }) {
  const items = winnerStatItems(winner, medalTitle, season);
  return (
    <aside className="winner-stats">
      <h3>Season stats</h3>
      {items.length ? (
        <dl>
          {items.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="top8-empty">No stats yet</p>
      )}
    </aside>
  );
}

function clubTheme(name, person) {
  const key = String(name || '').toUpperCase();
  const id = String(person?.clubId || '');
  if (person?.wflMember || id === 'wfl-member' || key.includes('WFL MEMBER') || key === 'WFL') {
    return { primary: '#072445', dark: true, wfl: true };
  }
  if (key.includes('CENTRAL')) return { primary: '#d32f2f', dark: true };
  if (key.includes('NORTH')) return { primary: '#111111', dark: true };
  if (key.includes('ROOPENA')) return { primary: '#0288d1', dark: false };
  if (key.includes('SOUTH')) return { primary: '#0d47a1', dark: true };
  if (key.includes('WEEROONA')) return { primary: '#f5c400', dark: false };
  if (key.includes('WEST')) return { primary: '#2e7d32', dark: true };
  return { primary: '#1a140e', dark: true };
}

function VoteCard({ pick, countLabel, photoContain }) {
  const theme = clubTheme(pick.themeClubName || pick.clubName, pick);
  return (
    <article
      className={`vote-card ${theme.wfl ? 'wfl-wash' : theme.dark ? 'dark-wash' : 'light-wash'}`}
      style={{ backgroundColor: theme.primary, '--club-primary': theme.primary }}
    >
      <div className="vote-card-bg">
        {pick.logoUrl ? <img className="club-watermark" src={pick.logoUrl} alt="" /> : null}
      </div>
      <b className="vote-count">
        {countLabel ?? `${pick.points} ${pick.points === 1 ? 'vote' : 'votes'}`}
      </b>
      <div className="player-stack">
        {pick.photoUrl ? (
          <img
            className={`player-cutout${photoContain ? ' contain' : ''}`}
            src={pick.photoUrl}
            alt=""
          />
        ) : pick.logoUrl ? (
          <img className="player-cutout contain" src={pick.logoUrl} alt="" />
        ) : (
          <div className="player-cutout placeholder" aria-hidden="true" />
        )}
        <div className="player-id">
          <strong>{pick.name}</strong>
          <small>{pick.clubLabel || pick.clubName}</small>
        </div>
      </div>
    </article>
  );
}

function ClubSide({ name, logo, score }) {
  return (
    <div className="club-side">
      {logo ? <NormalizedLogo src={logo} pad={0.06} /> : null}
      {name ? <h2>{name}</h2> : null}
      {score != null ? <b>{score}</b> : null}
    </div>
  );
}
