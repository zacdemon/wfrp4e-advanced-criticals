# EXPANDED CRITICALS FOR WFRP4E
Expqanded criticals according to the supplement by Josef Tham (Based on the work of Chuck Morrison for windsofchaos.com)

# Unreleased
- Critical chart picker: clicking a Critical link (damage card, attack card, Critical Cast, `/table crithead`) asks which damage-type chart to roll on, pre-selecting one from the attacking weapon. The roll uses the system's own modifier; with Up In Arms on, the UiA column is used.
- Settings: "Prompt for damage type on critical rolls" and "Critical chart column" (Auto / Core / Up In Arms).
- "Roll Critical" macro rewritten to use the same dialog (requires the module to be enabled).

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

## Development
Compendium data lives as JSON in `src/packs/` and is compiled into the LevelDB folders in `packs/`.
- `npm install`
- `npm run extract`: LevelDB `packs/` -> JSON `src/packs/` (overwrites the JSON)
- `npm run build`: JSON `src/packs/` -> LevelDB `packs/` (close Foundry first)
- `npm run validate`: checks JSON, effect-script syntax, table links and ranges
