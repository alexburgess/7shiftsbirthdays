# 7shifts Birthday Calendar

Production-ready Node.js/TypeScript service that publishes public subscribable ICS feeds for employee birthdays from 7shifts.

## What it exposes

- `GET /health`
- `GET /` (human-friendly setup page with subscribe instructions, QR code, and live stats)
- `GET /calendar/7shifts/birthdays`
- `GET /calendar/7shifts/birthdays/:companyId.ics`

Each company feed is named `"<Company Name> Birthdays"` and contains all-day birthday events. If birth year is present, the event title includes age (for example `Alex Burgess's 34th Birthday`).

## Behavior

- Auth model: manual bearer token (`SEVENSHIFTS_ACCESS_TOKEN`)
- Filters to active employees
- Reads DOB from `birth_date` or `date_of_birth`
- Leap day handling: Feb 29 birthdays become Feb 28 in non-leap years
- Rolling horizon: current year through current year + `HORIZON_YEARS` (default `10`)
- Cache strategy: in-memory plus persisted snapshot at `CACHE_FILE_PATH`
- Resilience: if sync fails, last successful snapshot remains served

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
- `TIMEZONE` (default `America/New_York`)
- `HORIZON_YEARS` (default `10`)
- `SEVENSHIFTS_ACCESS_TOKEN` (required for sync)
- `SEVENSHIFTS_API_BASE_URL` (default `https://api.7shifts.com/v2`)
- `CACHE_FILE_PATH` (default `./data/cache.json`)

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
