// api/check-email.js
// Checks if an email has a valid license (for polling after purchase)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Enable CORS for extension
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ found: false, error: 'Email required' });
  }

  // Clean up the email
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('licenses')
      .select('license_key, is_active, created_at')
      .eq('email', cleanEmail)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({ 
      found: true, 
      licenseKey: data.license_key,
      activatedAt: data.created_at 
    });
  } catch (err) {
    console.error('Error checking email:', err);
    return res.status(500).json({ found: false, error: 'Server error' });
  }
}
