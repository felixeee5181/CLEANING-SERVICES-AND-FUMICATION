const router = require('express').Router();
const pool = require('../db/pool');

// Create a booking (status: pending — client hasn't paid yet)
router.post('/', async (req, res) => {
  const {
    serviceId, customerName, customerEmail, customerPhone,
    address, scheduledAt, notes, paymentMethod,
  } = req.body;

  if (!serviceId || !customerName || !customerEmail || !address || !scheduledAt || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const svc = await pool.query('SELECT name, base_price FROM services WHERE id=$1 AND active=TRUE', [serviceId]);
    if (!svc.rows.length) return res.status(404).json({ error: 'Service not found' });

    const pm = await pool.query('SELECT code, enabled FROM payment_methods WHERE code=$1', [paymentMethod]);
    if (!pm.rows.length || !pm.rows[0].enabled) {
      return res.status(400).json({ error: 'Payment method not available' });
    }

    const amount = Number(svc.rows[0].base_price);

    const { rows } = await pool.query(
      `INSERT INTO bookings
         (service_id, customer_name, customer_email, customer_phone, address,
          scheduled_at, notes, amount, payment_method, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
       RETURNING id`,
      [serviceId, customerName, customerEmail, customerPhone || null,
       address, scheduledAt, notes || null, amount, paymentMethod]
    );

    res.json({ bookingId: rows[0].id, amount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Client submits their M-Pesa transaction code after paying
router.post('/:id/submit-reference', async (req, res) => {
  const { id } = req.params;
  const { paymentRef } = req.body;

  if (!paymentRef || paymentRef.trim().length < 6) {
    return res.status(400).json({ error: 'Invalid M-Pesa reference' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE bookings
       SET payment_ref = $1, payment_status = 'awaiting_confirmation'
       WHERE id = $2 AND payment_status = 'pending'
       RETURNING id, payment_status`,
      [paymentRef.trim(), id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found or already submitted' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit reference' });
  }
});

// Client checks their booking status
router.get('/:id', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.scheduled_at, b.address, b.amount, b.payment_status,
              b.payment_method, b.payment_ref, s.name AS service_name
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.id = $1 AND b.customer_email = $2`,
      [req.params.id, email]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

module.exports = router;
