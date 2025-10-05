











import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import { formidable } from 'formidable';
import pdf from 'pdf-parse';

// Desativa o parser de corpo padrão da Vercel
export const config = {
    api: {
        bodyParser: false,
    },
};

// Função para dividir o texto em pedaços com limpeza robusta
function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    // Limpeza mais agressiva: remove múltiplos espaços, quebras de linha e caracteres de controle inválidos
    const cleanedText = text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s\s+/g, ' ').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    if (!cleanedText) {
        return [];
    }

    for (let i = 0; i < cleanedText.length; i += chunkSize - overlap) {
        chunks.push(cleanedText.substring(i, i + chunkSize));
    }
    // Garante que não são enviados chunks vazios para a API
    return chunks.filter(chunk => chunk.trim() !== ''); 
}

// Inicializa os clientes das APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('nutriapp-knowledge');

export default async function handler(request, response) {
    // Configurações de CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') return response.status(200).end();
    if (request.method !== 'POST') return response.status(405).json({ message: 'Método não permitido.' });

    try {
        const form = formidable({});
        const [fields, files] = await form.parse(request);
        const pdfFile = files.pdf?.[0];

        if (!pdfFile) {
            return response.status(400).json({ message: 'Nenhum ficheiro PDF encontrado.' });
        }

        const dataBuffer = await fs.readFile(pdfFile.filepath);
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text;

        const textChunks = chunkText(text);

        if (textChunks.length === 0) {
            return response.status(400).json({ message: 'O PDF não contém texto extraível ou o texto é inválido.' });
        }

        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.batchEmbedContents({
            requests: textChunks.map(chunk => ({ content: chunk, task_type: "RETRIEVAL_DOCUMENT" })),
        });
        const embeddings = result.embeddings.map(e => e.values);

        const vectors = textChunks.map((chunk, i) => ({
            id: `pdf-${Date.now()}-chunk-${i}`,
            values: embeddings[i],
            metadata: { text: chunk },
        }));

        await index.namespace('pdf-content').upsert(vectors);

        await fs.unlink(pdfFile.filepath);

        return response.status(200).json({ 
            message: `Conteúdo do ficheiro "${pdfFile.originalFilename}" processado e guardado na base de conhecimento com sucesso!`,
        });

    } catch (error) {
        console.error("Erro no processamento do texto:", error);
        return response.status(500).json({ message: 'Ocorreu um erro no servidor ao processar o texto.', error: error.message });
    }
}



