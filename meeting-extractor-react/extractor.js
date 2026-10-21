'use strict';
const SYSTEM = `You extract structure from messy meeting notes. Reply with ONLY JSON:
{"summary":str,"decisions":[{"text":str,"evidence":str}],"actions":[{"task":str,"owner":str|null,"dueText":str|null,"dueDate":"YYYY-MM-DD"|null,"priority":"high"|"medium"|"low"|null,"evidence":str}],"risks":[{"risk":str,"evidence":str,"mitigation":str|null}],"questions":[str],"dependencies":[str]}
Rules: NEVER invent owners, dates, decisions or facts. Use null when not stated. dueDate only if an explicit calendar date is in the notes. "decisions" only if clearly confirmed; evidence is a short quote from the notes. mitigation is your suggestion.`;
const STATUSES = ['todo', 'in-progress', 'done'];
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null);
const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : null);

function validate(raw, source) {
  if (!raw || typeof raw !== 'object') throw new Error('Model output is not an object');
  const arr = (a) => (Array.isArray(a) ? a : []);
  return {
    source, summary: str(raw.summary) || 'No summary available.',
    decisions: arr(raw.decisions).map((d) => ({ text: str(d.text), evidence: str(d.evidence) })).filter((d) => d.text),
    actions: arr(raw.actions).map((a, i) => ({
      id: i + 1, task: str(a.task), owner: str(a.owner), dueText: str(a.dueText), dueDate: iso(a.dueDate),
      priority: ['high', 'medium', 'low'].includes(a.priority) ? a.priority : null, status: 'todo', evidence: str(a.evidence),
    })).filter((a) => a.task),
    risks: arr(raw.risks).map((r) => ({ risk: str(r.risk), evidence: str(r.evidence), mitigation: str(r.mitigation) })).filter((r) => r.risk),
    questions: arr(raw.questions).map(str).filter(Boolean),
    dependencies: arr(raw.dependencies).map(str).filter(Boolean),
  };
}

function parseJson(text) {
  const m = String(text).replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in model reply');
  return JSON.parse(m[0]);
}

// Deterministic rule-based fallback. NOT AI: labelled source="rule-based" in output.
function ruleBased(notes) {
  const lines = notes.split(/\r?\n/).map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim()).filter(Boolean);
  const out = { summary: null, decisions: [], actions: [], risks: [], questions: [], dependencies: [] };
  const actRe = /^(?:action(?: item)?s?:?\s*)?([A-Z][a-zA-Z]+)\s+(?:will|to|needs to|should|is going to|owns|has to)\s+(.+)$/i;
  for (const l of lines) {
    const a = l.match(actRe);
    if (/\b(decided|agreed|approved|decision|go with|we'll go)\b/i.test(l)) out.decisions.push({ text: l, evidence: l });
    else if (/\?\s*$/.test(l) || /\b(tbd|unclear|open question|not sure)\b/i.test(l)) out.questions.push(l);
    else if (a && !/^(we|it|they|that|this|there|who|what|when|why|how)$/i.test(a[1])) {
      const due = l.match(/\b(?:by|before|due)\s+((?:\d{4}-\d{2}-\d{2})|eod|eow|end of (?:day|week|month)|(?:next\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})/i);
      out.actions.push({ task: a[2].replace(/[.;]$/, ''), owner: /^(someone|somebody|anyone|team|all|everyone)$/i.test(a[1]) ? null : a[1], dueText: due ? due[1] : null, dueDate: due && /^\d{4}-/.test(due[1]) ? due[1] : null,
        priority: /\b(urgent|asap|critical|blocker)\b/i.test(l) ? 'high' : null, evidence: l });
    } else if (/\b(decided|agreed|approved|decision|go with|we'll go)\b/i.test(l)) out.decisions.push({ text: l, evidence: l });
    else if (/\b(risk|blocker|blocked|worried|concern|might slip)\b/i.test(l)) out.risks.push({ risk: l, evidence: l, mitigation: null });
    else if (/\b(depends on|waiting on|dependent|blocked by)\b/i.test(l)) out.dependencies.push(l);
  }
  out.summary = `Rule-based extraction (no AI model used): ${out.actions.length} action(s), ${out.decisions.length} decision(s), ${out.risks.length} risk(s) found across ${lines.length} lines.`;
  return validate(out, 'rule-based');
}

// Anti-hallucination: drop owners/ISO dates the model produced that never appear in the notes.
function ground(r, notes) {
  const n = notes.toLowerCase();
  for (const a of r.actions) {
    if (a.owner && !n.includes(a.owner.toLowerCase())) a.owner = null;
    if (a.dueDate && !n.includes(a.dueDate)) a.dueDate = null;
  }
  return r;
}

async function aiExtract(notes, env = process.env, fetchFn = fetch) {
  const { AI_BASE_URL: base, AI_API_KEY: key, AI_MODEL: model } = env;
  if (!base || !key || !model) throw new Error('AI provider not configured');
  const res = await fetchFn(base.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: notes }] }),
  });
  if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
  const data = await res.json();
  return ground(validate(parseJson(data.choices?.[0]?.message?.content), 'ai'), notes);
}

async function extract(notes, env, fetchFn) {
  try { return { ...(await aiExtract(notes, env, fetchFn)), warning: null }; }
  catch (e) { return { ...ruleBased(notes), warning: `AI unavailable (${e.message}). Showing rule-based fallback, which is NOT AI inference.` }; }
}
module.exports = { ground, extract, ruleBased, validate, parseJson };
