# Changelog

## [0.2.0](https://github.com/DylanLogan2581/gubernator/compare/v0.1.2...v0.2.0) (2026-05-05)

### Bug Fixes

- **auth:** fix seed data to work with authentication ([4854d27](https://github.com/DylanLogan2581/gubernator/commit/4854d27d025ba283f886a555eb209a6863adfff3))
- **auth:** redirect authenticated users away from sign-in ([dda5a14](https://github.com/DylanLogan2581/gubernator/commit/dda5a14a6732030b4ee5b376d11f0b6a3abe9c2d)), closes [#53](https://github.com/DylanLogan2581/gubernator/issues/53)
- **auth:** restrict user status and profile self-updates ([00e8297](https://github.com/DylanLogan2581/gubernator/commit/00e829701ab8b557dd52432a91233d64f69bb51a)), closes [#44](https://github.com/DylanLogan2581/gubernator/issues/44)
- **auth:** sync auth state changes with cached access data ([b5d63cd](https://github.com/DylanLogan2581/gubernator/commit/b5d63cd2d601ff889d10d27152ee12377e73a406)), closes [#48](https://github.com/DylanLogan2581/gubernator/issues/48)
- **home:** add sign-in navigation from the home page ([c8c2e11](https://github.com/DylanLogan2581/gubernator/commit/c8c2e11e57fc76d30067b2b4b11cbd7a80b60928)), closes [#51](https://github.com/DylanLogan2581/gubernator/issues/51)
- **permissions:** align anonymous public-world access semantics ([ed674d5](https://github.com/DylanLogan2581/gubernator/commit/ed674d5b667c0bc0bf17f04883f46d5dcfd2717c)), closes [#49](https://github.com/DylanLogan2581/gubernator/issues/49)
- **permissions:** align owner and world admin capability semantics ([295e765](https://github.com/DylanLogan2581/gubernator/commit/295e765df8fc35499d10ab5b7e36610af7bf8a30)), closes [#46](https://github.com/DylanLogan2581/gubernator/issues/46)
- **permissions:** enforce active user status across world access ([8102193](https://github.com/DylanLogan2581/gubernator/commit/81021939b29e734cd5c57016e4540f5be917509d)), closes [#45](https://github.com/DylanLogan2581/gubernator/issues/45)
- **repo:** enforce lint guardrails and align docs ([3cb98b6](https://github.com/DylanLogan2581/gubernator/commit/3cb98b651b5f4011b9e470d5905893a2be93ecb1))
- **worlds:** add back-to-worlds navigation from world pages ([83503ab](https://github.com/DylanLogan2581/gubernator/commit/83503abd535a65d033b8c490f4d25f32b71a054c)), closes [#52](https://github.com/DylanLogan2581/gubernator/issues/52)

### Features

- **auth:** add auth query and mutation modules ([1809aba](https://github.com/DylanLogan2581/gubernator/commit/1809aba3ba5747560ac65eba7aa379025379853e)), closes [#25](https://github.com/DylanLogan2581/gubernator/issues/25)
- **auth:** add auth user profile sync ([ff00a50](https://github.com/DylanLogan2581/gubernator/commit/ff00a506ee9b6a5c1e0a5fd5d4de6a8065ada2f5)), closes [#19](https://github.com/DylanLogan2581/gubernator/issues/19)
- **auth:** add authenticated route guard ([78d3800](https://github.com/DylanLogan2581/gubernator/commit/78d3800749e66a9ee5b63b8aed565f0d521a7e07)), closes [#28](https://github.com/DylanLogan2581/gubernator/issues/28)
- **auth:** add sign in route and screen ([a6edb86](https://github.com/DylanLogan2581/gubernator/commit/a6edb86eb5e590a996546459730a4d3ef52bbf52)), closes [#26](https://github.com/DylanLogan2581/gubernator/issues/26)
- **auth:** add sign out flow ([675ef0a](https://github.com/DylanLogan2581/gubernator/commit/675ef0a8e2dc0688a0b7189eb8ac728470acd0e6)), closes [#27](https://github.com/DylanLogan2581/gubernator/issues/27)
- **config:** harden supabase environment handling ([e6aac11](https://github.com/DylanLogan2581/gubernator/commit/e6aac118004080dc59d756c88480419b65d3556c)), closes [#24](https://github.com/DylanLogan2581/gubernator/issues/24)
- **permissions:** add access denied states ([e6e9a49](https://github.com/DylanLogan2581/gubernator/commit/e6e9a4992ba7e7dcf7d45f5b313a010c4794899f)), closes [#34](https://github.com/DylanLogan2581/gubernator/issues/34)
- **permissions:** add permission access context module ([008cbc2](https://github.com/DylanLogan2581/gubernator/commit/008cbc27c2032415697b8dce29c8d95c48ca63e0)), closes [#29](https://github.com/DylanLogan2581/gubernator/issues/29)
- **permissions:** add permission sql helpers ([615041c](https://github.com/DylanLogan2581/gubernator/commit/615041c95d797a003f66472102a3907ca6696db4)), closes [#20](https://github.com/DylanLogan2581/gubernator/issues/20)
- **permissions:** add world access rls policies ([b6b49ec](https://github.com/DylanLogan2581/gubernator/commit/b6b49ecfeced62674a81a4f0869d2b3c8895ae4f)), closes [#21](https://github.com/DylanLogan2581/gubernator/issues/21)
- **supabase:** add generated database types ([ad445b6](https://github.com/DylanLogan2581/gubernator/commit/ad445b60ad0563553f3e250896a3ad55353c55db)), closes [#23](https://github.com/DylanLogan2581/gubernator/issues/23)
- **supabase:** add identity and world access schema ([7a078bd](https://github.com/DylanLogan2581/gubernator/commit/7a078bd0388bbd41ac7d8002e678cb058ae71813)), closes [#18](https://github.com/DylanLogan2581/gubernator/issues/18)
- **supabase:** add local development admin seed ([c0c16c0](https://github.com/DylanLogan2581/gubernator/commit/c0c16c095f85cec3b09248775f68419d56aab32d)), closes [#22](https://github.com/DylanLogan2581/gubernator/issues/22)
- **worlds:** add accessible world list query module ([9485c31](https://github.com/DylanLogan2581/gubernator/commit/9485c31d4a7b28559d995b4d4d60ebde71d2fe1f)), closes [#30](https://github.com/DylanLogan2581/gubernator/issues/30)
- **worlds:** add protected world shell route ([9a0f0eb](https://github.com/DylanLogan2581/gubernator/commit/9a0f0eb5383755f3eb7f93b56e75bf94295c83c3)), closes [#33](https://github.com/DylanLogan2581/gubernator/issues/33)
- **worlds:** add world list route and screen ([12ee383](https://github.com/DylanLogan2581/gubernator/commit/12ee38339f8364df238abb1210209c836c081cae)), closes [#31](https://github.com/DylanLogan2581/gubernator/issues/31)
- **worlds:** add world shell access query ([9a629c1](https://github.com/DylanLogan2581/gubernator/commit/9a629c106db4b44bc7833df5ef1e976d9da384a7)), closes [#32](https://github.com/DylanLogan2581/gubernator/issues/32)

## [0.1.2](https://github.com/DylanLogan2581/gubernator/compare/v0.1.1...v0.1.2) (2026-04-26)

### Bug Fixes

- **ci:** fix release note extraction for patch releases ([cf3ff94](https://github.com/DylanLogan2581/gubernator/commit/cf3ff9404af957c53f2cfe6cae8fb53b9301dce6))
- **ci:** further tweak changelog formatting ([47bec3f](https://github.com/DylanLogan2581/gubernator/commit/47bec3f6f7bc06313582f235631a0d364f80289f))

## [0.1.1](https://github.com/DylanLogan2581/gubernator/compare/v0.1.0...v0.1.1) (2026-04-26)

### Bug Fixes

- **ci:** fix release process to include the package-lock.json update ([346ff3f](https://github.com/DylanLogan2581/gubernator/commit/346ff3f53ec9f398679e3992807b7b54a25c1595))
- **ci:** update changelog format to pass markdownlint ([9c7cb2d](https://github.com/DylanLogan2581/gubernator/commit/9c7cb2d8de85449df7065ba236bde150ba571638))
- **ci:** update release process to automatically include changelog ([1302f89](https://github.com/DylanLogan2581/gubernator/commit/1302f89f6d32eb4588d9105585722abe5a8b2f78))

## [0.1.0](https://github.com/DylanLogan2581/gubernator/compare/v0.0.0...v0.1.0) (2026-04-25)

### Bug Fixes

- **ci:** fix permission issue with pr label review ([50309fe](https://github.com/DylanLogan2581/gubernator/commit/50309fe8171f21ead7b8c901e118253b7f07834f))

### Features

- **app:** add app identity metadata ([fdb82ef](https://github.com/DylanLogan2581/gubernator/commit/fdb82eff308417f1c0353843631b0e8de7a4df78)), closes [#7](https://github.com/DylanLogan2581/gubernator/issues/7)
- **app:** add branded not found route ([3cbaec9](https://github.com/DylanLogan2581/gubernator/commit/3cbaec9e01011f0ce8d338c415d13fea77a01490)), closes [#13](https://github.com/DylanLogan2581/gubernator/issues/13)
- **app:** add initial gubernator feature placeholders ([10967c9](https://github.com/DylanLogan2581/gubernator/commit/10967c939b58e9aaa91bd05b4b8d7b9ac564a62a)), closes [#14](https://github.com/DylanLogan2581/gubernator/issues/14)
- **app:** add reusable app shell components ([84b5e71](https://github.com/DylanLogan2581/gubernator/commit/84b5e71f7b11dae51a3374f4c17c4348f799d64f)), closes [#8](https://github.com/DylanLogan2581/gubernator/issues/8)
- **app:** add shared state components ([9a6f439](https://github.com/DylanLogan2581/gubernator/commit/9a6f439d721d6edb20c538c32d15e4632ec150c5)), closes [#9](https://github.com/DylanLogan2581/gubernator/issues/9)
