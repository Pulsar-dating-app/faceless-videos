// Script to generate voice samples for all supported languages
// Run this script: node scripts/generate-voice-samples.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const ELEVENLABS_API_KEY = "sk_945038b586aad42af177bcdf87a2d5e62e743369a165fcd6";

if (!ELEVENLABS_API_KEY) {
  console.error('Error: ELEVENLABS_API_KEY environment variable not set');
  process.exit(1);
}

// ElevenLabs voice configurations
const voices = {
  'Freeman': '5lrBPYY4YvMbKHTo8kvZ',
  'Alfred': 'NOpBlnGInO9m6vDvFkFC',
  'Finn': 'vBKc2FfBKJfcZNyEt1n6',
  'Raquel': 'GDzHdQOi6jjf8zaXhCYD',
  'Holly': 'B9PDs7mcHTMxHUw5U8Cf',
  'Brittney': 'kPzsL2i3teMYv0FxEYQ6',
};

// Language configurations with sample text
const languages = {
  'en': { name: 'English', text: 'Hello! This is a preview of how this voice sounds for your video.' },
  'es': { name: 'Spanish', text: '¡Hola! Esta es una vista previa de cómo suena esta voz para tu video.' },
  'fr': { name: 'French', text: 'Bonjour! Ceci est un aperçu de la sonorité de cette voix pour votre vidéo.' },
  'de': { name: 'German', text: 'Hallo! Dies ist eine Vorschau, wie diese Stimme für Ihr Video klingt.' },
  'pt': { name: 'Portuguese', text: 'Olá! Esta é uma prévia de como esta voz soa para o seu vídeo.' },
  'it': { name: 'Italian', text: 'Ciao! Questa è un\'anteprima di come suona questa voce per il tuo video.' },
  'nl': { name: 'Dutch', text: 'Hallo! Dit is een voorbeeld van hoe deze stem klinkt voor je video.' },
  'pl': { name: 'Polish', text: 'Cześć! To jest podgląd tego, jak brzmi ten głos w Twoim filmie.' },
  'ru': { name: 'Russian', text: 'Привет! Это предварительный просмотр того, как звучит этот голос для вашего видео.' },
  'zh': { name: 'Chinese', text: '你好！这是此声音在您的视频中听起来如何的预览。' },
  'ja': { name: 'Japanese', text: 'こんにちは！これは、このボイスがあなたのビデオでどのように聞こえるかのプレビューです。' },
  'ko': { name: 'Korean', text: '안녕하세요! 이것은 이 음성이 비디오에서 어떻게 들리는지 미리보기입니다.' },
  'ar': { name: 'Arabic', text: 'مرحبا! هذه معاينة لكيفية صوت هذا الصوت لفيديو الخاص بك.' },
  'hi': { name: 'Hindi', text: 'नमस्ते! यह आपके वीडियो के लिए इस आवाज़ की झलक है।' },
  'tr': { name: 'Turkish', text: 'Merhaba! Bu, videonuz için bu sesin nasıl göründüğünün bir önizlemesidir.' },
  'sv': { name: 'Swedish', text: 'Hej! Detta är en förhandsgranskning av hur denna röst låter för din video.' },
  'da': { name: 'Danish', text: 'Hej! Dette er en forhåndsvisning af, hvordan denne stemme lyder til din video.' },
  'no': { name: 'Norwegian', text: 'Hei! Dette er en forhåndsvisning av hvordan denne stemmen høres ut for videoen din.' },
  'fi': { name: 'Finnish', text: 'Hei! Tämä on esikatselu siitä, miltä tämä ääni kuulostaa videossasi.' },
  'id': { name: 'Indonesian', text: 'Halo! Ini adalah pratinjau bagaimana suara ini terdengar untuk video Anda.' },
  'vi': { name: 'Vietnamese', text: 'Xin chào! Đây là bản xem trước về giọng nói này cho video của bạn.' },
  'th': { name: 'Thai', text: 'สวัสดี! นี่คือตัวอย่างเสียงนี้สำหรับวิดีโอของคุณ' },
  'uk': { name: 'Ukrainian', text: 'Привіт! Це попередній перегляд того, як звучить цей голос для вашого відео.' },
  'cs': { name: 'Czech', text: 'Ahoj! Toto je náhled toho, jak tento hlas zní pro vaše video.' },
  'ro': { name: 'Romanian', text: 'Bună! Aceasta este o previzualizare a modului în care sună această voce pentru videoclipul dvs.' },
};

const outputBaseDir = path.join(__dirname, '../public/voice-samples');

// Create base output directory if it doesn't exist
if (!fs.existsSync(outputBaseDir)) {
  fs.mkdirSync(outputBaseDir, { recursive: true });
}

async function generateVoiceSample(voiceName, voiceId, language, sampleText) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text: sampleText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      // Create language subdirectory
      const langDir = path.join(outputBaseDir, language);
      if (!fs.existsSync(langDir)) {
        fs.mkdirSync(langDir, { recursive: true });
      }

      const outputPath = path.join(langDir, `${voiceName}.mp3`);
      const writeStream = fs.createWriteStream(outputPath);

      res.pipe(writeStream);

      writeStream.on('finish', () => {
        console.log(`✓ Generated ${language}/${voiceName}`);
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
  console.log('🎙️  Generating voice samples for all languages...\n');
  
  const voiceEntries = Object.entries(voices);
  const totalSamples = Object.keys(languages).length * voiceEntries.length;
  let generatedCount = 0;
  let skippedCount = 0;
  
  for (const [langCode, langConfig] of Object.entries(languages)) {
    console.log(`\n📢 Processing ${langConfig.name} (${langCode})...`);
    
    for (const [voiceName, voiceId] of voiceEntries) {
      const langDir = path.join(outputBaseDir, langCode);
      const outputPath = path.join(langDir, `${voiceName}.mp3`);
      
      // Skip if file already exists
      if (fs.existsSync(outputPath)) {
        console.log(`  ⊘ Skipping ${voiceName} (already exists)`);
        skippedCount++;
        continue;
      }
      
      try {
        await generateVoiceSample(voiceName, voiceId, langCode, langConfig.text);
        generatedCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ✗ Failed to generate ${voiceName}:`, error.message);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Voice sample generation complete!');
  console.log(`📊 Total: ${totalSamples} samples`);
  console.log(`   Generated: ${generatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Languages: ${Object.keys(languages).length}`);
  console.log(`   Voices per language: ${voiceEntries.length}`);
  console.log('='.repeat(50));
}

generateAllSamples();

