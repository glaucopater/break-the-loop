import Database from "better-sqlite3";
import type { Article, KnowledgeDomain, KnowledgeRecord, Product, Recipe } from "@btl/core";
import { getDbPath } from "./path.js";

export function openDatabase(readonly = false): Database.Database {
  return new Database(getDbPath(), { readonly, fileMustExist: true });
}

export function searchArticles(query: string, limit = 10): Article[] {
  const db = openDatabase(true);
  const pattern = `%${query}%`;
  const stmt = db.prepare(`
    SELECT id, title, summary, tags, body
    FROM articles
    WHERE title LIKE ? OR summary LIKE ? OR tags LIKE ? OR body LIKE ?
    ORDER BY id
    LIMIT ?
  `);
  return stmt.all(pattern, pattern, pattern, pattern, limit) as Article[];
}

export function searchProducts(query: string, limit = 10): Product[] {
  const db = openDatabase(true);
  const pattern = `%${query}%`;
  const stmt = db.prepare(`
    SELECT id, name, sku, category, price_cents AS priceCents, description, tags
    FROM products
    WHERE name LIKE ? OR sku LIKE ? OR category LIKE ? OR description LIKE ? OR tags LIKE ?
    ORDER BY id
    LIMIT ?
  `);
  return stmt.all(pattern, pattern, pattern, pattern, pattern, limit) as Product[];
}

export function searchRecipes(query: string, limit = 10): Recipe[] {
  const db = openDatabase(true);
  const pattern = `%${query}%`;
  const stmt = db.prepare(`
    SELECT id, title, cuisine, prep_minutes AS prepMinutes, servings, difficulty,
           ingredients, instructions, tags
    FROM recipes
    WHERE title LIKE ? OR cuisine LIKE ? OR ingredients LIKE ? OR instructions LIKE ? OR tags LIKE ?
    ORDER BY id
    LIMIT ?
  `);
  return stmt.all(pattern, pattern, pattern, pattern, pattern, limit) as Recipe[];
}

export function countArticles(): number {
  const db = openDatabase(true);
  const row = db.prepare(`SELECT COUNT(*) AS total FROM articles`).get() as { total: number };
  return row.total;
}

export function countProducts(): number {
  const db = openDatabase(true);
  const row = db.prepare(`SELECT COUNT(*) AS total FROM products`).get() as { total: number };
  return row.total;
}

export function countRecipes(): number {
  const db = openDatabase(true);
  const row = db.prepare(`SELECT COUNT(*) AS total FROM recipes`).get() as { total: number };
  return row.total;
}

export function searchDomain(domain: KnowledgeDomain, query: string, limit = 10): KnowledgeRecord[] {
  switch (domain) {
    case "products":
      return searchProducts(query, limit);
    case "recipes":
      return searchRecipes(query, limit);
    default:
      return searchArticles(query, limit);
  }
}

export function countDomain(domain: KnowledgeDomain): number {
  switch (domain) {
    case "products":
      return countProducts();
    case "recipes":
      return countRecipes();
    default:
      return countArticles();
  }
}

export { getDbPath } from "./path.js";
