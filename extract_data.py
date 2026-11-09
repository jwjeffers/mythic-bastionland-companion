import PyPDF2._page as pg

orig_bcm = pg.build_char_map
def custom_bcm(font_name, space_width, obj):
    t = list(orig_bcm(font_name, space_width, obj))
    t[1] = t[1] * 0.35
    return tuple(t)
pg.build_char_map = custom_bcm

import PyPDF2
import re
import json

reader = PyPDF2.PdfReader('Mythic+Bastionland.pdf')

def clean_text(s):
    s = s.replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"')
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

p26 = reader.pages[25].extract_text()
p27 = reader.pages[26].extract_text()

knight_titles = [re.sub(r'\s+', ' ', m).strip() for m in re.findall(r'\d+\.\s*(The\s+[A-Za-z\s]+?Knight)', p26)]
myth_titles = [re.sub(r'Myths$', '', re.sub(r'\s+', ' ', m)).strip() for m in re.findall(r'\d+\.\s*(The\s+[A-Za-z]+)', p27)]

knights = []
for idx in range(72):
    d6 = (idx // 12) + 1
    d12 = (idx % 12) + 1
    page_num = 28 + idx * 2
    raw = clean_text(reader.pages[page_num - 1].extract_text())
    title = knight_titles[idx]
    short_title = title.replace("The ", "")

    prompts = {}
    prompt_match = re.search(r'(Person\s*:.*)', raw, re.DOTALL)
    body = raw
    if prompt_match:
        prompt_block = prompt_match.group(1)
        body = raw[:prompt_match.start()].strip()
        prompt_block = re.sub(r'\d+\s*\n\s*\d+\s*(?:The)?\s*$', '', prompt_block).strip()
        prompt_block = re.sub(r'\d+\s*(?:The)?\s*$', '', prompt_block).strip()
        for part in re.split(r'~|\n', prompt_block):
            if ':' in part:
                k, v = part.split(':', 1)
                prompts[k.strip()] = v.strip()

    body = re.sub(r'^\d+\s*\n', '', body).strip()

    prop_match = re.search(r'PROPERTY\s*\n(.*?)(?=\nABILITY\s*-)', body, re.DOTALL)
    abil_match = re.search(r'ABILITY\s*-\s*([^\n]+)\n(.*?)(?=\nPASSION\s*-)', body, re.DOTALL)
    pass_match = re.search(r'PASSION\s*-\s*([^\n]+)\n(.*)', body, re.DOTALL)

    properties = []
    if prop_match:
        prop_text = prop_match.group(1).strip()
        for item in re.split(r'\n?\u2022\s*', prop_text):
            item = re.sub(r'\s+', ' ', item).strip()
            if item:
                properties.append(item)

    ability_name = abil_match.group(1).strip() if abil_match else ""
    ability_text = re.sub(r'\s+', ' ', abil_match.group(2)).strip() if abil_match else ""

    passion_name = pass_match.group(1).strip() if pass_match else ""
    after_passion = pass_match.group(2).strip() if pass_match else ""

    kb_match = re.search(r'KNIGHTED BY\s*\u2026?\s*\n([^\n]+)\n([^\n\u2022]+)\n((?:\u2022.*?(?=\n[A-Z]{3,}|\Z))|.*)', after_passion, re.DOTALL)
    seer_name = ""
    seer_stats = ""
    seer_bullets = []
    poem = ""
    extra_text = ""

    if kb_match:
        before_kb = after_passion[:kb_match.start()].strip()
        seer_name = kb_match.group(1).strip()
        seer_stats = kb_match.group(2).strip()
        after_kb_header = kb_match.group(3).strip()

        if short_title in before_kb:
            p_part, ext_part = before_kb.split(short_title, 1)
            extra_text = ext_part.strip()
            p_lines = [l.strip() for l in p_part.splitlines() if l.strip()]
            if len(p_lines) >= 2:
                l2 = p_lines[-1]
                l1 = p_lines[-2]
                if '.' in l1:
                    pts = l1.rsplit('.', 1)
                    if len(pts) == 2 and pts[1].strip():
                        p_lines[-2] = pts[0] + '.'
                        poem = pts[1].strip() + "\n" + l2
                        passion_text = " ".join(p_lines[:-1])
                    else:
                        poem = l1 + "\n" + l2
                        passion_text = " ".join(p_lines[:-2])
                else:
                    poem = l1 + "\n" + l2
                    passion_text = " ".join(p_lines[:-2])
            else:
                passion_text = re.sub(r'\s+', ' ', p_part).strip()
            bullet_block = after_kb_header
        else:
            passion_text = re.sub(r'\s+', ' ', before_kb).strip()
            if short_title in after_kb_header:
                b_part, ext_part = after_kb_header.split(short_title, 1)
                extra_text = ext_part.strip()
            else:
                b_part = after_kb_header
            b_lines = [l.strip() for l in b_part.splitlines() if l.strip()]
            if len(b_lines) >= 2:
                l2 = b_lines[-1]
                l1 = b_lines[-2]
                if '.' in l1:
                    pts = l1.rsplit('.', 1)
                    if len(pts) == 2 and pts[1].strip():
                        b_lines[-2] = pts[0] + '.'
                        poem = pts[1].strip() + "\n" + l2
                        bullet_block = "\n".join(b_lines[:-1])
                    else:
                        poem = l1 + "\n" + l2
                        bullet_block = "\n".join(b_lines[:-2])
                else:
                    poem = l1 + "\n" + l2
                    bullet_block = "\n".join(b_lines[:-2])
            else:
                bullet_block = b_part

        for b in re.split(r'\n?\u2022\s*', bullet_block):
            b = re.sub(r'\s+', ' ', b).strip()
            if b:
                seer_bullets.append(b)

    knights.append({
        "id": f"{d6}-{d12}",
        "d6": d6,
        "d12": d12,
        "page": page_num,
        "name": title,
        "poem": poem,
        "property": properties,
        "ability": {"name": ability_name, "text": ability_text},
        "passion": {"name": passion_name, "text": passion_text},
        "seer": {
            "name": seer_name,
            "stats": seer_stats,
            "bullets": seer_bullets
        },
        "extra": extra_text,
        "prompts": prompts
    })

myths = []
for idx in range(72):
    d6 = (idx // 12) + 1
    d12 = (idx % 12) + 1
    page_num = 29 + idx * 2
    raw = clean_text(reader.pages[page_num - 1].extract_text())
    title = myth_titles[idx]
    short_title = title.replace("The ", "")

    landmarks = {}
    lm_match = re.search(r'(Dwelling\s*:.*)', raw, re.DOTALL)
    body = raw
    if lm_match:
        lm_block = lm_match.group(1)
        body = raw[:lm_match.start()].strip()
        lm_block = re.sub(r'(?:The)?\s*$', '', lm_block).strip()
        for part in re.split(r'~|\n', lm_block):
            if ':' in part:
                k, v = part.split(':', 1)
                landmarks[k.strip()] = v.strip()

    body = re.sub(r'^\d+\s*\n', '', body).strip()
    if body.endswith(short_title):
        body = body[:-len(short_title)].strip()

    cast_split = re.split(r'\bCast\b\s*\n?', body, maxsplit=1)
    omens_raw = cast_split[0] if cast_split else body
    cast_raw = cast_split[1] if len(cast_split) > 1 else ""

    omens_raw = re.sub(r'^Omens\s*\n', '', omens_raw).strip()
    omen_parts = re.split(r'(?:^|\n)\s*([1-6])\.\s*', omens_raw)
    omens = []
    for i in range(1, len(omen_parts), 2):
        o_text = re.sub(r'\s+', ' ', omen_parts[i+1]).strip()
        omens.append(o_text)

    myths.append({
        "id": f"{d6}-{d12}",
        "d6": d6,
        "d12": d12,
        "page": page_num,
        "name": title,
        "omens": omens,
        "cast": cast_raw.strip(),
        "landmarks": landmarks
    })

city_p172 = clean_text(reader.pages[171].extract_text())
city_p173 = clean_text(reader.pages[172].extract_text())
city_omen_parts = re.split(r'(?:^|\n|(?<=\.))\s*(\d+)\.\s*', city_p172)
city_omens = []
for i in range(1, len(city_omen_parts), 2):
    num = int(city_omen_parts[i])
    if 1 <= num <= 24:
        txt = city_omen_parts[i+1]
        if num == 24:
            txt = txt.split("Omens")[0]
        city_omens.append(re.sub(r'\s+', ' ', txt).strip())

city_quest = {
    "name": "The City Quest",
    "pages": "172-173",
    "rules": "A Company worthy of the City Quest (12+ Glory) continues their knightly duties as normal, but when they would encounter an Omen from a random Myth by rolling 1 on the Wilderness Roll, they instead encounter an Omen from the City Quest. Roll d12 + number of City Omens already encountered (0 if first). On a duplicate, take the next Omen down the list (max 24). After encountering Omen 18 or higher, the City Quest ends.",
    "omens": city_omens,
    "cast": re.sub(r'^\d+\s*\n', '', city_p173).replace("Cast", "").strip()
}

# 36 Spark Tables (Pages 22-25)
spark_tables = {
    "Nature": {
        "Land": {"col1": "Character", "col2": "Landscape", "rows": [["Barren","Marsh"],["Dry","Heath"],["Grey","Crags"],["Sparse","Peaks"],["Sharp","Forest"],["Teeming","Valley"],["Still","Hills"],["Soft","Meadow"],["Overgrown","Bog"],["Vivid","Lakes"],["Sodden","Glades"],["Lush","Plain"]]},
        "Sky": {"col1": "Tone", "col2": "Texture", "rows": [["Glittering","Aurora"],["Violet","Haze"],["Sapphire","Marble"],["Pale","Glow"],["Fiery","Billows"],["Ivory","Swirl"],["Slate","Streaks"],["Pink","Dapple"],["Golden","Rays"],["Bloody","Pillars"],["Bright","Shimmer"],["Inky","Swells"]]},
        "Water": {"col1": "Tone", "col2": "Texture", "rows": [["Crystal","Silk"],["Teal","Ripples"],["Pearlescent","Abyss"],["Mucky","Churn"],["Cobalt","Froth"],["Verdant","Mirror"],["Frosted","Surge"],["Dark","Glass"],["Verdigris","Surf"],["Silver","Rapids"],["Emerald","Spray"],["Jade","Bubbles"]]},
        "Weather": {"col1": "Description", "col2": "Element", "rows": [["Gentle","Rain"],["Fleeting","Gusts"],["Persistent","Cloud"],["Bright","Sunlight"],["Thin","Mist"],["Cool","Humidity"],["Hot","Thunder"],["Solid","Dust"],["Dull","Warmth"],["Faint","Drizzle"],["Abundant","Breeze"],["Harsh","Fog"]]},
        "Flora": {"col1": "Nature", "col2": "Form", "rows": [["Aromatic","Grasses"],["Ashen","Heather"],["Blooming","Shrubs"],["Twisted","Brambles"],["Towering","Canopy"],["Fruitful","Ferns"],["Stinging","Trunks"],["Vibrant","Vines"],["Brittle","Conifers"],["Thorny","Saplings"],["Sturdy","Reeds"],["Resinous","Roots"]]},
        "Fauna": {"col1": "Nature", "col2": "Form", "rows": [["Watchful","Ungulates"],["Helpful","Songbirds"],["Graceful","Canines"],["Loud","Rodents"],["Mischievous","Amphibians"],["Deceitful","Insects"],["Enlightening","Felines"],["Placid","Reptiles"],["Beautiful","Hawks"],["Mighty","Mustelids"],["Hostile","Fowl"],["Aloof","Bears"]]},
        "Feature": {"col1": "Nature", "col2": "Form", "rows": [["Buried","Brook"],["Colourful","Seat"],["Adorned","Pit"],["Spiked","Cave"],["Split","Monolith"],["Entombed","Mound"],["Reflective","Cairn"],["Veiled","Pond"],["Hot","Waterfall"],["Drowned","Spring"],["Desecrated","Arch"],["Isolated","Henge"]]},
        "Wonder": {"col1": "Theme", "col2": "Element", "rows": [["Pleasure","Light"],["Secrets","Flames"],["Prophecy","Stones"],["Healing","Beasts"],["Desire","Sparks"],["Memory","Trails"],["Death","Mist"],["Strength","Colours"],["Temptation","Plants"],["Pain","Wind"],["Regret","Water"],["Time","Shadows"]]},
        "Otherworld": {"col1": "Character", "col2": "Landscape", "rows": [["Acidic","Flats"],["Black","Labyrinth"],["Smoke","Ruins"],["Frozen","Stairs"],["Dead","Desert"],["Broken","Craters"],["Colossal","Cavern"],["Living","Jungle"],["Burning","Dunes"],["Sludge","Tunnels"],["White","Island"],["Sweet","Mountain"]]}
    },
    "Civilisation": {
        "Holding": {"col1": "Style", "col2": "Feature", "rows": [["Dark","Turrets"],["Ruined","Tower"],["Hostile","Wall"],["Ancient","Battlements"],["Ornate","Citadel"],["Wild","Gate"],["Pristine","Spire"],["Fortified","Dome"],["Unfinished","Beacons"],["Welcoming","Bridge"],["Proud","Pillars"],["Bright","Moat"]]},
        "Bailey": {"col1": "Style", "col2": "Feature", "rows": [["Filthy","Marketplace"],["Abandoned","Forge"],["Joyous","Library"],["Sophisticated","Fountain"],["Industrious","Temple"],["Humble","Forum"],["Majestic","Tomb"],["Hallowed","Garden"],["Rustic","Hall"],["Solemn","Workshops"],["Bustling","Arena"],["Immaculate","Garrison"]]},
        "Keep": {"col1": "Centrepiece", "col2": "Decoration", "rows": [["Hearth","Antlers"],["Throne","Silver"],["Musicians","Heraldry"],["Pool","Bones"],["Advisers","Flowers"],["Servants","Scripture"],["Shrine","Jewels"],["Table","Wreaths"],["Reliquary","Candles"],["Cauldron","Fur"],["Chandelier","Tapestries"],["Guards","Shields"]]},
        "Food": {"col1": "Quality", "col2": "Type", "rows": [["Spiced","Fish"],["Herbal","Fruit"],["Crunchy","Stew"],["Sour","Mushrooms"],["Dry","Pie"],["Fermented","Cheese"],["Salted","Nuts"],["Wet","Cake"],["Fatty","Porridge"],["Chewy","Bread"],["Sweet","Vegetable"],["Mild","Meat"]]},
        "Goods": {"col1": "Theme", "col2": "Type", "rows": [["Military","Textile"],["Abundant","Livestock"],["Traditional","Grain"],["Specialist","Mead"],["Industrious","Tools"],["Innovative","Stone"],["Secretive","Wood"],["Simple","Pottery"],["Strong","Metal"],["Decorated","Leather"],["Fine","Honey"],["Lucky","Herb"]]},
        "Luxuries": {"col1": "Rarity", "col2": "Type", "rows": [["Antique","Jewel"],["Intricate","Wine"],["Unique","Spice"],["Scarce","Fragrance"],["Hazardous","Silk"],["Flawless","Fur"],["Luminous","Artwork"],["Lost","Sword"],["Esoteric","Creature"],["Sacred","Ore"],["Mythical","Root"],["Beautiful","Scripture"]]},
        "Drama": {"col1": "Theme", "col2": "Detail", "rows": [["Betrayal","Brawl"],["Jealousy","Poison"],["Rivalry","Oath"],["Infidelity","Feast"],["Coup","Letters"],["Ambition","Disguise"],["Redemption","Inheritance"],["Revelation","Assassin"],["Wrath","Family"],["Greed","Alcohol"],["Banishment","Blackmail"],["Manipulation","Gold"]]},
        "Woe": {"col1": "Description", "col2": "Incident", "rows": [["Secretive","Disease"],["Violent","Famine"],["Looming","Raids"],["Sudden","Invasion"],["Ongoing","Abduction"],["Prophecised","Storm"],["Mysterious","Fire"],["Sanctioned","Revolt"],["Unseen","Exodus"],["Vast","Beast"],["Escalating","Killing"],["Concealed","Theft"]]},
        "News": {"col1": "Subject", "col2": "Mood", "rows": [["Duel","Pensive"],["Birth","Joyous"],["Market","Content"],["Trial","Divided"],["Ritual","Furious"],["Mercenaries","Sceptical"],["Festival","Adoring"],["Tournament","Nostalgic"],["Punishment","Unified"],["Performance","Bleak"],["Death","Solemn"],["Marriage","Optimistic"]]}
    },
    "People": {
        "Appearance": {"col1": "Physique", "col2": "Dress", "rows": [["Delicate","Armoured"],["Short","Tattered"],["Robust","Vibrant"],["Hard","Crude"],["Haggard","Eclectic"],["Cold","Traditional"],["Warm","Comfortable"],["Youthful","Gaudy"],["Soft","Drab"],["Sickly","Decorated"],["Tall","Functional"],["Rough","Elegant"]]},
        "Voice": {"col1": "Tone", "col2": "Manner", "rows": [["Whispering","Formal"],["Soothing","Poetic"],["Smooth","Precise"],["Flat","Intense"],["Mumbled","Rambling"],["Weak","Detached"],["Strong","Passionate"],["Hesitant","Terse"],["Melodic","Relaxed"],["Gravelly","Blunt"],["Erratic","Boisterous"],["Booming","Friendly"]]},
        "Personality": {"col1": "Demeanour", "col2": "Interest", "rows": [["Cautious","Botany"],["Spiritual","History"],["Intellectual","Music"],["Ambitious","Gambling"],["Serene","Animals"],["Righteous","Art"],["Empathetic","Cookery"],["Unstable","Craft"],["Prying","Fishing"],["Melancholic","Fashion"],["Cynical","Hunting"],["Rash","Stories"]]},
        "Relationship": {"col1": "State", "col2": "Connection", "rows": [["Adoring","Kin"],["Reluctant","Friend"],["Secret","Lover"],["Estranged","Spouse"],["Hateful","Supporter"],["Distant","Ally"],["Harmonious","Rival"],["Intimate","Successor"],["Recent","Mentor"],["Sworn","Peer"],["Tumultuous","Enemy"],["Resentful","Guardian"]]},
        "Desire": {"col1": "Ambition", "col2": "Motive", "rows": [["Escape","Freedom"],["Wealth","Love"],["Status","Legacy"],["Knowledge","Recovery"],["Mastery","Revenge"],["Heirloom","Duty"],["Marriage","Fear"],["Truth","Guilt"],["Travel","Recognition"],["Power","Defiance"],["Security","Curiosity"],["Forgiveness","Hatred"]]},
        "Task": {"col1": "Action", "col2": "Subject", "rows": [["Investigate","Knight"],["Capture","Seer"],["Destroy","Vassals"],["Transport","Livestock"],["Retrieve","Monument"],["Mend","Gold"],["Break","Ruin"],["Guard","Animals"],["Aid","Dwelling"],["Salvage","Holding"],["Conceal","Bridge"],["Hunt","Warband"]]},
        "Background": {"col1": "Upbringing", "col2": "Memory", "rows": [["Deprived","War"],["Pious","Migration"],["Outcast","Riding"],["Military","Study"],["Insular","Exile"],["Nomadic","Joy"],["Drudgery","Sickness"],["Mercantile","Escape"],["Feral","Injury"],["Prestigious","Friendship"],["Academic","Execution"],["Pampered","Romance"]]},
        "Ailment": {"col1": "Descriptor", "col2": "Symptom", "rows": [["Hidden","Insomnia"],["Mild","Migraines"],["Intermittent","Arthritis"],["Growing","Nausea"],["Medicated","Fixation"],["Denied","Blindness"],["Unexplained","Deafness"],["Constant","Melancholy"],["Diminishing","Shaking"],["Permanent","Frailty"],["Debilitating","Coughing"],["Obvious","Lethargy"]]},
        "Heraldry": {"col1": "Palette", "col2": "Symbol", "rows": [["Light","Beast"],["Hot","Bird"],["Earthy","Fish"],["Rich","Weapon"],["Metallic","Crown"],["Brilliant","Tree"],["Grey","Flower"],["Jewelled","Bodypart"],["Subdued","Structure"],["Airy","Ring"],["Cold","Tool"],["Dark","Star"]]}
    },
    "Combat": {
        "Soldier": {"col1": "Quality", "col2": "Type", "rows": [["Mobile","Skirmisher"],["Reluctant","Archer"],["Mounted","Scout"],["Renowned","Militia"],["Zealous","Guard"],["Conscript","Infiltrator"],["Cowardly","Raider"],["Heavy","Veteran"],["Bloodthirsty","Infantry"],["Fancy","Rider"],["Fearsome","Charger"],["Mercenary","Knight"]]},
        "Weapon": {"col1": "Descriptor", "col2": "Feature", "rows": [["Short","Blade"],["Pole","Spear"],["Chain","Axe"],["Barbed","Mace"],["Forked","Cleaver"],["Curved","Hammer"],["Weighted","Spike"],["Double","Hook"],["Crossed","Club"],["Throwing","Rod"],["Thin","Fang"],["Long","Sword"]]},
        "Manoeuvres": {"col1": "Action", "col2": "Intent", "rows": [["Feint","Demoralise"],["Strike","Confuse"],["Boast","Exploit"],["Defend","Stall"],["Negotiate","Relocate"],["Flurry","Observe"],["Rush","Defeat"],["Taunt","Expose"],["Jab","Surprise"],["Charge","Stagger"],["Onslaught","Weaken"],["Provoke","Intimidate"]]},
        "Conflict": {"col1": "Dispute", "col2": "Status", "rows": [["Border","War"],["Religion","Raids"],["Succession","Animosity"],["Resource","Truce"],["Debt","Skirmishes"],["Betrayal","Standoff"],["Theft","Occupation"],["Conquest","Stalemate"],["Marriage","Blockade"],["Deceit","Tension"],["Waterway","Forgotten"],["Bloodfeud","Negotiations"]]},
        "Duel": {"col1": "Stipulation", "col2": "Twist", "rows": [["Joust","Timed"],["Swords","Pit"],["Partner","Bridge"],["Team","Immobile"],["Unarmoured","Maze"],["Chained","Archers"],["Blood","Fire"],["Death","Beasts"],["Surrender","Mud"],["Judged","Night"],["Blunt","Water"],["Javelins","Cage"]]},
        "Battlefield": {"col1": "Feature", "col2": "Detail", "rows": [["River","Smoke"],["Ruins","Mud"],["Hill","Flies"],["Forest","Trenches"],["Lake","Tower"],["Outpost","Boulders"],["Pass","Flowers"],["Farm","Streams"],["Trail","Thorns"],["Bridge","Stink"],["Wall","Ravine"],["Dwelling","Tombs"]]},
        "Deployment": {"col1": "Style", "col2": "Formation", "rows": [["Aggressive","Line"],["Mobile","Column"],["Tight","Chevron"],["Deceptive","Ranks"],["Shielded","Square"],["Rigid","Circle"],["Flexible","Flank"],["Open","Skirmish"],["Focused","Block"],["Dispersed","Square"],["Reinforced","Wedge"],["Defensive","Scatter"]]},
        "Strategy": {"col1": "Plan", "col2": "Twist", "rows": [["Encircle","Darkness"],["Capture","Reserves"],["Assault","Diversion"],["Harass","Betrayal"],["Pillage","Artillery"],["Outlast","Camouflage"],["Ambush","Bluff"],["Overwhelm","Delay"],["Blockade","Decoy"],["Divide","Bait"],["Focus","Sacrifice"],["Counter","Fire"]]},
        "Event": {"col1": "Subject", "col2": "Event", "rows": [["Allies","Collapse"],["Morale","Attack"],["Weather","Slaughter"],["Terrain","Stalemate"],["Strategy","Stall"],["Discipline","Falter"],["Animal","Sabotage"],["Opportunists","Scatter"],["Deception","Charge"],["Leader","Confusion"],["Loot","Worsening"],["Weapons","Discovery"]]}
    }
}

output_obj = {
    "knights": knights,
    "myths": myths,
    "cityQuest": city_quest,
    "sparkTables": spark_tables
}

with open("data.js", "w", encoding="utf-8") as f:
    f.write("window.MB_DATA = ")
    json.dump(output_obj, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print("Wrote data.js successfully! Knights:", len(knights), "Myths:", len(myths), "City Omens:", len(city_quest["omens"]))
