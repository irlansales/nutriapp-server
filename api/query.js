import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(req, res) {
    // Lida com a verificação de CORS (preflight request)
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-response-type');
@@ -15,14 +14,7 @@ export default async function handler(req, res) {
}

try {
        const { query, patientContext, complexity, stream } = req.body;

        let topKValue;
        switch (complexity) {
            case 'fast': topKValue = 1; break;
            case 'detailed': topKValue = 5; break;
            default: topKValue = 3; break;
        }
        const { query, patientContext } = req.body;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
@@ -32,12 +24,13 @@ export default async function handler(req, res) {
const queryEmbedding = await embeddingModel.embedContent(query);

const queryResponse = await index.query({
            topK: topKValue,
            topK: 3,
vector: queryEmbedding.embedding.values,
includeMetadata: true,
});

const context = queryResponse.matches.map(match => match.metadata.text).join('\\n\\n---\\n\\n');

const generationModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

let prompt = `Aja como um nutricionista especialista. Responda à seguinte solicitação: \"${query}\".\\n\\nUse o seguinte CONHECIMENTO para basear sua resposta:\\n\\n---\\n${context}\\n---\\n\\nConsidere também os dados do paciente: ${patientContext}.\\n\\nSua resposta deve seguir o formato solicitado.`;
@@ -46,19 +39,11 @@ export default async function handler(req, res) {
prompt += `\\nResponda estritamente com um objeto JSON com a chave \"dietPlan\" contendo um array de refeições, onde cada refeição tem \"name\" e \"foods\" (um array de objetos com \"name\" e \"quantity\").`;
}

        if (stream) {
            const result = await generationModel.generateContentStream(prompt);
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            for await (const chunk of result.stream) {
                res.write(chunk.text());
            }
            res.end();
        } else {
            const result = await generationModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            res.status(200).json({ response: text, retrievedContext: context });
        }
        const result = await generationModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.status(200).json({ response: text, retrievedContext: context });

} catch (error) {
console.error('Error in query handler:', error);
@@ -70,3 +55,5 @@ export default async function handler(req, res) {














