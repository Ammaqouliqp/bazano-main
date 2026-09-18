// Bazano First Version — Backend
try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bazano_secret_change_in_production';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'noreply@baza-no.ir';

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(path.join(dataDir, 'database.db'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    firstname TEXT,
    lastname TEXT,
    phone TEXT,
    role TEXT DEFAULT 'user',
    avatar TEXT,
    profile_complete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS needs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'open',
    assigned_provider_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    category TEXT,
    type TEXT DEFAULT 'service',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    need_id INTEGER,
    user_id INTEGER NOT NULL,
    provider_id INTEGER,
    admin_id INTEGER,
    title TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('DB ready');
});

const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createMailer() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendOTPEmail(toEmail, code) {
  const transporter = createMailer();
  if (!transporter) throw new Error('SMTP تنظیم نشده است.');
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: toEmail,
    subject: 'کد ورود بازانو',
    text: 'کد ورود شما: ' + code,
    html: '<div style="font-family:Tahoma;direction:rtl;padding:20px"><h2 style="color:#6a7964">بازانو</h2><p>کد: <b style="font-size:24px">' + code + '</b></p></div>'
  });
}

function signToken(user) {
  return jwt.sign({
    id: user.id, email: user.email, role: user.role,
    profile_complete: !!user.profile_complete
  }, JWT_SECRET, { expiresIn: '7d' });
}

function signPending(email) {
  return jwt.sign({ email: email, pending: true }, JWT_SECRET, { expiresIn: '30m' });
}

const authenticate = (req, res, next) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'توکن لازم است' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (e) { return res.status(401).json({ error: 'توکن نامعتبر' }); }
};

const requireComplete = (req, res, next) => {
  if (req.user.pending) return res.status(403).json({ error: 'تکمیل پروفایل لازم است', code: 'PROFILE_REQUIRED' });
  next();
};

const requireRole = function() {
  const roles = Array.prototype.slice.call(arguments);
  return function(req, res, next) {
    if (roles.indexOf(req.user.role) === -1) return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    next();
  };
};

app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '1.0', time: new Date().toISOString() });
});

app.post('/api/auth/send-otp', async (req, res) => {
  const email = req.body.email;
  if (!email || String(email).indexOf('@') === -1) return res.status(400).json({ error: 'ایمیل معتبر وارد کنید' });
  const normalized = String(email).trim().toLowerCase();
  const code = generateOTP();
  otpStore[normalized] = { code: code, expires: Date.now() + 5 * 60 * 1000 };
  try {
    await sendOTPEmail(normalized, code);
    res.json({ message: 'کد به ایمیل شما ارسال شد' });
  } catch (err) {
    console.error('OTP error:', err.message);
    if (!SMTP_HOST || !SMTP_USER) {
      console.log('DEV OTP for ' + normalized + ': ' + code);
      return res.json({ message: 'کد ارسال شد (توسعه)', devCode: code });
    }
    res.status(500).json({ error: err.message.indexOf('SMTP') !== -1 ? err.message : 'خطا در ارسال ایمیل' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const email = req.body.email, code = req.body.code;
  if (!email || !code) return res.status(400).json({ error: 'ایمیل و کد لازم است' });
  const normalized = String(email).trim().toLowerCase();
  const stored = otpStore[normalized];
  if (!stored || stored.code !== String(code).trim() || Date.now() > stored.expires) {
    return res.status(400).json({ error: 'کد اشتباه یا منقضی شده' });
  }
  delete otpStore[normalized];

  db.get('SELECT * FROM users WHERE email = ?', [normalized], (err, user) => {
    if (err) return res.status(500).json({ error: 'خطا در سرور' });
    if (user && user.profile_complete) {
      return res.json({
        token: signToken(user),
        action: 'login',
        user: { id: user.id, email: user.email, firstname: user.firstname, lastname: user.lastname, phone: user.phone, role: user.role, profile_complete: true }
      });
    }
    res.json({ token: signPending(normalized), action: 'complete_profile', email: normalized });
  });
});

app.post('/api/auth/complete-profile', authenticate, (req, res) => {
  if (!req.user.pending && req.user.profile_complete) {
    return res.status(400).json({ error: 'پروفایل قبلاً تکمیل شده' });
  }
  const firstname = req.body.firstname, lastname = req.body.lastname, phone = req.body.phone;
  if (!firstname || !lastname || !phone) return res.status(400).json({ error: 'نام، نام خانوادگی و تلفن لازم است' });
  const normalized = String(req.user.email).trim().toLowerCase();

  db.get('SELECT * FROM users WHERE email = ?', [normalized], (err, existing) => {
    if (err) return res.status(500).json({ error: 'خطا در سرور' });
    if (existing) {
      db.run('UPDATE users SET firstname=?, lastname=?, phone=?, profile_complete=1 WHERE id=?',
        [firstname.trim(), lastname.trim(), String(phone).trim(), existing.id], function(e) {
          if (e) return res.status(500).json({ error: e.message });
          const user = { id: existing.id, email: normalized, firstname: firstname.trim(), lastname: lastname.trim(), phone: String(phone).trim(), role: existing.role || 'user', profile_complete: 1 };
          res.json({ token: signToken(user), action: 'registered', user: user });
        });
    } else {
      db.run('INSERT INTO users (email, firstname, lastname, phone, role, profile_complete) VALUES (?,?,?,?,?,1)',
        [normalized, firstname.trim(), lastname.trim(), String(phone).trim(), 'user'], function(e) {
          if (e) return res.status(500).json({ error: e.message });
          const user = { id: this.lastID, email: normalized, firstname: firstname.trim(), lastname: lastname.trim(), phone: String(phone).trim(), role: 'user', profile_complete: 1 };
          res.json({ token: signToken(user), action: 'registered', user: user });
        });
    }
  });
});

app.get('/api/users/me', authenticate, requireComplete, (req, res) => {
  db.get('SELECT id, email, firstname, lastname, phone, role, avatar, profile_complete, created_at FROM users WHERE id=?', [req.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'کاربر یافت نشد' });
    res.json(row);
  });
});

app.get('/api/admin/users', authenticate, requireComplete, requireRole('admin'), (req, res) => {
  db.all('SELECT id, email, firstname, lastname, phone, role, profile_complete, created_at FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/admin/users/:id/role', authenticate, requireComplete, requireRole('admin'), (req, res) => {
  const role = req.body.role;
  if (['user','provider','admin'].indexOf(role) === -1) return res.status(400).json({ error: 'نقش نامعتبر' });
  db.run('UPDATE users SET role=? WHERE id=?', [role, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'نقش به‌روز شد', role: role });
  });
});

app.get('/api/needs', (req, res) => {
  db.all("SELECT n.*, u.firstname, u.lastname FROM needs n JOIN users u ON n.user_id=u.id WHERE n.status!='closed' ORDER BY n.created_at DESC LIMIT 100", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/needs/mine', authenticate, requireComplete, (req, res) => {
  db.all('SELECT * FROM needs WHERE user_id=? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/needs/:id', (req, res) => {
  db.get("SELECT n.*, u.firstname, u.lastname FROM needs n JOIN users u ON n.user_id=u.id WHERE n.id=?", [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'نیاز یافت نشد' });
    res.json(row);
  });
});

app.post('/api/needs', authenticate, requireComplete, (req, res) => {
  const title = req.body.title, message = req.body.message;
  if (!title) return res.status(400).json({ error: 'عنوان لازم است' });
  db.run('INSERT INTO needs (user_id, title, message, status) VALUES (?,?,?,?)', [req.user.id, title.trim(), message || null, 'open'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'نیاز ثبت شد' });
  });
});

app.patch('/api/needs/:id/status', authenticate, requireComplete, (req, res) => {
  const status = req.body.status;
  if (['open','in_progress','closed'].indexOf(status) === -1) return res.status(400).json({ error: 'وضعیت نامعتبر' });
  db.get('SELECT * FROM needs WHERE id=?', [req.params.id], (err, need) => {
    if (err || !need) return res.status(404).json({ error: 'نیاز یافت نشد' });
    if (need.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'مجاز نیست' });
    db.run('UPDATE needs SET status=? WHERE id=?', [status, req.params.id], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ message: 'وضعیت به‌روز شد', status: status });
    });
  });
});

app.get('/api/admin/needs', authenticate, requireComplete, requireRole('admin'), (req, res) => {
  db.all("SELECT n.*, u.firstname, u.lastname, u.email, u.phone FROM needs n JOIN users u ON n.user_id=u.id ORDER BY n.created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/admin/needs/:id/assign', authenticate, requireComplete, requireRole('admin'), (req, res) => {
  const providerId = req.body.provider_id;
  if (!providerId) return res.status(400).json({ error: 'ارائه‌دهنده لازم است' });
  db.get('SELECT * FROM needs WHERE id=?', [req.params.id], (err, need) => {
    if (err || !need) return res.status(404).json({ error: 'نیاز یافت نشد' });
    db.run('UPDATE needs SET assigned_provider_id=?, status=? WHERE id=?', [providerId, 'in_progress', req.params.id], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      db.run('INSERT INTO conversations (need_id, user_id, provider_id, admin_id, title, status) VALUES (?,?,?,?,?,?)',
        [need.id, need.user_id, providerId, req.user.id, need.title, 'open'], function(ce) {
          if (ce) return res.status(500).json({ error: ce.message });
          res.json({ message: 'ارجاع شد', conversation_id: this.lastID });
        });
    });
  });
});

app.get('/api/offers', (req, res) => {
  db.all("SELECT o.*, u.firstname, u.lastname FROM offers o JOIN users u ON o.user_id=u.id WHERE o.status='active' ORDER BY o.created_at DESC LIMIT 100", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/offers/mine', authenticate, requireComplete, (req, res) => {
  db.all('SELECT * FROM offers WHERE user_id=? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/offers/:id', (req, res) => {
  db.get("SELECT o.*, u.firstname, u.lastname FROM offers o JOIN users u ON o.user_id=u.id WHERE o.id=?", [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'خدمت یافت نشد' });
    res.json(row);
  });
});

app.post('/api/offers', authenticate, requireComplete, requireRole('provider', 'admin'), (req, res) => {
  const title = req.body.title, message = req.body.message, category = req.body.category, type = req.body.type;
  if (!title) return res.status(400).json({ error: 'عنوان لازم است' });
  const t = ['product','service','skill'].indexOf(type) !== -1 ? type : 'service';
  db.run('INSERT INTO offers (user_id, title, message, category, type) VALUES (?,?,?,?,?)',
    [req.user.id, title.trim(), message || null, category || null, t], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'خدمت ثبت شد' });
    });
});

app.delete('/api/offers/:id', authenticate, requireComplete, (req, res) => {
  db.get('SELECT * FROM offers WHERE id=?', [req.params.id], (err, offer) => {
    if (err || !offer) return res.status(404).json({ error: 'یافت نشد' });
    if (offer.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'مجاز نیست' });
    db.run("UPDATE offers SET status=? WHERE id=?", ['inactive', req.params.id], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ message: 'حذف شد' });
    });
  });
});

app.get('/api/provider/requests', authenticate, requireComplete, requireRole('provider', 'admin'), (req, res) => {
  db.all("SELECT n.*, u.firstname, u.lastname, u.phone, c.id as conversation_id FROM needs n JOIN users u ON n.user_id=u.id LEFT JOIN conversations c ON c.need_id=n.id AND c.provider_id=n.assigned_provider_id WHERE n.assigned_provider_id=? ORDER BY n.created_at DESC", [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/conversations', authenticate, requireComplete, (req, res) => {
  var sql, params;
  if (req.user.role === 'admin') {
    sql = "SELECT c.*, u.firstname as user_firstname, u.lastname as user_lastname, p.firstname as provider_firstname, p.lastname as provider_lastname FROM conversations c JOIN users u ON c.user_id=u.id LEFT JOIN users p ON c.provider_id=p.id ORDER BY c.created_at DESC";
    params = [];
  } else if (req.user.role === 'provider') {
    sql = "SELECT c.*, u.firstname as user_firstname, u.lastname as user_lastname FROM conversations c JOIN users u ON c.user_id=u.id WHERE c.provider_id=? OR c.admin_id=? ORDER BY c.created_at DESC";
    params = [req.user.id, req.user.id];
  } else {
    sql = "SELECT c.*, p.firstname as provider_firstname, p.lastname as provider_lastname FROM conversations c LEFT JOIN users p ON c.provider_id=p.id WHERE c.user_id=? ORDER BY c.created_at DESC";
    params = [req.user.id];
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/conversations/:id/messages', authenticate, requireComplete, (req, res) => {
  db.get('SELECT * FROM conversations WHERE id=?', [req.params.id], (err, conv) => {
    if (err || !conv) return res.status(404).json({ error: 'گفتگو یافت نشد' });
    var allowed = req.user.role === 'admin' || conv.user_id === req.user.id || conv.provider_id === req.user.id || conv.admin_id === req.user.id;
    if (!allowed) return res.status(403).json({ error: 'مجاز نیست' });
    db.all("SELECT m.*, u.firstname, u.lastname, u.role FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.conversation_id=? ORDER BY m.created_at ASC", [req.params.id], (e, rows) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(rows || []);
    });
  });
});

app.post('/api/conversations/:id/messages', authenticate, requireComplete, (req, res) => {
  var body = req.body.body;
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'پیام خالی است' });
  db.get('SELECT * FROM conversations WHERE id=?', [req.params.id], (err, conv) => {
    if (err || !conv) return res.status(404).json({ error: 'گفتگو یافت نشد' });
    var allowed = req.user.role === 'admin' || conv.user_id === req.user.id || conv.provider_id === req.user.id || conv.admin_id === req.user.id;
    if (!allowed) return res.status(403).json({ error: 'مجاز نیست' });
    db.run('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?,?,?)', [req.params.id, req.user.id, String(body).trim()], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ id: this.lastID, message: 'ارسال شد' });
    });
  });
});

app.post('/api/conversations', authenticate, requireComplete, requireRole('admin'), (req, res) => {
  var user_id = req.body.user_id, title = req.body.title;
  if (!user_id) return res.status(400).json({ error: 'کاربر لازم است' });
  db.run('INSERT INTO conversations (user_id, admin_id, title, status) VALUES (?,?,?,?)', [user_id, req.user.id, title || 'گفتگو با پشتیبانی', 'open'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.use(express.static(__dirname));
app.get('/', function(req, res) { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, function() {
  console.log('Bazano v1 on port ' + PORT);
  if (!SMTP_HOST || !SMTP_USER) console.log('SMTP not set — OTP may use dev fallback');
});
