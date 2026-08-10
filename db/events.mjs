// Inserts into the shared events.events table (see ../../docs/EVENTS.md) using
// the caller's own client/transaction, so the event commits atomically with
// whatever it describes.
export async function emitEvent(client, type, payload) {
  await client.query('INSERT INTO events.events (type, source_app, payload) VALUES ($1, $2, $3)', [
    type,
    'status',
    JSON.stringify(payload),
  ]);
}
