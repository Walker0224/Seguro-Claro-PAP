process.env.TZ = 'Europe/Lisbon';
// server.js — Servidor principal SeguroClaro
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');
const app      = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

app.use('/api/track',      require('./routes/track'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/comparacao', require('./routes/comparacao'));
app.use('/api/config',     require('./routes/config'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'site', 'dashboard.html'));
});

const PORTA = process.env.PORT || 3001;
app.listen(PORTA, () => {
  console.log(`SeguroClaro Server a correr em http://localhost:${PORTA}`);
});
