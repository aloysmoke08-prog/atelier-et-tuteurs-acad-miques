// server.js
// Version SIMPLIFIÉE pour une démo/présentation rapide :
// - Pas de Firebase : les résumés sont stockés en mémoire (dans un tableau JS).
//   -> Avantage : zéro configuration, ça marche tout de suite.
//   -> Limite : si tu arrêtes le serveur (Ctrl+C), tout est perdu. Pour un vrai
//      projet en production, il faudra reconnecter une vraie base de données.
// - L'appel à l'IA (callGemma) est simulé par défaut pour ne nécessiter aucune
//   clé API. Pour brancher un vrai modèle (Google AI Studio / Gemini), voir la
//   section "BRANCHER UNE VRAIE IA" plus bas.

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
// Les fichiers du site (index.html, style.css, script.js) sont dans le dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- "BASE DE DONNÉES" EN MÉMOIRE ---
// Remplace Firestore : un simple tableau qui vit tant que le serveur tourne.
const summaries = [];
let nextId = 1; // compteur simple pour générer des identifiants uniques

// --- APPEL IA (simulé) ---
async function callGemma(prompt) {
  // Simulation : pas d'appel réseau, réponse générée localement.
  // Ça permet de faire tourner toute l'app (résumé, quiz, correction)
  // sans clé API, le temps de la démo.
  //
  // BRANCHER UNE VRAIE IA (Google AI Studio / Gemini) :
  // 1. Récupère une clé API gratuite sur https://aistudio.google.com/app/apikey
  // 2. npm install @google/generative-ai
  // 3. Remplace le contenu de cette fonction par :
  //
  //    const { GoogleGenerativeAI } = require('@google/generative-ai');
  //    const genAI = new GoogleGenerativeAI("TA_CLE_API");
  //    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  //    const result = await model.generateContent(prompt);
  //    return result.response.text();

  if (prompt.includes('à choix multiples')) {
    // Faux quiz de démonstration (format attendu par le frontend)
    return JSON.stringify([
      { question: "Quel est le sujet principal de ce résumé ?", options: ["Option A", "Option B", "Option C", "Option D"] },
      { question: "Quel concept clé est mentionné ?", options: ["Option A", "Option B", "Option C", "Option D"] },
      { question: "Quelle affirmation est correcte ?", options: ["Option A", "Option B", "Option C", "Option D"] },
      { question: "Quel élément n'appartient pas au sujet ?", options: ["Option A", "Option B", "Option C", "Option D"] },
      { question: "Quelle est la meilleure définition du sujet traité ?", options: ["Option A", "Option B", "Option C", "Option D"] },
    ]);
  }

  if (prompt.includes('L\'étudiant a répondu')) {
    // Fausse vérification de réponse de démonstration
    return JSON.stringify({
      correct: true,
      explanation: "Ceci est une explication simulée (mode démo sans IA réelle branchée).",
    });
  }

  // Faux résumé de démonstration
  return "Ceci est un résumé généré automatiquement (mode démo). Branchez une vraie IA " +
    "dans la fonction callGemma() de server.js pour obtenir de vrais résumés.";
}

// --- ENDPOINTS ---

// Générer un résumé et l'enregistrer
app.post('/api/summarize', async (req, res) => {
  const { content, subject, userId } = req.body;

  try {
    const prompt = `Résume de manière structurée et académique le texte suivant pour la matière ${subject} : ${content}`;
    const summaryText = await callGemma(prompt);

    // "Enregistrement" en mémoire, à la place de db.collection('summaries').add(...)
    const newSummary = {
      id: String(nextId++),
      userId,
      subject,
      originalContent: content,
      summary: summaryText,
      createdAt: new Date(),
    };
    summaries.push(newSummary);

    res.json({ id: newSummary.id, summary: summaryText });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Récupérer les résumés pour le Dashboard
app.get('/api/summaries/:userId', (req, res) => {
  // Filtre par utilisateur, trie du plus récent au plus ancien, garde les 10 derniers
  const userSummaries = summaries
    .filter((s) => s.userId === req.params.userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);

  res.json(userSummaries);
});

// Générer un quiz basé sur un résumé
app.post('/api/generate-quiz', async (req, res) => {
  const { summaryId } = req.body;

  try {
    // Récupère le résumé stocké en mémoire pour baser le quiz dessus
    const found = summaries.find((s) => s.id === summaryId);
    if (!found) {
      return res.status(404).json({ error: 'Résumé introuvable pour cet id.' });
    }

    const prompt = `À partir de ce résumé de ${found.subject} : "${found.summary}", génère exactement 5 questions ` +
      `à choix multiples pour tester la compréhension de l'étudiant. ` +
      `Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, au format : ` +
      `[{"question": "...", "options": ["...", "...", "...", "..."]}]`;

    const rawResponse = await callGemma(prompt);
    const questions = parseQuestionsResponse(rawResponse);

    res.json({ questions });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Vérifier la réponse d'un étudiant à une question de quiz et expliquer pourquoi
app.post('/api/check-answer', async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Les champs "question" et "answer" sont requis.' });
  }

  try {
    const prompt = `Question de quiz : "${question}". L'étudiant a répondu : "${answer}". ` +
      `Indique si la réponse est correcte et donne une explication pédagogique claire en français. ` +
      `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format : ` +
      `{"correct": true ou false, "explanation": "..."}`;

    const rawResponse = await callGemma(prompt);
    const result = parseCheckAnswerResponse(rawResponse);

    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// --- HELPERS DE PARSING ---
// L'IA est censée répondre en JSON strict (voir les prompts ci-dessus), mais un LLM
// peut parfois ajouter du texte autour (ex: "Voici le JSON : [...]"). Ces fonctions
// isolent le JSON et retombent sur une valeur de secours sûre si le parsing échoue,
// pour que l'API ne plante jamais à cause d'une réponse mal formée.
function parseQuestionsResponse(rawResponse) {
  try {
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/); // isole le premier tableau JSON trouvé
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Impossible de parser les questions générées par l\'IA :', error.message);
    return []; // le frontend affiche alors "Aucune question générée"
  }
}

function parseCheckAnswerResponse(rawResponse) {
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/); // isole le premier objet JSON trouvé
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
    return {
      correct: Boolean(parsed.correct),
      explanation: parsed.explanation || 'Aucune explication fournie.',
    };
  } catch (error) {
    console.error('Impossible de parser la vérification de l\'IA :', error.message);
    return { correct: false, explanation: "L'IA n'a pas pu vérifier cette réponse pour le moment." };
  }
}

const PORT = process.env.PORT || 3000;

// En local : on démarre le serveur. Sur Vercel : on exporte seulement l'application.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
}

module.exports = app;
