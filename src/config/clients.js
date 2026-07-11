// ---------------------------------------------------------
// View-layer over `users` (from AuthContext). No separate
// Client entity exists in storage — every account with
// role: 'user' IS the client an account manager oversees.
// This just gives that concept a real name in code instead
// of repeating `role === 'user'` in every page that needs
// a roster. Pure functions, no state of their own.
// ---------------------------------------------------------

export function getClients(users) {
  return users.filter((u) => u.role === 'user')
}

export function getClientById(users, id) {
  return getClients(users).find((u) => u.id === id)
}

export function getClientCount(users) {
  return getClients(users).length
}

export function getFlaggedClientCount(users) {
  return getClients(users).filter((u) => u.flaggedForReview).length
}
