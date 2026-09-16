# Backup, provjera i restore podataka

Porodični unos čuva trajne podatke u `DATA_DIR` direktoriju. U standardnom containeru to je `/app/data`.

Trajni podaci uključuju:

- `porodicni-unos.db` — SQLite baza sa unosima i istorijom izmjena;
- `uploads/` — priložene fotografije i dokumenti;
- `.admin-session-secret` — automatski generisan secret za stabilne admin sesije, ako `ADMIN_SESSION_SECRET` nije ručno podešen.

## Provjera baze

U containeru ili lokalnoj instalaciji pokreni:

```bash
npm run data:check
```

Komanda izvršava SQLite `quick_check` i `foreign_key_check`. Završava greškom ako baza nije ispravna.

Ako `DATA_DIR` nije standardni `./data` direktorij, postavi ga eksplicitno:

```bash
DATA_DIR=/app/data npm run data:check
```

## Provjeren backup

Pokreni:

```bash
npm run data:backup
```

Po defaultu backup nastaje u `DATA_DIR/backups/porodicni-unos-<timestamp>/` i sadrži:

- konzistentan SQLite snapshot napravljen SQLite backup API-jem;
- kopiju `uploads/` direktorija;
- kopiju `.admin-session-secret` fajla ako postoji;
- `manifest.json` sa verzijom backup formata, vremenom izrade i brojem uploadovanih fajlova.

Baza u napravljenom backupu se ponovo provjerava prije nego što se backup proglasi uspješnim.

Za drugu backup lokaciju koristi `BACKUP_DIR`:

```bash
DATA_DIR=/app/data BACKUP_DIR=/backup/porodicni-unos npm run data:backup
```

Za 3-2-1 strategiju preporučljivo je gotov backup direktorij dodatno kopirati na drugi disk i/ili udaljenu lokaciju.

## Restore

Restore radi samo kada je aplikacija/container **zaustavljen**. Nemoj vraćati podatke dok `server.js` ima otvorenu SQLite bazu.

Primjer za backup direktorij:

```bash
DATA_DIR=/app/data npm run data:restore -- /backup/porodicni-unos/porodicni-unos-2026-09-16T05-00-00-000Z --confirm-stopped
```

`--confirm-stopped` je namjerna sigurnosna potvrda. Bez nje restore se odbija izvršiti.

Prije nego aktivne podatke zamijeni sadržajem iz odabranog backupa, restore automatski pravi **safety backup trenutnog stanja** u:

```text
DATA_DIR/backups/pre-restore/
```

Zatim:

1. provjerava SQLite bazu iz odabranog backupa;
2. pravi safety backup trenutne baze, uploadova i session secreta;
3. vraća `porodicni-unos.db`;
4. vraća `uploads/`;
5. vraća `.admin-session-secret` ako ga backup sadrži;
6. ponovo izvršava SQLite provjeru nad vraćenom aktivnom bazom.

Stari backup format bez `.admin-session-secret` ostaje podržan; u tom slučaju postojeći aktivni secret se ne prepisuje.

Nakon restorea ponovo pokreni aplikaciju/container i provjeri `/health`, admin panel i nekoliko reprezentativnih unosa/priloga.

## Važno

Backup komanda ne briše stare backupe i ne mijenja aktivnu bazu. Restore namjerno ne radi dok aplikacija nije zaustavljena i prije izmjene aktivnih podataka pravi safety kopiju. Retention/rotaciju radi na nivou svog backup sistema tek nakon što potvrdiš da postoje novije ispravne kopije.
