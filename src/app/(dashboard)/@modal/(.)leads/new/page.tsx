// Shadows (.)leads/[id] for the literal "new" segment — without this, the
// modal slot's dynamic [id] route intercepts /leads/new and tries to load a
// lead with id "new", which isn't a UUID and crashes the query. Rendering
// null here means the modal slot has nothing to show, so /leads/new falls
// through to the real page.tsx in the main leads/new route (not this slot).
export default function Default() {
  return null;
}
