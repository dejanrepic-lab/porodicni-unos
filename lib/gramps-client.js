// This client only uses read-only Gramps endpoints. Credentials never leave
// the server and each operation obtains its own short-lived access token.
function createGrampsClient({ baseUrl, username, password, fetchImpl = fetch }) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Neispravna Gramps adresa.');
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(new URL(path, base), { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
    } catch {
      throw new Error('Nije moguće povezati se sa Gramps Webom.');
    }
    if (!response.ok) throw new Error(`Gramps Web nije prihvatio zahtjev (HTTP ${response.status}).`);
    try { return await response.json(); } catch { throw new Error('Neispravan odgovor Gramps Weba.'); }
  }
  async function snapshot() {
    const session = await request('api/token/', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password }),
    });
    if (typeof session.access_token !== 'string' || !session.access_token) throw new Error('Prijava u Gramps Web nije uspjela.');
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const [people, families, events, places, notes] = await Promise.all(
      ['people', 'families', 'events', 'places', 'notes'].map(type => request(`api/${type}/`, { headers }))
    );
    if (![people, families, events, places, notes].every(Array.isArray)) throw new Error('Gramps je vratio nepotpune podatke.');
    return { people, families, events, places, notes };
  }
  return { snapshot };
}

module.exports = { createGrampsClient };
