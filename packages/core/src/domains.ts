import { z } from "zod";

export const knowledgeDomainSchema = z.enum(["articles", "products", "recipes"]);

export type KnowledgeDomain = z.infer<typeof knowledgeDomainSchema>;

export const articleSchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string(),
  tags: z.string(),
  body: z.string(),
});

export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  sku: z.string(),
  category: z.string(),
  priceCents: z.number(),
  description: z.string(),
  tags: z.string(),
});

export const recipeSchema = z.object({
  id: z.number(),
  title: z.string(),
  cuisine: z.string(),
  prepMinutes: z.number(),
  servings: z.number(),
  difficulty: z.string(),
  ingredients: z.string(),
  instructions: z.string(),
  tags: z.string(),
});

export type Article = z.infer<typeof articleSchema>;
export type Product = z.infer<typeof productSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type KnowledgeRecord = Article | Product | Recipe;

export function domainLabel(domain: KnowledgeDomain): string {
  return { articles: "articles", products: "products", recipes: "recipes" }[domain];
}

export function domainItemLabel(domain: KnowledgeDomain): string {
  return { articles: "article", products: "product", recipes: "recipe" }[domain];
}

export function isArticle(record: KnowledgeRecord): record is Article {
  return "body" in record && "summary" in record && !("sku" in record);
}

export function isProduct(record: KnowledgeRecord): record is Product {
  return "sku" in record;
}

export function isRecipe(record: KnowledgeRecord): record is Recipe {
  return "ingredients" in record && "cuisine" in record;
}
