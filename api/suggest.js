import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Inicializa os clientes das APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const index = pinecone.index('nutriapp-knowledge');
const generationModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-preview-0514" });
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export default async function handler(request, response) {
    // Configurações de CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') return response.status(200).end();
    if (request.method !== 'POST') return response.status(405).json({ message: 'Método não permitido.' });

    try {
        const query = "Sugira um almoço saudável com cerca de 500 calorias";

        // 1. Criar embedding para a pergunta
        const queryEmbeddingResult = await embeddingModel.embedContent({ content: query, task_type: "RETRIEVAL_QUERY" });
        const queryEmbedding = queryEmbeddingResult.embedding.values;

        // 2. Pesquisar no Pinecone por contexto relevante
        const queryResponse = await index.namespace('pdf-content').query({
            vector: queryEmbedding,
            topK: 3, // Obter os 3 pedaços de texto mais relevantes
            includeMetadata: true,
        });

        // 3. Extrair o texto dos metadados
        const context = queryResponse.matches.map(match => match.metadata.text).join("\n\n");
        
        if (queryResponse.matches.length === 0) {
            return response.status(200).json({ 
                suggestion: "Não encontrei informação relevante na base de conhecimento para responder a esta pergunta. Por favor, faça o upload de um PDF com o conteúdo desejado.",
                sources: []
            });
        }

        // 4. Construir o prompt final com o contexto do PDF
        const prompt = `
            Você é um especialista em nutrição. Com base nos seguintes excertos de um documento técnico:
            ---
            ${context}
            ---
            Responda à seguinte pergunta: ${query}
        `;
        
        // 5. Gerar a resposta final com o modelo de linguagem
        const result = await generationModel.generateContent(prompt);
        const suggestionText = result.response.text();

        // 6. Enviar a sugestão E as fontes utilizadas
        return response.status(200).json({ 
            suggestion: suggestionText,
            sources: queryResponse.matches.map(match => match.metadata.text) // Envia os excertos usados
        });

    } catch (error) {
        console.error("Erro no servidor (suggest):", error);
        return response.status(500).json({ message: 'Ocorreu um erro interno no servidor ao gerar a sugestão.', error: error.message });
    }
}






