import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Função para dividir o texto em pedaços
function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    text = text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ');
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks.filter(chunk => chunk.trim() !== '');
}

// Inicializa os clientes das APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('nutriapp-knowledge');

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') return response.status(200).end();
    if (request.method !== 'POST') return response.status(405).json({ message: 'Método não permitido.' });

    try {
        const { text, filename } = request.body;
        if (!text) {
            return response.status(400).json({ message: 'Nenhum texto encontrado no pedido.' });
        }

        const textChunks = chunkText(text);
        if (textChunks.length === 0) {
            return response.status(400).json({ message: 'O PDF não contém texto extraível.' });
        }

        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.batchEmbedContents({
            requests: textChunks.map(chunk => ({ content: chunk, task_type: "RETRIEVAL_DOCUMENT" })),
        });
        const embeddings = result.embeddings.map(e => e.values);

        const vectors = textChunks.map((chunk, i) => ({
            id: `pdf-${filename}-${Date.now()}-chunk-${i}`,
            values: embeddings[i],
            metadata: { text: chunk },
        }));

        await index.namespace('pdf-content').upsert(vectors);

        return response.status(200).json({ 
            message: `Conteúdo do ficheiro "${filename}" processado e guardado na base de conhecimento com sucesso!`,
        });
    } catch (error) {
        console.error("Erro no processamento do texto:", error);
        return response.status(500).json({ message: 'Ocorreu um erro no servidor ao processar o texto.', error: error.message });
    }
}













