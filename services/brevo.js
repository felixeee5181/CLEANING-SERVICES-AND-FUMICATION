const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendEmail({ to, subject, html, replyTo }) {
  const body = {
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
    to: Array.isArray(to) ? to : [to],
    subject,
    htmlContent: html,
  };
  if (replyTo) body.replyTo = replyTo;

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Brevo send failed (${res.status}): ${await res.text()}`);
  return res.json();
}

function bookingConfirmedHtml(b) {
  return `
    <h2>Your booking is confirmed ✨</h2>
    <p>Hi ${b.customer_name},</p>
    <ul>
      <li><strong>Service:</strong> ${b.service_name}</li>
      <li><strong>When:</strong> ${new Date(b.scheduled_at).toLocaleString()}</li>
      <li><strong>Address:</strong> ${b.address}</li>
      <li><strong>Amount:</strong> $${Number(b.amount).toFixed(2)}</li>
      <li><strong>M-Pesa ref:</strong> ${b.payment_ref || 'N/A'}</li>
    </ul>
    <p>We'll see you then!</p>
    <p>— SparkleClean</p>
  `;
}

function ownerBookingHtml(b) {
  return `
    <h2>Booking #${b.id} confirmed</h2>
    <ul>
      <li><strong>Customer:</strong> ${b.customer_name} (${b.customer_email}, ${b.customer_phone || 'no phone'})</li>
      <li><strong>Service:</strong> ${b.service_name}</li>
      <li><strong>When:</strong> ${new Date(b.scheduled_at).toLocaleString()}</li>
      <li><strong>Address:</strong> ${b.address}</li>
      <li><strong>Amount:</strong> $${Number(b.amount).toFixed(2)}</li>
      <li><strong>Method:</strong> ${b.payment_method}</li>
      <li><strong>Ref:</strong> ${b.payment_ref || 'N/A'}</li>
    </ul>
  `;
}

module.exports = { sendEmail, bookingConfirmedHtml, ownerBookingHtml };
