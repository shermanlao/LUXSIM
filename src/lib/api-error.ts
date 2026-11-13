import { NextResponse } from "next/server";

export function apiErrorResponse(e: unknown, fallback = "Failed"): NextResponse {
  if (e instanceof Error) {
    switch (e.message) {
      case "UNAUTHORIZED":
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      case "FORBIDDEN":
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      case "NOT_FOUND":
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      case "NO_ORG":
        return NextResponse.json({ error: "No workspace" }, { status: 400 });
      case "LAST_SITE_ADMIN":
        return NextResponse.json(
          { error: "The last site administrator cannot be demoted, disabled, or removed" },
          { status: 409 }
        );
      case "LAST_OWNER":
        return NextResponse.json(
          { error: "The last workspace owner cannot be removed or demoted" },
          { status: 409 }
        );
      case "REGISTRATION_CLOSED":
        return NextResponse.json({ error: "Public registration is closed" }, { status: 403 });
    }
  }
  console.error(e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
