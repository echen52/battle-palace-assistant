# Battle Palace Assistant

A browser-based tool for analyzing Pokémon Battle Palace behavior in Pokemon Emerald. Look up any of the 888 opponent sets to see their Palace AI category probabilities, random move probabilities, moves, nature, item, speed, and alarm warnings — all in one place.

Also includes a **Custom Set Calculator** so you can compute Palace probabilities for your own team members from a Smogon/PokemonShowdown export.

---

## Features

- **Search** all 888 Battle Palace opponent sets by species or specific instance (e.g. `Latios 8`)
- **Probability bars** for all 6 Palace values: AI Category (ATK / DEF / SPT) and Random Move (R_ATK / R_DEF / NOMOVE)
- **HP toggle** — switch between above 50% HP and below 50% HP probability states
- **Lv50 and Lv100 speeds** displayed for every set
- **Alarm warnings** for dangerous moves (OHKO, setup, Counter/Mirror Coat) and items (BrightPowder, Lax Incense, Quick Claw)
- **Sprites** pulled from PokéAPI
- **Custom Set Calculator** — paste a Smogon export or fill in manually to compute Palace probabilities for your own Pokémon
- **Speed calculation** from species base stat + nature + EVs (Lv50 and Lv100)
- **Save sets** to localStorage so your team persists between sessions
- **Saved sets are searchable** — appear in the main search as `Snorlax (Custom)`

---

## How Palace Probabilities Work

The Battle Palace AI does not let you choose which move to use. Instead, it picks a move category (ATK, DEF, or SPT) based on your Pokémon's **nature**, then randomly selects a move from that category.

The six probability values shown are:

| Value | Meaning |
|---|---|
| **AI ATK** | Probability the AI selects the ATK category |
| **AI DEF** | Probability the AI selects the DEF category |
| **AI SPT** | Probability the AI selects the SPT category |
| **R_ATK** | Probability of a random ATK move (bypasses AI category) |
| **R_DEF** | Probability of a random DEF move (bypasses AI category) |
| **NOMOVE** | Probability of doing nothing |

All values change at below 50% HP — use the HP toggle to see both states. Due to bug discovered in the Pokemon Emerald code, there is no category for random Support category move. 

### Move Categories

Every move is classified as ATK, DEF, or SPT. A simplified breakdown:

- **ATK** — damaging moves
- **DEF** — stat boosts, healing, screens, weather
- **SPT** — status moves, debuffs, utility

If a Pokémon has no moves in a category, its AI probability for that category is 0 and the missing weight is redistributed into the random move and no-move probabilities.

More details here: https://www.smogon.com/forums/threads/gen-iii-battle-frontier-discussion-and-records.3648697/page-74#post-10307310

---

## Custom Set Calculator

Paste any Smogon-format export directly:

```
Snorlax @ Leftovers
Ability: Immunity
Level: 50
EVs: 36 HP / 220 Def / 252 Spe
Brave Nature
- Body Slam
- Amnesia
- Curse
- Rest
```

Click **Parse Set** to auto-fill the form, then **Calculate Probabilities**. Speed EVs are parsed automatically from the `EVs:` line (`Spe` shorthand). Speed is then computed at both Lv50 and Lv100 using the standard stat formula with 31 IVs assumed.

Click **Save Set** to store it in your browser — it will then appear in the search bar as `Snorlax (Custom)`.

---

## Alarm Warnings

A ⚠ badge appears on any set containing:

**Moves:** Sheer Cold, Horn Drill, Fissure, Guillotine, Reversal, Swords Dance, Dragon Dance, Double Team, Counter, Mirror Coat, Psych Up

**Items:** BrightPowder, Lax Incense, Quick Claw

---

## File Structure

```
index.html          — HTML structure
styles.css          — All styling
logic.js            — Palace probability formula, speed calculator, Smogon parser
app.js              — UI, search, card rendering, saved sets
pokemon-data.js     — All game data (888 sets, move classes, nature table, base speeds)
pokemon-sprites.js  — Dex number lookup + sprite URL helper
```

---

## Data Sources

- Battle Palace Bulbapedia site for move listings by class
- Sprites from [PokéAPI](https://pokeapi.co/)
- National Dex number mapping adapted from [Battle Facilities Assistant](https://github.com/)

---

