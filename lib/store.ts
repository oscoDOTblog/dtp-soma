import { Collection, Db, MongoClient } from "mongodb";
import { Ingredient, Recipe, RecipeInput, slugifyTitle } from "./recipes";

/**
 * Storage boundary for recipes. MongoDB Atlas is the source of truth.
 * Dev and prod live in separate collections of the same database so one
 * Atlas cluster serves both environments without data mixing.
 */
export interface RecipeStore {
  list(): Promise<Recipe[]>;
  get(id: string): Promise<Recipe | null>;
  create(input: RecipeInput): Promise<Recipe>;
  update(id: string, input: RecipeInput): Promise<Recipe | null>;
  remove(id: string): Promise<boolean>;
  setFavorite(id: string, favorite: boolean): Promise<Recipe | null>;
  markCooked(id: string): Promise<Recipe | null>;
  ensureUniqueId(base: string): Promise<string>;
}

export type AppEnv = "dev" | "prod";

interface RecipeDoc {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  image: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number;
  ingredients: Ingredient[];
  bodyMarkdown: string;
  sourceMarkdown: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastCookedAt: string | null;
}

function docToRecipe(doc: RecipeDoc): Recipe {
  return {
    id: doc._id,
    title: doc.title,
    description: doc.description,
    tags: doc.tags,
    categories: doc.categories,
    image: doc.image,
    prepMinutes: doc.prepMinutes,
    cookMinutes: doc.cookMinutes,
    servings: doc.servings,
    ingredients: doc.ingredients,
    bodyMarkdown: doc.bodyMarkdown,
    sourceMarkdown: doc.sourceMarkdown,
    favorite: doc.favorite,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastCookedAt: doc.lastCookedAt,
  };
}

/** Which environment this process serves: explicit APP_ENV wins, else NODE_ENV. */
export function resolveAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV ?? "").trim().toLowerCase();
  if (raw === "prod" || raw === "production") return "prod";
  if (raw === "dev" || raw === "development") return "dev";
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}

export function dbName(): string {
  return process.env.MONGODB_DB ?? "dtp-soma";
}

/** Collection per environment; explicit MONGODB_COLLECTION overrides. */
export function collectionName(env: AppEnv = resolveAppEnv()): string {
  return process.env.MONGODB_COLLECTION ?? `soma_${env}_recipes`;
}

/** Both environment collections so a deploy creates dev AND prod tables. */
export function devProdCollections(): { dev: string; prod: string } {
  if (process.env.MONGODB_COLLECTION) {
    return { dev: process.env.MONGODB_COLLECTION, prod: process.env.MONGODB_COLLECTION };
  }
  return { dev: "soma_dev_recipes", prod: "soma_prod_recipes" };
}

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to your environment.");
  return uri;
}

let client: MongoClient | null = null;
let clientUri: string | null = null;

export function getClient(): MongoClient {
  const uri = mongoUri();
  if (client && clientUri === uri) return client;
  client = new MongoClient(uri);
  clientUri = uri;
  return client;
}

async function getMongoDb(): Promise<Db> {
  const c = getClient();
  await c.connect();
  return c.db(dbName());
}

async function getCollection(name?: string): Promise<Collection<RecipeDoc>> {
  const db = await getMongoDb();
  const coll = db.collection<RecipeDoc>(name ?? collectionName());
  await coll.createIndex({ favorite: -1, updatedAt: -1 });
  return coll;
}

/**
 * Create the dev and prod collections (with indexes) if they do not exist
 * yet. Call during deploy/startup so both tables exist before traffic.
 */
export async function ensureDevProdCollections(): Promise<{ dev: string; prod: string }> {
  const db = await getMongoDb();
  const names = devProdCollections();
  for (const name of [names.dev, names.prod]) {
    await db.createCollection(name).catch((error: unknown) => {
      if (
        error instanceof Error &&
        (error.message.includes("already exists") || "codeName" in error)
      ) {
        const named = error as Error & { codeName?: string };
        if (named.codeName === "NamespaceExists" || error.message.includes("already exists")) return;
      }
      throw error;
    });
    await db.collection(name).createIndex({ favorite: -1, updatedAt: -1 });
  }
  return names;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class MongoRecipeStore implements RecipeStore {
  private readonly collectionName: string;

  constructor(collection?: string) {
    this.collectionName = collection ?? collectionName();
  }

  private coll(): Promise<Collection<RecipeDoc>> {
    return getCollection(this.collectionName);
  }

  async list(): Promise<Recipe[]> {
    const docs = await (await this.coll())
      .find()
      .sort({ favorite: -1, updatedAt: -1 })
      .toArray();
    return docs.map(docToRecipe);
  }

  async get(id: string): Promise<Recipe | null> {
    const doc = await (await this.coll()).findOne({ _id: id });
    return doc ? docToRecipe(doc) : null;
  }

  async ensureUniqueId(base: string): Promise<string> {
    let candidate = base || "untitled-recipe";
    let n = 2;
    while (await this.get(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }

  async create(input: RecipeInput): Promise<Recipe> {
    const id = await this.ensureUniqueId(input.id?.trim() || slugifyTitle(input.title));
    const now = nowIso();
    const doc: RecipeDoc = {
      _id: id,
      title: input.title,
      description: input.description,
      tags: input.tags,
      categories: input.categories,
      image: input.image,
      prepMinutes: input.prepMinutes,
      cookMinutes: input.cookMinutes,
      servings: input.servings,
      ingredients: input.ingredients,
      bodyMarkdown: input.bodyMarkdown,
      sourceMarkdown: input.sourceMarkdown,
      favorite: input.favorite,
      createdAt: now,
      updatedAt: now,
      lastCookedAt: null,
    };
    await (await this.coll()).insertOne(doc);
    const created = await this.get(id);
    if (!created) throw new Error("Failed to read back created recipe.");
    return created;
  }

  async update(id: string, input: RecipeInput): Promise<Recipe | null> {
    const result = await (await this.coll()).findOneAndUpdate(
      { _id: id },
      {
        $set: {
          title: input.title,
          description: input.description,
          tags: input.tags,
          categories: input.categories,
          image: input.image,
          prepMinutes: input.prepMinutes,
          cookMinutes: input.cookMinutes,
          servings: input.servings,
          ingredients: input.ingredients,
          bodyMarkdown: input.bodyMarkdown,
          sourceMarkdown: input.sourceMarkdown,
          favorite: input.favorite,
          updatedAt: nowIso(),
        },
      },
      { returnDocument: "after" },
    );
    return result ? docToRecipe(result) : null;
  }

  async remove(id: string): Promise<boolean> {
    const result = await (await this.coll()).deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async setFavorite(id: string, favorite: boolean): Promise<Recipe | null> {
    const result = await (await this.coll()).findOneAndUpdate(
      { _id: id },
      { $set: { favorite, updatedAt: nowIso() } },
      { returnDocument: "after" },
    );
    return result ? docToRecipe(result) : null;
  }

  async markCooked(id: string): Promise<Recipe | null> {
    const now = nowIso();
    const result = await (await this.coll()).findOneAndUpdate(
      { _id: id },
      { $set: { lastCookedAt: now, updatedAt: now } },
      { returnDocument: "after" },
    );
    return result ? docToRecipe(result) : null;
  }
}

/**
 * In-memory RecipeStore for unit tests — same interface, no Atlas needed.
 */
export class InMemoryRecipeStore implements RecipeStore {
  private readonly rows = new Map<string, Recipe>();

  async list(): Promise<Recipe[]> {
    return Array.from(this.rows.values()).sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  async get(id: string): Promise<Recipe | null> {
    return this.rows.get(id) ?? null;
  }

  async ensureUniqueId(base: string): Promise<string> {
    let candidate = base || "untitled-recipe";
    let n = 2;
    while (this.rows.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }

  async create(input: RecipeInput): Promise<Recipe> {
    const id = await this.ensureUniqueId(input.id?.trim() || slugifyTitle(input.title));
    const now = nowIso();
    const recipe: Recipe = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
      lastCookedAt: null,
    };
    this.rows.set(id, recipe);
    return recipe;
  }

  async update(id: string, input: RecipeInput): Promise<Recipe | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: Recipe = { ...input, id, createdAt: existing.createdAt, updatedAt: nowIso(), lastCookedAt: existing.lastCookedAt };
    this.rows.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async setFavorite(id: string, favorite: boolean): Promise<Recipe | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: Recipe = { ...existing, favorite, updatedAt: nowIso() };
    this.rows.set(id, updated);
    return updated;
  }

  async markCooked(id: string): Promise<Recipe | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const now = nowIso();
    const updated: Recipe = { ...existing, lastCookedAt: now, updatedAt: now };
    this.rows.set(id, updated);
    return updated;
  }
}

let store: RecipeStore | null = null;

/** Application-wide store singleton (override in tests via setStore). */
export async function getStore(): Promise<RecipeStore> {
  if (!store) store = new MongoRecipeStore();
  return store;
}

export function setStore(next: RecipeStore | null): void {
  store = next;
}
