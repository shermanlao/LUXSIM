import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      isSiteAdmin: boolean;
      isWorkspaceOwner: boolean;
    };
  }

  interface User {
    isSiteAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isSiteAdmin?: boolean;
    isWorkspaceOwner?: boolean;
    disabled?: boolean;
  }
}
