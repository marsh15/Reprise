// Source of truth for docs/diagrams/reprise-architecture.excalidraw.
// A plain-data Excalidraw "skeleton": build.mjs turns it into native, editable Excalidraw elements
// (rectangles with bound labels, grouped body text, bound arrows) and exports SVG and PNG from them.
// Every box names the real file or behaviour it stands for.

const INK = '#1b231f', SECONDARY = '#46514b', MUTED = '#56605a', BORDER = '#7e847b', ZONE_LINE = '#cfcdc2';
const GREEN = '#22695a', GREEN_FILL = '#e4ede8';
const PLUM = '#7a3e72', PLUM_FILL = '#f3e8f1';
const BLUE = '#3a6ea5', BLUE_FILL = '#e5ecf4';
const WHITE = '#ffffff', ZONE_FILL = '#efeee8';
const FONT = 2; // Helvetica: a system face, so the SVG needs no embedded font

const styles = {
  neutral: { stroke: BORDER, fill: WHITE },
  green: { stroke: GREEN, fill: GREEN_FILL },
  plum: { stroke: PLUM, fill: PLUM_FILL },
  blue: { stroke: BLUE, fill: BLUE_FILL },
};

const out = [];
const text = (id, x, y, value, size = 15, color = SECONDARY) =>
  out.push({ type: 'text', id, x, y, text: value, fontSize: size, fontFamily: FONT, strokeColor: color, textAlign: 'left', verticalAlign: 'top' });

function zone(id, x, y, w, h, { stroke = ZONE_LINE, dashed = false, fill = ZONE_FILL, width = 1 } = {}) {
  out.push({ type: 'rectangle', id, x, y, width: w, height: h, backgroundColor: fill, strokeColor: stroke, strokeWidth: width,
    strokeStyle: dashed ? 'dashed' : 'solid', fillStyle: 'solid', roughness: 0, roundness: { type: 3, value: 14 } });
}
// A box with an editable bound title and a separate body text; build.mjs groups the three.
function box(id, x, y, w, h, title, body, kind = 'neutral', { size = 19, strokeStyle = 'solid', bodyLines = null } = {}) {
  const s = styles[kind];
  out.push({ type: 'rectangle', id, x, y, width: w, height: h, backgroundColor: s.fill, strokeColor: s.stroke, strokeWidth: kind === 'neutral' ? 1.5 : 2,
    strokeStyle, fillStyle: 'solid', roughness: 0, roundness: { type: 3, value: 10 },
    });
  text(`${id}-title`, x + 14, y + 9, title, size, INK);
  if (body) text(`${id}-body`, x + 14, y + (bodyLines ?? 40), body, 15, SECONDARY);
}
function arrow(id, from, to, points, { double = false, color = INK, dashed = false } = {}) {
  const [x, y] = points[0];
  out.push({ type: 'arrow', id, x, y, points: points.map(([px, py]) => [px - x, py - y]), start: { id: from }, end: { id: to },
    strokeColor: color, strokeWidth: 2, roughness: 0, strokeStyle: dashed ? 'dashed' : 'solid',
    endArrowhead: 'arrow', startArrowhead: double ? 'arrow' : null });
}

// ───────────────────────────── header
text('title', 30, 20, 'Reprise: architecture as implemented', 30, INK);
text('subtitle', 30, 62, 'A local-first research chat. One Node process, local SQLite recall, one model-visible tool.', 17, SECONDARY);
// legend
out.push({ type: 'ellipse', id: 'lg-plum', x: 905, y: 27, width: 16, height: 16, strokeColor: PLUM, backgroundColor: PLUM_FILL, fillStyle: 'solid', strokeWidth: 2, roughness: 0 });
text('lg-plum-t', 929, 25, 'Local memory (from earlier)', 15, SECONDARY);
out.push({ type: 'ellipse', id: 'lg-blue', x: 1165, y: 27, width: 16, height: 16, strokeColor: BLUE, backgroundColor: BLUE, fillStyle: 'solid', strokeWidth: 2, roughness: 0 });
text('lg-blue-t', 1189, 25, 'Fresh research (searched now)', 15, SECONDARY);
out.push({ type: 'rectangle', id: 'lg-green', x: 1445, y: 27, width: 16, height: 16, strokeColor: GREEN, backgroundColor: GREEN_FILL, fillStyle: 'solid', strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 4 } });
text('lg-green-t', 1469, 25, 'Deterministic code, no model', 15, SECONDARY);

// ───────────────────────────── zones
text('zl-browser', 30, 88, 'Browser · React 19 client', 16, MUTED);
zone('z-browser', 30, 112, 220, 590);
text('zl-local', 390, 88, 'Local Node process · binds 127.0.0.1', 16, MUTED);
zone('z-local', 390, 112, 905, 590, { stroke: GREEN, width: 2, fill: '#f1f0ea' });
text('zl-db', 1375, 88, 'Local SQLite file · node:sqlite', 16, MUTED);
zone('z-db', 1375, 112, 240, 590);
zone('z-ext', 410, 742, 415, 170, { stroke: BORDER, dashed: true, fill: '#f7f6f2', width: 1.5 });
text('zl-ext', 424, 884, 'Leaves this machine (HTTPS)', 15, MUTED);

// ───────────────────────────── browser
box('b-reader', 45, 145, 190, 62, 'Stream reader', 'fetch + SSE parser', 'neutral', { size: 17, bodyLines: 34 });
box('b-thread', 45, 227, 190, 130, 'Reading thread', 'dateline margin\nrecall chips\nresearch status\ncitation cards', 'neutral', { size: 17, bodyLines: 34 });
box('b-composer', 45, 377, 190, 92, 'Composer', 'Send · Stop (Esc)\nRetry saved message', 'neutral', { size: 17, bodyLines: 34 });
box('b-sidebar', 45, 489, 190, 78, 'Conversation list', 'history · switch · delete', 'neutral', { size: 17, bodyLines: 34 });
text('b-note', 45, 590, 'An unacknowledged\nrequest is kept in\nsessionStorage for\nrecovery.', 15, MUTED);

// ───────────────────────────── local process: request path (row A)
box('a-admit', 410, 200, 190, 130, 'Request admission', 'requestPolicy.ts\nHost, Origin, Fetch\nMetadata; JSON bodies\nBefore Hono and Vite', 'green');
box('a-hono', 635, 200, 190, 130, 'Hono API', 'app.ts\n/api/* routes\nPOST /api/turns\nstreams SSE back', 'neutral');
box('a-turn', 860, 200, 190, 130, 'Turn service', 'turns/service.ts\nidempotent request id\none turn per chat\nStop → interrupted', 'neutral');
box('a-recall', 1085, 200, 190, 130, 'Dates + recall', 'time/resolve.ts\nmemory/recall.ts\ndate index + FTS5\nbounded packet', 'plum');
arrow('e-admit-hono', 'a-admit', 'a-hono', [[600, 265], [635, 265]]);
arrow('e-hono-turn', 'a-hono', 'a-turn', [[825, 265], [860, 265]]);
arrow('e-turn-recall', 'a-turn', 'a-recall', [[1050, 265], [1085, 265]]);

// ───────────────────────────── local process: agent path (row B)
zone('a-agent', 410, 430, 415, 185, { stroke: BORDER, fill: WHITE, width: 1.5 });
text('a-agent-t', 424, 440, 'Agent loop', 19, INK);
text('a-agent-s', 424, 466, 'agent/runTurn.ts · ≤3 rounds · ≤10 searches', 14, SECONDARY);
box('a-model', 422, 492, 160, 110, 'One chat model', 'OpenAI-compatible\nChat Completions\nstreams answer', 'neutral', { size: 17, bodyLines: 34 });
box('a-tool', 652, 492, 160, 110, 'web_search', 'the only tool the\nmodel can see\nfreshness filter', 'blue', { size: 17, bodyLines: 34 });
box('a-registry', 860, 470, 190, 150, 'Source registry', 'one observation =\nown marker, UUID,\npublished and\nretrieved time', 'neutral', { size: 19 });
box('a-cite', 1085, 470, 190, 150, 'Citation check', 'citations.ts\nmarkers + numbers\nfound in the excerpt\nnot semantic truth', 'green');
arrow('e-recall-agent', 'a-recall', 'a-agent', [[1180, 330], [1180, 380], [617, 380], [617, 430]]);
text('e-recall-agent-t', 640, 352, 'recall packet: dates, past turns, sources', 15, MUTED);
arrow('e-model-tool', 'a-model', 'a-tool', [[582, 547], [652, 547]], { double: true });
arrow('e-tool-registry', 'a-tool', 'a-registry', [[812, 547], [860, 547]]);
arrow('e-registry-cite', 'a-registry', 'a-cite', [[1050, 545], [1085, 545]]);

// ───────────────────────────── browser ↔ server
arrow('e-composer-admit', 'b-composer', 'a-admit', [[235, 423], [322, 423], [322, 265], [410, 265]]);
arrow('e-hono-reader', 'a-hono', 'b-reader', [[730, 200], [730, 176], [235, 176]]);
text('e-hono-reader-t', 410, 124, 'SSE events as the turn runs:\nrecall · search.* · answer.delta\ncitations · turn.completed', 15, MUTED);

// ───────────────────────────── SQLite
box('d-messages', 1390, 130, 210, 62, 'messages', 'raw turns · local date', 'plum', { size: 17, bodyLines: 34 });
box('d-fts', 1390, 234, 210, 62, 'messages_fts (FTS5)', 'keyword recall', 'plum', { size: 17, bodyLines: 34 });
text('d-note', 1390, 322, 'Past conversations are\nrecalled by local date and\nkeywords. There is no\nembedding service.', 15, SECONDARY);
box('d-ledger', 1390, 482, 210, 128, 'Evidence ledger', 'searches\nsources: url, excerpt,\npublished + retrieved\ncitations: check state', 'neutral', { size: 17, bodyLines: 34 });
text('d-ledger-t', 1390, 620, 'Answer and evidence are\ncommitted in one transaction.', 15, MUTED);
arrow('e-turn-messages', 'a-turn', 'd-messages', [[955, 200], [955, 161], [1390, 161]]);
text('e-turn-messages-t', 965, 136, 'user message saved first', 15, MUTED);
arrow('e-recall-fts', 'a-recall', 'd-fts', [[1275, 265], [1390, 265]], { double: true });
arrow('e-cite-ledger', 'a-cite', 'd-ledger', [[1275, 545], [1390, 545]]);

// ───────────────────────────── externals
box('x-llm', 422, 772, 160, 84, 'LLM endpoint', 'OpenAI-compatible\nbase URL in config', 'neutral', { size: 17, bodyLines: 34 });
box('x-tavily', 652, 772, 160, 84, 'Tavily Search', 'api.tavily.com\nsearch results', 'blue', { size: 17, bodyLines: 34 });
arrow('e-model-llm', 'a-model', 'x-llm', [[502, 602], [502, 772]], { double: true });
arrow('e-tool-tavily', 'a-tool', 'x-tavily', [[732, 602], [732, 772]], { double: true });
text('x-note', 850, 770, 'What leaves this machine: recent messages, bounded\nrecalled context and source excerpts go to the configured\nLLM; search queries go to Tavily. Everything else stays\nin the local SQLite file.', 15, SECONDARY);

// ───────────────────────────── annotations
text('n-check', 850, 868, 'The citation check is mechanical and bounded: it\nlooks for markers, numbers and dates in the cited\nexcerpt. It does not prove that a source\nsupports a claim.', 15, SECONDARY);
text('n-security', 850, 640, 'Request admission is browser-origin protection only. It\ndoes not authenticate local processes or other OS users.\nNon-API requests go to Vite (dev) or dist/ (production).', 14, MUTED);

export default out.filter(e => !(e.type === 'text' && e.text === ''));
export const groups = ['b-reader', 'b-thread', 'b-composer', 'b-sidebar', 'a-admit', 'a-hono', 'a-turn', 'a-recall', 'a-model', 'a-tool', 'a-registry', 'a-cite',
  'd-messages', 'd-fts', 'd-ledger', 'x-llm', 'x-tavily'];
