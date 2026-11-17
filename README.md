# EXPANDED CRITICALS FOR WFRP4E
Expqanded criticals according to the supplement by Josef Tham (Based on the work of Chuck Morrison for windsofchaos.com)

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
