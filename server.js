// Festival Operations Engine - server entry point.
const express = require('express');
const path = require('path');
const loader = require('./engine/profileLoader');
const profileRoutes = require('./routes/profiles');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check (also useful for Render)
app.get('/api/health', (req, res) => {
  const active = loader.getActiveProfile();
  res.json({ status: 'ok', mode: 'Simulated', activeProfile: active ? active.id : null });
});

app.use('/api/profiles', profileRoutes);

// Load profiles at startup
const problems = loader.loadProfilesFromDisk();
problems.forEach((p) => console.warn(`Skipped ${p.file}:`, p.errors));

// Only start listening when run directly (tests import the app instead)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Festival Operations Engine on http://localhost:${PORT}`));
}

module.exports = app;
