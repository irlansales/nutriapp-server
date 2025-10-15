import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(req, res) {
    // Lida com a verificação de CORS (preflight request)
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

        const generationModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // **PROMPT ATUALIZADO COM LÓGICA DE FALLBACK**
        let prompt = `Você é um assistente de IA especialista. Sua tarefa é responder à pergunta do usuário usando o CONHECIMENTO DE REFERÊNCIA fornecido.

        REGRAS DE COMPORTAMENTO:
        1.  **Resposta Direta:** Se o CONHECIMENTO DE REFERÊNCIA contém uma resposta direta para a pergunta do usuário, responda-a de forma clara e completa.
        2.  **Resposta Parcial (Fallback):** Se o CONHECIMENTO DE REFERÊNCIA não contém a resposta para a pergunta específica, mas contém informações sobre um tópico geral ou relacionado na pergunta, sua resposta DEVE seguir este formato: "Não encontrei informações específicas sobre [TERMO ESPECÍFICO], mas encontrei o seguinte sobre [TÓPICO GERAL]: [RESPOSTA SOBRE O TÓPICO GERAL]".
        3.  **Sem Resposta:** Se o CONHECIMENTO DE REFERÊNCIA não contém absolutamente nenhuma informação relevante para a pergunta, responda EXATAMENTE com a frase: "Não encontrei uma resposta para esta pergunta no material fornecido.".
        4.  **Proibição:** Não use nenhum conhecimento prévio ou geral que você tenha, a menos que a pergunta seja sobre um facto universalmente óbvio (ex: "qual a cor do céu?").

        CONHECIMENTO DE REFERÊNCIA:
        ---
        ${context || "Nenhum conhecimento relevante foi encontrado nas fontes selecionadas."}
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



