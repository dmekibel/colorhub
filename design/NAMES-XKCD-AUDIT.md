# xkcd-only name audit (automated first pass, 2026-10-09)

Every data/library.json entry whose only source is `xkcd` (the 2010 crowd-survey): 186 names (85 of them also titled in the Learn layer, data/core-names.json). This is a wider sweep than the `-ish` pass (see tools/vague_ish_merge.py, applied separately): per the coordinator's 2026-10-08 scope extension, classify every xkcd-only name, not just the `-ish` ones.

**This table is an automated first pass, not a verified one.** It was built from pattern rules (crude-word blocklist, modifier+base-hue compound detection, spelling-variant matching) with no web lookups or dictionary cross-checks — this session did not have time to verify each `KEEP?` candidate's independent usage against another list, as the brief asks. Treat every `KEEP?` row as **unconfirmed** and every `ALIAS`/`CRUDE` row as a **proposal**, not an applied change (none of this table's verdicts have been applied to the data; only the `-ish` names from the original, narrower brief were). The nearest-color dE for each ALIAS/CRUDE row is a candidate alias target, computed by CIEDE2000 against every non-xkcd-only library entry, the same method tools/vague_ish_merge.py uses for the `-ish` names.

## Counts

- CRUDE: 32
- ALIAS: 75
- KEEP? (unconfirmed, needs a human/dictionary check): 79

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
| Algae | #54AC68 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Algae Green | #21C36F | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Almost Black | #070D0D | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Apple | #6ECB3C | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Army Green | #4B5D16 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Asparagus | #77AB56 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Avocado | #90B134 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Azul | #1D5DEC | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Barney | #AC1DB8 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Barney Purple | #A00498 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Blue Purple | #5729CE | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Bluey Purple | #6241C7 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Blurple | #5539CC | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Boring Green | #63B365 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Brick Orange | #C14A09 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Brown Yellow | #B29705 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Browny Orange | #CA6B02 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Burnt Siena | #B75203 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Burple | #6832E3 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Celery | #C1FD95 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Dark Seafoam | #1FB57A | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Dark Taupe | #7F684E | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Dirt Brown | #836539 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Dusky Rose | #BA6873 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Easter Green | #8CFD7E | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Easter Purple | #C071FE | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Flat Green | #699D4C | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Fresh Green | #69D84F | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Grape Purple | #5D1451 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Grass | #5CAC2D | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Grassy Green | #419C03 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Green Apple | #5EDC1F | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Greeny Blue | #42B395 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Hospital Green | #9BE5AA | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Kermit Green | #5CB200 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Kiwi | #9CEF43 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Kiwi Green | #8EE53F | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Lavender Pink | #DD85D7 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Leafy Green | #51B73B | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Light Aquamarine | #7BFDC7 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Light Burgundy | #A8415B | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Light Seafoam | #A0FEBF | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Merlot | #730039 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Metallic Blue | #4F738E | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Midnight Purple | #280137 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Military Green | #667C3E | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Milk Chocolate | #7F4E1E | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Mud Brown | #60460F | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Mud Green | #606602 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Murky Green | #6C7A0E | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Mustard Green | #A8B504 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Nasty Green | #70B23F | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Ocean | #017B92 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Orangey Brown | #B16002 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Orangey Red | #FA4224 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Pea Soup | #929901 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Peachy Pink | #FF9A8A | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Pink Purple | #DB4BDA | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Pure Blue | #0203E2 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Purple Grey | #866F85 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Purpley | #8756E4 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Purpley Grey | #947E94 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Purpley Pink | #C83CB9 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Purply | #983FB2 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Purply Pink | #F075E6 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Racing Green | #014600 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Red Pink | #FA2A55 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Red Wine | #8C0034 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Reddy Brown | #6E1005 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Sand Brown | #CBA560 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Sea | #3C9992 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Seaweed | #18D17B | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Sickly Green | #94B21C | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Squash | #F2AB15 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Stormy Blue | #507B9C | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Swamp Green | #748500 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Velvet | #750851 | Learn | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Very Light Pink | #FFF4F2 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
| Yellowy Green | #BFF128 | Archive | KEEP? | single distinctive word; needs a dictionary/other-list check to confirm real usage |  |
