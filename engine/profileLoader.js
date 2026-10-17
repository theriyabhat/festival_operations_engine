// Loads, validates and stores festival profiles.
// Profiles live in memory (a Map), so new ones can be added at runtime
// without restarting the server.
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '..', 'config', 'profiles');
const registry = new Map(); // id -> profile object
let activeId = null;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// Returns an array of error strings. Empty array = valid profile.
function validateProfile(p) {
  const errors = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    return ['Profile must be a JSON object'];
  }

  if (!isStr(p.id) || !/^[a-z0-9-]+$/.test(p.id)) {
    errors.push('id must be lowercase letters, digits or dashes');
  }

  // Festival basics
  if (!p.festival || !isStr(p.festival.name)) errors.push('festival.name is required');
  if (!p.festival || !/^\d{4}-\d{2}-\d{2}$/.test(p.festival.date || '')) {
    errors.push('festival.date must look like YYYY-MM-DD');
  }
  const t = p.festival && p.festival.timings;
  if (!t || !isTime(t.start) || !isTime(t.end)) {
    errors.push('festival.timings.start and .end must be HH:MM');
  }

  // Sites (5-8)
  const siteIds = new Set();
  if (!Array.isArray(p.sites) || p.sites.length < 5 || p.sites.length > 8) {
    errors.push('sites must be an array of 5 to 8 sites');
  } else {
    p.sites.forEach((s, i) => {
      const label = `sites[${i}]`;
      if (!isStr(s.id)) errors.push(`${label}.id is required`);
      else if (siteIds.has(s.id)) errors.push(`${label}.id "${s.id}" is duplicated`);
      else siteIds.add(s.id);
      if (!isStr(s.name)) errors.push(`${label}.name is required`);
      if (!isNum(s.lat) || s.lat < -90 || s.lat > 90) errors.push(`${label}.lat must be a valid latitude`);
      if (!isNum(s.lng) || s.lng < -180 || s.lng > 180) errors.push(`${label}.lng must be a valid longitude`);
      if (!isNum(s.capacity) || s.capacity <= 0) errors.push(`${label}.capacity must be > 0`);
      if (!isNum(s.slotMinutes) || s.slotMinutes <= 0) errors.push(`${label}.slotMinutes must be > 0`);
      if (!isNum(s.entryBaseline) || s.entryBaseline < 0) errors.push(`${label}.entryBaseline must be >= 0`);
      if (!isNum(s.exitBaseline) || s.exitBaseline < 0) errors.push(`${label}.exitBaseline must be >= 0`);
      if (!Array.isArray(s.facilities)) errors.push(`${label}.facilities must be an array`);
      if (!s.openingHours || !isTime(s.openingHours.open) || !isTime(s.openingHours.close)) {
        errors.push(`${label}.openingHours.open/close must be HH:MM`);
      }
    });
  }

  // Crowd thresholds (fractions of capacity)
  const th = p.thresholds;
  if (!th || !isNum(th.amber) || !isNum(th.red) || !(th.amber > 0 && th.amber < th.red)) {
    errors.push('thresholds.amber and thresholds.red are required, with 0 < amber < red');
  }

  // Bins
  if (!Array.isArray(p.bins) || p.bins.length === 0) {
    errors.push('bins must be a non-empty array');
  } else {
    p.bins.forEach((b, i) => {
      if (!siteIds.has(b.siteId)) errors.push(`bins[${i}].siteId "${b.siteId}" is not a known site`);
      if (!isNum(b.count) || b.count < 0) errors.push(`bins[${i}].count must be >= 0`);
      if (!isNum(b.capacityLitres) || b.capacityLitres <= 0) errors.push(`bins[${i}].capacityLitres must be > 0`);
    });
  }

  // Waste types
  if (!Array.isArray(p.wasteTypes) || p.wasteTypes.length === 0) {
    errors.push('wasteTypes must be a non-empty array');
  } else {
    p.wasteTypes.forEach((w, i) => {
      if (!isStr(w.id)) errors.push(`wasteTypes[${i}].id is required`);
      if (!isNum(w.kgPerPerson) || w.kgPerPerson < 0) errors.push(`wasteTypes[${i}].kgPerPerson must be >= 0`);
      if (!isNum(w.litresPerKg) || w.litresPerKg <= 0) errors.push(`wasteTypes[${i}].litresPerKg must be > 0`);
    });
  }

  // Festival rules
  const r = p.rules;
  if (!r || !isNum(r.maxGroupSize) || r.maxGroupSize <= 0) {
    errors.push('rules.maxGroupSize must be > 0');
  }
  if (!r || !Array.isArray(r.visitOrder)) {
    errors.push('rules.visitOrder must be an array of site ids');
  } else {
    r.visitOrder.forEach((id) => {
      if (!siteIds.has(id)) errors.push(`rules.visitOrder has unknown site "${id}"`);
    });
  }

  // Adjacency links
  if (!Array.isArray(p.adjacency)) {
    errors.push('adjacency must be an array');
  } else {
    p.adjacency.forEach((a, i) => {
      if (!siteIds.has(a.from)) errors.push(`adjacency[${i}].from "${a.from}" is not a known site`);
      if (!siteIds.has(a.to)) errors.push(`adjacency[${i}].to "${a.to}" is not a known site`);
    });
  }

  return errors;
}

class ProfileError extends Error {
  constructor(errors) {
    super('Invalid profile');
    this.errors = errors;
  }
}

// Validate and store a profile (used at startup AND for runtime upload).
function addProfile(profile, { activate = false } = {}) {
  const errors = validateProfile(profile);
  if (errors.length) throw new ProfileError(errors);
  registry.set(profile.id, profile);
  if (activate || !activeId) activeId = profile.id;
  return profile;
}

// Read every .json file in /config/profiles. A bad file is reported, not fatal.
function loadProfilesFromDisk() {
  const problems = [];
  if (!fs.existsSync(PROFILE_DIR)) return problems;
  for (const file of fs.readdirSync(PROFILE_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PROFILE_DIR, file), 'utf8'));
      addProfile(raw);
    } catch (err) {
      problems.push({ file, errors: err.errors || [err.message] });
    }
  }
  return problems;
}

function listProfiles() {
  return [...registry.values()].map((p) => ({
    id: p.id,
    name: p.festival.name,
    date: p.festival.date,
    sites: p.sites.length,
    active: p.id === activeId,
  }));
}

const getProfile = (id) => registry.get(id) || null;
const getActiveProfile = () => (activeId ? registry.get(activeId) : null);

function setActive(id) {
  if (!registry.has(id)) return false;
  activeId = id;
  return true;
}

// Test helper: wipe everything.
function _reset() {
  registry.clear();
  activeId = null;
}

module.exports = {
  validateProfile, addProfile, loadProfilesFromDisk, listProfiles,
  getProfile, getActiveProfile, setActive, ProfileError, _reset,
};
