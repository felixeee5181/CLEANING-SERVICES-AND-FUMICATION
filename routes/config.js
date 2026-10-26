const router = require('express').Router();
const pool = require('../db/pool');

// Public: which payment methods are enabled + their details
router.get('/payment-methods', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT code, label, account, instructions
       FROM payment_methods WHERE enabled = TRUE ORDER BY id`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load payment methods' });
  }
});

module.exports = router;
