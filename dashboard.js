'use strict';

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const colors = ['#ac4b24', '#e09336', '#75412d'];
const categories = {
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  product: ['Laptop', 'Phone'],
  gender: ['Female', 'Male'],
  region: ['Kigali', 'Musanze'],
  payment: ['Cash', 'Credit Card', 'Mobile Money']
};
const columns = { month: 0, product: 1, gender: 2, region: 3, payment: 4 };
const filters = { region: 'Region', gender: 'Gender', payment: 'Payment method' };
const form = document.querySelector('#filters');

for (const [field, label] of Object.entries(filters)) {
  const group = document.createElement('fieldset');
  group.innerHTML = '<legend>' + label + '</legend>' + categories[field].map(value =>
    '<label><input type="checkbox" name="' + field + '" value="' + value + '" checked>' + value + '</label>'
  ).join('');
  form.append(group);
}

function series(rows, field, measure) {
  return categories[field].map((label, i) => {
    const key = field === 'month' ? '2025-0' + (i + 1) : label;
    return [label, rows.reduce((sum, row) => sum + (row[columns[field]] === key ? row[measure] : 0), 0)];
  });
}

function svg(viewBox, label, content) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" role="img" aria-label="' + label + '">' + content + '</svg>';
}

function cartesian(id, data, line, hasAmounts) {
  const el = document.getElementById(id);
  if (!hasAmounts) {
    el.innerHTML = '<p class="empty">No reported sales for these filters.</p>';
    return;
  }
  const width = line ? 600 : 310;
  const left = 40, top = 24, bottom = 152, right = width - (line ? 32 : 12);
  const maximum = Math.max(1, ...data.map(([, value]) => value / 100));
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = [1, 2, 2.5, 5, 10].map(n => n * magnitude).find(n => n * 4 >= maximum);
  const scale = value => bottom - (bottom - top) * value / (4 * step);
  const points = data.map(([label, cents], i) => ({
    label, value: cents / 100,
    x: line ? left + 27 + (right - left - 54) * i / (data.length - 1) : left + (right - left) * (i + .5) / data.length
  }));
  const lines = Array.from({ length: 5 }, (_, i) => {
    const y = scale(step * i);
    return '<path d="M' + left + ' ' + y + 'H' + right + '" stroke="#e9ded1"/><text x="' + (left - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + compact.format(step * i) + '</text>';
  }).join('');
  const path = line ? '<polyline fill="none" stroke="#ad4d24" stroke-width="3" points="' +
    points.map(p => p.x + ',' + scale(p.value)).join(' ') + '"/>' : '';
  const marks = points.map(({label, value, x}) => {
    const y = scale(value);
    const title = '<title>' + label + ' · ' + money.format(value) + '</title>';
    const mark = line ? '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#ad4d24">' + title + '</circle>' :
      '<rect x="' + (x - 24) + '" y="' + y + '" width="48" height="' + (bottom - y) + '" rx="3" fill="#c6662d">' + title + '</rect>';
    return mark + '<text x="' + x + '" y="' + (y - 9) + '" text-anchor="middle">' + money.format(value) +
      '</text><text x="' + x + '" y="174" text-anchor="middle">' + label + '</text>';
  }).join('');
  el.innerHTML = svg('0 0 ' + width + ' 183', points.map(p => p.label + ' ' + money.format(p.value)).join(', '), lines + path + marks);
}

function donut(id, data, total) {
  const el = document.getElementById(id);
  if (!total) {
    el.innerHTML = '<p class="empty">No matching transactions.</p>';
    return;
  }
  const isPie = id === 'gender';
  const radius = isPie ? 24 : 43;
  const thickness = isPie ? 48 : 17;
  const percentages = [];
  let offset = 0;
  const slices = data.map(([label, count], i) => {
    const share = count / total * 100;
    if (count) {
      const angle = (offset + share / 2) * Math.PI / 50 - Math.PI / 2;
      const labelRadius = isPie ? 28 : 43;
      const x = 58 + labelRadius * Math.cos(angle);
      const y = 58 + labelRadius * Math.sin(angle);
      const text = share < 1 ? '<1%' : Math.round(share) + '%';
      percentages.push('<g aria-hidden="true"><rect x="' + (x - 15) + '" y="' + (y - 8) +
        '" width="30" height="16" rx="3" fill="#fffdf9"/><text x="' + x + '" y="' + (y + 3.5) +
        '" text-anchor="middle" class="slice-label">' + text.replace('<', '&lt;') + '</text></g>');
    }
    const mark = count ? '<circle cx="58" cy="58" r="' + radius + '" pathLength="100" fill="none" stroke-width="' + thickness + '" stroke="' +
      colors[i] + '" stroke-dasharray="' + share + ' ' + (100 - share) + '" stroke-dashoffset="' + (-offset) +
      '" transform="rotate(-90 58 58)"><title>' + label + ' · ' + count + '</title></circle>' : '';
    offset += share;
    return mark;
  }).join('');
  const legend = data.map(([label, count], i) =>
    '<li><span class="swatch" style="background:' + colors[i] + '"></span><span title="' +
    count + ' transaction rows">' + label + '</span></li>'
  ).join('');
  const description = data.map(([label, count]) => label + ' ' + (count / total * 100).toFixed(1) + '%, ' + count + ' rows');
  el.innerHTML = '<div class="donut-wrap">' + svg('0 0 116 116', description.join('; '),
    slices + percentages.join('')) + '<ul class="legend">' + legend + '</ul></div>';
}

function render() {
  const selection = new FormData(form);
  const active = Object.keys(filters).map(field => [columns[field], new Set(selection.getAll(field))]);
  const rows = salesData.filter(row => active.every(([column, values]) => values.has(row[column])));
  const total = rows.reduce((sum, row) => sum + row[5], 0);
  const reported = rows.reduce((sum, row) => sum + row[6], 0);
  const sales = rows.reduce((sum, row) => sum + row[7], 0);
  document.querySelector('#total').textContent = reported ? money.format(sales / 100) : '—';
  document.querySelector('#coverage').textContent = total ? reported + ' of ' + total + ' rows report sales' : 'No matching transactions';
  cartesian('region', series(rows, 'region', 7), false, reported);
  cartesian('product', series(rows, 'product', 7), false, reported);
  cartesian('trend', series(rows, 'month', 7), true, reported);
  donut('payment', series(rows, 'payment', 5), total);
  donut('gender', series(rows, 'gender', 5), total);
}

form.addEventListener('change', render);
document.querySelector('#reset').addEventListener('click', () => { form.reset(); render(); });
render();
