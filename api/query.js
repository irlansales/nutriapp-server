import { GoogleGenerativeAI } from \"@google/generative-ai\";\nimport { Pinecone } from \"@pinecone-database/pinecone\";\n\nexport default async function handler(req, res) {\n    res.setHeader('Access-Control-Allow-Origin', '*');\n    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');\n    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-response-type');\n    if (req.method === 'OPTIONS') {\n        return res.status(200).end();\n    }\n    \n    if (req.method !== 'POST') {\n        return res.status(405).json({ error: 'Method Not Allowed' });\n    }\n\n    try {\n        const { query, patientContext } = req.body;\n\n        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);\n        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });\n        const index = pinecone.index('nutriapp-knowledge');\n\n        const embeddingModel = genAI.getGenerativeModel({ model: \"text-embedding-004\"});\n        const queryEmbedding = await embeddingModel.embedContent(query);\n        \n        const queryResponse = await index.query({\n            topK: 3,\n            vector: queryEmbedding.embedding.values,\n            includeMetadata: true,\n        });\n\n        const context = queryResponse.matches.map(match => match.metadata.text).join('\\n\\n---\\n\\n');\n\n        const generationModel = genAI.getGenerativeModel({ model: \"gemini-1.5-flash\" });\n        \n        let prompt = `Aja como um nutricionista especialista. Responda à seguinte solicitação: \"${query}\".\\n\\nUse o seguinte CONHECIMENTO para basear sua resposta:\\n\\n---\\n${context}\\n---\\n\\nConsidere também os dados do paciente: ${patientContext}.\\n\\nSua resposta deve seguir o formato solicitado.`;\n        \n        if (req.headers['x-response-type'] === 'json') {\n            prompt += `\\nResponda estritamente com um objeto JSON com a chave \"dietPlan\" contendo um array de refeições, onde cada refeição tem \"name\" e \"foods\" (um array de objetos com \"name\" e \"quantity\").`;\n        }\n\n        const result = await generationModel.generateContent(prompt);\n        const response = await result.response;\n        const text = response.text();\n        \n        res.status(200).json({ response: text, retrievedContext: context });\n\n    } catch (error) {\n        console.error('Error in query handler:', error);\n        res.status(500).json({ error: error.message });\n    }\n}"














