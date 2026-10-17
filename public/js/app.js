// Step 1 page: show profiles from the API and allow switching.
const select = document.getElementById('profileSelect');
const info = document.getElementById('profileInfo');
const rows = document.getElementById('siteRows');

async function getJSON(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

async function showActiveProfile() {
  const p = await getJSON('/api/profiles/active');
  info.textContent = `${p.festival.name} | ${p.festival.date} | ${p.festival.timings.start}-${p.festival.timings.end}`;
  rows.innerHTML = p.sites.map((s) => `
    <tr>
      <td>${s.name}</td>
      <td>${s.capacity}</td>
      <td>${s.slotMinutes} min</td>
      <td>${s.openingHours.open}-${s.openingHours.close}</td>
    </tr>`).join('');
}

async function init() {
  const health = await getJSON('/api/health');
  document.getElementById('modeBadge').textContent = health.mode;

  const profiles = await getJSON('/api/profiles');
  select.innerHTML = profiles.map((p) =>
    `<option value="${p.id}" ${p.active ? 'selected' : ''}>${p.name}</option>`).join('');

  await showActiveProfile();
}

select.addEventListener('change', async () => {
  await getJSON('/api/profiles/active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: select.value }),
  });
  await showActiveProfile();
});

init();
