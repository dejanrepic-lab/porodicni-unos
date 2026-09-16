# Backup i provjera podataka

Porodični unos čuva trajne podatke u `DATA_DIR` direktoriju. U standardnom containeru to je `/app/data`.

Trajni podaci uključuju:

- `porodicni-unos.db` — SQLite baza sa unosima i istorijom izmjena;
- `uploads/` — priložene fotografije i dokumenti.

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
- `manifest.json` sa vremenom izrade i brojem uploadovanih fajlova.

Baza u napravljenom backupu se ponovo provjerava prije nego što se backup proglasi uspješnim.

Za drugu backup lokaciju koristi `BACKUP_DIR`:

```bash
DATA_DIR=/app/data BACKUP_DIR=/backup/porodicni-unos npm run data:backup
```

Za 3-2-1 strategiju preporučljivo je gotov backup direktorij dodatno kopirati na drugi disk i/ili udaljenu lokaciju.

## Važno

Backup komanda ne briše stare backupe i ne mijenja aktivnu bazu. Retention/rotaciju radi na nivou svog backup sistema tek nakon što potvrdiš da postoje novije ispravne kopije.
