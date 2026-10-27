// Select a family's descendants from Gramps API objects without modifying them.
// Partners are included for context, but their other families are not followed
// unless they are descendants themselves.
function selectDescendantBranch(rootFamilyHandle, people, families) {
  const peopleByHandle = new Map(people.map(person => [person.handle, person]));
  const familiesByHandle = new Map(families.map(family => [family.handle, family]));
  if (!familiesByHandle.has(rootFamilyHandle)) throw new Error('Početna porodica nije pronađena.');

  const parentsToFamilies = new Map();
  for (const family of families) {
    for (const parent of [family.father_handle, family.mother_handle]) {
      if (!parent) continue;
      if (!parentsToFamilies.has(parent)) parentsToFamilies.set(parent, []);
      parentsToFamilies.get(parent).push(family.handle);
    }
  }
  const selectedFamilies = new Set();
  const selectedPeople = new Set();
  const descendantPeople = new Set();
  const pending = [rootFamilyHandle];
  while (pending.length) {
    const handle = pending.shift();
    if (selectedFamilies.has(handle)) continue;
    const family = familiesByHandle.get(handle);
    if (!family) throw new Error('Nedostaju podaci o porodici.');
    selectedFamilies.add(handle);
    for (const parent of [family.father_handle, family.mother_handle]) {
      if (!parent) continue;
      if (!peopleByHandle.has(parent)) throw new Error('Nedostaju podaci o roditelju.');
      selectedPeople.add(parent);
    }
    for (const child of family.child_ref_list || []) {
      if (!child.ref || !peopleByHandle.has(child.ref)) throw new Error('Nedostaju podaci o djetetu.');
      selectedPeople.add(child.ref);
      if (descendantPeople.has(child.ref)) continue;
      descendantPeople.add(child.ref);
      pending.push(...(parentsToFamilies.get(child.ref) || []));
    }
  }
  return {
    people: people.filter(person => selectedPeople.has(person.handle)),
    families: families.filter(family => selectedFamilies.has(family.handle)),
  };
}

module.exports = { selectDescendantBranch };
