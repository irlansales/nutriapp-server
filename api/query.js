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
            topK: 5, // Aumentamos para 5 para dar mais contexto para raciocínio
            vector: queryEmbedding.embedding.values,
            includeMetadata: true,
            filter: { 'source': { '$in': sources } }
        });

        const context = queryResponse.matches.map(match => `Fonte: ${match.metadata.source}\\nTrecho: ${match.metadata.text}`).join('\\n\\n---\\n\\n');

        const generationModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // **PROMPT ATUALIZADO COM HIERARQUIA DE CONHECIMENTO**
        let prompt = `Você é um assistente de IA especialista em nutrição. Sua tarefa é responder à pergunta do usuário.

        REGRAS DE COMPORTAMENTO:
        1.  **FONTE DA VERDADE:** Sua resposta deve ser primariamente baseada nos princípios, diretrizes e dados do **CONHECIMENTO DE REFERÊNCIA** fornecido. Se este conhecimento contradiz o seu conhecimento geral, a informação do CONHECIMENTO DE REFERÊNCIA está **sempre correta**.
        2.  **RACIOCÍNIO E APLICAÇÃO:** Você pode e deve usar o seu conhecimento geral (cálculos, conhecimento sobre alimentos, estruturação de texto) para **aplicar, calcular e elaborar** sobre os conceitos encontrados no CONHECIMENTO DE REFERÊNCIA. Por exemplo, se o conhecimento explica como calcular uma dieta, use essa fórmula para montar uma dieta, mesmo que o exemplo exato não esteja no texto.
        3.  **HONESTIDADE:** Se o CONHECIMENTO DE REFERÊNCIA não contém nem mesmo os princípios básicos para responder a uma pergunta técnica (ex: a pergunta é sobre dietas e o livro é sobre carros), responda que não encontrou informação relevante no material fornecido. Não invente informações.

        CONHECIMENTO DE REFERÊNCIA:
        ---
        ${context || "Nenhum conhecimento relevante foi encontrado nas fontes selecionadas."}
        ---

        Dados do paciente (para contexto): ${patientContext}

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





