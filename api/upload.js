import { formidable } from 'formidable';

// Desativa o parser de corpo padrão da Vercel para podermos lidar com ficheiros
export const config = {
    api: {
        bodyParser: false,
    },
};

// Define o manipulador da função serverless
export default async function handler(request, response) {
    // Permite que a sua aplicação local comunique com este servidor (CORS)
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde a pedidos de 'pre-flight' do navegador
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const form = formidable({});
        
        // O formidable irá processar o pedido e extrair o ficheiro
        const [fields, files] = await form.parse(request);
        
        const pdfFile = files.pdf?.[0];

        if (!pdfFile) {
            return response.status(400).json({ message: 'Nenhum ficheiro PDF encontrado no pedido.' });
        }

        console.log('Ficheiro recebido:', pdfFile.originalFilename);

        // Por agora, apenas confirmamos o recebimento.
        // O próximo passo seria ler este ficheiro e processá-lo.
        return response.status(200).json({ 
            message: 'Ficheiro recebido com sucesso no servidor!',
            filename: pdfFile.originalFilename,
        });

    } catch (error) {
        console.error("Erro no upload:", error);
        return response.status(500).json({ message: 'Ocorreu um erro no servidor ao processar o upload.' });
    }
}
