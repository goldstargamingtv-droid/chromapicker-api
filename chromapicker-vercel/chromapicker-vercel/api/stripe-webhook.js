// api/stripe-webhook.js
// Deploy this to Vercel

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key, not anon key for backend
);

// Generate a random license key
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-'); // Format: XXXX-XXXX-XXXX-XXXX
}

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Only process if payment was successful
    if (session.payment_status === 'paid') {
      const customerEmail = session.customer_details?.email || session.customer_email;
      const sessionId = session.id;

      // Check if we already processed this session
      const { data: existing } = await supabase
        .from('licenses')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .single();

      if (!existing) {
        // Generate new license key
        const licenseKey = generateLicenseKey();

        // Save to database
        const { error } = await supabase.from('licenses').insert({
          email: customerEmail,
          license_key: licenseKey,
          stripe_session_id: sessionId,
        });

        if (error) {
          console.error('Error saving license:', error);
          return res.status(500).json({ error: 'Failed to save license' });
        }

        console.log(`License created for ${customerEmail}: ${licenseKey}`);
      }
    }
  }

  res.status(200).json({ received: true });
}
