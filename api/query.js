const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require("@pinecone-database/pinecone");

export default async function handler(req, res) {
    // Adicionado para lidar com a verificação de CORS do navegador
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { query, patientContext } = req.body;

        // Initialize clients
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pinecone.index('nutriapp-knowledge');

        // 1. Create embedding for the user's query
        const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004"});
        const queryEmbedding = await embeddingModel.embedContent(query);
        
        // 2. Query Pinecone to get relevant context
        const queryResponse = await index.query({
            topK: 5,
            vector: queryEmbedding.embedding.values,
            includeMetadata: true,
        });

        const context = queryResponse.matches.map(match => match.metadata.text).join('\\n\\n---\\n\\n');

        // 3. Call Gemini with the context-rich prompt
        const generationModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        let prompt = `Aja como um nutricionista especialista. Responda à seguinte solicitação do usuário: \"${query}\".\\n\\nUse o seguinte CONHECIMENTO DE REFERÊNCIA para basear sua resposta:\\n\\n---\\n${context}\\n---\\n\\nConsidere também os dados do paciente: ${patientContext}.\\n\\nSua resposta deve seguir o formato solicitado (texto ou JSON).`;
        
        if (req.headers['x-response-type'] === 'json') {
            prompt += `\\nResponda estritamente com um objeto JSON com a chave \"dietPlan\" contendo um array de refeições, onde cada refeição tem \"name\" e \"foods\" (um array de objetos com \"name\" e \"quantity\").`;
        }

        const result = await generationModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.status(200).json({ response: text });

    } catch (error) {
        console.error('Error in query handler:', error);
        res.status(500).json({ error: error.message });
    }
}

