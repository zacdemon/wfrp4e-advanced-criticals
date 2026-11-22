// Core injuries and diseases a critical's text says the victim gains or suffers, added by the module
// when the critical lands on a sheet. Applied to the item sources by tools/grants.mjs
// (`npm run grants`); tools/validate.mjs checks every critical against its text.
//
// Spec forms (one effect each):
//   { core: "<id>" }                          one core item, location key copied from the critical
//   { core: "<id>", value, keys: [...] }      fixed location value, one copy per key
//   { fingers: "1d10", div, add, hand5 }      lose N fingers: N Amputated Finger items (5 => Amputated Hand if hand5)
//   { toes: "1d10", div }                     lose N toes: one Amputated Toe item ("N Right Toes")
//   { teeth: "1d10", div, add }               lose N teeth: one Amputated Teeth item ("N Teeth")
//   { name, code }                            custom script; `grant(id, value, key)` and `rollCount(formula, div, add, flavor)` are in scope
// Add `fix: "<effectId>"` to rewrite an existing effect instead of adding a new one.
// N = ceil(roll / div) + add, minimum 1.

export const CORE = {
  // Amputated parts
  ampArm: "MnMZv7ZXoRqoH9dS", ampEar: "8piWcBKFlQ2J1E3A", ampEye: "weczkAMPlTjX7lqU", ampFinger: "SYjWiKDzMS6CtROJ",
  ampFoot: "gz2xy41OSVZ8YBgI", ampHand: "zyocWSzEZEC826NS", ampLeg: "k00PimCWkff11IA0", ampNose: "SpPRZZRHxly7uo2G",
  ampTeeth: "fBcZhOBn8IpoVqQ1", ampToe: "ZhMADOqoo0y8Q9bx", ampTongue: "rkJA1DlK51QuRlJy",
  // Broken bones
  brokenArmMajor: "rlDZZTj5PXjuRXa2", brokenArmMinor: "4lj1ik958mbgAlaF", brokenBodyMajor: "EaqlLRQigwnsEAXX", brokenBodyMinor: "QluSTTTq3viHJJUh",
  brokenHeadMajor: "hCadFsTRvLN9faaY", brokenHeadMinor: "nbhn2wX35b7Jrcbg", brokenLegMajor: "2iult41Jehz0F1O8", brokenLegMinor: "7mCcI3q7hgWcmbBU",
  // Torn muscles
  tornArmMajor: "qn4ZpvTQIX4rcJDl", tornArmMinor: "GlShFJF2TpsNh1FX", tornBodyMajor: "eWPN3CV2Eddwz8aM", tornBodyMinor: "7rBhIRo96Mydo0Cv",
  tornHeadMajor: "RB2sN09lX3m7dkOg", tornHeadMinor: "UytN3fDREi3JuKST", tornLegMajor: "3S4OYOZLauXctmev", tornLegMinor: "nF5z1OEhpi4t6a6S",
  // Diseases
  bloodRot: "M8XyRs9DN12XsFTQ", festering: "kKccDTGzWzSXCBOb", minorInfection: "1hQuVFZt9QnnbWzg"
};

// Display names of the core items above (names only; the items themselves live in wfrp4e-core).
export const CORE_NAMES = {
  MnMZv7ZXoRqoH9dS: "Amputated Arm", "8piWcBKFlQ2J1E3A": "Amputated Ear", weczkAMPlTjX7lqU: "Amputated Eye", SYjWiKDzMS6CtROJ: "Amputated Finger",
  gz2xy41OSVZ8YBgI: "Amputated Foot", zyocWSzEZEC826NS: "Amputated Hand", k00PimCWkff11IA0: "Amputated Leg", SpPRZZRHxly7uo2G: "Amputated Nose",
  fBcZhOBn8IpoVqQ1: "Amputated Teeth", ZhMADOqoo0y8Q9bx: "Amputated Toe", rkJA1DlK51QuRlJy: "Amputated Tongue",
  rlDZZTj5PXjuRXa2: "Broken Arm (Major)", "4lj1ik958mbgAlaF": "Broken Arm (Minor)", EaqlLRQigwnsEAXX: "Broken Body (Major)", QluSTTTq3viHJJUh: "Broken Body (Minor)",
  hCadFsTRvLN9faaY: "Broken Head (Major)", nbhn2wX35b7Jrcbg: "Broken Head (Minor)", "2iult41Jehz0F1O8": "Broken Leg (Major)", "7mCcI3q7hgWcmbBU": "Broken Leg (Minor)",
  qn4ZpvTQIX4rcJDl: "Torn Arm Muscle (Major)", GlShFJF2TpsNh1FX: "Torn Arm Muscle (Minor)", eWPN3CV2Eddwz8aM: "Torn Body Muscle (Major)", "7rBhIRo96Mydo0Cv": "Torn Body Muscle (Minor)",
  RB2sN09lX3m7dkOg: "Torn Head Muscle (Major)", UytN3fDREi3JuKST: "Torn Head Muscle (Minor)", "3S4OYOZLauXctmev": "Torn Leg Muscle (Major)", nF5z1OEhpi4t6a6S: "Torn Leg Muscle (Minor)",
  M8XyRs9DN12XsFTQ: "Blood Rot", kKccDTGzWzSXCBOb: "Festering Wound", "1hQuVFZt9QnnbWzg": "Minor Infection"
};
export const DISEASES = new Set([CORE.bloodRot, CORE.festering, CORE.minorInfection]);

const C = CORE;

// Random facial parts (Chewy-Chewy, Destroyed Face, Tyson Move).
const FACE = `const side = (s) => s === "Left" ? "l" : "r";
const lose = async (part, s) => {
  switch (part) {
    case "ear": return grant("${C.ampEar}", \`\${s} Ear\`, side(s) + "Ear");
    case "eye": return grant("${C.ampEye}", \`\${s} Eye\`, side(s) + "Eye");
    case "nose": return grant("${C.ampNose}");
    case "teeth": { const n = await rollCount("1d10", 1, 0, "Teeth Lost"); return grant("${C.ampTeeth}", \`\${n} Teeth\`); }
  }
};`;

export const GRANTS = {
  // ---------------- Arrows / Bullets / Piercing ----------------
  bsTYKjskHxGjdTeX: { name: "Abdominal Wall Penetration", grants: [{ core: C.minorInfection }] },
  w1Tmbq08pbGJXgqN: { name: "Pierced Shoulder", grants: [{ core: C.tornArmMinor }] },

  // ---------------- Crushing ----------------
  V4O7NVpuK1pcmiPG: { name: "Broken Forearm", grants: [{ core: C.festering }] },
  // "two useless legs" and Blood Rot once the Bleeding is survived
  HiogZXWlNUANMDyV: { name: "Severed Artery", grants: [{ core: C.bloodRot }, { core: C.ampLeg, keys: ["lLeg", "rLeg"], name: "Amputated Legs (both useless)" }] },

  // ---------------- Cutting ----------------
  uDbqp99c3eywi7O1: { name: "Forearm Injury", grants: [{ core: C.tornArmMinor }] },
  lQWEIIy1OUWsAsUU: { name: "Severed Foot", grants: [{ core: C.ampFoot }] },
  nNiT9lNSNvO5U8Vx: { name: "Severed Hamstrings", grants: [{ core: C.tornLegMajor }, { core: C.ampLeg, name: "Amputated Leg (useless until healed)" }] },

  // ---------------- Flames ----------------
  SmZ0RO2mrE6pWT2w: { name: "Sizzling Muscles", grants: [{ core: C.minorInfection }] },

  // ---------------- Shrapnel ----------------
  xIMqvooGVQU0X0nd: { name: "Destroyed Face", grants: [{ name: "Destroyed Face: lost parts", code: `${FACE}
// Roll three times, ignoring (not rerolling) results already rolled.
const lost = new Set();
for (let i = 0; i < 3; i++) {
  const r = (await new Roll("1d10").evaluate({allowInteractive: false}));
  await r.toMessage(this.script.getChatData({flavor: "Destroyed Face: part lost"}));
  const t = r.total;
  lost.add(t <= 2 ? "lear" : t <= 4 ? "rear" : t <= 6 ? "nose" : t === 7 ? "teeth1" : t === 8 ? "teeth2" : t === 9 ? "eye1" : "eyes");
}
if (lost.has("lear")) await lose("ear", "Left");
if (lost.has("rear")) await lose("ear", "Right");
if (lost.has("nose")) await lose("nose");
if (lost.has("teeth1")) await lose("teeth");
if (lost.has("teeth2")) await lose("teeth");
if (lost.has("eyes")) { await lose("eye", "Left"); await lose("eye", "Right"); }
else if (lost.has("eye1")) await lose("eye", (await new Roll("1d2").evaluate()).total === 1 ? "Left" : "Right");` }] },
  WzvfFwdnDc45vnig: { name: "Fractured Tibia", grants: [{ core: C.festering }] },
  "7KyjkE2iLjsnXApx": { name: "Major Thigh Wound", grants: [{ core: C.ampLeg, name: "Amputated Leg (useless until partially healed)" }] },
  UXlEHJNsaNAPolBj: { name: "Gored Glutes", grants: [{ fix: "6bbGTyVfIMIKaTI4", core: C.tornLegMajor, value: "Glutes" }] },

  // ---------------- Slings ----------------
  PbalA8JA5eYRGGul: { name: "Battered Wrist", grants: [{ core: C.tornArmMinor }] },
  DHITrGKe9hUlN7k5: { name: "Blowout Fracture", grants: [{ core: C.ampEye, name: "Amputated Eye (useless until Surgery)" }] },
  M8fNblOJg1YGBKhP: { name: "Shattered Hand", grants: [{ fingers: "1d10", div: 5, add: 1 }] },
  "3ehTjdoy72W5vZoY": { name: "Smashed Mouth", grants: [{ core: C.brokenHeadMajor, value: "Jaw" }, { teeth: "1d10" }] },
  ViBK7UyEcnI0jZpL: { name: "Toasted Tibia", grants: [{ core: C.festering }] },
  // "Should you survive ... you lose your vocal apparatus. This is effectively a lost tongue."
  szjWloSBSV5lq0Bb: { name: "Torn Throat", grants: [{ core: C.ampTongue }] },
  "5rJKx3bzp9SgZ9LD": { name: "Kidney Injury", grants: [{ fix: "FnKckpmiKPCzHnwe", core: C.brokenBodyMinor }] },
  xfiAJvMbdXevXFd4: { name: "Smashed Toe", grants: [{ fix: "PEv9lXOu6iQ0uitJ", toes: "1d10", div: 3 }] },
  iSfBDrw0WrXu2OKX: { name: "Broken Teeth", grants: [{ fix: "lipfLSNdSVQlBJJc", teeth: "1d10", div: 2 }] },

  // ---------------- Crushing (body) ----------------
  // "Successful Surgery will still not prevent you from contracting Blood Rot"
  az3XFelDFKkbagxj: { name: "Flail Chest", grants: [{ core: C.bloodRot }] },

  // ---------------- Teeth & Claws ----------------
  D8Prd3jk7SiEMZuV: { name: "Chewy-Chewy", grants: [{ name: "Chewy-Chewy: lost parts", code: `${FACE}
// 1-2 Right ear, 3-4 Left ear, 5 Nose, 6 Right eye, 7 Left eye, 8-9 1d10 teeth, 10 roll twice
const rolls = [];
let pending = 1;
while (pending-- > 0 && rolls.length < 6) {
  const r = (await new Roll("1d10").evaluate({allowInteractive: false}));
  await r.toMessage(this.script.getChatData({flavor: "Chewy-Chewy: part lost"}));
  if (r.total === 10) pending += 2; else rolls.push(r.total);
}
const done = new Set();
for (const t of rolls) {
  const part = t <= 2 ? "Right ear" : t <= 4 ? "Left ear" : t === 5 ? "nose" : t === 6 ? "Right eye" : t === 7 ? "Left eye" : "teeth";
  if (part !== "teeth" && done.has(part)) continue;
  done.add(part);
  const [s, p] = part.includes(" ") ? part.split(" ") : [undefined, part];
  await lose(p, s);
}` }] },
  lr14NdbDdWEAa25y: { name: "Don’t Like Fast Food", grants: [{ core: C.tornLegMajor }] },
  UtqaXGIw52QmZJET: { name: "Knee d’Oeuvre", grants: [{ core: C.festering }] },
  "1lOqp7QU9mt7d2yo": { name: "I Like My Steak Bloody", grants: [{ core: C.ampLeg, name: "Amputated Leg (nerves severed)" }] },
  RuSGec7YvCOct8En: { name: "Digit Delight", grants: [{ fix: "oxgqOOpgVCZ5DQGI", fingers: "1d10", div: 2, hand5: true }] },

  // ---------------- Unarmed ----------------
  "68MFqbar18iZfCL7": { name: "Dislocated Shoulder", grants: [{ core: C.ampArm, name: "Amputated Arm (useless until popped back)" }] },
  EuXAoXYFzTdx9Bba: { name: "Shin Stomp", grants: [{ core: C.festering }] },
  iaOeRXuvdN3qEL9U: { name: "Internal Bleeding", grants: [{ fix: "0Ci7os10H06XkTeG", core: C.brokenBodyMinor }] },
  YvAyYquKdWQjgVZx: { name: "Tyson Move", grants: [{ name: "Tyson Move: bitten off", code: `${FACE}
// 1-3 The nose, 4-8 One ear, 9-10 Cheek and/or lip: permanent -10 Fellowship
const r = (await new Roll("1d10").evaluate({allowInteractive: false}));
await r.toMessage(this.script.getChatData({flavor: "Tyson Move: what got bitten off"}));
if (r.total <= 3) await lose("nose");
else if (r.total <= 8) await lose("ear", (await new Roll("1d2").evaluate()).total === 1 ? "Left" : "Right");
else {
  const api = game.modules.get("artantares-advanced-criticals")?.api;
  const msg = "Cheek and/or lip bitten off: permanent -10 Fellowship (adjust the character's Fellowship).";
  if (api?.gmNote) await api.gmNote(this, msg); else ui.notifications.warn(msg);
}` }] },

  // ---------------- Finger / toe / teeth counts (existing grants only ever added one) ----------------
  yCSM8r0tdLkS0vY1: { name: "Broken Fingers", grants: [{ fix: "niQtekDQWREIoCNP", fingers: "2" }] },
  WroHu1T5dORORhfF: { name: "Burnt Fingers", grants: [{ fix: "CraQFLYIH3kETveS", fingers: "1d10", div: 5 }] },
  i6VrHuzcQswXY89I: { name: "Lost Finger", grants: [{ fix: "s7qil6i7JZ2MMrig", fingers: "1d10", div: 5 }] },
  erh2fogUbLkKgp8w: { name: "Ruined Hand", grants: [{ fix: "zmjCjT8Mr3JjQ8eO", fingers: "1d10", div: 2, hand5: true }] },
  mJ3CLKlI68RMA7TV: { name: "Crippled Foot", grants: [{ fix: "UXDHEdAY62GcUY0Q", toes: "1d10", div: 5 }] },
  jDjqwZxYOCiIaelg: { name: "Exploded Foot", grants: [{ fix: "pzotOExCXSwWjIIS", toes: "1d10", div: 2 }] },
  JWgj7A9H48wdArsI: { name: "Eat This", grants: [{ fix: "V8xeyFTpM1bkLwC2", teeth: "1d10", div: 2 }] },
  eiyhE90u1kgOr800: { name: "Knee To The Face", grants: [{ fix: "icBBjkarjNjuyt1v", teeth: "1d10", add: 5 }] },
  II1XmdKEKlx7rWHY: { name: "Lost Eye", grants: [{ fix: "6DaBUjNTF9ZOTNUM", teeth: "1d10", div: 2 }] }
};

// Criticals whose text names an injury/disease the module deliberately does not add on receipt.
// `skip` lists the categories (as named by tools/validate.mjs) excused for that critical.
const R = {
  afterTreatment: "Only after treatment: the limb is useless (Amputated item added) until Surgery/Medical Attention, after which it counts as this injury instead. The GM swaps the items then.",
  afterEncounter: "The limb is useless for the rest of the encounter (Amputated item added); only afterwards does it count as this injury. The GM swaps the items then.",
  untreated: "Only if Surgery is not received in time (gangrene, infection or a failed later Test). The GM adds it if that happens.",
  healingProxy: "Only 'for healing purposes': the critical's own Conditions/effects model the injury, so adding the core item would double the penalties.",
  laterTest: "Depends on a Test or event later on (after the encounter, on waking, after Surgery), not on receipt.",
  random: "Long-term effect from a 1d10 table rolled later; the GM resolves it.",
  chance: "Only on a later chance (e.g. a 25% chance the leg breaks when used); the GM adds it if it happens.",
  temporary: "Only temporary (until a Test is passed or the encounter ends); no permanent Amputated item.",
  leadBullet: "Only if the projectile was a Lead Bullet, which the critical cannot know; the base injury is added.",
  extraction: "Only if Extraction is not performed within a week; the GM adds it then."
};
const ex = (name, skip, reason) => ({ name, skip, reason });
export const GRANT_EXCEPTIONS = {
  mG9xv1EhHn1kgR80: ex("A Burrower", ["torn-major"], R.afterTreatment),
  g7e0KJNkCiNBzJYA: ex("Achilles Atrocity", ["torn-major"], R.afterEncounter),
  Uhy7LuF8zy6PEvzW: ex("Amputation Case", ["bloodrot"], R.untreated),
  pvdPRgDZDxrDdaoV: ex("Amputation Case", ["bloodrot"], R.untreated),
  ylOZCXxwRXIdwB85: ex("Amputation Case", ["bloodrot"], R.untreated),
  "3v4E6j749VTgXJgU": ex("Between A Rock And A Hard Place", ["bloodrot"], R.untreated),
  O4tl8qhoPK5bLkSS: ex("Blinded", ["amputation"], "An Easy (+40) Endurance Test per eye after the encounter decides which eyes are lost; the GM adds Amputated Eye then."),
  NZMVDGMlrra4w33P: ex("Brain Damage", ["amputation"], R.random),
  RGNsy5QTo5ZXXqBk: ex("Brain Damage", ["amputation"], R.random),
  RYjQJ29m4v19HPSP: ex("Brain Damage", ["amputation"], "Hemiplegia (a random arm and leg useless) only on waking after daily Toughness Tests; the GM adds it then."),
  qvpOwLpvsqNF2eZb: ex("Brain Damage", ["amputation"], R.random),
  V4O7NVpuK1pcmiPG: ex("Broken Forearm", ["broken-major"], R.afterTreatment),
  txMuW78FDmibYhu6: ex("Broken Jaw", ["broken-major"], R.leadBullet),
  sLLmGmvrmJtqsNuR: ex("Compartment Syndrome", ["torn-major", "bloodrot"], "Surgery within 48 hours turns the useless arm into a Torn Muscle (Major); without it the arm is lost and Blood Rot sets in. The GM applies whichever happens."),
  vCWodBYRyxOuxjLZ: ex("Compartment Syndrome", ["torn-major", "bloodrot"], "Surgery within 48 hours turns the useless leg into a Torn Muscle (Major); without it the leg is lost and Blood Rot sets in. The GM applies whichever happens."),
  qT3C75FIDgFoV37l: ex("Could You Slice It For Me", ["bloodrot"], R.untreated),
  S0H8cDdSqnbme37n: ex("Cracked Fibula", ["torn-major"], "Counts as a Torn Muscle (Major) only once the leg is bound up after the encounter; until then its own M/Agility penalties apply."),
  "82UjahdpI1bugwQw": ex("Debridement Case", ["torn-major"], R.afterEncounter),
  jgg32pSvcVfCNie1: ex("Debridement Case", ["torn-major"], R.afterEncounter),
  C7RaWO5XsBqricme: ex("Depressed Skull Fracture", ["bloodrot"], R.laterTest),
  mAc6uYy5tKWwjgbV: ex("Depressed Skull Fracture", ["bloodrot"], R.laterTest),
  zuoDX6PR8qYC7ZKK: ex("Destroyed Knee", ["bloodrot"], R.untreated),
  Pp7sc74ponYjsMb3: ex("Did A Mole Just Hit Me", ["torn-major"], "The arm is useless for 1d10 days (Amputated Arm added), then becomes a Torn Muscle (Major). The GM swaps the items then."),
  "9HEWkSVf9sVahqlz": ex("Dislocated Elbow", ["torn-minor"], R.afterTreatment),
  F3pPhjy1YwvAG9VG: ex("Dislocated Elbow", ["torn-minor"], R.afterTreatment),
  spXpsN4qdHejPamJ: ex("Dislocated Elbow", ["torn-minor"], R.afterTreatment),
  JcMjGRmp4lrqMueI: ex("Dislocated Hip", ["broken-major"], R.afterTreatment),
  LORNFwiqtMd7UdL5: ex("Dislocated Kneecap", ["torn-minor"], R.afterTreatment),
  Q0KJ9adNN6IZBMR3: ex("Dislocated Kneecap", ["torn-minor"], R.afterTreatment),
  p91MPWbx6NOYahVn: ex("Dislocated Kneecap", ["torn-minor"], R.afterTreatment),
  xRSvZDelTaq1pZq5: ex("Double Pneumothorax", ["torn-major"], R.healingProxy),
  XO0l3Y3GhwYjx7FH: ex("Eye Injury", ["festering", "amputation"], R.untreated),
  cUepuxnoVtCcMqvs: ex("Foot Fracture", ["amputation"], "The lamed foot or lost toes come only after the week, depending on whether Surgery is received; the GM adds them then."),
  hHMfw6Mbx1bCX7hw: ex("Fractured Fibula", ["torn-major"], "Counts as a Torn Muscle (Major) only once the leg is bound up after the encounter; until then its own M/Agility penalties apply."),
  "7LV0DC8IlTKWu10x": ex("Fractured Forearm", ["broken-major"], R.afterTreatment),
  WzvfFwdnDc45vnig: ex("Fractured Tibia", ["broken-major"], R.afterTreatment),
  RBoZwBntMBQ6swQy: ex("Impaled Hand", ["broken-minor"], R.healingProxy),
  XZawff9qbvnGO8Yh: ex("Jammed Shoulder", ["broken-major"], R.afterTreatment),
  BpWs9mu0aOAXLF93: ex("Lower Spine Injury", ["broken-major"], R.afterTreatment),
  obWFS2QpkUF4mMpZ: ex("Massive Abdominal Trauma", ["bloodrot"], "Blood Rot only if magical healing saves the victim before they die; the GM adds it then."),
  inKQR6KZxE380mOd: ex("Open Fracture", ["bloodrot"], R.untreated),
  "1pdNgRb76CMQ4zhQ": ex("Pecs For The Peckish", ["torn-minor"], R.healingProxy),
  uwcalBHNTEOWP6l7: ex("Pierced Foot", ["torn-minor"], R.healingProxy),
  dly7oVBNTsCiGnZf: ex("Pierced Lung", ["torn-major"], R.healingProxy),
  gq5OONKGQSdb5Yvp: ex("Pierced Patellar Tendon", ["torn-minor"], "Becomes a Torn Muscle (Minor) only after the arrow is Extracted; the GM swaps it then."),
  r9O55VccZaatzhtu: ex("Pierced Pericardium", ["festering"], "The Festering Wound comes from the Surgery, whenever it happens; the GM adds it then."),
  rl6IkVi9hRgv2U2f: ex("Pierced Pericardium", ["festering"], "The Festering Wound comes from the Surgery, whenever it happens; the GM adds it then."),
  aNePd5xUZy2IQo5t: ex("Pneumothorax", ["torn-major"], R.healingProxy),
  fgp22fznnOc88hzz: ex("Pneumothorax", ["torn-major"], R.healingProxy),
  AWDEqYt6sjbCtEJg: ex("Rattle-Rattle", ["bloodrot"], R.laterTest),
  "3tPmMBHIanc8nCNe": ex("Respiratory Banquet", ["torn-major"], R.healingProxy),
  KEPiysc3KfWocBsJ: ex("Ruined Face", ["festering"], R.extraction),
  "2u9YjKGpRYFq13ug": ex("Severe Shoulder Injury", ["torn-major"], R.afterTreatment),
  zASHP6arZJ6pIUwm: ex("Shattered Foot", ["bloodrot"], R.untreated),
  UwcuqJtSrlVcG0ec: ex("Shattered Tibia", ["broken-major", "amputation"], "Surgery within a week makes it a Broken Bone (Major), otherwise the leg is permanently useless; the GM adds whichever applies. The Festering Wound is added."),
  EuXAoXYFzTdx9Bba: ex("Shin Stomp", ["amputation"], "Without Surgery within a week the leg is lost permanently; the Broken Bone (Major) and Festering Wound are added."),
  "5Xh2DqMZkunyKJZL": ex("Snapped Lower Leg", ["broken-major"], R.afterTreatment),
  di73eoiRSf6cMCKF: ex("Split Hand", ["torn-major"], R.afterEncounter),
  rVyFvP8sV6j0Ddpk: ex("Sprained Finger", ["amputation"], R.temporary),
  K2AO6zrSf45cBJw3: ex("Sucking Chest Wound", ["torn-major"], R.healingProxy),
  j0u1LH223Uku48Yu: ex("Sucking Chest Wound", ["torn-major"], R.healingProxy),
  fnH5gZWYC5CK5gqA: ex("Swollen Knee", ["torn-minor"], R.afterEncounter),
  "2btFmyYUh2ZjIzgj": ex("Time Bomb", ["amputation"], R.chance),
  brBU5Ee2GokemQnp: ex("Torn Diaphragm", ["torn-major"], R.healingProxy),
  s3yuDAliMTTPcz10: ex("Torn Hand", ["torn-major"], R.afterEncounter),
  OnGGsgjuFB7In3NT: ex("What the", ["festering"], R.untreated),
  NMbSTEMK2hvvVNso: ex("Wrecked Foot", ["bloodrot"], R.laterTest)
};
