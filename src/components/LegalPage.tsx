import Link from "next/link";
import type { ReactNode } from "react";
import { he } from "@/lib/i18n/he";
import type { LegalDoc } from "@/lib/i18n/legal.he";

/** `[label](href)` → links; external ones open in a new tab and say so to screen readers. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, label, href] = m;
    const cls =
      "font-semibold text-accent underline underline-offset-4 hover:no-underline";
    out.push(
      href.startsWith("/") ? (
        <Link key={m.index} href={href} className={cls}>
          {label}
        </Link>
      ) : (
        <a
          key={m.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {label}
          <span className="sr-only"> {he.settings.newTab}</span>
        </a>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A long-form legal document (privacy, terms) with a table of contents and anchored sections. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <article
      className="mx-auto max-w-[760px] px-4 py-6 md:py-10"
      aria-labelledby="legal-title"
    >
      <h1 id="legal-title" className="text-title font-bold">
        {doc.title}
      </h1>
      <p className="mt-1 text-caption text-muted">{he.legal.updated}</p>
      <p className="mt-4 leading-relaxed">{doc.intro}</p>

      <nav aria-labelledby="toc-title" className="card mt-5 p-4">
        <h2 id="toc-title" className="text-caption font-bold text-muted">
          {he.legal.toc}
        </h2>
        <ol className="mt-1 grid gap-x-6 sm:grid-cols-2">
          {doc.sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-10 items-center text-sm text-accent underline-offset-4 hover:underline"
              >
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {doc.sections.map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-h`}
          className="mt-8 scroll-mt-20 space-y-3"
        >
          <h2 id={`${s.id}-h`} className="text-h2 font-bold">
            {i + 1}. {s.title}
          </h2>
          {s.blocks.map((b, j) =>
            "p" in b ? (
              <p key={j} className="leading-relaxed">
                {inline(b.p)}
              </p>
            ) : "ul" in b ? (
              <ul key={j} className="list-disc space-y-2 ps-5 leading-relaxed">
                {b.ul.map((t, k) => (
                  <li key={k}>{inline(t)}</li>
                ))}
              </ul>
            ) : (
              <div key={j}>
                {/* Small screens: one card per row (a 3–4 column table does not fit 320px). */}
                <ul
                  aria-label={b.table.caption}
                  className="space-y-2 sm:hidden"
                >
                  {b.table.rows.map((r) => (
                    <li
                      key={r[0]}
                      className="rounded-lg border border-border p-3 text-sm"
                    >
                      <p
                        dir="ltr"
                        className="text-start font-mono text-xs font-bold"
                      >
                        {r[0]}
                      </p>
                      <dl className="mt-1 space-y-1">
                        {r.slice(1).map((c, k) => (
                          <div key={k}>
                            <dt className="inline font-semibold text-muted">
                              {b.table.head[k + 1]}:{" "}
                            </dt>
                            <dd className="inline">{c}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
                <div
                  className="hidden overflow-x-auto rounded-lg border border-border sm:block"
                  role="region"
                  aria-label={b.table.caption}
                  tabIndex={0}
                >
                  <table className="w-full border-collapse text-start text-sm">
                    <caption className="sr-only">{b.table.caption}</caption>
                    <thead className="bg-surface-2">
                      <tr>
                        {b.table.head.map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-3 py-2 text-start font-bold"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.table.rows.map((r) => (
                        <tr
                          key={r[0]}
                          className="border-t border-border align-top"
                        >
                          {r.map((c, k) =>
                            k === 0 ? (
                              <th
                                key={k}
                                scope="row"
                                className="px-3 py-2 text-start font-mono text-xs font-normal"
                                dir="ltr"
                              >
                                {c}
                              </th>
                            ) : (
                              <td key={k} className="px-3 py-2">
                                {c}
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
