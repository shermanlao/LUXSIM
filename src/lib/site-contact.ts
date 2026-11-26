/** Public LightX contact shown in the site footer (from https://www.lightx.hk/). */
export const SITE_CONTACT = {
  company: "LightX Co., Ltd",
  address: "Unit 2109, 21/F., 32 Tai Yau Street, San Po Kong, Hong Kong",
  phone: "+852 3114 5311",
  fax: "+852 3007 5908",
  email: "info@lightx.hk",
  websiteLabel: "www.lightx.hk",
  websiteUrl: "https://www.lightx.hk",
} as const;

export function siteCopyrightYear(now = new Date()): number {
  return now.getFullYear();
}
