// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts imports.
//
// Shared shape of a nameset/world naming config. `type: "list"` is the
// original static-pool format; `type: "generated"` builds names from
// fragment lists ("parts") combined by per-gender concatenation patterns,
// in the style of fantasynamegenerators.com.

export const NAME_CONVENTIONS = [
  "pool",
  "patronymic",
  "matronymic",
  "family-name",
  "none",
] as const;

export type NameConvention = (typeof NAME_CONVENTIONS)[number];

export type ListNamingConfig = {
  readonly type: "list";
  readonly convention: NameConvention;
  readonly female_given_names: readonly string[];
  readonly male_given_names: readonly string[];
  readonly surnames: readonly string[];
};

// A pattern element is either a literal string, inserted verbatim, or a
// list-ref group: an array of part-list keys, each contributing one random
// pick, concatenated together with no separator.
export type NamePatternElement = string | readonly string[];
export type NamePattern = readonly NamePatternElement[];

export type GeneratedNamingConfig = {
  readonly type: "generated";
  readonly convention: NameConvention;
  readonly parts: Readonly<Record<string, readonly string[]>>;
  readonly patterns: {
    readonly female_given: NamePattern;
    readonly male_given: NamePattern;
    readonly surname: NamePattern;
  };
};

export type NamingConfig = ListNamingConfig | GeneratedNamingConfig;

export const namingGenerationCaps = {
  maxConfigBytes: 64 * 1024,
  maxEntriesPerList: 500,
  maxPartLists: 40,
} as const;
