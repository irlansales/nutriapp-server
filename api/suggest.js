// Define o manipulador da função serverless, compatível com a Vercel
export default async function handler(request, response) {
    // Permite que a sua aplicação local comunique com este servidor (CORS)
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde a pedidos de 'pre-flight' do navegador
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Garante que apenas pedidos POST são processados
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        // 1. Obter a sua chave de API secreta das variáveis de ambiente da Vercel
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("A chave de API do Gemini não foi configurada no servidor.");
        }

        // 2. Definir o modelo de IA e o URL da API
        const model = 'gemini-1.5-flash-preview-0514';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // 3. Criar o pedido (prompt) para a IA
        const prompt = "Aja como um nutricionista especialista. Sugira um almoço saudável e balanceado com aproximadamente 500 calorias. Descreva a refeição, os seus componentes e justifique brevemente por que é uma boa escolha. Formate a resposta de forma clara e concisa.";

        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        // 4. Chamar a API da Google
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Erro da API Gemini:", errorBody);
            throw new Error(`A chamada à API Gemini falhou: ${apiResponse.statusText}`);
        }

        const data = await apiResponse.json();
        
        // 5. Extrair o texto da resposta da IA
        // A resposta pode vir em partes, então juntamo-las.
        const suggestionText = data.candidates[0].content.parts.map(part => part.text).join("");

        // 6. Enviar a sugestão de volta para a sua aplicação local
        return response.status(200).json({ suggestion: suggestionText });

    } catch (error) {
        console.error("Erro no servidor:", error.message);
        return response.status(500).json({ message: 'Ocorreu um erro interno no servidor.', error: error.message });
    }
}


