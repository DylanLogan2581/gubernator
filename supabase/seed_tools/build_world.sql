-- ===========================================================================
-- build_world.sql — turn-0 builder for the Bovold Seed World. Step 1 of the
-- seed regeneration pipeline; normally invoked by supabase/seed_tools/regenerate.sh.
-- It loads as the postgres superuser (RLS bypassed; triggers ACTIVE) and wipes
-- any prior build before authoring it fresh, e.g.:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     --single-transaction -v ON_ERROR_STOP=1 -f supabase/seed_tools/build_world.sql
-- The seeded auth users (superadmin@gubernator.local etc.) must already exist.
-- After this builds, regenerate.sh drives the simulation forward 32 turns and
-- dumps the full public state into supabase/seed.sql.
--
-- The world is Akaviri-flavoured (Elder Scrolls): a neutral human trade-city
-- (Free City of Bovold) amid three beast-nations — the cannibal serpent-folk
-- Tsaesciland Empire, the kind-but-fierce Thousand Monkey Islands (Tang Mo),
-- and the dragon-seeking Ka'Po'Tun Confederacy. Every feature domain is seeded:
-- cultures, religions, namesets, government offices & bodies, law documents /
-- amendments / decrees, military, education, events, plus the economy,
-- diplomacy and (after the replay) turn history.
--
-- All entity UUIDs are deterministic but real-looking, derived from stable keys
-- via pg_temp.seed_uuid(text). Only the seeded auth-user ids are fixed literals.
-- ===========================================================================

-- Re-runnable teardown: wipe any prior build. TRUNCATE CASCADE avoids the
-- resource/job referential-integrity BEFORE DELETE triggers and clears every
-- world-scoped table while leaving auth + public.users intact.
set session_replication_role = default;
truncate table public.worlds cascade;

-- Deterministic, real-looking UUID from a stable key. Namespaced with 'bovold:'
-- so keys never collide with other worlds. Session-local (pg_temp) so it never
-- lands in the dump.
create or replace function pg_temp.seed_uuid(key text) returns uuid
  language sql immutable as $fn$
  select (
    substr(md5('bovold:' || key), 1, 8)  || '-' ||
    substr(md5('bovold:' || key), 9, 4)  || '-' ||
    substr(md5('bovold:' || key), 13, 4) || '-' ||
    substr(md5('bovold:' || key), 17, 4) || '-' ||
    substr(md5('bovold:' || key), 21, 12)
  )::uuid;
$fn$;

-- ---------------------------------------------------------------------------
-- Name pools per culture (shared by namesets + NPC generation). Temp table so
-- it never lands in the dump. 1=Bovold (human), 2=Tsaesci (serpent-folk),
-- 3=Tang Mo (monkey-folk), 4=Ka'Po'Tun (tiger-folk).
-- ---------------------------------------------------------------------------
create temp table tmp_pools (
  culture int primary key,
  male text[],
  female text[],
  surnames text[]
);

insert into tmp_pools values
  (1,
   array['Aldous','Bram','Cuthwin','Edric','Godwin','Harwin','Leofric','Osmund','Wulfric','Eadwin','Bertram','Cedric','Dunstan','Garrick','Hollis','Merek','Oswin','Rowan','Selwyn','Tobin','Alric','Doran','Perrin','Halden'],
   array['Aedith','Bryn','Cwen','Edolie','Gytha','Hilda','Mildreth','Rowena','Alvina','Edith','Goda','Linnet','Odila','Tilda','Wilda','Brielle','Elsbeth','Maud','Nesta','Saera','Wynne','Isolde','Marra','Petra'],
   array['Ashford','Barleywick','Coppleby','Durnmere','Elderbrook','Fenwick','Greenhollow','Harrowgate','Larkspur','Oxley','Thatcher','Underhill','Weaverson','Marrow','Quill','Hollow','Brambleton','Stockwell','Hayward','Pennington','Redfern','Whitlow','Crane','Bramble']),
  (2,
   array['Sarisu','Ilnaris','Zisae','Vessil','Sythien','Morvos','Ahzee','Cholvas','Diris','Vaie','Xhaan','Ssythra','Renyu','Karnu','Vheeth','Orsis','Naxil','Threska',' Vaal','Zhevik']::text[],
   array['Saenya','Zisa','Ashai','Miru','Veneen','Liru','Sythra','Ilnea','Vheena','Nessai','Xhira','Ossae','Renya','Karis','Thessa','Ynara','Zheveen','Sivai','Ahni','Vossa'],
   array['Versidue-Shaie','Savirien-Chorak','Dinieras-Ves','Xhossa-Vaal','Ilnaris-Ves','Zisae-Torvo','Vessil-Karnu','Sythien-Vaas','Morvos-Il','Cholvas-Renyu','Ansu-Vheen','Ssu-Vaal','Xheen-Mar','Serpith-Ka','Gilt-Fang','Vhossa-Ren','Ilnith-Sar','Torvo-Xhaan','Renyu-Ssith','Karnu-Vheeth']),
  (3,
   array['Kip','Ubu','Chittai','Rakko','Bemba','Wollo','Pemba','Tan','Oju','Senu','Chumo','Bibo','Toki','Nabu','Kwe','Momo','Rundo','Sabi','Tekka','Wumbo'],
   array['Mimi','Sela','Uba','Chika','Rina','Bela','Pia','Tama','Oona','Senna','Chumi','Bibi','Toka','Nabi','Kiwi','Moma','Runa','Sabi','Tikka','Wumi'],
   array['Highcanopy','Coconut','Skyleap','Chatterbay','Driftnest','Freepalms','Braided','Longwharf','Gullcry','Palmfront','Mudnest','Ropebridge','Sunder','Kiprest','Laughingwater','Tenthisle','Bramba','Shoban','Reedwhistle','Coconutfall']),
  (4,
   array['Tosh','Rakka','Sharu','Pozhan','Kirtosh','Kavareth','Rhatun','Shokaren','Zhanpo','Kamorzhu','Rakhatei','Tigrasunn','Zhupo','Renka','Tosari','Vareth','Zhandu','Morka','Sunka','Teinu'],
   array['Rakha','Shai','Pola','Zhena','Kira','Kavai','Rhani','Shona','Zhani','Kamira','Rakhi','Tigra','Zhupi','Renai','Tosai','Varei','Zhandi','Morai','Sunai','Teini'],
   array['Sunspire','Dragonclimb','Tigermount','Embercloister','Nineroars','Rakhal','Shomarath','Potun','Ashclimb','Emberfang','Roarhold','Stripethrone','Dawnpeak','Firemane','Suncoil','Dragonsreach','Clawmount','Emberfast','Tigervale','Ninestep']);

-- Fix a stray leading space in the Tsaesci male pool (kept explicit for clarity).
update tmp_pools set male = array_replace(male, ' vaal', 'Vaal') where culture = 2;

-- ---------------------------------------------------------------------------
-- 1. World. npc_flavor_config_json uses an apostrophe-free pool (>=15 traits,
--    >=8 contradictions, >=10 goals, >=10 flaws). naming_config default 'pool'.
-- ---------------------------------------------------------------------------
insert into public.worlds (
  id, name, current_turn_number, status, calendar_config_json,
  partnership_seek_chance, fertility_chance, minimum_partnership_age_turns,
  maximum_fertility_age_turns, mourning_period_turns,
  thumbnail_path, hero_path,
  npc_flavor_config_json
)
values (
  pg_temp.seed_uuid('world:bovold'),
  'Bovold Seed World',
  0,
  'active',
  -- Elder Scrolls (Tamrielic) calendar: twelve named months of the Empire and
  -- the seven days of the week, dated in the Third Era.
  '{
    "months": [
      {"name": "Morning Star",  "index": 0,  "dayCount": 31},
      {"name": "Sun''s Dawn",    "index": 1,  "dayCount": 28},
      {"name": "First Seed",     "index": 2,  "dayCount": 31},
      {"name": "Rain''s Hand",   "index": 3,  "dayCount": 30},
      {"name": "Second Seed",    "index": 4,  "dayCount": 31},
      {"name": "Mid Year",       "index": 5,  "dayCount": 30},
      {"name": "Sun''s Height",  "index": 6,  "dayCount": 31},
      {"name": "Last Seed",      "index": 7,  "dayCount": 31},
      {"name": "Hearthfire",     "index": 8,  "dayCount": 30},
      {"name": "Frostfall",      "index": 9,  "dayCount": 31},
      {"name": "Sun''s Dusk",    "index": 10, "dayCount": 30},
      {"name": "Evening Star",   "index": 11, "dayCount": 31}
    ],
    "weekdays": [
      {"name": "Sundas",  "index": 0}, {"name": "Morndas", "index": 1},
      {"name": "Tirdas",  "index": 2}, {"name": "Middas",  "index": 3},
      {"name": "Turdas",  "index": 4}, {"name": "Fredas",  "index": 5},
      {"name": "Loredas", "index": 6}
    ],
    "startingYear": 433,
    "dateFormatTemplate": "{weekday}, {day} {month}, 3E {year}",
    "startingDayOfMonth": 1,
    "startingMonthIndex": 0,
    "startingWeekdayOffset": 0,
    "shortDateFormatTemplate": "{monthNumber}/{dayNumber}/{yearNumber}"
  }'::jsonb,
  0.25,
  0.08,
  16,
  45,
  3,
  -- Image paths point at objects the config.toml storage buckets seed on reset.
  pg_temp.seed_uuid('world:bovold')::text || '/thumbnail.webp',
  pg_temp.seed_uuid('world:bovold')::text || '/hero.webp',
  '{
    "traits": ["watchful","shrewd","devout","proud","patient","fierce","cunning","stoic","boisterous","reverent","venomous","ascetic","generous","wary","ambitious"],
    "contradictions": ["mourns a rival they devoured","serves a god they doubt","shelters an enemy of the state","keeps a shed skin they never named","holds a vow older than their memory","owes a debt to the drowned","hides a wound that should have killed them","prays toward a silent dragon"],
    "goals": ["a seat on the council","to restore the family coil","to walk the sunlit road once more","to read the burned sutra","to outlive every emperor","to raise a child of the lower ward","to see the long thaw end","to die at home and not on the road","to repay the salt-lenders of the harbor","to ascend into a dragon"],
    "flaws": ["pride","envy","a hunger they cannot name","a quiet vice","an inability to forgive the dead","a temper that surfaces in ritual","a need to be the cleverest voice","miserliness at home","reads every silence as betrayal","certainty they alone hold the line"]
  }'::jsonb
);

-- ---------------------------------------------------------------------------
-- 2. Cultures (4). Full lore fields. Dollar-quoted text avoids apostrophe
--    escaping. Colors are lowercase 6-hex.
-- ---------------------------------------------------------------------------
insert into public.cultures (
  id, world_id, name, color, description,
  origins, demonym, core_values, taboos, etiquette, gender_family_norms,
  attitudes_to_outsiders, rites_of_passage, festivals_holidays,
  superstitions_folklore, funerary_customs, language_dialects,
  naming_conventions, sayings_idioms, arts_aesthetics,
  architecture_craftsmanship, social_hierarchy, leadership_occupations,
  cuisine_meals, dress_fashion
) values
  (
    pg_temp.seed_uuid('culture:bovold'),
    pg_temp.seed_uuid('world:bovold'),
    'Bovold Free-Folk', '#c9a227',
    $md$The one human city of Akavir — a chartered free port of merchants, guilds and oath-keepers who survive among beast-nations by being useful to all and beholden to none.$md$,
    $md$Refugees and traders of the last human enclave, granted a charter of neutrality after the serpent-folk ate the rest of Akavir's Men.$md$,
    $md$Bovolder$md$,
    $md$Fair dealing, sworn contracts, guild loyalty, hospitality to strangers, and stubborn independence.$md$,
    $md$Breaking a sealed contract; enslaving a guest; refusing sanctuary to one who reaches the harbor gate.$md$,
    $md$A handshake seals small deals; a wax-sealed ledger seals large ones. Address elders as "goodwife" or "goodman"; never interrupt a reckoning of accounts.$md$,
    $md$Broadly egalitarian; households are led by whichever partner holds the family ledger. Trades pass parent to child but daughters and sons apprentice alike.$md$,
    $md$Wary but welcoming — coin has no nation. Outsiders are guests until they cheat, then outlaws forever.$md$,
    $md$At sixteen a youth "signs the roll" — takes a guild apprenticeship and first oath before the Council.$md$,
    $md$Founding Day (charter granted); the Salt Fair; the Reckoning (year-end settling of all debts and feuds).$md$,
    $md$A snapped tally-stick foretells a broken bargain; a gull landing on your mast means an honest buyer comes.$md$,
    $md$The dead are given to the sea on a debt-cleared barge; their ledgers are burned so no creditor may pursue them beyond death.$md$,
    $md$Common Tamrielic tongue, thick with harbor cant and loan-words from every neighbor.$md$,
    $md$Given name plus a trade-surname (Hayward, Weaverson, Cooper). Foundlings take the surname of their guild.$md$,
    $md$"Coin has no nation." "Sign in wax, not in wine." "Every gate is a market."$md$,
    $md$Painted ship-signs, carved tally-sticks, brass weights, and honest plain-song at the docks.$md$,
    $md$Stone-and-timber counting-halls, sea-walls, guild-houses with painted signs, and a single tall harbor lighthouse.$md$,
    $md$Guild-masters and the elected Council above; journeymen and shopkeepers in the middle; dockhands and foundlings below — but any may buy their way up.$md$,
    $md$Merchants, ledger-clerks, shipwrights, harbor-wardens, and the elected Lord-Mayor.$md$,
    $md$Salt fish, brown bread, harbor stew, small-beer, and imported rice and spice for feast days.$md$,
    $md$Practical wool and oiled canvas; a guild badge at the collar; the wealthy show status in imported Tsaesci silk trim.$md$
  ),
  (
    pg_temp.seed_uuid('culture:tsaesci'),
    pg_temp.seed_uuid('world:bovold'),
    'Tsaesci Serpent-Court', '#b8860b',
    $md$Immortal golden serpent-folk who devoured the Men of Akavir and rule from coiling palaces — beautiful, patient, and hungry.$md$,
    $md$They ate the old world and still wear its face; a courtly race of scaled immortals for whom time is only another thing to swallow.$md$,
    $md$Tsaesci$md$,
    $md$Immortality, rank, patience, the purity of the bloodline, and the sanctity of consumption.$md$,
    $md$Dying of one's own weakness; freeing a slave without price; refusing the Long Feast; showing one's true familiar-name to a stranger.$md$,
    $md$One must know a person's rank before greeting them; inferiors coil low, superiors remain upright. Poison offered and declined is a mortal insult.$md$,
    $md$Matrilineal — descent and the patron-spirit name pass through the mother. Elders, being oldest, rule absolutely; the young are near-property until their first shedding.$md$,
    $md$Cold contempt for the short-lived; other peoples are cattle, slaves, or larder — occasionally useful, never equal.$md$,
    $md$The First Shedding, when a youth sheds their childhood skin, which the family keeps forever as a relic.$md$,
    $md$The Long Feast (ritual consumption of the honored dead and defeated); the Sunning; the Coiling of the Court.$md$,
    $md$To keep a shed skin is to keep a soul; a serpent that will not eat is already dead; the eldest coil remembers the first sin.$md$,
    $md$The dead of worth are consumed at the Long Feast so their years and strength pass to the living; the unworthy are simply left to the sun.$md$,
    $md$Old Akaviri, a sibilant courtly tongue; the deep court-cant is spoken only among the immortal elders.$md$,
    $md$Familiar-name "ak" patron-spirit, then a hyphenated formal-given and matronymic (Vaie ak Ilni Versidue-Shaie). Strangers use only the hyphenate.$md$,
    $md$"We live because we ate the world." "A chair is a thing to coil around." "Patience is the only venom that never fails."$md$,
    $md$Gold leaf, lacquer, serpent and ouroboros motifs, jade inlay, and the katana raised to an art of the duel.$md$,
    $md$Coiling ramp-palaces without stairs, sunning terraces, heated bath-courts, spiral throne-halls of gilded scale-tile.$md$,
    $md$Immortal elder-lords and Potentates above; scaled gentry and duelists; then slaves and the short-lived larder-peoples at the bottom.$md$,
    $md$Potentates, court viziers, duel-masters, slave-wardens, and venom-brewers.$md$,
    $md$Blood-wine, fermented eggs, warmed raw flesh, and — at the Long Feast — the honored dead, taken as sacrament.$md$,
    $md$Gilded scale-lacquer armor, silk over coils, jade rank-rings; the older the serpent, the plainer and more terrifying the dress.$md$
  ),
  (
    pg_temp.seed_uuid('culture:tangmo'),
    pg_temp.seed_uuid('world:bovold'),
    'Tang Mo Isle-Kin', '#3a9d5d',
    $md$The many-breed monkey-folk of a thousand isles — kind, generous, brave, and a little crazy; never conquered, though everyone has tried.$md$,
    $md$A scattering of monkey-breeds across a thousand green islands, bound by kindness and an unbeatable, reckless courage.$md$,
    $md$Tang Mo$md$,
    $md$Kindness, generosity, freedom, communal courage, and never, ever holding a slave.$md$,
    $md$Slavery in any form; abandoning a neighbor to raiders; boasting of a kindness once given.$md$,
    $md$Loud, warm, and unpretentious — a stranger is fed before they are questioned. Gifts are pressed on guests; refusing food is a small rudeness.$md$,
    $md$Fluid and communal; children are raised by the whole canopy-village. No strict gender roles — whoever is bravest leads the defense.$md$,
    $md$Open-hearted to all who come in peace; ferocious to any who come to enslave. They forgive old enemies easily (even the tiger-folk).$md$,
    $md$The First Leap — a youth's daring canopy-jump between islands to earn an adult name and epithet.$md$,
    $md$The Gratitude Feast; the Defenders' Remembrance (honoring those fallen against raiders); the Thousand Lanterns.$md$,
    $md$A monkey who laughs in battle cannot be killed that day; the trickster Kip stole fire from the snakes and gave it freely.$md$,
    $md$The fallen are wrapped in palm and set adrift with a lantern; the whole village tells funny stories of them so grief turns to laughter.$md$,
    $md$A hundred island dialects of the Tang Mo tongue, full of hoots, clicks, and doubled words.$md$,
    $md$Short warm names, often doubled or with a fond epithet (Little Sho, Mad Pemba, Ubu-Mo). No surnames — the isle is the family.$md$,
    $md$"Kindness is the strongest rope." "We are small, and we are many." "Laugh, then leap."$md$,
    $md$Painted masks, rope-and-shell craft, drum-songs, and trickster-tales carved into driftwood.$md$,
    $md$Stilt-and-rope villages in the canopy and along the tide, quick to build, easy to defend and evacuate; woven bridges between the isles.$md$,
    $md$No lords — island councils of chosen speakers, and war-chiefs raised only when raiders come and stood down when they leave.$md$,
    $md$Isle-speakers, war-chiefs (temporary), foragers, fishers, canopy-runners, and storytellers.$md$,
    $md$Fruit, coconut, fish, foraged roots, and huge shared cook-fires where all eat from one pot.$md$,
    $md$Light woven wraps, shell and feather ornament, war-paint and carved masks when the isles must fight.$md$
  ),
  (
    pg_temp.seed_uuid('culture:kapotun'),
    pg_temp.seed_uuid('world:bovold'),
    'Ka''Po''Tun Dragon-Seekers', '#d2691e',
    $md$Tiger-folk of the mountain empire who strive, body and soul, to become dragons — led by Tosh Raka, the first of them to succeed.$md$,
    $md$Striped tiger-folk on a whole-nation quest to ascend into dragons, replacing those the serpents slew, with their god-emperor as living proof.$md$,
    $md$Ka'Po'Tun$md$,
    $md$Discipline, devotion, ascension, honor in war, and loyalty to the Dragon-Emperor.$md$,
    $md$Doubting the ascension; making common cause with the serpent-folk; wasting the breath-disciplines on idle boasting.$md$,
    $md$Formal and reverent; one bows by how many ascension-ranks separate you. Silence is respect; the roar-greeting is reserved for kin and comrades.$md$,
    $md$Ordered by monastic rank rather than birth; families give children to the cloisters young, and both sexes walk the dragon-path equally.$md$,
    $md$Honorable and pragmatic — they made allies of the once-hated Tang Mo against the serpent. They judge outsiders by courage and discipline.$md$,
    $md$The First Roar — a novice's breath-trial before the abbots that marks the start of the ascension-path.$md$,
    $md$The Ascension Festival (marking Tosh Raka's transformation); the Nine Roars; the Dragon-Vigil for the slain black dragons.$md$,
    $md$Each dragon slain by the serpents left an empty place a tiger-soul may fill; to master the breath is to inch closer to wings.$md$,
    $md$The dead are burned on mountain pyres so their essence rises toward the dragons; ashes of the highest-ranked are kept in the cloister reliquaries.$md$,
    $md$The Po Tun tongue, clipped and open-voweled, with glottal particles (Ka, Po, Tun) marking rank and reverence.$md$,
    $md$Short particle names, often with an apostrophe glottal-stop (Ka'Vareth, Rha'Tun, Sho Ka Ren); high monks take a dragon-epithet.$md$,
    $md$"We climb toward wings." "The serpent eats; the tiger becomes." "Breath before blade."$md$,
    $md$Orange-and-black banners, sun-and-dragon iconography, ash-ink calligraphy, and statues of the lost black dragons.$md$,
    $md$Tiered temple-monasteries clinging to mountainsides, ascension shrines, roaring-halls, and pagoda-roofs of lacquered black and gold.$md$,
    $md$The Dragon-Emperor and high abbots above; ranked monk-warriors by ascension-degree; then lay tiger-folk who tend and supply the cloisters.$md$,
    $md$The God-Emperor, dragon-abbots, breath-masters, monk-warriors, and cloister-wardens.$md$,
    $md$Spare monastic fare — rice, mountain tea, roots — broken by great communal feasts after victories.$md$,
    $md$Saffron and black monastic robes, lacquered lamellar for the monk-warriors, rank shown by the number of dragon-scale tokens worn.$md$
  );

-- ---------------------------------------------------------------------------
-- 3. Religions (4). Full lore fields.
-- ---------------------------------------------------------------------------
insert into public.religions (
  id, world_id, name, color, description,
  deities, creation_myth, mythology, tenets, ethics_sins, taboos, virtues,
  worship_practices, rituals_ceremonies, holy_days_festivals,
  pilgrimage_devotions, priesthood, hierarchy_governance, sects_schisms,
  relationship_to_state, afterlife_beliefs, funerary_rites, sacred_texts,
  holy_sites, symbols_vestments, history_spread
) values
  (
    pg_temp.seed_uuid('religion:bovold'),
    pg_temp.seed_uuid('world:bovold'),
    'The Harbor Covenant', '#2f6f8f',
    $md$A pragmatic human faith of oaths, fair weight and safe harbor — less a church than a merchant's covenant with the sea and the sworn word.$md$,
    $md$Mara of the Hearth, Zenithar of the Fair Deal, and the nameless Lady of the Deep who takes the drowned.$md$,
    $md$In the beginning was the Bargain: the first folk and the sea swore terms, and the world was the contract between them.$md$,
    $md$Tales of honest captains saved by a kept oath and cheats dragged down by the Lady of the Deep.$md$,
    $md$Keep your word; give fair weight; shelter the shipwrecked; settle debts before you die.$md$,
    $md$Fraud, oath-breaking, and turning away the drowning are the three great sins; usury without mercy is the fourth.$md$,
    $md$Bearing false witness in a reckoning; sailing on the Reckoning-day with debts unpaid.$md$,
    $md$Honesty, diligence, hospitality, and thrift.$md$,
    $md$Oaths sworn on the ledger before witnesses; coins cast into the harbor for safe voyage; hearth-blessings.$md$,
    $md$The sealing of contracts, the blessing of new keels, and the year-end Reckoning of debts and feuds.$md$,
    $md$Founding Day, the Salt Fair, and the Reckoning.$md$,
    $md$A voyage to the deep-water shrine at the harbor mouth to cast an offering before a dangerous journey.$md$,
    $md$Covenant-keepers: part notary, part priest, who witness oaths and record the year's reckonings.$md$,
    $md$Loosely organized; each guild-chapel keeps its own covenant-keeper answerable to the Council, not to any bishop.$md$,
    $md$A stricter "Deep Covenant" sect holds that all debts must be cleared before death or the soul is dragged under.$md$,
    $md$Woven into the city charter — oaths of office are sworn under the Covenant, but no creed is enforced on guests.$md$,
    $md$The debt-cleared soul sails on; the cheat is taken by the Lady of the Deep to weigh coin forever.$md$,
    $md$The dead are given to the sea on a barge, their ledgers burned so no creditor may follow them.$md$,
    $md$The Ledger of Terms — part scripture, part commercial law, copied and kept in every guild-chapel.$md$,
    $md$The harbor-mouth deep-water shrine and the Great Counting-Hall of Bovold.$md$,
    $md$A brass balance-scale and an anchor; covenant-keepers wear a wax seal on a chain.$md$,
    $md$Never spread beyond the one human city — it is the faith of Bovold and its trading partners alone.$md$
  ),
  (
    pg_temp.seed_uuid('religion:tsaesci'),
    pg_temp.seed_uuid('world:bovold'),
    'The Ouroboros Communion', '#7d5e12',
    $md$The consumption-faith of the serpent-folk: immortality is earned by devouring, ancestors live on in those who eat them, and the world is one endless coil that swallows its own tail.$md$,
    $md$The World-Serpent that eats its tail, and a host of ancestral patron-spirits (each family's "ak"-name) who live on in the flesh of their heirs.$md$,
    $md$The World-Serpent devoured all that was and gave it back as itself; thus to eat is to create, and to be eaten is to endure.$md$,
    $md$Legends of elders centuries old who ate their rivals' years, and of the first Potentate who swallowed a god.$md$,
    $md$Consume to endure; keep the coil unbroken; honor the eldest; give the honored dead to the Communion so they live on in you.$md$,
    $md$To die uneaten and forgotten is the only true death; to free a slave without price wastes the world's substance; to refuse the Feast is heresy.$md$,
    $md$Burning a body (denying the Communion); sparing a defeated enemy of worth instead of taking their strength.$md$,
    $md$Patience, memory, endurance, and reverence for the eldest coil.$md$,
    $md$Ritual fasting and the sacramental Long Feast; the keeping and veneration of shed skins; recitation of the ancestral coil-names.$md$,
    $md$The Long Feast, the First Shedding, and the Coiling of the Court where the eldest recite the unbroken line.$md$,
    $md$The Long Feast (movable, after each great death or victory); the Sunning; the Night of Shed Skins.$md$,
    $md$Pilgrimage to the Spiral Reliquary at Coil-of-Gold, where the shed skins of the eldest are coiled and kept.$md$,
    $md$The Coil-Priests, ancient venom-brewers and keepers of the skins, who officiate the Feast.$md$,
    $md$Rigidly hierarchical by age; the eldest Coil-Priest at Coil-of-Gold speaks for the Communion and often for the throne.$md$,
    $md$A quiet heresy — the "Sunward" sect — teaches that endless consumption is itself a kind of death, and is hunted for it.$md$,
    $md$Inseparable from the state; the Potentate is both ruler and chief communicant, and heresy is treason.$md$,
    $md$The devoured live on in the eater; the uneaten dissolve into nothing. Immortality is literal and earned by the mouth.$md$,
    $md$The worthy dead are consumed at the Long Feast; their shed skin is kept as their enduring relic.$md$,
    $md$The Coil Sutra — a sibilant liturgy of names, said to list every soul the Communion has ever eaten.$md$,
    $md$The Spiral Reliquary of Coil-of-Gold and the sunning-terraces of the great serpent-palaces.$md$,
    $md$The ouroboros in gold; coil-priests wear a living-serpent torc and a cloak of many shed skins.$md$,
    $md$As old as the serpent-folk; it spread with the empire's conquests and the eating of the Men of Akavir.$md$
  ),
  (
    pg_temp.seed_uuid('religion:tangmo'),
    pg_temp.seed_uuid('world:bovold'),
    'The Bright Canopy', '#4caf50',
    $md$The warm animist faith of the isle-folk: the world is a living canopy of spirits, the clever trickster Kip is its hero, and the brave dead become guardian-lights among the leaves.$md$,
    $md$The Canopy-Mother (the living world itself), the trickster Kip who stole fire from the serpents, and the ancestral guardian-lights.$md$,
    $md$The Canopy-Mother grew the thousand isles from a single seed dropped by a laughing bird, and every leaf holds a spirit.$md$,
    $md$Countless Kip-tales: the little monkey who outwits snakes, demons and kings by kindness and mad courage.$md$,
    $md$Be kind; be brave; be free; share what you have; remember those who died to keep the isles free.$md$,
    $md$Cruelty, cowardice before raiders, and taking a slave are the great wrongs; hoarding while a neighbor starves is nearly as bad.$md$,
    $md$Cutting a living guardian-tree; mocking the dead unkindly rather than fondly.$md$,
    $md$Kindness, courage, generosity, and good humor.$md$,
    $md$Offerings of fruit left in the canopy; lantern-lightings for the guardian-dead; drum-song and dance to thank the Canopy-Mother.$md$,
    $md$The First Leap, the Gratitude Feast, and the setting-adrift of the dead with a lantern.$md$,
    $md$The Gratitude Feast, the Thousand Lanterns, and the Defenders' Remembrance.$md$,
    $md$Wandering the isles to hang a lantern at each place a defender fell against the raiders.$md$,
    $md$No priests as such — each village has a lantern-keeper and a story-teller who tend the rites and the Kip-tales.$md$,
    $md$Utterly decentralized; every isle keeps its own spirits and stories, bound only by shared kindness.$md$,
    $md$No true schisms — the faith is too loose to split; isles simply favor different Kip-tales and guardian-lights.$md$,
    $md$No state to entangle with; the faith and the loose island confederation are simply the same warm, stubborn people.$md$,
    $md$The brave and kind dead become guardian-lights in the canopy; the cruel simply fade, unremembered.$md$,
    $md$The dead are wrapped in palm and set adrift with a lantern while the village tells funny stories of them.$md$,
    $md$No written scripture — a vast oral cycle of Kip-tales and guardian-songs, carved in fragments on driftwood.$md$,
    $md$The Great Guardian-Tree of Mo'Tang and any isle where a defender fell.$md$,
    $md$A paper lantern and a carved monkey-mask; lantern-keepers wear strings of shell and seed.$md$,
    $md$Native to the isles and never exported — the faith cannot be conquered any more than the Tang Mo can.$md$
  ),
  (
    pg_temp.seed_uuid('religion:kapotun'),
    pg_temp.seed_uuid('world:bovold'),
    'The Dragon Ascendant', '#e07b39',
    $md$The fervent dragon-faith of the tiger-folk: time itself is a dragon, ascension into dragonhood is the destiny of their kind, and the god-emperor Tosh Raka is living proof it can be done.$md$,
    $md$Akatosh-as-Dragon, the Dragon God of Time; the slain black dragons who are mourned; and Tosh Raka, the first tiger to become one.$md$,
    $md$Time is the great Dragon whose turning is the world; the tiger-folk were made to climb toward its likeness.$md$,
    $md$The serpents enslaved and then slew the dragons; the black dragons fled to the tigers, who now strive to replace what was lost.$md$,
    $md$Master the breath; discipline the body and soul; ascend toward the Dragon; avenge the slain dragons upon the serpent.$md$,
    $md$Despair and doubt of the ascension are the deadly sins; sloth in the disciplines and mercy toward the serpent-folk are grave faults.$md$,
    $md$Aiding the serpent-folk; abandoning the breath-disciplines; speaking the dragon-tongue in vain.$md$,
    $md$Discipline, devotion, courage, and reverence for the Dragon of Time.$md$,
    $md$Breath-and-roar disciplines, ascension-meditation, sun-salutes at dawn, and the tending of dragon-shrines.$md$,
    $md$The First Roar, the Ascension-vows, and the Dragon-Vigil for the slain.$md$,
    $md$The Ascension Festival, the Nine Roars, and the Dragon-Vigil.$md$,
    $md$The climb to the summit shrine at Sunspire to roar the dawn-salute where Tosh Raka first took wing.$md$,
    $md$The dragon-abbots and breath-masters, who guide novices along the ascension-path.$md$,
    $md$Theocratic and monastic; the God-Emperor is the supreme dragon-abbot, and the cloisters govern doctrine and rank.$md$,
    $md$A "Slow Path" sect holds ascension takes many lifetimes of rebirth; a "Sudden Path" sect (favored by Tosh Raka) says it can be seized in one.$md$,
    $md$The state religion and the state are one: the God-Emperor is both sovereign and living god.$md$,
    $md$The disciplined soul is reborn ever closer to the Dragon until it ascends; the undisciplined fall back down the climb.$md$,
    $md$The dead are burned on mountain pyres so their essence rises toward the Dragon; the highest are kept as cloister relics.$md$,
    $md$The Dragon Sutra and the Breath-Codices of the ascension-disciplines.$md$,
    $md$The summit shrine of Sunspire and the great cloister of Po'Tun.$md$,
    $md$A rising dragon on sun-orange; abbots wear saffron-and-black and a string of dragon-scale tokens by rank.$md$,
    $md$Grew with the Po Tun people and blazed into fervor when Tosh Raka became a dragon and renamed the nation Ka'Po'Tun.$md$
  );

-- ---------------------------------------------------------------------------
-- 4. Namesets (one per culture). World default = Bovold Harbor names.
-- ---------------------------------------------------------------------------
insert into public.namesets (id, world_id, name, config_json, is_default)
select
  pg_temp.seed_uuid('nameset:' || p.culture),
  pg_temp.seed_uuid('world:bovold'),
  case p.culture when 1 then 'Bovold Harbor' when 2 then 'Tsaesci Court' when 3 then 'Tang Mo Isles' else 'Ka''Po''Tun Cloister' end,
  jsonb_build_object(
    'male_given_names', to_jsonb(p.male),
    'female_given_names', to_jsonb(p.female),
    'surnames', to_jsonb(p.surnames),
    'convention', case p.culture when 2 then 'matronymic' when 3 then 'none' else 'family-name' end
  ),
  (p.culture = 1)
from tmp_pools p;

-- ---------------------------------------------------------------------------
-- 5. Nations (4), each wired to its culture/religion/nameset. Government types
--    from the enum: republic / despotism / confederation / theocracy.
-- ---------------------------------------------------------------------------
-- flag_path points at the nation-images objects the config.toml storage bucket
-- seeds on reset (<nation_id>/flag.webp).
insert into public.nations (id, world_id, name, description, nameset_id, primary_culture_id, state_religion_id, government_type, flag_path, tax_rate, treasury_currency) values
  (
    pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('world:bovold'),
    'Free City of Bovold',
    'The one human city of Akavir — a chartered neutral free port that trades with every beast-nation and bows to none.',
    pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), 'republic',
    pg_temp.seed_uuid('nation:bovold')::text || '/flag.webp', 0.08, 4200
  ),
  (
    pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('world:bovold'),
    'Tsaesciland Empire',
    'The immortal cannibal serpent-folk empire, ruled from the coiling palaces of Coil-of-Gold by an ageless Potentate.',
    pg_temp.seed_uuid('nameset:2'), pg_temp.seed_uuid('culture:tsaesci'), pg_temp.seed_uuid('religion:tsaesci'), 'despotism',
    pg_temp.seed_uuid('nation:tsaesci')::text || '/flag.webp', 0, 0
  ),
  (
    pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('world:bovold'),
    'Thousand Monkey Islands',
    'A free confederation of many-breed monkey-folk across a thousand isles — kind, unconquered, and fiercely opposed to all slavery.',
    pg_temp.seed_uuid('nameset:3'), pg_temp.seed_uuid('culture:tangmo'), pg_temp.seed_uuid('religion:tangmo'), 'confederation',
    pg_temp.seed_uuid('nation:tangmo')::text || '/flag.webp', 0, 0
  ),
  (
    pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('world:bovold'),
    'Ka''Po''Tun Confederacy',
    'The mountain empire of tiger-folk striving to become dragons, led by the god-emperor Tosh Raka from the cloister-city of Po''Tun.',
    pg_temp.seed_uuid('nameset:4'), pg_temp.seed_uuid('culture:kapotun'), pg_temp.seed_uuid('religion:kapotun'), 'theocracy',
    pg_temp.seed_uuid('nation:kapotun')::text || '/flag.webp', 0, 0
  );

-- All four nations already know each other at turn 0.
insert into public.nation_discoveries (id, world_id, nation_a_id, nation_b_id, met_at_turn_number)
select pg_temp.seed_uuid('discovery:' || a || ':' || b), pg_temp.seed_uuid('world:bovold'),
       least(pg_temp.seed_uuid('nation:' || a), pg_temp.seed_uuid('nation:' || b)),
       greatest(pg_temp.seed_uuid('nation:' || a), pg_temp.seed_uuid('nation:' || b)), 0
from (values
  ('bovold','tsaesci'),('bovold','tangmo'),('bovold','kapotun'),
  ('tsaesci','tangmo'),('tsaesci','kapotun'),('tangmo','kapotun')
) as t(a,b);

-- Nation relationships (bilateral mirror suppressed; both rows explicit).
--   Tsaesci <-> Ka'Po'Tun: at_war.   Ka'Po'Tun <-> Tang Mo: allied.
--   Tsaesci <-> Tang Mo: hostile.    Bovold <-> all three: neutral.
select set_config('app.skip_bilateral_mirror', 'true', false);
insert into public.nation_relationships (id, from_nation_id, to_nation_id, world_id, current_stance) values
  (pg_temp.seed_uuid('rel:tsaesci:kapotun'), pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('world:bovold'), 'at_war'),
  (pg_temp.seed_uuid('rel:kapotun:tsaesci'), pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('world:bovold'), 'at_war'),
  (pg_temp.seed_uuid('rel:kapotun:tangmo'), pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('world:bovold'), 'allied'),
  (pg_temp.seed_uuid('rel:tangmo:kapotun'), pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('world:bovold'), 'allied'),
  (pg_temp.seed_uuid('rel:tsaesci:tangmo'), pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('world:bovold'), 'hostile'),
  (pg_temp.seed_uuid('rel:tangmo:tsaesci'), pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('world:bovold'), 'hostile'),
  (pg_temp.seed_uuid('rel:bovold:tsaesci'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('world:bovold'), 'neutral'),
  (pg_temp.seed_uuid('rel:tsaesci:bovold'), pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('world:bovold'), 'neutral'),
  (pg_temp.seed_uuid('rel:bovold:tangmo'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('world:bovold'), 'neutral'),
  (pg_temp.seed_uuid('rel:tangmo:bovold'), pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('world:bovold'), 'neutral'),
  (pg_temp.seed_uuid('rel:bovold:kapotun'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('world:bovold'), 'neutral'),
  (pg_temp.seed_uuid('rel:kapotun:bovold'), pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('world:bovold'), 'neutral');
select set_config('app.skip_bilateral_mirror', 'false', false);

-- ---------------------------------------------------------------------------
-- 6. Treaties. Bovold (neutral hub) holds active trade agreements with all
--    three neighbours; Tsaesci has a standing (proposed, not-yet-active)
--    tribute demand on the Tang Mo. Tribute stays 'proposed' so the treaty
--    phase never transfers stockpiles during the replay.
-- ---------------------------------------------------------------------------
insert into public.nation_treaties (id, world_id, proposer_nation_id, responder_nation_id, treaty_type, terms, status, starts_turn_number) values
  (pg_temp.seed_uuid('treaty:bovold-tangmo'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('nation:tangmo'), 'trade_agreement', '{}'::jsonb, 'active', 0),
  (pg_temp.seed_uuid('treaty:bovold-kapotun'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'trade_agreement', '{}'::jsonb, 'active', 0),
  (pg_temp.seed_uuid('treaty:bovold-tsaesci'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'trade_agreement', '{}'::jsonb, 'active', 0),
  (pg_temp.seed_uuid('treaty:tsaesci-tribute-tangmo'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('nation:tangmo'), 'tribute', '{"note":"Serpent demand for isle-tribute, not yet accepted."}'::jsonb, 'proposed', null);

-- ---------------------------------------------------------------------------
-- 7. Settlements (36). Driver temp table drives settlements, buildings,
--    population and staffing. couples*2 + children ~= target population.
--    readiness: City of Bovold manual-ready; one Tang Mo isle auto-ready.
--    tier: 'capital' | 'city' | 'isle' | 'cloister' controls building set.
-- ---------------------------------------------------------------------------
create temp table tmp_setts (
  key text primary key, nation text, culture int, tier text, name text, description text,
  cx numeric, cz numeric, auto_ready boolean, is_ready boolean, couples int, children int
);

insert into tmp_setts values
  -- Free City of Bovold (1)
  ('bovold', 'bovold', 1, 'capital', 'City of Bovold', 'The one human city of Akavir: a walled free port whose counting-halls broker the trade of three beast-nations.', 0.0, 0.0, false, true, 75, 30),
  -- Tsaesciland Empire (9, ~200 each)
  ('coilgold', 'tsaesci', 2, 'capital', 'Coil-of-Gold', 'Gilded spiral capital of the serpent-folk, seat of the Potentate and the Spiral Reliquary of shed skins.', -40.0, -12.0, true, false, 90, 40),
  ('xheenmar', 'tsaesci', 2, 'city', 'Xheenmar', 'Terraced sunning-city of scaled gentry and venom-brewers on the warm southern cliffs.', -46.0, -6.0, true, false, 85, 30),
  ('serpentreach', 'tsaesci', 2, 'city', 'Serpentreach', 'River port where slave-galleys and silk-barges are loaded for the empire.', -34.0, -18.0, true, false, 85, 30),
  ('giltfang', 'tsaesci', 2, 'city', 'Gilt Fang', 'Fortress-city guarding the passes toward the tiger mountains; a duelists'' town.', -52.0, -20.0, true, false, 85, 30),
  ('vhossa', 'tsaesci', 2, 'city', 'Vhossa', 'Marsh city of eel-farms and fermented-egg cellars.', -30.0, -8.0, true, false, 85, 30),
  ('ilnith', 'tsaesci', 2, 'city', 'Ilnith', 'Quarry-city that cuts the gold-veined scale-tile for the coiling palaces.', -48.0, -28.0, true, false, 85, 30),
  ('ansuvheen', 'tsaesci', 2, 'city', 'Ansu-Vheen', 'Inland court-town of jade-cutters and rank-ring makers.', -38.0, -2.0, true, false, 85, 30),
  ('ssuvaal', 'tsaesci', 2, 'city', 'Ssu''Vaal', 'Border holdfast on the hostile isle-frontier, ever wary of monkey raids.', -26.0, -24.0, true, false, 85, 30),
  ('scaledcourt', 'tsaesci', 2, 'city', 'The Scaled Court', 'Garden-city of the old immortal houses and their private duel-yards.', -44.0, -4.0, true, false, 85, 30),
  -- Thousand Monkey Islands (18, 20-30 each)
  ('motang', 'tangmo', 3, 'capital', 'Mo''Tang', 'Canopy-capital of the isles, home to the Great Guardian-Tree and the loudest councils in Akavir.', 30.0, 20.0, true, false, 12, 6),
  ('highcanopy', 'tangmo', 3, 'isle', 'Highcanopy', 'Treetop town of rope-bridges high above the tide.', 34.0, 24.0, true, false, 11, 5),
  ('laughingharbor', 'tangmo', 3, 'isle', 'Laughing Harbor', 'Cheerful fishing isle famous for its drum-song and its terrible puns.', 28.0, 26.0, true, false, 10, 5),
  ('coconutreach', 'tangmo', 3, 'isle', 'Coconut Reach', 'Palm-heavy isle that ships coconut, oil and fruit across the confederation.', 36.0, 18.0, true, false, 10, 5),
  ('skyleap', 'tangmo', 3, 'isle', 'Skyleap', 'Cliff-isle where youths make the First Leap between the highest crags.', 40.0, 22.0, true, false, 10, 4),
  ('chatterbay', 'tangmo', 3, 'isle', 'Chatter Bay', 'Market-isle and gossip-hub where a hundred dialects haggle at once.', 26.0, 16.0, true, false, 11, 5),
  ('driftnest', 'tangmo', 3, 'isle', 'Driftnest', 'Isle of driftwood halls and the confederation''s best netmakers.', 32.0, 14.0, true, false, 9, 4),
  ('freepalms', 'tangmo', 3, 'isle', 'Free Palms', 'Refuge-isle that has never once been taken by raiders.', 38.0, 28.0, true, false, 10, 5),
  ('braidedisles', 'tangmo', 3, 'isle', 'The Braided Isles', 'A knot of tiny isles laced together by woven bridges.', 42.0, 16.0, true, false, 10, 4),
  ('tenthisle', 'tangmo', 3, 'isle', 'Tenth Isle', 'Remote outer isle, first to spot the summer thaw of the snow-demons.', 46.0, 30.0, true, false, 9, 4),
  ('bramba', 'tangmo', 3, 'isle', 'Bramba', 'Root-farming isle of good cheer and enormous shared cook-pots.', 24.0, 22.0, true, false, 10, 5),
  ('shoban', 'tangmo', 3, 'isle', 'Sho''Ban', 'Lantern-makers'' isle, brightest of all on the Thousand Lanterns night.', 30.0, 30.0, true, false, 10, 5),
  ('palmfront', 'tangmo', 3, 'isle', 'Palmfront', 'Windward isle of shell-craft and mask-carvers.', 44.0, 26.0, true, false, 10, 4),
  ('gullcry', 'tangmo', 3, 'isle', 'Gullcry', 'Rocky seabird isle prized for eggs and feathers.', 48.0, 20.0, true, false, 9, 4),
  ('sunderisle', 'tangmo', 3, 'isle', 'Sunder Isle', 'Storm-battered isle whose folk rebuild their stilt-homes without complaint.', 22.0, 28.0, true, false, 10, 5),
  ('longwharf', 'tangmo', 3, 'isle', 'Long Wharf', 'Trade-isle with the longest pier in the isles, a favorite Bovold port of call.', 26.0, 12.0, true, false, 11, 6),
  ('kiprest', 'tangmo', 3, 'isle', 'Kip''s Rest', 'Storyteller-isle said to be the trickster Kip''s own birthplace.', 34.0, 32.0, true, false, 10, 5),
  ('mudnest', 'tangmo', 3, 'isle', 'Mudnest', 'Mangrove isle of crab-catchers and reed-weavers.', 20.0, 18.0, true, false, 9, 4),
  -- Ka'Po'Tun Confederacy (8, ~50 each)
  ('potun', 'kapotun', 4, 'capital', 'Po''Tun', 'Cloister-capital of the tiger-folk, throne of the god-emperor Tosh Raka and the great ascension-monastery.', -20.0, 34.0, true, false, 22, 10),
  ('sunspire', 'kapotun', 4, 'cloister', 'Sunspire', 'Summit shrine-city where Tosh Raka first took wing; holiest site of the Ascension.', -26.0, 40.0, true, false, 20, 10),
  ('dragonclimb', 'kapotun', 4, 'cloister', 'Dragonclimb', 'Terraced monastery-town clinging to a sheer dragon-shaped ridge.', -14.0, 38.0, true, false, 20, 10),
  ('tigermount', 'kapotun', 4, 'cloister', 'Tigermount', 'Fortress-cloister guarding the war-front against the serpent empire.', -28.0, 28.0, true, false, 20, 10),
  ('embercloister', 'kapotun', 4, 'cloister', 'The Ember Cloister', 'Forge-monastery whose breath-masters temper both steel and soul.', -18.0, 44.0, true, false, 20, 10),
  ('nineroars', 'kapotun', 4, 'cloister', 'Nine Roars', 'Training-city of the monk-warriors, named for its nine echoing valleys.', -12.0, 30.0, true, false, 20, 10),
  ('rakhal', 'kapotun', 4, 'cloister', 'Rakhal', 'Rice-terraced valley town that feeds the mountain cloisters.', -24.0, 24.0, true, false, 20, 10),
  ('shomarath', 'kapotun', 4, 'cloister', 'Sho''Marath', 'Reliquary-town keeping the ashes and scales of the slain black dragons.', -16.0, 48.0, true, false, 20, 10);

insert into public.settlements (id, nation_id, name, description, coord_x, coord_z, auto_ready_enabled, is_ready_current_turn, last_ready_at, ready_set_at)
select pg_temp.seed_uuid('settlement:' || key), pg_temp.seed_uuid('nation:' || nation), name, description, cx, cz, auto_ready, is_ready,
       case when is_ready then '2026-05-03 12:00:00+00'::timestamptz else null end,
       case when is_ready then '2026-05-03 12:00:00+00'::timestamptz else null end
from tmp_setts;

-- Wire each nation's capital.
update public.nations n set capital_settlement_id = pg_temp.seed_uuid('settlement:' || s.key)
from tmp_setts s
where s.tier = 'capital' and n.id = pg_temp.seed_uuid('nation:' || s.nation);

-- ---------------------------------------------------------------------------
-- 8. Education ladder (world-scoped). Untaught -> Lettered -> Scholar -> Sage.
--    natural_born_percent weights the level a newborn rolls at birth.
-- ---------------------------------------------------------------------------
insert into public.education_levels (id, world_id, name, description, rank, natural_born_percent, icon) values
  (pg_temp.seed_uuid('edu:untaught'), pg_temp.seed_uuid('world:bovold'), 'Untaught',  'No formal schooling.',                      0, 70, 'game:person'),
  (pg_temp.seed_uuid('edu:lettered'), pg_temp.seed_uuid('world:bovold'), 'Lettered',  'Reads, writes and reckons a ledger.',       1, 22, 'game:book-cover'),
  (pg_temp.seed_uuid('edu:scholar'),  pg_temp.seed_uuid('world:bovold'), 'Scholar',   'Schooled in law, letters or the sutras.',   2, 6,  'game:scroll-quill'),
  (pg_temp.seed_uuid('edu:sage'),     pg_temp.seed_uuid('world:bovold'), 'Sage',      'A master of a discipline; rare and prized.', 3, 2,  'game:graduate-cap');

-- ---------------------------------------------------------------------------
-- 9. Economy pack — a deep, categorised catalogue: 10 resource categories,
--    ~80 resources, ~55 jobs across all six job types (real production chains:
--    ore -> ingot -> bronze/steel/tools; hides -> leather; milk -> cheese;
--    grain -> flour -> bread; etc.), 12 deposit types, 5 managed-population
--    types (sheep/pig/bee/cow/chicken) and ~52 building blueprints. Ids are
--    deterministic (seed_uuid); resource ids resolve as seed_uuid('resource:'||slug).
--    Food and water stay deliberately over-provisioned so the 32-turn replay
--    grows healthily; every other chain simply idles if its inputs run dry.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world constant uuid := pg_temp.seed_uuid('world:bovold');
  v_res_food  uuid;
  v_res_water uuid;
begin
  select id into v_res_food  from public.resources where world_id = v_world and slug = 'food';
  select id into v_res_water from public.resources where world_id = v_world and slug = 'fresh-water';

  -- Resource categories --------------------------------------------------
  insert into public.resource_categories (id, world_id, name, color, sort_order)
  select pg_temp.seed_uuid('cat:' || slug), v_world, name, color, ord
  from (values
    ('foodstuffs',   'Foodstuffs',                '#5aa469', 1),
    ('livestock',    'Livestock & Animal Products','#c98a3a', 2),
    ('ore',          'Ore & Minerals',            '#7d7d8c', 3),
    ('metals',       'Metals & Ingots',           '#b0894a', 4),
    ('timber',       'Timber & Fiber',            '#6b8e4e', 5),
    ('textiles',     'Textiles & Leather',        '#a05fb0', 6),
    ('metalwork',    'Tools & Metalwork',         '#8a8a99', 7),
    ('construction', 'Construction Materials',    '#9c8163', 8),
    ('luxury',       'Luxury & Trade Goods',      '#d4a017', 9),
    ('provisions',   'Provisions & Preserved',    '#b5652f', 10)
  ) as t(slug, name, color, ord);

  -- The two system resources (auto-created) join the foodstuffs category.
  update public.resources set category_id = pg_temp.seed_uuid('cat:foodstuffs')
  where world_id = v_world and slug in ('food', 'fresh-water');

  -- Resources (~80). id = seed_uuid('resource:'||slug); category by slug.
  insert into public.resources (id, world_id, name, slug, base_stockpile_cap, category_id, icon)
  select pg_temp.seed_uuid('resource:' || slug), v_world, name, slug, cap,
         pg_temp.seed_uuid('cat:' || cat), icon
  from (values
    -- Foodstuffs
    ('grain','Grain',2000,'foodstuffs','game:wheat'),
    ('rice','Rice',2000,'foodstuffs','game:bowl-of-rice'),
    ('vegetables','Vegetables',800,'foodstuffs','game:carrot'),
    ('fruit','Fruit',600,'foodstuffs','game:fruiting'),
    ('fish','Fish',600,'foodstuffs','game:fishing-net'),
    ('flour','Flour',800,'foodstuffs','game:flour'),
    ('bread','Bread',600,'foodstuffs','game:bread'),
    ('cheese','Cheese',400,'foodstuffs','game:cheese-wedge'),
    ('eggs','Eggs',400,'foodstuffs','game:raw-egg'),
    ('milk','Milk',400,'foodstuffs','game:milk-carton'),
    ('honey','Honey',300,'foodstuffs','game:honeycomb'),
    ('mushrooms','Mushrooms',400,'foodstuffs','game:mushroom-gills'),
    -- Livestock & animal products
    ('wool','Wool',500,'livestock','game:wool'),
    ('hides','Raw Hides',500,'livestock','game:animal-hide'),
    ('tallow','Tallow',300,'livestock','game:candle-flame'),
    ('beef','Beef',400,'livestock','game:steak'),
    ('mutton','Mutton',400,'livestock','game:meat'),
    ('pork','Pork',400,'livestock','game:ham-shank'),
    ('poultry','Poultry',400,'livestock','game:roast-chicken'),
    ('feathers','Feathers',300,'livestock','game:feather'),
    -- Ore & minerals
    ('iron-ore','Iron Ore',800,'ore','game:ore'),
    ('copper-ore','Copper Ore',800,'ore','game:ore'),
    ('tin-ore','Tin Ore',800,'ore','game:ore'),
    ('gold-ore','Gold Ore',500,'ore','game:gold-nuggets'),
    ('silver-ore','Silver Ore',500,'ore','game:ore'),
    ('coal','Coal',800,'ore','game:coal-pile'),
    ('stone','Raw Stone',1500,'ore','game:stone-pile'),
    ('clay','Clay',800,'ore','game:powder'),
    ('sand','Sand',800,'ore','game:sand-castle'),
    ('rough-gems','Rough Gems',300,'ore','game:gems'),
    -- Metals & ingots
    ('iron-ingot','Iron Ingot',500,'metals','game:metal-bar'),
    ('copper-ingot','Copper Ingot',400,'metals','game:metal-bar'),
    ('tin-ingot','Tin Ingot',400,'metals','game:metal-bar'),
    ('bronze','Bronze',400,'metals','game:metal-bar'),
    ('steel','Steel',400,'metals','game:metal-bar'),
    ('gold-ingot','Gold Ingot',300,'metals','game:gold-bar'),
    ('silver-ingot','Silver Ingot',300,'metals','game:metal-bar'),
    -- Timber & fiber
    ('hardwood-logs','Hardwood Logs',1000,'timber','game:wood-pile'),
    ('softwood-logs','Softwood Logs',1000,'timber','game:log'),
    ('planks','Planks',800,'timber','game:wood-beam'),
    ('charcoal','Charcoal',600,'timber','game:thrown-charcoal'),
    ('flax','Flax',500,'timber','game:plant-roots'),
    ('cotton','Cotton',500,'timber','game:cotton-flower'),
    ('raw-silk','Raw Silk',400,'timber','game:caterpillar'),
    ('peat','Peat',600,'timber','game:brick-pile'),
    -- Textiles & leather
    ('linen-cloth','Linen Cloth',300,'textiles','game:rolled-cloth'),
    ('wool-cloth','Wool Cloth',300,'textiles','game:wool'),
    ('silk-cloth','Silk Cloth',300,'textiles','game:rolled-cloth'),
    ('cotton-cloth','Cotton Cloth',300,'textiles','game:rolled-cloth'),
    ('leather','Leather',400,'textiles','game:leather-armor'),
    ('rope','Rope',400,'textiles','game:rope-coil'),
    ('dye','Dye',300,'textiles','game:paint-bucket'),
    ('thread','Thread',300,'textiles','game:film-spool'),
    -- Tools & metalwork
    ('tools','Tools',400,'metalwork','game:hammer-nails'),
    ('nails','Nails',400,'metalwork','game:nails'),
    ('weapons','Weapons',300,'metalwork','game:crossed-swords'),
    ('armor','Armor',300,'metalwork','game:breastplate'),
    ('cookware','Cookware',300,'metalwork','game:cooking-pot'),
    ('horseshoes','Horseshoes',300,'metalwork','game:horseshoe'),
    -- Construction materials
    ('stone-block','Stone Block',1200,'construction','game:stone-block'),
    ('bricks','Bricks',1000,'construction','game:brick-pile'),
    ('mortar','Mortar',600,'construction','game:mortar'),
    ('glass','Glass',400,'construction','game:round-bottom-flask'),
    ('roof-tiles','Roof Tiles',600,'construction','game:brick-wall'),
    ('cut-stone','Cut Stone',800,'construction','game:stone-block'),
    ('timber-beams','Timber Beams',600,'construction','game:wood-beam'),
    -- Luxury & trade goods
    ('jade','Jade',300,'luxury','game:emerald'),
    ('gold','Gold',400,'luxury','game:gold-bar'),
    ('silver','Silver',400,'luxury','game:metal-bar'),
    ('gemstones','Gemstones',200,'luxury','game:gems'),
    ('spices','Spices',300,'luxury','game:powder'),
    ('incense','Incense',300,'luxury','game:incense'),
    ('perfume','Perfume',200,'luxury','game:perfume-bottle'),
    ('wine','Wine',400,'luxury','game:wine-bottle'),
    ('jewelry','Jewelry',200,'luxury','game:diamond-ring'),
    ('pottery','Pottery',400,'luxury','game:amphora'),
    -- Provisions & preserved
    ('salted-pork','Cured Pork',500,'provisions','game:bacon'),
    ('smoked-mutton','Smoked Mutton',500,'provisions','game:meat'),
    ('dried-fish','Dried Fish',500,'provisions','game:canned-fish'),
    ('sea-salt','Sea Salt',400,'provisions','game:salt-shaker'),
    ('preserves','Preserves',300,'provisions','game:mason-jar'),
    ('sugar','Sugar',400,'provisions','game:sugar-cane'),
    ('ale','Ale',400,'provisions','game:beer-stein'),
    ('rice-wine','Rice-Wine',400,'provisions','game:bottle-vapors')
  ) as t(slug, name, cap, cat, icon);

  -- Standard producers: food/water/gather + the craft chains. inputs/outputs
  -- reference resources by seed_uuid('resource:'||slug). base_capacity is
  -- generous so chains can run everywhere; only field/water are heavily staffed.
  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json, outputs_json, icon)
  select pg_temp.seed_uuid('job:' || slug), v_world, name, slug, 'standard', cap,
         coalesce(inp, '[]'::jsonb), out, icon
  from (values
    ('field-hand','Field Hand',30,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_food::text,'amount_per_worker',8)),'game:farmer'),
    ('water-bearer','Water Bearer',24,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_water::text,'amount_per_worker',8)),'game:full-wood-bucket-handle'),
    ('grain-farmer','Grain Farmer',16,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount_per_worker',6)),'game:sickle'),
    ('rice-farmer','Rice Farmer',16,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:rice')::text,'amount_per_worker',6)),'game:bowl-of-rice'),
    ('fisher','Fisher',12,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_food::text,'amount_per_worker',3),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:fish')::text,'amount_per_worker',2)),'game:fishing-pole'),
    ('hunter','Hunter',10,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_food::text,'amount_per_worker',2),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hides')::text,'amount_per_worker',1)),'game:high-shot'),
    ('forager','Forager',10,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_food::text,'amount_per_worker',2),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:fruit')::text,'amount_per_worker',2),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:mushrooms')::text,'amount_per_worker',1)),'game:berries-bowl'),
    ('miller','Miller',8,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount_per_worker',3)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:flour')::text,'amount_per_worker',3)),'game:water-mill'),
    ('baker','Baker',8,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:flour')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:bread')::text,'amount_per_worker',3)),'game:bread'),
    ('brewer','Brewer',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:ale')::text,'amount_per_worker',1)),'game:beer-stein'),
    ('vintner','Vintner',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:fruit')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:wine')::text,'amount_per_worker',1)),'game:wine-bottle'),
    ('cheesemaker','Cheesemaker',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:milk')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:cheese')::text,'amount_per_worker',1)),'game:cheese-wedge'),
    ('tanner','Tanner',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hides')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:leather')::text,'amount_per_worker',1)),'game:animal-hide'),
    ('cloth-weaver','Wool Weaver',8,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:wool')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:wool-cloth')::text,'amount_per_worker',1)),'game:wool'),
    ('linen-weaver','Linen Weaver',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:flax')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:linen-cloth')::text,'amount_per_worker',1)),'game:sewing-needle'),
    ('silk-weaver','Silk Weaver',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:raw-silk')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:silk-cloth')::text,'amount_per_worker',1)),'game:rolled-cloth'),
    ('ropemaker','Ropemaker',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:flax')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:rope')::text,'amount_per_worker',2)),'game:rope-coil'),
    ('iron-smelter','Iron Smelter',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ore')::text,'amount_per_worker',2),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:coal')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ingot')::text,'amount_per_worker',1)),'game:metal-bar'),
    ('copper-smelter','Copper Smelter',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:copper-ore')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:copper-ingot')::text,'amount_per_worker',1)),'game:metal-bar'),
    ('tin-smelter','Tin Smelter',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:tin-ore')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:tin-ingot')::text,'amount_per_worker',1)),'game:metal-bar'),
    ('gold-smelter','Gold Smelter',4,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:gold-ore')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:gold-ingot')::text,'amount_per_worker',1)),'game:gold-bar'),
    ('bronzesmith','Bronzesmith',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:copper-ingot')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:tin-ingot')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:bronze')::text,'amount_per_worker',1)),'game:anvil-impact'),
    ('steelworker','Steelworker',5,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ingot')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:coal')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:steel')::text,'amount_per_worker',1)),'game:metal-bar'),
    ('blacksmith','Blacksmith',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ingot')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:tools')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:nails')::text,'amount_per_worker',2)),'game:anvil'),
    ('weaponsmith','Weaponsmith',5,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:steel')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:weapons')::text,'amount_per_worker',1)),'game:crossed-swords'),
    ('armorer','Armorer',5,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:bronze')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:leather')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:armor')::text,'amount_per_worker',1)),'game:breastplate'),
    ('jeweler','Jeweler',4,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:gold-ingot')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:rough-gems')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:jewelry')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:gemstones')::text,'amount_per_worker',1)),'game:diamond-ring'),
    ('potter','Potter',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:clay')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:pottery')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:bricks')::text,'amount_per_worker',1)),'game:amphora'),
    ('glassblower','Glassblower',5,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:sand')::text,'amount_per_worker',2),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:coal')::text,'amount_per_worker',1)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:glass')::text,'amount_per_worker',1)),'game:round-bottom-flask'),
    ('carpenter','Carpenter',8,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:planks')::text,'amount_per_worker',2),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:timber-beams')::text,'amount_per_worker',1)),'game:hand-saw'),
    ('charcoal-burner','Charcoal Burner',6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:softwood-logs')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:charcoal')::text,'amount_per_worker',2)),'game:thrown-charcoal'),
    ('stonecutter','Stonecutter',8,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone')::text,'amount_per_worker',2)),
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount_per_worker',1),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:cut-stone')::text,'amount_per_worker',1)),'game:stone-crafting')
  ) as t(slug, name, cap, inp, out, icon);

  -- Construction, trader and teacher jobs.
  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json, outputs_json, icon) values
    (pg_temp.seed_uuid('job:teacher'), v_world, 'Teacher', 'teacher', 'teacher', 6, '[]'::jsonb, '[]'::jsonb, 'game:teacher');
  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, icon) values
    (pg_temp.seed_uuid('job:stone-mason'), v_world, 'Stone Mason', 'stone-mason', 'construction', 8, 'game:trowel');
  insert into public.job_definitions (id, world_id, name, slug, job_type, trader_capacity_per_worker, required_education_level_id, icon) values
    (pg_temp.seed_uuid('job:caravan-trader'), v_world, 'Caravan Trader', 'caravan-trader', 'trader', 25, pg_temp.seed_uuid('edu:lettered'), 'game:caravan');

  -- Deposit types (12) + their miner jobs.
  insert into public.deposit_types (id, world_id, name, slug, icon)
  select pg_temp.seed_uuid('deposit:' || slug), v_world, name, slug, icon
  from (values
    ('iron-vein','Iron Vein','game:minerals'),
    ('copper-vein','Copper Vein','game:ore'),
    ('tin-vein','Tin Vein','game:ore'),
    ('gold-vein','Gold Vein','game:gold-mine'),
    ('silver-vein','Silver Vein','game:ore'),
    ('coal-seam','Coal Seam','game:coal-pile'),
    ('stone-quarry','Stone Quarry','mountain'),
    ('clay-pit','Clay Pit','game:powder'),
    ('hardwood-grove','Hardwood Grove','trees'),
    ('peat-bog','Peat Bog','game:swamp'),
    ('salt-flat','Salt Flat','game:salt-shaker'),
    ('sand-pit','Sand Pit','game:sand-castle')
  ) as t(slug, name, icon);

  insert into public.job_definitions (id, world_id, name, slug, job_type, linked_deposit_type_id, icon)
  select pg_temp.seed_uuid('job:' || jslug), v_world, name, jslug, 'deposit', pg_temp.seed_uuid('deposit:' || dslug), icon
  from (values
    ('iron-miner','Iron Miner','iron-vein','pickaxe'),
    ('copper-miner','Copper Miner','copper-vein','game:mining-helmet'),
    ('tin-miner','Tin Miner','tin-vein','game:mining-helmet'),
    ('gold-miner','Gold Miner','gold-vein','game:gold-nuggets'),
    ('silver-miner','Silver Miner','silver-vein','game:mining-helmet'),
    ('coal-miner','Coal Miner','coal-seam','game:coal-pile'),
    ('stone-quarryman','Stone Quarryman','stone-quarry','game:rock'),
    ('clay-digger','Clay Digger','clay-pit','shovel'),
    ('lumberjack','Lumberjack','hardwood-grove','axe'),
    ('peat-cutter','Peat Cutter','peat-bog','shovel'),
    ('salt-panner','Salt Panner','salt-flat','game:salt-shaker'),
    ('sand-digger','Sand Digger','sand-pit','shovel')
  ) as t(jslug, name, dslug, icon);

  insert into public.deposit_type_jobs (deposit_type_id, job_id, output_units_per_worker, worker_inputs_json)
  select pg_temp.seed_uuid('deposit:' || dslug), pg_temp.seed_uuid('job:' || jslug), yield, '[]'::jsonb
  from (values
    ('iron-vein','iron-miner',5), ('copper-vein','copper-miner',5), ('tin-vein','tin-miner',5),
    ('gold-vein','gold-miner',3), ('silver-vein','silver-miner',4), ('coal-seam','coal-miner',6),
    ('stone-quarry','stone-quarryman',8), ('clay-pit','clay-digger',6), ('hardwood-grove','lumberjack',6),
    ('peat-bog','peat-cutter',6), ('salt-flat','salt-panner',5), ('sand-pit','sand-digger',6)
  ) as t(dslug, jslug, yield);

  -- Managed populations (5: sheep, pig, bee, cow, chicken) with husbandry
  -- (regular per-animal output) and culling (harvest) jobs.
  insert into public.managed_population_types (id, world_id, name, slug, growth_rate, maintenance_rules_json, culling_outputs_json, regular_outputs_json, icon) values
    (pg_temp.seed_uuid('pop:sheep-herd'), v_world, 'Sheep Herd', 'sheep-herd', 0.10,
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount_per_n_animals',0.1)),
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:mutton')::text,'amount_per_n_animals',0.5),
                         jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hides')::text,'amount_per_n_animals',0.25)),
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:wool')::text,'amount_per_n_animals',0.25)),'game:sheep'),
    (pg_temp.seed_uuid('pop:pig-herd'), v_world, 'Pig Herd', 'pig-herd', 0.15,
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount_per_n_animals',0.2)),
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:pork')::text,'amount_per_n_animals',2),
                         jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hides')::text,'amount_per_n_animals',0.25)),
       '[]'::jsonb,'game:pig'),
    (pg_temp.seed_uuid('pop:bee-colony'), v_world, 'Bee Colony', 'bee-colony', 0.05,
       '[]'::jsonb,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:honey')::text,'amount_per_n_animals',0.5)),'game:bee'),
    (pg_temp.seed_uuid('pop:cow-herd'), v_world, 'Cow Herd', 'cow-herd', 0.08,
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount_per_n_animals',0.2)),
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:beef')::text,'amount_per_n_animals',1.5),
                         jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hides')::text,'amount_per_n_animals',0.5)),
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:milk')::text,'amount_per_n_animals',0.4)),'game:cow'),
    (pg_temp.seed_uuid('pop:chicken-flock'), v_world, 'Chicken Flock', 'chicken-flock', 0.20,
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount_per_n_animals',0.1)),
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:poultry')::text,'amount_per_n_animals',0.8),
                         jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:feathers')::text,'amount_per_n_animals',0.5)),
       jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:eggs')::text,'amount_per_n_animals',0.5)),'game:chicken');

  insert into public.job_definitions (id, world_id, name, slug, job_type, linked_managed_population_type_id, icon)
  select pg_temp.seed_uuid('job:' || jslug), v_world, name, jslug, jtype, pg_temp.seed_uuid('pop:' || pslug), icon
  from (values
    ('shepherd','Shepherd','husbandry','sheep-herd','game:shepherds-crook'),
    ('swineherd','Swineherd','husbandry','pig-herd','game:pig'),
    ('cowherd','Cowherd','husbandry','cow-herd','game:cow'),
    ('beekeeper','Beekeeper','husbandry','bee-colony','game:beehive'),
    ('poultry-keeper','Poultry Keeper','husbandry','chicken-flock','game:chicken'),
    ('mutton-butcher','Mutton Butcher','culling','sheep-herd','game:cleaver'),
    ('pork-butcher','Pork Butcher','culling','pig-herd','game:meat-cleaver'),
    ('cattle-butcher','Cattle Butcher','culling','cow-herd','game:cleaver'),
    ('honey-gatherer','Honey Gatherer','culling','bee-colony','game:honey-jar'),
    ('poulterer','Poulterer','culling','chicken-flock','game:cleaver')
  ) as t(jslug, name, jtype, pslug, icon);

  insert into public.managed_population_husbandry_jobs (managed_population_type_id, job_id, workers_per_n_animals) values
    (pg_temp.seed_uuid('pop:sheep-herd'),     pg_temp.seed_uuid('job:shepherd'),       10),
    (pg_temp.seed_uuid('pop:pig-herd'),       pg_temp.seed_uuid('job:swineherd'),       8),
    (pg_temp.seed_uuid('pop:cow-herd'),       pg_temp.seed_uuid('job:cowherd'),        10),
    (pg_temp.seed_uuid('pop:bee-colony'),     pg_temp.seed_uuid('job:beekeeper'),      20),
    (pg_temp.seed_uuid('pop:chicken-flock'),  pg_temp.seed_uuid('job:poultry-keeper'), 15);

  insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker) values
    (pg_temp.seed_uuid('pop:sheep-herd'),     pg_temp.seed_uuid('job:mutton-butcher'), 10),
    (pg_temp.seed_uuid('pop:pig-herd'),       pg_temp.seed_uuid('job:pork-butcher'),   10),
    (pg_temp.seed_uuid('pop:cow-herd'),       pg_temp.seed_uuid('job:cattle-butcher'),  8),
    (pg_temp.seed_uuid('pop:bee-colony'),     pg_temp.seed_uuid('job:honey-gatherer'), 10),
    (pg_temp.seed_uuid('pop:chicken-flock'),  pg_temp.seed_uuid('job:poulterer'),      12);

  -- Special buildings authored explicitly (food/water/storage/housing/school/smithy).
  insert into public.building_blueprints (id, world_id, name, slug, description, grace_period_turns, max_instances_per_settlement, icon) values
    (pg_temp.seed_uuid('bp:granary'),    v_world, 'Granary',    'granary',    'A raised granary that yields food passively and widens the field-hand rota.', 0, null, 'game:granary'),
    (pg_temp.seed_uuid('bp:cistern'),    v_world, 'Cistern',    'cistern',    'A stone cistern that gathers fresh water and supports the water-bearers.', 0, null, 'game:well'),
    (pg_temp.seed_uuid('bp:storehouse'), v_world, 'Storehouse', 'storehouse', 'Roofed storage adding stockpile capacity for grain and cured goods.', 1, 6, 'warehouse'),
    (pg_temp.seed_uuid('bp:longhouse'),  v_world, 'Longhouse',  'longhouse',  'A communal hall that raises the settlement''s sustainable population.', 2, 8, 'game:viking-longhouse'),
    (pg_temp.seed_uuid('bp:smithy'),     v_world, 'Smithy',     'smithy',     'A two-tier smithy that expands iron storage and bolsters the mason corps.', 1, 2, 'game:anvil'),
    (pg_temp.seed_uuid('bp:school'),     v_world, 'School',     'school',     'A schoolhouse where a teacher lifts pupils from Untaught through Scholar.', 0, 1, 'game:teacher');

  insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, worker_turns_required, construction_costs_json, upkeep_costs_json, effects_json) values
    (pg_temp.seed_uuid('tier:granary:1'), pg_temp.seed_uuid('bp:granary'), 1, 6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',10),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text,'amount',5)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','passive_resource_production','resource_id', v_res_food::text,'amount',24),
        jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:field-hand')::text,'amount',6),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_food::text,'amount',800),
        jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount',400))),
    (pg_temp.seed_uuid('tier:cistern:1'), pg_temp.seed_uuid('bp:cistern'), 1, 5,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',8)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','passive_resource_production','resource_id', v_res_water::text,'amount',24),
        jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:water-bearer')::text,'amount',6),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_water::text,'amount',800))),
    (pg_temp.seed_uuid('tier:storehouse:1'), pg_temp.seed_uuid('bp:storehouse'), 1, 4,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',20)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:grain')::text,'amount',500),
        jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:salted-pork')::text,'amount',250))),
    (pg_temp.seed_uuid('tier:longhouse:1'), pg_temp.seed_uuid('bp:longhouse'), 1, 8,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text,'amount',15),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',10)),
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('type','population_cap_increase','amount',50))),
    (pg_temp.seed_uuid('tier:smithy:1'), pg_temp.seed_uuid('bp:smithy'), 1, 7,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ore')::text,'amount',4),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',6)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:iron-ore')::text,'amount',100),
        jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:stone-mason')::text,'amount',2),
        jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:blacksmith')::text,'amount',3))),
    (pg_temp.seed_uuid('tier:smithy:2'), pg_temp.seed_uuid('bp:smithy'), 2, 12,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ore')::text,'amount',8),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',12),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:bronze')::text,'amount',4)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:iron-ingot')::text,'amount',250),
        jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:blacksmith')::text,'amount',3),
        jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:weaponsmith')::text,'amount',2))),
    (pg_temp.seed_uuid('tier:school:1'), pg_temp.seed_uuid('bp:school'), 1, 6,
      jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text,'amount',10),
                        jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',8)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:teacher')::text,'amount',2),
        jsonb_build_object('type','education','teacher_job_id', pg_temp.seed_uuid('job:teacher')::text,
          'teacher_capacity',2,'students_per_teacher',6,
          'levels', jsonb_build_array(
            jsonb_build_object('from_level_id', null,'to_level_id', pg_temp.seed_uuid('edu:lettered')::text,'turns',3),
            jsonb_build_object('from_level_id', pg_temp.seed_uuid('edu:lettered')::text,'to_level_id', pg_temp.seed_uuid('edu:scholar')::text,'turns',4)))));

  -- Craft / production / civic / military buildings via a driver: each grants
  -- +capacity for its linked job and storage for its output good.
  insert into public.building_blueprints (id, world_id, name, slug, description, grace_period_turns, max_instances_per_settlement, icon)
  select pg_temp.seed_uuid('bp:' || slug), v_world, name, slug, descr, 0, cap_max, icon
  from (values
    ('watermill','Watermill','Grinds grain into flour.',3,'game:water-mill','miller','flour'),
    ('bakery','Bakery','Bakes bread from flour.',3,'game:bread','baker','bread'),
    ('brewery','Brewery','Brews ale from grain.',2,'game:barrel','brewer','ale'),
    ('winery','Winery','Presses fruit into wine.',2,'game:wine-bottle','vintner','wine'),
    ('dairy','Dairy','Turns milk into cheese.',2,'game:cheese-wedge','cheesemaker','cheese'),
    ('smokehouse','Smokehouse','Cures and smokes meat and fish.',3,'game:meat','fisher','dried-fish'),
    ('weavers-workshop','Weaver''s Workshop','Weaves wool into cloth.',4,'game:yarn','cloth-weaver','wool-cloth'),
    ('linen-workshop','Linen Workshop','Weaves flax into linen.',3,'game:sewing-needle','linen-weaver','linen-cloth'),
    ('silk-workshop','Silk Workshop','Weaves raw silk into fine cloth.',2,'game:rolled-cloth','silk-weaver','silk-cloth'),
    ('tannery','Tannery','Tans raw hides into leather.',3,'game:animal-hide','tanner','leather'),
    ('ropewalk','Ropewalk','Twists flax into rope.',2,'game:rope-coil','ropemaker','rope'),
    ('smelter','Smelter','Smelts iron ore into ingots.',3,'game:furnace','iron-smelter','iron-ingot'),
    ('copper-smeltery','Copper Smeltery','Smelts copper ore into ingots.',2,'game:furnace','copper-smelter','copper-ingot'),
    ('tin-smeltery','Tin Smeltery','Smelts tin ore into ingots.',2,'game:furnace','tin-smelter','tin-ingot'),
    ('bronze-foundry','Bronze Foundry','Alloys copper and tin into bronze.',2,'game:anvil-impact','bronzesmith','bronze'),
    ('steelworks','Steelworks','Forges iron and coal into steel.',2,'game:metal-bar','steelworker','steel'),
    ('armory','Armory','Forges weapons and armor.',2,'game:crossed-swords','weaponsmith','weapons'),
    ('goldsmithy','Goldsmithy','Works gold and gems into jewelry.',1,'game:diamond-ring','jeweler','jewelry'),
    ('pottery','Pottery','Fires clay into pots and bricks.',3,'game:amphora','potter','pottery'),
    ('glassworks','Glassworks','Blows sand into glass.',2,'game:round-bottom-flask','glassblower','glass'),
    ('carpenters-shop','Carpenter''s Shop','Saws logs into planks and beams.',3,'game:hand-saw','carpenter','planks'),
    ('charcoal-kiln','Charcoal Kiln','Chars softwood into charcoal.',2,'game:thrown-charcoal','charcoal-burner','charcoal'),
    ('masons-yard','Mason''s Yard','Cuts raw stone into blocks.',3,'game:stone-crafting','stonecutter','stone-block'),
    ('fishery','Fishery','A wharf that widens the fisher rota.',4,'game:fishing-net','fisher','fish'),
    ('hunting-lodge','Hunting Lodge','A lodge for hunters and their game.',3,'game:high-shot','hunter','hides'),
    ('foragers-hut','Forager''s Hut','A hut for foragers of the wild.',3,'game:berries-bowl','forager','fruit'),
    ('sheepfold','Sheepfold','Shelters and grows the sheep herd.',3,'game:sheep','shepherd','wool'),
    ('pigpen','Pigpen','Shelters and grows the pig herd.',3,'game:pig','swineherd','pork'),
    ('cow-barn','Cow Barn','Shelters and grows the cow herd.',3,'game:cow','cowherd','milk'),
    ('henhouse','Henhouse','Shelters and grows the chicken flock.',3,'game:chicken','poultry-keeper','eggs'),
    ('apiary','Apiary','Tends and grows the bee colonies.',3,'game:beehive','beekeeper','honey'),
    ('market','Market','Widens the caravan-trader rota.',2,'game:shop','caravan-trader','spices'),
    ('warehouse','Warehouse','Extra bulk storage for trade goods.',6,'warehouse','stonecutter','cut-stone')
  ) as t(slug, name, descr, cap_max, icon, job_slug, out_slug);

  insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, worker_turns_required, construction_costs_json, upkeep_costs_json, effects_json)
  select pg_temp.seed_uuid('tier:' || slug || ':1'), pg_temp.seed_uuid('bp:' || slug), 1, 5,
    jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text,'amount',8),
                      jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',5)),
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:' || job_slug)::text,'amount',4),
      jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:' || out_slug)::text,'amount',300))
  from (values
    ('watermill','miller','flour'),('bakery','baker','bread'),('brewery','brewer','ale'),
    ('winery','vintner','wine'),('dairy','cheesemaker','cheese'),('smokehouse','fisher','dried-fish'),
    ('weavers-workshop','cloth-weaver','wool-cloth'),('linen-workshop','linen-weaver','linen-cloth'),
    ('silk-workshop','silk-weaver','silk-cloth'),('tannery','tanner','leather'),('ropewalk','ropemaker','rope'),
    ('smelter','iron-smelter','iron-ingot'),('copper-smeltery','copper-smelter','copper-ingot'),
    ('tin-smeltery','tin-smelter','tin-ingot'),('bronze-foundry','bronzesmith','bronze'),
    ('steelworks','steelworker','steel'),('armory','weaponsmith','weapons'),('goldsmithy','jeweler','jewelry'),
    ('pottery','potter','pottery'),('glassworks','glassblower','glass'),('carpenters-shop','carpenter','planks'),
    ('charcoal-kiln','charcoal-burner','charcoal'),('masons-yard','stonecutter','stone-block'),
    ('fishery','fisher','fish'),('hunting-lodge','hunter','hides'),('foragers-hut','forager','fruit'),
    ('sheepfold','shepherd','wool'),('pigpen','swineherd','pork'),('cow-barn','cowherd','milk'),
    ('henhouse','poultry-keeper','eggs'),('apiary','beekeeper','honey'),('market','caravan-trader','spices'),
    ('warehouse','stonecutter','cut-stone')
  ) as t(slug, job_slug, out_slug);

  -- Tier 2 for the same producer buildings: costs more, takes longer, and
  -- widens the rota / storage further than tier 1.
  insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, worker_turns_required, construction_costs_json, upkeep_costs_json, effects_json)
  select pg_temp.seed_uuid('tier:' || slug || ':2'), pg_temp.seed_uuid('bp:' || slug), 2, 9,
    jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text,'amount',14),
                      jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',10)),
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type','job_capacity_increase','job_id', pg_temp.seed_uuid('job:' || job_slug)::text,'amount',6),
      jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:' || out_slug)::text,'amount',650))
  from (values
    ('watermill','miller','flour'),('bakery','baker','bread'),('brewery','brewer','ale'),
    ('winery','vintner','wine'),('dairy','cheesemaker','cheese'),('smokehouse','fisher','dried-fish'),
    ('weavers-workshop','cloth-weaver','wool-cloth'),('linen-workshop','linen-weaver','linen-cloth'),
    ('silk-workshop','silk-weaver','silk-cloth'),('tannery','tanner','leather'),('ropewalk','ropemaker','rope'),
    ('smelter','iron-smelter','iron-ingot'),('copper-smeltery','copper-smelter','copper-ingot'),
    ('tin-smeltery','tin-smelter','tin-ingot'),('bronze-foundry','bronzesmith','bronze'),
    ('steelworks','steelworker','steel'),('armory','weaponsmith','weapons'),('goldsmithy','jeweler','jewelry'),
    ('pottery','potter','pottery'),('glassworks','glassblower','glass'),('carpenters-shop','carpenter','planks'),
    ('charcoal-kiln','charcoal-burner','charcoal'),('masons-yard','stonecutter','stone-block'),
    ('fishery','fisher','fish'),('hunting-lodge','hunter','hides'),('foragers-hut','forager','fruit'),
    ('sheepfold','shepherd','wool'),('pigpen','swineherd','pork'),('cow-barn','cowherd','milk'),
    ('henhouse','poultry-keeper','eggs'),('apiary','beekeeper','honey'),('market','caravan-trader','spices'),
    ('warehouse','stonecutter','cut-stone')
  ) as t(slug, job_slug, out_slug);

  -- Purely civic / cultural / military buildings (flavour + pop cap / storage;
  -- no new sim mechanics), authored via a second driver.
  insert into public.building_blueprints (id, world_id, name, slug, description, grace_period_turns, max_instances_per_settlement, icon)
  select pg_temp.seed_uuid('bp:' || slug), v_world, name, slug, descr, 0, cap_max, icon
  from (values
    ('library','Library','A hall of records and learning.',1,'game:book-cover'),
    ('temple','Temple','A great house of worship.',1,'game:greek-temple'),
    ('shrine','Shrine','A small sacred site.',3,'game:temple-gate'),
    ('town-hall','Town Hall','The seat of local governance.',1,'game:capitol'),
    ('courthouse','Courthouse','Where the law is heard.',1,'game:scales'),
    ('mint','Mint','Strikes and stores the nation''s coin.',1,'game:cash'),
    ('bank','Bank','Vaults for the nation''s reserves.',1,'game:bank'),
    ('barracks','Barracks','Quarters and drills the garrison.',2,'game:barracks'),
    ('watchtower','Watchtower','Watches the approaches.',4,'game:watchtower'),
    ('city-wall','City Wall','Ramparts guarding the settlement.',1,'game:defensive-wall'),
    ('manor','Manor','A grand hall raising the population cap.',3,'game:castle'),
    ('tenement','Tenement','Dense housing raising the population cap.',4,'game:house')
  ) as t(slug, name, descr, cap_max, icon);

  insert into public.building_blueprint_tiers (id, building_blueprint_id, tier_number, worker_turns_required, construction_costs_json, upkeep_costs_json, effects_json)
  select pg_temp.seed_uuid('tier:' || slug || ':1'), pg_temp.seed_uuid('bp:' || slug), 1, 6,
    jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:stone-block')::text,'amount',12),
                      jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text,'amount',8)),
    '[]'::jsonb, effects
  from (values
    ('library',    jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:pottery')::text,'amount',200))),
    ('temple',     jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:incense')::text,'amount',200))),
    ('shrine',     jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:incense')::text,'amount',100))),
    ('town-hall',  jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:gold')::text,'amount',200))),
    ('courthouse', jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:jade')::text,'amount',100))),
    ('mint',       jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:gold')::text,'amount',400))),
    ('bank',       jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:silver')::text,'amount',400))),
    ('barracks',   jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:weapons')::text,'amount',200))),
    ('watchtower', jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:armor')::text,'amount',100))),
    ('city-wall',  jsonb_build_array(jsonb_build_object('type','resource_storage_increase','resource_id', pg_temp.seed_uuid('resource:cut-stone')::text,'amount',300))),
    ('manor',      jsonb_build_array(jsonb_build_object('type','population_cap_increase','amount',40))),
    ('tenement',   jsonb_build_array(jsonb_build_object('type','population_cap_increase','amount',30)))
  ) as t(slug, effects);
end$$;

-- ---------------------------------------------------------------------------
-- 10. Per-settlement buildings, deposits, managed populations, stockpiles and
--     construction. Building counts scale with population so every settlement
--     is food/water self-sufficient (granary +16 food & +6 field capacity;
--     cistern +16 water & +6 bearer capacity) with population-cap headroom.
-- ---------------------------------------------------------------------------
do $$
declare
  r record; v_sid uuid; v_pop int; v_gran int; v_cist int; v_long int; v_i int; v_rn int := 0;
  b text; d text; p text; v_res text; v_cull int;
  -- Building sets by settlement size. Core = every settlement; city adds the
  -- refining/trade layer; capital adds the full craft + civic + military layer.
  v_core_bp text[] := array['masons-yard','carpenters-shop','watermill','bakery','smokehouse','sheepfold','cow-barn','henhouse'];
  v_city_bp text[] := array['smelter','bronze-foundry','weavers-workshop','tannery','pottery','brewery','market','apiary','pigpen','fishery','copper-smeltery','tin-smeltery'];
  v_cap_bp  text[] := array['steelworks','armory','goldsmithy','glassworks','dairy','winery','silk-workshop','ropewalk','charcoal-kiln','warehouse','hunting-lodge','foragers-hut','mint','bank','temple','town-hall','courthouse','library','barracks','watchtower','manor'];
  v_core_dep text[] := array['hardwood-grove','stone-quarry','clay-pit','sand-pit','coal-seam','salt-flat'];
  v_city_dep text[] := array['iron-vein','copper-vein','tin-vein'];
  v_cap_dep  text[] := array['gold-vein','silver-vein'];
  v_core_pop text[] := array['sheep-herd','cow-herd','chicken-flock'];
  v_big_pop  text[] := array['pig-herd','bee-colony'];
begin
  for r in select * from tmp_setts order by key loop
    v_rn := v_rn + 1;
    v_sid := pg_temp.seed_uuid('settlement:' || r.key);
    v_pop := r.couples * 2 + r.children;
    v_gran := greatest(1, ceil(v_pop / 120.0))::int;
    v_cist := greatest(1, ceil(v_pop / 120.0))::int;
    v_long := least(8, greatest(2, ceil(v_pop / 28.0)::int));

    for v_i in 1..v_gran loop
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':granary:' || v_i), v_sid, pg_temp.seed_uuid('bp:granary'), pg_temp.seed_uuid('tier:granary:1'), 'active', 0);
    end loop;
    for v_i in 1..v_cist loop
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':cistern:' || v_i), v_sid, pg_temp.seed_uuid('bp:cistern'), pg_temp.seed_uuid('tier:cistern:1'), 'active', 0);
    end loop;
    insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':storehouse'), v_sid, pg_temp.seed_uuid('bp:storehouse'), pg_temp.seed_uuid('tier:storehouse:1'), 'active', 0);
    for v_i in 1..v_long loop
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':longhouse:' || v_i), v_sid, pg_temp.seed_uuid('bp:longhouse'), pg_temp.seed_uuid('tier:longhouse:1'), 'active', 0);
    end loop;
    if r.tier <> 'isle' then
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':smithy'), v_sid, pg_temp.seed_uuid('bp:smithy'), pg_temp.seed_uuid('tier:smithy:1'), 'active', 0);
    end if;
    if r.tier = 'capital' then
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':school'), v_sid, pg_temp.seed_uuid('bp:school'), pg_temp.seed_uuid('tier:school:1'), 'active', 0);
    end if;

    -- Craft/production/civic buildings by tier (each just needs one instance).
    foreach b in array v_core_bp loop
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':' || b), v_sid, pg_temp.seed_uuid('bp:' || b), pg_temp.seed_uuid('tier:' || b || ':1'), 'active', 0);
    end loop;
    if r.tier <> 'isle' then
      foreach b in array v_city_bp loop
        insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
        values (pg_temp.seed_uuid('building:' || r.key || ':' || b), v_sid, pg_temp.seed_uuid('bp:' || b), pg_temp.seed_uuid('tier:' || b || ':1'), 'active', 0);
      end loop;
    end if;
    if r.tier = 'capital' then
      foreach b in array v_cap_bp loop
        insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
        values (pg_temp.seed_uuid('building:' || r.key || ':' || b), v_sid, pg_temp.seed_uuid('bp:' || b), pg_temp.seed_uuid('tier:' || b || ':1'), 'active', 0);
      end loop;
    end if;

    -- Deposits: core everywhere; metal veins in cities+capitals; precious in capitals.
    foreach d in array (case when r.tier = 'isle' then v_core_dep
                             when r.tier = 'capital' then v_core_dep || v_city_dep || v_cap_dep
                             else v_core_dep || v_city_dep end) loop
      v_res := case d
        when 'hardwood-grove' then 'hardwood-logs' when 'stone-quarry' then 'stone'
        when 'clay-pit' then 'clay' when 'sand-pit' then 'sand' when 'coal-seam' then 'coal'
        when 'salt-flat' then 'sea-salt' when 'iron-vein' then 'iron-ore'
        when 'copper-vein' then 'copper-ore' when 'tin-vein' then 'tin-ore'
        when 'gold-vein' then 'gold-ore' when 'silver-vein' then 'silver-ore' else 'stone' end;
      insert into public.deposit_instances (id, settlement_id, deposit_type_id, name, status, max_workers)
      values (pg_temp.seed_uuid('depinst:' || r.key || ':' || d), v_sid, pg_temp.seed_uuid('deposit:' || d), r.name || ' ' || initcap(replace(d, '-', ' ')), 'active', 8);
      insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
      values (pg_temp.seed_uuid('depinst:' || r.key || ':' || d), pg_temp.seed_uuid('resource:' || v_res), 6000, 6000);
    end loop;

    -- Managed populations: core herds everywhere; pigs & bees at larger settlements.
    foreach p in array (case when v_pop >= 50 then v_core_pop || v_big_pop else v_core_pop end) loop
      v_cull := case p when 'bee-colony' then 0 else greatest(4, (v_pop / 12)) end;
      insert into public.managed_population_instances (id, settlement_id, managed_population_type_id, name, current_count, configured_cull_quantity, status)
      values (pg_temp.seed_uuid('popinst:' || r.key || ':' || p), v_sid, pg_temp.seed_uuid('pop:' || p),
              r.name || ' ' || initcap(replace(p, '-', ' ')), greatest(40, v_pop), v_cull, 'active');
    end loop;

    -- Starting stockpiles: food/water buffer + raw materials and intermediates
    -- so every chain has something to start converting.
    update public.settlement_resource_stockpiles s set quantity = v.qty
    from public.resources res,
      (values
        ('food', v_pop * 4), ('fresh-water', v_pop * 4), ('grain', v_pop * 2), ('rice', v_pop),
        ('hardwood-logs', 500), ('stone-block', 500), ('softwood-logs', 200), ('stone', 200),
        ('iron-ore', 150), ('copper-ore', 150), ('tin-ore', 150), ('coal', 200), ('clay', 200), ('sand', 200),
        ('iron-ingot', 80), ('copper-ingot', 80), ('tin-ingot', 80), ('bronze', 40), ('steel', 40),
        ('hides', 120), ('wool', 150), ('milk', 80), ('eggs', 80), ('flax', 100), ('flour', 80),
        ('leather', 60), ('wool-cloth', 40), ('linen-cloth', 40), ('planks', 120), ('charcoal', 80),
        ('ale', 40), ('cheese', 40), ('bread', 60), ('pottery', 40), ('tools', 40),
        ('salted-pork', 80), ('smoked-mutton', 60), ('honey', 60), ('sea-salt', 80), ('peat', 80)
      ) as v(slug, qty)
    where res.world_id = pg_temp.seed_uuid('world:bovold') and res.slug = v.slug
      and s.resource_id = res.id and s.settlement_id = v_sid;
  end loop;
end$$;

-- In-progress construction: a library rising at each capital (varied progress).
insert into public.construction_projects (id, settlement_id, building_blueprint_id, target_tier_id, status, queue_position, progress_worker_turns)
select pg_temp.seed_uuid('construction:' || key), pg_temp.seed_uuid('settlement:' || key),
       pg_temp.seed_uuid('bp:watchtower'), pg_temp.seed_uuid('tier:watchtower:1'), 'in_progress', 1,
       (row_number() over (order by key))::int
from tmp_setts where tier = 'capital';

-- ---------------------------------------------------------------------------
-- 11. Citizens. (a) Player characters, all resident in the City of Bovold and
--     wired to the seeded users. (b) Notable NPCs per nation (office-holders,
--     rulers, and a long-dead founder). (c) Bulk population per settlement,
--     drawn from the culture namesets, with partnerships, children, and
--     culture/religion/education assignment.
-- ---------------------------------------------------------------------------
insert into public.citizens (
  id, world_id, settlement_id, citizen_type, given_name, surname, sex, status,
  born_on_turn_number, user_id, role_type, role_nation_id, role_settlement_id,
  nameset_id, culture_id, religion_id, education_level_id, personality_text, skills_text
) values
  (pg_temp.seed_uuid('citizen:pc:steward'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'player_character', 'Wynne', 'Hayward', 'female', 'alive', -29,
   '00000000-0000-0000-0000-000000000002', 'settlement_manager', null, pg_temp.seed_uuid('settlement:bovold'),
   pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:scholar'),
   'Pragmatic steward who keeps the counting-halls of Bovold turning over.', 'Logistics, harbor law, town-square diplomacy.'),
  (pg_temp.seed_uuid('citizen:pc:envoy'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'player_character', 'Aldous', 'Pennington', 'male', 'alive', -37,
   '00000000-0000-0000-0000-000000000003', 'nation_manager', pg_temp.seed_uuid('nation:bovold'), null,
   pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:sage'),
   'Career envoy of the Free City; reads every charter twice and every neighbor thrice.', 'Statecraft, ledger work, courtly debate.'),
  (pg_temp.seed_uuid('citizen:pc:warden'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'player_character', 'Kestrel', 'Crane', 'female', 'alive', -23,
   '00000000-0000-0000-0000-000000000001', 'none', null, null,
   pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:lettered'),
   'Wandering surveyor with no formal portfolio.', 'Cartography, surveying, quiet listening.'),
  (pg_temp.seed_uuid('citizen:pc:freeman'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'player_character', 'Osric', 'Fenwick', 'male', 'alive', -26,
   '00000000-0000-0000-0000-000000000005', 'none', null, null,
   pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), null,
   'Bovold freeman content to trade, gossip, and mind his stall.', 'Bartering, dockwork, dice.');

-- Notable NPCs (office-holders, rulers). role_type 'none' — offices are held
-- via nation_offices, not the manager role_type. Resident in each capital.
insert into public.citizens (
  id, world_id, settlement_id, citizen_type, given_name, surname, sex, status,
  born_on_turn_number, nameset_id, culture_id, religion_id, education_level_id,
  npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw
) values
  (pg_temp.seed_uuid('citizen:notable:bovold-mayor'),   pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'),  'npc', 'Bertram', 'Underhill', 'male',   'alive', -52, pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:sage'),    'shrewd','patient','owes a debt to the drowned','a seat on the council','pride'),
  (pg_temp.seed_uuid('citizen:notable:bovold-council1'),pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'),  'npc', 'Elsbeth', 'Weaverson','female', 'alive', -48, pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:scholar'), 'wary','generous','keeps a portrait they never named','to restore the family name','envy'),
  (pg_temp.seed_uuid('citizen:notable:bovold-council2'),pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'),  'npc', 'Cedric', 'Pennington','male',  'alive', -45, pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:scholar'), 'boisterous','shrewd','loves their rival','to outlive every captain','a need to be the cleverest voice'),
  (pg_temp.seed_uuid('citizen:notable:bovold-warden'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'),  'npc', 'Merek', 'Redfern',  'male',   'alive', -40, pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:lettered'),'stoic','watchful','hides a wound that should have killed them','to die at home and not on the road','miserliness at home'),
  (pg_temp.seed_uuid('citizen:notable:bovold-treasurer'),      pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'),  'npc', 'Osmund', 'Coinwright', 'male',   'alive', -50, pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:scholar'), 'meticulous','wary','skims a hair off every tally and calls it his fee','to balance the Great Counting-Hall''s books to the last coin','miserliness at home'),
  (pg_temp.seed_uuid('citizen:notable:bovold-bank-governor'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'),  'npc', 'Ysolde', 'Marchbanks', 'female', 'alive', -46, pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:sage'),    'shrewd','patient','trusts the Drake''s gold backing more than she trusts the Council','to see the Bovold Drake outlast every fiat coin in Akavir','pride'),
  (pg_temp.seed_uuid('citizen:notable:bovold-senator'),        pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'),  'npc', 'Tamsin', 'Rookwood',   'female', 'alive', -42, pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), pg_temp.seed_uuid('edu:lettered'),'boisterous','generous','owes her council seat to a debt she never repaid','a seat on the council','envy'),
  (pg_temp.seed_uuid('citizen:notable:tsaesci-potentate'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:coilgold'), 'npc', 'Versidue', 'Shaie',   'male',   'alive', -220, pg_temp.seed_uuid('nameset:2'), pg_temp.seed_uuid('culture:tsaesci'), pg_temp.seed_uuid('religion:tsaesci'), pg_temp.seed_uuid('edu:sage'), 'cunning','patient','mourns a rival they devoured','to outlive every emperor','certainty they alone hold the line'),
  (pg_temp.seed_uuid('citizen:notable:tsaesci-vizier'),    pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:coilgold'), 'npc', 'Savirien', 'Chorak', 'female', 'alive', -140, pg_temp.seed_uuid('nameset:2'), pg_temp.seed_uuid('culture:tsaesci'), pg_temp.seed_uuid('religion:tsaesci'), pg_temp.seed_uuid('edu:scholar'), 'shrewd','venomous','serves a god they doubt','a seat on the council','envy'),
  (pg_temp.seed_uuid('citizen:notable:tangmo-speaker'),    pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:motang'),   'npc', 'Ubu', 'Mo',        'male',   'alive', -44, pg_temp.seed_uuid('nameset:3'), pg_temp.seed_uuid('culture:tangmo'), pg_temp.seed_uuid('religion:tangmo'), pg_temp.seed_uuid('edu:lettered'), 'generous','boisterous','shelters an enemy of the state','to see the long thaw end','a temper that surfaces in ritual'),
  (pg_temp.seed_uuid('citizen:notable:tangmo-warchief'),   pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:motang'),   'npc', 'Mad', 'Pemba',     'female', 'alive', -38, pg_temp.seed_uuid('nameset:3'), pg_temp.seed_uuid('culture:tangmo'), pg_temp.seed_uuid('religion:tangmo'), null, 'fierce','boisterous','owes a debt to the drowned','to outlive every captain','a hunger they cannot name'),
  (pg_temp.seed_uuid('citizen:notable:kapotun-emperor'),   pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:potun'),    'npc', 'Tosh', 'Raka',      'male',   'alive', -96, pg_temp.seed_uuid('nameset:4'), pg_temp.seed_uuid('culture:kapotun'), pg_temp.seed_uuid('religion:kapotun'), pg_temp.seed_uuid('edu:sage'), 'devout','fierce','prays toward a silent dragon','to ascend into a dragon','pride'),
  (pg_temp.seed_uuid('citizen:notable:kapotun-abbot'),     pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:potun'),    'npc', 'Rha', 'Tun',       'female', 'alive', -72, pg_temp.seed_uuid('nameset:4'), pg_temp.seed_uuid('culture:kapotun'), pg_temp.seed_uuid('religion:kapotun'), pg_temp.seed_uuid('edu:scholar'), 'ascetic','reverent','serves a god they doubt','to read the burned sutra','reads every silence as betrayal');

-- A long-dead founder of Bovold, with a recorded cause of death.
insert into public.citizens (
  id, world_id, settlement_id, citizen_type, given_name, surname, sex, status,
  born_on_turn_number, death_cause, death_cause_category, nameset_id, culture_id, religion_id,
  npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw
) values
  (pg_temp.seed_uuid('citizen:notable:bovold-founder'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'npc', 'Godwin', 'Ashford', 'male', 'dead', -80,
   'Died peacefully in the first winter after the charter was signed.', 'unknown'::public.death_cause_category,
   pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'),
   'weary','patient','keeps a portrait they never named','to die at home and not on the road','an inability to forgive the dead');

-- Bulk population per settlement, drawn from the culture namesets.
do $$
declare
  v_world constant uuid := pg_temp.seed_uuid('world:bovold');
  v_traits text[] := array['watchful','shrewd','devout','proud','patient','fierce','cunning','stoic','boisterous','reverent','venomous','ascetic','generous','wary','ambitious'];
  v_contra text[] := array['mourns a rival they devoured','serves a god they doubt','shelters an enemy of the state','keeps a shed skin they never named','holds a vow older than their memory','owes a debt to the drowned','hides a wound that should have killed them','prays toward a silent dragon'];
  v_goals  text[] := array['a seat on the council','to restore the family name','to walk the sunlit road once more','to read the burned sutra','to outlive every emperor','to raise a child of the lower ward','to see the long thaw end','to die at home and not on the road','to repay the salt-lenders of the harbor','to ascend into a dragon'];
  v_flaws  text[] := array['pride','envy','a hunger they cannot name','a quiet vice','an inability to forgive the dead','a temper that surfaces in ritual','a need to be the cleverest voice','miserliness at home','reads every silence as betrayal','certainty they alone hold the line'];
  r record;
  v_male text[]; v_female text[]; v_surn text[];
  v_nm int; v_nf int; v_ns int; v_nt int; v_nc int; v_ng int; v_nl int;
  v_nameset uuid; v_culture uuid; v_religion uuid;
  v_seq bigint := 0;
  c int;
  v_surname text; v_conv text;
  v_male_id uuid; v_female_id uuid; v_child_id uuid;
  v_gp_male_id uuid; v_gp_female_id uuid;
  v_spouse_id uuid; v_gc_id uuid;
  v_mborn int; v_fborn int; v_child_born int;
  v_edu uuid;
  v_extends boolean;
begin
  v_nt := array_length(v_traits,1); v_nc := array_length(v_contra,1);
  v_ng := array_length(v_goals,1);  v_nl := array_length(v_flaws,1);

  for r in select * from tmp_setts order by key loop
    select male, female, surnames into v_male, v_female, v_surn from tmp_pools where culture = r.culture;
    v_nm := array_length(v_male,1); v_nf := array_length(v_female,1); v_ns := array_length(v_surn,1);
    v_nameset  := pg_temp.seed_uuid('nameset:' || r.culture);
    v_culture  := pg_temp.seed_uuid('culture:'  || case r.culture when 1 then 'bovold' when 2 then 'tsaesci' when 3 then 'tangmo' else 'kapotun' end);
    v_religion := pg_temp.seed_uuid('religion:' || case r.culture when 1 then 'bovold' when 2 then 'tsaesci' when 3 then 'tangmo' else 'kapotun' end);
    v_conv := case r.culture when 3 then 'none' else 'family' end;

    for c in 1..r.couples loop
      v_surname := case when v_conv = 'none' then null else v_surn[1 + (v_seq % v_ns)] end;
      v_mborn := -(20 + ((v_seq * 5) % 45));
      v_fborn := -(18 + ((v_seq * 7) % 42));

      -- education: most untaught (null); some lettered/scholar/sage
      v_edu := case
        when v_seq % 41 = 0 then pg_temp.seed_uuid('edu:sage')
        when v_seq % 8 = 0 then pg_temp.seed_uuid('edu:scholar')
        when v_seq % 3 = 0 then pg_temp.seed_uuid('edu:lettered')
        else null end;

      -- Grandparents: 1/3 of founding couples get a traced paternal side,
      -- born well before the couple so the couple's own children inherit a
      -- grandparent link. Deterministic on c, no RNG.
      v_gp_male_id := null; v_gp_female_id := null;
      if c % 3 = 0 then
        v_seq := v_seq + 1;
        v_gp_male_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
        insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, npc_trait_1, npc_goal)
        values (v_gp_male_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc', v_male[1 + ((v_seq+6) % v_nm)], v_surname, 'male', 'alive',
                v_mborn - (30 + (v_seq % 20)), v_nameset, v_culture, v_religion,
                v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);

        v_seq := v_seq + 1;
        v_gp_female_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
        insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, npc_trait_1, npc_goal)
        values (v_gp_female_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc', v_female[1 + ((v_seq*3) % v_nf)], v_surname, 'female', 'alive',
                v_fborn - (28 + (v_seq % 20)), v_nameset, v_culture, v_religion,
                v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);

        insert into public.partnerships (citizen_a_id, citizen_b_id, status, formed_on_turn_number)
        values (v_gp_male_id, v_gp_female_id, 'active', least(v_mborn, v_fborn) - 26);
      end if;

      v_seq := v_seq + 1;
      v_male_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
      insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, education_level_id, parent_a_citizen_id, parent_b_citizen_id, npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw)
      values (v_male_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc', v_male[1 + (v_seq % v_nm)], v_surname, 'male', 'alive', v_mborn, v_nameset, v_culture, v_religion, v_edu,
              v_gp_male_id, v_gp_female_id,
              v_traits[1+(v_seq % v_nt)], v_traits[1+((v_seq+5) % v_nt)], v_contra[1+(v_seq % v_nc)], v_goals[1+(v_seq % v_ng)], v_flaws[1+(v_seq % v_nl)]);

      v_seq := v_seq + 1;
      v_female_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
      insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw)
      values (v_female_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc', v_female[1 + ((v_seq*3) % v_nf)], v_surname, 'female', 'alive', v_fborn, v_nameset, v_culture, v_religion,
              v_traits[1+(v_seq % v_nt)], v_traits[1+((v_seq+7) % v_nt)], v_contra[1+(v_seq % v_nc)], v_goals[1+(v_seq % v_ng)], v_flaws[1+(v_seq % v_nl)]);

      insert into public.partnerships (citizen_a_id, citizen_b_id, status, formed_on_turn_number)
      values (v_male_id, v_female_id, 'active', greatest(v_mborn, v_fborn) + 18);

      if c <= r.children then
        -- Every 6th child-bearing couple extends a 3rd generation: their
        -- child is grown (an adult, not an infant) and partners to have a
        -- grandchild of the founding couple. Otherwise the child is young,
        -- as before.
        v_extends := (c % 6 = 0);
        v_child_born := case when v_extends then -(18 + (v_seq % 20)) else -(1 + (c % 12)) end;

        v_seq := v_seq + 1;
        v_child_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
        insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, parent_a_citizen_id, parent_b_citizen_id, npc_trait_1, npc_goal)
        values (v_child_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc',
                case when c % 2 = 0 then v_male[1 + ((v_seq+4) % v_nm)] else v_female[1 + ((v_seq+2) % v_nf)] end,
                v_surname,
                case when c % 2 = 0 then 'male' else 'female' end,
                'alive', v_child_born, v_nameset, v_culture, v_religion, v_male_id, v_female_id,
                v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);

        if v_extends then
          v_seq := v_seq + 1;
          v_spouse_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
          insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, npc_trait_1, npc_goal)
          values (v_spouse_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc',
                  case when c % 2 = 0 then v_female[1 + ((v_seq*3) % v_nf)] else v_male[1 + ((v_seq+8) % v_nm)] end,
                  v_surn[1 + ((v_seq+1) % v_ns)],
                  case when c % 2 = 0 then 'female' else 'male' end,
                  'alive', v_child_born - 2, v_nameset, v_culture, v_religion,
                  v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);

          insert into public.partnerships (citizen_a_id, citizen_b_id, status, formed_on_turn_number)
          values (v_child_id, v_spouse_id, 'active', greatest(v_child_born, v_child_born - 2) + 18);

          v_seq := v_seq + 1;
          v_gc_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
          insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, parent_a_citizen_id, parent_b_citizen_id, npc_trait_1, npc_goal)
          values (v_gc_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc',
                  case when c % 2 = 0 then v_male[1 + ((v_seq+9) % v_nm)] else v_female[1 + ((v_seq+11) % v_nf)] end,
                  v_surname,
                  case when c % 2 = 0 then 'male' else 'female' end,
                  'alive', -(1 + (v_seq % 12)), v_nameset, v_culture, v_religion, v_child_id, v_spouse_id,
                  v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);
        elsif c % 4 = 1 then
          -- A second, younger child for couples not chosen to extend a 3rd
          -- generation, so litter size isn't capped at one.
          v_seq := v_seq + 1;
          v_child_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
          insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, parent_a_citizen_id, parent_b_citizen_id, npc_trait_1, npc_goal)
          values (v_child_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc',
                  case when c % 2 = 0 then v_female[1 + ((v_seq+2) % v_nf)] else v_male[1 + ((v_seq+4) % v_nm)] end,
                  v_surname,
                  case when c % 2 = 0 then 'female' else 'male' end,
                  'alive', -(1 + ((c + v_seq) % 12)), v_nameset, v_culture, v_religion, v_male_id, v_female_id,
                  v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);
        end if;
      end if;
    end loop;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 12. Government: office types, appointed offices, government bodies; law
--     documents with articles / versions / a passed amendment + votes; decrees.
--     Mostly nation-scoped, plus a settlement-scoped body/document/decrees
--     for the City of Bovold (#1326).
-- ---------------------------------------------------------------------------
insert into public.office_types (id, world_id, nation_id, name, description, scope, max_holders, excludes_from_labor) values
  (pg_temp.seed_uuid('office:bovold:mayor'),      pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'Lord-Mayor',    'Elected head of the Free City and its Council.', 'nation',     1,    true),
  (pg_temp.seed_uuid('office:bovold:council'),    pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'Council Member','Elected guild representative on the City Council.', 'nation',   null, true),
  (pg_temp.seed_uuid('office:bovold:warden'),     pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'Harbor-Warden', 'Keeper of the harbor, tariffs and the sea-wall.', 'settlement', 1,   true),
  (pg_temp.seed_uuid('office:tsaesci:potentate'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'Potentate',     'Ageless regent and chief communicant of the serpent empire.', 'nation', 1, true),
  (pg_temp.seed_uuid('office:tsaesci:vizier'),    pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'Court Vizier',  'Immortal schemer of the Scaled Court.', 'nation', null, true),
  (pg_temp.seed_uuid('office:tangmo:speaker'),    pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'),  'Isle-Speaker',  'Chosen voice of an isle at the great Moot.', 'nation', null, true),
  (pg_temp.seed_uuid('office:tangmo:warchief'),   pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'),  'War-Chief',     'Raised only when raiders come, stood down when they leave.', 'nation', 1, true),
  (pg_temp.seed_uuid('office:kapotun:emperor'),   pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'Dragon-Emperor','Living god and supreme abbot of the ascension.', 'nation', 1, true),
  (pg_temp.seed_uuid('office:kapotun:abbot'),     pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'Dragon-Abbot',  'High priest of a great ascension-cloister.', 'nation', null, true);

insert into public.nation_offices (id, world_id, nation_id, settlement_id, office_type_id, citizen_id, appointed_turn_number) values
  (pg_temp.seed_uuid('appt:bovold:mayor'),    pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  null, pg_temp.seed_uuid('office:bovold:mayor'),      pg_temp.seed_uuid('citizen:notable:bovold-mayor'),    0),
  (pg_temp.seed_uuid('appt:bovold:council1'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  null, pg_temp.seed_uuid('office:bovold:council'),    pg_temp.seed_uuid('citizen:notable:bovold-council1'), 0),
  (pg_temp.seed_uuid('appt:bovold:council2'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  null, pg_temp.seed_uuid('office:bovold:council'),    pg_temp.seed_uuid('citizen:notable:bovold-council2'), 0),
  (pg_temp.seed_uuid('appt:bovold:warden'),   pg_temp.seed_uuid('world:bovold'), null, pg_temp.seed_uuid('settlement:bovold'), pg_temp.seed_uuid('office:bovold:warden'),     pg_temp.seed_uuid('citizen:notable:bovold-warden'),   0),
  -- World-default office types (senator/treasurer/bank_governor) have no stable seed_uuid
  -- (they are created by the worlds_seed_default_office_types trigger), so look them up by name.
  (pg_temp.seed_uuid('appt:bovold:treasurer'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), null,
   (select id from public.office_types where world_id = pg_temp.seed_uuid('world:bovold') and nation_id is null and name = 'treasurer'),
   pg_temp.seed_uuid('citizen:notable:bovold-treasurer'), 0),
  (pg_temp.seed_uuid('appt:bovold:bank-governor'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), null,
   (select id from public.office_types where world_id = pg_temp.seed_uuid('world:bovold') and nation_id is null and name = 'bank_governor'),
   pg_temp.seed_uuid('citizen:notable:bovold-bank-governor'), 0),
  (pg_temp.seed_uuid('appt:bovold:senator'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), null,
   (select id from public.office_types where world_id = pg_temp.seed_uuid('world:bovold') and nation_id is null and name = 'senator'),
   pg_temp.seed_uuid('citizen:notable:bovold-senator'), 0),
  (pg_temp.seed_uuid('appt:tsaesci:potentate'),pg_temp.seed_uuid('world:bovold'),pg_temp.seed_uuid('nation:tsaesci'), null, pg_temp.seed_uuid('office:tsaesci:potentate'), pg_temp.seed_uuid('citizen:notable:tsaesci-potentate'),0),
  (pg_temp.seed_uuid('appt:tsaesci:vizier'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), null, pg_temp.seed_uuid('office:tsaesci:vizier'),    pg_temp.seed_uuid('citizen:notable:tsaesci-vizier'),  0),
  (pg_temp.seed_uuid('appt:tangmo:speaker'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'),  null, pg_temp.seed_uuid('office:tangmo:speaker'),    pg_temp.seed_uuid('citizen:notable:tangmo-speaker'),  0),
  (pg_temp.seed_uuid('appt:tangmo:warchief'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'),  null, pg_temp.seed_uuid('office:tangmo:warchief'),   pg_temp.seed_uuid('citizen:notable:tangmo-warchief'), 0),
  (pg_temp.seed_uuid('appt:kapotun:emperor'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), null, pg_temp.seed_uuid('office:kapotun:emperor'),   pg_temp.seed_uuid('citizen:notable:kapotun-emperor'), 0),
  (pg_temp.seed_uuid('appt:kapotun:abbot'),   pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), null, pg_temp.seed_uuid('office:kapotun:abbot'),     pg_temp.seed_uuid('citizen:notable:kapotun-abbot'),   0);

insert into public.government_bodies (id, world_id, nation_id, name, description, composition_json) values
  (pg_temp.seed_uuid('body:bovold'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), 'Bovold City Council',
    'The elected guild-council that governs the Free City and ratifies its charter.',
    jsonb_build_array(
      jsonb_build_object('kind','office_type','office_type_id', pg_temp.seed_uuid('office:bovold:mayor')::text),
      jsonb_build_object('kind','office_type','office_type_id', pg_temp.seed_uuid('office:bovold:council')::text))),
  (pg_temp.seed_uuid('body:tsaesci'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'The Serpent Court',
    'The immortal court of the Potentate and the viziers of the Scaled Court.',
    jsonb_build_array(
      jsonb_build_object('kind','ruler'),
      jsonb_build_object('kind','office_type','office_type_id', pg_temp.seed_uuid('office:tsaesci:vizier')::text))),
  (pg_temp.seed_uuid('body:tangmo'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'), 'The Isle-Moot',
    'The loud assembly of isle-speakers that binds the thousand isles.',
    jsonb_build_array(
      jsonb_build_object('kind','office_type','office_type_id', pg_temp.seed_uuid('office:tangmo:speaker')::text),
      jsonb_build_object('kind','settlement_managers'))),
  (pg_temp.seed_uuid('body:kapotun'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'The Dragon Synod',
    'The god-emperor and the dragon-abbots who rule doctrine and ascension.',
    jsonb_build_array(
      jsonb_build_object('kind','ruler'),
      jsonb_build_object('kind','office_type','office_type_id', pg_temp.seed_uuid('office:kapotun:abbot')::text)));

insert into public.law_documents (id, world_id, nation_id, title, preamble_markdown, status, amendment_procedure_json, current_version, created_turn_number) values
  (pg_temp.seed_uuid('law:bovold'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'), 'The Charter of the Free City of Bovold',
    'Whereas coin has no nation, and the sworn word binds all peoples, the Free City ordains this Charter.', 'active',
    jsonb_build_object('kind','vote','bodyId', pg_temp.seed_uuid('body:bovold')::text, 'threshold','majority','votingPeriodTurns',3), 1, 0),
  (pg_temp.seed_uuid('law:tsaesci'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'The Edicts of the Coil',
    'By the will of the eldest coil, that the empire endure unbroken, these Edicts are set down.', 'active',
    jsonb_build_object('kind','decree','authority','ruler'), 1, 0),
  (pg_temp.seed_uuid('law:tangmo'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'), 'The Free-Isle Compact',
    'We, the many isles, being small and being many, agree these few kind rules and no more.', 'active',
    jsonb_build_object('kind','vote','bodyId', pg_temp.seed_uuid('body:tangmo')::text, 'threshold','majority','votingPeriodTurns',4), 1, 0),
  (pg_temp.seed_uuid('law:kapotun'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'The Ascension Codex',
    'As the Dragon of Time turns, so shall the tiger climb; these disciplines are the law of the climb.', 'active',
    jsonb_build_object('kind','decree','authority','ruler'), 1, 0);

insert into public.law_articles (id, document_id, article_number, heading, body_markdown, status, sort_order) values
  (pg_temp.seed_uuid('article:bovold:1'), pg_temp.seed_uuid('law:bovold'), 1, 'Of Neutrality', 'The Free City takes no side in the wars of the beast-nations and trades freely with all who keep the peace of the harbor.', 'active', 1),
  (pg_temp.seed_uuid('article:bovold:2'), pg_temp.seed_uuid('law:bovold'), 2, 'Of Sworn Contracts', 'A contract sealed in wax before witnesses binds absolutely; its breaking is the gravest civil wrong.', 'active', 2),
  (pg_temp.seed_uuid('article:bovold:3'), pg_temp.seed_uuid('law:bovold'), 3, 'Of Sanctuary', 'None who reaches the harbor gate in peace shall be enslaved or turned away.', 'active', 3),
  (pg_temp.seed_uuid('article:tsaesci:1'), pg_temp.seed_uuid('law:tsaesci'), 1, 'Of the Unbroken Coil', 'The eldest shall rule, for they hold the longest memory of the empire.', 'active', 1),
  (pg_temp.seed_uuid('article:tsaesci:2'), pg_temp.seed_uuid('law:tsaesci'), 2, 'Of the Long Feast', 'The honored dead of worth shall be given to the Communion, that their years pass to the living.', 'active', 2),
  (pg_temp.seed_uuid('article:tangmo:1'), pg_temp.seed_uuid('law:tangmo'), 1, 'Of Freedom', 'No isle-kin shall be held as a slave, nor shall any isle hold slaves.', 'active', 1),
  (pg_temp.seed_uuid('article:tangmo:2'), pg_temp.seed_uuid('law:tangmo'), 2, 'Of Mutual Defense', 'When raiders strike one isle, the nearest isles shall come to its aid.', 'active', 2),
  (pg_temp.seed_uuid('article:kapotun:1'), pg_temp.seed_uuid('law:kapotun'), 1, 'Of the Climb', 'Every tiger of the Confederacy shall keep the breath-disciplines and strive toward the Dragon.', 'active', 1),
  (pg_temp.seed_uuid('article:kapotun:2'), pg_temp.seed_uuid('law:kapotun'), 2, 'Of the Serpent-War', 'No peace shall be made with the serpent-folk until the slain dragons are avenged.', 'active', 2);

insert into public.law_document_versions (id, document_id, version, articles_snapshot_json, amendment_title, enacted_turn_number) values
  (pg_temp.seed_uuid('lawver:bovold:1'), pg_temp.seed_uuid('law:bovold'), 1,
    jsonb_build_array(
      jsonb_build_object('article_number',1,'heading','Of Neutrality','body_markdown','The Free City takes no side in the wars of the beast-nations.'),
      jsonb_build_object('article_number',2,'heading','Of Sworn Contracts','body_markdown','A contract sealed in wax before witnesses binds absolutely.'),
      jsonb_build_object('article_number',3,'heading','Of Sanctuary','body_markdown','None who reaches the harbor gate in peace shall be enslaved.')),
    'Charter enacted at the founding', 0);

-- A passed amendment on the Bovold charter, ratified by the Council.
insert into public.law_amendments (id, document_id, title, rationale_markdown, operations_json, status, proposed_by_citizen_id, proposed_turn_number, resolved_turn_number, amendment_procedure_snapshot_json, enacted_version) values
  (pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('law:bovold'), 'The Sanctuary Clause',
    'To make plain that the harbor is a refuge, so that fleeing isle-folk and serpent-slaves alike are safe within our walls.',
    jsonb_build_array(jsonb_build_object('op','add_article','heading','Of Sanctuary','body_markdown','None who reaches the harbor gate in peace shall be enslaved or turned away.','position',3)),
    'passed', pg_temp.seed_uuid('citizen:notable:bovold-council1'), 0, 0,
    jsonb_build_object('kind','vote','bodyId', pg_temp.seed_uuid('body:bovold')::text, 'threshold','majority','votingPeriodTurns',3), 1);

insert into public.law_amendment_votes (id, amendment_id, voter_citizen_id, vote) values
  (pg_temp.seed_uuid('vote:sanctuary:mayor'),    pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('citizen:notable:bovold-mayor'),    true),
  (pg_temp.seed_uuid('vote:sanctuary:council1'), pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('citizen:notable:bovold-council1'), true),
  (pg_temp.seed_uuid('vote:sanctuary:council2'), pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('citizen:notable:bovold-council2'), false);

-- A passed amendment on each of the other three nations' charters.
insert into public.law_amendments (id, document_id, title, rationale_markdown, operations_json, status, proposed_by_citizen_id, proposed_turn_number, resolved_turn_number, amendment_procedure_snapshot_json, enacted_version) values
  (pg_temp.seed_uuid('amendment:tsaesci:servitude'), pg_temp.seed_uuid('law:tsaesci'), 'The Edict of Bound Servitude',
    'That the larder-peoples be counted as property of the eldest coil, in law as in the Communion.',
    jsonb_build_array(jsonb_build_object('op','add_article','heading','Of the Larder','body_markdown','The short-lived peoples are property of the coil that holds them, to be fed, worked, or Feasted upon as the elders decree.','position',3)),
    'passed', pg_temp.seed_uuid('citizen:notable:tsaesci-potentate'), 0, 0,
    jsonb_build_object('kind','decree','authority','ruler'), 1),
  (pg_temp.seed_uuid('amendment:tangmo:freewind'), pg_temp.seed_uuid('law:tangmo'), 'The Free-Wind Clause',
    'That no isle may bind another to its will, for the isles are many and free.',
    jsonb_build_array(jsonb_build_object('op','add_article','heading','Of Free Isles','body_markdown','No isle shall command another; each keeps its own council and comes to the Moot as an equal.','position',3)),
    'passed', pg_temp.seed_uuid('citizen:notable:tangmo-speaker'), 0, 0,
    jsonb_build_object('kind','vote','bodyId', pg_temp.seed_uuid('body:tangmo')::text, 'threshold','majority','votingPeriodTurns',4), 1),
  (pg_temp.seed_uuid('amendment:kapotun:vigil'), pg_temp.seed_uuid('law:kapotun'), 'The Ninefold Vigil',
    'That every cloister keep the Nine Roars, lest the climb toward the Dragon falter in any valley.',
    jsonb_build_array(jsonb_build_object('op','add_article','heading','Of the Vigil','body_markdown','Every cloister shall keep the Nine Roars and the dawn-salute without fail, on pain of losing its ascension-rank.','position',3)),
    'passed', pg_temp.seed_uuid('citizen:notable:kapotun-abbot'), 0, 0,
    jsonb_build_object('kind','decree','authority','ruler'), 1);

insert into public.law_amendment_votes (id, amendment_id, voter_citizen_id, vote) values
  (pg_temp.seed_uuid('vote:servitude:potentate'), pg_temp.seed_uuid('amendment:tsaesci:servitude'), pg_temp.seed_uuid('citizen:notable:tsaesci-potentate'), true),
  (pg_temp.seed_uuid('vote:servitude:vizier'),    pg_temp.seed_uuid('amendment:tsaesci:servitude'), pg_temp.seed_uuid('citizen:notable:tsaesci-vizier'),    true),
  (pg_temp.seed_uuid('vote:freewind:speaker'),    pg_temp.seed_uuid('amendment:tangmo:freewind'),   pg_temp.seed_uuid('citizen:notable:tangmo-speaker'),   true),
  (pg_temp.seed_uuid('vote:freewind:warchief'),   pg_temp.seed_uuid('amendment:tangmo:freewind'),   pg_temp.seed_uuid('citizen:notable:tangmo-warchief'),  true),
  (pg_temp.seed_uuid('vote:vigil:emperor'),       pg_temp.seed_uuid('amendment:kapotun:vigil'),     pg_temp.seed_uuid('citizen:notable:kapotun-emperor'),  true),
  (pg_temp.seed_uuid('vote:vigil:abbot'),         pg_temp.seed_uuid('amendment:kapotun:vigil'),     pg_temp.seed_uuid('citizen:notable:kapotun-abbot'),    true);

insert into public.decrees (id, world_id, nation_id, title, body_markdown, issued_by_citizen_id, issued_turn_number) values
  (pg_temp.seed_uuid('decree:bovold:tariff'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'The Harbor Tariff', 'A modest tariff is laid on all goods crossing the sea-wall, that the harbor and its lighthouse be kept.', pg_temp.seed_uuid('citizen:notable:bovold-mayor'), 0),
  (pg_temp.seed_uuid('decree:tsaesci:feast'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'Edict of the Long Feast', 'The Potentate ordains a Long Feast at the turning of the sun, that the worthy dead endure in the living.', pg_temp.seed_uuid('citizen:notable:tsaesci-potentate'), 0),
  (pg_temp.seed_uuid('decree:tangmo:defense'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'), 'The Lantern-Watch', 'Each isle shall keep a lantern lit against the summer thaw, and raise the drum if the snow-demons come.', pg_temp.seed_uuid('citizen:notable:tangmo-speaker'), 0),
  (pg_temp.seed_uuid('decree:kapotun:rite'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'The Rite of Ascension', 'Every cloister shall keep the Nine Roars and the dawn-salute, that the climb toward the Dragon never falter.', pg_temp.seed_uuid('citizen:notable:kapotun-emperor'), 0);

-- Settlement-scoped government data for the City of Bovold: a harbor body,
-- a settlement law book with articles + version, and two decrees, so the
-- settlement Government page has real data alongside the nation-scoped rows
-- above (#1326).
insert into public.government_bodies (id, world_id, settlement_id, name, description, composition_json) values
  (pg_temp.seed_uuid('body:bovold-settlement'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'Harbor Wardens'' Watch',
    'The settlement-level council that keeps the harbor, the sea-wall, and the city''s day-to-day peace.',
    jsonb_build_array(
      jsonb_build_object('kind','ruler'),
      jsonb_build_object('kind','office_type','office_type_id', pg_temp.seed_uuid('office:bovold:warden')::text)));

insert into public.law_documents (id, world_id, settlement_id, title, preamble_markdown, status, amendment_procedure_json, current_version, created_turn_number) values
  (pg_temp.seed_uuid('law:bovold-settlement'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'The Harbor Bylaws of Bovold',
    'That the quay stay orderly and the sea-wall stand, the Steward and the Harbor-Warden set down these bylaws for the city alone.', 'active',
    jsonb_build_object('kind','decree','authority','ruler'), 1, 0);

insert into public.law_articles (id, document_id, article_number, heading, body_markdown, status, sort_order) values
  (pg_temp.seed_uuid('article:bovold-settlement:1'), pg_temp.seed_uuid('law:bovold-settlement'), 1, 'Of the Quay', 'No vessel may moor at the quay past curfew bell without the Harbor-Warden''s leave.', 'active', 1),
  (pg_temp.seed_uuid('article:bovold-settlement:2'), pg_temp.seed_uuid('law:bovold-settlement'), 2, 'Of the Sea-Wall Levy', 'Every household within the walls owes a day''s labor each season toward the sea-wall''s upkeep.', 'active', 2);

insert into public.law_document_versions (id, document_id, version, articles_snapshot_json, amendment_title, enacted_turn_number) values
  (pg_temp.seed_uuid('lawver:bovold-settlement:1'), pg_temp.seed_uuid('law:bovold-settlement'), 1,
    jsonb_build_array(
      jsonb_build_object('article_number',1,'heading','Of the Quay','body_markdown','No vessel may moor at the quay past curfew bell without the Harbor-Warden''s leave.'),
      jsonb_build_object('article_number',2,'heading','Of the Sea-Wall Levy','body_markdown','Every household within the walls owes a day''s labor each season toward the sea-wall''s upkeep.')),
    'Bylaws enacted at the founding', 0);

insert into public.decrees (id, world_id, settlement_id, title, body_markdown, issued_by_citizen_id, issued_turn_number) values
  (pg_temp.seed_uuid('decree:bovold-settlement:curfew'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'The Curfew Bell', 'From the ringing of the curfew bell until dawn, the quay gates are barred to all but the Watch.', pg_temp.seed_uuid('citizen:notable:bovold-warden'), 0),
  (pg_temp.seed_uuid('decree:bovold-settlement:market'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('settlement:bovold'), 'The Market Peace', 'No blade may be drawn within the bounds of the market square, on pain of the Watch''s cells.', pg_temp.seed_uuid('citizen:pc:steward'), 0);

-- Established currencies: Bovold and Ka'Po'Tun back their coin with precious
-- metal; the serpent empire and the isles run fiat currencies.
insert into public.nation_currencies (id, world_id, nation_id, name, symbol, currency_type, backing_resource_id, backing_ratio, money_supply, reserve_quantity, confidence, established_turn_number, is_in_default) values
  (pg_temp.seed_uuid('currency:bovold'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'Bovold Drake', 'Dk', 'resource_backed', pg_temp.seed_uuid('resource:gold-ingot'),   0.5, 50000,  8000, 0.90, 0, false),
  (pg_temp.seed_uuid('currency:tsaesci'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'Serpent Coil', 'Co', 'fiat',            null,                                    null, 200000, 20000, 0.75, 0, false),
  (pg_temp.seed_uuid('currency:tangmo'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'),  'Isle Shell',   'Sh', 'fiat',            null,                                    null, 30000,  5000, 0.70, 0, false),
  (pg_temp.seed_uuid('currency:kapotun'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'Dragon Scale', 'Sc', 'resource_backed', pg_temp.seed_uuid('resource:silver-ingot'), 0.4, 40000,  6000, 0.85, 0, false);

-- ---------------------------------------------------------------------------
-- 13a. Military. One army per nation, stationed at its capital, funded by the
--      host settlement. Unit types carry NO upkeep and zero desertion so the
--      standing armies never perturb the economy during the 32-turn replay.
-- ---------------------------------------------------------------------------
-- Unit types (world catalogue). No upkeep and zero desertion so the standing
-- armies never perturb the economy during the 32-turn replay.
insert into public.unit_types (id, world_id, name, description, soldiers_per_unit, recruitment_costs_json, upkeep_costs_json, desertion_rate)
select pg_temp.seed_uuid('unit:' || slug), pg_temp.seed_uuid('world:bovold'), name, descr, spu,
  jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:' || rres)::text, 'amount', ramt)),
  '[]'::jsonb, 0
from (values
  ('militia','City Militia','Guild volunteers who guard the harbor and sea-wall.',10,'iron-ore',4),
  ('pikeman','Pikeman','A hedge of long spears.',10,'bronze',4),
  ('crossbowman','Crossbowman','Steady bolt-throwers behind the wall.',8,'steel',3),
  ('serpentguard','Serpent Guard','Scaled duelists of the immortal court.',8,'bronze',6),
  ('coilblade','Coil-Blade','Immortal katana-duelists of Coil-of-Gold.',6,'steel',6),
  ('venomarcher','Venom Archer','Archers of the poisoned shaft.',8,'tin-ingot',4),
  ('skirmisher','Isle Skirmisher','Brave, reckless canopy-fighters of the isles.',12,'hardwood-logs',4),
  ('slinger','Isle Slinger','Sling-stone throwers of the high crags.',12,'stone-block',3),
  ('warcanoe','War-Canoe Crew','Fast raiders of the shallows.',10,'planks',4),
  ('tigermonk','Tiger-Monk','Breath-disciplined monk-warriors of the ascension.',8,'iron-ore',6),
  ('dragonguard','Dragon Guard','Elite guard of the god-emperor.',6,'steel',6),
  ('breathadept','Breath-Adept','Masters of the roaring disciplines.',6,'bronze',5)
) as t(slug, name, descr, spu, rres, ramt);

insert into public.armies (id, world_id, nation_id, name, funding_source, stationed_settlement_id, created_turn_number) values
  (pg_temp.seed_uuid('army:bovold'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'Bovold Harbor Watch', 'host_settlement', pg_temp.seed_uuid('settlement:bovold'),  0),
  (pg_temp.seed_uuid('army:tsaesci'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'The Coiled Legion',   'host_settlement', pg_temp.seed_uuid('settlement:coilgold'),0),
  (pg_temp.seed_uuid('army:tangmo'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'),  'The Isle Levy',       'host_settlement', pg_temp.seed_uuid('settlement:motang'),  0),
  (pg_temp.seed_uuid('army:kapotun'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'The Dragon Host',     'host_settlement', pg_temp.seed_uuid('settlement:potun'),   0);

-- Two groups per army.
insert into public.army_groups (id, army_id, name, sort_order)
select pg_temp.seed_uuid('group:' || nation || ':' || g), pg_temp.seed_uuid('army:' || nation), gname, ord
from (values
  ('bovold','van','Harbor Van',0),('bovold','rear','Sea-Wall Reserve',1),
  ('tsaesci','van','First Coil',0),('tsaesci','rear','Gilt Fangs',1),
  ('tangmo','van','Canopy Company',0),('tangmo','rear','Isle Reserve',1),
  ('kapotun','van','Ascension Fist',0),('kapotun','rear','Dragon Vigil',1)
) as t(nation, g, gname, ord);

-- Five units per army across the two groups.
insert into public.army_units (id, army_id, group_id, unit_type_id, name, sort_order, created_turn_number)
select pg_temp.seed_uuid('armyunit:' || nation || ':' || u), pg_temp.seed_uuid('army:' || nation),
       pg_temp.seed_uuid('group:' || nation || ':' || g), pg_temp.seed_uuid('unit:' || utype), uname, ord, 0
from (values
  ('bovold','u1','van','militia','Harbor Militia Cohort',0),
  ('bovold','u2','van','pikeman','Sea-Wall Pikes',1),
  ('bovold','u3','van','crossbowman','Lighthouse Crossbows',2),
  ('bovold','u4','rear','militia','Lower-Ward Levy',0),
  ('bovold','u5','rear','pikeman','Merchant Guard',1),
  ('tsaesci','u1','van','serpentguard','Gilt Fang Guard',0),
  ('tsaesci','u2','van','coilblade','Coil-of-Gold Duelists',1),
  ('tsaesci','u3','van','venomarcher','Xheenmar Archers',2),
  ('tsaesci','u4','rear','serpentguard','Scaled Court Guard',0),
  ('tsaesci','u5','rear','pikeman','Slave Levies',1),
  ('tangmo','u1','van','skirmisher','Free Palms Skirmishers',0),
  ('tangmo','u2','van','slinger','Highcanopy Slings',1),
  ('tangmo','u3','van','warcanoe','Laughing Harbor Raiders',2),
  ('tangmo','u4','rear','skirmisher','Braided-Isle Bands',0),
  ('tangmo','u5','rear','slinger','Chatter Bay Slings',1),
  ('kapotun','u1','van','tigermonk','Sunspire Monks',0),
  ('kapotun','u2','van','dragonguard','Po''Tun Dragon Guard',1),
  ('kapotun','u3','van','breathadept','Nine Roars Adepts',2),
  ('kapotun','u4','rear','tigermonk','Tigermount Monks',0),
  ('kapotun','u5','rear','breathadept','Ember Cloister Adepts',1)
) as t(nation, u, g, utype, uname, ord);

-- Recruit ~4 soldiers per unit, drawn from anywhere in the unit's nation (not
-- just the small capital) so no settlement is stripped of its labour. These
-- citizens are then excluded from the labour pool below.
do $$
declare
  au record; v_cid uuid; v_i int;
begin
  for au in
    select u.id unit_id, a.nation_id
    from public.army_units u
    join public.armies a on a.id = u.army_id
  loop
    v_i := 0;
    for v_cid in
      select c.id from public.citizens c
      join public.settlements s on s.id = c.settlement_id
      where s.nation_id = au.nation_id and c.citizen_type = 'npc' and c.status = 'alive'
        and c.born_on_turn_number <= -18 and c.id not in (select citizen_id from public.unit_soldiers)
      order by c.born_on_turn_number, c.id limit 4
    loop
      v_i := v_i + 1;
      insert into public.unit_soldiers (id, world_id, unit_id, citizen_id, home_settlement_id, recruited_turn_number)
      select pg_temp.seed_uuid('soldier:' || au.unit_id::text || ':' || v_i), pg_temp.seed_uuid('world:bovold'),
             au.unit_id, v_cid, c.settlement_id, 0
      from public.citizens c where c.id = v_cid;
    end loop;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 13b. Citizen labour assignments across all settlements. Priority: food/water
--      to (building-derived) capacity first, then grain, fishers, deposits,
--      husbandry/culling, a construction pool, teacher, then ale/cloth chains.
--      Excludes player characters, office-holders and soldiers.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_ids uuid[]; v_n int; v_idx int;
  v_pop int; v_gran int; v_cist int; v_field_cap int; v_water_cap int;
  j int; k int;
  v_jobs uuid[]; v_cnts int[];
  dep record; pop record; b text;
  v_has_school boolean;
  -- Craft chains staffed after the essentials: core everywhere, the refining
  -- chain in cities+capitals, the luxury/steel chain in capitals.
  v_craft_core text[] := array['miller','baker','cheesemaker','tanner','cloth-weaver','carpenter','stonecutter','potter','hunter','forager'];
  v_craft_city text[] := array['iron-smelter','copper-smelter','tin-smelter','bronzesmith','steelworker','blacksmith','brewer','linen-weaver','glassblower'];
  v_craft_cap  text[] := array['gold-smelter','jeweler','weaponsmith','armorer','vintner','silk-weaver','ropemaker','charcoal-burner'];
begin
  for r in select * from tmp_setts order by key loop
    v_pop := r.couples * 2 + r.children;
    v_gran := greatest(1, ceil(v_pop / 120.0))::int;
    v_cist := greatest(1, ceil(v_pop / 120.0))::int;
    v_field_cap := 30 + 6 * v_gran;
    v_water_cap := 24 + 6 * v_cist;
    v_has_school := (r.tier = 'capital');

    v_ids := array(select id from public.citizens
                   where settlement_id = pg_temp.seed_uuid('settlement:' || r.key)
                     and citizen_type = 'npc' and status = 'alive' and born_on_turn_number <= -16
                     and id not in (select citizen_id from public.citizen_assignments)
                     and id not in (select citizen_id from public.unit_soldiers)
                     and id not in (select citizen_id from public.nation_offices)
                   order by born_on_turn_number, id);
    v_n := coalesce(array_length(v_ids,1), 0);
    v_idx := 1;

    -- ESSENTIALS FIRST. Food and water are staffed proportionally to population
    -- (~pop/5 each, floored at 6, capped at building capacity) so the loop is
    -- never starved by the many production jobs that follow. At output 8 this is
    -- a large surplus that carries growth across 32 turns.
    v_jobs := array[pg_temp.seed_uuid('job:field-hand'), pg_temp.seed_uuid('job:water-bearer'),
                    pg_temp.seed_uuid('job:grain-farmer'), pg_temp.seed_uuid('job:rice-farmer'), pg_temp.seed_uuid('job:fisher')];
    v_cnts := array[
      least(v_field_cap, greatest(6, ceil(v_pop / 5.0)::int)),
      least(v_water_cap, greatest(6, ceil(v_pop / 5.0)::int)),
      4, 3, 4];
    for j in 1..array_length(v_jobs,1) loop
      for k in 1..v_cnts[j] loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', v_jobs[j], 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;

    -- Deposits: 2 workers each (feeds the raw-material chains).
    for dep in select di.id did from public.deposit_instances di where di.settlement_id = pg_temp.seed_uuid('settlement:' || r.key) and di.status = 'active' loop
      for k in 1..2 loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'deposit', dep.did, 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;

    -- Husbandry (2) + culling (1) per managed population.
    for pop in select mpi.id mid, mpi.configured_cull_quantity cq from public.managed_population_instances mpi where mpi.settlement_id = pg_temp.seed_uuid('settlement:' || r.key) and mpi.status = 'active' loop
      for k in 1..2 loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'husbandry', pop.mid, 0);
        v_idx := v_idx + 1;
      end loop;
      if pop.cq > 0 and v_idx <= v_n then
        insert into public.citizen_assignments (citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'culling', pop.mid, 0);
        v_idx := v_idx + 1;
      end if;
    end loop;

    -- Teacher (capitals only).
    if v_has_school and v_idx <= v_n then
      insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
      values (v_ids[v_idx], 'standard_job', pg_temp.seed_uuid('job:teacher'), 0);
      v_idx := v_idx + 1;
    end if;

    -- CRAFT CHAINS. Core everywhere; refining in cities+capitals; luxury in
    -- capitals. 2 workers per core/city craft, 1 per capital craft — clamped to
    -- whatever labour remains after the essentials.
    foreach b in array v_craft_core loop
      for k in 1..2 loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', pg_temp.seed_uuid('job:' || b), 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;
    if r.tier <> 'isle' then
      foreach b in array v_craft_city loop
        for k in 1..2 loop
          exit when v_idx > v_n;
          insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
          values (v_ids[v_idx], 'standard_job', pg_temp.seed_uuid('job:' || b), 0);
          v_idx := v_idx + 1;
        end loop;
      end loop;
    end if;
    if r.tier = 'capital' then
      foreach b in array v_craft_cap loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', pg_temp.seed_uuid('job:' || b), 0);
        v_idx := v_idx + 1;
      end loop;
    end if;

    -- A construction pool with the remaining labour (traders are staffed via
    -- the trade routes below, not as standard jobs).
    for k in 1..3 loop
      exit when v_idx > v_n;
      insert into public.citizen_assignments (citizen_id, assignment_type, construction_project_id, assigned_on_turn_number)
      values (v_ids[v_idx], 'construction_project', null, 0);
      v_idx := v_idx + 1;
    end loop;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 13c. Trade routes — Bovold as the neutral hub. Three active, one proposed.
--      Worker assignments: one resident per endpoint.
-- ---------------------------------------------------------------------------
insert into public.trade_routes (id, origin_settlement_id, destination_settlement_id, status, proposed_by_citizen_id, origin_approval_status, destination_approval_status, origin_approved_by_citizen_id, destination_approved_by_citizen_id) values
  (pg_temp.seed_uuid('route:bovold-serpentreach'), pg_temp.seed_uuid('settlement:bovold'), pg_temp.seed_uuid('settlement:serpentreach'), 'active', pg_temp.seed_uuid('citizen:pc:envoy'), 'approved','approved', pg_temp.seed_uuid('citizen:notable:bovold-mayor'), pg_temp.seed_uuid('citizen:notable:tsaesci-vizier')),
  (pg_temp.seed_uuid('route:bovold-motang'),       pg_temp.seed_uuid('settlement:bovold'), pg_temp.seed_uuid('settlement:motang'),       'active', pg_temp.seed_uuid('citizen:pc:envoy'), 'approved','approved', pg_temp.seed_uuid('citizen:notable:bovold-mayor'), pg_temp.seed_uuid('citizen:notable:tangmo-speaker')),
  (pg_temp.seed_uuid('route:potun-bovold'),        pg_temp.seed_uuid('settlement:potun'),  pg_temp.seed_uuid('settlement:bovold'),        'active', pg_temp.seed_uuid('citizen:notable:kapotun-abbot'), 'approved','approved', pg_temp.seed_uuid('citizen:notable:kapotun-emperor'), pg_temp.seed_uuid('citizen:notable:bovold-mayor')),
  (pg_temp.seed_uuid('route:bovold-xheenmar'),     pg_temp.seed_uuid('settlement:bovold'), pg_temp.seed_uuid('settlement:xheenmar'),     'proposed', pg_temp.seed_uuid('citizen:pc:envoy'), 'pending','pending', null, null);

insert into public.trade_route_legs (trade_route_id, direction, resource_id, quantity_per_transition) values
  (pg_temp.seed_uuid('route:bovold-serpentreach'), 'send', pg_temp.seed_uuid('resource:linen-cloth'), 15),
  (pg_temp.seed_uuid('route:bovold-motang'),       'send', pg_temp.seed_uuid('resource:grain'),       25),
  (pg_temp.seed_uuid('route:potun-bovold'),        'send', pg_temp.seed_uuid('resource:copper-ingot'),12),
  (pg_temp.seed_uuid('route:bovold-xheenmar'),     'send', pg_temp.seed_uuid('resource:ale'),         10);

-- Trade-route worker assignments (one per endpoint; settlement must match end).
do $$
declare
  r record; v_cid uuid;
begin
  for r in select * from (values
    ('route:bovold-serpentreach','origin','settlement:bovold'),
    ('route:bovold-serpentreach','destination','settlement:serpentreach'),
    ('route:bovold-motang','origin','settlement:bovold'),
    ('route:bovold-motang','destination','settlement:motang'),
    ('route:potun-bovold','origin','settlement:potun'),
    ('route:potun-bovold','destination','settlement:bovold')
  ) as t(route, e, setkey) loop
    select id into v_cid from public.citizens
      where settlement_id = pg_temp.seed_uuid(r.setkey) and citizen_type = 'npc' and status = 'alive'
        and born_on_turn_number <= -16
        and id not in (select citizen_id from public.citizen_assignments)
        and id not in (select citizen_id from public.unit_soldiers)
      order by born_on_turn_number, id limit 1;
    if v_cid is not null then
      insert into public.citizen_assignments (citizen_id, assignment_type, job_id, trade_route_id, trade_route_end, assigned_on_turn_number)
      values (v_cid, 'trade_route', pg_temp.seed_uuid('job:caravan-trader'), pg_temp.seed_uuid(r.route), r.e, 0);
    end if;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 13d. Education enrollments — a few Untaught Bovold youths at the City school.
-- ---------------------------------------------------------------------------
insert into public.education_enrollments (id, world_id, settlement_building_id, citizen_id, target_level_id, progress_turns, enrolled_turn_number)
select pg_temp.seed_uuid('enroll:' || c.id::text), pg_temp.seed_uuid('world:bovold'),
       pg_temp.seed_uuid('building:bovold:school'), c.id, pg_temp.seed_uuid('edu:lettered'), 0, 0
from public.citizens c
where c.settlement_id = pg_temp.seed_uuid('settlement:bovold') and c.citizen_type = 'npc' and c.status = 'alive'
  and c.education_level_id is null and c.born_on_turn_number between -14 and -6
  and c.id not in (select citizen_id from public.unit_soldiers)
order by c.id limit 4;

-- ---------------------------------------------------------------------------
-- 13e. Events. Only the Dragon-Ascension Festival is active during the replay
--      (a benign +10% production boost for Ka'Po'Tun). The disaster/boon events
--      are pending for a future turn (>32) so they exist as content without
--      perturbing the seeded history. Citizen memories flavour the Long Feast.
-- ---------------------------------------------------------------------------
insert into public.event_groups (id, world_id, name, description, created_during_turn_number) values
  (pg_temp.seed_uuid('evtgrp:thaw'),     pg_temp.seed_uuid('world:bovold'), 'The Summer Thaw',            'The snow-demons of the frozen north thaw and raid the outer isles.', 0),
  (pg_temp.seed_uuid('evtgrp:feast'),    pg_temp.seed_uuid('world:bovold'), 'The Long Feast',            'The serpent-court gathers to consume its honored dead.', 0),
  (pg_temp.seed_uuid('evtgrp:ascension'),pg_temp.seed_uuid('world:bovold'), 'The Dragon-Ascension Festival','The tiger-folk celebrate Tosh Raka''s ascension with fervor and industry.', 0),
  (pg_temp.seed_uuid('evtgrp:fair'),     pg_temp.seed_uuid('world:bovold'), 'The Bovold Trade Fair',     'The great Salt Fair fills the harbor and its counting-halls.', 0);

insert into public.events (id, world_id, event_group_id, name, description, status, effect_type, activate_on_transition_after_turn_number, duration_type, duration_transitions, remaining_transitions, scope_type, scope_nation_id, scope_settlement_id) values
  (pg_temp.seed_uuid('evt:thaw'),      pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('evtgrp:thaw'),      'Snow-Demon Raid on Tenth Isle', 'A thawing horde of Kamal falls upon the outer isle.', 'pending', null, 40, 'instant', null, null, 'settlement', null, pg_temp.seed_uuid('settlement:tenthisle')),
  (pg_temp.seed_uuid('evt:feast'),     pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('evtgrp:feast'),     'The Long Feast at Coil-of-Gold', 'The Communion consumes the honored dead.', 'pending', null, 40, 'instant', null, null, 'nation', pg_temp.seed_uuid('nation:tsaesci'), null),
  (pg_temp.seed_uuid('evt:ascension'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('evtgrp:ascension'), 'Ascension Festival', 'Fervent industry grips the cloisters.', 'active', null, 0, 'sustained', 48, 48, 'nation', pg_temp.seed_uuid('nation:kapotun'), null),
  (pg_temp.seed_uuid('evt:fair'),      pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('evtgrp:fair'),      'The Salt Fair', 'A bounty of trade goods floods the harbor.', 'pending', null, 40, 'instant', null, null, 'settlement', null, pg_temp.seed_uuid('settlement:bovold'));

insert into public.event_effects (id, event_id, effect_type, amount_value, multiplier_value, is_percent, resource_id) values
  (pg_temp.seed_uuid('evteff:thaw'),      pg_temp.seed_uuid('evt:thaw'),      'population_loss',       6,    null, false, null),
  (pg_temp.seed_uuid('evteff:feast'),     pg_temp.seed_uuid('evt:feast'),     'consumption_multiplier', null, 1.05, false, null),
  (pg_temp.seed_uuid('evteff:ascension'), pg_temp.seed_uuid('evt:ascension'), 'production_multiplier',  null, 1.10, false, null),
  (pg_temp.seed_uuid('evteff:fair'),      pg_temp.seed_uuid('evt:fair'),      'resource_grant',         200,  null, false, pg_temp.seed_uuid('resource:grain'));

-- Citizen memories flavouring the Long Feast (static; source 'event').
insert into public.citizen_memories (id, world_id, citizen_id, memory_text, occurred_on_turn_number, source, event_id)
select pg_temp.seed_uuid('memory:feast:' || c.id::text), pg_temp.seed_uuid('world:bovold'), c.id,
       'Took their place at the Long Feast, and remembered the taste of an elder''s years.', 0, 'event', pg_temp.seed_uuid('evt:feast')
from public.citizens c
where c.settlement_id = pg_temp.seed_uuid('settlement:coilgold') and c.citizen_type = 'npc' and c.status = 'alive'
order by c.id limit 3;

-- ---------------------------------------------------------------------------
-- 14. World admins + active player-character mappings. Only user 004 (the world
--     admin account) administers Bovold; the super admin bypasses via flag.
--     Active PCs: settlement manager (002), nation manager (003), player (005).
-- ---------------------------------------------------------------------------
insert into public.world_admins (world_id, user_id) values
  (pg_temp.seed_uuid('world:bovold'), '00000000-0000-0000-0000-000000000004');

insert into public.user_active_player_characters (user_id, world_id, citizen_id) values
  ('00000000-0000-0000-0000-000000000002', pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('citizen:pc:steward')),
  ('00000000-0000-0000-0000-000000000003', pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('citizen:pc:envoy')),
  ('00000000-0000-0000-0000-000000000005', pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('citizen:pc:freeman'));
