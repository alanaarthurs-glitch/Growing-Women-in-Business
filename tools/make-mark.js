// Nested spiral of triangles: each level's vertices sit on the parent's sides at
// fraction t, so every triangle is inside the last and the whole thing whirls
// inward. Outer triangle upright. One line weight. Optional solid core.
const fs = require('fs');
function next(p, t) { return [0, 1, 2].map(i => { const a = p[i], b = p[(i + 1) % 3]; return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; }); }
function build(o) {
  const { n, t, sw, core, alt, gapSw } = o;
  const r = 46, cx = 50, cy = 56;
  let p = [0, 1, 2].map(i => { const a = (-90 + i * 120) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  let body = '';
  for (let k = 0; k < n; k++) {
    const pts = p.map(q => q.map(v => v.toFixed(2)).join(',')).join(' ');
    if (alt) {
      // alternate solid bands: even levels navy, odd levels cream; gives a flat, bold rose
      const fill = k % 2 === 0 ? 'currentColor' : '#FDF9F1';
      body += `<polygon points="${pts}" fill="${fill}" stroke="none"/>`;
    } else if (core && k === n - 1) {
      body += `<polygon points="${pts}" fill="currentColor" stroke="none"/>`;
    } else {
      body += `<polygon points="${pts}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linejoin="round"/>`;
    }
    p = next(p, t);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
}
const V = {
  h1: { n: 8, t: 0.10, sw: 3.2, core: false },
  h2: { n: 7, t: 0.14, sw: 3.4, core: true },
  h3: { n: 6, t: 0.18, sw: 3.8, core: true },
  h4: { n: 10, t: 0.12, sw: 2.8, core: true },
  h5: { n: 8, t: 0.14, alt: true },
  h6: { n: 6, t: 0.20, alt: true },
};
for (const [k, o] of Object.entries(V)) fs.writeFileSync(k + '.svg', build(o));
fs.writeFileSync('variants.json', JSON.stringify(Object.keys(V)));
console.log('ok');
