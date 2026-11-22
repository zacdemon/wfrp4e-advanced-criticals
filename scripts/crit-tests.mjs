/**
 * Antares | Expanded Criticals [WFRP4E]
 *
 * Tests prompted when a critical is added to an actor.
 *
 * Every critical whose text makes the afflicted creature roll a Test carries an
 * effect "<Critical> (Test)" with an `immediate` script, exactly like the
 * system's own criticals (Bad Cut, Deep Cut, Broken Jaw ...). Immediate scripts
 * run once, on the client of the user who adds the item, while the item is
 * being created. The scripts call `rollCritTest()` below instead of
 * `actor.setupSkill()` directly so that the Test can be rolled by the actor's
 * player when the GM drops the critical on a player character (setting
 * "Who rolls critical Tests"). The result is sent back to the dropping client,
 * which then applies the outcome (conditions, items, notes).
 */

const MODULE_ID = "artantares-advanced-criticals";
const QUERY = `${MODULE_ID}.rollCritTest`;
const QUERY_TIMEOUT = 5 * 60 * 1000;

// Characteristic each basic skill falls back to (used only to choose the better of two skills).
const SKILL_CHAR = { Cool: "wp", Endurance: "t", Athletics: "ag", Heal: "int", Perception: "i", Dodge: "ag" };
// Core Rulebook diseases/injuries the outcomes can add.
export const CORE_ITEMS = {
  festering: "Compendium.wfrp4e-core.items.Item.kKccDTGzWzSXCBOb",
  bloodrot: "Compendium.wfrp4e-core.items.Item.M8XyRs9DN12XsFTQ",
  minor: "Compendium.wfrp4e-core.items.Item.1hQuVFZt9QnnbWzg",
  teeth: "Compendium.wfrp4e-core.items.Item.fBcZhOBn8IpoVqQ1"
};

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function registerCritTestSettings() {
  game.settings.register(MODULE_ID, "testRoller", {
    name: "EXPCRIT.Settings.TestRoller.Name",
    hint: "EXPCRIT.Settings.TestRoller.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      owner: "EXPCRIT.Settings.TestRoller.Owner",
      adder: "EXPCRIT.Settings.TestRoller.Adder"
    },
    default: "owner"
  });

  // Runs on the owning player's client when the GM adds a critical to their character.
  CONFIG.queries[QUERY] = async ({ actorUuid, spec } = {}) => {
    const actor = await fromUuid(actorUuid);
    if (!actor?.isOwner) return { error: "not-owner" };
    return rollLocal(actor, spec);
  };
}

/** Localised skill name ("Endurance" -> game.i18n "NAME.Endurance" when the key exists). */
function skillName(key) {
  const k = `NAME.${key.replace(/\s+/g, "")}`;
  return game.i18n.has?.(k) ? game.i18n.localize(k) : key;
}

/** Value the actor would test against for a skill (falls back to the characteristic like the system does). */
function skillTarget(actor, key) {
  const name = skillName(key).toLowerCase();
  const skill = actor.itemTags?.skill?.find((s) => s.name.toLowerCase() === name);
  if (skill) return Number(skill.system?.total?.value ?? 0);
  const ch = SKILL_CHAR[key];
  return Number(actor.system?.characteristics?.[ch]?.value ?? 0);
}

/** Plain, serialisable summary of a Test, shaped like the bits of a system Test the scripts use. */
function summarise(test, extra = {}) {
  const r = test?.result ?? {};
  return {
    succeeded: !!test?.succeeded,
    failed: !!test?.failed,
    result: { SL: Number(r.SL ?? 0), roll: Number(r.roll ?? 0), target: Number(r.target ?? 0), outcome: r.outcome, description: r.description },
    rolledBy: game.user.id,
    ...extra
  };
}

/** Roll the Test on this client. spec: {skill|skills|characteristic, difficulty, title, success, failure, choice} */
async function rollLocal(actor, spec = {}) {
  const context = {
    skipTargets: true,
    appendTitle: ` - ${spec.title ?? ""}`,
    fields: { difficulty: spec.difficulty ?? "challenging" }
  };
  if (spec.success || spec.failure) context.context = {};
  if (spec.success) context.context.success = `<strong>${esc(spec.title)}</strong>: ${spec.success}`;
  if (spec.failure) context.context.failure = `<strong>${esc(spec.title)}</strong>: ${spec.failure}`;
  // resolveClose: closing the roll dialog resolves the Test as "not rolled" instead of leaving the item creation hanging.
  const options = { resolveClose: true };
  let test;
  let used;
  try {
    if (spec.characteristic) {
      used = spec.characteristic;
      test = await actor.setupCharacteristic(spec.characteristic, context, options);
    }
    else {
      const keys = spec.skills ?? [spec.skill ?? "Endurance"];
      // "Cool or Endurance Test": use whichever the character is better at ("worst" when the text says so)
      used = keys.reduce((best, k) => {
        if (best === null) return k;
        const better = skillTarget(actor, k) > skillTarget(actor, best);
        return (spec.choice === "worst" ? !better : better) ? k : best;
      }, null);
      test = await actor.setupSkill(skillName(used), context, options);
    }
    if (!test) return null; // dialog closed
    await test.roll();
  }
  catch (err) {
    console.error(`${MODULE_ID} | critical Test failed`, err);
    return null;
  }
  return summarise(test, { used });
}

/** Who should roll: the actor's active player (setting "owner") or whoever added the critical. */
function rollerFor(actor) {
  let mode = "owner";
  try { mode = game.settings.get(MODULE_ID, "testRoller"); } catch { /* setting not ready */ }
  if (mode !== "owner") return game.user;
  const owner = globalThis.warhammer?.utility?.getActiveDocumentOwner?.(actor);
  return owner?.active ? owner : game.user;
}

/**
 * Prompt a critical's Test. Called from the item's immediate script with `this` as ctx.
 * Returns {succeeded, failed, result: {SL, roll, target}} or null if nobody rolled it
 * (dialog closed, no answer); in that case the GM gets a chat note to apply the outcome by hand.
 */
export async function rollCritTest(ctx, spec = {}) {
  const actor = ctx?.actor;
  if (!actor) return null;
  spec = { ...spec, title: spec.title ?? ctx.effect?.name?.replace(/\s*\(Test\)$/, "") ?? ctx.item?.name };
  const roller = rollerFor(actor);
  let result = null;
  if (roller.id !== game.user.id) {
    ui.notifications.info(loc("EXPCRIT.Tests.Waiting", { user: roller.name, test: describeTest(spec), actor: actor.name }));
    try {
      result = await roller.query(QUERY, { actorUuid: actor.uuid, spec }, { timeout: QUERY_TIMEOUT });
      if (result?.error) throw new Error(result.error);
    }
    catch (err) {
      console.warn(`${MODULE_ID} | ${roller.name} did not roll the critical Test`, err);
      result = null;
      // Player unreachable (not a timeout): roll it here so the critical still resolves.
      if (!/timed? ?out/i.test(String(err?.message ?? err))) result = await rollLocal(actor, spec);
    }
  }
  else {
    result = await rollLocal(actor, spec);
  }
  if (!result) {
    await gmNote(ctx, loc("EXPCRIT.Tests.NotRolled", { test: describeTest(spec) }));
  }
  return result;
}

/** "Hard (-20) Endurance" */
export function describeTest(spec) {
  const diff = spec.difficulty ?? "challenging";
  const label = game.wfrp4e?.config?.difficultyLabels?.[diff] ?? diff;
  const what = spec.characteristic
    ? (game.wfrp4e?.config?.characteristics?.[spec.characteristic] ?? spec.characteristic)
    : (spec.skills ?? [spec.skill ?? "Endurance"]).map(skillName).join(` ${game.i18n.localize("or")} `);
  return `${game.i18n.localize(label)} ${game.i18n.localize(what)}`;
}

/** Whisper a note about this critical to the GMs and the actor's owners. */
export async function gmNote(ctx, html) {
  const actor = ctx?.actor;
  const title = ctx?.effect?.name?.replace(/\s*\(Test\)$/, "") ?? ctx?.item?.name ?? "";
  const whisper = game.users.filter((u) => u.isGM || (actor && actor.testUserPermission(u, "OWNER"))).map((u) => u.id);
  return ChatMessage.create({
    content: `<p><strong>${esc(title)}</strong> (${esc(actor?.name)})</p><p>${html}</p>`,
    speaker: { alias: loc("EXPCRIT.Tests.Speaker") },
    whisper,
    flags: { [MODULE_ID]: { critNote: true } }
  });
}

/**
 * Drop (unequip) what is held. where = "location": the hand of this critical's arm, like the system's
 * Bleeding Hand / Dislocated Shoulder; "primary": the main hand. keepTwoHanded: a two-handed weapon is
 * not dropped (the text says it just can't be used next turn) and a note says so instead.
 */
export async function dropHeld(ctx, { where = "location", keepTwoHanded = false } = {}) {
  const actor = ctx.actor;
  let weapons = [];
  if (where === "location" && ctx.item?.system?.location?.key) weapons = ctx.item.system.weaponsAtLocation ?? [];
  else weapons = actor.itemTypes.weapon.filter((w) => w.system.isEquipped && (w.system.twohanded?.value || !w.system.offhand?.value));
  const kept = keepTwoHanded ? weapons.filter((w) => w.system.twohanded?.value) : [];
  const dropped = weapons.filter((w) => !kept.includes(w));
  for (const w of dropped) await w.system.toggleEquip();
  if (dropped.length) ui.notifications.notify(`<strong>${esc(ctx.effect?.name?.replace(/\s*\(Test\)$/, ""))}</strong>: ${loc("EXPCRIT.Tests.Dropped", { items: dropped.map((i) => i.name).join(", ") })}`);
  if (kept.length) await gmNote(ctx, loc("EXPCRIT.Tests.TwoHandedKept", { items: kept.map((i) => esc(i.name)).join(", ") }));
  return dropped;
}

/** Add a Core Rulebook disease/injury (festering, bloodrot, minor, teeth). */
export async function addCoreItem(ctx, key, modify) {
  const item = await fromUuid(CORE_ITEMS[key] ?? key);
  if (!item) {
    await gmNote(ctx, loc("EXPCRIT.Tests.MissingItem", { uuid: CORE_ITEMS[key] ?? key }));
    return null;
  }
  const data = item.toObject();
  if (modify) modify(data);
  return ctx.actor.createEmbeddedDocuments("Item", [data]);
}

/** Temporary actor effect: penalty to the next rolled Test, removed once that Test is rolled. */
export async function nextTestPenalty(ctx, modifier) {
  const title = ctx.effect?.name?.replace(/\s*\(Test\)$/, "") ?? ctx.item?.name;
  return addEffect(ctx, {
    name: loc("EXPCRIT.Tests.NextTest", { name: title, mod: modifier }),
    script: `args.fields.modifier += ${Number(modifier)};`,
    activateScript: "return true",
    submissionScript: "await this.effect.delete();"
  });
}

/**
 * Generic dialog-modifier effect on the actor.
 * {name, script, hideScript, activateScript, submissionScript, rounds}
 */
export async function addEffect(ctx, { name, script, hideScript = "", activateScript = "", submissionScript = "", rounds, img } = {}) {
  const data = {
    name,
    img: img ?? ctx.item?.img ?? "modules/wfrp4e-core/icons/injuries/injury.png",
    origin: ctx.actor.uuid,
    system: {
      transferData: { type: "document", documentType: "Actor" },
      scriptData: [{
        label: name,
        trigger: "dialog",
        script,
        options: { hideScript, activateScript, submissionScript }
      }]
    },
    flags: { [MODULE_ID]: { fromCritical: ctx.item?.name ?? null } }
  };
  if (rounds) data.duration = { value: rounds, units: "rounds" };
  return ctx.actor.createEmbeddedDocuments("ActiveEffect", [data]);
}

export const critTestApi = { rollCritTest, gmNote, dropHeld, addCoreItem, nextTestPenalty, addEffect, describeTest, CORE_ITEMS };
