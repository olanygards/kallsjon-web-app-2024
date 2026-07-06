# Kallifornia – webbapp

Mobilvänlig PWA för vågsurf i Kallsjön. **En app, en route:** `/` → `KallsurfHome`.

**Live:** [kallsjon.web.app](https://kallsjon.web.app)

## Dokumentation

- [docs/OVERSIKT.md](docs/OVERSIKT.md) – produkt, teknik, datakällor
- [docs/planer/ATGARDPLAN.md](docs/planer/ATGARDPLAN.md) – aktuell åtgärdsplan

## Utveckling

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Deploy

Hosting deployas från **föräldermappen** `kallsjon-web-app/` (inte från detta repo isolerat):

```bash
cd ../..   # till kallsjon-web-app/
npm run build --prefix kallsjon-web-app-2024
firebase deploy --only hosting
```

Firebase-projekt: `kallsjon`.

## Git-historik

Legacy-vyer (`/classic`, `/home`, m.fl.) togs bort juli 2026. Äldre kod finns kvar i git om den behövs: commit `35570f5`.
