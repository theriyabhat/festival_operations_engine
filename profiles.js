// REST endpoints for festival profiles.
const express = require('express');
const loader = require('../engine/profileLoader');

const router = express.Router();

// GET /api/profiles -> short list of all loaded profiles
router.get('/', (req, res) => res.json(loader.listProfiles()));

// GET /api/profiles/active -> full active profile
router.get('/active', (req, res) => {
  const p = loader.getActiveProfile();
  if (!p) return res.status(404).json({ error: 'No active profile' });
  res.json(p);
});

// POST /api/profiles/active  body: { "id": "ganesh-visarjan" } -> switch profile
router.post('/active', (req, res) => {
  const id = req.body && req.body.id;
  if (!loader.setActive(id)) return res.status(404).json({ error: `Unknown profile "${id}"` });
  res.json({ active: id });
});

// POST /api/profiles?activate=true  body: a full profile JSON -> add at runtime
router.post('/', (req, res) => {
  try {
    const p = loader.addProfile(req.body, { activate: req.query.activate === 'true' });
    res.status(201).json({ added: p.id, active: loader.getActiveProfile().id });
  } catch (err) {
    if (err instanceof loader.ProfileError) {
      return res.status(400).json({ error: err.message, details: err.errors });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/profiles/:id -> one full profile
router.get('/:id', (req, res) => {
  const p = loader.getProfile(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

module.exports = router;
