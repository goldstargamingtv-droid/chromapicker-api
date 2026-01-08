// api/validate-license.js
// Validates a license key from the extension

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

  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ valid: false, error: 'License key required' });
  }

  // Clean up the key (remove spaces, uppercase)
  const cleanKey = licenseKey.trim().toUpperCase().replace(/\s/g, '');

  try {
    const { data, error } = await supabase
      .from('licenses')
      .select('id, email, is_active, created_at')
      .eq('license_key', cleanKey)
      .single();

    if (error || !data) {
      return res.status(200).json({ valid: false, error: 'Invalid license key' });
    }

    if (!data.is_active) {
      return res.status(200).json({ valid: false, error: 'License has been deactivated' });
    }

    return res.status(200).json({ 
      valid: true, 
      email: data.email,
      activatedAt: data.created_at 
    });
  } catch (err) {
    console.error('Error validating license:', err);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}
