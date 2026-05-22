# Changelog

## [0.3.0](https://github.com/DylanLogan2581/gubernator/compare/v0.2.0...v0.3.0) (2026-05-22)

### Bug Fixes

- **calendar:** reset calendar draft when world or config changes ([3d4dfb7](https://github.com/DylanLogan2581/gubernator/commit/3d4dfb75e93dc94c1860ce356e65084b50288d43)), closes [#116](https://github.com/DylanLogan2581/gubernator/issues/116)
- **config:** add database input size limits ([d8bd929](https://github.com/DylanLogan2581/gubernator/commit/d8bd929231f894628bc257988b459044f77e7cf6)), closes [#128](https://github.com/DylanLogan2581/gubernator/issues/128)
- **config:** typecheck edge functions in the build gate ([4b1a470](https://github.com/DylanLogan2581/gubernator/commit/4b1a4704a925ede9ea1f44e94b732893147cea71))
- **notifications:** make notification creation system-owned ([6bb5ffa](https://github.com/DylanLogan2581/gubernator/commit/6bb5ffacb13baa4f510fe21c702f7d819868aa5c)), closes [#126](https://github.com/DylanLogan2581/gubernator/issues/126)
- **settlements:** floor displayed settlement ready percentages ([1bbd614](https://github.com/DylanLogan2581/gubernator/commit/1bbd61452763267444a4c3adfdd7a9d6687049db)), closes [#107](https://github.com/DylanLogan2581/gubernator/issues/107)
- **settlements:** hide manual readiness controls without manage access ([62792b6](https://github.com/DylanLogan2581/gubernator/commit/62792b6961f94f8d92b81e826c322d8cef9d1f4f)), closes [#115](https://github.com/DylanLogan2581/gubernator/issues/115)
- **settlements:** make manual readiness display clear when auto-ready ([9ca13de](https://github.com/DylanLogan2581/gubernator/commit/9ca13de61c1c22347e6fda3b484d8d56f7192c8f)), closes [#109](https://github.com/DylanLogan2581/gubernator/issues/109)
- **settlements:** narrow child domain table mutation surfaces ([3999867](https://github.com/DylanLogan2581/gubernator/commit/3999867a6ad5e0819609d1cc0a05aecb9e2a792f)), closes [#125](https://github.com/DylanLogan2581/gubernator/issues/125)
- **settlements:** show concise last-ready dates for all settlements ([bcb4061](https://github.com/DylanLogan2581/gubernator/commit/bcb4061899f15413f62f104e03eb9bf102a0e863)), closes [#108](https://github.com/DylanLogan2581/gubernator/issues/108)
- **supabase:** edge function cache issue advice ([e7184ef](https://github.com/DylanLogan2581/gubernator/commit/e7184efd79d7bb77b5b849d83fa7feb31ea6e870))
- **turns:** add cors preflight handling to end-turn edge function ([5005ce1](https://github.com/DylanLogan2581/gubernator/commit/5005ce1d2320694a1430938e93c0fda65c0d09ae))
- **turns:** clean up end-turn confirmation labels ([ee2b724](https://github.com/DylanLogan2581/gubernator/commit/ee2b72486e73ff663715f69153c6cd55db301bcc)), closes [#110](https://github.com/DylanLogan2581/gubernator/issues/110)
- **turns:** protect turn transition and audit writes ([a40c2cb](https://github.com/DylanLogan2581/gubernator/commit/a40c2cb5eb63eae3df790698169c01ca3fde2426)), closes [#124](https://github.com/DylanLogan2581/gubernator/issues/124)
- **turns:** unblock confirm end turn ([ed4038d](https://github.com/DylanLogan2581/gubernator/commit/ed4038dda8b3e647ad312f525a70b9a196a42e08)), closes [#111](https://github.com/DylanLogan2581/gubernator/issues/111)
- **turns:** use authoritative end dates returned by the edge function ([99e90fb](https://github.com/DylanLogan2581/gubernator/commit/99e90fbced0f13b13b8e89fa0bdca2dbf29d3bad)), closes [#114](https://github.com/DylanLogan2581/gubernator/issues/114)
- **worlds:** restrict direct world state-machine writes ([78a7a79](https://github.com/DylanLogan2581/gubernator/commit/78a7a79d7d5b89d7834c1a93724fbc9bc06cb2c7)), closes [#123](https://github.com/DylanLogan2581/gubernator/issues/123)

### Features

- **calendar:** add calendar config schema in app code ([ac4180b](https://github.com/DylanLogan2581/gubernator/commit/ac4180bfa28708d868fb083ee5c81860e2b05ddb)), closes [#56](https://github.com/DylanLogan2581/gubernator/issues/56)
- **calendar:** add calendar date calculation utility ([00afd74](https://github.com/DylanLogan2581/gubernator/commit/00afd7420964549bb1a23d33e31ed27d64966dd1)), closes [#57](https://github.com/DylanLogan2581/gubernator/issues/57)
- **calendar:** add calendar display formatting utility ([ddb3b61](https://github.com/DylanLogan2581/gubernator/commit/ddb3b61381013f2f80524a7a91cadaaab5b06c68)), closes [#58](https://github.com/DylanLogan2581/gubernator/issues/58)
- **calendar:** add calendar query keys ([4376966](https://github.com/DylanLogan2581/gubernator/commit/4376966e802c1ebe726c6fbf9e821dee2af0e4e8)), closes [#59](https://github.com/DylanLogan2581/gubernator/issues/59)
- **calendar:** add calendar settings panel ([ef4b3a2](https://github.com/DylanLogan2581/gubernator/commit/ef4b3a207468bbea8c67259052813cec36dccc32)), closes [#93](https://github.com/DylanLogan2581/gubernator/issues/93)
- **calendar:** add calendar settings validation ui ([b1708ba](https://github.com/DylanLogan2581/gubernator/commit/b1708bafd9a6549a782b2574c09eafed0f595652)), closes [#94](https://github.com/DylanLogan2581/gubernator/issues/94)
- **calendar:** add world calendar mutation options ([58d8916](https://github.com/DylanLogan2581/gubernator/commit/58d8916a6d42e89ba4d581e84a8ae5690ef38504)), closes [#61](https://github.com/DylanLogan2581/gubernator/issues/61)
- **calendar:** add world calendar query options ([f7c7e86](https://github.com/DylanLogan2581/gubernator/commit/f7c7e863a7607a52b5e1f9ddd9e75b3fef143125)), closes [#60](https://github.com/DylanLogan2581/gubernator/issues/60)
- **calendar:** ensure calendar format is used ([0373f47](https://github.com/DylanLogan2581/gubernator/commit/0373f4703614a6fb39c0724b69d32045946d8a55)), closes [#106](https://github.com/DylanLogan2581/gubernator/issues/106)
- **calendar:** support full calendar date format templates ([039ad01](https://github.com/DylanLogan2581/gubernator/commit/039ad0172dd80211fb774bebd3a95b87610724fa)), closes [#106](https://github.com/DylanLogan2581/gubernator/issues/106)
- **notifications:** add minimal notification query options ([ea4b6cc](https://github.com/DylanLogan2581/gubernator/commit/ea4b6cc84bd9d247dc003003ecc524b52d0425cd)), closes [#102](https://github.com/DylanLogan2581/gubernator/issues/102)
- **notifications:** update notification badge after end-turn ([5e06562](https://github.com/DylanLogan2581/gubernator/commit/5e065623400ac2ed11b575e28bbe9a944689c9e8)), closes [#103](https://github.com/DylanLogan2581/gubernator/issues/103)
- **notifications:** write turn-completed notification on end-turn ([f3c380b](https://github.com/DylanLogan2581/gubernator/commit/f3c380b44c4bf7b8a12cb368de9b29ed1f0c1425)), closes [#88](https://github.com/DylanLogan2581/gubernator/issues/88)
- **permissions:** authorize end-turn edge function ([7fcd4d2](https://github.com/DylanLogan2581/gubernator/commit/7fcd4d22b49d08051d91eb03b496d2308cbbd64c)), closes [#81](https://github.com/DylanLogan2581/gubernator/issues/81)
- **settlements:** add auto-ready toggle ui ([471868c](https://github.com/DylanLogan2581/gubernator/commit/471868c3b0bbc482d2de0fa199f5e92c26d6c555)), closes [#98](https://github.com/DylanLogan2581/gubernator/issues/98)
- **settlements:** add settlement auto-ready mutation ([bb703d3](https://github.com/DylanLogan2581/gubernator/commit/bb703d34f20d9f9b4c2d39b4be4d9a19752fcbc2)), closes [#67](https://github.com/DylanLogan2581/gubernator/issues/67)
- **settlements:** add settlement readiness list ([dc5aeb0](https://github.com/DylanLogan2581/gubernator/commit/dc5aeb068cb4b6d0e17977c0f0cab0eaeb32cc67)), closes [#96](https://github.com/DylanLogan2581/gubernator/issues/96)
- **settlements:** add settlement readiness query keys ([e1ec03e](https://github.com/DylanLogan2581/gubernator/commit/e1ec03ee7c9f467912ca6fe40aa6cc0fcc0963c9)), closes [#64](https://github.com/DylanLogan2581/gubernator/issues/64)
- **settlements:** add settlement readiness query options ([5b2aaad](https://github.com/DylanLogan2581/gubernator/commit/5b2aaadfabc5f8e9c5b0fdb3316b8e752251e6df)), closes [#65](https://github.com/DylanLogan2581/gubernator/issues/65)
- **settlements:** add settlement ready toggle mutation ([686c841](https://github.com/DylanLogan2581/gubernator/commit/686c8413993d4fc03d76621d0249b0bb109e2649)), closes [#66](https://github.com/DylanLogan2581/gubernator/issues/66)
- **settlements:** add settlement ready toggle ui ([4f7eef5](https://github.com/DylanLogan2581/gubernator/commit/4f7eef57dff260872ce8f4505f9fb49b31b1bfb2)), closes [#97](https://github.com/DylanLogan2581/gubernator/issues/97)
- **settlements:** reset settlement readiness during end-turn ([8899f0d](https://github.com/DylanLogan2581/gubernator/commit/8899f0d6999f721565a03a7e8c19d19f4ce886cc)), closes [#86](https://github.com/DylanLogan2581/gubernator/issues/86)
- **supabase:** add end-turn edge function scaffold ([4139b5f](https://github.com/DylanLogan2581/gubernator/commit/4139b5fbef199562ecfeb9bcdfcdd92a4fa2aa25)), closes [#80](https://github.com/DylanLogan2581/gubernator/issues/80)
- **supabase:** add minimal local seed topology ([2dc6e99](https://github.com/DylanLogan2581/gubernator/commit/2dc6e99d01da88661abbdae61ac55b3ddc3e8335)), closes [#2](https://github.com/DylanLogan2581/gubernator/issues/2) [#104](https://github.com/DylanLogan2581/gubernator/issues/104)
- **supabase:** add minimal notification entries table ([9c0be7c](https://github.com/DylanLogan2581/gubernator/commit/9c0be7c084a4bde9b1f0d17f66ce307ac5fe1102)), closes [#72](https://github.com/DylanLogan2581/gubernator/issues/72)
- **supabase:** add nations table ([52c43c0](https://github.com/DylanLogan2581/gubernator/commit/52c43c0c1304e69c481600bdf42e42f28fa358a3)), closes [#62](https://github.com/DylanLogan2581/gubernator/issues/62)
- **supabase:** add settlements table with readiness fields ([af49557](https://github.com/DylanLogan2581/gubernator/commit/af495576ded63c7a8b2f13be4f6bb845e488ba37)), closes [#63](https://github.com/DylanLogan2581/gubernator/issues/63)
- **supabase:** add turn log entries table ([872bb7e](https://github.com/DylanLogan2581/gubernator/commit/872bb7eed9557e5fe4e596c81a300061d3b80b0a)), closes [#2](https://github.com/DylanLogan2581/gubernator/issues/2) [#71](https://github.com/DylanLogan2581/gubernator/issues/71)
- **supabase:** add turn transitions table ([51ead68](https://github.com/DylanLogan2581/gubernator/commit/51ead68e38488efb1a37779643243dfd9d2bfb18)), closes [#70](https://github.com/DylanLogan2581/gubernator/issues/70)
- **supabase:** add world calendar config column ([e5b768d](https://github.com/DylanLogan2581/gubernator/commit/e5b768d9777168aee70f655f793f273d8dfe72b5)), closes [#55](https://github.com/DylanLogan2581/gubernator/issues/55)
- **turns:** add current turn state query options ([51aa34c](https://github.com/DylanLogan2581/gubernator/commit/51aa34c5f18e9d129daf00ace6bf81c81a15add8)), closes [#78](https://github.com/DylanLogan2581/gubernator/issues/78)
- **turns:** add current turn state types ([f284b8b](https://github.com/DylanLogan2581/gubernator/commit/f284b8b63451265256cbfa67e29fee23d811d437)), closes [#73](https://github.com/DylanLogan2581/gubernator/issues/73)
- **turns:** add end-turn confirmation dialog ([03c0515](https://github.com/DylanLogan2581/gubernator/commit/03c05153e69f5c74281793e3208e3c2da160068c)), closes [#100](https://github.com/DylanLogan2581/gubernator/issues/100)
- **turns:** add end-turn control to world shell ([9868bd1](https://github.com/DylanLogan2581/gubernator/commit/9868bd1d0211d1c40f597f8c263ba45d071b44bd)), closes [#99](https://github.com/DylanLogan2581/gubernator/issues/99)
- **turns:** add end-turn mutation options ([ecdd79a](https://github.com/DylanLogan2581/gubernator/commit/ecdd79adc1447fd380c41ff056d5a02eb99b67b2)), closes [#90](https://github.com/DylanLogan2581/gubernator/issues/90)
- **turns:** add epic 2 feature entrypoint exports ([a4fdc11](https://github.com/DylanLogan2581/gubernator/commit/a4fdc11fac0fb51c0cbce972e77329a1db0cf971)), closes [#2](https://github.com/DylanLogan2581/gubernator/issues/2) [#105](https://github.com/DylanLogan2581/gubernator/issues/105)
- **turns:** add latest transition query options ([8ef0f99](https://github.com/DylanLogan2581/gubernator/commit/8ef0f992f1bfd7d85bf48f8d2a1cb84bcbcedd3e)), closes [#79](https://github.com/DylanLogan2581/gubernator/issues/79)
- **turns:** add pure basic transition utility ([7a872f7](https://github.com/DylanLogan2581/gubernator/commit/7a872f794259c7010996a1b2fd94e1010168e01a)), closes [#76](https://github.com/DylanLogan2581/gubernator/issues/76)
- **turns:** add readiness reset utility ([4427cdb](https://github.com/DylanLogan2581/gubernator/commit/4427cdbec1270ac2424dbda7d95213761ed8dc47)), closes [#69](https://github.com/DylanLogan2581/gubernator/issues/69)
- **turns:** add readiness summary utility ([35e5515](https://github.com/DylanLogan2581/gubernator/commit/35e5515994aa5d5a348e520a44eb60c4cf5a0646)), closes [#68](https://github.com/DylanLogan2581/gubernator/issues/68)
- **turns:** add transition input types ([6cad479](https://github.com/DylanLogan2581/gubernator/commit/6cad47968315efff3598f120b6bf9da154d0c69a)), closes [#74](https://github.com/DylanLogan2581/gubernator/issues/74)
- **turns:** add transition result types ([7e2da2e](https://github.com/DylanLogan2581/gubernator/commit/7e2da2ef3e1618139122d3b18e3c614534d37c6f)), closes [#2](https://github.com/DylanLogan2581/gubernator/issues/2) [#75](https://github.com/DylanLogan2581/gubernator/issues/75)
- **turns:** add turn query keys ([362002f](https://github.com/DylanLogan2581/gubernator/commit/362002f3583b31a7cefdd07193644df9b5b05716)), closes [#77](https://github.com/DylanLogan2581/gubernator/issues/77)
- **turns:** call pure transition utility from edge function ([287b193](https://github.com/DylanLogan2581/gubernator/commit/287b19332fdf5115a44dc883959781023d2b78dd)), closes [#83](https://github.com/DylanLogan2581/gubernator/issues/83)
- **turns:** complete or fail transition status ([3fb8d2e](https://github.com/DylanLogan2581/gubernator/commit/3fb8d2e322675e65973df8c5edc5b02abb696ebd)), closes [#89](https://github.com/DylanLogan2581/gubernator/issues/89)
- **turns:** increment world turn during end-turn transaction ([aaa0c46](https://github.com/DylanLogan2581/gubernator/commit/aaa0c465b4c623a8127d3ba4434d8593d916b09b)), closes [#85](https://github.com/DylanLogan2581/gubernator/issues/85)
- **turns:** load basic transition input in edge function ([6d911ea](https://github.com/DylanLogan2581/gubernator/commit/6d911eab5bbd66c5887e24d1b7298045c5712bc1)), closes [#82](https://github.com/DylanLogan2581/gubernator/issues/82)
- **turns:** show end-turn result state ([49e4070](https://github.com/DylanLogan2581/gubernator/commit/49e40701f15252ac8af360ff8c26d643b8133f9f)), closes [#101](https://github.com/DylanLogan2581/gubernator/issues/101)
- **turns:** write basic turn log entry on end-turn ([9397e69](https://github.com/DylanLogan2581/gubernator/commit/9397e69cb908de8e94e5b739ec245db147c8dc22)), closes [#87](https://github.com/DylanLogan2581/gubernator/issues/87)
- **turns:** write running turn transition row ([4fc1b61](https://github.com/DylanLogan2581/gubernator/commit/4fc1b61556e7fff781336dbb30271fc49e20bfa4)), closes [#84](https://github.com/DylanLogan2581/gubernator/issues/84)
- **worlds:** add readiness summary panel to world shell ([1381ede](https://github.com/DylanLogan2581/gubernator/commit/1381ede9df869142084430a5eb394476821aa35e)), closes [#95](https://github.com/DylanLogan2581/gubernator/issues/95)
- **worlds:** show calendar date on world list cards ([3d2f867](https://github.com/DylanLogan2581/gubernator/commit/3d2f86705afad18252c70985924457d72f1eb01d)), closes [#91](https://github.com/DylanLogan2581/gubernator/issues/91)
- **worlds:** show calendar date on world shell header ([f524184](https://github.com/DylanLogan2581/gubernator/commit/f5241841bdd8d9de9eba358cd9b03e62561de59d)), closes [#92](https://github.com/DylanLogan2581/gubernator/issues/92)

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
