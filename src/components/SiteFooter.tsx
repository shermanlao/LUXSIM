import { SITE_CONTACT, siteCopyrightYear } from "@/lib/site-contact";

export function SiteFooter() {
  const year = siteCopyrightYear();
  const contact = SITE_CONTACT;
  return (
    <footer className="site-footer border-t border-[var(--line)] text-sm text-[var(--muted)]">
      <div className="w-full px-4 py-5 space-y-1.5">
        <p>
          {contact.company}, {contact.address}
        </p>
        <p>
          T {contact.phone}, F {contact.fax},{" "}
          <a
            href={`mailto:${contact.email}`}
            className="underline underline-offset-2 hover:text-[var(--accent-2)]"
          >
            {contact.email}
          </a>
          ,{" "}
          <a
            href={contact.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-[var(--accent-2)]"
          >
            {contact.websiteLabel}
          </a>
        </p>
        <p className="text-xs pt-1">
          © {year} {contact.company}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
