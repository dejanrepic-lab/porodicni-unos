const test = require('node:test');
const assert = require('node:assert/strict');
const { selectDescendantBranch } = require('../lib/gramps-branch');

test('follows descendants and all their families without following spouses ancestry', () => {
  const people = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(handle => ({ handle }));
  const families = [
    { handle: 'root', father_handle: 'a', mother_handle: 'b', child_ref_list: [{ref:'c'}] },
    { handle: 'next', father_handle: 'c', mother_handle: 'd', child_ref_list: [{ref:'e'}] },
    { handle: 'second', father_handle: 'c', mother_handle: 'f', child_ref_list: [{ref:'g'}] },
    { handle: 'unrelated', father_handle: 'd', mother_handle: 'h', child_ref_list: [] },
    { handle: 'cycle', father_handle: 'e', child_ref_list: [{ref:'c'}] },
  ];
  const result = selectDescendantBranch('root', people, families);
  assert.deepEqual(result.people.map(p => p.handle), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.deepEqual(result.families.map(f => f.handle), ['root', 'next', 'second', 'cycle']);
});

test('rejects incomplete data rather than silently sharing a partial branch', () => {
  assert.throws(() => selectDescendantBranch('missing', [], []), /nije pronađena/);
  assert.throws(() => selectDescendantBranch('root', [], [{handle:'root', child_ref_list:[{ref:'x'}]}]), /djetetu/);
});
