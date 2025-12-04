# Voice Samples Setup Guide

## Overview
Voice samples allow customers to preview different narrator voices WITHOUT making API calls to OpenAI on every preview. You generate these samples **ONCE** and they're reused for all customers forever.

## Quick Setup (Recommended)

### Option 1: Generate Using the Script

1. Make sure you have your OpenAI API key set:
   ```bash
   export OPENAI_API_KEY=your-api-key-here
   ```

2. Run the generation script:
   ```bash
   node scripts/generate-voice-samples.js
   ```

This will create 6 audio files in `public/voice-samples/`:
- alloy.mp3
- echo.mp3
- fable.mp3
- onyx.mp3
- nova.mp3
- shimmer.mp3

**Cost**: This will cost approximately $0.06 total (6 voices × ~5 seconds each) - a ONE-TIME cost!

### Option 2: Generate Manually Using Supabase Edge Function

If you prefer to use your existing infrastructure:

1. Create a simple test page or API route that calls OpenAI TTS
2. Generate audio for each voice with this text:
   ```
   "Hello! This is a preview of how this voice sounds for your video."
   ```
3. Download the 6 audio files
4. Place them in `public/voice-samples/`

## How It Works

- Each voice button now has a speaker icon 🔊
- Clicking the speaker icon plays the pre-recorded sample
- No API calls are made during preview
- Samples are loaded from local `/voice-samples/*.mp3` files

## Testing

After generating the samples, refresh your app and click the speaker icons next to each voice name in the video configuration form.

## Benefits

✅ **Zero ongoing costs** - samples are generated once  
✅ **Instant playback** - no waiting for API calls  
✅ **Better UX** - customers can compare voices quickly  
✅ **Unlimited previews** - no API costs per preview  

## File Structure

```
public/
  voice-samples/
    alloy.mp3
    echo.mp3
    fable.mp3
    onyx.mp3
    nova.mp3
    shimmer.mp3
    README.md
```

