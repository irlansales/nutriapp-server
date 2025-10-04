// api/suggest.js - Função Serverless para a Vercel

// Esta função simula uma resposta da IA.
// Ela será o nosso "cérebro" na nuvem.
export default function handler(request, response) {
  // Configura os cabeçalhos para permitir que a sua aplicação local
  // se comunique com este servidor (CORS).
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*'); // Permite qualquer origem
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // A Vercel precisa de uma resposta para o método OPTIONS
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  // Apenas responde a pedidos POST
  if (request.method === 'POST') {
    // No futuro, aqui iremos ler os dados do paciente e dos livros.
    // Por agora, apenas devolvemos uma sugestão fixa para testar.
    const mockSuggestion = {
      suggestion: '150g de Salmão, filé, grelhado com 200g de Batata, doce, cozida e salada de Alface, crespa, crua à vontade.',
    };
    
    // Envia a sugestão como uma resposta JSON
    response.status(200).json(mockSuggestion);
  } else {
    // Se não for POST, devolve um erro.
    response.status(405).send({ error: 'Método não permitido' });
  }
}
