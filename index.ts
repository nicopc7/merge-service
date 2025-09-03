import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import axios from 'axios';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 4000;

console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Using PORT: ${PORT}`);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-merge-api-key']
}));

// Environment variables
const MERGE_API_KEY = process.env.MERGE_API_KEY || 'fashion-calendar-app-merge-key';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET_NAME = process.env.BUCKET_NAME || 'merged-images';
const UPLOAD_PREFIX = process.env.UPLOAD_PREFIX || 'merged';
const TARGET_WIDTH = parseInt(process.env.TARGET_WIDTH || '1024', 10);

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Required environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Helper function to download an image as a buffer
 */
async function downloadBuffer(url: string): Promise<Buffer> {
  try {
    console.log(`Downloading image from: ${url}`);
    const res = await axios.get(url, { 
      responseType: 'arraybuffer', 
      timeout: 20000,
      headers: {
        'Accept': 'image/*, */*'
      }
    });
    return Buffer.from(res.data);
  } catch (error) {
    console.error(`Error downloading image: ${error}`);
    throw new Error(`Failed to download image: ${(error as Error).message}`);
  }
}

/**
 * Compose two images vertically on a white background
 */
async function composeVertical(upperBuf: Buffer, lowerBuf: Buffer, targetWidth = 1024): Promise<Buffer> {
  try {
    console.log(`Composing images with target width: ${targetWidth}`);
    
    // Resize images to target width
    const up = await sharp(upperBuf)
      .resize({ width: targetWidth })
      .toBuffer();
      
    const lw = await sharp(lowerBuf)
      .resize({ width: targetWidth })
      .toBuffer();
    
    // Get metadata for each image
    const [upMeta, lwMeta] = await Promise.all([
      sharp(up).metadata(),
      sharp(lw).metadata()
    ]);
    
    if (!upMeta.height || !lwMeta.height) {
      throw new Error('Failed to get image metadata');
    }
    
    const totalHeight = upMeta.height + lwMeta.height;
    
    // Create a new image with both parts on white background
    const merged = await sharp({
      create: {
        width: targetWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([
      { input: up, top: 0, left: 0 },
      { input: lw, top: upMeta.height, left: 0 }
    ])
    .png()
    .toBuffer();
    
    return merged;
  } catch (error) {
    console.error(`Error composing images: ${error}`);
    throw new Error(`Failed to compose images: ${(error as Error).message}`);
  }
}

/**
 * API endpoint to merge two clothing images
 */
app.post('/merge-clothes', async (req: Request, res: Response) => {
  console.log('Received merge-clothes request');
  
  try {
    // Validate API key
    const auth = (req.header('x-merge-api-key') || req.header('authorization') || '').trim();
    const token = auth.startsWith('Bearer ') ? auth.replace('Bearer ', '') : auth;
    
    if (!token) {
      console.log('Missing API key');
      return res.status(401).json({ code: 401, message: 'Missing merge API key' });
    }
    
    if (token !== MERGE_API_KEY && token !== 'fashion-calendar-app-merge-key') {
      console.log('Invalid API key');
      return res.status(401).json({ code: 401, message: 'Invalid merge API key' });
    }
    
    // Validate request body
    const { upperUrl, lowerUrl } = req.body || {};
    if (!upperUrl || !lowerUrl) {
      return res.status(400).json({ error: 'upperUrl and lowerUrl required' });
    }
    
    console.log(`Processing merge request for upper: ${upperUrl.substring(0, 50)}... and lower: ${lowerUrl.substring(0, 50)}...`);
    
    // Download and merge images
    const [upperBuf, lowerBuf] = await Promise.all([
      downloadBuffer(upperUrl), 
      downloadBuffer(lowerUrl)
    ]);
    
    console.log('Images downloaded successfully, merging...');
    const mergedBuf = await composeVertical(upperBuf, lowerBuf, TARGET_WIDTH);
    
    // Generate unique filename
    const filename = `${UPLOAD_PREFIX}/${Date.now()}-${uuidv4()}.png`;
    console.log(`Uploading merged image as: ${filename}`);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, mergedBuf, {
        contentType: 'image/png',
        upsert: false
      });
      
    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'Failed to upload merged image' });
    }
    
    console.log('Image uploaded successfully, creating signed URL');
    
    // Generate signed URL for the uploaded image
    const { data: signedData, error: signedErr } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filename, 60 * 15); // 15 minutes expiry
    
    if (signedErr) {
      console.error('Signed URL error:', signedErr);
      return res.status(500).json({ error: 'Failed to create signed URL' });
    }
    
    console.log('Merge completed successfully!');
    return res.json({ mergedUrl: signedData.signedUrl });
    
  } catch (err) {
    const error = err as Error;
    console.error('Merge error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  return res.send({
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Start the server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Merge service listening on port ${PORT}`);
  console.log(`Health check available at http://0.0.0.0:${PORT}/health`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
