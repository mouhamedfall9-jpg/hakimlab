export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, aspect_ratio, token } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Prompt requis' });
  if (!token) return res.status(400).json({ error: 'Token requis' });

  try {
    // Modèle FLUX-schnell — rapide, gratuit, haute qualité
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          aspect_ratio: aspect_ratio || '1:1',
          output_format: 'webp',
          output_quality: 80,
          num_outputs: 1,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.detail || JSON.stringify(data) });
    }

    // Attendre le résultat si pas encore prêt
    let prediction = data;
    let attempts = 0;

    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      prediction = await poll.json();
    }

    if (prediction.status === 'succeeded' && prediction.output) {
      const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return res.status(200).json({ imageUrl });
    } else {
      return res.status(500).json({ error: prediction.error || 'Génération échouée' });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
