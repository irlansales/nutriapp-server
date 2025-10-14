import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import pdf from 'pdf-parse';
import fetch from 'node-fetch';

function getGoogleDriveDownloadUrl(url) {
    const regex = /\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return null; // Retorna nulo se não for um link de arquivo compartilhável padrão
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { pdfUrl } = req.body;
        const downloadUrl = getGoogleDriveDownloadUrl(pdfUrl);

        if (!downloadUrl) {
            return res.status(400).json({ error: 'URL do Google Drive inválida ou não é um link de compartilhamento de arquivo.' });
        }

        const pdfResponse = await fetch(downloadUrl);
        if (!pdfResponse.ok) {
            throw new Error(`Falha ao baixar o PDF do link (Status: ${pdfResponse.status}). Verifique o link e as permissões de compartilhamento.`);
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        const data = await pdf(pdfBuffer);
        const fullText = data.text;

        const chunks = fullText.match(/[\s\S]{1,8000}/g) || [];
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.index('nutriapp-knowledge');
        const model = genAI.getGenerativeModel({ model: "text-embedding-004"});

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const result = await model.embedContent(chunk);
            const embedding = result.embedding.values;

            await index.upsert([
                {
                    id: `chunk-${Date.now()}-${i}`,
                    values: embedding,
                    metadata: { text: chunk },
                },
            ]);
        }

        res.status(200).json({ success: true, message: `PDF processado com sucesso. ${chunks.length} partes foram aprendidas.` });

    } catch (error) {
        console.error('Error in learn-from-url handler:', error);
        res.status(500).json({ error: error.message });
    }
}
