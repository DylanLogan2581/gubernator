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
  public.default_calendar_config(),
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
insert into public.nations (id, world_id, name, description, nameset_id, primary_culture_id, state_religion_id, government_type, flag_path) values
  (
    pg_temp.seed_uuid('nation:bovold'), pg_temp.seed_uuid('world:bovold'),
    'Free City of Bovold',
    'The one human city of Akavir — a chartered neutral free port that trades with every beast-nation and bows to none.',
    pg_temp.seed_uuid('nameset:1'), pg_temp.seed_uuid('culture:bovold'), pg_temp.seed_uuid('religion:bovold'), 'republic',
    pg_temp.seed_uuid('nation:bovold')::text || '/flag.webp'
  ),
  (
    pg_temp.seed_uuid('nation:tsaesci'), pg_temp.seed_uuid('world:bovold'),
    'Tsaesciland Empire',
    'The immortal cannibal serpent-folk empire, ruled from the coiling palaces of Coil-of-Gold by an ageless Potentate.',
    pg_temp.seed_uuid('nameset:2'), pg_temp.seed_uuid('culture:tsaesci'), pg_temp.seed_uuid('religion:tsaesci'), 'despotism',
    pg_temp.seed_uuid('nation:tsaesci')::text || '/flag.webp'
  ),
  (
    pg_temp.seed_uuid('nation:tangmo'), pg_temp.seed_uuid('world:bovold'),
    'Thousand Monkey Islands',
    'A free confederation of many-breed monkey-folk across a thousand isles — kind, unconquered, and fiercely opposed to all slavery.',
    pg_temp.seed_uuid('nameset:3'), pg_temp.seed_uuid('culture:tangmo'), pg_temp.seed_uuid('religion:tangmo'), 'confederation',
    pg_temp.seed_uuid('nation:tangmo')::text || '/flag.webp'
  ),
  (
    pg_temp.seed_uuid('nation:kapotun'), pg_temp.seed_uuid('world:bovold'),
    'Ka''Po''Tun Confederacy',
    'The mountain empire of tiger-folk striving to become dragons, led by the god-emperor Tosh Raka from the cloister-city of Po''Tun.',
    pg_temp.seed_uuid('nameset:4'), pg_temp.seed_uuid('culture:kapotun'), pg_temp.seed_uuid('religion:kapotun'), 'theocracy',
    pg_temp.seed_uuid('nation:kapotun')::text || '/flag.webp'
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
  ('coilgold', 'tsaesci', 2, 'capital', 'Coil-of-Gold', 'Gilded spiral capital of the serpent-folk, seat of the Potentate and the Spiral Reliquary of shed skins.', -40.0, -12.0, false, false, 90, 40),
  ('xheenmar', 'tsaesci', 2, 'city', 'Xheenmar', 'Terraced sunning-city of scaled gentry and venom-brewers on the warm southern cliffs.', -46.0, -6.0, false, false, 85, 30),
  ('serpentreach', 'tsaesci', 2, 'city', 'Serpentreach', 'River port where slave-galleys and silk-barges are loaded for the empire.', -34.0, -18.0, false, false, 85, 30),
  ('giltfang', 'tsaesci', 2, 'city', 'Gilt Fang', 'Fortress-city guarding the passes toward the tiger mountains; a duelists'' town.', -52.0, -20.0, false, false, 85, 30),
  ('vhossa', 'tsaesci', 2, 'city', 'Vhossa', 'Marsh city of eel-farms and fermented-egg cellars.', -30.0, -8.0, false, false, 85, 30),
  ('ilnith', 'tsaesci', 2, 'city', 'Ilnith', 'Quarry-city that cuts the gold-veined scale-tile for the coiling palaces.', -48.0, -28.0, false, false, 85, 30),
  ('ansuvheen', 'tsaesci', 2, 'city', 'Ansu-Vheen', 'Inland court-town of jade-cutters and rank-ring makers.', -38.0, -2.0, false, false, 85, 30),
  ('ssuvaal', 'tsaesci', 2, 'city', 'Ssu''Vaal', 'Border holdfast on the hostile isle-frontier, ever wary of monkey raids.', -26.0, -24.0, false, false, 85, 30),
  ('scaledcourt', 'tsaesci', 2, 'city', 'The Scaled Court', 'Garden-city of the old immortal houses and their private duel-yards.', -44.0, -4.0, false, false, 85, 30),
  -- Thousand Monkey Islands (18, 20-30 each)
  ('motang', 'tangmo', 3, 'capital', 'Mo''Tang', 'Canopy-capital of the isles, home to the Great Guardian-Tree and the loudest councils in Akavir.', 30.0, 20.0, false, false, 12, 6),
  ('highcanopy', 'tangmo', 3, 'isle', 'Highcanopy', 'Treetop town of rope-bridges high above the tide; rolls its own readiness each turn.', 34.0, 24.0, true, false, 11, 5),
  ('laughingharbor', 'tangmo', 3, 'isle', 'Laughing Harbor', 'Cheerful fishing isle famous for its drum-song and its terrible puns.', 28.0, 26.0, false, false, 10, 5),
  ('coconutreach', 'tangmo', 3, 'isle', 'Coconut Reach', 'Palm-heavy isle that ships coconut, oil and fruit across the confederation.', 36.0, 18.0, false, false, 10, 5),
  ('skyleap', 'tangmo', 3, 'isle', 'Skyleap', 'Cliff-isle where youths make the First Leap between the highest crags.', 40.0, 22.0, false, false, 10, 4),
  ('chatterbay', 'tangmo', 3, 'isle', 'Chatter Bay', 'Market-isle and gossip-hub where a hundred dialects haggle at once.', 26.0, 16.0, false, false, 11, 5),
  ('driftnest', 'tangmo', 3, 'isle', 'Driftnest', 'Isle of driftwood halls and the confederation''s best netmakers.', 32.0, 14.0, false, false, 9, 4),
  ('freepalms', 'tangmo', 3, 'isle', 'Free Palms', 'Refuge-isle that has never once been taken by raiders.', 38.0, 28.0, false, false, 10, 5),
  ('braidedisles', 'tangmo', 3, 'isle', 'The Braided Isles', 'A knot of tiny isles laced together by woven bridges.', 42.0, 16.0, false, false, 10, 4),
  ('tenthisle', 'tangmo', 3, 'isle', 'Tenth Isle', 'Remote outer isle, first to spot the summer thaw of the snow-demons.', 46.0, 30.0, false, false, 9, 4),
  ('bramba', 'tangmo', 3, 'isle', 'Bramba', 'Root-farming isle of good cheer and enormous shared cook-pots.', 24.0, 22.0, false, false, 10, 5),
  ('shoban', 'tangmo', 3, 'isle', 'Sho''Ban', 'Lantern-makers'' isle, brightest of all on the Thousand Lanterns night.', 30.0, 30.0, false, false, 10, 5),
  ('palmfront', 'tangmo', 3, 'isle', 'Palmfront', 'Windward isle of shell-craft and mask-carvers.', 44.0, 26.0, false, false, 10, 4),
  ('gullcry', 'tangmo', 3, 'isle', 'Gullcry', 'Rocky seabird isle prized for eggs and feathers.', 48.0, 20.0, false, false, 9, 4),
  ('sunderisle', 'tangmo', 3, 'isle', 'Sunder Isle', 'Storm-battered isle whose folk rebuild their stilt-homes without complaint.', 22.0, 28.0, false, false, 10, 5),
  ('longwharf', 'tangmo', 3, 'isle', 'Long Wharf', 'Trade-isle with the longest pier in the isles, a favorite Bovold port of call.', 26.0, 12.0, false, false, 11, 6),
  ('kiprest', 'tangmo', 3, 'isle', 'Kip''s Rest', 'Storyteller-isle said to be the trickster Kip''s own birthplace.', 34.0, 32.0, false, false, 10, 5),
  ('mudnest', 'tangmo', 3, 'isle', 'Mudnest', 'Mangrove isle of crab-catchers and reed-weavers.', 20.0, 18.0, false, false, 9, 4),
  -- Ka'Po'Tun Confederacy (8, ~50 each)
  ('potun', 'kapotun', 4, 'capital', 'Po''Tun', 'Cloister-capital of the tiger-folk, throne of the god-emperor Tosh Raka and the great ascension-monastery.', -20.0, 34.0, false, false, 22, 10),
  ('sunspire', 'kapotun', 4, 'cloister', 'Sunspire', 'Summit shrine-city where Tosh Raka first took wing; holiest site of the Ascension.', -26.0, 40.0, false, false, 20, 10),
  ('dragonclimb', 'kapotun', 4, 'cloister', 'Dragonclimb', 'Terraced monastery-town clinging to a sheer dragon-shaped ridge.', -14.0, 38.0, false, false, 20, 10),
  ('tigermount', 'kapotun', 4, 'cloister', 'Tigermount', 'Fortress-cloister guarding the war-front against the serpent empire.', -28.0, 28.0, false, false, 20, 10),
  ('embercloister', 'kapotun', 4, 'cloister', 'The Ember Cloister', 'Forge-monastery whose breath-masters temper both steel and soul.', -18.0, 44.0, false, false, 20, 10),
  ('nineroars', 'kapotun', 4, 'cloister', 'Nine Roars', 'Training-city of the monk-warriors, named for its nine echoing valleys.', -12.0, 30.0, false, false, 20, 10),
  ('rakhal', 'kapotun', 4, 'cloister', 'Rakhal', 'Rice-terraced valley town that feeds the mountain cloisters.', -24.0, 24.0, false, false, 20, 10),
  ('shomarath', 'kapotun', 4, 'cloister', 'Sho''Marath', 'Reliquary-town keeping the ashes and scales of the slain black dragons.', -16.0, 48.0, false, false, 20, 10);

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
insert into public.education_levels (id, world_id, name, description, rank, natural_born_percent) values
  (pg_temp.seed_uuid('edu:untaught'), pg_temp.seed_uuid('world:bovold'), 'Untaught',  'No formal schooling.',                      0, 70),
  (pg_temp.seed_uuid('edu:lettered'), pg_temp.seed_uuid('world:bovold'), 'Lettered',  'Reads, writes and reckons a ledger.',       1, 22),
  (pg_temp.seed_uuid('edu:scholar'),  pg_temp.seed_uuid('world:bovold'), 'Scholar',   'Schooled in law, letters or the sutras.',   2, 6),
  (pg_temp.seed_uuid('edu:sage'),     pg_temp.seed_uuid('world:bovold'), 'Sage',      'A master of a discipline; rare and prized.', 3, 2);

-- ---------------------------------------------------------------------------
-- 9. Economy pack: resources, jobs (all 6 job types + a teacher + dedicated
--    food/water producers), deposit types, managed-population types,
--    blueprints/tiers (including a school tier). Mechanically identical to the
--    proven baseline economy; only ids (seed_uuid) and a teacher/school are new.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world constant uuid := pg_temp.seed_uuid('world:bovold');

  v_res_grain         uuid := pg_temp.seed_uuid('resource:grain');
  v_res_salted_pork   uuid := pg_temp.seed_uuid('resource:salted-pork');
  v_res_smoked_mutton uuid := pg_temp.seed_uuid('resource:smoked-mutton');
  v_res_honey         uuid := pg_temp.seed_uuid('resource:honey');
  v_res_ale           uuid := pg_temp.seed_uuid('resource:ale');
  v_res_linen_cloth   uuid := pg_temp.seed_uuid('resource:linen-cloth');
  v_res_wool          uuid := pg_temp.seed_uuid('resource:wool');
  v_res_hardwood_logs uuid := pg_temp.seed_uuid('resource:hardwood-logs');
  v_res_stone_block   uuid := pg_temp.seed_uuid('resource:stone-block');
  v_res_iron_ore      uuid := pg_temp.seed_uuid('resource:iron-ore');
  v_res_copper_ingot  uuid := pg_temp.seed_uuid('resource:copper-ingot');
  v_res_peat          uuid := pg_temp.seed_uuid('resource:peat');
  v_res_sea_salt      uuid := pg_temp.seed_uuid('resource:sea-salt');
  v_res_food          uuid;
  v_res_water         uuid;

  v_job_field_hand     uuid := pg_temp.seed_uuid('job:field-hand');
  v_job_water_bearer   uuid := pg_temp.seed_uuid('job:water-bearer');
  v_job_grain_farmer   uuid := pg_temp.seed_uuid('job:grain-farmer');
  v_job_brewer         uuid := pg_temp.seed_uuid('job:brewer');
  v_job_cloth_weaver   uuid := pg_temp.seed_uuid('job:cloth-weaver');
  v_job_fisher         uuid := pg_temp.seed_uuid('job:fisher');
  v_job_teacher        uuid := pg_temp.seed_uuid('job:teacher');
  v_job_stone_mason    uuid := pg_temp.seed_uuid('job:stone-mason');
  v_job_caravan_trader uuid := pg_temp.seed_uuid('job:caravan-trader');
  v_job_iron_miner     uuid := pg_temp.seed_uuid('job:iron-miner');
  v_job_copper_miner   uuid := pg_temp.seed_uuid('job:copper-miner');
  v_job_stone_quarry   uuid := pg_temp.seed_uuid('job:stone-quarryman');
  v_job_lumberjack     uuid := pg_temp.seed_uuid('job:lumberjack');
  v_job_peat_cutter    uuid := pg_temp.seed_uuid('job:peat-cutter');
  v_job_shepherd       uuid := pg_temp.seed_uuid('job:shepherd');
  v_job_beekeeper      uuid := pg_temp.seed_uuid('job:beekeeper');
  v_job_swineherd      uuid := pg_temp.seed_uuid('job:swineherd');
  v_job_mutton_butcher uuid := pg_temp.seed_uuid('job:mutton-butcher');
  v_job_honey_gatherer uuid := pg_temp.seed_uuid('job:honey-gatherer');
  v_job_pork_butcher   uuid := pg_temp.seed_uuid('job:pork-butcher');

  v_dep_iron_vein      uuid := pg_temp.seed_uuid('deposit:iron-vein');
  v_dep_copper_vein    uuid := pg_temp.seed_uuid('deposit:copper-vein');
  v_dep_stone_quarry   uuid := pg_temp.seed_uuid('deposit:stone-quarry');
  v_dep_hardwood_grove uuid := pg_temp.seed_uuid('deposit:hardwood-grove');
  v_dep_peat_bog       uuid := pg_temp.seed_uuid('deposit:peat-bog');

  v_pop_sheep_herd uuid := pg_temp.seed_uuid('pop:sheep-herd');
  v_pop_bee_colony uuid := pg_temp.seed_uuid('pop:bee-colony');
  v_pop_pig_herd   uuid := pg_temp.seed_uuid('pop:pig-herd');

  v_bp_granary    uuid := pg_temp.seed_uuid('bp:granary');
  v_bp_cistern    uuid := pg_temp.seed_uuid('bp:cistern');
  v_bp_storehouse uuid := pg_temp.seed_uuid('bp:storehouse');
  v_bp_workshop   uuid := pg_temp.seed_uuid('bp:workshop');
  v_bp_longhouse  uuid := pg_temp.seed_uuid('bp:longhouse');
  v_bp_smithy     uuid := pg_temp.seed_uuid('bp:smithy');
  v_bp_school     uuid := pg_temp.seed_uuid('bp:school');
  v_tier_granary_1    uuid := pg_temp.seed_uuid('tier:granary:1');
  v_tier_cistern_1    uuid := pg_temp.seed_uuid('tier:cistern:1');
  v_tier_storehouse_1 uuid := pg_temp.seed_uuid('tier:storehouse:1');
  v_tier_workshop_1   uuid := pg_temp.seed_uuid('tier:workshop:1');
  v_tier_longhouse_1  uuid := pg_temp.seed_uuid('tier:longhouse:1');
  v_tier_smithy_1     uuid := pg_temp.seed_uuid('tier:smithy:1');
  v_tier_smithy_2     uuid := pg_temp.seed_uuid('tier:smithy:2');
  v_tier_school_1     uuid := pg_temp.seed_uuid('tier:school:1');
begin
  select id into v_res_food  from public.resources where world_id = v_world and slug = 'food';
  select id into v_res_water from public.resources where world_id = v_world and slug = 'fresh-water';

  insert into public.resources (id, world_id, name, slug, base_stockpile_cap, icon) values
    (v_res_grain,         v_world, 'Grain',         'grain',         2000, 'game:wheat'),
    (v_res_salted_pork,   v_world, 'Cured Meat',    'salted-pork',    500, 'game:bacon'),
    (v_res_smoked_mutton, v_world, 'Smoked Mutton', 'smoked-mutton',  500, 'game:meat'),
    (v_res_honey,         v_world, 'Honey',         'honey',          300, 'game:honeycomb'),
    (v_res_ale,           v_world, 'Rice-Wine',     'ale',            400, 'game:beer-stein'),
    (v_res_linen_cloth,   v_world, 'Silk Cloth',    'linen-cloth',    300, 'game:rolled-cloth'),
    (v_res_wool,          v_world, 'Wool',          'wool',           500, 'game:wool'),
    (v_res_hardwood_logs, v_world, 'Hardwood Logs', 'hardwood-logs', 1000, 'game:wood-pile'),
    (v_res_stone_block,   v_world, 'Stone Block',   'stone-block',   1200, 'game:stone-block'),
    (v_res_iron_ore,      v_world, 'Iron Ore',      'iron-ore',       800, 'game:ore'),
    (v_res_copper_ingot,  v_world, 'Jade',          'copper-ingot',   400, 'game:metal-bar'),
    (v_res_peat,          v_world, 'Peat',          'peat',           600, 'game:brick-pile'),
    (v_res_sea_salt,      v_world, 'Sea Salt',      'sea-salt',       400, 'game:salt-shaker');

  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json, outputs_json, icon) values
    -- Food/water outputs are deliberately generous so the world grows healthily
    -- across the 32-turn replay at 200-pop settlements (Aldermoor's 4/5 were
    -- tuned for ~50-pop and starved this world).
    (v_job_field_hand, v_world, 'Field Hand', 'field-hand', 'standard', 30,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_food::text, 'amount_per_worker', 8)),
       'game:farmer'),
    (v_job_water_bearer, v_world, 'Water Bearer', 'water-bearer', 'standard', 24,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_water::text, 'amount_per_worker', 8)),
       'game:full-wood-bucket-handle'),
    (v_job_grain_farmer, v_world, 'Grain Farmer', 'grain-farmer', 'standard', 16,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_worker', 6)),
       'game:sickle'),
    (v_job_brewer, v_world, 'Vintner', 'brewer', 'standard', 6,
       jsonb_build_array(
         jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_worker', 2),
         jsonb_build_object('resource_id', v_res_honey::text, 'amount_per_worker', 0.5)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_ale::text, 'amount_per_worker', 1)),
       'game:cauldron'),
    (v_job_cloth_weaver, v_world, 'Silk Weaver', 'cloth-weaver', 'standard', 8,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_wool::text, 'amount_per_worker', 2)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_linen_cloth::text, 'amount_per_worker', 1)),
       'game:sewing-needle'),
    (v_job_fisher, v_world, 'Fisher', 'fisher', 'standard', 12,
       '[]'::jsonb,
       jsonb_build_array(
         jsonb_build_object('resource_id', v_res_food::text, 'amount_per_worker', 2),
         jsonb_build_object('resource_id', v_res_sea_salt::text, 'amount_per_worker', 1)),
       'game:fishing-pole'),
    (v_job_teacher, v_world, 'Teacher', 'teacher', 'teacher', 6,
       '[]'::jsonb, '[]'::jsonb, 'game:teacher');

  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, icon) values
    (v_job_stone_mason, v_world, 'Stone Mason', 'stone-mason', 'construction', 6, 'game:trowel');
  insert into public.job_definitions (id, world_id, name, slug, job_type, trader_capacity_per_worker, required_education_level_id, icon) values
    (v_job_caravan_trader, v_world, 'Caravan Trader', 'caravan-trader', 'trader', 3, pg_temp.seed_uuid('edu:lettered'), 'game:caravan');

  insert into public.job_definitions (id, world_id, name, slug, job_type, linked_deposit_type_id, icon) values
    (v_job_iron_miner,   v_world, 'Iron Miner',      'iron-miner',      'deposit', v_dep_iron_vein,      'pickaxe'),
    (v_job_copper_miner, v_world, 'Jade Cutter',     'copper-miner',    'deposit', v_dep_copper_vein,    'game:mining-helmet'),
    (v_job_stone_quarry, v_world, 'Stone Quarryman', 'stone-quarryman', 'deposit', v_dep_stone_quarry,   'game:rock'),
    (v_job_lumberjack,   v_world, 'Lumberjack',      'lumberjack',      'deposit', v_dep_hardwood_grove, 'axe'),
    (v_job_peat_cutter,  v_world, 'Peat Cutter',     'peat-cutter',     'deposit', v_dep_peat_bog,       'shovel');

  insert into public.job_definitions (id, world_id, name, slug, job_type, linked_managed_population_type_id, icon) values
    (v_job_shepherd,       v_world, 'Shepherd',       'shepherd',       'husbandry', v_pop_sheep_herd, 'game:shepherds-crook'),
    (v_job_beekeeper,      v_world, 'Beekeeper',      'beekeeper',      'husbandry', v_pop_bee_colony, 'game:beehive'),
    (v_job_swineherd,      v_world, 'Swineherd',      'swineherd',      'husbandry', v_pop_pig_herd,   'game:pig'),
    (v_job_mutton_butcher, v_world, 'Mutton Butcher', 'mutton-butcher', 'culling',   v_pop_sheep_herd, 'game:cleaver'),
    (v_job_honey_gatherer, v_world, 'Honey Gatherer', 'honey-gatherer', 'culling',   v_pop_bee_colony, 'game:honey-jar'),
    (v_job_pork_butcher,   v_world, 'Pork Butcher',   'pork-butcher',   'culling',   v_pop_pig_herd,   'game:meat-cleaver');

  insert into public.deposit_types (id, world_id, name, slug, icon) values
    (v_dep_iron_vein,      v_world, 'Iron Vein',      'iron-vein',      'game:minerals'),
    (v_dep_copper_vein,    v_world, 'Jade Vein',      'copper-vein',    'game:metal-bar'),
    (v_dep_stone_quarry,   v_world, 'Stone Quarry',   'stone-quarry',   'mountain'),
    (v_dep_hardwood_grove, v_world, 'Hardwood Grove', 'hardwood-grove', 'trees'),
    (v_dep_peat_bog,       v_world, 'Peat Bog',       'peat-bog',       'game:swamp');

  insert into public.deposit_type_jobs (deposit_type_id, job_id, output_units_per_worker, worker_inputs_json) values
    (v_dep_iron_vein,      v_job_iron_miner,   5,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_linen_cloth::text, 'amount_per_worker', 0.5))),
    (v_dep_copper_vein,    v_job_copper_miner, 4, '[]'::jsonb),
    (v_dep_stone_quarry,   v_job_stone_quarry, 8,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount_per_worker', 0.5))),
    (v_dep_hardwood_grove, v_job_lumberjack,   6, '[]'::jsonb),
    (v_dep_peat_bog,       v_job_peat_cutter,  6, '[]'::jsonb);

  insert into public.managed_population_types (
    id, world_id, name, slug, growth_rate,
    maintenance_rules_json, culling_outputs_json, regular_outputs_json, icon
  ) values
    (v_pop_sheep_herd, v_world, 'Sheep Herd', 'sheep-herd', 0.10,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_n_animals', 0.1)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_smoked_mutton::text, 'amount_per_n_animals', 0.5)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_wool::text, 'amount_per_n_animals', 0.25)),
       'game:sheep'),
    (v_pop_bee_colony, v_world, 'Bee Colony', 'bee-colony', 0.05,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_honey::text, 'amount_per_n_animals', 2)),
       '[]'::jsonb,
       'game:hive'),
    (v_pop_pig_herd, v_world, 'Pig Herd', 'pig-herd', 0.15,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_n_animals', 0.2)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_salted_pork::text, 'amount_per_n_animals', 2)),
       '[]'::jsonb,
       'game:pig-face');

  insert into public.managed_population_husbandry_jobs (managed_population_type_id, job_id, workers_per_n_animals) values
    (v_pop_sheep_herd, v_job_shepherd,  10),
    (v_pop_bee_colony, v_job_beekeeper, 20),
    (v_pop_pig_herd,   v_job_swineherd, 8);

  insert into public.managed_population_culling_jobs (managed_population_type_id, job_id, max_cull_per_worker) values
    (v_pop_sheep_herd, v_job_mutton_butcher, 10),
    (v_pop_bee_colony, v_job_honey_gatherer, 10),
    (v_pop_pig_herd,   v_job_pork_butcher,   10);

  insert into public.building_blueprints (id, world_id, name, slug, description, grace_period_turns, max_instances_per_settlement, icon) values
    (v_bp_granary,    v_world, 'Granary',           'granary',          'A raised granary that yields food passively and widens the field-hand rota.', 0, null, 'game:granary'),
    (v_bp_cistern,    v_world, 'Cistern',           'cistern',          'A stone cistern that gathers fresh water and supports the water-bearers.', 0, null, 'game:well'),
    (v_bp_storehouse, v_world, 'Storehouse',        'storehouse',       'Roofed storage adding stockpile capacity for grain and cured goods.', 1, 4, 'warehouse'),
    (v_bp_workshop,   v_world, 'Weaver''s Workshop','weavers-workshop', 'A workshop where weavers raise the settlement''s cloth output.', 0, 4, 'game:yarn'),
    (v_bp_longhouse,  v_world, 'Longhouse',         'longhouse',        'A communal hall that raises the settlement''s sustainable population.', 2, 8, 'game:viking-longhouse'),
    (v_bp_smithy,     v_world, 'Smithy',            'smithy',           'A two-tier smithy that expands iron storage and bolsters the mason corps.', 1, 2, 'game:anvil'),
    (v_bp_school,     v_world, 'School',            'school',           'A schoolhouse where a teacher lifts pupils from Untaught through Scholar.', 0, 1, 'game:teacher');

  insert into public.building_blueprint_tiers (
    id, building_blueprint_id, tier_number, worker_turns_required,
    construction_costs_json, upkeep_costs_json, effects_json
  ) values
    (v_tier_granary_1, v_bp_granary, 1, 6,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 10),
        jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 5)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','passive_resource_production','resource_id', v_res_food::text, 'amount', 24),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_field_hand::text, 'amount', 6),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_food::text, 'amount', 800),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_grain::text, 'amount', 400))),
    (v_tier_cistern_1, v_bp_cistern, 1, 5,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 8)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','passive_resource_production','resource_id', v_res_water::text, 'amount', 24),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_water_bearer::text, 'amount', 6),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_water::text, 'amount', 800))),
    (v_tier_storehouse_1, v_bp_storehouse, 1, 4,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 20)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_grain::text, 'amount', 500),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_salted_pork::text, 'amount', 250))),
    (v_tier_workshop_1, v_bp_workshop, 1, 5,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 8),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 4)),
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('type','job_capacity_increase','job_id', v_job_cloth_weaver::text, 'amount', 3))),
    -- No upkeep: an unpaid grain upkeep would suspend longhouses mid-replay,
    -- collapsing the population cap into mass homelessness. +50 cap each gives
    -- generous headroom for births over 32 turns.
    (v_tier_longhouse_1, v_bp_longhouse, 1, 8,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 15),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 10)),
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('type','population_cap_increase','amount', 50))),
    (v_tier_smithy_1, v_bp_smithy, 1, 7,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_iron_ore::text, 'amount', 4),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 6)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_iron_ore::text, 'amount', 100),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_stone_mason::text, 'amount', 1))),
    (v_tier_smithy_2, v_bp_smithy, 2, 12,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_iron_ore::text, 'amount', 8),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 12),
        jsonb_build_object('resource_id', v_res_copper_ingot::text, 'amount', 4)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_iron_ore::text, 'amount', 250),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_stone_mason::text, 'amount', 2))),
    (v_tier_school_1, v_bp_school, 1, 6,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 10),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 8)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_teacher::text, 'amount', 2),
        jsonb_build_object(
          'type','education',
          'teacher_job_id', v_job_teacher::text,
          'teacher_capacity', 2,
          'students_per_teacher', 6,
          'levels', jsonb_build_array(
            jsonb_build_object('from_level_id', null, 'to_level_id', pg_temp.seed_uuid('edu:lettered')::text, 'turns', 3),
            jsonb_build_object('from_level_id', pg_temp.seed_uuid('edu:lettered')::text, 'to_level_id', pg_temp.seed_uuid('edu:scholar')::text, 'turns', 4)))));
end$$;

-- ---------------------------------------------------------------------------
-- 10. Per-settlement buildings, deposits, managed populations, stockpiles and
--     construction. Building counts scale with population so every settlement
--     is food/water self-sufficient (granary +16 food & +6 field capacity;
--     cistern +16 water & +6 bearer capacity) with population-cap headroom.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_pop int;
  v_gran int; v_cist int; v_long int; v_i int;
  v_dep_res uuid; v_pop_type uuid; v_cull int;
  v_bp_granary uuid := pg_temp.seed_uuid('bp:granary');
  v_bp_cistern uuid := pg_temp.seed_uuid('bp:cistern');
  v_bp_store   uuid := pg_temp.seed_uuid('bp:storehouse');
  v_bp_work    uuid := pg_temp.seed_uuid('bp:workshop');
  v_bp_long    uuid := pg_temp.seed_uuid('bp:longhouse');
  v_bp_smithy  uuid := pg_temp.seed_uuid('bp:smithy');
  v_bp_school  uuid := pg_temp.seed_uuid('bp:school');
  v_t_gran uuid := pg_temp.seed_uuid('tier:granary:1');
  v_t_cist uuid := pg_temp.seed_uuid('tier:cistern:1');
  v_t_store uuid := pg_temp.seed_uuid('tier:storehouse:1');
  v_t_work uuid := pg_temp.seed_uuid('tier:workshop:1');
  v_t_long uuid := pg_temp.seed_uuid('tier:longhouse:1');
  v_t_smithy uuid := pg_temp.seed_uuid('tier:smithy:1');
  v_t_school uuid := pg_temp.seed_uuid('tier:school:1');
  v_sid uuid;
  v_rn int := 0;
begin
  for r in select * from tmp_setts order by key loop
    v_rn := v_rn + 1;
    v_sid := pg_temp.seed_uuid('settlement:' || r.key);
    v_pop := r.couples * 2 + r.children;
    v_gran := greatest(1, ceil(v_pop / 120.0))::int;
    v_cist := greatest(1, ceil(v_pop / 120.0))::int;
    v_long := least(8, greatest(2, ceil(v_pop / 28.0)::int));

    -- Granaries + cisterns (scaled), one storehouse, one workshop.
    for v_i in 1..v_gran loop
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':granary:' || v_i), v_sid, v_bp_granary, v_t_gran, 'active', 0);
    end loop;
    for v_i in 1..v_cist loop
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':cistern:' || v_i), v_sid, v_bp_cistern, v_t_cist, 'active', 0);
    end loop;
    insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number) values
      (pg_temp.seed_uuid('building:' || r.key || ':storehouse'), v_sid, v_bp_store, v_t_store, 'active', 0),
      (pg_temp.seed_uuid('building:' || r.key || ':workshop'),   v_sid, v_bp_work,  v_t_work,  'active', 0);

    -- Longhouses (population cap).
    for v_i in 1..v_long loop
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':longhouse:' || v_i), v_sid, v_bp_long, v_t_long, 'active', 0);
    end loop;

    -- Smithy for capitals + Tsaesci cities; school for capitals.
    if r.tier in ('capital','city') then
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':smithy'), v_sid, v_bp_smithy, v_t_smithy, 'active', 0);
    end if;
    if r.tier = 'capital' then
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number)
      values (pg_temp.seed_uuid('building:' || r.key || ':school'), v_sid, v_bp_school, v_t_school, 'active', 0);
    end if;

    -- Deposits: every settlement gets a hardwood grove + stone quarry; larger
    -- settlements also an iron vein. Provides construction materials + trade.
    insert into public.deposit_instances (id, settlement_id, deposit_type_id, name, status, max_workers) values
      (pg_temp.seed_uuid('depinst:' || r.key || ':grove'),  v_sid, pg_temp.seed_uuid('deposit:hardwood-grove'), r.name || ' Grove',  'active', 8),
      (pg_temp.seed_uuid('depinst:' || r.key || ':quarry'), v_sid, pg_temp.seed_uuid('deposit:stone-quarry'),   r.name || ' Quarry', 'active', 8);
    insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity) values
      (pg_temp.seed_uuid('depinst:' || r.key || ':grove'),  pg_temp.seed_uuid('resource:hardwood-logs'), 4000, 4000),
      (pg_temp.seed_uuid('depinst:' || r.key || ':quarry'), pg_temp.seed_uuid('resource:stone-block'),   6000, 6000);
    if r.tier in ('capital','city') then
      insert into public.deposit_instances (id, settlement_id, deposit_type_id, name, status, max_workers)
      values (pg_temp.seed_uuid('depinst:' || r.key || ':iron'), v_sid, pg_temp.seed_uuid('deposit:iron-vein'), r.name || ' Iron Vein', 'active', 8);
      insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity)
      values (pg_temp.seed_uuid('depinst:' || r.key || ':iron'), pg_temp.seed_uuid('resource:iron-ore'), 5000, 5000);
    end if;

    -- One managed population per settlement, rotating sheep / pig / bee.
    if v_rn % 3 = 1 then v_pop_type := pg_temp.seed_uuid('pop:sheep-herd'); v_cull := 10;
    elsif v_rn % 3 = 2 then v_pop_type := pg_temp.seed_uuid('pop:pig-herd'); v_cull := 8;
    else v_pop_type := pg_temp.seed_uuid('pop:bee-colony'); v_cull := 6;
    end if;
    insert into public.managed_population_instances (id, settlement_id, managed_population_type_id, name, current_count, configured_cull_quantity, status)
    values (pg_temp.seed_uuid('popinst:' || r.key), v_sid, v_pop_type, r.name || ' Herd', greatest(30, v_pop), v_cull, 'active');

    -- Starting stockpiles, scaled so production has a buffer to build on.
    update public.settlement_resource_stockpiles s set quantity = v.qty
    from public.resources res,
      (values
        ('food', v_pop * 3), ('fresh-water', v_pop * 3), ('grain', v_pop * 2),
        ('ale', 40), ('wool', 120), ('linen-cloth', 30), ('hardwood-logs', 300),
        ('stone-block', 350), ('iron-ore', 120), ('copper-ingot', 60),
        ('salted-pork', 80), ('smoked-mutton', 60), ('honey', 60),
        ('peat', 80), ('sea-salt', 60)
      ) as v(slug, qty)
    where res.world_id = pg_temp.seed_uuid('world:bovold') and res.slug = v.slug
      and s.resource_id = res.id and s.settlement_id = v_sid;
  end loop;
end$$;

-- In-progress construction: a second workshop at each capital (varied progress).
insert into public.construction_projects (id, settlement_id, building_blueprint_id, target_tier_id, status, queue_position, progress_worker_turns)
select pg_temp.seed_uuid('construction:' || key), pg_temp.seed_uuid('settlement:' || key),
       pg_temp.seed_uuid('bp:workshop'), pg_temp.seed_uuid('tier:workshop:1'), 'in_progress', 1,
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
  v_mborn int; v_fborn int;
  v_edu uuid;
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

      v_seq := v_seq + 1;
      v_male_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
      insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, education_level_id, npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw)
      values (v_male_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc', v_male[1 + (v_seq % v_nm)], v_surname, 'male', 'alive', v_mborn, v_nameset, v_culture, v_religion, v_edu,
              v_traits[1+(v_seq % v_nt)], v_traits[1+((v_seq+5) % v_nt)], v_contra[1+(v_seq % v_nc)], v_goals[1+(v_seq % v_ng)], v_flaws[1+(v_seq % v_nl)]);

      v_seq := v_seq + 1;
      v_female_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
      insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw)
      values (v_female_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc', v_female[1 + ((v_seq*3) % v_nf)], v_surname, 'female', 'alive', v_fborn, v_nameset, v_culture, v_religion,
              v_traits[1+(v_seq % v_nt)], v_traits[1+((v_seq+7) % v_nt)], v_contra[1+(v_seq % v_nc)], v_goals[1+(v_seq % v_ng)], v_flaws[1+(v_seq % v_nl)]);

      insert into public.partnerships (citizen_a_id, citizen_b_id, status, formed_on_turn_number)
      values (v_male_id, v_female_id, 'active', greatest(v_mborn, v_fborn) + 18);

      if c <= r.children then
        v_seq := v_seq + 1;
        v_child_id := pg_temp.seed_uuid('citizen:bulk:' || v_seq);
        insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, culture_id, religion_id, parent_a_citizen_id, parent_b_citizen_id, npc_trait_1, npc_goal)
        values (v_child_id, v_world, pg_temp.seed_uuid('settlement:' || r.key), 'npc',
                case when c % 2 = 0 then v_male[1 + ((v_seq+4) % v_nm)] else v_female[1 + ((v_seq+2) % v_nf)] end,
                v_surname,
                case when c % 2 = 0 then 'male' else 'female' end,
                'alive', -(1 + (c % 12)), v_nameset, v_culture, v_religion, v_male_id, v_female_id,
                v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);
      end if;
    end loop;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 12. Government: office types, appointed offices, government bodies; law
--     documents with articles / versions / a passed amendment + votes; decrees.
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
insert into public.law_amendments (id, document_id, title, rationale_markdown, operations_json, status, proposed_by_citizen_id, proposed_turn_number, resolved_turn_number) values
  (pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('law:bovold'), 'The Sanctuary Clause',
    'To make plain that the harbor is a refuge, so that fleeing isle-folk and serpent-slaves alike are safe within our walls.',
    jsonb_build_array(jsonb_build_object('op','add_article','heading','Of Sanctuary','body_markdown','None who reaches the harbor gate in peace shall be enslaved or turned away.','position',3)),
    'passed', pg_temp.seed_uuid('citizen:notable:bovold-council1'), 0, 0);

insert into public.law_amendment_votes (id, amendment_id, voter_citizen_id, vote) values
  (pg_temp.seed_uuid('vote:sanctuary:mayor'),    pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('citizen:notable:bovold-mayor'),    true),
  (pg_temp.seed_uuid('vote:sanctuary:council1'), pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('citizen:notable:bovold-council1'), true),
  (pg_temp.seed_uuid('vote:sanctuary:council2'), pg_temp.seed_uuid('amendment:bovold:sanctuary'), pg_temp.seed_uuid('citizen:notable:bovold-council2'), false);

insert into public.decrees (id, world_id, nation_id, title, body_markdown, issued_by_citizen_id, issued_turn_number) values
  (pg_temp.seed_uuid('decree:bovold:tariff'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'The Harbor Tariff', 'A modest tariff is laid on all goods crossing the sea-wall, that the harbor and its lighthouse be kept.', pg_temp.seed_uuid('citizen:notable:bovold-mayor'), 0),
  (pg_temp.seed_uuid('decree:tsaesci:feast'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'Edict of the Long Feast', 'The Potentate ordains a Long Feast at the turning of the sun, that the worthy dead endure in the living.', pg_temp.seed_uuid('citizen:notable:tsaesci-potentate'), 0),
  (pg_temp.seed_uuid('decree:tangmo:defense'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'), 'The Lantern-Watch', 'Each isle shall keep a lantern lit against the summer thaw, and raise the drum if the snow-demons come.', pg_temp.seed_uuid('citizen:notable:tangmo-speaker'), 0),
  (pg_temp.seed_uuid('decree:kapotun:rite'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'The Rite of Ascension', 'Every cloister shall keep the Nine Roars and the dawn-salute, that the climb toward the Dragon never falter.', pg_temp.seed_uuid('citizen:notable:kapotun-emperor'), 0);

-- ---------------------------------------------------------------------------
-- 13a. Military. One army per nation, stationed at its capital, funded by the
--      host settlement. Unit types carry NO upkeep and zero desertion so the
--      standing armies never perturb the economy during the 32-turn replay.
-- ---------------------------------------------------------------------------
insert into public.unit_types (id, world_id, name, description, soldiers_per_unit, recruitment_costs_json, upkeep_costs_json, desertion_rate) values
  (pg_temp.seed_uuid('unit:militia'),    pg_temp.seed_uuid('world:bovold'), 'City Militia',    'Guild volunteers who guard the harbor and sea-wall.', 10,
     jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ore')::text, 'amount', 4)), '[]'::jsonb, 0),
  (pg_temp.seed_uuid('unit:serpentguard'),pg_temp.seed_uuid('world:bovold'), 'Serpent Guard',   'Scaled duelists of the immortal court.', 8,
     jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ore')::text, 'amount', 6)), '[]'::jsonb, 0),
  (pg_temp.seed_uuid('unit:skirmisher'), pg_temp.seed_uuid('world:bovold'), 'Isle Skirmisher', 'Brave, reckless canopy-fighters of the isles.', 12,
     jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:hardwood-logs')::text, 'amount', 4)), '[]'::jsonb, 0),
  (pg_temp.seed_uuid('unit:tigermonk'),  pg_temp.seed_uuid('world:bovold'), 'Tiger-Monk',      'Breath-disciplined monk-warriors of the ascension.', 8,
     jsonb_build_array(jsonb_build_object('resource_id', pg_temp.seed_uuid('resource:iron-ore')::text, 'amount', 6)), '[]'::jsonb, 0);

insert into public.armies (id, world_id, nation_id, name, funding_source, stationed_settlement_id, created_turn_number) values
  (pg_temp.seed_uuid('army:bovold'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:bovold'),  'Bovold Harbor Watch', 'host_settlement', pg_temp.seed_uuid('settlement:bovold'),  0),
  (pg_temp.seed_uuid('army:tsaesci'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tsaesci'), 'The Coiled Legion',   'host_settlement', pg_temp.seed_uuid('settlement:coilgold'),0),
  (pg_temp.seed_uuid('army:tangmo'),  pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:tangmo'),  'The Isle Levy',       'host_settlement', pg_temp.seed_uuid('settlement:motang'),  0),
  (pg_temp.seed_uuid('army:kapotun'), pg_temp.seed_uuid('world:bovold'), pg_temp.seed_uuid('nation:kapotun'), 'The Dragon Host',     'host_settlement', pg_temp.seed_uuid('settlement:potun'),   0);

insert into public.army_groups (id, army_id, name, sort_order) values
  (pg_temp.seed_uuid('group:bovold'),  pg_temp.seed_uuid('army:bovold'),  'Harbor Ward',    0),
  (pg_temp.seed_uuid('group:tsaesci'), pg_temp.seed_uuid('army:tsaesci'), 'First Coil',     0),
  (pg_temp.seed_uuid('group:tangmo'),  pg_temp.seed_uuid('army:tangmo'),  'Canopy Company', 0),
  (pg_temp.seed_uuid('group:kapotun'), pg_temp.seed_uuid('army:kapotun'), 'Ascension Fist', 0);

insert into public.army_units (id, army_id, group_id, unit_type_id, name, sort_order, created_turn_number) values
  (pg_temp.seed_uuid('armyunit:bovold'),  pg_temp.seed_uuid('army:bovold'),  pg_temp.seed_uuid('group:bovold'),  pg_temp.seed_uuid('unit:militia'),     'Harbor Militia Cohort', 0, 0),
  (pg_temp.seed_uuid('armyunit:tsaesci'), pg_temp.seed_uuid('army:tsaesci'), pg_temp.seed_uuid('group:tsaesci'), pg_temp.seed_uuid('unit:serpentguard'),'Gilt Fang Guard',       0, 0),
  (pg_temp.seed_uuid('armyunit:tangmo'),  pg_temp.seed_uuid('army:tangmo'),  pg_temp.seed_uuid('group:tangmo'),  pg_temp.seed_uuid('unit:skirmisher'),  'Free Palms Skirmishers',0, 0),
  (pg_temp.seed_uuid('armyunit:kapotun'), pg_temp.seed_uuid('army:kapotun'), pg_temp.seed_uuid('group:kapotun'), pg_temp.seed_uuid('unit:tigermonk'),   'Sunspire Monks',        0, 0);

-- Recruit a small number of soldiers per army from capital residents. These
-- citizens are then excluded from the labour pool below.
do $$
declare
  r record; v_cid uuid; v_i int;
begin
  for r in select * from (values
    ('bovold','armyunit:bovold','settlement:bovold', 8),
    ('tsaesci','armyunit:tsaesci','settlement:coilgold', 10),
    ('tangmo','armyunit:tangmo','settlement:motang', 6),
    ('kapotun','armyunit:kapotun','settlement:potun', 8)
  ) as t(nation, unitkey, setkey, n) loop
    v_i := 0;
    for v_cid in
      select id from public.citizens
      where settlement_id = pg_temp.seed_uuid(r.setkey) and citizen_type = 'npc' and status = 'alive'
        and born_on_turn_number <= -18 and id not in (select citizen_id from public.unit_soldiers)
      order by born_on_turn_number, id limit r.n
    loop
      v_i := v_i + 1;
      insert into public.unit_soldiers (id, world_id, unit_id, citizen_id, home_settlement_id, recruited_turn_number)
      values (pg_temp.seed_uuid('soldier:' || r.nation || ':' || v_i), pg_temp.seed_uuid('world:bovold'),
              pg_temp.seed_uuid(r.unitkey), v_cid, pg_temp.seed_uuid(r.setkey), 0);
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
  dep record; pop record;
  v_has_school boolean;
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

    -- standard jobs. Food AND water are staffed proportionally to population
    -- (~pop/4 each, floored at 8, capped at building capacity) so small
    -- capitals never spend their whole adult pool on fields and starve for
    -- water — the failure that killed rulers and soldiers in earlier runs.
    v_jobs := array[pg_temp.seed_uuid('job:field-hand'), pg_temp.seed_uuid('job:water-bearer'), pg_temp.seed_uuid('job:grain-farmer'), pg_temp.seed_uuid('job:fisher')];
    v_cnts := array[
      least(v_field_cap, greatest(8, ceil(v_pop / 4.0)::int)),
      least(v_water_cap, greatest(8, ceil(v_pop / 4.0)::int)),
      3, 6];
    for j in 1..array_length(v_jobs,1) loop
      for k in 1..v_cnts[j] loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', v_jobs[j], 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;

    -- deposits: 2 workers each
    for dep in select di.id did from public.deposit_instances di where di.settlement_id = pg_temp.seed_uuid('settlement:' || r.key) and di.status = 'active' loop
      for k in 1..2 loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'deposit', dep.did, 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;

    -- husbandry (2) + culling (1) per managed population
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

    -- construction pool (3)
    for k in 1..3 loop
      exit when v_idx > v_n;
      insert into public.citizen_assignments (citizen_id, assignment_type, construction_project_id, assigned_on_turn_number)
      values (v_ids[v_idx], 'construction_project', null, 0);
      v_idx := v_idx + 1;
    end loop;

    -- teacher (capitals only)
    if v_has_school and v_idx <= v_n then
      insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
      values (v_ids[v_idx], 'standard_job', pg_temp.seed_uuid('job:teacher'), 0);
      v_idx := v_idx + 1;
    end if;

    -- ale + cloth chains (lowest priority)
    v_jobs := array[pg_temp.seed_uuid('job:brewer'), pg_temp.seed_uuid('job:cloth-weaver')];
    v_cnts := array[2, 2];
    for j in 1..array_length(v_jobs,1) loop
      for k in 1..v_cnts[j] loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', v_jobs[j], 0);
        v_idx := v_idx + 1;
      end loop;
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
      insert into public.citizen_assignments (citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number)
      values (v_cid, 'trade_route', pg_temp.seed_uuid(r.route), r.e, 0);
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
