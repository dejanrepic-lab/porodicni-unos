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


## v1.2
- Detaljni korisnički i trajni pregled sada prikazuje sve podatke djeteta osnovne porodice prije podataka supružnika/partnera.


## v1.3
- Admin arhiva odgovora (Aktivni / Arhiva / Svi)
- Trajno brisanje odgovora zajedno sa uploadovanim fajlovima
- Vraćanje odgovora iz arhive
- Čistiji prikaz vrste veze u bloku Osnovna porodica

## v1.3.1
- Nakon slanja, dugmad za čuvanje i trajni pregled prikazuju se odmah na vrhu potvrde.
- Kompletan izvještaj ostaje ispod tih dugmadi.
- Ispravljena oznaka verzije u footeru.

## v1.4
- Polje „Ko šalje podatke?“ kod unosa pojedinca premješteno je na početak forme.
- Upload sada podržava dodavanje fajlova u više navrata bez poništavanja ranije izabranih fajlova.
- Prikazuje se lista izabranih priloga sa nazivom i veličinom.
- Svaki prilog se može pojedinačno ukloniti prije slanja.
- Pregled prije slanja prikazuje i spisak priloga.
- Maksimalno 10 priloga po unosu.

## v1.5
- Admin lista sada ima checkbox uz svaki odgovor.
- Dodano „Označi sve“.
- Dodano masovno „Obriši označene“ uz obaveznu potvrdu.
- Masovno brisanje briše i sve priložene fajlove vezane za označene odgovore.
- Nakon brisanja ostaješ u istom admin prikazu (Aktivni / Arhiva / Svi).

## v1.6
- Mobilni prikaz prilagođen za lakše popunjavanje prstom.
- Na telefonu većina polja ide u jednu kolonu.
- Veći tekst u labelama i inputima.
- Input polja i dugmad su viša i lakša za tap.
- Veći razmaci između polja i čitljiviji izvještaj.
- Desktop prikaz ostaje praktično nepromijenjen.

## v1.9
- Zadržana je jednostavna logika i skrol iz v1.6.
- Sekcije su vizuelno jasnije odvojene.
- Naslovi Otac, Majka, Djeca i ostale sekcije su naglašeniji.
- Kartice djece i njihovih porodica su urednije i lakše se skeniraju.
- Fokus na input polju je vidljiviji.
- Mobilni prikaz ima više prostora, veće zone za tap i bolji ritam skrolanja.
- Nema novih koraka, skrivenih sekcija ni dodatnog klikanja.

## v2.0
- Admin više ne koristi browser HTTP Basic Auth.
- Dodana normalna stranica `/admin/login`.
- Dodano dugme „Odjavi se“ u admin panelu.
- Admin prijava koristi potpisani HttpOnly cookie sa rokom trajanja.
- Nakon odjave pristup `/admin` ponovo traži prijavu.
- Može se podesiti `ADMIN_SESSION_HOURS` (podrazumijevano 12).
- Preporuka: postaviti stabilan `ADMIN_SESSION_SECRET` u Docker environment da admin sesije ostanu važeće i nakon restarta kontejnera.

## v2.0.1
- Ispravljen admin login: login stranica sada koristi postojeći `adminShell()` renderer.
- Riješena greška `page is not defined` na `/admin/login`.

## v2.1
- Dodana zajednička pristupna šifra za javnu formu (`FORM_ACCESS_PASSWORD`).
- Nakon ispravne šifre browser pamti pristup kroz potpisani HttpOnly cookie (`FORM_ACCESS_DAYS`, podrazumijevano 7 dana).
- Dodan `noindex, nofollow, noarchive` kroz HTML i HTTP `X-Robots-Tag`.
- Dodan rate limit za slanje obrazaca po IP adresi (`SUBMIT_RATE_LIMIT`, podrazumijevano 5 na sat).
- Admin login ostaje potpuno odvojen.
- Preporuka: postaviti `FORM_COOKIE_SECRET` kao poseban dugačak nasumičan tajni ključ.

## v2.2
- Dodano dugme „Preuzmi TXT“ u detaljnom admin prikazu svakog odgovora.
- TXT sadrži strukturirani izvještaj sa osnovnom porodicom, djecom, partnerima, potomcima, izvorom, napomenama i spiskom priloga.
- TXT je UTF-8 i pogodan je za arhiviranje u Nextcloud ili kopiranje podataka u Gramps.

## v2.3
- Trajni privatni link sada služi i za naknadno uređivanje postojećeg odgovora.
- Na trajnom pregledu dodano je dugme „Uredi podatke“.
- Uređivanje ne pravi novi odgovor: ažurira isti zapis i zadržava isti `public_id` / privatni link.
- Postojeći odgovori automatski rade sa ovom opcijom jer već imaju `public_id`.
- Admin detalj ima „Kopiraj privatni link“ i „Otvori kao korisnik“, pa admin može ponovo poslati link osobi koja ga je izgubila.
- Dodano je vrijeme posljednje izmjene (`updated_at`) uz automatsku migraciju postojeće SQLite baze.
- Kod izmjene je moguće dodati nove priloge; stari se zadržavaju. Ukupno je dozvoljeno najviše 10 priloga po odgovoru.
- Sekcije forme su i dalje otvorene po defaultu. Korisnik ih može ručno označiti kao završene i skupiti dugmetom „Završi sekciju“, pa ih ponovo otvoriti po potrebi.

## v2.4
- „Unos pojedinca“ sada ima sekciju Partner / supružnik.
- Partner ima ime, prezime, djevojačko prezime, nadimak, datum/mjesto rođenja, datum/mjesto smrti i vrstu veze.
- Dodana je dinamička sekcija „Djeca ovog para“ sa poljima ime i prezime, datum rođenja i mjesto rođenja.
- Novi podaci se prikazuju u pregledu prije slanja, trajnom pregledu, admin prikazu i TXT eksportu.
- Naknadno uređivanje preko privatnog trajnog linka podržava i partnera i djecu pojedinca.

## v2.4.1
- Ispravljen pogrešan raspored iz v2.4: Partner / supružnik i Djeca ovog para više se ne pojavljuju u glavnom „Unosu porodice“.
- „Unos pojedinca“ sada pravilno sadrži Partner / supružnik i Djeca ovog para, po logici porodičnog unosa.
- „Dopuna i izvor“ je zasebna završna sekcija kod unosa pojedinca.
- Dugme za završavanje sekcije premješteno je na kraj sekcije.
- Kod porodica djece dugme za završavanje također je na dnu kartice.
- Sekcije se i dalje mogu ponovo otvoriti bez gubitka unesenih podataka.

## v2.5
- Sekcija „Ko šalje podatke?“ više nema dugme za skupljanje.
- Mala sekcija „Osnovna porodica / Vrsta veze“ ostaje otvorena i vizuelno je kompaktnija.
- Neutralno dugme za završetak ostalih sekcija sada se zove „Dalje“.
- Klik na „Dalje“ skupi trenutnu sekciju i automatski pomjeri ekran na sljedeću sekciju.
- Skrol je podešen tako da korisnik i dalje vidi dio upravo završene sekcije, a sljedeća sekcija dolazi u prvi plan.
- Ista logika radi i za kartice djece osnovne porodice.
- Mobilna verzija ima manje dugmad, manje vertikalne razmake i kompaktnija polja, kako forma ne bi bila nepotrebno dugačka.


## v2.5.1
- Dodatno smanjen i zbijen mobilni prikaz: manji naslovi, dugmad, polja i razmaci.
- Kartice djece osnovne porodice automatski prikazuju uneseno ime i prezime djeteta.
- Kad je kartica djeteta sklopljena, odmah je jasno koje je dijete obrađeno.


## v2.5.2
- Kada se skupe sekcije „Otac“ i „Majka“, naslov sada prikazuje i uneseno ime i prezime.
- Primjer: „Otac — Pero Perić“ i „Majka — Mara Marić“.
- Naslov se ažurira uživo dok se upisuju podaci.
- Mali CSS dodatak da sažeti naslovi ljepše stanu na telefonu.

## v2.5.3
- Ispravljeno dugme „Kopiraj privatni link“ u admin detalju.
- Kopiranje sada koristi sigurniji `data-private-url` pristup.
- Ako Clipboard API nije dostupan, koristi fallback kopiranje, a zatim prompt kao posljednju opciju.

## v2.6
- Dodatno grafički ujednačen kompletan javni obrazac: kartice, tipografija, fokusi polja, dugmad, sažeti prikazi i mobilni razmaci.
- Mobilni prikaz je još kompaktniji bez smanjivanja čitljivosti.
- Dodan autosave nacrta u browser `localStorage`.
- Nacrt se automatski čuva nakon izmjena, pri odlasku taba u pozadinu i pri zatvaranju stranice.
- Ako korisnik kasnije ponovo otvori formu na istom uređaju/browseru, aplikacija ponudi „Nastavi nacrt“ ili „Obriši nacrt“.
- Nacrt se briše nakon uspješnog novog slanja.
- Kod uređivanja već poslanog trajnog unosa autosave nacrta se ne koristi, jer su ti podaci već vezani za serverski trajni link.
- Dodane su diskretne toast poruke za akcije oko nacrta.

## v2.6.1
- Ispravljeno dugme „Kopiraj privatni link“ u adminu.
- Funkcija za kopiranje je sada zaista uključena u admin HTML shell, gdje je dugme koristi.
- Zadržan fallback: Clipboard API → privremeni textarea copy → prompt.

## v2.6.2
- U admin panel dodano dugme „Korisnički prikaz“.
- Isto dugme postoji i u detalju pojedinačnog odgovora.
- Admin prelazi direktno na javnu formu bez ponovnog unošenja porodične pristupne šifre.
- Ruta `/admin/user-mode` je zaštićena admin sesijom i postavlja standardni cookie za pristup javnoj formi.

## v2.7
- Dodan posebni direktni pristupni link za Nextcloud.
- Ruta je `/family-access/<token>`.
- Token se podešava kroz `NEXTCLOUD_ACCESS_TOKEN`.
- Ispravan link postavlja standardni cookie za pristup formi i preusmjerava korisnika na `/`.
- Običan pristup domeni i dalje traži zajedničku porodičnu šifru.
- Token nije hardkodiran u aplikaciju i može se promijeniti u ZimaOS environment varijablama.

## v2.8
- Dodan trajni kratki Nextcloud ulaz: `/porodica`.
- Link `https://porodica.repkonet.com/porodica` može se kopirati u više različitih Nextcloud foldera.
- Klik na `/porodica` postavlja standardni cookie za pristup formi i preusmjerava na `/`.
- Običan pristup na `https://porodica.repkonet.com` i dalje koristi postojeću porodičnu šifru.
- Postojeća token ruta `/family-access/<token>` ostaje dostupna.
- Važno: `/porodica` je sam po sebi pristupni link; svako ko ga sazna može ga koristiti.

## v2.8.1
- Ispravljena greška `Maximum call stack size exceeded` na `/porodica`.
- Funkcija za direktni Nextcloud pristup sada pravilno postavlja form access cookie i preusmjerava na `/`.
- `/family-access/<token>` koristi isti provjereni helper.

## v2.9
- Generičko dugme „Dalje“ zamijenjeno je jasnim, kontekstualnim tekstom.
- Otac: „Završi unos za oca“.
- Majka: „Završi unos za majku“.
- Djeca osnovne porodice: „Završi unos djece osnovne porodice“.
- Svaka kartica djeteta koristi redni broj dok nema imena, npr. „Završi unos za Dijete 1“.
- Kad se upiše ime/prezime djeteta, dugme se automatski mijenja, npr. „Završi unos za Dejan Repić“.
- Ostale sekcije imaju odgovarajuće tekstove poput „Završi izvor i napomene“, „Završi priloge“ itd.
- Nakon zatvaranja sekcije dugme i dalje glasi „Otvori ponovo“.

## v2.9.1
- Sekcija „Djeca ove porodice“ sada koristi isti automatski naziv roditelja koji se prikazuje gore.
- Primjer: „Djeca od Repić Sretko & Vesna“ (tačno prema automatskom naslovu aplikacije).
- Naslov se automatski mijenja čim se promijene podaci o ocu ili majci.
- Dugme za završetak sekcije prati isti naziv roditelja.

## v2.9.2
- Privatni link `/receipt/<publicId>` sada sam odobrava standardni pristup formi.
- Korisnik koji je sačuvao svoj privatni link više ne mora ponovo unositi zajedničku porodičnu šifru.
- Isto važi kada admin korisniku pošalje njegov privatni link.
- Nakon otvaranja privatnog linka korisnik može otvoriti „Uredi podatke“ i nastaviti uređivanje istog zapisa.
- Obični pristup domeni i dalje ostaje zaštićen zajedničkom porodičnom šifrom.
- Privatni receipt link ostaje bearer-link: ko ga ima može pristupiti tom konkretnom unosu.

## v2.9.3
- Ispravljena receipt ruta: `/receipt/<publicId>` više nije iza `formAccessRequired` middlewarea.
- Privatni link prvo provjerava da zapis postoji, pa tek onda odobrava standardni pristup formi.
- Važeći privatni link sada otvara korisnikov unos bez ponovnog unošenja zajedničke porodične šifre.
- Nevažeći/nasumični receipt link ne odobrava pristup.

## v2.10
- Prije svake dorade postojećeg unosa čuva se prethodna verzija podataka u `submission_history`.
- Admin detalj prikazuje „Šta je promijenjeno“ za posljednju doradu.
- Promjene su označene kao „Dopunjeno“, „Izmijenjeno“ ili „Obrisano“.
- Prikazuju se vrijednosti prije i poslije izmjene.
- U admin listi uređeni zapisi imaju oznaku „DORAĐENO“.
- Postojeći zapisi nastavljaju raditi; istorija počinje od prve dorade nakon v2.10.

## v2.10.1
- Oznaka „DORAĐENO“ sada se prikazuje i u glavnoj admin listi.
- Učitavanje istorije u admin detalju pomjereno je iza provjere da zapis postoji.

## v2.10.2
- Kod uređivanja privatnog linka postojeće polje „Ko šalje podatke?“ mijenja smisao u „Podatke šalje / doradu vrši“.
- Ne uvodi se novo dodatno polje.
- Ime iz tog polja čuva se uz svaku doradu u istoriji kao `changed_by`.
- Istorija bilježi i način izmjene (`private_link` / rezervisano za `admin`).
- Admin detalj prikazuje ko je izvršio posljednju doradu.
- Ako ime nije uneseno, koristi se postojeće ime pošiljaoca ili generički opis „Korisnik preko privatnog linka“.

## v2.10.3
- Ispravljena inicijalizacija `editPublicId`.
- Privatni link „Uredi podatke“ ponovo učitava postojeće podatke umjesto praznog obrasca.
- Zadržano označavanje „Podatke šalje / doradu vrši“ u edit modu.

## v2.11
- Admin tabela sada ima odvojene kolone „Prvi unos“ i „Zadnja izmjena“.
- Kod dorađenih zapisa u koloni zadnje izmjene prikazuje se i ko je izvršio doradu.
- Dodana pretraga po naslovu porodice / pojedinca i pošiljaocu.
- Aktivni / Arhiva / Svi zadržavaju tekst pretrage pri prebacivanju između prikaza.
- Admin lista se sortira po najnovijoj aktivnosti (zadnja izmjena ili prvi unos).
- Oznaka „DORAĐENO“ ostaje jasno vidljiva uz naslov.
