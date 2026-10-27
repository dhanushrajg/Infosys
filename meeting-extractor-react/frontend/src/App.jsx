import { useState, useEffect } from 'react';
import './styles.css';

const SAMPLE = `Product sync - Oct 9 2026
Attendees: Priya, Ravi, Meera, Sam

- Decided to go with Postgres for the new reporting service.
- Priya will finalize the API spec by 2026-10-15.
- Ravi to fix the login timeout bug asap, before Friday.
- Meera needs to draft the launch email.
- Someone should update the onboarding docs.
Risk: vendor might slip delivery of the SSO module.
Waiting on legal approval for the data processing agreement.
Who owns the demo environment?
Sam will check cloud budget by end of week.`;
const LABEL = { todo: 'Not Started', 'in-progress': 'In Progress', done: 'Done' };
const NAV = ['Input', 'Summary', 'Action Items', 'Decisions', 'Risks', 'Questions', 'Export'];
const id = (s) => s.toLowerCase().replace(' ', '-');
const today = () => new Date().toISOString().slice(0, 10);

function save(name, type, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

function Stat({ n, label, tone }) { return <div className={'stat ' + tone}><b>{n}</b><span>{label}</span></div>; }
function List({ items, empty = 'None identified.', render = (x) => x }) {
  return <ul>{items.length ? items.map((x, i) => <li key={i}>{render(x)}</li>) : <li className="mut">{empty}</li>}</ul>;
}

function ActionTable({ actions, setActions }) {
  const set = (i, k, v) => setActions(actions.map((a, j) => (j === i ? { ...a, [k]: v || null } : a)));
  if (!actions.length) return <p className="mut">No action items found.</p>;
  return (
    <div className="wrap"><table><thead><tr><th>Task</th><th>Owner</th><th>Due Date</th><th>Priority</th><th>Status</th><th>Flags</th></tr></thead>
      <tbody>{actions.map((a, i) => {
        const f = [!a.owner && 'No owner', !a.dueDate && !a.dueText && 'No deadline', a.dueDate && a.dueDate < today() && a.status !== 'done' && 'OVERDUE'].filter(Boolean);
        return (<tr key={a.id}>
          <td><input aria-label="Task" value={a.task || ''} onChange={(e) => set(i, 'task', e.target.value)} />{a.evidence && <blockquote>{a.evidence}</blockquote>}</td>
          <td><input aria-label="Owner" className={a.owner ? '' : 'miss'} placeholder="Not specified" value={a.owner || ''} onChange={(e) => set(i, 'owner', e.target.value)} /></td>
          <td><input aria-label="Due date" type="date" className={a.dueDate ? '' : 'miss'} value={a.dueDate || ''} onChange={(e) => set(i, 'dueDate', e.target.value)} />{a.dueText && !a.dueDate && <div className="mut sm">Notes say: {a.dueText}</div>}</td>
          <td><select aria-label="Priority" value={a.priority || ''} onChange={(e) => set(i, 'priority', e.target.value)}><option value="">Not specified</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></td>
          <td><select aria-label="Status" className={'st ' + a.status} value={a.status} onChange={(e) => set(i, 'status', e.target.value)}>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          <td className={f.includes('OVERDUE') ? 'over' : 'mut'}>{f.join(' · ') || '—'}</td></tr>);
      })}</tbody></table></div>
  );
}

export default function App() {
  const [notes, setNotes] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [aiOn, setAiOn] = useState(false);
  useEffect(() => { fetch('/api/health').then((r) => r.json()).then((h) => setAiOn(h.aiConfigured)).catch(() => {}); }, []);

  async function run() {
    if (notes.trim().length < 20) return setErr('Please enter at least 20 characters of notes.');
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Request failed');
      setData(j);
      setTimeout(() => document.getElementById('summary')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) { setErr('Could not extract: ' + e.message); } finally { setBusy(false); }
  }
  const exportCsv = () => save('action-items.csv', 'text/csv', ['Task,Owner,Due,Priority,Status', ...data.actions.map((a) => [a.task, a.owner, a.dueDate || a.dueText, a.priority, LABEL[a.status]].map(csvCell).join(','))].join('\r\n'));

  return (
    <div className="app">
      <header><div><b>⧖ Xploits</b> <span>Smart Meeting Action Extractor</span></div>
        <span className={'badge ' + (aiOn ? 'live' : 'demo')} title={aiOn ? 'AI provider configured' : 'No AI credentials: rule-based fallback, not AI'}>{aiOn ? 'AI Connected' : 'Demo Mode'}</span></header>
      <nav aria-label="Sections">{NAV.map((n) => <a key={n} href={'#' + id(n)} onClick={(e) => { e.preventDefault(); document.getElementById(id(n))?.scrollIntoView({ behavior: 'smooth' }); }}>{n}</a>)}</nav>
      <main>
        <section id="input"><h2>1. Meeting Notes</h2>
          <textarea aria-label="Meeting notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste messy meeting notes here…" />
          <div className="row"><button className="p" disabled={busy} onClick={run}>{busy ? 'Extracting…' : 'Extract'}</button>
            <button onClick={() => setNotes(SAMPLE)}>Use sample notes</button>
            <button onClick={() => { setNotes(''); setData(null); setErr(''); }}>Clear</button><span className="mut">{notes.length} chars</span></div>
          {err && <div className="msg err" role="alert">{err}</div>}
          {data?.warning && <div className="msg warn" role="status">{data.warning}</div>}</section>
        {!data ? <p className="mut empty">No results yet. Use the sample notes and press Extract.</p> : <>
          <section id="summary"><h2>Meeting Summary <span className="tag">{data.source === 'ai' ? 'AI-generated' : 'Rule-based (not AI)'}</span></h2><p>{data.summary}</p>
            <div className="stats"><Stat n={data.decisions.length} label="Decisions" tone="g" /><Stat n={data.actions.length} label="Action Items" tone="r" /><Stat n={data.risks.length} label="Risks" tone="o" /></div></section>
          <section id="action-items"><h2>Action Items</h2><ActionTable actions={data.actions} setActions={(actions) => setData({ ...data, actions })} />
            <p className="mut sm">Highlighted fields were not stated in the notes. Nothing is guessed.</p></section>
          <div className="grid">
            <section id="decisions"><h2>Decisions (confirmed)</h2><List items={data.decisions} render={(d) => d.text} /></section>
            <section id="risks"><h2>Risks / Blockers</h2><List items={data.risks} render={(r) => <>{r.risk}{r.evidence && <blockquote>Evidence: {r.evidence}</blockquote>}<blockquote>Suggested mitigation: {r.mitigation || 'none proposed'}</blockquote></>} /></section></div>
          <div className="grid"><section id="questions"><h2>Unresolved Questions</h2><List items={data.questions} /></section>
            <section><h2>Dependencies</h2><List items={data.dependencies} /></section></div>
          <section id="export"><h2>Export</h2><div className="row">
            <button className="b" onClick={exportCsv}>Export CSV</button>
            <button className="g" onClick={() => save('meeting-report.json', 'application/json', JSON.stringify(data, null, 2))}>Download JSON</button>
            <button className="v" onClick={() => window.print()}>Print Report</button></div></section></>}
      </main>
    </div>
  );
}
