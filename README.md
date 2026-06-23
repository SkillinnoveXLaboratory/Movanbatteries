# Movan Control

React administration console for the Movan Batteries API.

## Run locally

```powershell
npm install
npm run dev
```

The API URL is configured in `.env.local`. Sign in with admin credentials or use the Access Token tab. Access tokens are stored in browser local storage for the active browser profile and are never committed or bundled.

## Production

```powershell
npm run lint
npm run build
npm run preview
```

Deploy the contents of `dist/` with SPA fallback enabled so routes such as `/service-cases` resolve to `index.html`.

## Live API validation

Validated against `https://mb.digitalleadpro.com/api/v1/` on 22 June 2026.

- Core authenticated collections, dashboard, service queues, stock, commerce, reports, backups, notifications, audit, and battery finder returned `200`.
- Detail/history routes were tested using IDs obtained from the live collections.
- Browser CORS preflight returned `204` with authorization and content-type allowed.
- `/battery-brands`, `/battery-models`, and `/warranty-policies` returned `404`; they are intentionally not exposed as dashboard routes.
- Mutation discovery used the successful request bodies in `../output.txt`. No production records were created, edited, or deleted during verification.

## Admin safeguards

- Delete controls exist only for API resources with documented delete routes.
- Destructive actions require a separate confirmation modal.
- Service status and stock movements use dedicated workflow dialogs.
- The supplied test token is not present in source or production output.
