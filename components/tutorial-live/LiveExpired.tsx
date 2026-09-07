import { ButtonLink } from "@/components/ui/Button";

/**
 * What the page shows when the route answers 404: the page expired, or never existed. The
 * route answers both the same way on purpose, so the sentence covers both.
 */
export function LiveExpired() {
  return (
    <section className="panel flex flex-col gap-4 p-5" aria-label="This live page has expired">
      <p className="text-sm leading-relaxed text-muted">
        This live page has expired, or its address is not one this site opened; a page lasts
        a day from the moment your agent last posted to it.
      </p>
      <div>
        <ButtonLink href="/tutorial" variant="outline">
          Open a new live page from the tutorial
        </ButtonLink>
      </div>
    </section>
  );
}
