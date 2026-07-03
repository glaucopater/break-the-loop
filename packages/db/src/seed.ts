import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { getDbPath } from "./path.js";

const articles = [
  {
    title: "Introduction to Caching",
    summary: "Why caching improves latency and throughput in distributed systems.",
    tags: "caching,performance,distributed",
    body: "Caching stores frequently accessed data closer to consumers. Common patterns include cache-aside, write-through, and TTL-based eviction.",
  },
  {
    title: "Redis vs Memcached",
    summary: "Comparing two popular in-memory data stores for caching workloads.",
    tags: "caching,redis,memcached",
    body: "Redis offers rich data structures and persistence options. Memcached focuses on simplicity and horizontal scaling for pure key-value caching.",
  },
  {
    title: "HTTP Caching Headers",
    summary: "How browsers and CDNs use Cache-Control and ETag headers.",
    tags: "caching,http,web",
    body: "Cache-Control directives like max-age and no-store govern client behavior. ETags enable conditional requests and efficient revalidation.",
  },
  {
    title: "Event-Driven Architecture Basics",
    summary: "Decoupling services with events, queues, and async handlers.",
    tags: "events,architecture,async",
    body: "Event-driven systems publish facts instead of commands. Consumers react independently, improving scalability and fault isolation.",
  },
  {
    title: "Server-Sent Events in Practice",
    summary: "Pushing server updates to browsers over a one-way HTTP stream.",
    tags: "sse,events,web,async",
    body: "SSE uses a long-lived HTTP connection where the server sends text/event-stream messages. It is simpler than WebSockets for server-to-client push.",
  },
  {
    title: "SQLite for Local Prototypes",
    summary: "Using embedded SQLite for fast POC development.",
    tags: "sqlite,database,prototype",
    body: "SQLite requires no separate server process and ships as a single file. It is ideal for local tools, tests, and lightweight applications.",
  },
  {
    title: "Model Context Protocol Overview",
    summary: "How MCP standardizes tool access for AI agents.",
    tags: "mcp,agents,tools",
    body: "MCP defines a protocol for agents to discover and invoke tools. Servers expose capabilities over stdio or HTTP transports.",
  },
  {
    title: "Running Ollama Locally",
    summary: "Self-hosted LLM inference with token usage metrics.",
    tags: "ollama,llm,local",
    body: "Ollama serves open models via a local HTTP API. Responses include prompt_eval_count and eval_count for monitoring token consumption.",
  },
  {
    title: "Breaking the Agent Loop",
    summary: "Translating user intent into atomic events instead of full agent reasoning.",
    tags: "agents,architecture,events",
    body: "When agents only emit deterministic events, orchestrators can route work without feeding large tool results back through the model.",
  },
  {
    title: "Zod Schema Validation",
    summary: "Runtime validation for JSON payloads from LLMs.",
    tags: "typescript,validation,zod",
    body: "Zod schemas validate untrusted JSON at runtime. They are especially useful for constraining LLM outputs to expected shapes.",
  },
];

const products = [
  {
    name: "Aurora Wireless Headphones",
    sku: "AUDIO-001",
    category: "Electronics",
    price_cents: 12999,
    description: "Over-ear ANC headphones with 40h battery and USB-C fast charge.",
    tags: "audio,wireless,headphones",
  },
  {
    name: "Nimbus Standing Desk",
    sku: "FURN-014",
    category: "Office",
    price_cents: 54900,
    description: "Electric height-adjustable desk, 140×70 cm bamboo top, memory presets.",
    tags: "office,desk,ergonomic",
  },
  {
    name: "Forge Coffee Grinder",
    sku: "KITCH-022",
    category: "Kitchen",
    price_cents: 18900,
    description: "Burr grinder with 40 grind settings for espresso to French press.",
    tags: "coffee,kitchen,grinder",
  },
  {
    name: "Trailblazer Hiking Backpack",
    sku: "OUT-008",
    category: "Outdoors",
    price_cents: 11900,
    description: "35L waterproof daypack with hip belt and hydration sleeve.",
    tags: "hiking,backpack,outdoors",
  },
  {
    name: "Lumen Desk Lamp",
    sku: "HOME-031",
    category: "Home",
    price_cents: 4599,
    description: "LED task lamp with warm/cool modes and touch dimmer.",
    tags: "lighting,desk,home",
  },
  {
    name: "Pulse Fitness Tracker",
    sku: "WEAR-005",
    category: "Wearables",
    price_cents: 7999,
    description: "Heart-rate, sleep, and GPS tracking with 7-day battery.",
    tags: "fitness,wearable,health",
  },
  {
    name: "Ceramic Pour-Over Set",
    sku: "KITCH-041",
    category: "Kitchen",
    price_cents: 3499,
    description: "V60 dripper, carafe, and filters for manual brew coffee.",
    tags: "coffee,kitchen,brewing",
  },
  {
    name: "CloudSoft Throw Blanket",
    sku: "HOME-019",
    category: "Home",
    price_cents: 2999,
    description: "Microfleece throw, machine washable, 150×200 cm.",
    tags: "home,blanket,cozy",
  },
  {
    name: "Studio USB Microphone",
    sku: "AUDIO-012",
    category: "Electronics",
    price_cents: 9999,
    description: "Cardioid condenser mic with pop filter for podcasting and streaming.",
    tags: "audio,microphone,podcast",
  },
  {
    name: "Compact Air Purifier",
    sku: "HOME-044",
    category: "Home",
    price_cents: 14900,
    description: "HEPA filter for rooms up to 25 m², quiet night mode.",
    tags: "home,air,wellness",
  },
];

const recipes = [
  {
    title: "Classic Pasta Carbonara",
    cuisine: "Italian",
    prep_minutes: 25,
    servings: 4,
    difficulty: "medium",
    ingredients: "spaghetti, guanciale, eggs, pecorino, black pepper",
    instructions: "Crisp guanciale. Toss hot pasta with egg-cheese mixture off heat. Season generously with pepper.",
    tags: "pasta,italian,dinner",
  },
  {
    title: "Thai Green Curry",
    cuisine: "Thai",
    prep_minutes: 35,
    servings: 4,
    difficulty: "medium",
    ingredients: "green curry paste, coconut milk, chicken, bamboo shoots, basil, fish sauce",
    instructions: "Fry curry paste, add coconut milk, simmer chicken and vegetables. Finish with basil.",
    tags: "curry,thai,spicy",
  },
  {
    title: "Simple Sourdough Bread",
    cuisine: "European",
    prep_minutes: 240,
    servings: 8,
    difficulty: "hard",
    ingredients: "sourdough starter, bread flour, water, salt",
    instructions: "Autolyse, stretch-and-fold, bulk ferment, shape, cold proof, bake in Dutch oven.",
    tags: "bread,baking,sourdough",
  },
  {
    title: "Shakshuka",
    cuisine: "Middle Eastern",
    prep_minutes: 30,
    servings: 3,
    difficulty: "easy",
    ingredients: "eggs, tomatoes, bell pepper, onion, cumin, paprika, feta",
    instructions: "Simmer spiced tomato sauce. Crack eggs into wells, cover until set. Serve with bread.",
    tags: "breakfast,eggs,brunch",
  },
  {
    title: "Chicken Tikka Masala",
    cuisine: "Indian",
    prep_minutes: 50,
    servings: 4,
    difficulty: "medium",
    ingredients: "chicken, yogurt, garam masala, tomatoes, cream, ginger, garlic",
    instructions: "Marinate and grill chicken. Simmer tikka in spiced tomato-cream sauce.",
    tags: "curry,indian,chicken",
  },
  {
    title: "Greek Salad",
    cuisine: "Greek",
    prep_minutes: 15,
    servings: 4,
    difficulty: "easy",
    ingredients: "cucumber, tomato, red onion, olives, feta, oregano, olive oil",
    instructions: "Chop vegetables, combine with olives and feta. Dress with oil and oregano.",
    tags: "salad,greek,vegetarian",
  },
  {
    title: "Beef Tacos al Pastor",
    cuisine: "Mexican",
    prep_minutes: 40,
    servings: 6,
    difficulty: "medium",
    ingredients: "beef, pineapple, achiote, corn tortillas, onion, cilantro, lime",
    instructions: "Marinate and sear beef with pineapple. Serve on warm tortillas with toppings.",
    tags: "tacos,mexican,dinner",
  },
  {
    title: "Miso Ramen",
    cuisine: "Japanese",
    prep_minutes: 45,
    servings: 2,
    difficulty: "medium",
    ingredients: "ramen noodles, miso paste, pork belly, soft egg, nori, scallions, broth",
    instructions: "Build miso broth, cook noodles separately, assemble bowls with toppings.",
    tags: "ramen,japanese,soup",
  },
  {
    title: "Banana Pancakes",
    cuisine: "American",
    prep_minutes: 20,
    servings: 3,
    difficulty: "easy",
    ingredients: "banana, flour, eggs, milk, baking powder, maple syrup, butter",
    instructions: "Mash banana into batter. Cook on griddle until golden. Serve with syrup.",
    tags: "breakfast,pancakes,sweet",
  },
  {
    title: "Ratatouille",
    cuisine: "French",
    prep_minutes: 55,
    servings: 6,
    difficulty: "medium",
    ingredients: "eggplant, zucchini, tomato, bell pepper, onion, garlic, herbs de Provence",
    instructions: "Layer sliced vegetables in dish. Bake with herb tomato sauce until tender.",
    tags: "vegetarian,french,stew",
  },
];

function seed(): void {
  const dbPath = getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.exec(`
    DROP TABLE IF EXISTS articles;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS recipes;

    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      tags TEXT NOT NULL,
      body TEXT NOT NULL
    );

    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      description TEXT NOT NULL,
      tags TEXT NOT NULL
    );

    CREATE TABLE recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      cuisine TEXT NOT NULL,
      prep_minutes INTEGER NOT NULL,
      servings INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      instructions TEXT NOT NULL,
      tags TEXT NOT NULL
    );
  `);

  const insertArticle = db.prepare(
    "INSERT INTO articles (title, summary, tags, body) VALUES (?, ?, ?, ?)",
  );
  const insertProduct = db.prepare(
    "INSERT INTO products (name, sku, category, price_cents, description, tags) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertRecipe = db.prepare(
    "INSERT INTO recipes (title, cuisine, prep_minutes, servings, difficulty, ingredients, instructions, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const seedAll = db.transaction(() => {
    for (const row of articles) {
      insertArticle.run(row.title, row.summary, row.tags, row.body);
    }
    for (const row of products) {
      insertProduct.run(
        row.name,
        row.sku,
        row.category,
        row.price_cents,
        row.description,
        row.tags,
      );
    }
    for (const row of recipes) {
      insertRecipe.run(
        row.title,
        row.cuisine,
        row.prep_minutes,
        row.servings,
        row.difficulty,
        row.ingredients,
        row.instructions,
        row.tags,
      );
    }
  });

  seedAll();
  db.close();
  console.log(
    `Seeded ${articles.length} articles, ${products.length} products, ${recipes.length} recipes into ${dbPath}`,
  );
}

seed();
