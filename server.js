/**
 * VPS Indoor Navigation — Express Server
 * Serves static files + REST API for nav_graph CRUD
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GRAPH_FILE     = path.join(__dirname, 'nav_graph.json');
const BUILDINGS_FILE = path.join(__dirname, 'buildings.json');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    // Allow large PLY files to be served without timeout
    if (filePath.endsWith('.ply')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// ── API Routes ─────────────────────────────────────────

/** GET /api/graph — load navigation graph */
app.get('/api/graph', (req, res) => {
  try {
    const raw = fs.readFileSync(GRAPH_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch (e) {
    console.error('Read graph error:', e.message);
    res.status(500).json({ error: 'Không thể đọc dữ liệu đồ thị: ' + e.message });
  }
});

/** POST /api/graph — save navigation graph (full replace) */
app.post('/api/graph', (req, res) => {
  try {
    const data = req.body;

    // Basic validation
    if (!data || !data.nodes || !data.edges) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ: thiếu nodes hoặc edges' });
    }

    // Backup current file
    const backup = GRAPH_FILE + '.bak';
    if (fs.existsSync(GRAPH_FILE)) {
      fs.copyFileSync(GRAPH_FILE, backup);
    }

    // Write new data
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[${new Date().toLocaleTimeString()}] Graph saved — ${Object.keys(data.nodes).length} nodes, ${data.edges.length} edges`);
    res.json({ success: true });
  } catch (e) {
    console.error('Write graph error:', e.message);
    res.status(500).json({ error: 'Không thể lưu dữ liệu: ' + e.message });
  }
});

/** GET /api/buildings — load campus buildings */
app.get('/api/buildings', (req, res) => {
  try {
    if (!fs.existsSync(BUILDINGS_FILE)) return res.json({ buildings: [] });
    const raw = fs.readFileSync(BUILDINGS_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/buildings — save campus buildings */
app.post('/api/buildings', (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.buildings)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }
    fs.writeFileSync(BUILDINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[${new Date().toLocaleTimeString()}] Buildings saved — ${data.buildings.length} toà nhà`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const https = require('https');
const os = require('os');

// Read SSL certificates
let sslOptions = {};
try {
  sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
  };
} catch (e) {
  console.warn('⚠️  Không tìm thấy SSL certificates, server sẽ báo lỗi nếu trình duyệt yêu cầu bảo mật.');
}

// Get local IP Address
let localIP = 'localhost';
const interfaces = os.networkInterfaces();
for (let name of Object.keys(interfaces)) {
  for (let iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIP = iface.address;
    }
  }
}

// ── Start Server ────────────────────────────────────────
const server = https.createServer(sslOptions, app);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  🏢  VPS Outdoor Navigation System                  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  🌐  Local:    https://localhost:${PORT}                  ║`);
  console.log(`║  📱  Network:  https://${localIP}:${PORT}${' '.repeat(Math.max(0, 24 - localIP.length - PORT.toString().length))}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  ⚙️   Admin:    https://${localIP}:${PORT}/admin.html${' '.repeat(Math.max(0, 14 - localIP.length - PORT.toString().length))}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
});
