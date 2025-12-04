// Script to generate voice samples ONCE for preview purposes
// Run this script only once: node scripts/generate-voice-samples.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENAI_API_KEY = "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";

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable not set');
  process.exit(1);
}

const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const sampleText = "Hello! This is a preview of how this voice sounds for your video.";
const outputDir = path.join(__dirname, '../public/voice-samples');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateVoiceSample(voice) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'tts-1',
      input: sampleText,
      voice: voice,
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/audio/speech',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      const outputPath = path.join(outputDir, `${voice}.mp3`);
      const writeStream = fs.createWriteStream(outputPath);

      res.pipe(writeStream);

      writeStream.on('finish', () => {
        console.log(`✓ Generated sample for ${voice}`);
        resolve();
      });

      writeStream.on('error', reject);
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function generateAllSamples() {
  console.log('Generating voice samples...\n');
  
  for (const voice of voices) {
    const outputPath = path.join(outputDir, `${voice}.mp3`);
    
    // Skip if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`⊘ Skipping ${voice} (already exists)`);
      continue;
    }
    
    try {
      await generateVoiceSample(voice);
    } catch (error) {
      console.error(`✗ Failed to generate ${voice}:`, error.message);
    }
  }
  
  console.log('\n✓ Voice sample generation complete!');
}

generateAllSamples();

