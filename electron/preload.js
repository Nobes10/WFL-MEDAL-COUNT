const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wflMedal', {
  getState: () => ipcRenderer.invoke('get-state'),
  getAudienceState: () => ipcRenderer.invoke('get-audience-state'),
  syncSeason: () => ipcRenderer.invoke('sync-season'),
  setActiveGrade: (gradeId) => ipcRenderer.invoke('set-active-grade', gradeId),
  selectGame: (gameId) => ipcRenderer.invoke('select-game', gameId),
  setVotes: (gameId, votes) => ipcRenderer.invoke('set-votes', gameId, votes),
  assignVote: (gameId, playerId) => ipcRenderer.invoke('assign-vote', gameId, playerId),
  clearVotes: (gameId) => ipcRenderer.invoke('clear-votes', gameId),
  fillRandomVotes: () => ipcRenderer.invoke('fill-random-votes'),
  addSponsor: () => ipcRenderer.invoke('add-sponsor'),
  renameSponsor: (id, name) => ipcRenderer.invoke('rename-sponsor', id, name),
  removeSponsor: (id) => ipcRenderer.invoke('remove-sponsor', id),
  moveSponsor: (id, direction) => ipcRenderer.invoke('move-sponsor', id, direction),
  toggleAudience: () => ipcRenderer.invoke('toggle-audience'),
  presentationSetGrade: (gradeId) => ipcRenderer.invoke('presentation-set-grade', gradeId),
  presentationStart: (payload) => ipcRenderer.invoke('presentation-start', payload),
  presentationGoto: (index) => ipcRenderer.invoke('presentation-goto', index),
  presentationStep: (delta) => ipcRenderer.invoke('presentation-step', delta),
  scoreboardSetRound: (roundId) => ipcRenderer.invoke('scoreboard-set-round', roundId),
  scoreboardToggleSponsor: (id) => ipcRenderer.invoke('scoreboard-toggle-sponsor', id),
  showScoreboard: () => ipcRenderer.invoke('show-scoreboard'),
  showLeaderboard: (scope) => ipcRenderer.invoke('show-leaderboard', scope),
  showSplash: () => ipcRenderer.invoke('show-splash'),
  showToty: (restart) => ipcRenderer.invoke('show-toty', restart),
  showLifeMembers: (restart) => ipcRenderer.invoke('show-life-members', restart),
  setTotySponsor: (id) => ipcRenderer.invoke('set-toty-sponsor', id),
  addLifeMember: (playerId) => ipcRenderer.invoke('add-life-member', playerId),
  addLifeMemberCustom: (payload) => ipcRenderer.invoke('add-life-member-custom', payload),
  updateLifeMember: (id, patch) => ipcRenderer.invoke('update-life-member', id, patch),
  setLifeMemberPhoto: (id) => ipcRenderer.invoke('set-life-member-photo', id),
  clearLifeMemberPhoto: (id) => ipcRenderer.invoke('clear-life-member-photo', id),
  removeLifeMember: (id) => ipcRenderer.invoke('remove-life-member', id),
  moveLifeMember: (id, direction) => ipcRenderer.invoke('move-life-member', id, direction),
  clearLifeMembers: () => ipcRenderer.invoke('clear-life-members'),
  showPresentation: () => ipcRenderer.invoke('show-presentation'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  savePrintPdf: (fileName) => ipcRenderer.invoke('save-print-pdf', fileName),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  resetSeason: () => ipcRenderer.invoke('reset-season'),
  setCompetition: (value) => ipcRenderer.invoke('set-competition', value),
  setTotyPlayer: (gradeId, positionId, playerId) => ipcRenderer.invoke('set-toty-player', gradeId, positionId, playerId),
  clearToty: (gradeId) => ipcRenderer.invoke('clear-toty', gradeId),
  onState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('state-update', handler);
    return () => ipcRenderer.removeListener('state-update', handler);
  },
  onStateCursor: (callback) => {
    const handler = (_event, patch) => callback(patch);
    ipcRenderer.on('state-cursor', handler);
    return () => ipcRenderer.removeListener('state-cursor', handler);
  },
  onAudience: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('audience-update', handler);
    return () => ipcRenderer.removeListener('audience-update', handler);
  },
});
