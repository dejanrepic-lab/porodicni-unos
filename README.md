# Porodični unos – ZimaOS/Docker

Minimalna web aplikacija za prikupljanje porodičnih podataka od rodbine i kasniji ručni unos u Gramps.

## Šta radi

- jedan javni link za unos porodice ili pojedinca
- dinamičko `+ Dodaj dijete osnovne porodice`
- dinamičko `+ Dodaj dijete ovog para`
- automatski naslov porodice iz imena/prezimena oca i majke
- pregled prije slanja
- nakon slanja prikazuje potvrdu i isti pregled
- SQLite baza (jedan fajl)
- opcionalni upload do 10 PDF/slika po odgovoru
- administratorski pregled svih odgovora
- status `novo` / `obrađeno`
- CSV pregled odgovora

## Pokretanje na ZimaOS-u

1. Raspakuj cijeli folder na ZimaOS, npr. `porodicni-unos`.
2. Otvori `docker-compose.yml` i OBAVEZNO promijeni:
   - `ADMIN_USER`
   - `ADMIN_PASSWORD`
3. U ZimaOS-u pokreni Compose projekt iz tog foldera (ili u terminalu `docker compose up -d --build`).
4. Forma će biti na:
   - `http://IP-TVOG-SERVERA:8787/`
5. Administracija je na:
   - `http://IP-TVOG-SERVERA:8787/admin`
6. Za javni internet preporučeno je usmjeriti svoju HTTPS poddomenu preko reverse proxyja na port 8787.

## Podaci i backup

Sve trajno je u `./data`:

- `data/porodicni-unos.db` – SQLite baza
- `data/uploads/` – dokumenti i fotografije

Za backup je dovoljno redovno kopirati cijeli `data` folder.

## Upload

Dozvoljeni tipovi: PDF, JPG, PNG, WEBP, HEIC/HEIF.
Podrazumijevani limit je 15 MB po fajlu; mijenja se preko `MAX_UPLOAD_MB`.

## Sigurnost

- javna forma ne zahtijeva nalog
- `/admin` je zaštićen HTTP Basic prijavom
- koristi jaku administratorsku lozinku
- za izlaganje internetu koristi HTTPS reverse proxy

## Napomena

Prva verzija je namjerno jednostavna: nema registracije rodbine, automatskog Gramps importa ni komplikovanih korisničkih uloga.


## Potvrda za osobu koja šalje podatke

Nakon slanja korisnik dobija pregled poslanih podataka, trajni privatni link na taj odgovor, dugme **Kopiraj link** i dugme **Sačuvaj / štampaj kao PDF**. Trajni link ne zahtijeva administratorsku prijavu, zato ga treba tretirati kao privatni link.
