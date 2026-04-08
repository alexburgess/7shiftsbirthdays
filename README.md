# 7shifts Birthday Calendar

Production-ready Node.js/TypeScript service that publishes public subscribable ICS feeds for employee birthdays from 7shifts and a private read-only CardDAV address book for active staff contacts.

## What it exposes

- `GET /health`
- `GET /` (human-friendly setup page with subscribe instructions, QR code, and live stats)
- `GET /admin` (private dashboard protected by Basic Auth)
- `GET /calendar/7shifts/birthdays`
- `GET /calendar/7shifts/birthdays/:companyId.ics`
- `GET /trmnl/birthdays.json`
- `GET /.well-known/carddav`
- `OPTIONS|PROPFIND|REPORT /contacts/carddav/...`
- `GET|HEAD /contacts/carddav/addressbooks/employees/:uid.vcf`

Each company feed is named `"<Company Name> Birthdays"` and contains all-day birthday events. If birth year is present, the event title includes age (for example `Alex Burgess's 34th Birthday`).

The CardDAV address book is read-only, combines active employees across companies, merges obvious duplicates by email or phone, and includes birthday, company, email, phone, and best-effort profile photos when 7shifts exposes a usable image URL.

## Behavior

- Auth model: manual bearer token (`SEVENSHIFTS_ACCESS_TOKEN`)
- Filters to active employees
- Reads DOB from `birth_date` or `date_of_birth`
- Treats `1900` and `1910` birth years as unknown placeholder years
- Leap day handling: Feb 29 birthdays become Feb 28 in non-leap years
- Rolling horizon: current year through current year + `HORIZON_YEARS` (default `10`)
- Cache strategy: in-memory plus persisted snapshot at `CACHE_FILE_PATH`
- Resilience: if sync fails, last successful snapshot remains served
- Private routes (`/admin` and CardDAV) use one shared Basic Auth username/password

## Quick start (local)

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Set a valid `SEVENSHIFTS_ACCESS_TOKEN` in `.env`.

4. Run development server:

```bash
npm run dev
```

5. Run one manual sync:

```bash
npm run sync
```

## Environment variables

- `PORT` (default `4000`)
- `BASE_URL` (public HTTPS base URL for index links)
- `PUBLIC_PATH_PREFIX` (default `/calendar/7shifts/birthdays`)
- `CONTACTS_PATH_PREFIX` (default `/contacts/carddav`)
- `CONTACTS_BOOK_NAME` (default `7shifts Staff`)
- `TIMEZONE` (default `America/New_York`)
- `HORIZON_YEARS` (default `10`)
- `SEVENSHIFTS_ACCESS_TOKEN` (required for sync)
- `SEVENSHIFTS_API_BASE_URL` (default `https://api.7shifts.com/v2`)
- `PRIVATE_AUTH_USERNAME` (required for `/admin` and CardDAV)
- `PRIVATE_AUTH_PASSWORD` (required for `/admin` and CardDAV)
- `CACHE_FILE_PATH` (default `./data/cache.json`)

## CardDAV setup

1. Open the private admin page at `/admin`.
2. Copy the CardDAV server URL and username shown there.
3. On iPhone: `Settings` -> `Apps` -> `Contacts` -> `Contacts Accounts` -> `Add Account` -> `Other` -> `Add CardDAV Account`.
4. Use the copied server URL, the admin username, and the same admin password.

The address book is read-only by design. Write methods return `405`.

## TRMNL setup

The repo includes a TRMNL plugin in [`trmnl plugin`](/Users/alexburgess/Developer/7Shifts Birthday Calendar/trmnl plugin) that now reads live birthday data from this service.

- Use `https://your-domain.example/trmnl/birthdays.json` to show upcoming birthdays across all companies.
- Use `https://your-domain.example/trmnl/birthdays.json?companyId=123` to scope the plugin to one company.
- Paste that URL into the plugin's `Feed URL` setting in TRMNL.

The TRMNL endpoint is backed by the same cached birthday snapshot as the ICS and CardDAV outputs, so it stays in sync with your existing refresh process.

## Deployment on Ubuntu 24.04 (Linode, no Docker)

1. Install runtime:

```bash
sudo apt-get update
sudo apt-get install -y nginx nodejs npm
```

2. Set server timezone (required so the timer runs at 2:00 AM ET):

```bash
sudo timedatectl set-timezone America/New_York
```

3. Copy project to `/opt/7shifts-birthday-calendar` and install/build:

```bash
cd /opt/7shifts-birthday-calendar
npm install
npm run build
```

4. Create env file:

```bash
sudo cp .env.example /etc/7shifts-birthday-calendar.env
sudo nano /etc/7shifts-birthday-calendar.env
```

5. Install systemd units:

```bash
sudo cp deploy/systemd/7shifts-birthday-calendar.service /etc/systemd/system/
sudo cp deploy/systemd/7shifts-birthday-calendar-sync.service /etc/systemd/system/
sudo cp deploy/systemd/7shifts-birthday-calendar-sync.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now 7shifts-birthday-calendar.service
sudo systemctl enable --now 7shifts-birthday-calendar-sync.timer
```

6. Add Nginx location config from `deploy/nginx/7shifts-birthday-calendar.conf` into your existing HTTPS vhost, then reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

7. Trigger first sync immediately:

```bash
sudo systemctl start 7shifts-birthday-calendar-sync.service
```

## Tests

```bash
npm test
```

## Notes

- The token previously shared in this chat appears invalid for v2 bearer auth. Replace it with a valid 7shifts access token before deploy.
- This service publishes public ICS URLs by design.
- CardDAV is intentionally private and should only be exposed over HTTPS.
