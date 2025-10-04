const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require("@pinecone-database/pinecone");

module.exports = async (req, res) => {
    // Adicionado para lidar com a verificação de CORS do navegador
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-response-type');
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { chunk, index: chunkIndex } = req.body;

        if (!chunk) {
            return res.status(400).json({ error: 'Text chunk is required.' });
        }

        // Initialize clients
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pinecone.index('nutriapp-knowledge');

        // Create embedding
        const model = genAI.getGenerativeModel({ model: "text-embedding-004"});
        const result = await model.embedContent(chunk);
        const embedding = result.embedding.values;

        // Upsert to Pinecone
        await index.upsert([
            {
                id: `chunk-${Date.now()}-${chunkIndex}`,
                values: embedding,
                metadata: { text: chunk },
            },
        ]);

        res.status(200).json({ success: true, message: `Chunk ${chunkIndex} processed.` });

    } catch (error) {
        console.error('Error processing chunk:', error);
        res.status(500).json({ error: error.message });
    }
};

