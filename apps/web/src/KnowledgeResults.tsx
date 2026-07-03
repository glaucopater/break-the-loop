import type { KnowledgeDomain, KnowledgeRecord } from "@btl/core";
import { domainItemLabel, isArticle, isProduct, isRecipe } from "@btl/core";

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}

export function KnowledgeResultList({
  domain,
  items,
}: {
  domain: KnowledgeDomain;
  items: KnowledgeRecord[];
}) {
  if (items.length === 0) {
    return <p>No {domainItemLabel(domain)}s found.</p>;
  }

  return (
    <ul>
      {items.map((item) => {
        if (isProduct(item)) {
          return (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <p>
                {item.category} · {item.sku} · {formatPrice(item.priceCents)}
              </p>
              <p>{item.description}</p>
              <small>{item.tags}</small>
            </li>
          );
        }
        if (isRecipe(item)) {
          return (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>
                {item.cuisine} · {item.prepMinutes} min · {item.servings} servings ·{" "}
                {item.difficulty}
              </p>
              <p>{item.ingredients}</p>
              <small>{item.tags}</small>
            </li>
          );
        }
        if (isArticle(item)) {
          return (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
              <small>{item.tags}</small>
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
}
