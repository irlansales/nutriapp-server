import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(req, res) {
    // Lida com a verificação de CORS (preflight request)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Garante que apenas o método POST seja aceite
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.index('nutriapp-knowledge');
        
        // Comando para apagar todos os vetores no índice
        await index.deleteAll();

        res.status(200).json({ success: true, message: 'Base de conhecimento limpa com sucesso.' });

    } catch (error) {
        console.error('Error clearing knowledge base:', error);
        res.status(500).json({ error: error.message });
    }
}
