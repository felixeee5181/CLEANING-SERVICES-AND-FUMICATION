const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const { sendEmail, bookingConfirmedHtml, ownerBookingHtml } = require('../services/brevo');

// ---- Auth ----
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== process.env.ADMIN_USERNAME) return res.status(401).json({ error: 'Bad credentials' });
  const ok = bcrypt.compareSync(password || '', process.env.ADMIN_PASSWORD_HASH || '');
  if (!ok) return res.status(401).json({ error: 'Bad credentials' });

  const token = jwt.sign({ role: 'admin', username }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// ---- Uploads ----
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, uploadDir),
  filename: (_r, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024 },
  fileFilter: (_r, file, cb) => {
    const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files allowed'), ok);
  },
});

// ---- Portfolio ----
router.post('/portfolio', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!req.file || !title) return res.status(400).json({ error: 'Image and title required' });
    const { rows } = await pool.query(
      `INSERT INTO portfolio (title, description, image_path, category)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, description || null, req.file.filename, category || null]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.delete('/portfolio/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM portfolio WHERE id=$1 RETURNING image_path', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    fs.unlink(path.join(uploadDir, rows[0].image_path), () => {});
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ---- Payment methods ----
router.get('/payment-methods', requireAdmin, async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM payment_methods ORDER BY id');
  res.json(rows);
});

router.put('/payment-methods/:code', requireAdmin, async (req, res) => {
  const { code } = req.params;
  const { enabled, account, instructions, label } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE payment_methods SET
         enabled      = COALESCE($1, enabled),
         account      = COALESCE($2, account),
         instructions = COALESCE($3, instructions),
         label        = COALESCE($4, label),
         updated_at   = NOW()
       WHERE code = $5 RETURNING *`,
      [enabled ?? null, account ?? null, instructions ?? null, label ?? null, code]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ---- Bookings ----
router.get('/bookings', requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, s.name AS service_name
     FROM bookings b JOIN services s ON s.id = b.service_id
     ORDER BY b.created_at DESC`
  );
  res.json(rows);
});

// Admin confirms a booking → status confirmed + emails via Brevo
router.post('/bookings/:id/confirm', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE bookings SET payment_status='confirmed', confirmed_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const booking = rows[0];

    const svc = await pool.query('SELECT name FROM services WHERE id=$1', [booking.service_id]);
    const enriched = { ...booking, service_name: svc.rows[0]?.name || 'Cleaning service' };

    await Promise.allSettled([
      sendEmail({
        to: { email: booking.customer_email, name: booking.customer_name },
        subject: 'Your SparkleClean booking is confirmed ✨',
        html: bookingConfirmedHtml(enriched),
        replyTo: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
      }),
      sendEmail({
        to: { email: process.env.OWNER_EMAIL, name: 'SparkleClean' },
        subject: `Booking #${booking.id} confirmed`,
        html: ownerBookingHtml(enriched),
      }),
    ]);

    res.json({ ok: true, booking });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Confirm failed' });
  }
});

// Admin cancels a booking
router.post('/bookings/:id/cancel', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE bookings SET payment_status='cancelled' WHERE id=$1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Cancel failed' });
  }
});

module.exports = router;
