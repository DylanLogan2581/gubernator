import js from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import tanstackQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import { createConfig as createBoundariesConfig } from "eslint-plugin-boundaries/config";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

import type { ESLint } from "eslint";

const boundariesConfig = createBoundariesConfig({
  files: ["src/**/*.{ts,tsx}"],
  settings: {
    "boundaries/elements": [
      {
        type: "bootstrap",
        pattern: "src/main.tsx",
        mode: "full",
      },
      {
        type: "route",
        pattern: "src/routes/**/*.{ts,tsx}",
        mode: "full",
      },
      {
        type: "feature",
        pattern: "src/features/*",
        capture: ["feature"],
      },
      {
        type: "ui-component",
        pattern: "src/components/ui/**/*.{ts,tsx}",
        mode: "full",
      },
      {
        type: "app-component",
        pattern: "src/components/app/**/*.{ts,tsx}",
        mode: "full",
      },
      {
        type: "shared-component",
        pattern: "src/components/shared/**/*.{ts,tsx}",
        mode: "full",
      },
      {
        type: "hook",
        pattern: "src/hooks/**/*.{ts,tsx}",
        mode: "full",
      },
      {
        type: "lib",
        pattern: "src/lib/**/*.{ts,tsx}",
        mode: "full",
      },
      {
        type: "shared-type",
        pattern: "src/types/**/*.{ts,tsx}",
        mode: "full",
      },
      {
        type: "test",
        pattern: "src/test/**/*.{ts,tsx}",
        mode: "full",
      },
    ],
    "boundaries/ignore": ["src/routeTree.gen.ts"],
    "boundaries/include": ["src/**/*.{ts,tsx}"],
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        rules: [
          {
            from: { type: "bootstrap" },
            allow: { to: { type: ["lib", "route"] } },
          },
          {
            from: { type: "route" },
            allow: {
              to: {
                type: [
                  "feature",
                  "app-component",
                  "shared-component",
                  "ui-component",
                  "hook",
                  "lib",
                  "shared-type",
                ],
              },
            },
          },
          {
            from: { type: "feature" },
            allow: {
              to: {
                type: [
                  "feature",
                  "app-component",
                  "shared-component",
                  "ui-component",
                  "hook",
                  "lib",
                  "shared-type",
                ],
              },
            },
          },
          {
            from: { type: "app-component" },
            allow: {
              to: {
                type: [
                  "app-component",
                  "shared-component",
                  "ui-component",
                  "hook",
                  "lib",
                  "shared-type",
                ],
              },
            },
          },
          {
            from: { type: "shared-component" },
            allow: {
              to: {
                type: [
                  "shared-component",
                  "ui-component",
                  "hook",
                  "lib",
                  "shared-type",
                ],
              },
            },
          },
          {
            from: { type: "ui-component" },
            allow: {
              to: {
                type: ["ui-component", "lib", "shared-type"],
              },
            },
          },
          {
            from: { type: "hook" },
            allow: {
              to: {
                type: ["hook", "lib", "shared-type"],
              },
            },
          },
          {
            from: { type: "lib" },
            allow: {
              to: {
                type: ["lib", "shared-type"],
              },
            },
          },
          {
            from: { type: "shared-type" },
            allow: {
              to: {
                type: ["shared-type"],
              },
            },
          },
          {
            from: { type: "test" },
            allow: {
              to: { type: "*" },
            },
          },
        ],
      },
    ],
    "boundaries/no-unknown-files": "error",
  },
});

const commonRestrictedSyntax = [
  {
    selector: "ForInStatement",
    message:
      "Avoid for...in. Prefer Object.keys, Object.entries, or for...of over explicit collections.",
  },
  {
    selector: "TSEnumDeclaration",
    message: "Prefer union types or as const objects over enums in app code.",
  },
  {
    selector:
      "CallExpression[callee.object.name='console'][callee.property.name='log']",
    message:
      "Avoid console.log in app code. Use intentional UI state, devtools, or structured logging instead.",
  },
  {
    selector: "WithStatement",
    message: "Do not use with statements.",
  },
];

const appRestrictedSyntax = [
  ...commonRestrictedSyntax,
  {
    selector: "CallExpression[callee.name='createClient']",
    message: "Create the Supabase client only in src/lib/supabase.ts.",
  },
  {
    selector: "NewExpression[callee.name='QueryClient']",
    message: "Create QueryClient only in the approved root/provider setup.",
  },
  {
    selector: "JSXOpeningElement[name.name='QueryClientProvider']",
    message:
      "Render QueryClientProvider only in the approved root/provider setup.",
  },
  {
    selector:
      "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location']",
    message:
      "Avoid writing to window.location directly. Prefer router navigation.",
  },
  {
    selector: "AssignmentExpression[left.object.name='location']",
    message: "Avoid writing to location directly. Prefer router navigation.",
  },
  {
    selector:
      "CallExpression[callee.object.name='window'][callee.property.name='localStorage']",
    message:
      "Do not access localStorage directly in app code. Use a dedicated persistence helper layer.",
  },
  {
    selector:
      "MemberExpression[object.name='window'][property.name='localStorage']",
    message:
      "Do not access localStorage directly in app code. Use a dedicated persistence helper layer.",
  },
  {
    selector: "MemberExpression[object.name='localStorage']",
    message:
      "Do not access localStorage directly in app code. Use a dedicated persistence helper layer.",
  },
  {
    selector:
      "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      "Avoid Date.now() in app code. Prefer injecting time through a helper for testability.",
  },
  {
    selector: "NewExpression[callee.name='Date']",
    message:
      "Avoid new Date() in app code. Prefer injecting time through a helper for testability.",
  },
  {
    selector:
      "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message:
      "Avoid Math.random() in app code. Prefer a dedicated random helper or deterministic input.",
  },
];

const routeAndComponentRestrictedSyntax = [
  ...commonRestrictedSyntax,
  {
    selector: "CallExpression[callee.name='fetch']",
    message:
      "Do not call fetch directly in routes or components. Use feature query modules instead.",
  },
  {
    selector:
      "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
    message:
      "Avoid JSON.parse in UI layers. Keep serialization in helpers, queries, or infrastructure modules.",
  },
  {
    selector:
      "CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
    message:
      "Avoid JSON.stringify in UI layers. Keep serialization in helpers, queries, or infrastructure modules.",
  },
  {
    selector: "CallExpression[callee.name='setTimeout']",
    message:
      "Avoid raw setTimeout in components and routes. Prefer a dedicated hook or cleanup-aware abstraction.",
  },
  {
    selector: "CallExpression[callee.name='setInterval']",
    message:
      "Avoid raw setInterval in components and routes. Prefer a dedicated hook or cleanup-aware abstraction.",
  },
];

const featureComponentRestrictedSyntax = [
  ...commonRestrictedSyntax,
  {
    selector: "CallExpression[callee.name='fetch']",
    message:
      "Do not call fetch directly in feature components. Use feature query modules instead.",
  },
  {
    selector:
      "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
    message:
      "Avoid JSON.parse in feature components. Keep serialization in helpers, queries, or infrastructure modules.",
  },
  {
    selector:
      "CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
    message:
      "Avoid JSON.stringify in feature components. Keep serialization in helpers, queries, or infrastructure modules.",
  },
  {
    selector: "CallExpression[callee.name='setTimeout']",
    message:
      "Avoid raw setTimeout in feature components. Prefer a dedicated hook or cleanup-aware abstraction.",
  },
  {
    selector: "CallExpression[callee.name='setInterval']",
    message:
      "Avoid raw setInterval in feature components. Prefer a dedicated hook or cleanup-aware abstraction.",
  },
];

export default defineConfig([
  globalIgnores(["dist", "src/routeTree.gen.ts"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintReact.configs["recommended-typescript"],
    ],
    plugins: {
      "@tanstack/query": tanstackQuery as unknown as ESLint.Plugin,
      "import-x": importX as unknown as ESLint.Plugin,
      unicorn,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.app.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          noWarnOnMultipleProjects: true,
          project: ["./tsconfig.app.json", "./tsconfig.node.json"],
        },
      },
    },
    rules: {
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "import-x/newline-after-import": ["error", { count: 1 }],
      "import-x/no-cycle": "error",
      "import-x/no-duplicates": "error",
      "import-x/no-internal-modules": [
        "error",
        {
          forbid: ["@/features/*/*", "@/features/*/**/*"],
        },
      ],
      "import-x/order": [
        "error",
        {
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          pathGroups: [
            {
              pattern: "@/**",
              group: "internal",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../../*", "../../../*", "../../../../*"],
              message:
                "Prefer the @/ alias over parent relative imports inside src.",
            },
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...commonRestrictedSyntax],
      "no-unused-vars": "off",
      "object-shorthand": ["error", "always"],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-check": false,
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          minimumDescriptionLength: 8,
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNullableBoolean: false,
          allowNullableNumber: false,
          allowNullableObject: false,
          allowNullableString: false,
          allowNumber: false,
          allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false,
          allowString: false,
        },
      ],
      "@eslint-react/jsx-no-useless-fragment": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@tanstack/query/exhaustive-deps": "error",
      "@tanstack/query/no-rest-destructuring": "error",
      "@tanstack/query/stable-query-client": "error",
      "@tanstack/query/no-unstable-deps": "error",
      "@tanstack/query/infinite-query-property-order": "error",
      "@tanstack/query/no-void-query-fn": "error",
      "@tanstack/query/mutation-property-order": "error",
    },
  },
  boundariesConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/supabase.ts",
      "src/routes/__root.tsx",
      "src/lib/queryClient.ts",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...appRestrictedSyntax],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/main.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='createRouter']",
          message: "Create the router only in src/main.tsx.",
        },
        {
          selector: "JSXOpeningElement[name.name='RouterProvider']",
          message: "Render RouterProvider only in src/main.tsx.",
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../../*", "../../../*", "../../../../*"],
              message:
                "Prefer the @/ alias over parent relative imports inside src.",
            },
            {
              group: [
                "@/components/app/**",
                "@/components/shared/**",
                "@/features/**",
                "@/routes/**",
              ],
              message:
                "Keep ui primitives low-level and independent of app, feature, and route modules.",
            },
            {
              group: ["@/lib/supabase"],
              message:
                "Do not couple UI primitives directly to the Supabase client.",
            },
          ],
        },
      ],
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
    },
  },
  {
    files: [
      "src/components/app/**/*.{ts,tsx}",
      "src/components/shared/**/*.{ts,tsx}",
      "src/features/*/components/**/*.{ts,tsx}",
    ],
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          case: "pascalCase",
        },
      ],
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/**"],
              message:
                "Import other features through public entrypoints. Within the same feature, local relative imports are allowed.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/routes/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../../*", "../../../*", "../../../../*"],
              message:
                "Prefer the @/ alias over parent relative imports inside src.",
            },
            {
              group: ["@/lib/supabase"],
              message:
                "Access Supabase through feature query modules instead of directly from routes or components.",
            },
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...routeAndComponentRestrictedSyntax],
    },
  },
  {
    files: ["src/features/*/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase"],
              message:
                "Access Supabase through feature query modules instead of directly from feature components.",
            },
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...featureComponentRestrictedSyntax],
    },
  },
  {
    files: ["src/routes/**/*.{ts,tsx}"],
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: ["^__root$", "^index$"],
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  eslintConfigPrettier,
  {
    files: ["eslint.config.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
]);
