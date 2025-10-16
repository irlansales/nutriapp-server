import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(req, res) {
    // Lida com a verificação de CORS (preflight request)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.index('nutriapp-knowledge');
        const stats = await index.describeIndexStats();
        
        res.status(200).json({ success: true, totalVectorCount: stats.totalVectorCount });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
}
