require('dotenv').config();
const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json({ limit: '10mb' }));

const MERGE_API_KEY = process.env.MERGE_API_KEY || 'fashion-calendar-app-merge-key';
const PORT = process.env.PORT || 4000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME || 'merged-images';
const UPLOAD_PREFIX = process.env.UPLOAD_PREFIX || 'merged';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// helper to download image buffer
async function downloadBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  return Buffer.from(res.data);
}

// compose vertically on white background
async function composeVertical(upperBuf, lowerBuf, targetWidth = 1024) {
  const up = await sharp(upperBuf).resize({ width: targetWidth }).toBuffer();
  const lw = await sharp(lowerBuf).resize({ width: targetWidth }).toBuffer();
  const upMeta = await sharp(up).metadata();
  const lwMeta = await sharp(lw).metadata();
  const totalHeight = upMeta.height + lwMeta.height;

  const merged = await sharp({
    create: {
      width: targetWidth,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite([
    { input: up, top: 0, left: 0 },
    { input: lw, top: upMeta.height, left: 0 }
  ])
  .png()
  .toBuffer();

  return merged;
}

app.post('/merge-clothes', async (req, res) => {
  try {
    const auth = (req.header('x-merge-api-key') || req.header('authorization') || '').trim();
    const token = auth.startsWith('Bearer ') ? auth.replace('Bearer ', '') : auth;

    if (!token) return res.status(401).json({ code: 401, message: 'Missing merge API key' });
    if (token !== MERGE_API_KEY && token !== 'fashion-calendar-app-merge-key') {
      return res.status(401).json({ code: 401, message: 'Invalid merge API key' });
    }

    const { upperUrl, lowerUrl } = req.body || {};
    if (!upperUrl || !lowerUrl) return res.status(400).json({ error: 'upperUrl and lowerUrl required' });

    const [upperBuf, lowerBuf] = await Promise.all([downloadBuffer(upperUrl), downloadBuffer(lowerUrl)]);
    const mergedBuf = await composeVertical(upperBuf, lowerBuf, parseInt(process.env.TARGET_WIDTH || '1024', 10));

    const filename = `${UPLOAD_PREFIX}/${Date.now()}-${uuidv4()}.png`;
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filename, mergedBuf, {
      contentType: 'image/png',
      upsert: false
    });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'Failed to upload merged image' });
    }

    const { data: signedData, error: signedErr } = await supabase.storage.from(BUCKET_NAME)
      .createSignedUrl(filename, 60 * 15);

    if (signedErr) {
      console.error('Signed URL error:', signedErr);
      return res.status(500).json({ error: 'Failed to create signed URL' });
    }

    return res.json({ mergedUrl: signedData.signedUrl });
  } catch (err) {
    console.error('merge error', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
});

app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`Merge service listening on :${PORT}`));
