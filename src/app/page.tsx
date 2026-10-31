import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/projects");

  return (
    <div className="relative overflow-hidden">
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center min-h-[70vh]">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--accent-2)] mb-4">
            Browser lighting calculator
          </p>
          <h1 className="display text-5xl sm:text-6xl leading-[1.05] mb-5">
            LUX<span className="text-[var(--accent)]">SIM</span>
          </h1>
          <p className="text-lg text-[var(--muted)] max-w-xl mb-8">
            Import your own IES/LDT photometry, place fixtures in a simple room, and
            run client-side lux, interreflection, and UGR — then export PDF or a
            DIALux-ready pack.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-accent">
              Create workspace
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
          </div>
        </div>
        <div className="panel p-6 shadow-[0_20px_60px_rgba(18,32,42,0.08)]">
          <div className="aspect-[4/3] bg-[linear-gradient(145deg,#1b2f3a,#0f1c24_55%,#c45c26)] relative overflow-hidden">
            <div className="absolute inset-6 border border-white/20" />
            <div className="absolute left-1/2 top-[42%] -translate-x-1/2 w-3/4 h-1/3 bg-[radial-gradient(ellipse_at_center,rgba(255,220,150,0.55),transparent_70%)] blur-sm" />
            <p className="absolute bottom-4 left-4 right-4 text-white/85 text-sm">
              False-color workplane · IES import · DIALux pack export
            </p>
          </div>
          <p className="disclaimer mt-4">
            Design-assist only. Numbers are approximate. Validate tender-critical
            projects in certified tools such as DIALux.
          </p>
        </div>
      </section>
    </div>
  );
}
