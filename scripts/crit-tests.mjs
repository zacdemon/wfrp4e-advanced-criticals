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
const CHOICE_QUERY = `${MODULE_ID}.chooseCritOption`;
const QUERY_TIMEOUT = 5 * 60 * 1000;
// Generated effect names end in one of these; the rest is the critical's name.
const TITLE_SUFFIX = /\s*\((Test|Choice|Start of Turn|End of Turn)\)$/;

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
  // Runs on the owning player's client: the critical offers a choice (Duck And Cover: Prone or Ablaze ...).
  CONFIG.queries[CHOICE_QUERY] = async ({ actorUuid, spec } = {}) => {
    const actor = await fromUuid(actorUuid);
    if (!actor?.isOwner) return { error: "not-owner" };
    return { choice: await chooseLocal(actor, spec) };
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
  spec = { ...spec, title: spec.title ?? ctx.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx.item?.name };
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
  if (!result && !spec.optional) {
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
  const title = ctx?.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx?.item?.name ?? "";
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
  if (dropped.length) ui.notifications.notify(`<strong>${esc(ctx.effect?.name?.replace(TITLE_SUFFIX, ""))}</strong>: ${loc("EXPCRIT.Tests.Dropped", { items: dropped.map((i) => i.name).join(", ") })}`);
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
  const value = data.system?.location?.value;
  if (modify) modify(data);
  // A display value set by `modify` ("Left Eye", "3 Teeth") would otherwise be replaced by the one derived from the location key.
  const options = data.system?.location && data.system.location.value !== value ? { skipLocationValue: true } : {};
  return ctx.actor.createEmbeddedDocuments("Item", [data], options);
}

/** Temporary actor effect: penalty to the next rolled Test, removed once that Test is rolled. */
export async function nextTestPenalty(ctx, modifier) {
  const title = ctx.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx.item?.name;
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

/**
 * Ask on this client which option to take. spec: {title, prompt, options: [{id, label, hint, disabled}]}
 * Returns the chosen id, or null (closed / timed out).
 */
async function chooseLocal(actor, spec = {}) {
  const options = (spec.options ?? []).filter((o) => o && o.id);
  const first = options.find((o) => !o.disabled);
  if (!first) return null;
  const rows = options.map((o) => `
    <label class="expcrit-choice" style="display:flex;gap:8px;align-items:flex-start;margin:4px 0;${o.disabled ? "opacity:.5" : ""}">
      <input type="radio" name="choice" value="${esc(o.id)}" ${o.id === first.id ? "checked" : ""} ${o.disabled ? "disabled" : ""}>
      <span><strong>${esc(o.label)}</strong>${o.hint ? `<br><span class="hint">${esc(o.hint)}</span>` : ""}</span>
    </label>`).join("");
  const content = `<div class="expcrit-choice-dialog">
      <p><strong>${esc(actor.name)}</strong>: ${esc(spec.prompt ?? "")}</p>
      ${rows}
    </div>`;
  let app = null;
  const timer = setTimeout(() => app?.close(), QUERY_TIMEOUT - 5000);
  try {
    return await foundry.applications.api.DialogV2.wait({
      window: { title: `${spec.title ?? ""}: ${loc("EXPCRIT.Choice.Title")}`, icon: "fa-solid fa-code-branch" },
      position: { width: 420 },
      content,
      rejectClose: false,
      render: (event, dialog) => { app = dialog ?? event?.target ?? null; },
      buttons: [{
        action: "choose",
        label: loc("EXPCRIT.Choice.Confirm"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) => button.form.elements.choice?.value ?? null
      }]
    }) ?? null;
  }
  catch (err) {
    console.error(`${MODULE_ID} | critical choice failed`, err);
    return null;
  }
  finally { clearTimeout(timer); }
}

/**
 * A critical that offers a choice when it is received. Called from the item's immediate script with `this` as ctx.
 * Asked of the same user as the critical's Tests (setting "Who rolls critical Tests").
 * Returns the chosen option id, or null (closed / no answer: a GM note says to apply it by hand).
 */
export async function chooseCritOption(ctx, spec = {}) {
  const actor = ctx?.actor;
  if (!actor) return null;
  spec = { ...spec, title: spec.title ?? ctx.item?.name ?? ctx.effect?.name?.replace(TITLE_SUFFIX, "") };
  const enabled = (spec.options ?? []).filter((o) => !o.disabled);
  if (!enabled.length) return null;
  const roller = rollerFor(actor);
  let choice = null;
  if (roller.id !== game.user.id) {
    ui.notifications.info(loc("EXPCRIT.Choice.Waiting", { user: roller.name, actor: actor.name }));
    try {
      const res = await roller.query(CHOICE_QUERY, { actorUuid: actor.uuid, spec }, { timeout: QUERY_TIMEOUT });
      if (res?.error) throw new Error(res.error);
      choice = res?.choice ?? null;
    }
    catch (err) {
      console.warn(`${MODULE_ID} | ${roller.name} did not answer the critical choice`, err);
      if (!/timed? ?out/i.test(String(err?.message ?? err))) choice = await chooseLocal(actor, spec);
    }
  }
  else choice = await chooseLocal(actor, spec);
  if (choice && !enabled.some((o) => o.id === choice)) choice = null;
  if (!choice) {
    await gmNote(ctx, loc("EXPCRIT.Choice.NotChosen", { options: (spec.options ?? []).map((o) => esc(o.label)).join(" / ") }));
    return null;
  }
  const picked = enabled.find((o) => o.id === choice);
  await ChatMessage.create({
    content: `<p><strong>${esc(spec.title)}</strong>: ${loc("EXPCRIT.Choice.Chose", { actor: esc(actor.name), option: esc(picked.label) })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
  return choice;
}

/** "Drop whatever you held in one of your hands": the victim picks which held item (or the empty hand). */
export async function dropChosen(ctx) {
  const actor = ctx.actor;
  const held = actor.itemTypes.weapon.filter((w) => w.system.isEquipped);
  if (!held.length) return [];
  const hands = held.reduce((n, w) => n + (w.system.twohanded?.value ? 2 : 1), 0);
  const options = held.map((w) => ({ id: w.id, label: w.name, hint: w.system.twohanded?.value ? loc("EXPCRIT.Choice.TwoHanded") : "" }));
  if (hands < 2) options.push({ id: "none", label: loc("EXPCRIT.Choice.EmptyHand") });
  const pick = await chooseCritOption(ctx, { prompt: loc("EXPCRIT.Choice.DropWhich"), options });
  if (!pick || pick === "none") return [];
  const weapon = actor.items.get(pick);
  if (!weapon?.system?.isEquipped) return [];
  await weapon.system.toggleEquip();
  ui.notifications.notify(`<strong>${esc(ctx.item?.name ?? "")}</strong>: ${loc("EXPCRIT.Tests.Dropped", { items: weapon.name })}`);
  return [weapon];
}

/* -------------------------------------------- */
/*  Recurring Tests (start / end of each turn)  */
/* -------------------------------------------- */
// Generated "<Critical> (Start of Turn)" / "(End of Turn)" effects carry a startTurn / endTurn script.
// warhammer-lib runs those when the combat turn advances, once per combatant per round, on the client of
// the actor's active owner (its player if online, otherwise the GM), so the Test opens on that screen.

const PHYSICAL_SKIP = ["int", "wp", "fel"];

/** Should this turn's recurring Test/roll happen? (not for the dead; only on the owner's client) */
export function turnReady(ctx) {
  const actor = ctx?.actor;
  if (!actor) return false;
  if (actor.hasCondition?.("dead")) return false;
  return true;
}

/**
 * Roll a recurring Test (rollCritTest on this client). If nobody has rolled it 5 minutes later, the GM gets
 * a note to resolve it by hand; a late roll still applies.
 */
export async function turnTest(ctx, spec = {}) {
  const title = spec.title ?? ctx.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx.item?.name;
  spec = { ...spec, title };
  let done = false;
  const timer = setTimeout(() => {
    if (!done) gmNote(ctx, loc("EXPCRIT.Turn.NotYet", { test: describeTest(spec) }));
  }, QUERY_TIMEOUT);
  try { return await rollCritTest(ctx, spec); }
  finally { done = true; clearTimeout(timer); }
}

/** The recurring Test is over (passed, or no longer possible): remove this effect from the critical. */
export async function stopTurnTests(ctx, html) {
  if (html) await turnNote(ctx, html);
  try { await ctx.effect?.delete(); }
  catch (err) { console.warn(`${MODULE_ID} | could not remove ${ctx.effect?.name}`, err); }
}

/** Public chat line for a recurring roll's outcome (everyone sees what happened at the table). */
export async function turnNote(ctx, html) {
  const title = ctx?.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx?.item?.name ?? "";
  return ChatMessage.create({
    content: `<p><strong>${esc(title)}</strong>: ${html}</p>`,
    speaker: ChatMessage.getSpeaker({ actor: ctx.actor }),
    flags: { [MODULE_ID]: { critNote: true } }
  });
}

/** Percentile chance ("Each turn there is a 10% chance ..."): rolls 1d100 to chat, true when it happens. */
export async function chanceRoll(ctx, chance, what) {
  const title = ctx?.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx?.item?.name ?? "";
  const roll = await new Roll("1d100").evaluate();
  const hit = roll.total <= chance;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: ctx.actor }),
    flavor: `<strong>${esc(title)}</strong>: ${loc(hit ? "EXPCRIT.Turn.ChanceHit" : "EXPCRIT.Turn.ChanceMiss", { chance, what })}`
  });
  return hit;
}

/**
 * Penalty for the rest of this turn (Tummy Slice, Abdominal Pain, Belly Burn): an actor effect with a dialog
 * modifier (physical Tests only when `physical`), optionally halved Movement, removed at the end of the turn
 * (or when the combat ends). `move`: Movement change for the turn (Grazed Ankle: +1 cancels its -1).
 */
export async function turnPenalty(ctx, { modifier = -20, physical = true, halveMove = false, move = 0, label } = {}) {
  const title = ctx.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx.item?.name;
  const name = label ? `${title}: ${label}` : loc(halveMove ? "EXPCRIT.Turn.PenaltyMove" : "EXPCRIT.Turn.Penalty", { name: title, mod: modifier });
  const skip = JSON.stringify(PHYSICAL_SKIP);
  const cleanup = `if (globalThis.warhammer?.utility?.getActiveDocumentOwner?.(this.actor)?.id === game.user.id) await this.effect.delete();`;
  const scriptData = [];
  if (modifier) scriptData.push({
    label: name,
    trigger: "dialog",
    script: `args.fields.modifier += ${Number(modifier)};`,
    options: physical
      ? { hideScript: `return ${skip}.includes(args.characteristic);`, activateScript: `return !${skip}.includes(args.characteristic);` }
      : { hideScript: "", activateScript: "return true;" }
  });
  if (move) scriptData.push({
    label: name,
    trigger: "prePrepareItems",
    script: `this.actor.system.details.move.value = Math.max(0, Number(this.actor.system.details.move.value) + ${Number(move)});`,
    options: {}
  });
  if (halveMove) scriptData.push({
    label: loc("EXPCRIT.Turn.HalfMove"),
    trigger: "prePrepareItems",
    script: "this.actor.system.details.move.value = Math.floor(Number(this.actor.system.details.move.value) / 2);",
    options: {}
  });
  scriptData.push({ label: loc("EXPCRIT.Turn.EndsAtTurnEnd"), trigger: "endTurn", script: cleanup, options: {}, async: true });
  scriptData.push({ label: loc("EXPCRIT.Turn.EndsAtTurnEnd"), trigger: "endCombat", script: cleanup, options: {}, async: true });
  return ctx.actor.createEmbeddedDocuments("ActiveEffect", [{
    name,
    img: ctx.item?.img ?? "modules/wfrp4e-core/icons/injuries/injury.png",
    origin: ctx.actor.uuid,
    system: { transferData: { type: "document", documentType: "Actor" }, scriptData },
    flags: { [MODULE_ID]: { fromCritical: ctx.item?.name ?? null, turnPenalty: true } }
  }]);
}

/**
 * Undo an injury this critical granted on receipt (Bruised Thigh / Spinal Burn: "Amputated Leg" until the Test
 * is passed). Removes the items with that name created around the same time as the critical, at `keys` (default: the
 * critical's location key) or anywhere when keys is "any".
 */
export async function removeGranted(ctx, name, keys) {
  const actor = ctx.actor;
  // Granted items are created by the critical's immediate script, i.e. *before* the critical itself is stored
  // (seconds earlier on a busy server): accept the ones created within 10 minutes of it.
  const at = Number(ctx.item?._stats?.createdTime ?? 0);
  const near = (i) => !at || Math.abs(Number(i._stats?.createdTime ?? 0) - at) <= 10 * 60 * 1000;
  const want = keys === "any" ? null : new Set([].concat(keys ?? ctx.item?.system?.location?.key ?? []));
  const items = actor.items.filter((i) => i.name === name && near(i)
    && (!want || !want.size || want.has(i.system?.location?.key)));
  if (items.length) await actor.deleteEmbeddedDocuments("Item", items.map((i) => i.id));
  return items;
}

/**
 * A recurring Test that only starts under some outcome (Damaged Eye: the hand stays clapped to the eye after a
 * failed Test): an actor effect whose startTurn/endTurn script rolls the Test and removes itself once passed.
 * spec: rollCritTest spec; passNote: html shown when it is passed.
 */
export async function addTurnTest(ctx, { trigger = "startTurn", spec = {}, passNote = "" } = {}) {
  const title = ctx.effect?.name?.replace(TITLE_SUFFIX, "") ?? ctx.item?.name;
  const label = trigger === "endTurn" ? "End of Turn" : "Start of Turn";
  const script = `const api = game.modules.get("${MODULE_ID}")?.api;
if (!api?.turnTest || !api.turnReady(this)) return;
const test = await api.turnTest(this, ${JSON.stringify({ ...spec, title })});
if (test && !test.failed) await api.stopTurnTests(this, ${JSON.stringify(passNote)});`;
  return ctx.actor.createEmbeddedDocuments("ActiveEffect", [{
    name: `${title} (${label})`,
    img: ctx.item?.img ?? "modules/wfrp4e-core/icons/injuries/injury.png",
    origin: ctx.actor.uuid,
    system: { transferData: { type: "document", documentType: "Actor" }, scriptData: [{ label: describeTest(spec), trigger, script, options: {}, async: true }] },
    flags: { [MODULE_ID]: { fromCritical: ctx.item?.name ?? null, critTurn: true } }
  }]);
}

export const critTestApi = { turnReady, turnTest, stopTurnTests, turnNote, chanceRoll, turnPenalty, removeGranted, addTurnTest, rollCritTest, chooseCritOption, dropChosen, gmNote, dropHeld, addCoreItem, nextTestPenalty, addEffect, describeTest, CORE_ITEMS };
