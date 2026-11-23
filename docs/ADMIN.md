# LUXSIM site admin and workspaces

LUXSIM has two role layers: a **site administrator** for the whole instance, and **workspace Owner / Member** roles inside each organisation.

This is LUXSIM’s own access model. It is not a licence or billing console.

## Roles

- **Site admin** — sees an Admin link in the header and can use `/admin`. This is not the same as being a workspace owner. Support access lets a site admin open any project from the Admin workspaces page. A site admin who is not a member of a workspace does not see that workspace’s projects on the ordinary Projects list.
- **Workspace owner** — add or remove people in that workspace, change Owner vs Member, rename the workspace on the Workspace members page, manage that workspace, and open every project in it. Owners get a Members link to `/workspace/members`, not the site-wide Admin area.
- **Workspace member** — create and edit projects in workspaces they belong to. They cannot rename the workspace, and they cannot manage users or site settings.

A user may belong to more than one workspace. The Projects list shows projects from every membership. New projects go into the first membership unless the user picks a workspace. Access to a given project or luminaire is checked against that item’s workspace, not only the first membership.

For this release, every member of a workspace can open all of that workspace’s projects. There is no per-project view/edit sharing.

## Admin area

Visible only to site admins.

| Page | Purpose |
|------|---------|
| `/admin/users` | List accounts, create a user, disable or enable, set site admin, place someone in a workspace, reset a password |
| `/admin/workspaces` | List organisations, members, and projects; sort those lists; add or remove members; open a project; delete a workspace (users are not deleted) |
| `/admin/traffic` | Site visitors and page views for today, the last 7 days, and the last 30 days, plus a last-14-days daily table |
| `/admin/settings` | Open or close public registration, set the default autosave for *new* users, set the website shown in lighting-report PDF footers, configure room-analysis AI (enable, provider, model, and API key), edit in-app help tips |

The last remaining active site admin cannot be demoted or disabled. The last owner of a workspace cannot be removed or demoted.

Temporary passwords from create-user or reset-password are returned once in the API response and shown in a one-time dialog. They are not written to logs or the repository.

Disabled users cannot sign in or use APIs.

## Workspaces list sorting

`/admin/workspaces` sorts the already-loaded lists in the browser. The first view keeps the API order: workspaces by Created ascending, members by the time they were added (created, ascending), and projects by Updated descending. Click a sort key to sort by that field; click the same key again to switch ascending and descending. The workspace-list sort applies to the stack of organisation cards. Each card has its own members and projects sort, independent of the other cards.

Workspace keys: Name, Created, Members (count), Projects (count), Luminaires (count), and Last project update (the most recent project update time; a workspace with no projects is listed last). Member keys: Email, Name, Role, and Status (Active or Disabled). Project keys: Name and Updated. Names and emails use a locale-aware comparison; empty or missing names are listed after named rows.

## Site traffic

`/admin/traffic` is for site administrators only. It shows unique visitors and page views for today, the last 7 days, and the last 30 days, plus a daily table for the last 14 days. All dates use Hong Kong time (UTC+8), not UTC.

Only document / page navigations are counted — for example `/`, `/login`, `/projects`, `/projects/[id]`, and `/admin/...`. Background API traffic is not counted: `/api/*` (autosave, polls, NextAuth callbacks, the collect endpoint itself), Next.js internals under `/_next/*`, and static files such as `/favicon.ico`. Otherwise the editor would inflate the figures every few minutes.

A first-party cookie (`luxsim_vid`) identifies a visitor across the day, and is only set when `POST /api/traffic/collect` receives a countable document / page navigation. Uncountable requests — `/api/*` (including autosave and the collect endpoint itself), `/_next/*`, and static files such as `/favicon.ico` — return 204 with an empty body, do not set the cookie, and do not write a traffic row. The stored value is an HMAC-SHA256 hash of that id (or, if no cookie is present, of the IP and the Hong Kong date) using `AUTH_SECRET`. Raw IP addresses, request bodies, passwords, OTP codes, and emails are not written to the traffic tables. `GET /api/admin/traffic` is the only stats endpoint and requires a site admin. The collect endpoint never returns visitor or page-view figures. A failed write is logged and must not break the page.


## Room-analysis AI

On `/admin/settings`, a site administrator can enable **Room-analysis AI**, choose a provider (xAI or OpenAI) and model, and save an API key. This is the official way to configure the fallback used by **Create rooms from DXF** and **Create from plan** when no room or architectural layout can be found in the imported drawing.

The saved key is stored on the server and is never shown again in the form. The page shows only a masked hint (for example `••••ab12`) and allows the key to be replaced or removed. Regular project users cannot see or edit this setting, and `GET /api/site` does not include it. The analyse-rooms API reads this admin setting; an optional environment variable (`XAI_API_KEY` or `OPENAI_API_KEY`, matching the chosen provider) is only a fallback when AI is enabled and no admin key has been saved. If AI is not enabled, or no key is available, the editor keeps the storey contour and does not invent rooms.

## Report website


The lighting report PDF footer can show the site’s web address as plain text. On `/admin/settings`, set **Lighting report website** to an http(s) URL or a host[:port]. When the setting has never been stored, the server uses `AUTH_URL` or `NEXTAUTH_URL`. A blank value hides the line. Designers fetch this (and only this public field) from `GET /api/site` when exporting a report; they do not need the admin settings API.

## Public registration

Registration is open by default. When a site admin closes it, `POST /api/auth/register` returns 403. Site admins can still create users from `/admin/users`. New self-registered users still get their own workspace (as owner) and a sample project, using the site default autosave interval.


## Password reset

The login page has a Forgot password flow. The user asks for a 6-digit one-time code, which is emailed to the registered address. The email contains the code and its 10-minute expiry only — no reset link, no URL, and no new password. After the code is entered with a new password, the user is sent back to Sign in and is not signed in automatically.

`POST /api/auth/password-reset/request` and `POST /api/auth/password-reset/verify` implement this. Codes are stored hashed, are single-use, and are invalidated if a new code is requested or if too many incorrect attempts are made. Sends are rate-limited per email. Responses do not reveal whether an address is registered, and disabled accounts are not sent a code.

SMTP is configured with `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, and `EMAIL_FROM`. If mail is not configured or sending fails, the request returns an error and no code is issued.

This is separate from the site-admin temporary-password reset on `/admin/users`.

## First site admin (after deploy)

Do not bake an email or password into the repository. After `npx prisma migrate deploy` on the instance, from the app root:

```bash
npx tsx scripts/create-site-admin.ts --email you@example.com
npx tsx scripts/create-site-admin.ts --email you@example.com --name "Site Admin"
```

- If the account does not exist, the script creates it as a site admin, gives it a workspace, and prints a temporary password once to stdout. Copy that value immediately and store it securely; it is not saved anywhere else.
- If the account already exists, the script promotes it to site admin and does not change its password.

Existing designer accounts are left unchanged by the migration. `isSiteAdmin` and `disabled` default to false. The first membership of each existing user stays owner unless you change it later.
