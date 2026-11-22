# EXPANDED CRITICALS FOR WFRP4E
Expqanded criticals according to the supplement by Josef Tham (Based on the work of Chuck Morrison for windsofchaos.com)

# Unreleased
- Critical chart picker: clicking a Critical link (damage card, attack card, Critical Cast, `/table crithead`) asks which damage-type chart to roll on, pre-selecting one from the attacking weapon. The roll uses the system's own modifier; with Up In Arms on, the UiA column is used.
- Settings: "Prompt for damage type on critical rolls" and "Critical chart column" (Auto / Core / Up In Arms).
- "Roll Critical" macro rewritten to use the same dialog (requires the module to be enabled).
- Critical Tests: 102 criticals whose text calls for a Test when the wound is received (Endurance, Cool, Athletics, Strength, Toughness...) now prompt it as soon as the critical is added to an actor, with the printed difficulty, and apply the result (conditions, dropped weapons, Festering Wound / Blood Rot / Minor Infection, next-Test penalties, SL-based outcomes). Outcomes that can't be automated are whispered to the GM (and the actor's owners) as a chat note.
- Setting "Who rolls critical Tests": the actor's player (default) or whoever adds the critical.
- Fixes in the old test scripts: wrong difficulty keys ("very easy", "very hard"), a misspelt Unconscious, Grazed Arm deleting the whole critical after the next Test, Crippled Foot and Loosened Teeth ignoring their Test, Split Skull missing its infection, Massive Abdominal Trauma giving Blood Rot on a pass.

## Using the critical picker
1. Import the module's tables into the world: Compendium "Tables (Expanded Criticals)" > Import All. The system only rolls on world tables.
2. When a Critical link is clicked, choose the damage type (Cutting, Crushing, Piercing, Arrows & Bolts, Bullets, Shrapnel & Shot, Slings, Teeth & Claws, Flames & Energy, Unarmed). "Cancel (use system table)" rolls the normal system table instead; closing the window rolls nothing.
3. The column follows the system setting "Use Up In Arms Critical Hit Modifiers" unless overridden in the module settings. The modifier is the one the system put on the link; this module does not add any.

# v2.0
- Fix mismatched items to tables
- Correct table folder location
- Update to Foundry v14

# v1.0
- All criticals initialized

# v0.3
- Cutting Criticals
- Flames Criticals

# v0.2
- Crushing Criticals
- Switch Tables to Compendium items  
- Roll Crit macro

# v0.1
- Arrows/Bolts Criticals 
- Bullets Criticals
- RollTables for all groups
 
## Legal Mentions
Author:  artantares
Module Development: artantares
Original Content: Josef Tham, Chuck Morrison

## Critical Tests
When a critical that calls for a Test is added to an actor (dragged from the critical card in chat, from the compendium, or by a script), its "(Test)" effect runs once, like the system's own criticals (Bad Cut, Broken Jaw...):
1. The Test is set up with the system's roll dialog (title "<Test> - <Critical>", the printed difficulty, skill falling back to its characteristic if the actor lacks it). "Cool or Endurance" Tests use whichever the character is better at.
2. If the GM adds it to a character owned by an online player, that player gets the roll dialog (setting "Who rolls critical Tests"); otherwise whoever added it rolls. The critical shows on the sheet once the Test is rolled.
3. The result is applied: conditions, dropping what is held in that hand (or the primary hand), diseases, a penalty on the next Test, SL-dependent results. Anything else (lose your next Action, opposed Tests, lost body parts...) is posted as a chat note to the GM and the owners.
4. Closing the roll dialog (or no answer within 5 minutes) adds the critical without rolling and posts a note to apply the result by hand.
Tests that are not rolled when the wound is received (each turn, after the encounter, daily, Heal Tests by someone else, optional self-repair) keep their existing behaviour; they are listed in `tools/crit-tests-data.mjs` (NOT_ON_ADD).

## Development
Compendium data lives as JSON in `src/packs/` and is compiled into the LevelDB folders in `packs/`.
- `npm install`
- `npm run extract`: LevelDB `packs/` -> JSON `src/packs/` (overwrites the JSON)
- `npm run build`: JSON `src/packs/` -> LevelDB `packs/` (close Foundry first)
- `npm run crit-tests`: regenerates the "(Test)" effects from `tools/crit-tests-data.mjs`
- `npm run validate`: checks JSON, effect-script syntax, table links and ranges, and that every critical whose text calls for a Test is covered
