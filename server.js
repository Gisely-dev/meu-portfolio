/**
 * Backend do assistente de IA do portfólio.
 *
 * Requisitos:
 *   - Node.js 20 ou superior
 *   - npm install express
 *   - variável de ambiente OPENAI_API_KEY configurada
 *
 * Execução (PowerShell):
 *   Copie .env.example para .env, preencha a chave e execute npm run portfolio
 */

const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3333;
const apiKey = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `Você é o assistente de portfólio de Gisely dos Santos de Oliveira.
Responda sempre em português, de forma breve, direta e simpática, ajudando recrutadores a conhecerem melhor a candidata.

Informações confirmadas:
- Gisely é estudante de Engenharia de Software e busca sua primeira vaga como Desenvolvedora Back-end Jr.
- Habilidades: Java, JavaScript, Python, POO, estruturas de dados, APIs, lógica de programação, bancos de dados e boas práticas.
- GitHub: https://github.com/Gisely-dev
- LinkedIn: https://www.linkedin.com/in/gisely-oliveira-9a9a28362
- Projetos: sistema-bancario (Java/POO e ArrayList), FantasyQuest-Java (RPG em camadas), calculadora-java, Armazenar-Produtos, edu-games (JavaScript) e gesture-scanner (Python + API Java).

Não invente experiências, resultados, formação adicional, contatos ou competências. Para perguntas fora da carreira e dos projetos da Gisely, diga educadamente que só pode falar sobre o perfil profissional dela.`;

app.use(express.json({ limit: "16kb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({ online: true, configured: Boolean(apiKey) });
});

// Limite simples para evitar uso acidental ou abusivo da sua chave de API.
const requests = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;

function allowRequest(ip) {
  const now = Date.now();
  const previous = (requests.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (previous.length >= MAX_REQUESTS) return false;
  previous.push(now);
  requests.set(ip, previous);
  return true;
}

function localReply(message) {
  const text = message.toLocaleLowerCase("pt-BR");

  if (/idade|anos/.test(text)) {
    return "A idade da Gisely não foi informada no portfólio. Posso contar sobre a formação, as habilidades e os projetos dela.";
  }
  if (/stack|skill|tecnolog|linguagem|java|python|javascript/.test(text)) {
    return "As principais tecnologias da Gisely são Java, JavaScript e Python. Ela também pratica POO, APIs, estruturas de dados, lógica de programação, bancos de dados e boas práticas.";
  }
  if (/projeto|github|reposit/.test(text)) {
    return "No GitHub, a Gisely desenvolveu projetos como sistema-bancario, FantasyQuest-Java, calculadora-java, Armazenar-Produtos, edu-games e gesture-scanner. Posso detalhar algum deles.";
  }
  if (/forma[cç][aã]o|curso|estud/.test(text)) {
    return "Gisely é estudante de Engenharia de Software, com foco em desenvolvimento Back-end e aprendizado contínuo.";
  }
  if (/vaga|objetivo|trabalh|contrat/.test(text)) {
    return "Gisely busca sua primeira oportunidade como Desenvolvedora Back-end Jr. Ela valoriza organização em camadas, código legível e aprendizado prático.";
  }
  return "Posso falar sobre as habilidades, os projetos, a formação e o objetivo profissional da Gisely. O que você gostaria de conhecer melhor?";
}

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message || message.length > 1_000) {
    return res.status(400).json({ error: "Envie uma mensagem entre 1 e 1000 caracteres." });
  }

  if (!allowRequest(req.ip)) {
    return res.status(429).json({ error: "Muitas mensagens. Tente novamente em um minuto." });
  }

  if (!apiKey) {
    return res.json({ reply: localReply(message), source: "local" });
  }

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: SYSTEM_PROMPT,
        input: message,
        max_output_tokens: 350,
      }),
    });

    const data = await openaiResponse.json();
    if (!openaiResponse.ok) {
      console.error("Erro da OpenAI:", data.error?.message || openaiResponse.status);
      return res.status(502).json({ error: "Não foi possível gerar uma resposta agora." });
    }

    const reply = data.output_text?.trim();
    if (!reply) return res.status(502).json({ error: "A IA não retornou uma resposta." });

    return res.json({ reply });
  } catch (error) {
    console.error("Erro ao chamar a IA:", error.message);
    return res.json({ reply: localReply(message), source: "local" });
  }
});

app.listen(port, () => {
  console.log(`Portfólio disponível em http://localhost:${port}`);
});
