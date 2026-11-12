# LUXSIM site admin and workspaces

LUXSIM has two role layers: a **site administrator** for the whole instance, and **workspace Owner / Member** roles inside each organisation.

This is LUXSIM’s own access model. It is not a licence or billing console.

## Roles

- **Site admin** — sees an Admin link in the header and can use `/admin`. This is not the same as being a workspace owner. Support access lets a site admin open any project from the Admin workspaces page. A site admin who is not a member of a workspace does not see that workspace’s projects on the ordinary Projects list.
- **Workspace owner** — add or remove people in that workspace, change Owner vs Member, manage that workspace, and open every project in it. Owners get a Members link to `/workspace/members`, not the site-wide Admin area.
- **Workspace member** — create and edit projects in workspaces they belong to. They cannot manage users or site settings.

A user may belong to more than one workspace. The Projects list shows projects from every membership. New projects go into the first membership unless the user picks a workspace. Access to a given project or luminaire is checked against that item’s workspace, not only the first membership.

For this release, every member of a workspace can open all of that workspace’s projects. There is no per-project view/edit sharing.

## Admin area

Visible only to site admins.

| Page | Purpose |
|------|---------|
| `/admin/users` | List accounts, create a user, disable or enable, set site admin, place someone in a workspace, reset a password |
| `/admin/workspaces` | List organisations, members, and projects; add or remove members; open a project; delete a workspace (users are not deleted) |
| `/admin/settings` | Open or close public registration, set the default autosave for *new* users, edit in-app help tips |

The last remaining active site admin cannot be demoted or disabled. The last owner of a workspace cannot be removed or demoted.

Temporary passwords from create-user or reset-password are returned once in the API response and shown in a one-time dialog. They are not written to logs or the repository.

Disabled users cannot sign in or use APIs.

## Public registration

Registration is open by default. When a site admin closes it, `POST /api/auth/register` returns 403. Site admins can still create users from `/admin/users`. New self-registered users still get their own workspace (as owner) and a sample project, using the site default autosave interval.

## First site admin (after deploy)

Do not bake an email or password into the repository. After `npx prisma migrate deploy` on the instance, from the app root:

```bash
npx tsx scripts/create-site-admin.ts --email you@example.com
npx tsx scripts/create-site-admin.ts --email you@example.com --name "Site Admin"
```

- If the account does not exist, the script creates it as a site admin, gives it a workspace, and prints a temporary password once to stdout. Copy that value immediately and store it securely; it is not saved anywhere else.
- If the account already exists, the script promotes it to site admin and does not change its password.

Existing designer accounts are left unchanged by the migration. `isSiteAdmin` and `disabled` default to false. The first membership of each existing user stays owner unless you change it later.
