// logic.js
// Pure game logic: Palace probability calculator, speed formula, Smogon parser.
// No DOM access — all functions take plain data and return plain data.

// ── Constants ─────────────────────────────────────────────────────────────

const NATURE_SPD_MOD = {
  Hasty: 1.1, Jolly: 1.1, Naive: 1.1, Timid: 1.1,
  Brave: 0.9, Quiet: 0.9, Relaxed: 0.9, Sassy: 0.9,
};

const ALARM_MOVES = new Set([
  'Sheer Cold', 'Horn Drill', 'Fissure', 'Guillotine', 'Reversal',
  'Swords Dance', 'Dragon Dance', 'Double Team',
  'Counter', 'Mirror Coat', 'Psych Up',
]);

const ALARM_ITEMS = new Set(['BrightPowder', 'Lax Incense', 'Quick Claw']);

// ── Speed Calculator ───────────────────────────────────────────────────────

/**
 * Calculate Speed stat at a given level.
 * Uses 31 IVs (competitive standard) and user-supplied EVs.
 *
 * @param {string} species  - e.g. "Snorlax"
 * @param {string} nature   - e.g. "Brave"
 * @param {number} spdEV    - Speed EVs 0-252
 * @param {number} level    - 50 or 100
 * @returns {number|null}   - calculated speed, or null if species unknown
 */
function calcSpeed(species, nature, spdEV, level) {
  const base = BASE_SPEEDS[species];
  if (base === undefined) return null;
  const iv  = 31;
  const ev  = Math.max(0, Math.min(252, parseInt(spdEV) || 0));
  const mod = NATURE_SPD_MOD[nature] || 1.0;
  const neutral = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100 + 5);
  return Math.floor(neutral * mod);
}

// ── Palace Probability Calculator ─────────────────────────────────────────

/**
 * Compute the six Palace AI probability values for a moveset + nature.
 * Implements the algorithm from PalaceGenerate.py.
 *
 * @param {string}   nature  - Nature name, must exist in NATURE_TABLE
 * @param {string[]} moves   - Array of exactly 4 move names (empty string = no move)
 * @returns {object|null}    - Probability object, or null if nature unknown
 *
 * Returned object:
 *   ai_atk, ai_def, ai_spt          — AI category probs (above 50% HP)
 *   ai_atk50, ai_def50, ai_spt50    — AI category probs (below 50% HP)
 *   r_atk, r_def, r_nomove          — Random move probs (above 50% HP)
 *   r_atk50, r_def50, r_nomove50    — Random move probs (below 50% HP)
 *   cats                            — Array of 4 category strings ('ATK'|'DEF'|'SPT'|null)
 *   atk_count, def_count, spt_count — Raw category counts
 */
function calcPalaceProbs(nature, moves) {
  const nat = NATURE_TABLE[nature];
  if (!nat) return null;

  const cats      = moves.map(m => (!m || m === '---') ? null : (MOVE_CLASS[m] || null));
  const atk_count = cats.filter(c => c === 'ATK').length;
  const def_count = cats.filter(c => c === 'DEF').length;
  const spt_count = cats.filter(c => c === 'SPT').length;
  const has_atk   = atk_count > 0 ? 1 : 0;
  const has_def   = def_count > 0 ? 1 : 0;
  const has_spt   = spt_count > 0 ? 1 : 0;
  const num_classes = has_atk + has_def + has_spt;

  // AI category probabilities — nature weight gated by presence of that category
  const ai_atk   = has_atk ? nat.atk   : 0;
  const ai_def   = has_def ? nat.def   : 0;
  const ai_spt   = has_spt ? nat.spt   : 0;
  const ai_atk50 = has_atk ? nat.atk50 : 0;
  const ai_def50 = has_def ? nat.def50 : 0;
  const ai_spt50 = has_spt ? nat.spt50 : 0;

  // Random move probabilities — derived from the missing category's weight
  let r_atk = 0, r_def = 0, r_nomove = 0;
  let r_atk50 = 0, r_def50 = 0, r_nomove50 = 0;

  if (num_classes === 2) {
    if (!has_spt) {
      // ATK & DEF only — missing category is SPT
      if (atk_count > def_count) {
        r_atk = nat.spt * 0.5;  r_def = 0;               r_nomove = nat.spt * 0.5;
        r_atk50 = nat.spt50 * 0.5; r_def50 = 0;          r_nomove50 = nat.spt50 * 0.5;
      } else if (atk_count < def_count) {
        r_atk = 0;  r_def = nat.spt * 0.5;               r_nomove = nat.spt * 0.5;
        r_atk50 = 0; r_def50 = nat.spt50 * 0.5;          r_nomove50 = nat.spt50 * 0.5;
      } else {
        r_atk = nat.spt * 0.25; r_def = nat.spt * 0.25;  r_nomove = nat.spt * 0.5;
        r_atk50 = nat.spt50 * 0.25; r_def50 = nat.spt50 * 0.25; r_nomove50 = nat.spt50 * 0.5;
      }
    } else if (!has_def) {
      // ATK & SPT — missing category is DEF
      r_atk = nat.def * 0.5;   r_def = 0;   r_nomove = nat.def * 0.5;
      r_atk50 = nat.def50 * 0.5; r_def50 = 0; r_nomove50 = nat.def50 * 0.5;
    } else {
      // DEF & SPT — missing category is ATK
      r_atk = 0;   r_def = nat.atk * 0.5;   r_nomove = nat.atk * 0.5;
      r_atk50 = 0; r_def50 = nat.atk50 * 0.5; r_nomove50 = nat.atk50 * 0.5;
    }
  } else if (num_classes === 1) {
    if (has_atk) {
      r_atk = nat.def * 0.5 + nat.spt * 0.5;   r_def = 0;   r_nomove = nat.def * 0.5 + nat.spt * 0.5;
      r_atk50 = nat.def50 * 0.5 + nat.spt50 * 0.5; r_def50 = 0; r_nomove50 = nat.def50 * 0.5 + nat.spt50 * 0.5;
    } else if (has_def) {
      r_atk = 0;   r_def = nat.atk * 0.5 + nat.spt * 0.5;   r_nomove = nat.atk * 0.5 + nat.spt * 0.5;
      r_atk50 = 0; r_def50 = nat.atk50 * 0.5 + nat.spt50 * 0.5; r_nomove50 = nat.atk50 * 0.5 + nat.spt50 * 0.5;
    } else {
      // SPT only
      r_atk = 0; r_def = 0; r_nomove = nat.atk + nat.def;
      r_atk50 = 0; r_def50 = 0; r_nomove50 = nat.atk50 + nat.def50;
    }
  }
  // num_classes === 3: all random probs remain 0

  return {
    ai_atk, ai_def, ai_spt,
    ai_atk50, ai_def50, ai_spt50,
    r_atk, r_def, r_nomove,
    r_atk50, r_def50, r_nomove50,
    cats, atk_count, def_count, spt_count,
  };
}

// ── Smogon Format Parser ───────────────────────────────────────────────────

/**
 * Parse a Smogon-format set export into structured fields.
 *
 * Supports the format:
 *   Snorlax @ Leftovers
 *   Ability: Immunity
 *   Level: 50
 *   EVs: 36 HP / 220 Def / 252 Spe
 *   Brave Nature
 *   - Body Slam
 *   - Amnesia
 *   - Curse
 *   - Rest
 *
 * @param {string} text  - Raw pasted text
 * @returns {{ species, item, nature, moves, spdEV } | null}
 */
function parseSmogon(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  let species = '', item = '', nature = '', moves = [], spdEV = 0;

  // Line 0: "Species @ Item"  or just "Species"
  const l0 = lines[0];
  if (l0.includes('@')) {
    const parts = l0.split('@');
    species = parts[0].trim().replace(/\s*\(M\)|\s*\(F\)/g, '').trim();
    item    = parts[1].trim();
  } else {
    species = l0.replace(/\s*\(M\)|\s*\(F\)/g, '').trim();
  }

  lines.slice(1).forEach(line => {
    // "Brave Nature"
    const natMatch = line.match(/^(\w+)\s+Nature$/i);
    if (natMatch) { nature = natMatch[1]; return; }

    // "EVs: 252 HP / 4 Def / 252 Spe"
    if (/^EVs:/i.test(line)) {
      line.replace(/^EVs:/i, '').split('/').forEach(part => {
        const m = part.trim().match(/^(\d+)\s+(\S+)$/);
        if (m && m[2].toLowerCase() === 'spe') spdEV = parseInt(m[1]);
      });
      return;
    }

    // "- Move Name"
    if (line.startsWith('-') || line.startsWith('*')) {
      const move = line.slice(1).trim()
        .split('/')[0]          // drop Hidden Power type annotation e.g. "(Ice)"
        .replace(/\s*\(.*?\)/, '')
        .trim();
      if (moves.length < 4) moves.push(move);
    }
  });

  while (moves.length < 4) moves.push('');
  return { species, item, nature, moves, spdEV };
}

// ── Alarm Helpers ─────────────────────────────────────────────────────────

/**
 * Returns an array of alarm label strings for a set, e.g. ['alarm move', 'alarm item']
 */
function getAlarms(moves, item) {
  const out = [];
  if (moves.some(m => ALARM_MOVES.has(m))) out.push('alarm move');
  if (ALARM_ITEMS.has(item)) out.push('alarm item');
  return out;
}

/**
 * Returns true if any move or the item triggers an alarm.
 */
function hasAlarm(moves, item) {
  return moves.some(m => ALARM_MOVES.has(m)) || ALARM_ITEMS.has(item);
}
