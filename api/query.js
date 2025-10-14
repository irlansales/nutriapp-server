import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";

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
        const { query, patientContext, sources } = req.body;
        if (!sources || sources.length === 0) {
            return res.status(400).json({ error: 'Pelo menos uma fonte de conhecimento deve ser selecionada.' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.index('nutriapp-knowledge');

        const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004"});
        const queryEmbedding = await embeddingModel.embedContent(query);
        
        const queryResponse = await index.query({
            topK: 3,
            vector: queryEmbedding.embedding.values,
            includeMetadata: true,
            filter: { 'source': { '$in': sources } }
        });

        const context = queryResponse.matches.map(match => `Fonte: ${match.metadata.source}\\nTrecho: ${match.metadata.text}`).join('\\n\\n---\\n\\n');

        const generationModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // **PROMPT ATUALIZADO E MAIS RÍGIDO**
        let prompt = `Você é um assistente de IA. Sua única tarefa é responder à pergunta do usuário baseando-se ESTRITAMENTE e EXCLUSIVAMENTE no CONHECIMENTO DE REFERÊNCIA fornecido abaixo.
        Se a resposta não estiver no conhecimento fornecido, você DEVE responder EXATAMENTE com a frase "Não encontrei a resposta no material fornecido.".
        Não use nenhum conhecimento prévio. Não tente adivinhar ou inferir a resposta.

        CONHECIMENTO DE REFERÊNCIA:
        ---
        ${context || "Nenhum conhecimento relevante foi encontrado."}
        ---

        Pergunta do usuário: \"${query}\"`;
        
        const result = await generationModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.status(200).json({ response: text, retrievedContext: context });

    } catch (error) {
        console.error('Error in query handler:', error);
        res.status(500).json({ error: error.message });
    }
}









