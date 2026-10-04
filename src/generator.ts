import words from "./data/words.json";

export type Category = keyof typeof words;

export interface GeneratedName {
  name: string;
  words: string[];
  categories: Category[];
}

type Template = Category[][];

const TWO_WORD: Template[] = [
  [
    ["adjectives"],
    ["animals", "metals", "technology_concepts", "nouns", "places_and_realms", "flowers"],
  ],
  [
    ["technology_concepts", "metals"],
    ["animals", "nouns", "places_and_realms"],
  ],
];

const THREE_WORD: Template[] = [
  [
    ["adjectives"],
    ["metals", "technology_concepts"],
    ["animals", "nouns", "flowers", "places_and_realms"],
  ],
  [
    ["adjectives"],
    ["animals", "flowers"],
    ["places_and_realms", "technology_concepts"],
  ],
];

/** Unbiased CSPRNG integer in [0, max) using rejection sampling. */
function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % max);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

/** Number of name combinations a template can produce. */
function combinations(template: Template): number {
  return template.reduce(
    (total, options) => total * options.reduce((n, c) => n + words[c].length, 0),
    1,
  );
}

/**
 * The templates never produce the same name twice (their category sequences differ), so
 * weighting each by its combination count makes every possible name equally likely.
 */
function pickTemplate(templates: Template[]): Template {
  const weights = templates.map(combinations);
  let r = randomInt(weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < templates.length; i++) {
    if (r < weights[i]) return templates[i];
    r -= weights[i];
  }
  return templates[templates.length - 1];
}

export function generateName(wordCount: 2 | 3): GeneratedName {
  const templates = wordCount === 2 ? TWO_WORD : THREE_WORD;
  // Some words exist in more than one category (e.g. "Obsidian"), so retry on repeats.
  for (;;) {
    const template = pickTemplate(templates);
    const categories = template.map((options) => pick(options));
    const picked = categories.map((c) => pick(words[c]));
    if (new Set(picked).size === picked.length) {
      return { name: picked.join(" "), words: picked, categories };
    }
  }
}

/** Generates `count` names that are distinct within the batch. */
export function generateNames(count: number, wordCount: 2 | 3): GeneratedName[] {
  const seen = new Set<string>();
  const out: GeneratedName[] = [];
  // Safety net: never loop forever, even if the word lists are made much smaller.
  for (let attempts = 0; out.length < count; attempts++) {
    if (attempts > count * 100) throw new Error("Could not generate enough distinct names");
    const n = generateName(wordCount);
    if (!seen.has(n.name)) {
      seen.add(n.name);
      out.push(n);
    }
  }
  return out;
}
