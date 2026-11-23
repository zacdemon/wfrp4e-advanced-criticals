// Criticals whose text makes the afflicted creature roll a Test when the wound is received.
// `npm run crit-tests` turns each entry into an "<Critical> (Test)" effect with an immediate script
// (see scripts/crit-tests.mjs for the helpers the generated scripts call).
//
// Test:   skill | skills (pick the better) | characteristic, difficulty (veasy easy average challenging difficult hard vhard),
//         success / failure (text shown on the Test's chat card).
// Outcome actions (fail / pass / pre / always):
//   "cond:prone"  "cond:stunned:2"            addCondition
//   "drop:location" "drop:location:keep2h" "drop:primary"   unequip held weapons (core Bleeding Hand style)
//   "item:festering" "item:bloodrot" "item:minor"          add the Core Rulebook disease
//   "next:-10"                                 penalty to the next rolled Test (temporary effect)
//   "note:<html>"                              whispered chat note to the GM (+ owners) for what can't be automated
//   "code:<js>"                                raw script; `test`, `api` and `this` are in scope
//   "dropchoose"                               the victim picks which held item to drop (or the empty hand)
// remove: names of existing effects replaced by the generated one (their immediate scripts are superseded).
// choices: [{prompt, after?, options: [{id, label, hint?, if?: "<js expr enabling it>", do: [actions]}]}]
//   a choice the victim makes when the wound is received (asked of the same user as the Tests, setting
//   "Who rolls critical Tests"); before the Tests unless `after`. Closed / no answer: GM note.

const ARM_PENALTY = (what) => `code:await api.addEffect(this, {name: \`\${this.item.name}: -10 (${what})\`, script: "args.fields.modifier -= 10;"});\nawait api.gmNote(this, "-10 to Tests using that arm until the Test is passed (tick the modifier in the roll dialog; delete the effect once it is passed).");`;

export const CRIT_TESTS = {
  // ---------------- Arrows & Bolts ----------------
  "5EJTkeacEYxpEX0K": { name: "Grazed Arm", tests: [{ skill: "Cool", difficulty: "average", failure: "-10 to your next rolled Test.", fail: ["next:-10"] }], remove: ["Grazed Arm"] },
  cOXUgaMt3ChFGv1n: { name: "Pierced Deltoid", tests: [{ skill: "Endurance", difficulty: "hard", failure: "Drop anything held in that hand.", fail: ["drop:location"] }] },
  uNjob8EmD07xCjYf: { name: "Sliced Fingers", tests: [{ skill: "Cool", difficulty: "difficult", failure: "Lose your next Action.", fail: ["note:Loses their next Action."] }] },
  dj99bR69iw3kXezT: { name: "Hip Strike", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:stunned:1"] }] },
  obWFS2QpkUF4mMpZ: { name: "Massive Abdominal Trauma", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Dies from shock.", fail: ["cond:dead"], pass: ["note:Survives for Toughness Bonus days, then dies of complications unless magically healed first. Magical healing in time: survives, but contracts Blood Rot and a permanent Fatigued (2)."] }] },
  "3UPwg8yEZFSwQSII": { name: "Punctured Abdomen", tests: [
    { skill: "Endurance", difficulty: "challenging", failure: "Gain Prone.", fail: ["cond:prone"] },
    { skill: "Endurance", difficulty: "hard", failure: "Contract a Festering Wound.", fail: ["item:festering"] }] },
  IHm6vGu82W7xAgod: { name: "Lodged Deep", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:prone"] }] },
  bC002bOrM4Q5V1PN: { name: "Neck Wound", tests: [{ skills: ["Cool", "Endurance"], difficulty: "average", failure: "Drop what is in your primary hand to clap it to the wound.", fail: ["drop:primary"] }] },
  gpwCgbXNdM1ODgc4: { name: "Severe Thigh Wound", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Artery severed too high for a tourniquet.", fail: ["note:The artery is severed too high for a tourniquet: only Surgery (and a long clamp) can remove the Bleeding Condition."] }] },
  UIjjD6JnJhciSShh: { name: "Severed Toe Tendons", tests: [{ skill: "Cool", difficulty: "difficult", failure: "Lose your next Action.", fail: ["note:Loses their next Action."] }] },
  hmJlVzatW4CwHFDn: { name: "Torn Footwear", tests: [{ skill: "Athletics", difficulty: "easy", fail: ["cond:prone"] }] },

  // ---------------- Bullets ----------------
  G5px1ixm4vqyXh2M: { name: "Shattered Forearm", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Contract a Festering Wound.", fail: ["item:festering"] }] },
  bsTYKjskHxGjdTeX: { name: "Abdominal Wall Penetration", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:prone"] }] },
  KWyPWwwCf9SeZjxP: { name: "Shoulder Punch", tests: [{ characteristic: "ag", difficulty: "challenging", fail: ["cond:prone"] }] },
  NZMVDGMlrra4w33P: { name: "Brain Damage", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:unconscious"], pass: ["cond:stunned:3"] }] },
  OM8TAkLvdxzETT0U: { name: "Facial Wound", tests: [{ skill: "Endurance", difficulty: "average", fail: ["cond:unconscious"], pass: ["cond:stunned:2"] }] },
  G3tLhN67PxJJWJ14: { name: "Lost Eye", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Contract a Festering Wound.", fail: ["item:festering"] }] },
  NSBnZ42Ne1Z9kV83: { name: "Neck Wound", tests: [{ skills: ["Cool", "Endurance"], difficulty: "challenging", failure: "Drop what is in your primary hand to clap it to the wound.", fail: ["drop:primary"] }] },
  vQWh8MH9xp5BaWCO: { name: "Parted Hair", tests: [{ skill: "Cool", difficulty: "challenging", failure: "Your next Action may not be an attack.", fail: ["note:Their next Action may not be an attack."] }] },
  ifmMfJTmyjuknwnx: { name: "That Was Close", tests: [{ skill: "Cool", difficulty: "challenging", failure: "Lose your next Action.", fail: ["note:Loses their next Action."] }] },
  QQ9uUS91NUDaGqLV: { name: "Thigh Wound", tests: [{ skill: "Endurance", difficulty: "average", fail: ["cond:prone"] }] },
  HHdb2DdviiuZSuLQ: { name: "Torn-Off Heel", tests: [{ skill: "Athletics", difficulty: "average", fail: ["cond:prone"] }] },

  // ---------------- Crushing ----------------
  CtWnZc08d6msQs7U: { name: "Bruised Muscle", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "-10 to Tests with that arm until you pass this Test.", fail: [ARM_PENALTY("Tests with the bruised arm")] }] },
  "1jp4HU3v7Fp7iUVp": { name: "Burst Eardrum", tests: [{ skill: "Endurance", difficulty: "average", failure: "Permanent -10 to hearing-based Perception Tests (tinnitus).", fail: ["code:await api.addEffect(this, {name: \"Tinnitus: -10 hearing-based Perception\", script: \"args.fields.modifier -= 10;\", hideScript: \"return args.skill?.name != game.i18n.localize('NAME.Perception');\"});"] }] },
  tJqJGbHTvCaw4yzO: { name: "Busted Jaw", tests: [{ skill: "Endurance", difficulty: "average", fail: ["cond:unconscious"], pass: ["cond:stunned:2"] }] },
  taFUy2wGbF7PEOIa: { name: "Concussion", tests: [{ skill: "Endurance", difficulty: "difficult", success: "Fatigued (2) for the rest of the day; vomits heavily at the end of the encounter.", fail: ["cond:unconscious"], pass: ["cond:fatigued:2"] }] },
  aXdmsWAX63udlP3H: { name: "Face Crunch", tests: [{ skill: "Endurance", difficulty: "easy", fail: ["cond:unconscious"], pass: ["cond:stunned:2"] }] },
  plQbXJyTM08rqFJz: { name: "Fractured Skull", tests: [{ skill: "Endurance", difficulty: "hard", fail: ["cond:unconscious"] }] },
  EIciWvd0KWd5FQTw: { name: "Neck Smash", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:prone"] }] },
  "4kgyS6pH55FDjNPF": { name: "Noggin’ Rung", custom: `const helmets = this.actor.itemTypes.armour.filter(a => a.system.isEquipped && Number(a.system.AP?.head) > 0);
if (helmets.length) {
  // Only a completely bareheaded character Tests; headgear either slips over the eyes or (a full helm) protects.
  const full = helmets.find(a => /helm/i.test(a.name) && !/open/i.test(a.name));
  if (full) await api.gmNote(this, \`Protected by \${full.name}: no effect.\`);
  else {
    await this.actor.addCondition("blinded", 1);
    await api.gmNote(this, \`\${helmets.map(h => h.name).join(", ")} settles across the eyes: Blinded (1). (A full Helm would have avoided any effect; delete the Condition if this is one.)\`);
  }
  return;
}
const test = await api.rollCritTest(this, {skill: "Endurance", difficulty: "challenging"});
if (test?.failed) await this.actor.addCondition("stunned", 1);` },
  Y94AZprpnRLqVDnx: { name: "Hip Contusion", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:prone"] }] },
  "8GwCMTemx8Mjooph": { name: "How High", tests: [{ skill: "Athletics", difficulty: "challenging", failure: "You may not attack as your Action next turn.", fail: ["note:May not attack as their Action next turn."] }] },

  // ---------------- Cutting ----------------
  uDbqp99c3eywi7O1: { name: "Forearm Injury", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Lose your grip on anything held in that hand.", fail: ["drop:location:keep2h"] }] },
  skRGwxeaS22GphsR: { name: "Jarred Arm", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Drop whatever you held in that hand.", fail: ["drop:location:keep2h"] }] },
  di73eoiRSf6cMCKF: { name: "Split Hand", tests: [{ skill: "Cool", difficulty: "challenging", fail: ["cond:stunned:2"] }] },
  F8iBjvnW0pdm9DCq: { name: "Cut To The Hip", tests: [{ skill: "Endurance", difficulty: "average", failure: "Stunned (1); an Impressive Failure (-4 SL or worse) also leaves you Prone.", fail: ["cond:stunned:1", "code:if (test.result.SL <= -4) await this.actor.addCondition(\"prone\");"] }] },
  prPxHnEfcmWpj31d: { name: "Groin Job", tests: [{ skill: "Endurance", difficulty: "hard", fail: ["cond:stunned:2"] }] },
  eSWFP4RgNtmsUOYK: { name: "Liver Laceration", tests: [{ skill: "Endurance", difficulty: "challenging", success: "Contract a Festering Wound.", failure: "Contract Blood Rot.", fail: ["item:bloodrot"], pass: ["item:festering"] }] },
  yBeriLknRjgvSeoL: { name: "Facial Wound", tests: [{ skill: "Endurance", difficulty: "average", fail: ["cond:prone"] }] },
  YlTlPVO2JCHYD2bD: { name: "Split Skull", tests: [{ skill: "Endurance", difficulty: "vhard", success: "Prone, and a Minor Infection.", failure: "Unconscious; Blood Rot on an Impressive Failure (-4 SL or worse), otherwise a Minor Infection.", fail: ["cond:unconscious"], pass: ["cond:prone"], always: ["code:await api.addCoreItem(this, (test.failed && test.result.SL <= -4) ? \"bloodrot\" : \"minor\");"] }] },
  "87yUHvIiC70sQ2tq": { name: "Femoral Artery", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Artery severed too high for a tourniquet.", fail: ["note:The artery is severed too high for a tourniquet: only Surgery (and a long clamp) can remove the Bleeding Condition."] }] },
  dk904tei1ZfGCboK: { name: "Hip Strike", tests: [{ skill: "Athletics", difficulty: "challenging", fail: ["cond:prone"] }] },
  U7VlTL99EO81kKSH: { name: "Lacerated Hamstrings", tests: [{ skill: "Athletics", difficulty: "challenging", fail: ["cond:prone"] }] },
  PTv5fLjvjgHa14Kc: { name: "Shin Hit", tests: [{ skill: "Endurance", difficulty: "average", failure: "-10 to all Agility Tests for the next 1d10 turns.", fail: ["code:const turns = (await new Roll(\"1d10\").evaluate()).total;\nawait api.addEffect(this, {name: `Shin Hit: -10 Agility (${turns} turns)`, script: \"args.fields.modifier -= 10;\", activateScript: \"return args.characteristic == 'ag';\", hideScript: \"return args.characteristic != 'ag';\", rounds: turns});\nawait api.gmNote(this, `-10 to Agility Tests for ${turns} turns.`);"] }] },
  IGFqneU8USA9eCRS: { name: "Damaged Eye", tests: [{ skill: "Endurance", difficulty: "hard", failure: "Drop what is in your primary hand to clap it to the injury.", fail: ["drop:primary", "note:The hand stays clapped to the eye: they may Test Endurance at the start of each of their turns to use it normally again."] }] },

  // ---------------- Flames & Energy ----------------
  i89FvnkoRyB2nE7X: { name: "Amputation By Fire", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:unconscious"], pass: ["cond:prone", "cond:stunned:4"] }] },
  WroHu1T5dORORhfF: { name: "Burnt Fingers", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Drop anything held in that hand.", fail: ["drop:location"] }] },
  wjLVe2dajYNRePFD: { name: "Heat Shock", tests: [{ skill: "Endurance", difficulty: "hard", fail: ["cond:unconscious"], pass: ["cond:fatigued:2"] }] },
  "1dW1Br23qk7r0w7U": { name: "Horrible Burns", custom: `const test = await api.rollCritTest(this, {skill: "Endurance", difficulty: "hard"});
if (!test) return;
if (test.failed) await this.actor.addCondition("unconscious");
else {
  await this.actor.addCondition("stunned", 4);
  await this.actor.addCondition("blinded", 4);
  await this.actor.addCondition("deafened", 3);
}
// One more Challenging Endurance Test for each eye, ear and the nose
const lost = [];
for (const part of ["Left Eye", "Right Eye", "Left Ear", "Right Ear", "Nose"]) {
  const t = await api.rollCritTest(this, {skill: "Endurance", difficulty: "challenging", title: \`\${this.item.name}: \${part}\`, failure: \`Lose the \${part.toLowerCase()}.\`});
  if (t?.failed) lost.push(part);
}
// Each failed part is lost: add the core Amputated Eye/Ear/Nose.
const AMPUTATED = {Eye: "Compendium.wfrp4e-core.items.Item.weczkAMPlTjX7lqU", Ear: "Compendium.wfrp4e-core.items.Item.8piWcBKFlQ2J1E3A", Nose: "Compendium.wfrp4e-core.items.Item.SpPRZZRHxly7uo2G"};
for (const part of lost) {
  const [s, p] = part.includes(" ") ? part.split(" ") : [null, part];
  await api.addCoreItem(this, AMPUTATED[p], d => {
    if (!s) return;
    d.system.location.value = part;
    d.system.location.key = (s === "Left" ? "l" : "r") + p;
  });
}
await api.gmNote(this, lost.length ? \`Loses: \${lost.join(", ")} (Amputated items added). Total Fellowship loss is at least -30.\` : "Keeps every eye, ear and the nose. Fellowship loss from the scarring is still at least -30.");` },

  // ---------------- Piercing ----------------
  k5ko3gnmnQHc0xWM: { name: "A Close Shave", tests: [{ skill: "Cool", difficulty: "challenging", failure: "-10 to your next rolled Test.", fail: ["next:-10"] }] },
  BcNRGorAUYPTvnel: { name: "Pierced Deltoid", tests: [{ skill: "Endurance", difficulty: "hard", failure: "Drop whatever you held in that hand.", fail: ["drop:location"] }] },
  a8P9f4DV10uVMK3Y: { name: "Slashed Hand", tests: [{ skill: "Endurance", difficulty: "challenging", success: "You may not use that hand to attack as your next Action.", failure: "Drop whatever you held in that hand.", fail: ["drop:location"], always: ["note:May not use that hand to attack as their next Action."] }] },
  FDp7yWAkxgiJ4jdX: { name: "Sliced Skin", tests: [{ skill: "Cool", difficulty: "average", failure: "-10 to Tests with that arm until you pass this Test.", fail: [ARM_PENALTY("Tests with the sliced arm")] }] },
  "93sAIYWnJeztxgA7": { name: "Brain Damage", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Contract Blood Rot (meningitis).", fail: ["item:bloodrot"] }] },
  Tn77gJtZ2mRp2K5C: { name: "Slashed Chin", tests: [{ skill: "Athletics", difficulty: "average", fail: ["cond:prone"] }] },
  LN1LOsfAHRAjHaNH: { name: "Stabbed In The Face", tests: [{ skill: "Endurance", difficulty: "average", failure: "Contract a Festering Wound.", fail: ["item:festering"] }] },
  QXD7WJzQRfXySadp: { name: "You Flinched", tests: [{ skill: "Cool", difficulty: "challenging", failure: "Your next Action may not be an attack.", fail: ["note:Their next Action may not be an attack."] }] },
  ES6ivA2GPgPVLrCA: { name: "Sliced Skin", tests: [{ skill: "Cool", difficulty: "easy", failure: "Miss your next Action.", fail: ["note:Misses their next Action."] }] },
  wwssQEsJpP3CMGEp: { name: "Whack", tests: [{ skill: "Endurance", difficulty: "average", failure: "Your Movement is 0 on your next turn.", fail: ["note:Movement is reduced to 0 on their next turn."] }] },

  // ---------------- Shrapnel & Shot ----------------
  cMCUEEbfEm9sAtwQ: { name: "Jarred Hand", custom: `let test = await api.rollCritTest(this, {skill: "Endurance", difficulty: "average", failure: "Drop anything held in that hand."});
if (!test) return;
// Held in both hands: one reroll
if (test.failed && (this.item.system.weaponsAtLocation ?? []).some(w => w.system.twohanded?.value))
  test = await api.rollCritTest(this, {skill: "Endurance", difficulty: "average", title: \`\${this.item.name} (two hands: reroll)\`, failure: "Drop anything held in that hand."});
if (test?.failed) await api.dropHeld(this, {where: "location"});` },
  h8qrSnKHUgz7cuEQ: { name: "Busted Ribcage", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:prone"] }] },
  PvKPMpAcP8aGouoi: { name: "Groin Gash", pre: ["dropchoose", "cond:prone", "cond:bleeding:2"], tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:stunned:2"] }], remove: ["Groin Gash (Conditions)"] },
  qWr9xQjAMME2mBbd: { name: "Horrific Chest Injury", tests: [
    { skill: "Athletics", difficulty: "average", fail: ["cond:prone"] },
    { skill: "Endurance", difficulty: "easy", failure: "Contract a Minor Infection (if the GM uses the Infection rules).", fail: ["item:minor", "note:Minor Infection added. Delete it if you are not using the Infection rules."] }] },
  gSrOlkgPTXaeDUc3: { name: "Shredded Clothes", tests: [{ skill: "Cool", difficulty: "average", failure: "-10 to your next rolled Test.", fail: ["next:-10"] }] },
  qvpOwLpvsqNF2eZb: { name: "Brain Damage", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:unconscious"], pass: ["cond:stunned:3"] }] },
  D4wgscfhrw1Wq4om: { name: "Broken Jaw", tests: [{ skill: "Endurance", difficulty: "average", fail: ["cond:prone"] }] },
  G80q03oK02Kefc4e: { name: "Buzz", tests: [{ skill: "Cool", difficulty: "challenging", failure: "-10 to your next rolled Test.", fail: ["next:-10"] }] },
  twEuUyqJH9qmQ7R2: { name: "Torn Ear", tests: [{ skill: "Cool", difficulty: "easy", failure: "Drop what is in your primary hand to clap it to the ear.", fail: ["drop:primary"] }] },
  mJ3CLKlI68RMA7TV: { name: "Crippled Foot", tests: [{ skill: "Endurance", difficulty: "average", failure: "Contract a Festering Wound.", fail: ["item:festering"] }], remove: ["Festering Wound"] },
  dbTWvuMVrA592SQv: { name: "Too Close For Comfort", tests: [{ skill: "Cool", difficulty: "easy", failure: "-20 to your next rolled Test.", fail: ["next:-20"] }] },
  fMunYrpzf7nmRCIC: { name: "Torn Lower Leg", tests: [{ skill: "Athletics", difficulty: "average", fail: ["cond:prone"] }] },

  // ---------------- Slings ----------------
  PbalA8JA5eYRGGul: { name: "Battered Wrist", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Drop anything held in that hand.", fail: ["drop:location"] }] },
  gcvnk2nLWcG40pIH: { name: "Finger Whack", tests: [{ skill: "Endurance", difficulty: "easy", failure: "Drop whatever you held in that hand.", fail: ["drop:location"] }] },
  WZLuAuhlbj74IQIi: { name: "Clipped Shoulder", tests: [{ skill: "Athletics", difficulty: "average", fail: ["cond:prone"] }] },
  DHITrGKe9hUlN7k5: { name: "Blowout Fracture", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:prone"] }] },
  HnHzbqpUm0zD8i5z: { name: "Fractured Skull", tests: [{ skill: "Endurance", difficulty: "hard", fail: ["cond:unconscious"] }] },
  WC9CNvH3UMczklRp: { name: "Minor Concussion", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:prone"] }] },
  vqg2AhljwZUYuAT7: { name: "Near Miss", tests: [{ skill: "Cool", difficulty: "easy", failure: "-10 to your next rolled Test.", fail: ["next:-10"] }] },
  // The supplement prints "Easy (+20)"; Easy is +40 in WFRP4e, which is what the item always used.
  "0C3o31Qi0pJc9WOh": { name: "Smashed Ear", tests: [{ skill: "Endurance", difficulty: "easy", fail: ["cond:unconscious"], pass: ["cond:stunned:2"] }] },
  "3ehTjdoy72W5vZoY": { name: "Smashed Mouth", tests: [{ skill: "Endurance", difficulty: "challenging", fail: ["cond:unconscious"], pass: ["cond:stunned:3"], always: ["note:If the projectile was a Lead Bullet, a Challenging (+0) Toughness Test is also needed or the tongue is lost (see Amputated Parts); add Amputated Tongue if it fails."] }] },

  // ---------------- Teeth & Claws ----------------
  vHxXA4Nyej78zxbJ: { name: "Bite Size", tests: [{ skills: ["Cool", "Endurance"], difficulty: "vhard", fail: ["cond:stunned:3"] }] },
  NcjVtPwfYZbADvNv: { name: "Crunchy And Tasty", tests: [{ characteristic: "s", difficulty: "challenging", fail: ["cond:prone"] }] },
  "8Y7a6EGrlLNBYRcF": { name: "Marrow Munch", tests: [{ characteristic: "s", difficulty: "challenging", fail: ["cond:prone"] }] },
  Y6GQERuvKdvCwNdO: { name: "Tug-Of-War", tests: [{ characteristic: "s", difficulty: "challenging", failure: "You may not use that arm or anything held in it until the end of your next turn.", fail: ["note:May not use that arm or anything held in it until the end of their next turn."] }] },
  Efh9CwTWakKeikvS: { name: "Groin Groceries", tests: [{ skill: "Endurance", difficulty: "hard", fail: ["cond:stunned:2"] }] },
  PjTAwZ5XnI279loW: { name: "Things That Go Bump", tests: [{ characteristic: "ag", difficulty: "average", failure: "-10 to your next rolled Test.", fail: ["next:-10"] }] },
  hrHECrleEgJ1DWiK: { name: "A Close Call", tests: [{ skill: "Cool", difficulty: "challenging", failure: "-10 to your next rolled Test.", fail: ["next:-10"] }] },
  zmxLgwPdhZriUSqp: { name: "Brain Snack", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Contract a Festering Wound.", fail: ["item:festering"] }] },
  rDhYQkxISq6Ov7tq: { name: "Cracked Skull", tests: [{ skill: "Endurance", difficulty: "hard", fail: ["cond:unconscious"] }] },
  tPxA5qCybNEyz6TB: { name: "Lost Eye", tests: [{ skill: "Endurance", difficulty: "challenging", failure: "Contract a Festering Wound.", fail: ["item:festering"] }] },
  XL0ymhv3iPMNBAsv: { name: "Collision", tests: [{ characteristic: "dex", difficulty: "average", failure: "Drop what is in your primary hand; it flies 1d10 yards in a random direction.", fail: ["drop:primary", "note:The dropped item flies 1d10 yards in a random direction."] }] },
  fltOP4GCAYBH6FeB: { name: "Foot Bump", tests: [{ skill: "Athletics", difficulty: "easy", fail: ["cond:prone"] }] },
  pJAeqvnuqSl2GN0O: { name: "Severed Toe Tendons", tests: [{ skill: "Cool", difficulty: "difficult", failure: "Lose your next Action.", fail: ["note:Loses their next Action."] }] },

  // ---------------- Unarmed ----------------
  "5hPDni3U8h6OWcIY": { name: "Failed Grab", tests: [{ skill: "Cool", difficulty: "average", failure: "Your next Action may not be an attack.", fail: ["note:Their next Action may not be an attack."] }] },
  ok9nO9abuUDSRLor: { name: "Tug-Of-War", tests: [{ characteristic: "s", difficulty: "challenging", always: ["note:This is an Opposed Strength Test against the attacker; compare SL with the attacker's Strength Test. Win or draw: the enemy lets go. Lose by 1-4 SL: lose your next Action but keep the item. Lose by 5+ SL: drop it and the foe takes it. Holding it in both hands: roll twice and keep the best."] }] },
  q60aIjqX4vgWuq64: { name: "Tackle", tests: [{ characteristic: "s", difficulty: "challenging", always: ["note:This is an Opposed Strength Test against the attacker; if the attacker wins, gain Prone."] }] },
  lC7oeEqNgrmkHQyd: { name: "Broken Spine", tests: [{ characteristic: "t", difficulty: "challenging", failure: "Dies from the shock.", fail: ["cond:dead"], pass: ["cond:prone", "cond:stunned:4"] }], remove: ["Broken Spine (Conditions)"] },
  "4735Zy5xSxkqFujM": { name: "Broken Jaw", tests: [{ skill: "Endurance", difficulty: "easy", fail: ["cond:unconscious"], pass: ["cond:stunned:2"] }] },
  LpPFVARMFNqdf7pL: { name: "Fractured Cheekbone", tests: [{ skill: "Endurance", difficulty: "easy", fail: ["cond:unconscious"], pass: ["cond:stunned:2"] }] },
  eiyhE90u1kgOr800: { name: "Knee To The Face", tests: [{ skill: "Endurance", difficulty: "average", fail: ["cond:unconscious"], pass: ["cond:stunned:3"] }] },
  PIaqettRQtSxKZit: { name: "Loosened Teeth", tests: [{ characteristic: "t", difficulty: "average", failure: "Lose one tooth per SL of failure.", fail: ["code:const teeth = Math.max(1, Math.abs(test.result.SL));\nawait api.addCoreItem(this, \"teeth\", d => { d.system.location.value = `${teeth} ${d.system.location.value}`; });\nawait api.gmNote(this, `Loses ${teeth} tooth/teeth.`);"] }], remove: ["Amputated Teeth"] },
  "9DkaDUv2oSXCO916": { name: "Jump Kick", tests: [{ skill: "Endurance", difficulty: "average", fail: ["cond:prone"] }] }
};

// Criticals that mention a Test the afflicted creature rolls, but not when the wound is received
// (recurring each turn/day, after the encounter, conditional, or rolled by someone else). They keep their
// existing behaviour; listed here so the validator can tell they were reviewed.
// Criticals whose only on-receipt rule is a choice (no Test). Same generator; the effect is "<Critical> (Choice)".
export const CRIT_CHOICES = {
  VNnaUz9pQegOl34J: { name: "Duck And Cover", choices: [{
    prompt: "Flames lick your clothing. Roll on the ground to put them out, or stay on your feet?",
    options: [
      { id: "prone", label: "Duck and cover: gain Prone", do: ["cond:prone"] },
      { id: "ablaze", label: "Stay on your feet: gain Ablaze (1)", do: ["cond:ablaze:1"] }
    ] }], remove: ["Duck And Cover (Conditions)"] },
  EP1zke51auzU5Yk3: { name: "The Old Thrust And Twist", choices: [{
    prompt: "That is not survivable. Spend Fate, or, out of Fate Points, a Resilience Point to twist away?",
    options: [
      { id: "fate", label: "Spend a Fate Point", hint: "You avoid death; the GM decides what happens instead.", if: "Number(this.actor.system.status?.fate?.value ?? 0) > 0",
        do: ["code:await this.actor.update({\"system.status.fate.value\": Number(this.actor.system.status.fate.value) - 1});", "note:Spent a Fate Point to avoid death. The GM decides what happens instead."] },
      { id: "resilience", label: "Spend a Resilience Point: Prone, Stunned (3) and Bleeding (1)", hint: "Only when out of Fate Points.", if: "Number(this.actor.system.status?.fate?.value ?? 0) <= 0 && Number(this.actor.system.status?.resilience?.value ?? 0) > 0",
        do: ["code:await this.actor.update({\"system.status.resilience.value\": Number(this.actor.system.status.resilience.value) - 1});", "cond:prone", "cond:stunned:3", "cond:bleeding:1"] },
      { id: "die", label: "Accept death", do: ["cond:dead"] }
    ] }], remove: ["The Old Thrust And Twist (Conditions)"] }
};

// Criticals whose text mentions a choice / "either" / "GM decides" that is not the victim's choice on receipt.
// The validator requires every such critical to be automated (CRIT_CHOICES, a `choices` entry, "dropchoose")
// or listed here with the reason.
export const CHOICE_EXCEPTIONS = {
  NZMVDGMlrra4w33P: "Brain Damage: 'either Condition' refers to the Test's two outcomes, not a choice",
  qvpOwLpvsqNF2eZb: "Brain Damage: 'either Condition' refers to the Test's two outcomes, not a choice",
  nBFfCicVtiovy8Kf: "Burning Equipment: what burns depends on the gear carried; the GM decides",
  "5NdTvbMCKQNEqYLy": "Cerebral Hemorrhage: GM decides whether the surgeon is knowledgeable (later rehabilitation)",
  Exe25VLUOMRDtxL7: "Choking: 'either tongue or vocal cords' is flavour; the penalty is the same",
  MzWkUpqwF5FuHmL5: "Crushed Larynx: later Heal Test by yourself or someone else, not on receipt",
  fGjzrm4Y8cf81wEC: "Crushed Larynx: later Heal Test by yourself or someone else, not on receipt",
  zhQuDrutCumeCZnj: "Crushed Larynx: later Heal Test by yourself or someone else, not on receipt",
  LORNFwiqtMd7UdL5: "Dislocated Kneecap: optional later self-repair; the skill is picked when attempting it",
  Q0KJ9adNN6IZBMR3: "Dislocated Kneecap: optional later self-repair; the skill is picked when attempting it",
  p91MPWbx6NOYahVn: "Dislocated Kneecap: optional later self-repair; the skill is picked when attempting it",
  "3nLasxyEkj7LTXOZ": "Dislocated Shoulder: optional later self-repair; the skill is picked when attempting it",
  "68MFqbar18iZfCL7": "Dislocated Shoulder: optional later self-repair; the skill is picked when attempting it",
  BDDD6k9wgmbkS1JX: "Dislocated Shoulder: optional later self-repair; the skill is picked when attempting it",
  XO0l3Y3GhwYjx7FH: "Eye Injury: about the later Surgery, not on receipt",
  t872vdOoyvXj2hyq: "Pierced Wrist: later remedy (Extraction or two Actions), not on receipt",
  JPOqvnh3G8MeVQ1J: "Shredded Hand: 'pick the worst' skill for a Test before later Actions (no choice for the victim)",
  "27XFH1k68HoS2nIk": "Torn Clothing: narrative; the GM decides what is damaged",
  ok9nO9abuUDSRLor: "Tug-Of-War: two-handed grip rolls twice and keeps the best result (no choice; see the Test's note)"
};

export const NOT_ON_ADD = {
  GgC6ZlIFEL4U1GAm: "Pierced Flank: Cool Test only to extract without the Heal skill",
  mc4l9MIhgW8Ykbcd: "Gurgle: long-term Endurance Test when the broken bone heals",
  hqXbwZVNdhbJ8eUQ: "Grazed Ankle: optional Test each turn",
  aUrQh2vaxBVafxXH: "Pierced Buttock: Extraction rolled by someone else",
  Et7fsq8GjYO5Rfhv: "Cracked Collarbone: Test before each Action with the arm",
  p6KPoQHJIXFv0JVv: "Chest Wound: Test at the start of each turn",
  "2eGNocxMOg8ZBC1b": "Rib Contusion: Test at the start of each turn",
  yL5bdv4UD7mZ4rcE: "Spinal Blow: Test at the start of each turn to rise",
  AWDEqYt6sjbCtEJg: "Rattle-Rattle: daily Test to wake, then Blood Rot Test",
  "0iE2pXSdjQAfW9Wl": "Stunned Spinal Cord: Test at the start of each turn",
  NMbSTEMK2hvvVNso: "Wrecked Foot: Toughness Test after the encounter",
  F3pPhjy1YwvAG9VG: "Dislocated Elbow: Heal Test by someone else",
  BDDD6k9wgmbkS1JX: "Dislocated Shoulder: optional self-repair or Heal by someone else",
  VHlYPM4N22I3yCEt: "Fractured Vertebrae: Test at the end of each turn",
  RZzttOcDmbhK641H: "Rib Contusion: Test at the end of each turn",
  MzWkUpqwF5FuHmL5: "Crushed Larynx: Heal Test",
  mAc6uYy5tKWwjgbV: "Depressed Skull Fracture: Test after Surgery",
  aCh1tEJRc68cvfUH: "Whip-Lash Trauma: monthly Test",
  rHSnReOCWswiHAAZ: "Bruised Thigh: Test at the end of each turn / when hit again",
  LORNFwiqtMd7UdL5: "Dislocated Kneecap: optional self-repair or Heal by someone else",
  HrrHNMxGQkbW9zJn: "Bleeding Hand: Test before each Action with the hand",
  "67AXsccXYxMkht5f": "Severed Clavicle: Test at the start of each turn",
  jOZmCBnHcBNgZbgU: "Ooomph: Test at the end of each turn (existing endTurn script)",
  "8NBFVzAeXwYLcQbI": "Tummy Slice: Test at the start of each turn",
  O4tl8qhoPK5bLkSS: "Blinded: Tests per eye after the encounter",
  "55uJ4MHRmDsAGm6s": "Lacerated Foot: Test after the encounter",
  ldmb95dZVEK3KJEE: "Belly Burn: Test at the start of each turn",
  scVBZKhKe9RPuKA8: "Broiled Lungs: weekly Tests",
  "9s0vHFKnSf3YCEBG": "Spinal Burn: Test at the end of each turn (existing endTurn script)",
  hmUTSjmWPrrvch1j: "Burned Airways: weekly Tests",
  HfuBGzQrYmDaULr5: "Corneal Damage: daily Tests",
  FzFlZW06hfsvelBc: "Spinal Blaze: Test at the start of each turn (existing startTurn script)",
  XmEDOeOJsy3fyHhM: "A Mere Prick: Test only if not attacking next turn",
  WvYrbf5HFpaiUR9j: "Thigh Wound: automatic failures, no Test",
  "7EwXhvZp8Pm1hkv1": "Pierced Hand: Heal Test to remove the fragment",
  JPOqvnh3G8MeVQ1J: "Shredded Hand: Test before each Action with the hand",
  GDduQlJIwcEHHZXd: "Abdominal Pain: Test at the start of each turn",
  "1Zani2UPzynjwsYQ": "BBQ Time: Dexterity Test only to dig the fragment out",
  XO0l3Y3GhwYjx7FH: "Eye Injury: Cool Test by onlookers",
  "2nr2FB8MoEhuj8GE": "Jammed Jaw: Heal Test to remove",
  HjW2KXChtKoyRhlT: "Scalp Flap: Toughness Test after the encounter",
  pUdM0tV29QCxqJ0M: "Cracked Collarbone: Test before each Action with the arm",
  rVyFvP8sV6j0Ddpk: "Sprained Finger: Test at the start of each turn",
  FMGW5xtjzt0FzB5V: "Bruised Rib: Test at the end of each turn",
  RYjQJ29m4v19HPSP: "Brain Damage: daily Toughness Test",
  zhQuDrutCumeCZnj: "Crushed Larynx: Heal Test",
  C7RaWO5XsBqricme: "Depressed Skull Fracture: Test after Surgery",
  szjWloSBSV5lq0Bb: "Torn Throat: Heal Test by someone else",
  p91MPWbx6NOYahVn: "Dislocated Kneecap: optional self-repair or Heal by someone else",
  "9HEWkSVf9sVahqlz": "Dislocated Elbow: Heal Test",
  "3nLasxyEkj7LTXOZ": "Dislocated Shoulder: optional self-repair or Heal by someone else",
  "1j0qp1ai0VZAwMMr": "Forearm Food: Test before each Action with the hand",
  rx6zamwiLQiIi1Zw: "Ri-i-i-i-ip: Test at the start of each turn",
  Za06r7MpQFtGFIrW: "Takedown: monthly Test",
  spXpsN4qdHejPamJ: "Dislocated Elbow: Heal Test",
  "68MFqbar18iZfCL7": "Dislocated Shoulder: optional self-repair or Heal by someone else",
  X4K2vh2oECIwBsNN: "Arrhythmia: Extended Test at the start of each turn",
  fGjzrm4Y8cf81wEC: "Crushed Larynx: Heal Test",
  Q0KJ9adNN6IZBMR3: "Dislocated Kneecap: optional self-repair or Heal by someone else"
};
