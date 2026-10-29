# Porodični unos

Jednostavna, self-hosted web aplikacija za prikupljanje porodičnih i genealoških podataka od članova porodice, sa ciljem da se provjereni podaci kasnije ručno unesu u **Gramps**.

**Trenutna verzija: v2.11**

## Šta aplikacija radi

Aplikacija omogućava dva načina unosa:

- **Unos porodice** — roditelji, djeca osnovne porodice, partneri/supružnici djece i njihova djeca.
- **Unos pojedinca** — podaci o jednoj osobi, roditeljima, partneru/supružniku i djeci.

Podaci se čuvaju u SQLite bazi, a dokumenti i fotografije u persistent data direktoriju.

## Glavne mogućnosti

- Javni porodični obrazac bez korisničkih naloga.
- Zajednička pristupna šifra za javni ulaz.
- Poseban Nextcloud ulaz preko `/porodica`.
- Privatni link za svaki poslani odgovor.
- Naknadno uređivanje istog zapisa preko privatnog linka.
- Privatni link ne traži ponovno unošenje zajedničke porodične šifre.
- Autosave nacrta u browseru za nove neposlane forme.
- Do 10 priloga po odgovoru.
- Podržani PDF, JPEG, PNG, WebP, HEIC i HEIF fajlovi.
- Admin panel sa statusima, arhivom, brisanjem, CSV i TXT izvozom.
- Pretraga po naslovu porodice / pojedinca i pošiljaocu.
- Posebne kolone **Prvi unos** i **Zadnja izmjena**.
- Istorija dorada sa prikazom šta je promijenjeno.
- Evidencija ko je izvršio doradu na osnovu polja **Podatke šalje / doradu vrši**.

## Podaci i persistent storage

Aplikacija u containeru koristi:

```text
/app/data
```

Preporučeni bind mount na ZimaOS-u:

```text
/DATA/AppData/porodicni-unos/data:/app/data
```

U tom direktoriju se čuvaju SQLite baza i uploadovani prilozi.

> Zamjena Docker image-a ili restart containera ne brišu podatke dok god se koristi isti persistent volume.

## Environment varijable

Primjer:

```env
PORT=8787
DATA_DIR=/app/data

ADMIN_USER=admin
ADMIN_PASSWORD=promijeni-me
ADMIN_SESSION_SECRET=dugacak-nasumican-secret
ADMIN_SESSION_HOURS=12

FORM_ACCESS_PASSWORD=porodicna-sifra
FORM_ACCESS_DAYS=7
FORM_COOKIE_SECRET=drugi-dugacak-secret

MAX_UPLOAD_MB=15
SUBMIT_RATE_LIMIT=5
TZ=Europe/Vienna

NEXTCLOUD_ACCESS_TOKEN=opcioni-dugacak-token
```

## Nextcloud pristup


> **Napomena:** Primjeri URL-ova u ovom README-u su namjerno generički. Zamijeni `your-domain.example` svojim domenom prilikom instalacije.


Za Link Editor u Nextcloudu koristi svoj javni domen, na primjer:

```text
https://your-domain.example/porodica
```

Isti link se može postaviti u više različitih Nextcloud foldera. Korisnik koji dobije pristup takvom folderu može klikom direktno otvoriti obrazac.

Obični ulaz:

```text
https://your-domain.example
```

i dalje koristi zajedničku porodičnu šifru.

## Privatni linkovi i dorade

Nakon slanja obrasca korisnik dobija privatni `/receipt/...` link.

Taj link:

- otvara konkretni poslani zapis;
- omogućava naknadno uređivanje istog zapisa;
- ne traži ponovno unošenje zajedničke porodične šifre;
- ponaša se kao pristupni ključ za taj konkretni zapis.

Kod naknadne dorade prethodna verzija podataka čuva se u SQLite tabeli `submission_history`.

Admin može vidjeti:

- da je zapis **DORAĐEN**;
- vrijeme prve prijave;
- vrijeme zadnje izmjene;
- ko je izvršio zadnju doradu;
- šta je dodano, izmijenjeno ili obrisano.

## Admin panel

Admin panel je dostupan na:

```text
/admin
```

Mogućnosti uključuju:

- aktivne, arhivirane i sve odgovore;
- pretragu;
- status novo / obrađeno;
- arhiviranje i vraćanje iz arhive;
- pojedinačno i masovno brisanje;
- CSV pregled;
- TXT izvoz pojedinačnog odgovora;
- kopiranje privatnog linka;
- otvaranje odgovora kao korisnik;
- pregled istorije dorada.


## Licenca

Ovaj projekat je objavljen pod **MIT licencom**.

To znači da ga drugi mogu slobodno:

- koristiti privatno ili javno;
- instalirati na svom serveru;
- mijenjati i prilagođavati svojim potrebama;
- napraviti vlastiti fork;
- distribuirati dalje;
- koristiti i u drugim projektima.

Jedini glavni uslov je da se originalna MIT licenca i copyright napomena zadrže uz kopiju projekta.

Softver se daje **bez garancije** — svako ga koristi na vlastitu odgovornost.

Puni tekst licence nalazi se u fajlu [`LICENSE`](LICENSE).

## Docker / GHCR

Aplikacija se gradi kroz GitHub Actions i objavljuje kao:

```text
ghcr.io/YOUR_GITHUB_USERNAME/porodicni-unos:latest
```

ZimaOS zatim koristi taj image za pokretanje aplikacije.

## Napomena o sigurnosti

Aplikacija je namijenjena porodičnoj, kontrolisanoj upotrebi.

Privatni receipt linkovi i `/porodica` link funkcionišu kao bearer-linkovi: osoba koja zna odgovarajući URL može ga koristiti. Zato ih treba dijeliti samo osobama kojima je pristup namijenjen.

---

# Istorija verzija

Najnovije izmjene su prikazane prve.

### UI osvježenje (mobilni + desktop)
- Novi `public/app.css` zamjenjuje pet slojeva inline CSS-a (v1.6–v2.6) koji su se poništavali kroz `!important`. Nazivi klasa su isti, JS nije mijenjan.
- Polja imaju 16px font i najmanje 48px visine (ranije 14px / 42px), čime se na iPhone-u izbjegava automatski zoom pri unosu.
- Ispravljen naslov „Porodica: …“ (bijel tekst na svijetloj podlozi) i zalutala plava crta uz „Prva osoba“ / „Partner“ u pregledu grane.
- Dugme „Pregled unosa“ ostaje zalijepljeno na dnu ekrana na telefonu i tabletu.
- Polja se same raspoređuju u 1–3 kolone zavisno od širine; vidljiv fokus za tastaturu; `prefers-reduced-motion`; osnovni stil za štampu.
- Pregled grane prikazuje datume kao `15.02.1956` (samo prikaz, spremljeni podaci se ne mijenjaju).

### v2.11
- Admin tabela sada ima odvojene kolone „Prvi unos“ i „Zadnja izmjena“.
- Kod dorađenih zapisa u koloni zadnje izmjene prikazuje se i ko je izvršio doradu.
- Dodana pretraga po naslovu porodice / pojedinca i pošiljaocu.
- Aktivni / Arhiva / Svi zadržavaju tekst pretrage pri prebacivanju između prikaza.
- Admin lista se sortira po najnovijoj aktivnosti (zadnja izmjena ili prvi unos).
- Oznaka „DORAĐENO“ ostaje jasno vidljiva uz naslov.

### v2.10.3
- Ispravljena inicijalizacija `editPublicId`.
- Privatni link „Uredi podatke“ ponovo učitava postojeće podatke umjesto praznog obrasca.
- Zadržano označavanje „Podatke šalje / doradu vrši“ u edit modu.

### v2.10.2
- Kod uređivanja privatnog linka postojeće polje „Ko šalje podatke?“ mijenja smisao u „Podatke šalje / doradu vrši“.
- Ne uvodi se novo dodatno polje.
- Ime iz tog polja čuva se uz svaku doradu u istoriji kao `changed_by`.
- Istorija bilježi i način izmjene (`private_link` / rezervisano za `admin`).
- Admin detalj prikazuje ko je izvršio posljednju doradu.
- Ako ime nije uneseno, koristi se postojeće ime pošiljaoca ili generički opis „Korisnik preko privatnog linka“.

### v2.10.1
- Oznaka „DORAĐENO“ sada se prikazuje i u glavnoj admin listi.
- Učitavanje istorije u admin detalju pomjereno je iza provjere da zapis postoji.

### v2.10
- Prije svake dorade postojećeg unosa čuva se prethodna verzija podataka u `submission_history`.
- Admin detalj prikazuje „Šta je promijenjeno“ za posljednju doradu.
- Promjene su označene kao „Dopunjeno“, „Izmijenjeno“ ili „Obrisano“.
- Prikazuju se vrijednosti prije i poslije izmjene.
- U admin listi uređeni zapisi imaju oznaku „DORAĐENO“.
- Postojeći zapisi nastavljaju raditi; istorija počinje od prve dorade nakon v2.10.

### v2.9.3
- Ispravljena receipt ruta: `/receipt/<publicId>` više nije iza `formAccessRequired` middlewarea.
- Privatni link prvo provjerava da zapis postoji, pa tek onda odobrava standardni pristup formi.
- Važeći privatni link sada otvara korisnikov unos bez ponovnog unošenja zajedničke porodične šifre.
- Nevažeći/nasumični receipt link ne odobrava pristup.

### v2.9.2
- Privatni link `/receipt/<publicId>` sada sam odobrava standardni pristup formi.
- Korisnik koji je sačuvao svoj privatni link više ne mora ponovo unositi zajedničku porodičnu šifru.
- Isto važi kada admin korisniku pošalje njegov privatni link.
- Nakon otvaranja privatnog linka korisnik može otvoriti „Uredi podatke“ i nastaviti uređivanje istog zapisa.
- Obični pristup domeni i dalje ostaje zaštićen zajedničkom porodičnom šifrom.
- Privatni receipt link ostaje bearer-link: ko ga ima može pristupiti tom konkretnom unosu.

### v2.9.1
- Sekcija „Djeca ove porodice“ sada koristi isti automatski naziv roditelja koji se prikazuje gore.
- Primjer: „Djeca od Repić Sretko & Vesna“ (tačno prema automatskom naslovu aplikacije).
- Naslov se automatski mijenja čim se promijene podaci o ocu ili majci.
- Dugme za završetak sekcije prati isti naziv roditelja.

### v2.9
- Generičko dugme „Dalje“ zamijenjeno je jasnim, kontekstualnim tekstom.
- Otac: „Završi unos za oca“.
- Majka: „Završi unos za majku“.
- Djeca osnovne porodice: „Završi unos djece osnovne porodice“.
- Svaka kartica djeteta koristi redni broj dok nema imena, npr. „Završi unos za Dijete 1“.
- Kad se upiše ime/prezime djeteta, dugme se automatski mijenja, npr. „Završi unos za Dejan Repić“.
- Ostale sekcije imaju odgovarajuće tekstove poput „Završi izvor i napomene“, „Završi priloge“ itd.
- Nakon zatvaranja sekcije dugme i dalje glasi „Otvori ponovo“.

### v2.8.1
- Ispravljena greška `Maximum call stack size exceeded` na `/porodica`.
- Funkcija za direktni Nextcloud pristup sada pravilno postavlja form access cookie i preusmjerava na `/`.
- `/family-access/<token>` koristi isti provjereni helper.

### v2.8
- Dodan trajni kratki Nextcloud ulaz: `/porodica`.
- Link `https://your-domain.example/porodica` može se kopirati u više različitih Nextcloud foldera.
- Klik na `/porodica` postavlja standardni cookie za pristup formi i preusmjerava na `/`.
- Običan pristup na `https://your-domain.example` i dalje koristi postojeću porodičnu šifru.
- Postojeća token ruta `/family-access/<token>` ostaje dostupna.
- Važno: `/porodica` je sam po sebi pristupni link; svako ko ga sazna može ga koristiti.

### v2.7
- Dodan posebni direktni pristupni link za Nextcloud.
- Ruta je `/family-access/<token>`.
- Token se podešava kroz `NEXTCLOUD_ACCESS_TOKEN`.
- Ispravan link postavlja standardni cookie za pristup formi i preusmjerava korisnika na `/`.
- Običan pristup domeni i dalje traži zajedničku porodičnu šifru.
- Token nije hardkodiran u aplikaciju i može se promijeniti u ZimaOS environment varijablama.

### v2.6.2
- U admin panel dodano dugme „Korisnički prikaz“.
- Isto dugme postoji i u detalju pojedinačnog odgovora.
- Admin prelazi direktno na javnu formu bez ponovnog unošenja porodične pristupne šifre.
- Ruta `/admin/user-mode` je zaštićena admin sesijom i postavlja standardni cookie za pristup javnoj formi.

### v2.6.1
- Ispravljeno dugme „Kopiraj privatni link“ u adminu.
- Funkcija za kopiranje je sada zaista uključena u admin HTML shell, gdje je dugme koristi.
- Zadržan fallback: Clipboard API → privremeni textarea copy → prompt.

### v2.6
- Dodatno grafički ujednačen kompletan javni obrazac: kartice, tipografija, fokusi polja, dugmad, sažeti prikazi i mobilni razmaci.
- Mobilni prikaz je još kompaktniji bez smanjivanja čitljivosti.
- Dodan autosave nacrta u browser `localStorage`.
- Nacrt se automatski čuva nakon izmjena, pri odlasku taba u pozadinu i pri zatvaranju stranice.
- Ako korisnik kasnije ponovo otvori formu na istom uređaju/browseru, aplikacija ponudi „Nastavi nacrt“ ili „Obriši nacrt“.
- Nacrt se briše nakon uspješnog novog slanja.
- Kod uređivanja već poslanog trajnog unosa autosave nacrta se ne koristi, jer su ti podaci već vezani za serverski trajni link.
- Dodane su diskretne toast poruke za akcije oko nacrta.

### v2.5.3
- Ispravljeno dugme „Kopiraj privatni link“ u admin detalju.
- Kopiranje sada koristi sigurniji `data-private-url` pristup.
- Ako Clipboard API nije dostupan, koristi fallback kopiranje, a zatim prompt kao posljednju opciju.

### v2.5.2
- Kada se skupe sekcije „Otac“ i „Majka“, naslov sada prikazuje i uneseno ime i prezime.
- Primjer: „Otac — Pero Perić“ i „Majka — Mara Marić“.
- Naslov se ažurira uživo dok se upisuju podaci.
- Mali CSS dodatak da sažeti naslovi ljepše stanu na telefonu.

### v2.5.1
- Dodatno smanjen i zbijen mobilni prikaz: manji naslovi, dugmad, polja i razmaci.
- Kartice djece osnovne porodice automatski prikazuju uneseno ime i prezime djeteta.
- Kad je kartica djeteta sklopljena, odmah je jasno koje je dijete obrađeno.

### v2.5
- Sekcija „Ko šalje podatke?“ više nema dugme za skupljanje.
- Mala sekcija „Osnovna porodica / Vrsta veze“ ostaje otvorena i vizuelno je kompaktnija.
- Neutralno dugme za završetak ostalih sekcija sada se zove „Dalje“.
- Klik na „Dalje“ skupi trenutnu sekciju i automatski pomjeri ekran na sljedeću sekciju.
- Skrol je podešen tako da korisnik i dalje vidi dio upravo završene sekcije, a sljedeća sekcija dolazi u prvi plan.
- Ista logika radi i za kartice djece osnovne porodice.
- Mobilna verzija ima manje dugmad, manje vertikalne razmake i kompaktnija polja, kako forma ne bi bila nepotrebno dugačka.

### v2.4.1
- Ispravljen pogrešan raspored iz v2.4: Partner / supružnik i Djeca ovog para više se ne pojavljuju u glavnom „Unosu porodice“.
- „Unos pojedinca“ sada pravilno sadrži Partner / supružnik i Djeca ovog para, po logici porodičnog unosa.
- „Dopuna i izvor“ je zasebna završna sekcija kod unosa pojedinca.
- Dugme za završavanje sekcije premješteno je na kraj sekcije.
- Kod porodica djece dugme za završavanje također je na dnu kartice.
- Sekcije se i dalje mogu ponovo otvoriti bez gubitka unesenih podataka.

### v2.4
- „Unos pojedinca“ sada ima sekciju Partner / supružnik.
- Partner ima ime, prezime, djevojačko prezime, nadimak, datum/mjesto rođenja, datum/mjesto smrti i vrstu veze.
- Dodana je dinamička sekcija „Djeca ovog para“ sa poljima ime i prezime, datum rođenja i mjesto rođenja.
- Novi podaci se prikazuju u pregledu prije slanja, trajnom pregledu, admin prikazu i TXT eksportu.
- Naknadno uređivanje preko privatnog trajnog linka podržava i partnera i djecu pojedinca.

### v2.3
- Trajni privatni link sada služi i za naknadno uređivanje postojećeg odgovora.
- Na trajnom pregledu dodano je dugme „Uredi podatke“.
- Uređivanje ne pravi novi odgovor: ažurira isti zapis i zadržava isti `public_id` / privatni link.
- Postojeći odgovori automatski rade sa ovom opcijom jer već imaju `public_id`.
- Admin detalj ima „Kopiraj privatni link“ i „Otvori kao korisnik“, pa admin može ponovo poslati link osobi koja ga je izgubila.
- Dodano je vrijeme posljednje izmjene (`updated_at`) uz automatsku migraciju postojeće SQLite baze.
- Kod izmjene je moguće dodati nove priloge; stari se zadržavaju. Ukupno je dozvoljeno najviše 10 priloga po odgovoru.
- Sekcije forme su i dalje otvorene po defaultu. Korisnik ih može ručno označiti kao završene i skupiti dugmetom „Završi sekciju“, pa ih ponovo otvoriti po potrebi.

### v2.2
- Dodano dugme „Preuzmi TXT“ u detaljnom admin prikazu svakog odgovora.
- TXT sadrži strukturirani izvještaj sa osnovnom porodicom, djecom, partnerima, potomcima, izvorom, napomenama i spiskom priloga.
- TXT je UTF-8 i pogodan je za arhiviranje u Nextcloud ili kopiranje podataka u Gramps.

### v2.1
- Dodana zajednička pristupna šifra za javnu formu (`FORM_ACCESS_PASSWORD`).
- Nakon ispravne šifre browser pamti pristup kroz potpisani HttpOnly cookie (`FORM_ACCESS_DAYS`, podrazumijevano 7 dana).
- Dodan `noindex, nofollow, noarchive` kroz HTML i HTTP `X-Robots-Tag`.
- Dodan rate limit za slanje obrazaca po IP adresi (`SUBMIT_RATE_LIMIT`, podrazumijevano 5 na sat).
- Admin login ostaje potpuno odvojen.
- Preporuka: postaviti `FORM_COOKIE_SECRET` kao poseban dugačak nasumičan tajni ključ.

### v2.0.1
- Ispravljen admin login: login stranica sada koristi postojeći `adminShell()` renderer.
- Riješena greška `page is not defined` na `/admin/login`.

### v2.0
- Admin više ne koristi browser HTTP Basic Auth.
- Dodana normalna stranica `/admin/login`.
- Dodano dugme „Odjavi se“ u admin panelu.
- Admin prijava koristi potpisani HttpOnly cookie sa rokom trajanja.
- Nakon odjave pristup `/admin` ponovo traži prijavu.
- Može se podesiti `ADMIN_SESSION_HOURS` (podrazumijevano 12).
- Preporuka: postaviti stabilan `ADMIN_SESSION_SECRET` u Docker environment da admin sesije ostanu važeće i nakon restarta kontejnera.

### v1.9
- Zadržana je jednostavna logika i skrol iz v1.6.
- Sekcije su vizuelno jasnije odvojene.
- Naslovi Otac, Majka, Djeca i ostale sekcije su naglašeniji.
- Kartice djece i njihovih porodica su urednije i lakše se skeniraju.
- Fokus na input polju je vidljiviji.
- Mobilni prikaz ima više prostora, veće zone za tap i bolji ritam skrolanja.
- Nema novih koraka, skrivenih sekcija ni dodatnog klikanja.

### v1.8
- Eksperimentalni collapsible pristup; kasnije napušten radi jednostavnosti.

### v1.7
- Eksperimentalni wizard; kasnije napušten jer je unos postao previše klik-heavy.

### v1.6
- Mobilni prikaz prilagođen za lakše popunjavanje prstom.
- Na telefonu većina polja ide u jednu kolonu.
- Veći tekst u labelama i inputima.
- Input polja i dugmad su viša i lakša za tap.
- Veći razmaci između polja i čitljiviji izvještaj.
- Desktop prikaz ostaje praktično nepromijenjen.

### v1.5
- Admin lista sada ima checkbox uz svaki odgovor.
- Dodano „Označi sve“.
- Dodano masovno „Obriši označene“ uz obaveznu potvrdu.
- Masovno brisanje briše i sve priložene fajlove vezane za označene odgovore.
- Nakon brisanja ostaješ u istom admin prikazu (Aktivni / Arhiva / Svi).

### v1.4
- Polje „Ko šalje podatke?“ kod unosa pojedinca premješteno je na početak forme.
- Upload sada podržava dodavanje fajlova u više navrata bez poništavanja ranije izabranih fajlova.
- Prikazuje se lista izabranih priloga sa nazivom i veličinom.
- Svaki prilog se može pojedinačno ukloniti prije slanja.
- Pregled prije slanja prikazuje i spisak priloga.
- Maksimalno 10 priloga po unosu.

### v1.3.1
- Nakon slanja, dugmad za čuvanje i trajni pregled prikazuju se odmah na vrhu potvrde.
- Kompletan izvještaj ostaje ispod tih dugmadi.
- Ispravljena oznaka verzije u footeru.

### v1.3
- Admin arhiva odgovora (Aktivni / Arhiva / Svi)
- Trajno brisanje odgovora zajedno sa uploadovanim fajlovima
- Vraćanje odgovora iz arhive
- Čistiji prikaz vrste veze u bloku Osnovna porodica

### v1.2
- Detaljni korisnički i trajni pregled sada prikazuje sve podatke djeteta osnovne porodice prije podataka supružnika/partnera.

## Porodični linkovi iz Gramps Weba (prva verzija)

U postojećem adminu otvori **Porodični linkovi → Napravi link iz Grampsa**.
Odaberi početnu porodicu i naziv primaoca. Aplikacija priprema zasebnu kopiju
te porodice, svih potomaka i njihovih partnera. Druge grane partnera ne prati.
Priprema je neaktivan nacrt: prvo pregledaj sadržaj, zatim aktiviraj link.
Rođak preko istog privatnog linka dopunjava osobe i dodaje djecu ili partnere.
Svaku osobu treba zasebno sačuvati. Izmjene ostaju sačuvane za nastavak.

Admin vidi poređenje s originalom i istoriju čuvanja, posljednju posjetu i
može isključiti ili ponovo aktivirati link. Original se ne osvježava preko
postojećih dorada. Nijedna dorada se automatski ne šalje u Gramps.

Podesi ove varijable u environmentu kontejnera i ponovo ga kreiraj:

```env
GRAMPS_URL=http://ADRESA_TVOG_SERVERA:5014
GRAMPS_USER=korisnik-za-citanje
GRAMPS_PASSWORD=njegova-lozinka
```

Koristi poseban Gramps nalog s pravom čitanja podataka koje želiš podijeliti.
Adresa mora biti dostupna iz kontejnera (localhost u kontejneru nije host).
Lozinka i pristupni token nikada se ne šalju rođaku niti se čuvaju u linku.
Za pristup rođaka koristi HTTPS. Ko ima link može čitati i uređivati tu granu.
Postojeći javni obrasci i odgovori ostaju nepromijenjeni.

Prva verzija priprema imena, rođenje i smrt s mjestima, bilješke, pregled
ostalih događaja i porodične veze. Osnovni podaci i bilješke se uređuju;
ostali događaji se prikazuju kao kontekst, a ispravke im se mogu opisati u
napomenama. Izmjene veza/brisanjem postojećih osoba i prenos medijskih fajlova
nisu uključeni. Nije riječ o potpunom Gramps editoru ili sinhronizaciji.
Podaci i istorija linkova čuvaju se u istoj SQLite bazi i uključeni su u backup.

### Kretanje kroz porodičnu granu

Link otvara hijerarhiju porodica i potomaka, sa prezimenom ispred imena.
Grane se otvaraju strelicom; klik na osobu otvara samo njen obrazac.
Pretraga obuhvata osobe unutar tog linka. Isti pregled radi na ranije
pripremljenim linkovima bez ponovnog uvoza i bez promjene sačuvanih podataka.

### Praćenje obrade porodičnih linkova

U admin pregledu linkova vide se otvorenost linka, status obrade, broj novih i izmijenjenih osoba i porodica, zadnje čuvanje i ime koje je uneseno uz izmjenu. Detalji linka prikazuju trenutne razlike u odnosu na podatke pripremljene iz Grampsa te istoriju čuvanja.

Rođak može na svojoj stranici označiti da je završio obradu; administrator zatim može označiti prijedloge kao pregledane. Nova izmjena nakon završetka ili pregleda vraća status na „U toku”. Oznaka pregledano ne prenosi podatke u Gramps. Podaci i statusi čuvaju se u postojećoj bazi; tabela za statuse stvara se automatski pri pokretanju. Imena unosilaca su upisana ručno i nisu potvrđeni nalozi.

Na listi i u detalju linka prikazuje se početna porodica i dostupni Gramps ID-ovi. Detalji najprije izdvajaju posljednju stvarnu promjenu, a zatim sve promjene od pripreme. Uz osobu se prikazuje put od početne porodice i roditelji, kada su poznati; naziv osobe otvara njene podatke.

U admin pregledu porodično stablo označava izmijenjene osobe, nove osobe i grane sa promjenama. Oznake blago pulsiraju; kretanje se isključuje ako korisnik ima podešenu opciju smanjenog kretanja. Prečice i dugmad „Prethodna” / „Sljedeća” vode kroz promijenjene osobe i porodice; odabirom se otvaraju konkretni podaci, odnosno članovi porodice. Tekstualni izvještaj ostaje dostupan u sklopljenom dijelu.

Kada administrator označi obradu pregledanom, oznake prestaju i sljedeći pregled ističe samo promjene nakon te tačke. Potpuni izvještaj prema podacima iz Grampsa i istorija ostaju dostupni.

Osoba dodana putem linka može se ukloniti na njenom obrascu uz potvrdu; njene veze iz linka se uklanjaju. Podaci iz Grampsa ostaju nepromijenjeni i osobe iz izvornog uvoza ne mogu se obrisati. Uklanjanje je zaustavljeno ako bi djeca ostala bez jedinog upisanog roditelja.

Za slanje aktivnog porodičnog linka, u **Admin → Porodični linkovi** odaberi **Kopiraj link** i pošalji adresu rođaku. Dugme i polje nalaze se i u detaljima linka. Puna adresa koristi domenu kojom je administrator otvorio aplikaciju, zato pristupi aplikaciji adresom koju rođak također može otvoriti. Ako kopiranje nije dostupno, označi i ručno kopiraj prikazanu adresu. Isključen link se ne može koristiti dok se ponovo ne aktivira.

Za trajno brisanje napravljene grane izaberi **Admin → Porodični linkovi → Obriši link** i potvrdi brisanje. Time se brišu i sve dorade i istorija tog linka; drugi linkovi i Gramps nisu pogođeni. Ako želiš sačuvati dorade, umjesto toga isključi link. Ako su izmjene sačuvane nakon otvaranja potvrde, pregledaj ih prije ponovnog pokušaja.

Prilikom izrade nove porodice u porodičnom linku može se unijeti partner i više djece s osnovnim podacima. Nakon čuvanja odaberi dijete u porodici da dopuniš njegove podatke ili nastaviš njegovu granu. U pregledniku s uključenim JavaScriptom otvorene grane i položaj se nakon čuvanja pokušavaju vratiti u istoj kartici preglednika.

### Isti obrazac za dopunu porodične grane

Poslani link sada odmah otvara porodični pregled za dopunu, počevši od početne porodice. To je glavni ekran za rad s podacima. **Mapa cijele grane** služi samo za pronalaženje osobe: koristi isti izgled i redoslijed imena kao obrazac, a klik na ime otvara isti porodični pregled. Stari linkovi s pretragom ili fokusom i dalje otvaraju mapu; nijedan novi link nije potreban.

Iz druge porodice dostupni su povratak na početnu i veza do roditeljske porodice. Naslov prati odabranu porodicu i pri kretanju kroz potomke na istoj stranici. **Status obrade** je dostupan uz obrazac; završetak obrade vraća na odabranu porodicu i nije dozvoljen dok postoje nesačuvane izmjene. Oznake promjena i administratorski pregled ostaju očuvani.

Odabirom osobe u privatnom linku otvara se sažet pregled njene porodice: kartice prikazuju imena, poznate osnovne podatke, partnera i broj djece. **Dopuni osobu** otvara samo odabrani unos, s istim poljima i načinom čuvanja kao u postojećem obrascu. Samo jedan unos je otvoren; **Više podataka** skriva rjeđa polja, a poznate vrijednosti ostaju sačuvane i kada su polja sklopljena.

**Šta nedostaje u ovoj porodici** nudi direktan odlazak do praznog datuma ili mjesta rođenja. To su opcione dopune, a ne obavezna polja; datumi smrti se ne traže za svaku osobu. **Porodica** otvara samo porodicu odabranog djeteta. Povratak vodi na prethodnu porodicu ili početni par, bez ponovnog učitavanja i gubitka unosa. Prazan red djeteta se više ne otvara sam; dijete se dodaje izričitim dugmetom.

**Vrati se na pregled** sklapa unos, ali ga ne čuva. Oznaka **Izmijenjeno · još nije sačuvano** i donje dugme **Pregledaj i sačuvaj** razdvajaju uređivanje od čuvanja. Poslije pregleda, **Sačuvaj izmjene u linku** čuva kopiju i zadržava izabranu porodicu i položaj stranice. Ime osobe koja dopunjava podatke unosi se pri dnu prije čuvanja.

Pregled prije čuvanja prikazuje samo nove izmjene iz trenutnog unosa, grupisane po porodicama: stare i nove vrijednosti, nove osobe te dodane ili uklonjene veze. **Ispravi** vodi direktno do odgovarajuće osobe ili porodice, bez gubitka unosa. Uklanjanje djeteta iz porodice je posebno opisano kao uklanjanje veze; osoba ostaje u linku. Obrazac je za vrijeme pregleda sklonjen, a pregled se skroluje zajedno sa stranicom, bez dodatnog unutrašnjeg prozora. Ako nema izmjena ili pregled ne prođe provjeru, čuvanje nije omogućeno.

Pregled koristi iste provjere i obradu kao čuvanje (`form-preview`), ali radi nad kopijom u memoriji i ne mijenja podatke, reviziju ni istoriju. Poslije uspješnog čuvanja naredni pregled poredi unos s upravo sačuvanim stanjem. Sukob revizija se prikazuje prije potvrde, dok uneseni podaci ostaju u obrascu.

Za druge porodice iste osobe služe veze u vrhu obrasca; **Drugi partner / druga veza** uz prvu osobu otvara prazan unos za dodatnu vezu. Primjeri imena i datuma se ne prikazuju u praznim poljima privatnog linka.

Uklanjanjem kartice djeteta uklanja se veza s otvorenim parom, dok osoba i njene druge porodice ostaju sačuvane. Odvojene porodice i osobe dostupne su u stablu i pretrazi. Nova porodica i nova osoba mogu se ukloniti uz potvrdu; uvezene osobe i porodice ostaju zaštićene.

Prilozi se u porodičnom linku još ne dodaju. Izmjene ostaju u kopiji linka za administratorski pregled; ništa se automatski ne šalje u Gramps.

### Vrsta partnerske veze iz Grampsa

Uvoz prenosi Grampsov tip porodične veze: **Brak**, **Vanbračna zajednica**, **Registrovano partnerstvo**, **Nepoznato** ili prilagođeni naziv. Vrsta veze je vidljiva uz naslov odabrane porodice, na karticama potomaka i u mapi grane. Nepoznat ili nedostajući tip se ne pretvara automatski u brak na osnovu djece ili događaja. Prilagođeni nazivi ostaju izabrani u obrascu i ne brišu se prilikom dopune drugih podataka.

Pri pokretanju se starim linkovima dopunjava ranije izostavljena vrsta veze iz njihovog sačuvanog izvornog Gramps zapisa. Dopuna obuhvata početni, radni i sačuvane istorijske preglede, tako da ne stvara novu korisničku izmjenu niti mijenja reviziju ili status obrade. Postojeće ispravke se čuvaju; prazna vrijednost nakon ranije izričite izmjene ostaje prazna. Ako izvorni tip nije sačuvan, podatak ostaje neupisan. Ponovno pokretanje ne ponavlja dopunu, a izvorna Gramps baza se ne mijenja.

### Potomci kroz proizvoljan broj koljena

Svaka kartica djeteta sada ima iste mogućnosti: podatke osobe, partnera, vlastitu djecu i njihove naredne porodice. To važi i za običan unos i za kopiju iz Grampsa. Nema unaprijed zadanog posljednjeg koljena.

**Otvori ovu porodicu** izdvaja odabranu porodicu za rad bez sužavanja obrasca kroz sve prethodne generacije. **Prikaži cijelu porodicu** vraća puni prikaz, bez gubitka unosa. Dublje kartice su po početku sklopljene.

Pregled, trajni odgovor, administratorski prikaz i TXT izvoz prate sve unesene generacije. Stari sačuvani zapisi unučadi s jednim poljem za ime ostaju čitljivi. Zaštite obima podataka i sukoba čuvanja i dalje važe.

### Dopuna veze i porodičnih napomena

U porodičnom linku vrsta veze je odmah uz kartice partnera, dostupna u kratkom izboru bez otvaranja osobe. Izvor i napomena prikazuju sažetak, a klik otvara samo pripadajuće polje na istom mjestu. Isti raspored važi i za otvorenu porodicu potomka. Izmjene i dalje prolaze kroz pregled prije čuvanja u kopiji grane.

### Osvježavanje skripti nakon nadogradnje

Porodični pregled i mapa koriste adrese skripti i stilova sa oznakom sadržaja (`?v=...`). Nakon nadogradnje nova datoteka dobija novu adresu, pa preglednik ili posrednički keš ne nastavlja koristiti staru skriptu. Otvorenu stranicu treba ponovo učitati. Ako je prije ove ispravke ostao stari prikaz, na računaru jednom koristite Ctrl+F5.

### Dopuna iz perspektive rođaka

Provjeren je tok otvaranje linka → osoba i porodica → dopuna → pregled izmjena → čuvanje → završetak dopune, uključujući telefon, povratak iz mape i greške pri slanju.

- Jedno polje „Tvoje ime i prezime” koristi se za čuvanje, završetak dopune i uklanjanje. Ime se pamti u istoj kartici preglednika, zasebno za svaki link; ne preuzima se ime prethodnog rođaka sa servera.
- Status je kratak podatak u zaglavlju. „Pregledaj izmjene” i „Završi dopunu” nalaze se zajedno. Završetak je moguć i bez izmjena, a nakon čuvanja ostaje jasna potvrda. Završetak ne učitava stranicu ponovo.
- Dijete bez partnera ima neposrednu opciju „Dodaj partnera”. Porodice potomaka i dalje se čuvaju u istoj kopiji grane.
- Odustajanje od novog reda i vraćanje uklonjenog djeteta ne ostavljaju lažan status nesačuvanih izmjena. „Vrati” vraća posljednje uklanjanje do čuvanja; osobe i njihovi podaci ostaju u kopiji kad se uklanja samo veza.
- Uklanjanje djeteta zadržava otvorenu roditeljsku porodicu. Opcije za uklanjanje porodice ili osobe prate stvarni trenutni izbor; blokirane su dok ima nesačuvanih izmjena. Uvezene osobe i porodice ostaju zaštićene postojećim pravilima.
- Ponovni zahtjev za završetak iste revizije čuva postojeći status administratorskog pregleda.

Daljnje poboljšanje: upozorenje na moguće duplikate prije dodavanja nove osobe i izbor odgovarajuće postojeće osobe. Jednako ime samo po sebi nije dovoljan razlog za automatsko spajanje.

### Završetak unosa djeteta

„Gotovo — dodaj u porodicu” zatvara mali obrazac tek kad osoba ima ime. Novi član ostaje označen „Novo · nije sačuvano” do pregleda i čuvanja. Pregled prikazuje jednu karticu za dodavanje djeteta, sa porodicom kojoj pripada i opcijama „Ispravi” i „Odustani od dodavanja”. Uklanjanje je neposredno na kartici osobe; „Vrati” ostaje dostupan prije čuvanja.

Dodavanje drugog partnera otvara jasno označenu novu porodicu i odmah polje novog partnera. „Odustani” vraća na prethodno odabranu porodicu; nesačuvane izmjene štiti postojeće upozorenje pri napuštanju.
