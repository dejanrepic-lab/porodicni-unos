const test = require('node:test');
const assert = require('node:assert/strict');
const { createGrampsClient } = require('../lib/gramps-client');

test('authenticates and retrieves the complete read-only snapshot', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, json: async () => String(url).endsWith('/token/') ? {access_token:'secret'} : [] };
  };
  const result = await createGrampsClient({baseUrl:'http://gramps:5014/', username:'reader', password:'pw', fetchImpl}).snapshot();
  assert.deepEqual(result, {people:[], families:[], events:[], places:[], notes:[]});
  assert.equal(calls.length, 6);
  assert.equal(calls[0].options.method, 'POST');
  for (const call of calls.slice(1)) {
    assert.equal(call.options.method, undefined);
    assert.equal(call.options.headers.Authorization, 'Bearer secret');
    assert.equal(call.options.redirect, 'error');
  }
});

test('rejects invalid API responses and avoids exposing credentials in errors', async () => {
  const fetchImpl = async () => { throw new Error('pw'); };
  await assert.rejects(createGrampsClient({baseUrl:'http://localhost:5014',username:'reader',password:'pw',fetchImpl}).snapshot(), /Nije moguće povezati/);
  assert.throws(() => createGrampsClient({baseUrl:'http://user:pw@localhost',username:'x',password:'x'}), /Neispravna/);
});
