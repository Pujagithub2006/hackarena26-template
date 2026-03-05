// ─── healthScore.js ───────────────────────────────────────────
// Dynamic Weighted Health Score Engine
// 10 parameters, weights always redistribute to sum = 100
// + Glycemic Impact Score for each meal

// ================================================================
// PARAMETER SCORERS — each returns 0.0 to 1.0
// ================================================================

function scoreHR(hr) {
  if (hr >= 60 && hr <= 80) return 1.0;
  if (hr >= 55 && hr <  60) return 0.85;
  if (hr >  80 && hr <= 90) return 0.70;
  if (hr >  90 && hr <= 100)return 0.45;
  if (hr > 100)              return 0.15;
  if (hr <  55)              return 0.75;
  return 0.5;
}
function scoreSpO2(spo2) {
  if (spo2 >= 98) return 1.0;
  if (spo2 === 97)return 0.90;
  if (spo2 === 96)return 0.70;
  if (spo2 === 95)return 0.50;
  if (spo2 === 94)return 0.30;
  return 0.10;
}
function scoreHRV(hrv) {
  if (hrv >= 70)             return 1.0;
  if (hrv >= 55 && hrv < 70) return 0.85;
  if (hrv >= 40 && hrv < 55) return 0.65;
  if (hrv >= 30 && hrv < 40) return 0.40;
  if (hrv <  30)             return 0.20;
  return 0.5;
}
function scoreStress(stress) {
  if (stress === 'Low')      return 1.0;
  if (stress === 'Moderate') return 0.60;
  if (stress === 'High')     return 0.20;
  return 0.5;
}
function scoreSteps(steps) {
  if (steps >= 10000) return 1.0;
  if (steps >= 7500)  return 0.85;
  if (steps >= 5000)  return 0.65;
  if (steps >= 2500)  return 0.40;
  if (steps >= 1000)  return 0.20;
  return 0.10;
}
function scoreBMI(bmi) {
  const b = parseFloat(bmi);
  if (b >= 18.5 && b <= 24.9) return 1.0;
  if (b >= 25.0 && b <= 27.0) return 0.75;
  if (b >= 27.1 && b <= 29.9) return 0.55;
  if (b >= 30.0 && b <= 34.9) return 0.30;
  if (b >= 35.0)               return 0.10;
  if (b <  18.5)               return 0.50;
  return 0.5;
}
function scoreCalories(diary, goal) {
  const todayKcal = diary.reduce((a, m) => a + (m.kcal || 0), 0);
  if (todayKcal === 0) return 0.7;
  const target = goal === 'weightloss' ? 1600 : goal === 'muscle' ? 2800 : 2200;
  const ratio  = todayKcal / target;
  if (ratio >= 0.85 && ratio <= 1.10) return 1.0;
  if (ratio >= 0.70 && ratio <  0.85) return 0.75;
  if (ratio >  1.10 && ratio <= 1.25) return 0.60;
  if (ratio <  0.70)                  return 0.40;
  return 0.25;
}
function scoreMedicalRisk(diseases) {
  const count = (diseases || []).filter(d => d !== 'None').length;
  if (count === 0) return 1.0;
  if (count === 1) return 0.75;
  if (count === 2) return 0.55;
  return 0.30;
}
function scoreGoalAlignment(profile, vitals, diary) {
  const goal    = profile?.goal;
  const protein = diary.reduce((a, m) => a + (m.protein || 0), 0);
  const kcal    = diary.reduce((a, m) => a + (m.kcal    || 0), 0);
  let score     = 0.6;
  if (goal === 'weightloss') {
    if (kcal > 0 && kcal < 1700) score += 0.2;
    if (vitals.steps > 7000)     score += 0.2;
  } else if (goal === 'muscle') {
    if (protein > parseFloat(profile?.weight || 70) * 1.5) score += 0.3;
    if (vitals.activity === 'High') score += 0.1;
  } else if (goal === 'energy') {
    if (vitals.stress !== 'High' && vitals.hr < 85) score += 0.3;
  } else if (goal === 'recovery') {
    if (vitals.hrv > 40) score += 0.3;
  } else { score = 0.8; }
  return Math.min(1.0, score);
}
function scoreGI(diary) {
  if (!diary || diary.length === 0) return 0.75;
  const giMap  = { Low: 1.0, Medium: 0.60, High: 0.20 };
  const scores = diary.map(m => giMap[m.gi] ?? 0.60);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ================================================================
// DYNAMIC WEIGHT REDISTRIBUTION — total always = 100
// ================================================================
function getDynamicWeights(profile, vitals) {
  const diseases = profile?.diseases || [];
  const goal     = profile?.goal     || 'balance';
  const age      = parseInt(profile?.age) || 25;
  const activity = profile?.activity || 'Moderately Active';

  const hasDiabetes     = diseases.some(d => d.toLowerCase().includes('diabetes'));
  const hasHypertension = diseases.some(d => d.toLowerCase().includes('hypertension'));
  const hasHeartDisease = diseases.some(d => d.toLowerCase().includes('heart'));
  const hasPCOS         = diseases.some(d => d.toLowerCase().includes('pcos'));
  const hasThyroid      = diseases.some(d => d.toLowerCase().includes('thyroid'));
  const isAthlete       = activity === 'Athlete' || activity === 'Very Active';
  const isOlder         = age > 45;

  const w = { hr:10, spo2:10, hrv:10, stress:10, steps:10, bmi:10, calories:10, medicalRisk:10, goalAlign:10, gi:10 };

  function transfer(from, to, amount) {
    const actual = Math.min(amount, w[from] - 3);
    if (actual <= 0) return;
    w[from] -= actual;
    w[to]   += actual;
  }

  if (hasHeartDisease)  { transfer('gi','hr',5);       transfer('steps','stress',5); }
  if (hasHypertension)  { transfer('gi','hr',5);        transfer('goalAlign','stress',5); }
  if (hasDiabetes)      { transfer('hrv','gi',5);       transfer('steps','calories',5); }
  if (hasPCOS)          { transfer('hrv','bmi',5);      transfer('gi','calories',5); }
  if (hasThyroid)       { transfer('gi','calories',5);  transfer('steps','bmi',5); }
  if (goal==='weightloss'){ transfer('medicalRisk','calories',5); transfer('hrv','steps',5); transfer('gi','bmi',3); }
  if (goal==='muscle')    { transfer('gi','calories',5); transfer('bmi','goalAlign',5); }
  if (goal==='energy')    { transfer('bmi','hrv',5);    transfer('gi','stress',5); }
  if (goal==='recovery')  { transfer('calories','hrv',5); transfer('gi','stress',5); transfer('bmi','steps',3); }
  if (isOlder)  { transfer('steps','hr',5); transfer('goalAlign','spo2',5); transfer('gi','medicalRisk',3); }
  if (isAthlete){ transfer('medicalRisk','hrv',5); transfer('bmi','steps',5); }
  if (vitals.hr > 90)           transfer('gi','hr',5);
  if (vitals.spo2 < 96)         transfer('goalAlign','spo2',5);
  if (vitals.hrv < 35)          transfer('bmi','hrv',5);
  if (vitals.stress === 'High') transfer('gi','stress',5);

  // Ensure exactly 100
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total !== 100) w.goalAlign += (100 - total);

  return w;
}

// ================================================================
// MAIN HEALTH SCORE CALCULATOR
// Score = Σ(score_i × weight_i) / 100 → always 0–100
// ================================================================
export function calculateHealthScore(profile, vitals, diary = []) {
  const w = getDynamicWeights(profile, vitals);
  const scores = {
    hr:          scoreHR(vitals.hr),
    spo2:        scoreSpO2(vitals.spo2),
    hrv:         scoreHRV(vitals.hrv),
    stress:      scoreStress(vitals.stress),
    steps:       scoreSteps(vitals.steps),
    bmi:         scoreBMI(profile?.bmi),
    calories:    scoreCalories(diary, profile?.goal),
    medicalRisk: scoreMedicalRisk(profile?.diseases),
    goalAlign:   scoreGoalAlignment(profile, vitals, diary),
    gi:          scoreGI(diary),
  };

  let weightedSum = 0;
  for (const key of Object.keys(scores)) weightedSum += scores[key] * (w[key] || 10);
  const percentage = Math.round(weightedSum / 100);

  const LABELS = {
    hr:'❤️ Heart Rate', spo2:'🫁 Blood Oxygen', hrv:'🧬 HRV',
    stress:'🧠 Stress', steps:'👟 Steps', bmi:'⚖️ BMI',
    calories:'🔥 Calories', medicalRisk:'🏥 Medical Risk',
    goalAlign:'🎯 Goal Alignment', gi:'📊 Glycemic Index',
  };

  const breakdown = Object.keys(scores).map(key => ({
    key, label: LABELS[key]||key,
    score:        Math.round(scores[key] * 100),
    weight:       w[key] || 10,
    contribution: Math.round(scores[key] * (w[key]||10)),
  })).sort((a, b) => b.weight - a.weight);

  const totalWeight = Object.values(w).reduce((a,b)=>a+b,0);
  return { percentage, breakdown, scores, weights:w, totalWeight };
}

// ================================================================
// GLYCEMIC IMPACT SCORE
// Explains WHY two same-calorie meals are completely different
// for this specific person's body right now
// ================================================================

// Known fiber-rich ingredients
const FIBER_FOODS = ['oats','dal','lentil','rajma','chana','beans','spinach','broccoli',
  'carrot','apple','pear','banana','sweet potato','brown rice','quinoa','barley',
  'methi','palak','whole wheat','roti','poha','sabzi','vegetable'];

// Known anti-spike / slow-release foods
const ANTI_SPIKE = ['cinnamon','vinegar','lemon','lime','fenugreek','methi','oats',
  'barley','lentil','dal','nuts','seeds','curd','yogurt','buttermilk'];

// Known anti-inflammatory foods
const ANTI_INFLAM = ['turmeric','ginger','garlic','omega','salmon','flaxseed','walnut',
  'berries','spinach','kale','green tea','amla','tulsi','ashwagandha'];

function containsAny(ingredients, list) {
  if (!ingredients || ingredients.length === 0) return false;
  const joined = ingredients.join(' ').toLowerCase();
  return list.some(item => joined.includes(item));
}

export function calculateGlycemicImpact(meal, vitals, profile) {
  const diseases  = profile?.diseases || [];
  const goal      = profile?.goal     || 'balance';
  const gi        = meal.gi           || 'Medium';
  const gl        = meal.gl           || 15;
  const protein   = meal.protein      || 0;
  const fat       = meal.fat          || 0;
  const carbs     = meal.carbs        || 0;
  const ingredients = (meal.ingredients || []).map(i => i.toLowerCase());

  const isDiabetic     = diseases.some(d => d.toLowerCase().includes('diabetes'));
  const hasPCOS        = diseases.some(d => d.toLowerCase().includes('pcos'));
  const hasHeartDisease= diseases.some(d => d.toLowerCase().includes('heart'));
  const isPostExercise = vitals.steps > 8000 && vitals.activity === 'High';

  const breakdown = []; // tracks each factor with reason
  let score = 0;

  // ── 1. Base GI Score (most important factor) ─────────────────
  let giBase = 0;
  if (gi === 'Low')    { giBase = 40; breakdown.push({ label:'Low GI',        value:'+40', positive:true,  reason:'Slow glucose release — no blood sugar spike' }); }
  else if (gi==='Medium'){ giBase=22; breakdown.push({ label:'Medium GI',     value:'+22', positive:true,  reason:'Moderate glucose release — manageable impact' }); }
  else                  { giBase = 8; breakdown.push({ label:'High GI',        value:'+8',  positive:false, reason:'Rapid glucose spike — energy crash likely' }); }
  score += giBase;

  // ── 2. Glycemic Load (GL) — GI × actual carb quantity ────────
  // GL = (GI × carbs) / 100, but we use meal's gl directly
  if (gl < 10)       { score += 15; breakdown.push({ label:'Low GL',         value:'+15', positive:true,  reason:'Small actual carb load — minimal insulin demand' }); }
  else if (gl <= 20) { score +=  5; breakdown.push({ label:'Moderate GL',    value:'+5',  positive:true,  reason:'Moderate carb load — manageable for most people' }); }
  else               { score -= 10; breakdown.push({ label:'High GL',        value:'-10', positive:false, reason:'Large carb load — significant insulin response' }); }

  // ── 3. Protein buffer (slows glucose absorption) ─────────────
  if (protein >= 25) { score += 12; breakdown.push({ label:'High Protein',   value:'+12', positive:true,  reason:`${protein}g protein slows glucose into bloodstream` }); }
  else if (protein >= 15) { score += 6; breakdown.push({ label:'Moderate Protein', value:'+6', positive:true, reason:`${protein}g protein partially buffers glucose spike` }); }
  else               { score -=  3; breakdown.push({ label:'Low Protein',    value:'-3',  positive:false, reason:'Low protein means faster glucose absorption' }); }

  // ── 4. Fat buffer (further slows digestion) ──────────────────
  if (fat >= 10 && fat <= 25) { score += 5; breakdown.push({ label:'Healthy Fat',   value:'+5',  positive:true,  reason:`${fat}g healthy fat slows gastric emptying` }); }
  else if (fat > 25)          { score -= 5; breakdown.push({ label:'Excess Fat',    value:'-5',  positive:false, reason:'Too much fat causes sluggishness and poor absorption' }); }

  // ── 5. Fiber-rich ingredients ─────────────────────────────────
  if (containsAny(ingredients, FIBER_FOODS)) {
    const bonus = hasHeartDisease ? 14 : 8;
    score += bonus;
    breakdown.push({ label:'Fiber-Rich',    value:`+${bonus}`, positive:true,  reason:'Soluble fiber traps glucose — prevents sharp spikes' });
  }

  // ── 6. Anti-spike ingredients ─────────────────────────────────
  if (containsAny(ingredients, ANTI_SPIKE)) {
    score += 8;
    breakdown.push({ label:'Anti-Spike Foods', value:'+8', positive:true, reason:'Fenugreek/curd/lemon proven to lower post-meal glucose' });
  }

  // ── 7. Anti-inflammatory ingredients ─────────────────────────
  if (containsAny(ingredients, ANTI_INFLAM)) {
    const bonus = vitals.hrv < 35 ? 12 : 6;
    score += bonus;
    breakdown.push({ label:'Anti-Inflammatory', value:`+${bonus}`, positive:true, reason:'Reduces oxidative stress that impairs insulin sensitivity' });
  }

  // ── 8. Medical condition modifiers ───────────────────────────
  if (isDiabetic) {
    if (gi === 'Low') {
      score += 15;
      breakdown.push({ label:'Diabetic Bonus',   value:'+15', positive:true,  reason:'Low GI critical for your diabetes — excellent choice' });
    } else if (gi === 'High') {
      score -= 20;
      breakdown.push({ label:'Diabetic Penalty', value:'-20', positive:false, reason:'High GI dangerous for diabetes — spikes blood glucose' });
    }
    if (gl > 20) {
      score -= 10;
      breakdown.push({ label:'High GL Warning',  value:'-10', positive:false, reason:'High glycemic load especially harmful for diabetics' });
    }
  }

  if (hasPCOS) {
    if (gi === 'Low') { score += 10; breakdown.push({ label:'PCOS Friendly',   value:'+10', positive:true,  reason:'Low GI reduces insulin resistance common in PCOS' }); }
    else              { score -=  8; breakdown.push({ label:'PCOS Concern',    value:'-8',  positive:false, reason:'High GI worsens insulin resistance in PCOS' }); }
  }

  if (hasHeartDisease && fat > 20) {
    score -= 8;
    breakdown.push({ label:'Heart Risk',       value:'-8',  positive:false, reason:'High fat intake strains cardiovascular system' });
  }

  // ── 9. Live vitals modifiers ──────────────────────────────────
  if (vitals.hr > 90) {
    if (gi === 'High') { score -= 12; breakdown.push({ label:'HR Alert',       value:'-12', positive:false, reason:'High GI + elevated HR = extra cardiovascular stress' }); }
    else               { score +=  5; breakdown.push({ label:'HR Safe',        value:'+5',  positive:true,  reason:'Low/Medium GI safer for your elevated heart rate' }); }
  }

  if (vitals.stress === 'High') {
    // Cortisol already raises blood sugar — low GI even more important
    if (gi === 'Low') { score += 10; breakdown.push({ label:'Stress Sync',    value:'+10', positive:true,  reason:'Low GI counters cortisol-driven glucose elevation' }); }
    else              { score -= 10; breakdown.push({ label:'Stress Risk',    value:'-10', positive:false, reason:'High stress + high GI = dangerous glucose double-spike' }); }
  }

  if (vitals.hrv < 35) {
    // Low HRV = poor recovery = inflammation — anti-inflammatory helps
    if (containsAny(ingredients, ANTI_INFLAM)) {
      score += 8;
      breakdown.push({ label:'Recovery Boost', value:'+8',  positive:true,  reason:'Anti-inflammatory foods aid HRV recovery' });
    }
  }

  if (isPostExercise && gi === 'High') {
    // Post exercise, glycogen replenishment — high GI is actually ok
    score += 10;
    breakdown.push({ label:'Post-Exercise',   value:'+10', positive:true,  reason:'High steps + high GI = glycogen replenishment window' });
  }

  // ── 10. Goal alignment ────────────────────────────────────────
  if (goal === 'weightloss' && gi === 'Low' && gl < 15) {
    score += 8;
    breakdown.push({ label:'Fat Loss Aligned', value:'+8', positive:true, reason:'Low GI/GL keeps insulin low — promotes fat burning' });
  }
  if (goal === 'muscle' && protein >= 25) {
    score += 6;
    breakdown.push({ label:'Muscle Aligned',   value:'+6', positive:true, reason:'High protein post-meal supports muscle protein synthesis' });
  }
  if (goal === 'energy' && gi === 'Low' && gl < 15) {
    score += 8;
    breakdown.push({ label:'Energy Aligned',   value:'+8', positive:true, reason:'Slow glucose = sustained energy without crash' });
  }

  // ── Final score — clamp 0-100 ─────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // Impact label
  const label    = score>=80?'Excellent':score>=65?'Good':score>=45?'Fair':score>=25?'Poor':'Harmful';
  const color    = score>=80?'#4cffb0':score>=65?'#b6f542':score>=45?'#ffb347':score>=25?'#ff9a3c':'#ff5e5e';
  const icon     = score>=80?'🟢':score>=65?'🟡':score>=45?'🟠':score>=25?'🔴':'⛔';

  // Generate comparison insight
  const insight = generateInsight(score, gi, gl, protein, isDiabetic, hasPCOS, vitals, goal);

  return { score, label, color, icon, breakdown, insight };
}

function generateInsight(score, gi, gl, protein, isDiabetic, hasPCOS, vitals, goal) {
  if (score >= 80) {
    if (isDiabetic) return 'Ideal for diabetes — low GI prevents blood sugar spikes while providing sustained energy.';
    if (vitals.stress === 'High') return 'Perfect for high-stress days — slow glucose release counters cortisol-driven spikes.';
    return 'Excellent glycemic profile — your body will absorb this efficiently without energy crashes.';
  }
  if (score >= 65) {
    if (gl > 15) return 'Good choice but moderate carb load — pair with a walk after eating to reduce glucose impact.';
    return 'Good glycemic impact — this meal supports steady energy without major insulin spikes.';
  }
  if (score >= 45) {
    if (gi === 'Medium') return 'Fair impact — add curd or a handful of nuts alongside to buffer the glucose absorption.';
    return 'Moderate glycemic impact — consider reducing portion size by 20% to lower the overall load.';
  }
  if (score >= 25) {
    if (isDiabetic) return '⚠️ Not recommended for diabetes — this meal may cause significant blood glucose elevation.';
    return 'Poor glycemic impact — this meal may cause energy crashes 1-2 hours after eating.';
  }
  return '⛔ High glycemic risk for your current health state — consider one of the other options.';
}

// ================================================================
// TIER CLASSIFIER
// ================================================================
export function getHealthTier(percentage) {
  if (percentage >= 85) return { tier:'PEAK',     label:'Peak Performance', color:'#b6f542', icon:'🏆', description:'Your body is in optimal state today.' };
  if (percentage >= 70) return { tier:'GOOD',     label:'Good Health',      color:'#4cffb0', icon:'✅', description:'Minor optimizations can enhance your day.' };
  if (percentage >= 55) return { tier:'MODERATE', label:'Moderate',         color:'#ffb347', icon:'⚡', description:'Specific deficiencies need attention.' };
  if (percentage >= 40) return { tier:'LOW',      label:'Recovery Needed',  color:'#ff9a3c', icon:'🛡️', description:'Your body needs recovery nutrition.' };
  return                       { tier:'CRITICAL', label:'Critical Care',    color:'#ff5e5e', icon:'🚨', description:'Medical nutrition focus required.' };
}

// ================================================================
// TIER-SPECIFIC PROMPT INJECTOR
// ================================================================
export function getTierPrompt(tier, percentage, profile, vitals, breakdown) {
  const topIssues = breakdown.filter(b=>b.score<60).slice(0,3)
    .map(b=>`${b.label} (${b.score}/100, weight:${b.weight})`).join(', ') || 'all parameters normal';

  const prompts = {
    PEAK:`
=================================================================
HEALTH SCORE: ${percentage}/100 — 🏆 PEAK PERFORMANCE MODE
=================================================================
All 10 physiological parameters are in optimal range.
NUTRITION STRATEGY: High-energy, nutrient-dense performance meals.
Emphasize complex carbs, lean protein, healthy fats. Low-Medium GI.
EXERCISE STRATEGY: HIGH intensity training is safe today.
TONE: Celebratory and motivating.`,

    GOOD:`
=================================================================
HEALTH SCORE: ${percentage}/100 — ✅ GOOD HEALTH MODE
=================================================================
Weak parameters: ${topIssues}
NUTRITION STRATEGY: Balanced meals targeting weak parameters.
Prioritize Low-Medium GI foods. Address micronutrient gaps.
EXERCISE STRATEGY: Moderate intensity is ideal.
TONE: Positive and encouraging.`,

    MODERATE:`
=================================================================
HEALTH SCORE: ${percentage}/100 — ⚡ MODERATE MODE
=================================================================
Needs attention: ${topIssues}
NUTRITION STRATEGY — TARGETED THERAPEUTIC:
${vitals.spo2<96      ?'- 🩸 IRON-RICH: spinach, lentils, dates':''}
${vitals.stress==='High'?'- 🧘 MAGNESIUM-RICH: nuts, seeds, leafy greens':''}
${vitals.hr>85        ?'- ⚡ ELECTROLYTES: coconut water, bananas':''}
${vitals.hrv<35       ?'- 🛡️ ANTI-INFLAMMATORY: turmeric, ginger, omega-3':''}
Prioritize LOW GI foods. Lighter, easily digestible meals.
EXERCISE STRATEGY: Light to moderate only.
TONE: Caring and supportive.`,

    LOW:`
=================================================================
HEALTH SCORE: ${percentage}/100 — 🛡️ RECOVERY MODE
=================================================================
Critical: ${topIssues}
NUTRITION STRATEGY: Anti-inflammatory recovery foods only.
STRICT LOW GI — NO high GI foods whatsoever.
Small, frequent, easily digestible meals.
NO fried, spicy, processed foods or caffeine.
EXERCISE STRATEGY: Rest or 10-min gentle walk only.
TONE: Gentle and nurturing.`,

    CRITICAL:`
=================================================================
HEALTH SCORE: ${percentage}/100 — 🚨 CRITICAL NUTRITION MODE
=================================================================
Critical: ${topIssues}
NUTRITION STRATEGY — MEDICAL NUTRITION THERAPY:
Strictly LOW GI therapeutic meals only.
Conditions (${profile?.diseases?.filter(d=>d!=='None').join(', ')||'none'}) respected absolutely.
Therapeutic foods: khichdi, steamed dal, curd rice, warm soups.
EXERCISE STRATEGY: NO exercise. Complete rest.
TONE: Serious but calm.`,
  };
  return prompts[tier] || prompts.MODERATE;
}