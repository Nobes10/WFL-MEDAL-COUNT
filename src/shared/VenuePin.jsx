export function VenuePin({ name, compact = false }) {
  if (!name) return null;
  return (
    <span className={`venue-pin${compact ? ' compact' : ''}`} title={name}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2c3.3 0 6 2.6 6 5.9 0 4.4-6 11.6-6 11.6S6 12.3 6 7.9C6 4.6 8.7 2 12 2zm0 8.1a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z"
        />
      </svg>
      {compact ? null : <small>{name}</small>}
    </span>
  );
}
