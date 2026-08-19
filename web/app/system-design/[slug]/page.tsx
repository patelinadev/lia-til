import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DiagramLoadBalanced,
  DiagramRequestResponse,
  DiagramStatefulStateless,
  DiagramApiProtocols,
} from "../diagrams";
import { DECKS, deckBySlug, type DiagramKey, type Slide } from "../decks";

const DIAGRAMS: Record<DiagramKey, () => React.ReactElement> = {
  loadBalanced: DiagramLoadBalanced,
  requestResponse: DiagramRequestResponse,
  statefulStateless: DiagramStatefulStateless,
  apiProtocols: DiagramApiProtocols,
};

export function generateStaticParams() {
  return DECKS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = deckBySlug(slug);
  return { title: deck ? `${deck.title} · System Design` : "System Design" };
}

function SlideCard({ slide }: { slide: Slide }) {
  const Diagram = slide.diagram ? DIAGRAMS[slide.diagram] : null;
  return (
    <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <p className="text-xs font-medium uppercase tracking-widest text-blue-600 dark:text-blue-400">
        {slide.eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold">{slide.title}</h2>
      {Diagram && <Diagram />}
      {slide.intro && <p className="mt-3 text-neutral-600 dark:text-neutral-400">{slide.intro}</p>}
      {slide.bullets && (
        <ul className="mt-3 flex flex-col gap-2">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500/70" />
              <span>
                {b.term && (
                  <b className="font-semibold text-neutral-800 dark:text-neutral-200">{b.term} </b>
                )}
                {b.text}
              </span>
            </li>
          ))}
        </ul>
      )}
      {slide.notes?.map((n, i) => (
        <p key={i} className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          {n}
        </p>
      ))}
      {slide.quote && (
        <blockquote className="mt-3 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-500 dark:border-neutral-600">
          {slide.quote}
        </blockquote>
      )}
    </div>
  );
}

export default async function DeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = deckBySlug(slug);
  if (!deck) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
      <Link
        href="/system-design"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; System Design
      </Link>

      <div className="mt-6 mb-8 flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span className="font-mono text-lg text-neutral-400">#{deck.n}</span> {deck.title}
        </h1>
        <p className="font-mono text-xs text-neutral-500">Last reviewed {deck.lastReviewed}</p>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
        {/* outline nav (Google-Docs style), sticky on the left */}
        <aside className="hidden lg:block">
          <nav className="sticky top-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              On this page
            </p>
            <ul className="flex flex-col gap-1 border-l border-neutral-200 dark:border-neutral-800">
              {deck.slides.map((s, i) => (
                <li key={i}>
                  <a
                    href={`#s-${i}`}
                    className="-ml-px block border-l border-transparent py-1 pl-3 text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                  >
                    {s.eyebrow}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* slides */}
        <div className="flex flex-col gap-4">
          {deck.slides.map((slide, i) => (
            <section key={i} id={`s-${i}`} className="scroll-mt-8">
              <SlideCard slide={slide} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
