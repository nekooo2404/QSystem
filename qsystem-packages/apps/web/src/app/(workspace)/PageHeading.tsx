/** Placeholder body for routes whose real screens land in Web 5/6. */
export function PageHeading({ title, note }: { title: string; note: string }) {
  return (
    <section className="qs-page">
      <h1>{title}</h1>
      <p className="qs-page__note">{note}</p>
    </section>
  );
}
