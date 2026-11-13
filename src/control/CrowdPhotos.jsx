import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import cornerArt from '../assets/lower-third-corner.png';

const api = window.wflMedal;

function saveDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function CrowdPhotos({ state }) {
  const crowd = state.crowd ?? {};
  const settings = state.settings ?? {};
  const waiting = crowd.waiting ?? [];
  const approved = crowd.approved ?? [];
  const shareUrl = crowd.shareUrl || '';
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!shareUrl) {
      setQr('');
      return;
    }
    let stale = false;
    void QRCode.toDataURL(shareUrl, { width: 1024, margin: 2 })
      .then((url) => {
        if (!stale) setQr(url);
      })
      .catch(() => setQr(''));
    return () => {
      stale = true;
    };
  }, [shareUrl]);

  const artSrc = crowd.customArt && crowd.artUrl ? crowd.artUrl : cornerArt;
  const live = state.audienceView === 'crowd';

  return (
    <div className="crowd-page">
      <header className="crowd-head">
        <div>
          <h2>Crowd photos</h2>
          <p className="muted">
            Anyone who scans the QR can send a photo from any network. Approve them here before they go on the wall.
          </p>
        </div>
        <div className="row">
          <button className={live ? 'primary' : ''} onClick={() => api.showCrowd()}>
            {live ? 'On audience' : 'Show on audience'}
          </button>
          {live ? (
            <button onClick={() => api.showPresentation()}>Back to medal count</button>
          ) : null}
          <button onClick={() => api.importCrowdPhotos()}>Add photos from this PC</button>
          <button onClick={() => api.openCrowdFolder()}>Open folder</button>
        </div>
      </header>

      <section className="crowd-share">
        {qr ? <img className="photos-qr" src={qr} alt="Code to scan to send photos" /> : <div className="photos-qr photos-qr-empty" />}
        <div className="crowd-share-text">
          <label className="settings-field">
            <strong>Put this up for the crowd</strong>
            <small>
              {crowd.anywhereReady
                ? 'Works from anywhere, on any phone.'
                : crowd.anywhereNote || 'Setting up access from anywhere…'}
            </small>
            <div className="crowd-field-row">
              <input readOnly value={shareUrl} onFocus={(event) => event.target.select()} placeholder="Starting photo page…" />
              <button disabled={!shareUrl} onClick={() => api.copyText(shareUrl)}>Copy</button>
              <button disabled={!qr} onClick={() => saveDataUrl(qr, `WFL-photos-${crowd.photoCode || 'code'}.png`)}>
                Save QR
              </button>
              {!crowd.anywhereReady ? (
                <button disabled={crowd.anywhereBusy} onClick={() => api.enableCrowdAnywhere()}>
                  {crowd.anywhereBusy ? 'Setting up anywhere…' : 'Retry anywhere access'}
                </button>
              ) : null}
            </div>
          </label>
          {(crowd.shareBases ?? []).length > 1 ? (
            <label className="settings-field">
              <strong>This PC’s address</strong>
              <select
                value={crowd.shareBase || ''}
                onChange={(event) => api.setCrowdShareBase(event.target.value)}
              >
                {(crowd.shareBases ?? []).map((base) => (
                  <option key={base} value={base}>
                    {String(base).replace(/^https?:\/\//, '')}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="settings-field">
            <strong>Crowd photo code</strong>
            <div className="crowd-field-row">
              <input readOnly value={crowd.photoCode || ''} onFocus={(event) => event.target.select()} />
              <button disabled={!crowd.photoCode} onClick={() => api.copyText(crowd.photoCode)}>Copy</button>
              <button onClick={() => api.resetCrowdPhotoCode()}>Reset</button>
            </div>
          </label>
        </div>
      </section>

      <section className="crowd-settings">
        <h3>Slideshow</h3>
        <div className="crowd-settings-grid">
          <SettingMs
            label="Hold each photo (ms)"
            value={settings.crowdHoldMs}
            min={2000}
            max={60000}
            step={500}
            onCommit={(value) => api.updateSettings({ crowdHoldMs: value })}
          />
          <SettingMs
            label="Dissolve (ms)"
            value={settings.crowdFadeMs}
            min={0}
            max={5000}
            step={50}
            onCommit={(value) => api.updateSettings({ crowdFadeMs: value })}
          />
          <SettingMs
            label="Check for new photos (ms)"
            value={settings.crowdPollMs}
            min={2000}
            max={30000}
            step={500}
            onCommit={(value) => api.updateSettings({ crowdPollMs: value })}
          />
          <SettingMs
            label="Max photos per phone"
            value={settings.crowdMaxPerSender}
            min={1}
            max={200}
            onCommit={(value) => api.updateSettings({ crowdMaxPerSender: value })}
          />
        </div>
        <div className="photos-lower-pick">
          <span className="tile-obs-label">Lower third image</span>
          <div className="photos-lower-row">
            <img className="photos-lower-preview" src={artSrc} alt="" />
            <div className="photos-lower-actions">
              <button onClick={() => api.pickCrowdArt()}>Pick from desktop</button>
              {crowd.customArt ? (
                <button onClick={() => api.clearCrowdArt()}>Use default</button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="crowd-queue">
        <header className="crowd-queue-head">
          <h3>
            Waiting to approve
            {waiting.length ? <span className="photos-count">{waiting.length} waiting</span> : null}
          </h3>
          {waiting.length ? (
            <button className="primary" onClick={() => api.approveAllCrowdPhotos()}>
              Approve all
            </button>
          ) : null}
        </header>
        {waiting.length ? (
          <ul className="photos-grid">
            {waiting.map((photo) => (
              <li key={photo.file} className="photos-item">
                <img src={photo.url} alt="" />
                <span className="photos-from">{photo.venue ? `${photo.from} · ${photo.venue}` : photo.from}</span>
                <div className="photos-actions">
                  <button className="photos-yes" onClick={() => api.approveCrowdPhoto(photo.file)}>
                    Put in slideshow
                  </button>
                  <button className="photos-no" onClick={() => api.denyCrowdPhoto(photo.file)}>
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {approved.length
              ? `Nothing waiting. ${approved.length} approved and in the slideshow.`
              : 'Nothing sent in yet.'}
          </p>
        )}
      </section>
    </div>
  );
}

function SettingMs({ label, value, min, max, step, onCommit }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);
  function commit() {
    const next = Number(draft);
    if (!Number.isFinite(next)) {
      setDraft(String(value ?? ''));
      return;
    }
    onCommit(next);
  }
  return (
    <label className="settings-field">
      <strong>{label}</strong>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
    </label>
  );
}
