// ==========================================================================
// L'Atelier Intelligent — script frontend
// Ce fichier relie l'interface au backend Express fourni (ai_studio_code.js)
// via les 3 endpoints exposés :
//   POST /api/summarize          -> génère et enregistre un résumé
//   GET  /api/summaries/:userId  -> liste les résumés d'un utilisateur
//   POST /api/generate-quiz      -> génère un quiz à partir d'un résumé
// ==========================================================================

// URL de base de l'API. Le backend écoute sur le port 3000 par défaut
// (voir `const PORT = process.env.PORT || 3000;` dans server.js).
// Changez cette valeur si votre backend est déployé ailleurs.
const API_BASE_URL = 'http://localhost:3000';

// Identifiant utilisateur "en dur" pour cette démo, en l'absence d'un
// système d'authentification dans le backend fourni.
// À remplacer par le vrai UID une fois Firebase Auth branché côté client.
const CURRENT_USER_ID = 'demo-user-jahnovich';

// --------------------------------------------------------------------
// Références DOM
// --------------------------------------------------------------------
const summaryForm      = document.getElementById('summary-form');
const contentInput     = document.getElementById('content-input');
const charCountEl      = document.getElementById('char-count');
const subjectChips     = document.getElementById('subject-chips');
const selectedSubject  = document.getElementById('selected-subject');
const submitBtn        = document.getElementById('submit-btn');

const aiResultBlock    = document.getElementById('ai-result');
const aiResultContent  = document.getElementById('ai-result-content');

const summariesGrid    = document.getElementById('summaries-grid');
const summariesEmpty   = document.getElementById('summaries-empty');
const refreshBtn       = document.getElementById('refresh-btn');
const cardTemplate     = document.getElementById('summary-card-template');

const quizPlaceholder  = document.getElementById('quiz-placeholder');
const quizContent      = document.getElementById('quiz-content');

const topProgressBar   = document.getElementById('top-progress-bar');

// ==========================================================================
// 1. Sélection de la matière (chips)
// ==========================================================================
subjectChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  // Retire l'état actif de toutes les chips, puis l'applique à celle cliquée
  subjectChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  selectedSubject.value = chip.dataset.subject;
});

// ==========================================================================
// 2. Compteur de caractères sur la zone de texte
// ==========================================================================
contentInput.addEventListener('input', () => {
  const count = contentInput.value.length;
  charCountEl.textContent = `${count} caractère${count > 1 ? 's' : ''}`;
});

// ==========================================================================
// 3. Génération d'un résumé -> POST /api/summarize
// ==========================================================================
summaryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const content = contentInput.value.trim();
  const subject = selectedSubject.value;
  if (!content) return;

  setLoading(true);
  setProgress(20);

  try {
    const response = await fetch(`${API_BASE_URL}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        subject,
        userId: CURRENT_USER_ID,
      }),
    });

    setProgress(70);

    if (!response.ok) {
      throw new Error(`Le serveur a répondu avec le statut ${response.status}`);
    }

    const data = await response.json(); // { id, summary }

    // Affiche la réponse de l'IA dans le bloc dédié
    aiResultContent.textContent = data.summary;
    aiResultBlock.classList.remove('hidden');
    aiResultBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Vide le formulaire et rafraîchit la liste des résumés du dashboard
    contentInput.value = '';
    charCountEl.textContent = '0 caractère';
    await loadSummaries();

    setProgress(100);
  } catch (error) {
    // En cas d'échec (backend éteint, erreur réseau, etc.) on informe
    // clairement l'utilisateur au lieu de rester silencieux.
    aiResultContent.textContent =
      `Impossible de générer le résumé : ${error.message}. ` +
      `Vérifiez que le serveur backend tourne bien sur ${API_BASE_URL}.`;
    aiResultBlock.classList.remove('hidden');
  } finally {
    setLoading(false);
    setTimeout(() => setProgress(0), 500);
  }
});

// Petit utilitaire pour basculer l'état de chargement du bouton principal
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('loading', isLoading);
  submitBtn.querySelector('.btn-label').textContent = isLoading
    ? 'Génération en cours'
    : 'Générer le résumé';
}

// Anime la barre de progression fine en haut de l'écran
function setProgress(percent) {
  topProgressBar.style.width = `${percent}%`;
}

// ==========================================================================
// 4. Récupération des résumés -> GET /api/summaries/:userId
// ==========================================================================
async function loadSummaries() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/summaries/${CURRENT_USER_ID}`);
    if (!response.ok) throw new Error(`statut ${response.status}`);

    const summaries = await response.json();
    renderSummaries(summaries);
  } catch (error) {
    summariesEmpty.textContent =
      `Impossible de charger vos résumés (${error.message}). Le backend est-il démarré ?`;
    summariesEmpty.classList.remove('hidden');
  }
}

// Construit les cartes de résumé dans le tableau de bord à partir du template HTML
function renderSummaries(summaries) {
  // Nettoie la grille avant de la re-remplir (sauf le message "vide")
  summariesGrid.querySelectorAll('.lesson-card').forEach((card) => card.remove());

  if (!summaries || summaries.length === 0) {
    summariesEmpty.textContent = 'Aucun résumé pour le moment. Générez-en un ci-dessus !';
    summariesEmpty.classList.remove('hidden');
    return;
  }

  summariesEmpty.classList.add('hidden');

  summaries.forEach((summary) => {
    const node = cardTemplate.content.cloneNode(true);

    const subjectChip = node.querySelector('.subject-chip');
    subjectChip.textContent = summary.subject || 'Général';

    node.querySelector('.lesson-title').textContent = summary.subject
      ? `Résumé — ${summary.subject}`
      : 'Résumé';

    node.querySelector('.lesson-snippet').textContent = summary.summary || '';

    // Firestore renvoie un timestamp serveur ; on l'affiche s'il est disponible,
    // sinon on retombe sur "à l'instant" (juste après la création).
    const dateEl = node.querySelector('.lesson-date');
    dateEl.textContent = summary.createdAt?._seconds
      ? new Date(summary.createdAt._seconds * 1000).toLocaleDateString('fr-FR')
      : 'À l\'instant';

    // Bouton "Générer un quiz" -> déclenche l'appel API dédié pour ce résumé
    const quizBtn = node.querySelector('.quiz-btn');
    quizBtn.addEventListener('click', () => generateQuiz(summary.id, quizBtn));

    summariesGrid.appendChild(node);
  });
}

refreshBtn.addEventListener('click', loadSummaries);

// ==========================================================================
// 5. Génération d'un quiz -> POST /api/generate-quiz
// ==========================================================================
async function generateQuiz(summaryId, triggerButton) {
  const originalLabel = triggerButton.textContent;
  triggerButton.disabled = true;
  triggerButton.textContent = 'Génération...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaryId }),
    });

    if (!response.ok) throw new Error(`statut ${response.status}`);

    const data = await response.json(); // { questions: [...] }
    renderQuiz(data.questions);

    document.getElementById('quiz').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    quizPlaceholder.textContent = `Impossible de générer le quiz : ${error.message}.`;
    quizPlaceholder.classList.remove('hidden');
    quizContent.classList.add('hidden');
  } finally {
    triggerButton.disabled = false;
    triggerButton.textContent = originalLabel;
  }
}

// Affiche la liste de questions renvoyées par le backend
function renderQuiz(questions) {
  quizContent.innerHTML = '';

  if (!questions || questions.length === 0) {
    quizPlaceholder.textContent = 'Aucune question générée pour ce résumé.';
    quizPlaceholder.classList.remove('hidden');
    quizContent.classList.add('hidden');
    return;
  }

  quizPlaceholder.classList.add('hidden');
  quizContent.classList.remove('hidden');

  questions.forEach((question, index) => {
    const questionText = question.question || question.text || '';

    const questionEl = document.createElement('div');
    questionEl.className = 'quiz-question';

    const title = document.createElement('div');
    title.className = 'quiz-question-title body-md';
    title.textContent = `${index + 1}. ${questionText}`;
    questionEl.appendChild(title);

    (question.options || question.choices || []).forEach((option) => {
      const optionEl = document.createElement('label');
      optionEl.className = 'quiz-option body-sm';
      optionEl.innerHTML = `<input type="radio" name="q${index}" value="${option}"> ${option}`;
      questionEl.appendChild(optionEl);
    });

    // Bouton "Vérifier ma réponse" -> POST /api/check-answer
    // L'IA renvoie si la réponse choisie est correcte, avec une explication pédagogique.
    const verifyBtn = document.createElement('button');
    verifyBtn.type = 'button';
    verifyBtn.className = 'btn btn-secondary quiz-verify-btn';
    verifyBtn.textContent = 'Vérifier ma réponse';
    questionEl.appendChild(verifyBtn);

    // Zone où s'affiche le verdict + l'explication de l'IA (masquée au départ)
    const feedbackEl = document.createElement('div');
    feedbackEl.className = 'quiz-feedback hidden';
    questionEl.appendChild(feedbackEl);

    verifyBtn.addEventListener('click', () => checkAnswer(questionText, questionEl, verifyBtn, feedbackEl));

    quizContent.appendChild(questionEl);
  });
}

// Envoie la réponse sélectionnée par l'étudiant au backend pour vérification par l'IA
async function checkAnswer(questionText, questionEl, verifyBtn, feedbackEl) {
  const selected = questionEl.querySelector('input[type="radio"]:checked');
  if (!selected) {
    feedbackEl.textContent = 'Choisissez une réponse avant de vérifier.';
    feedbackEl.className = 'quiz-feedback quiz-feedback-incorrect';
    return;
  }

  const originalLabel = verifyBtn.textContent;
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Analyse IA...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/check-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: questionText, answer: selected.value }),
    });

    if (!response.ok) throw new Error(`statut ${response.status}`);

    const result = await response.json(); // { correct, explanation }

    feedbackEl.textContent = `${result.correct ? '✓ Correct' : '✗ Incorrect'} — ${result.explanation}`;
    feedbackEl.className = `quiz-feedback ${result.correct ? 'quiz-feedback-correct' : 'quiz-feedback-incorrect'}`;
  } catch (error) {
    feedbackEl.textContent = `Impossible de vérifier la réponse : ${error.message}.`;
    feedbackEl.className = 'quiz-feedback quiz-feedback-incorrect';
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = originalLabel;
  }
}

// ==========================================================================
// Initialisation : on charge les résumés existants dès l'ouverture de la page
// ==========================================================================
document.addEventListener('DOMContentLoaded', loadSummaries);
