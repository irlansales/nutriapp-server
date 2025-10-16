import { GoogleGenAI } from "@google/genai"; // Corrigido para GoogleGenAI
import { Pinecone } from "@pinecone-database/pinecone";

// Função para "limpar" o nome do ficheiro e torná-lo seguro para o ID
function sanitizeForId(text) {
    return text
        .normalize("NFD") // Separa acentos dos caracteres
        .replace(/[\u0300-\u036f]/g, "") // Remove os acentos
        .replace(/[^a-zA-Z0-9-._]/g, '_') // Substitui caracteres não seguros por _
        .substring(0, 50); // Limita o tamanho do nome
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-response-type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { chunk, sourceName, index: chunkIndex } = req.body;

        if (!chunk || !sourceName) {
            return res.status(400).json({ error: 'Chunk e sourceName são obrigatórios.' });
        }

        // --- INÍCIO DA CORREÇÃO ---
        // 1. Inicialização correta com objeto de configuração
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        // 2. Chamada direta ao modelo de embedding (sintaxe moderna)
        const response = await ai.models.embedContent({
            model: "text-embedding-004",
            content: chunk,
        });
        const embedding = response.embedding.values;
        // --- FIM DA CORREÇÃO ---
        
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.index('nutriapp-knowledge');

        const sanitizedSourceName = sanitizeForId(sourceName);

        await index.upsert([
            {
                id: `chunk-${sanitizedSourceName}-${chunkIndex}-${Math.random().toString(36).substring(7)}`,
                values: embedding,
                metadata: { text: chunk, source: sourceName },
            },
        ]);

        res.status(200).json({ success: true, message: `Chunk ${chunkIndex} from ${sourceName} processed.` });

    } catch (error) {
        console.error('Error processing chunk:', error);
        // Retorna a mensagem de erro da API do Gemini, se houver
        const errorMessage = error.details || error.message || 'Erro desconhecido no servidor.';
        res.status(500).json({ error: errorMessage });
    }
}