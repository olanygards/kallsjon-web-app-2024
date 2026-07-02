# Implementationsplan – Autentisering för media

Plan för att ersätta dagens **delade kod + anonym Auth** med **Firebase-konton, verifiering och roller**.

Relaterat: [OVERSIKT.md – Media / Autentisering](../OVERSIKT.md#autentisering-idag)

---

## Mål

| Mål | Beskrivning |
|-----|-------------|
| **Kända användare** | Varje uppladdning kopplas till `auth.uid` och ev. profil |
| **Kontrollerad tillväxt** | Nya konton kan skapas, men upload kräver godkännande/inbjudan |
| **Administration** | Admin kan lägga till användare i Firebase eller bjuda in via kod |
| **Säkerhet** | Behörighet avgörs av **Storage/Firestore Rules + custom claims** – inte klientkod |
| **Spam-skydd** | App Check + ev. reCAPTCHA och rate limits |

**I scope:** uppladdning, radering av eget media, grundläggande användarprofil.

**Utanför scope (v1):** offentlig registrering utan gate, social login (Google m.m.), modereringskö i UI.

---

## Nuvarande läge ( att ersätta )

| Del | Fil / plats | Problem |
|-----|-------------|---------|
| Uppladdningskod | `MediaUpload.tsx` – hårdkodad `SHARED_CODE` | Synlig i klientbundle |
| Raderingskod | `DailyGallery.tsx` – samma kod | Samma problem |
| Auth | `signInAnonymously()` före upload | Ingen persistent identitet |
| Metadata | `uploadedBy: 'guest_with_code'` | Kan inte spåra vem som laddat upp |
| Storage Rules | Firebase Console (ej i repo) | Okänt exakt läge – måste inventeras |

---

## Rekommenderad arkitektur

```
Användare                    Firebase                         Data
────────                     ────────                         ────
Registrering (e-post)  →     Auth (verified email)
Inbjudningskod         →     Cloud Function `redeemInvite`
                             → sätter custom claim `uploader: true`
                             → skriver `users/{uid}` i Firestore

Inloggad + uploader    →     Storage Rules (claim check)
                       →     Firestore Rules (claim check)
                       →     media_items.uploadedBy = uid
```

### Roller (custom claims)

| Claim | Betydelse |
|-------|-----------|
| `uploader: true` | Får ladda upp och radera **egna** media |
| `admin: true` | Får radera allas media, hantera inbjudningar (senare) |

Claims sätts **endast** via Admin SDK (Cloud Function eller manuellt script) – aldrig från klienten.

### Verifieringsmodell (rekommenderad för v1)

Kombination som passar en liten surfgemenskap:

1. **E-post + lösenord** (Firebase Auth) med **obligatorisk e-postverifiering**
2. **Engångsinbjudningskod** som valideras **server-side** vid registrering eller i separat steg efter registrering
3. Efter lyckad inbjudan: Cloud Function sätter `uploader: true`

Alternativ för befintliga surfare: admin skapar konto i Console och sätter claim manuellt.

---

## Fas 0 – Förberedelse och inventering

**Insats:** ~2 h

### Steg

1. **Exportera nuvarande Firebase Rules** från Console (Storage + Firestore) till repo, t.ex.:
   ```
   kallsjon-web-app/
   ├── storage.rules
   └── firestore.rules
   ```
2. Dokumentera exakt vad som gäller idag för `daily_uploads/` och `media_items`.
3. Aktivera/kontrollera **Firebase Auth**-providers i Console:
   - E-post/lösenord: på
   - Anonym: kan behållas temporärt under migration, tas bort när klart
4. Kontrollera **App Check** i prod ([kallsjon.web.app](https://kallsjon.web.app)).
5. Skapa **designbeslut** (ev. kort avsnitt i denna fil):
   - [ ] E-post/lösenord vs magic link
   - [ ] En inbjudningskod per person vs återanvändbar kod med max uses
   - [ ] Ska `uploaderName` komma från profil eller fritt per upload?

**Acceptans:** Rules i repo; Auth-providers dokumenterade; beslut tagna.

---

## Fas 1 – Datamodell och backend-grund

**Insats:** ~1 dag

### Firestore: `users/{uid}`

```ts
{
  displayName: string;       // visningsnamn i galleri
  email: string;
  createdAt: Timestamp;
  approvedAt?: Timestamp;    // när uploader-claim gavs
  invitedBy?: string;        // uid eller 'admin'
}
```

### Firestore: `invites/{codeId}`

```ts
{
  code: string;              // hash:a aldrig klartext i DB – spara SHA-256
  createdBy: string;         // admin uid
  createdAt: Timestamp;
  maxUses: number;           // t.ex. 1
  uses: number;
  expiresAt?: Timestamp;
  note?: string;             // "Till Erik"
}
```

### Cloud Functions (i `2024-kallsjon-functions` eller nytt repo)

| Function | Trigger | Gör |
|----------|---------|-----|
| `redeemInvite` | HTTPS callable | Validerar kod, sätter `uploader: true`, skapar/uppdaterar `users/{uid}` |
| `onUserCreate` | Auth trigger (valfritt) | Skapar `users/{uid}` med grunddata |
| `setUploaderClaim` | HTTPS callable (admin only) | Manuellt godkännande |

**Säkerhet i functions:**

- Verifiera `context.auth` på alla callables
- Rate limit per uid/IP på `redeemInvite`
- Logga misslyckade kodförsök

### Exempel: Storage Rules (mål)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /daily_uploads/{date}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.uploader == true
                   && request.resource.size < 50 * 1024 * 1024; // t.ex. 50 MB
      allow delete: if request.auth != null
                    && (request.auth.token.admin == true
                        || (request.auth.token.uploader == true
                            && resource.metadata.uploadedBy == request.auth.uid));
    }
  }
}
```

*(Anpassa efter hur metadata sätts – ev. `uploadedBy` som custom metadata på Storage-objektet.)*

### Exempel: Firestore Rules för `media_items`

```javascript
match /media_items/{itemId} {
  allow read: if true;
  allow create: if request.auth != null
                && request.auth.token.uploader == true
                && request.resource.data.uploadedBy == request.auth.uid;
  allow delete: if request.auth != null
                && (request.auth.token.admin == true
                    || resource.data.uploadedBy == request.auth.uid);
  allow update: if false; // eller begränsa till admin
}
```

**Acceptans:** Functions deployade; testanvändare kan få claim via callable; Rules nekar anonym upload.

---

## Fas 2 – Frontend: Auth-flöde

**Insats:** ~1–2 dagar

### Nya / uppdaterade filer

```
src/
├── hooks/
│   ├── useAuth.ts              # auth state, uploader/admin claims
│   └── useUserProfile.ts       # läs/skriv users/{uid}
├── components/auth/
│   ├── AuthProvider.tsx        # context runt appen (minst Media-flöden)
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx        # e-post + lösenord + inbjudningskod
│   └── AuthGate.tsx            # visar login om !uploader
├── config/firebase.ts          # befintlig – oförändrad grund
```

### Flöde i UI

1. **Oinloggad** på Media-fliken → kan bläddra galleri (som idag)
2. **"Ladda upp"** → om !auth → Login/Register
3. **Register** → e-post, lösenord, visningsnamn, inbjudningskod → `redeemInvite`
4. **Efter godkännande** → `AuthGate` släpper igenom → befintlig `MediaUpload`
5. **Inloggad uploader** → ingen kod-ruta; `uploaderName` förifylls från profil

### Ändringar i befintlig kod

| Fil | Ändring |
|-----|---------|
| `MediaUpload.tsx` | Ta bort `SHARED_CODE`; använd `useAuth()`; `uploadedBy: user.uid`; ta bort `signInAnonymously` |
| `DailyGallery.tsx` | Ta bort raderingskod; visa radera-knapp om `uid === uploadedBy` eller admin |
| `KallsurfHome.tsx` / `HistoryTabs.tsx` | Wrappa upload-modal med `AuthGate` |
| `MediaView.tsx` | Ev. visa profil/lout-knapp |

### Token refresh efter claim

Efter `redeemInvite` måste klienten anropa `user.getIdToken(true)` så att Storage Rules ser nya claims.

**Acceptans:** Ny användare kan registrera sig med giltig kod och ladda upp utan delad klientkod.

---

## Fas 3 – Admin och inbjudningar

**Insats:** ~0,5–1 dag

### Minimum (v1)

- **Firebase Console:** manuellt skapa användare, sätta custom claims via Admin SDK-script eller `setUploaderClaim`-callable
- **Enkel admin-script** (`scripts/createInvite.ts`):
  ```bash
  npm run invite:create -- --note "Erik" --max-uses 1
  ```
  Skriver hashad kod till Firestore, skriver ut klartext **en gång** i terminalen

### Senare (v2)

- Admin-sida i appen (`/admin`, skyddad med `admin`-claim)
- Lista väntande användare utan claim
- Generera och e-posta inbjudningar

**Acceptans:** Admin kan bjuda in en person utan att deploya om appen.

---

## Fas 4 – Spam-skydd och hårdning

**Insats:** ~0,5 dag (inkrementellt)

| Åtgärd | Prioritet | Beskrivning |
|--------|-----------|-------------|
| App Check på alla Auth/Storage-anrop | Hög | Redan delvis på plats – verifiera enforcement |
| reCAPTCHA Enterprise | Medel | Vid registrering och `redeemInvite` |
| Rate limit i Cloud Function | Hög | Max N kodförsök / timme per IP |
| Max filstorlek i Rules | Hög | Redan i exempel ovan |
| Tillåtna MIME-typer | Medel | Validera `contentType` i Rules eller Function |
| Audit log | Låg | `uploads`-subcollection med uid + timestamp |

**Acceptans:** Enkel bot kan inte massregistrera eller brute-forca kod i praktiken.

---

## Fas 5 – Migration från dagens lösning

**Insats:** ~2 h

### Steg

1. **Befintliga `media_items`** med `uploadedBy: 'guest_with_code'` – behåll som historik; ingen migration krävs för visning
2. **Övergångsperiod (valfritt):**
   - Cloud Function accepterar **även** legacy kod en gång och sätter claim (kod i Secret Manager, inte klient)
   - Efter X veckor: stäng av legacy
3. **Ta bort** hårdkodad `SHARED_CODE` från klienten
4. **Stäng av** anonym Auth i Console när inga klienter använder den
5. **Kommunicera** till surfarna: nytt flöde med konto + personlig inbjudan

**Acceptans:** Prod utan hårdkodad kod; befintliga bilder syns fortfarande.

---

## Fas 6 – Profil och metadata (valfritt v1.1)

- `users/{uid}.displayName` synkas till `uploaderName` vid upload om fältet lämnas tomt
- Visa "Foto: {displayName}" konsekvent i `MediaView` / `DailyGallery`
- Möjlighet att redigera visningsnamn i Media-fliken

---

## Testplan

### Manuellt

- [ ] Oinloggad: kan se galleri, **inte** ladda upp
- [ ] Registrering utan kod → nekas upload
- [ ] Registrering med ogiltig kod → tydligt fel, ingen claim
- [ ] Registrering med giltig kod → upload fungerar
- [ ] E-post ej verifierad → upload nekas (om ni kräver verified email)
- [ ] Användare A kan **inte** radera B:s bild
- [ ] Admin kan radera valfri bild
- [ ] App Check påslaget i prod – upload fungerar ändå
- [ ] Utloggad → inloggad igen → session kvar

### Rules-enhetstester

Använd Firebase Emulator Suite:

```bash
firebase emulators:start --only auth,firestore,storage
```

Testa allow/deny för anonym, uploader, admin.

---

## Rekommenderad ordning och insats

```
Fas 0 → Fas 1 → Fas 2 → Fas 3 → Fas 5 → Fas 4 → Fas 6
 prep    backend   UI      admin   migrate  harden  polish
```

| Fas | Insats |
|-----|--------|
| 0 Förberedelse | ~2 h |
| 1 Backend | ~1 dag |
| 2 Frontend | ~1–2 dagar |
| 3 Admin | ~0,5–1 dag |
| 4 Spam/hårdning | ~0,5 dag |
| 5 Migration | ~2 h |
| 6 Profil (valfritt) | ~0,5 dag |

**Totalt v1:** ungefär **3–5 dagar** beroende på hur mycket admin-UI som ingår.

---

## Öppna beslut (fyll i innan implementation)

- [ ] **Auth-metod:** e-post/lösenord / magic link / båda
- [ ] **Inbjudningskod:** en per person vs fleranvändning med `maxUses`
- [ ] **Kräv verified email** innan upload?
- [ ] **Var ligga Functions** – befintliga `2024-kallsjon-functions` eller separat?
- [ ] **Radering:** endast egen media, eller även admin i v1?
- [ ] **Legacy-kod:** hard cutover eller övergångsperiod?

---

*Skapad: 2026-07-02*
