# xkcd-only name audit (automated first pass 2026-10-09, verified and applied same day)

Every data/library.json entry whose only source is `xkcd` (the 2010 crowd-survey): 186 names (85 of them also titled in the Learn layer, data/core-names.json). This is a wider sweep than the `-ish` pass (see tools/vague_ish_merge.py, applied separately): per the coordinator's 2026-10-08 scope extension, classify every xkcd-only name, not just the `-ish` ones.

**Verified and applied.** The original 32 CRUDE + 75 ALIAS rows were an automated pattern-rule pass (crude-word blocklist, modifier+base-hue compound detection, spelling-variant matching); this run's human/dictionary check reclassified 54 of the original 79 `KEEP?` rows to ALIAS (compound/slang/pop-culture/non-English/redundancy patterns the automated pass's rules missed) and confirmed 25 as real, independently-recognizable color words. All three verdicts are now applied by tools/xkcd_audit_merge.py: CRUDE is dropped from data/library.json and data/core-names.json entirely (no title, no alias, no trace); ALIAS is merged onto its nearest surviving name (library.json `altn`, core-names.json `also`, data/aliases.json so `#/name/<slug>` addresses and saved cards still resolve); KEEP is unchanged. The dE column is each ALIAS/CRUDE row's actual merge target and distance (CIEDE2000), as applied.

## Counts

- CRUDE: 32 (dropped)
- ALIAS: 129 (75 original + 54 reclassified from KEEP?; merged onto a surviving name)
- KEEP: 25 (of the original 79 `KEEP?` rows; unchanged)

## Table

| Name | Hex | Layer | Verdict | Reason | Candidate alias target |
|---|---|---|---|---|---|
| Baby Purple | #CA9BF7 | Learn | ALIAS | modifier+base compound ('baby' + base hue), not a distinct name | Lavender (dE 4.4) |
| Bright Blue | #0165FC | Archive | ALIAS | modifier+base compound ('bright' + base hue), not a distinct name | Royal Blue (dE 3.4) |
| Bright Light Blue | #26F7FD | Archive | ALIAS | modifier+base compound ('bright' + base hue), not a distinct name | Aqua (dE 2.6) |
| Bright Magenta | #FF08E8 | Archive | ALIAS | modifier+base compound ('bright' + base hue), not a distinct name | Magenta (dE 3.1) |
| Bright Olive | #9CBB04 | Learn | ALIAS | modifier+base compound ('bright' + base hue), not a distinct name | Acid Green (dE 3.7) |
| Bright Pink | #FE01B1 | Learn | ALIAS | modifier+base compound ('bright' + base hue), not a distinct name | Hollywood Cerise (dE 3.0) |
| Brownish Green | #6A6E09 | Archive | ALIAS | -ish crowd modifier slang | Spanish Bistre (dE 7.2) |
| Brownish Pink | #C27E79 | Archive | ALIAS | -ish crowd modifier slang | Old Rose (dE 2.6) |
| Cool Green | #33B864 | Archive | ALIAS | modifier+base compound ('cool' + base hue), not a distinct name | Shamrock (dE 3.6) |
| Dark Aqua | #05696B | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Dark Aquamarine (dE 3.9) |
| Dark Beige | #AC9362 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Dust (dE 2.6) |
| Dark Blue Grey | #1F3B4D | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Dark Grey Blue (dE 3.8) |
| Dark Cream | #FFF39A | Archive | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Light Green-Yellow (dE 2.9) |
| Dark Forest Green | #002D04 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Phthalo Green (dE 8.0) |
| Dark Green Blue | #1F6357 | Archive | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Opal Green (dE 2.7) |
| Dark Indigo | #1F0954 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Paua (dE 2.9) |
| Dark Lilac | #9C6DA5 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Viola (dE 3.2) |
| Dark Lime | #84B701 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Avocado Green (dE 4.5) |
| Dark Maroon | #3C0008 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Dark Sienna (dE 5.4) |
| Dark Mauve | #874C62 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Corinthian Purple (dE 3.2) |
| Dark Mustard | #A88905 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Light hazel (dE 5.2) |
| Dark Pink | #CB416B | Archive | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Ruber (dE 2.6) |
| Dark Rose | #B5485D | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Pomegranate Purple (dE 2.7) |
| Dark Sage | #598556 | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Hay's Green (dE 2.8) |
| Dark Tan | #AF884A | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Pinchbeck Brown (dE 2.7) |
| Dark Yellow Green | #728F02 | Archive | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name | Bright moss (dE 3.6) |
| Deep Lilac | #966EBD | Learn | ALIAS | modifier+base compound ('deep' + base hue), not a distinct name | Middle Blue Purple (dE 3.2) |
| Deep Purple | #36013F | Archive | ALIAS | modifier+base compound ('deep' + base hue), not a distinct name | Petunia (dE 5.3) |
| Deep Sea Blue | #015482 | Archive | ALIAS | modifier+base compound ('deep' + base hue), not a distinct name | Light Navy (dE 3.1) |
| Deep Violet | #490648 | Learn | ALIAS | modifier+base compound ('deep' + base hue), not a distinct name | Petunia (dE 4.6) |
| Dirty Blue | #3F829D | Archive | ALIAS | modifier+base compound ('dirty' + base hue), not a distinct name | Chessylite Blue (dE 2.8) |
| Dirty Green | #667E2C | Archive | ALIAS | modifier+base compound ('dirty' + base hue), not a distinct name | Khaki Green (dE 3.6) |
| Dirty Pink | #CA7B80 | Archive | ALIAS | modifier+base compound ('dirty' + base hue), not a distinct name | Old Rose (dE 2.9) |
| Dirty Purple | #734A65 | Archive | ALIAS | modifier+base compound ('dirty' + base hue), not a distinct name | Dull Dark Purple (dE 2.6) |
| Dirty Yellow | #CDC50A | Archive | ALIAS | modifier+base compound ('dirty' + base hue), not a distinct name | Citronelle (dE 4.1) |
| Drab Green | #749551 | Archive | ALIAS | modifier+base compound ('drab' + base hue), not a distinct name | Swedish Green (dE 4.4) |
| Dull Blue | #49759C | Archive | ALIAS | modifier+base compound ('dull' + base hue), not a distinct name | Flat Blue (dE 2.5) |
| Dusty Red | #B9484E | Archive | ALIAS | modifier+base compound ('dusty' + base hue), not a distinct name | English Red (dE 3.2) |
| Dusty Teal | #4C9085 | Learn | ALIAS | modifier+base compound ('dusty' + base hue), not a distinct name | Mint Turquoise (dE 2.9) |
| Faded Blue | #658CBB | Learn | ALIAS | modifier+base compound ('faded' + base hue), not a distinct name | Clear Cadet Blue (dE 3.2) |
| Faded Green | #7BB274 | Archive | ALIAS | modifier+base compound ('faded' + base hue), not a distinct name | Arcadian Green (dE 2.5) |
| Greenish Brown | #696112 | Archive | ALIAS | -ish crowd modifier slang | Drabolve (dE 2.7) |
| Greenish Teal | #32BF84 | Archive | ALIAS | -ish crowd modifier slang | Imperial Green (dE 3.9) |
| Greyish Pink | #C88D94 | Archive | ALIAS | -ish crowd modifier slang | Grey Pink (dE 2.6) |
| Hot Purple | #CB00F5 | Archive | ALIAS | modifier+base compound ('hot' + base hue), not a distinct name | Bright Purple (dE 2.6) |
| Light Greenish Blue | #63F7B4 | Archive | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Greenish Cyan (dE 2.9) |
| Light Khaki | #E6F2A2 | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Viridine Green (dE 3.3) |
| Light Light Green | #C8FFB0 | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Very Light Green (dE 2.6) |
| Light Magenta | #FA5FF7 | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Ultra Pink (dE 2.9) |
| Light Maroon | #A24857 | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Pomegranate Purple (dE 2.6) |
| Light Mint | #B6FFBB | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Very Light Green (dE 4.5) |
| Light Navy Blue | #2E5A88 | Archive | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Newport (dE 2.5) |
| Light Pastel Green | #B2FBA5 | Archive | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Light Green (dE 4.5) |
| Light Plum | #9D5783 | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Antique Fuchsia (dE 3.2) |
| Light Royal Blue | #3A2EFE | Archive | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Vibrant Blue (dE 3.0) |
| Light Sage | #BCECAC | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name | Light Grey Green (dE 2.5) |
| Lighter Purple | #A55AF4 | Archive | ALIAS | modifier+base compound ('lighter' + base hue), not a distinct name | Bright Lavender (dE 6.4) |
| Liliac | #C48EFD | Archive | ALIAS | spelling variant of another name | Bright Lilac (dE 5.6) |
| Medium Brown | #7F5112 | Learn | ALIAS | modifier+base compound ('medium' + base hue), not a distinct name | Bismarck Brown (dE 5.7) |
| Muddy Brown | #886806 | Learn | ALIAS | modifier+base compound ('muddy' + base hue), not a distinct name | Imperial Stone (dE 4.1) |
| Muddy Green | #657432 | Learn | ALIAS | modifier+base compound ('muddy' + base hue), not a distinct name | Velvet Green (dE 4.6) |
| Pale Salmon | #FFB19A | Learn | ALIAS | modifier+base compound ('pale' + base hue), not a distinct name | Flesh Color (dE 3.3) |
| Pale Teal | #82CBB2 | Learn | ALIAS | modifier+base compound ('pale' + base hue), not a distinct name | Light Sulphate Green (dE 3.5) |
| Pastel Red | #DB5856 | Archive | ALIAS | modifier+base compound ('pastel' + base hue), not a distinct name | Indian Red (dE 3.0) |
| Pinkish Brown | #B17261 | Archive | ALIAS | -ish crowd modifier slang | Cacao Brown (dE 2.8) |
| Rich Purple | #720058 | Archive | ALIAS | modifier+base compound ('rich' + base hue), not a distinct name | Cellini (dE 4.8) |
| Soft Blue | #6488EA | Learn | ALIAS | modifier+base compound ('soft' + base hue), not a distinct name | Clear Cadet Blue (dE 3.2) |
| Soft Green | #6FC276 | Learn | ALIAS | modifier+base compound ('soft' + base hue), not a distinct name | Mantis (dE 3.5) |
| Soft Purple | #A66FB5 | Learn | ALIAS | modifier+base compound ('soft' + base hue), not a distinct name | Amparo Purple (dE 4.6) |
| Vibrant Purple | #AD03DE | Learn | ALIAS | modifier+base compound ('vibrant' + base hue), not a distinct name | Dark Orchid (dE 3.8) |
| Warm Blue | #4B57DB | Learn | ALIAS | modifier+base compound ('warm' + base hue), not a distinct name | Majorelle Blue (dE 3.9) |
| Warm Brown | #964E02 | Learn | ALIAS | modifier+base compound ('warm' + base hue), not a distinct name | Windsor Tan (dE 4.1) |
| Warm Pink | #FB5581 | Archive | ALIAS | modifier+base compound ('warm' + base hue), not a distinct name | Rosy Pink (dE 3.4) |
| Warm Purple | #952E8F | Archive | ALIAS | modifier+base compound ('warm' + base hue), not a distinct name | Hyacinth Violet (dE 4.8) |
| Weird Green | #3AE57F | Learn | ALIAS | modifier+base compound ('weird' + base hue), not a distinct name | Android Green (dE 2.7) |
| Baby Poo | #AB9004 | Archive | CRUDE | crude/vulgar crowd-survey word | Ocher (dE 4.7) |
| Baby Poop | #937C00 | Archive | CRUDE | crude/vulgar crowd-survey word | Hazel (dE 3.1) |
| Baby Poop Green | #8F9805 | Archive | CRUDE | crude/vulgar crowd-survey word | Pea Soup Green (dE 4.4) |
| Baby Puke Green | #B6C406 | Archive | CRUDE | crude/vulgar crowd-survey word | Acid Green (dE 1.7) |
| Baby Shit Brown | #AD900D | Archive | CRUDE | crude/vulgar crowd-survey word | Ocher (dE 4.4) |
| Baby Shit Green | #889717 | Archive | CRUDE | crude/vulgar crowd-survey word | Calliste Green (dE 4.5) |
| Barf Green | #94AC02 | Archive | CRUDE | crude/vulgar crowd-survey word | Pea Soup Green (dE 2.1) |
| Booger | #9BB53C | Archive | CRUDE | crude/vulgar crowd-survey word | Neva Green (dE 4.2) |
| Booger Green | #96B403 | Archive | CRUDE | crude/vulgar crowd-survey word | Pea Soup Green (dE 4.3) |
| Diarrhea | #9F8303 | Archive | CRUDE | crude/vulgar crowd-survey word | Old Moss Green (dE 4.9) |
| Piss Yellow | #DDD618 | Archive | CRUDE | crude/vulgar crowd-survey word | Citrine (dE 3.2) |
| Poo | #8F7303 | Archive | CRUDE | crude/vulgar crowd-survey word | Hazel (dE 1.9) |
| Poo Brown | #885F01 | Archive | CRUDE | crude/vulgar crowd-survey word | Antique (dE 4.2) |
| Poop | #7F5E00 | Archive | CRUDE | crude/vulgar crowd-survey word | Mud (dE 3.9) |
| Poop Brown | #7A5901 | Archive | CRUDE | crude/vulgar crowd-survey word | Mud (dE 3.6) |
| Poop Green | #6F7C00 | Archive | CRUDE | crude/vulgar crowd-survey word | Olive (dE 4.5) |
| Puke | #A5A502 | Archive | CRUDE | crude/vulgar crowd-survey word | Pea Soup Green (dE 4.8) |
| Puke Brown | #947706 | Archive | CRUDE | crude/vulgar crowd-survey word | Hazel (dE 2.1) |
| Puke Green | #9AAE07 | Archive | CRUDE | crude/vulgar crowd-survey word | Pea Soup Green (dE 2.5) |
| Puke Yellow | #C2BE0E | Archive | CRUDE | crude/vulgar crowd-survey word | Cadmium Lemon (dE 4.3) |
| Shit | #7F5F00 | Archive | CRUDE | crude/vulgar crowd-survey word | Mud (dE 3.8) |
| Shit Brown | #7B5804 | Archive | CRUDE | crude/vulgar crowd-survey word | Mud (dE 4.2) |
| Shit Green | #758000 | Archive | CRUDE | crude/vulgar crowd-survey word | Olive (dE 3.2) |
| Snot | #ACBB0D | Archive | CRUDE | crude/vulgar crowd-survey word | Acid Green (dE 1.1) |
| Snot Green | #9DC100 | Archive | CRUDE | crude/vulgar crowd-survey word | Slime Green (dE 3.3) |
| Ugly Blue | #31668A | Learn | CRUDE | crude/vulgar crowd-survey word | Pavonine (dE 2.9) |
| Ugly Brown | #7D7103 | Archive | CRUDE | crude/vulgar crowd-survey word | Hazel (dE 5.0) |
| Ugly Green | #7A9703 | Archive | CRUDE | crude/vulgar crowd-survey word | Bright moss (dE 3.6) |
| Ugly Purple | #A442A0 | Archive | CRUDE | crude/vulgar crowd-survey word | Byzantine (dE 4.5) |
| Vomit | #A2A415 | Archive | CRUDE | crude/vulgar crowd-survey word | Pea Soup Green (dE 3.9) |
| Vomit Green | #89A203 | Archive | CRUDE | crude/vulgar crowd-survey word | Pea Soup Green (dE 2.2) |
| Vomit Yellow | #C7C10C | Archive | CRUDE | crude/vulgar crowd-survey word | Citronelle (dE 4.4) |
| Algae | #54AC68 | Learn | KEEP | real nature/descriptive color word in common use (same "skip if obvious" class as Avocado/Celery), applied |  |
| Algae Green | #21C36F | Archive | ALIAS | redundant modifier+base ('algae' is already green); 'Algae' alone is kept, applied | Algae (dE 7.1) |
| Almost Black | #070D0D | Archive | ALIAS | a description, not a name; functions like an idiom, not a standalone color word, applied | Rich Black (FOGRA39) (dE 2.7) |
| Apple | #6ECB3C | Learn | KEEP | real fruit-color word in common use (same "skip if obvious" class as Avocado/Celery), applied |  |
| Army Green | #4B5D16 | Archive | KEEP | widely recognized dictionary/idiom military color term, applied |  |
| Asparagus | #77AB56 | Archive | KEEP | real vegetable-color word, Crayola-class usage (same "skip if obvious" class), applied |  |
| Avocado | #90B134 | Learn | KEEP | given as obvious in the brief, applied |  |
| Azul | #1D5DEC | Learn | ALIAS | Spanish for 'blue'; naming policy keeps non-English words out of Learn/Archive titles, applied | Electric Blue (dE 3.9) |
| Barney | #AC1DB8 | Archive | ALIAS | pop-culture nickname (the purple dinosaur), not a dictionary color word, applied | Purple (Munsell) (dE 4.3) |
| Barney Purple | #A00498 | Archive | ALIAS | pop-culture nickname (the purple dinosaur), not a dictionary color word, applied | Dark Magenta (dE 4.3) |
| Blue Purple | #5729CE | Learn | ALIAS | tautological two-base-hue compound, not a distinct name, applied | Bluish Purple (dE 6.5) |
| Bluey Purple | #6241C7 | Archive | ALIAS | -y crowd modifier slang on a two-base-hue compound, applied | Blurple (dE 2.7) |
| Blurple | #5539CC | Archive | KEEP | genuine independent portmanteau usage beyond xkcd (Discord's brand color), applied |  |
| Boring Green | #63B365 | Archive | ALIAS | subjective crowd judgment word, not a distinct name, applied | Algae (dE 3.3) |
| Brick Orange | #C14A09 | Archive | ALIAS | modifier+base compound ('brick' + base hue), not independently documented, applied | Sinopia (dE 3.3) |
| Brown Yellow | #B29705 | Learn | ALIAS | tautological two-base-hue compound, not a distinct name, applied | Pyrite Yellow (dE 5.0) |
| Browny Orange | #CA6B02 | Archive | ALIAS | -y crowd modifier slang, applied | Xanthine Orange (dE 3.0) |
| Burnt Siena | #B75203 | Learn | ALIAS | misspelling of Burnt Sienna, already a non-xkcd library name, applied | Windsor Tan (dE 4.4; library-level target is the exact 'Burnt Sienna', dE 16.8 -- its hex is kept in `alts`) |
| Burple | #6832E3 | Archive | ALIAS | crowd portmanteau (blue+purple), less documented than Blurple, which is kept, applied | Blurple (dE 4.0) |
| Celery | #C1FD95 | Learn | KEEP | given as obvious in the brief, applied |  |
| Dark Seafoam | #1FB57A | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name, applied | Jade (dE 4.0) |
| Dark Taupe | #7F684E | Learn | ALIAS | modifier+base compound ('dark' + base hue), not a distinct name, applied | Sepia (dE 3.9) |
| Dirt Brown | #836539 | Archive | ALIAS | redundant modifier+base (dirt is already brown), applied | Dresden Brown (dE 2.8) |
| Dusky Rose | #BA6873 | Learn | ALIAS | variant wording of Dusty Rose, already a non-xkcd library name, applied | Dusty Rose (dE 3.5) |
| Easter Green | #8CFD7E | Archive | ALIAS | seasonal modifier+base compound, not a distinct name, applied | Lighter Green (dE 3.1) |
| Easter Purple | #C071FE | Learn | ALIAS | seasonal modifier+base compound, not a distinct name, applied | Bright Lavender (dE 3.3) |
| Flat Green | #699D4C | Learn | ALIAS | modifier+base compound ('flat' + base hue), not a distinct name, applied | Fern (dE 4.0) |
| Fresh Green | #69D84F | Learn | ALIAS | modifier+base compound ('fresh' + base hue), not a distinct name, applied | Apple (dE 3.6) |
| Grape Purple | #5D1451 | Learn | ALIAS | redundant modifier+base; 'Grape' alone is already a non-xkcd library name, applied | Grape (dE 7.4; core-level target Byzantium, dE 5.6) |
| Grass | #5CAC2D | Archive | KEEP | real nature/descriptive color word in common use (same "skip if obvious" class), applied |  |
| Grassy Green | #419C03 | Archive | ALIAS | redundant modifier+base; 'Grass' alone is kept, applied | Grass (dE 5.7) |
| Green Apple | #5EDC1F | Learn | ALIAS | fruit+base-hue compound; 'Apple Green' (Werner) is a different, duller shade, so this merges on nearest color instead, applied | Vibrant Green (dE 3.3; core-level target Apple Green, dE 4.3) |
| Greeny Blue | #42B395 | Archive | ALIAS | -y crowd modifier slang, applied | Jungle Green (dE 3.4) |
| Hospital Green | #9BE5AA | Learn | KEEP | documented idiom for institutional pale green, real distinctive dictionary sense, applied |  |
| Kermit Green | #5CB200 | Archive | ALIAS | pop-culture nickname (Kermit the Frog), not a dictionary color word, applied | Kelly Green (dE 3.2) |
| Kiwi | #9CEF43 | Archive | KEEP | real fruit-color word, Crayola-class usage, applied |  |
| Kiwi Green | #8EE53F | Learn | ALIAS | redundant modifier+base; 'Kiwi' alone is kept, applied | Kiwi (dE 2.5; core-level target Apple Green, dE 5.9) |
| Lavender Pink | #DD85D7 | Learn | KEEP | documented Wikipedia/standard web-color name, distinct hue, applied |  |
| Leafy Green | #51B73B | Archive | ALIAS | modifier+base compound ('leafy' + base hue), not a distinct name, applied | Yellow-Green (Color Wheel) (dE 3.3) |
| Light Aquamarine | #7BFDC7 | Archive | ALIAS | modifier+base compound ('light' + base hue), not a distinct name, applied | Aquamarine (dE 2.7) |
| Light Burgundy | #A8415B | Archive | ALIAS | modifier+base compound ('light' + base hue), not a distinct name, applied | Pomegranate Purple (dE 3.2) |
| Light Seafoam | #A0FEBF | Learn | ALIAS | modifier+base compound ('light' + base hue), not a distinct name, applied | Seafoam (dE 3.8) |
| Merlot | #730039 | Learn | KEEP | real wine-color term widely used, applied |  |
| Metallic Blue | #4F738E | Learn | KEEP | common automotive/product descriptor, real independent usage, applied |  |
| Midnight Purple | #280137 | Learn | KEEP | real independent commercial usage (e.g. the Nissan GT-R paint color), applied |  |
| Military Green | #667C3E | Learn | KEEP | widely recognized dictionary/idiom color term, same class as Army Green, applied |  |
| Milk Chocolate | #7F4E1E | Learn | KEEP | real confectionery color term, widely used, applied |  |
| Mud Brown | #60460F | Learn | ALIAS | redundant modifier+base; 'Mud' alone is already a non-xkcd library name, applied | Mud (dE 8.3; hex kept in `alts`) |
| Mud Green | #606602 | Learn | ALIAS | redundant modifier+base; 'Mud' alone is already a non-xkcd library name, applied | Mud (dE 10.4; hex kept in `alts`) |
| Murky Green | #6C7A0E | Learn | ALIAS | modifier+base compound ('murky' + base hue), not a distinct name, applied | Swamp Green (dE 4.4) |
| Mustard Green | #A8B504 | Learn | KEEP | real dictionary/vegetable-color term, matches the already-documented Mustard Yellow, applied |  |
| Nasty Green | #70B23F | Archive | ALIAS | subjective derogatory crowd descriptor, same pattern as the CRUDE 'Ugly X' rows, applied | Leaf (dE 2.6) |
| Ocean | #017B92 | Learn | KEEP | real nature/descriptive color word in common use, applied |  |
| Orangey Brown | #B16002 | Archive | ALIAS | -y crowd modifier slang, applied | Brown Orange (dE 3.5) |
| Orangey Red | #FA4224 | Archive | ALIAS | -y crowd modifier slang, applied | Scarlet (dE 3.2) |
| Pea Soup | #929901 | Learn | ALIAS | redundant word-order variant of the already-documented 'Pea Soup Green', applied | Pea Soup Green (dE 4.4; core-level target Avocado, dE 5.7) |
| Peachy Pink | #FF9A8A | Learn | ALIAS | modifier+base compound ('peachy' + base hue), not a distinct name, applied | Salmon (dE 5.9) |
| Pink Purple | #DB4BDA | Learn | ALIAS | tautological two-base-hue compound, not a distinct name, applied | Medium Orchid (dE 5.5) |
| Pure Blue | #0203E2 | Learn | ALIAS | modifier+base compound ('pure' + base hue), not a distinct name, applied | Zaffre (dE 7.1) |
| Purple Grey | #866F85 | Learn | ALIAS | tautological two-base-hue compound, not a distinct name, applied | Grey Purple (dE 3.4) |
| Purpley | #8756E4 | Archive | ALIAS | -ey crowd spelling slang (non-standard spelling of purplish/purply), applied | Medium Slate Blue (dE 5.8) |
| Purpley Grey | #947E94 | Archive | ALIAS | -ey crowd spelling slang, applied | Vestal (dE 3.1) |
| Purpley Pink | #C83CB9 | Archive | ALIAS | -ey crowd spelling slang, applied | Pinky Purple (dE 2.9) |
| Purply | #983FB2 | Learn | ALIAS | -y crowd spelling slang (non-standard spelling of purplish), applied | Purple Plum (dE 4.3) |
| Purply Pink | #F075E6 | Learn | ALIAS | -y crowd spelling slang, applied | Orchid (dE 4.1) |
| Racing Green | #014600 | Learn | KEEP | given as obvious in the brief, applied |  |
| Red Pink | #FA2A55 | Archive | ALIAS | tautological two-base-hue compound, not a distinct name, applied | Pink Red (dE 2.8) |
| Red Wine | #8C0034 | Learn | KEEP | real fashion/wine color term, applied |  |
| Reddy Brown | #6E1005 | Archive | ALIAS | -y crowd spelling slang (non-standard spelling of ruddy brown), applied | Blood Red (dE 2.9) |
| Sand Brown | #CBA560 | Learn | ALIAS | redundant modifier+base (sand is already a tan/brown color), applied | Sandstone (dE 4.1) |
| Sea | #3C9992 | Learn | KEEP | real nature/descriptive color word in common use, applied |  |
| Seaweed | #18D17B | Learn | KEEP | real nature/product color term, applied |  |
| Sickly Green | #94B21C | Archive | ALIAS | subjective derogatory crowd descriptor, same pattern as the CRUDE 'Ugly X' rows, applied | Avocado (dE 2.5) |
| Squash | #F2AB15 | Archive | KEEP | given as obvious in the brief, applied |  |
| Stormy Blue | #507B9C | Learn | ALIAS | modifier+base compound ('stormy' + base hue), not a distinct name, applied | Metallic Blue (dE 3.5) |
| Swamp Green | #748500 | Learn | KEEP | widely recognized dictionary/idiom color term, applied |  |
| Velvet | #750851 | Learn | KEEP | real material/fashion color term, applied |  |
| Very Light Pink | #FFF4F2 | Archive | ALIAS | modifier+base compound ('very light' + base hue), not a distinct name, applied | Lavender Blush (dE 4.0) |
| Yellowy Green | #BFF128 | Archive | ALIAS | -y crowd modifier slang, applied | Lime (dE 3.2) |
