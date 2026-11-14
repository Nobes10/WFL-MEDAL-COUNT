const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wflMedal', {
  getState: () => ipcRenderer.invoke('get-state'),
  getAudienceState: () => ipcRenderer.invoke('get-audience-state'),
  syncSeason: () => ipcRenderer.invoke('sync-season'),
  setActiveGrade: (gradeId) => ipcRenderer.invoke('set-active-grade', gradeId),
  selectGame: (gameId) => ipcRenderer.invoke('select-game', gameId),
  addSpecialtyAsset: (specialtyName, roundName) =>
    ipcRenderer.invoke('add-specialty-asset', specialtyName, roundName),
  removeSpecialtyAsset: (specialtyName) =>
    ipcRenderer.invoke('remove-specialty-asset', specialtyName),
  setSpecialtyAssetPin: (specialtyName) =>
    ipcRenderer.invoke('set-specialty-asset-pin', specialtyName),
  clearSpecialtyAssetPin: (specialtyName) =>
    ipcRenderer.invoke('clear-specialty-asset-pin', specialtyName),
  setSpecialtyAssetColors: (specialtyName, colors) =>
    ipcRenderer.invoke('set-specialty-asset-colors', specialtyName, colors),
  resetSpecialtyAssetColors: (specialtyName) =>
    ipcRenderer.invoke('reset-specialty-asset-colors', specialtyName),
  setSpecialtyAssetRound: (specialtyName, roundName) =>
    ipcRenderer.invoke('set-specialty-asset-round', specialtyName, roundName),
  setVotes: (gameId, votes) => ipcRenderer.invoke('set-votes', gameId, votes),
  assignVote: (gameId, playerId) => ipcRenderer.invoke('assign-vote', gameId, playerId),
  addGamePlayer: (gameId, player) => ipcRenderer.invoke('add-game-player', gameId, player),
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
  showCrowd: () => ipcRenderer.invoke('show-crowd'),
  setCrowdShareBase: (base) => ipcRenderer.invoke('set-crowd-share-base', base),
  approveCrowdPhoto: (file) => ipcRenderer.invoke('approve-crowd-photo', file),
  denyCrowdPhoto: (file) => ipcRenderer.invoke('deny-crowd-photo', file),
  approveAllCrowdPhotos: () => ipcRenderer.invoke('approve-all-crowd-photos'),
  importCrowdPhotos: () => ipcRenderer.invoke('import-crowd-photos'),
  pickCrowdArt: () => ipcRenderer.invoke('pick-crowd-art'),
  clearCrowdArt: () => ipcRenderer.invoke('clear-crowd-art'),
  openCrowdFolder: () => ipcRenderer.invoke('open-crowd-folder'),
  resetCrowdPhotoCode: () => ipcRenderer.invoke('reset-crowd-photo-code'),
  enableCrowdAnywhere: () => ipcRenderer.invoke('enable-crowd-anywhere'),
  showToty: (restart) => ipcRenderer.invoke('show-toty', restart),
  showLifeMembers: (restart) => ipcRenderer.invoke('show-life-members', restart),
  setTotySponsor: (id) => ipcRenderer.invoke('set-toty-sponsor', id),
  addNightExtra: (payload) => ipcRenderer.invoke('add-night-extra', payload),
  updateNightExtra: (id, patch) => ipcRenderer.invoke('update-night-extra', id, patch),
  removeNightExtra: (id) => ipcRenderer.invoke('remove-night-extra', id),
  addLifeMember: (playerId) => ipcRenderer.invoke('add-life-member', playerId),
  addLifeMemberCustom: (payload) => ipcRenderer.invoke('add-life-member-custom', payload),
  updateLifeMember: (id, patch) => ipcRenderer.invoke('update-life-member', id, patch),
  setLifeMemberPhoto: (id) => ipcRenderer.invoke('set-life-member-photo', id),
  clearLifeMemberPhoto: (id) => ipcRenderer.invoke('clear-life-member-photo', id),
  removeLifeMember: (id) => ipcRenderer.invoke('remove-life-member', id),
  moveLifeMember: (id, direction) => ipcRenderer.invoke('move-life-member', id, direction),
  clearLifeMembers: () => ipcRenderer.invoke('clear-life-members'),
  clearEnteredData: () => ipcRenderer.invoke('clear-entered-data'),
  saveNight: () => ipcRenderer.invoke('save-night'),
  showPresentation: () => ipcRenderer.invoke('show-presentation'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  savePrintPdf: (fileName) => ipcRenderer.invoke('save-print-pdf', fileName),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  resetSeason: () => ipcRenderer.invoke('reset-season'),
  setCompetition: (value) => ipcRenderer.invoke('set-competition', value),
  setPresentTarget: (target) => ipcRenderer.invoke('set-present-target', target),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
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
