// server.js

const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3333;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to extract key insights
function extractInsights(analysis) {
  const lines = analysis.split('\n');
  const insights = [];

  for (const line of lines) {
    if (
      line.trim().startsWith('•') ||
      line.trim().match(/^\d+\./) ||
      line.toLowerCase().includes('greenwashing') ||
      line.toLowerCase().includes('sustainable') ||
      line.toLowerCase().includes('certification') ||
      line.toLowerCase().includes('claim')
    ) {
      if (line.trim().length > 15 && !insights.includes(line.trim())) {
        insights.push(line.trim());
      }
    }
  }

  return insights.slice(0, 5); // Max 5 insights
}

// API to analyze images
app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const prompt = `Analyze this product for greenwashing.

You are an expert in environmental claims and sustainable product verification. Carefully examine the image and evaluate:

1. Does the product make specific, measurable environmental claims or just vague statements?
2. Are there legitimate environmental certifications visible?
3. Does the product use misleading imagery or terminology?
4. Are there signs of hidden trade-offs or irrelevant environmental claims?
5. Is the product exaggerating a minor environmental benefit?

Begin with a 1-2 sentence summary. Then 3-5 bullet points. Keep total response under 300 words.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // <-- using gpt-4o (supports images)
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
          ]
        }
      ],
      max_tokens: 1000,
    });

    const analysis = response.choices[0].message.content;

    const greenwashingPhrases = [
      'greenwashing', 'misleading', 'exaggerated', 'vague claim',
      'no certification', 'false', 'deceptive', 'unsubstantiated',
      'no evidence', 'questionable', 'misleading imagery', 'overstated',
      'not specific', 'lacks transparency', 'irrelevant claims',
      'hidden trade-offs', 'lesser of two evils', 'suggestive imagery'
    ];

    const genuinePhrases = [
      'certified', 'legitimate', 'verified', 'evidence-based',
      'transparent', 'specific claim', 'third-party verification',
      'clear evidence', 'quantifiable', 'measurable impact',
      'authentic', 'scientifically proven', 'sustainable', 'ecolabel',
      'credible', 'eco-friendly', 'accurate', 'substantiated'
    ];

    let greenwashingScore = 0;
    let genuineScore = 0;

    greenwashingPhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      greenwashingScore += (analysis.match(regex) || []).length;
    });

    genuinePhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      genuineScore += (analysis.match(regex) || []).length;
    });

    const firstSentence = analysis.split('.')[0].toLowerCase();
    let isGreenwashing = greenwashingScore > genuineScore;

    if (
      firstSentence.includes('not greenwashing') ||
      firstSentence.includes('genuine') ||
      firstSentence.includes('legitimate') ||
      firstSentence.includes('authentic')
    ) {
      isGreenwashing = false;
    } else if (
      firstSentence.includes('greenwashing') ||
      firstSentence.includes('misleading') ||
      firstSentence.includes('deceptive')
    ) {
      isGreenwashing = true;
    }

    const scoreDifference = Math.abs(greenwashingScore - genuineScore);
    let confidence = 70 + Math.min(scoreDifference * 3, 29);
    confidence = Math.min(confidence, 99);

    const insights = extractInsights(analysis);

    res.json({
      isGreenwashing,
      analysis,
      insights,
      confidence: Math.round(confidence),
    });

  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ 
      error: 'Failed to analyze image',
      details: error.message
    });
  }
});

// Serve frontend for any route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server on 0.0.0.0 (accept connections from local network)
app.listen(port, '0.0.0.0', () => {
  console.log(`
  =========================================
  ✅ G-AI Server Running
  🌐 Local Access: http://localhost:${port}
  📱 Network Access: http://10.17.215.148:${port}
  📊 API Endpoint: http://10.17.215.148:${port}/api/analyze
  =========================================
  `);
});
