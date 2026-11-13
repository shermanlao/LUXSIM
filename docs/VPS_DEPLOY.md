# LUXSIM on the VPS

Production host: **`187.7.21.12`** (same machine as LEVO, LUUX, houseasy, and 4TECH).

| Item | Value |
|------|--------|
| App path | `/var/www/luxsim` |
| Data | `/var/www/luxsim-data` (SQLite + uploads) |
| Git branch | `cursor/next-security-patch-b40c` |
| App bind | `127.0.0.1:3005` |
| Public | `http://187.7.21.12:8088` |
| systemd | `luxsim-web` |
| nginx | `/etc/nginx/sites-available/luxsim` |

Nginx on port **8088** proxies to the Next.js process. Ports **80** and **443** stay with the other sites. Do not bind LUXSIM to `3000`–`3004` or `3333`–`3334`.

Secrets stay only in `/var/www/luxsim/.env`. `AUTH_URL` and `NEXTAUTH_URL` must be `http://187.7.21.12:8088`.

Demo login after seed: `demo@luxsim.local` / `demo1234`.

## Update

On the VPS, from `/var/www/luxsim`:

```bash
git pull --ff-only origin cursor/next-security-patch-b40c
npm install
npx prisma migrate deploy
npm run build
sudo systemctl restart luxsim-web
```

`npm ci` fails on this host until `package-lock.json` includes the Linux optional packages `@emnapi/runtime` and `@emnapi/core`. Use `npm install` until that lockfile is refreshed.

After migrating, create the first site administrator with `npx tsx scripts/create-site-admin.ts --email you@example.com` if one does not already exist. See [ADMIN.md](./ADMIN.md). Do not commit or paste the generated password.

## Transactional email (password reset)

Password reset sends a 6-digit one-time code to the registered mailbox. The message must not contain a link. Set these in `/var/www/luxsim/.env` only — do not commit them:

```
EMAIL_SERVER_HOST=smtp.office365.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=LUXSIM <info@4techhk.com>
```

`EMAIL_FROM` must be a mailbox Office 365 will accept (the existing Office 365 mailbox). A `LUXSIM` display name is fine. `AUTH_URL` and `NEXTAUTH_URL` must stay `http://187.7.21.12:8088`.

Seed or demo addresses such as `demo@luxsim.local` cannot receive mail. Use a real mailbox to test the reset email.
