// ---------------------- Supabase Setup ----------------------
import { supabase } from "../../utils/supabaseClient.js";

// Quiz state variables
let mainQuestions = [];
let currentMainIdx = 0;
let currentSubIdx = 0;
let score = 0;
let subQuestionResults = [];
let submitLocked = false;

// DOM elements
let quizHeader, roundLabel, questionLabel, questionText, choicesForm, submitBtn;
let loadingPopup, quizMainArea, clockDisplay;

// Timer variables
let quizStartTimestamp = null;
let quizTimerInterval = null;
let elapsedSeconds = 0;
let subQuestionStartTimestamp = null;

// Initialize the quiz when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing new quiz layout...');
  
  // Get DOM elements
  quizHeader = document.querySelector('.quiz-header');
  roundLabel = quizHeader?.querySelector('.round-label');
  questionLabel = quizHeader?.querySelector('.question-label');
  questionText = document.querySelector('.quiz-question-text');
  choicesForm = document.querySelector('.quiz-choices-form');
  submitBtn = document.querySelector('.quiz-submit-btn');
  loadingPopup = document.getElementById('loadingPopup');
  quizMainArea = document.querySelector('.quiz-main-area');
  
  // Create clock display
  createClockDisplay();
  
  // Add event listeners
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }
  
  // Start the quiz
  initializeQuiz();
});

function createClockDisplay() {
  if (!quizHeader) return;
  
  clockDisplay = document.querySelector('.quiz-clock-display');
  if (!clockDisplay) {
    clockDisplay = document.createElement('div');
    clockDisplay.className = 'quiz-clock-display';
    clockDisplay.style.cssText = 'position:absolute;top:1.5rem;left:2rem;font-size:1.3rem;font-family:Pixelify Sans,sans-serif;font-weight:700;color:#23282b;background:#e0e0e0;padding:0.5rem 1.2rem;border-radius:0.7rem;z-index:20;box-shadow:0 2px 8px #e0e0e055;';
    quizHeader.appendChild(clockDisplay);
  }
}

async function initializeQuiz() {
  console.log('Initializing quiz...');
  showLoadingPopup(true);
  
  try {
    mainQuestions = await fetchQuestions();
    console.log('Fetched questions:', mainQuestions);
    
    if (mainQuestions.length === 0) {
      questionText.innerHTML = '<p style="color: red;">No questions available. Please check your database.</p>';
      showLoadingPopup(false);
      return;
    }
    
    // Initialize quiz state
    currentMainIdx = 0;
    currentSubIdx = 0;
    score = 0;
    subQuestionResults = [];
    
    // Start timer
    startQuizClock();
    
    // Render first question
    renderCurrentQuestion();
    
  } catch (error) {
    console.error('Error initializing quiz:', error);
    questionText.innerHTML = `<p style="color: red;">Error loading questions: ${error.message}</p>`;
  } finally {
    showLoadingPopup(false);
  }
}

async function fetchQuestions() {
  console.log('Fetching questions from database...');
  
  try {
    // First, try to fetch from main_questions table (new structure)
    const { data: mains, error: mainErr } = await supabase
      .from('main_questions')
      .select('*')
      .order('id', { ascending: true });
    
    if (!mainErr && mains && mains.length > 0) {
      console.log('Found main_questions table, using new structure');
      
      // For each main_question, fetch its sub_questions
      for (const mq of mains) {
        const { data: subs, error: subErr } = await supabase
          .from('sub_questions')
          .select('*')
          .eq('main_question_id', mq.id)
          .order('step_number', { ascending: true });
        
        if (subErr) {
          console.error('Error fetching sub-questions for main question', mq.id, ':', subErr);
          mq.sub_questions = [];
        } else {
          mq.sub_questions = subs;
          console.log(`Sub-questions for main question ${mq.id}:`, subs);
        }
      }
      
      return mains;
    }
    
    // If main_questions table doesn't exist or is empty, try the old structure
    console.log('main_questions table not found or empty, trying old structure...');
    
    // Try different possible table names
    const possibleTableNames = ['questions', 'questions_test_two', 'quiz_questions', 'math_questions'];
    
    for (const tableName of possibleTableNames) {
      console.log(`Trying table: ${tableName}`);
      
      const { data: questions, error } = await supabase
        .from(tableName)
        .select('*')
        .order('id', { ascending: true });
      
      if (!error && questions && questions.length > 0) {
        console.log(`Found working table: ${tableName} with ${questions.length} questions`);
        
        // Convert old structure to new structure
        const convertedQuestions = questions.map(q => ({
          id: q.id,
          main_question: q.question || 'No main question provided',
          topic: q['math-topic'] || q.topic || q.math_topic || 'Unknown',
          difficulty: q.difficulty || 'easy',
          sub_questions: [{
            id: q.id,
            question: q.question || 'No question provided',
            choices: q.choices || [],
            correct_answer: q.answer || q.correct_answer || '',
            step_number: 1
          }]
        }));
        
        return convertedQuestions;
      }
    }
    
    // If no database tables work, use CSV data as fallback
    console.log('No database tables found, using CSV fallback...');
    return await loadCSVQuestions();
    
  } catch (error) {
    console.error('Error in fetchQuestions:', error);
    console.log('Falling back to CSV data...');
    return await loadCSVQuestions();
  }
}

async function loadCSVQuestions() {
  try {
    const response = await fetch('math-questions.csv');
    const csvText = await response.text();
    
    // Simple CSV parser
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const questions = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = parseCSVLine(lines[i]);
      if (values.length >= headers.length) {
        const question = {};
        headers.forEach((header, index) => {
          question[header.trim()] = values[index];
        });
        
        // Parse choices if it's a JSON string
        if (question.choices) {
          try {
            question.choices = JSON.parse(question.choices);
          } catch (e) {
            console.error('Error parsing choices:', e);
            question.choices = ['Error loading choices'];
          }
        }
        
        questions.push(question);
      }
    }
    
    console.log(`Loaded ${questions.length} questions from CSV`);
    
    // Convert to new structure
    const convertedQuestions = questions.map(q => ({
      id: q.id,
      main_question: q.question || 'No main question provided',
      topic: q['math-topic'] || 'Unknown',
      difficulty: q.difficulty || 'easy',
      sub_questions: [{
        id: q.id,
        question: q.question || 'No question provided',
        choices: q.choices || [],
        correct_answer: q.answer || '',
        step_number: 1
      }]
    }));
    
    return convertedQuestions;
    
  } catch (error) {
    console.error('Error loading CSV:', error);
    throw new Error('Could not load questions from database or CSV file');
  }
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

function renderCurrentQuestion() {
  console.log('Rendering current question...');
  console.log('Current main index:', currentMainIdx);
  console.log('Current sub index:', currentSubIdx);
  console.log('Main questions:', mainQuestions);
  
  if (!mainQuestions.length || currentMainIdx >= mainQuestions.length) {
    console.log('No more main questions');
    showEndMessage();
    return;
  }
  
  const mq = mainQuestions[currentMainIdx];
  console.log('Current main question:', mq);
  
  if (!mq.sub_questions || currentSubIdx >= mq.sub_questions.length) {
    console.log('No more sub questions for current main question');
    // Move to next main question
    currentMainIdx++;
    currentSubIdx = 0;
    if (currentMainIdx < mainQuestions.length) {
      renderCurrentQuestion();
    } else {
      showEndMessage();
    }
    return;
  }
  
  const sq = mq.sub_questions[currentSubIdx];
  console.log('Current sub question:', sq);
  
  // Update header
  if (roundLabel) {
    roundLabel.textContent = `Round ${currentMainIdx + 1}`;
  }
  
  if (questionLabel) {
    const topicText = mq.topic || 'Unknown';
    const difficultyText = mq.difficulty || 'Unknown';
    const difficultyColor = difficultyText.toLowerCase() === 'easy' ? '#388e3c' : '#B0323A';
    
    questionLabel.innerHTML = `
      <span class='question-number'>Main Q${currentMainIdx + 1}</span> 
      | Topic: ${topicText} 
      | Difficulty: <span style='color:${difficultyColor};'>${difficultyText}</span>
    `;
  }
  
  // Update main question text (left side)
  if (questionText) {
    if (mq.main_question) {
      questionText.innerHTML = `<div class='main-question-context'><b>Main Question:</b> ${mq.main_question}</div>`;
    } else {
      questionText.innerHTML = '<div class="main-question-context"><b>Main Question:</b> No main question provided</div>';
    }
  }
  
  // Update sub-question text (right side)
  const quizRight = document.querySelector('.quiz-right');
  if (quizRight) {
    // Remove any previous sub-question
    let prevSubQ = quizRight.querySelector('.sub-question-text');
    if (prevSubQ) prevSubQ.remove();
    
    // Create new sub-question div
    const subQDiv = document.createElement('div');
    subQDiv.className = 'sub-question-text';
    subQDiv.innerHTML = sq.question || 'No sub-question provided';
    
    // Insert above quiz-info-label
    const infoLabel = quizRight.querySelector('.quiz-info-label');
    if (infoLabel) {
      quizRight.insertBefore(subQDiv, infoLabel);
    } else {
      quizRight.prepend(subQDiv);
    }
  }
  
  // Update choices
  if (choicesForm) {
    let choices = [];
    
    if (Array.isArray(sq.choices)) {
      choices = sq.choices;
    } else if (typeof sq.choices === 'string') {
      try {
        choices = JSON.parse(sq.choices);
      } catch (e) {
        console.error('Error parsing choices string:', e);
        choices = ['Error loading choices'];
      }
    } else {
      choices = ['No choices provided'];
    }
    
    console.log('Choices for current question:', choices);
    
    const formHtml = choices.map((choice, i) => {
      const letter = String.fromCharCode(65 + i);
      return `<label class="quiz-choice-label"><input type="radio" name="answer" value="${letter}"> ${letter}) ${choice}</label>`;
    }).join('');
    
    choicesForm.innerHTML = formHtml;
  }
  
  // Update progress bar
  updateProgressBar();
  
  // Reset submit button
  submitLocked = false;
  if (submitBtn) {
    submitBtn.disabled = false;
  }
  
  console.log('Question rendered successfully');
}

function updateProgressBar() {
  const progressBar = document.querySelector('.progress-bar');
  if (!progressBar) return;
  
  const mq = mainQuestions[currentMainIdx];
  if (!mq || !mq.sub_questions) return;
  
  // Clear existing progress bar
  progressBar.innerHTML = '';
  
  // Create progress nodes
  for (let i = 0; i < mq.sub_questions.length; i++) {
    const node = document.createElement('div');
    node.className = 'progress-node';
    progressBar.appendChild(node);
    
    // Add line between nodes (except after the last one)
    if (i < mq.sub_questions.length - 1) {
      const line = document.createElement('div');
      line.className = 'progress-line';
      progressBar.appendChild(line);
    }
  }
  
  // Update node states
  const progressNodes = progressBar.querySelectorAll('.progress-node');
  progressNodes.forEach((node, i) => {
    node.classList.remove('active', 'checked', 'wrong');
    
    if (subQuestionResults[i] === true) {
      node.classList.add('checked');
    } else if (subQuestionResults[i] === false) {
      node.classList.add('wrong');
    }
    
    if (i === currentSubIdx) {
      node.classList.add('active');
    }
  });
}

function updateClockDisplay() {
  if (!clockDisplay) return;
  
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  clockDisplay.textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
}

function startQuizClock() {
  quizStartTimestamp = Date.now();
  elapsedSeconds = 0;
  updateClockDisplay();
  
  quizTimerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - quizStartTimestamp) / 1000);
    updateClockDisplay();
  }, 1000);
  
  subQuestionStartTimestamp = Date.now();
}

function stopQuizClock() {
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
  }
  updateClockDisplay();
}

function showLoadingPopup(show) {
  if (loadingPopup) {
    loadingPopup.classList.toggle('hidden', !show);
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  
  if (submitLocked) return;
  
  console.log('Submit button clicked');
  
  if (!mainQuestions.length) {
    console.log('No questions available');
    return;
  }
  
  const mq = mainQuestions[currentMainIdx];
  const sq = mq.sub_questions[currentSubIdx];
  
  // Check if answer is selected
  const selected = choicesForm?.querySelector('input[type="radio"]:checked');
  if (!selected) {
    alert('Please select an answer!');
    return;
  }
  
  // Lock submit to prevent double submission
  submitLocked = true;
  if (submitBtn) submitBtn.disabled = true;
  
  // Calculate time taken
  let timeTakenSeconds = 0;
  if (subQuestionStartTimestamp) {
    timeTakenSeconds = Math.floor((Date.now() - subQuestionStartTimestamp) / 1000);
  }
  
  // Check answer
  let choices = [];
  if (Array.isArray(sq.choices)) {
    choices = sq.choices;
  } else if (typeof sq.choices === 'string') {
    try {
      choices = JSON.parse(sq.choices);
    } catch (e) {
      choices = [];
    }
  }
  
  const answerIndex = selected.value.charCodeAt(0) - 65;
  const isCorrect = choices[answerIndex] === sq.correct_answer;
  
  console.log('Answer check:', {
    selected: selected.value,
    answerIndex,
    selectedChoice: choices[answerIndex],
    correctAnswer: sq.correct_answer,
    isCorrect
  });
  
  // Record answer in database (if possible)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const studentId = session?.user?.id || null;
    
    const answerRecord = {
      student_id: studentId,
      sub_question_id: sq.id,
      main_question_id: mq.id,
      is_correct: isCorrect,
      time_taken_seconds: timeTakenSeconds,
      difficulty: mq.difficulty
    };
    
    const { error } = await supabase.from('user_answers').insert(answerRecord);
    
    if (error) {
      console.error('Error inserting answer:', error);
    } else {
      console.log('Answer recorded successfully');
    }
  } catch (err) {
    console.error('Failed to record answer:', err);
  }
  
  // Update progress and score
  subQuestionResults[currentSubIdx] = isCorrect;
  if (isCorrect) {
    score++;
  }
  
  // Show feedback
  showAnswerFeedback(choices, answerIndex, sq.correct_answer, isCorrect);
  
  // Wait and move to next question
  setTimeout(() => {
    showLoadingPopup(true);
    setTimeout(() => {
      showLoadingPopup(false);
      moveToNextQuestion();
    }, 1200);
  }, 1000);
}

function showAnswerFeedback(choices, selectedIndex, correctAnswer, isCorrect) {
  const choiceLabels = choicesForm?.querySelectorAll('.quiz-choice-label');
  if (!choiceLabels) return;
  
  choiceLabels.forEach((label, i) => {
    label.classList.remove('correct', 'wrong');
    
    if (i === selectedIndex) {
      label.classList.add(isCorrect ? 'correct' : 'wrong');
    } else if (isCorrect && choices[i] === correctAnswer) {
      label.classList.add('correct');
    }
  });
  
  // Disable further selection
  choicesForm?.querySelectorAll('input[type="radio"]').forEach(input => {
    input.disabled = true;
  });
}

function moveToNextQuestion() {
  const mq = mainQuestions[currentMainIdx];
  
  // Move to next sub-question or main question
  if (currentSubIdx + 1 < mq.sub_questions.length) {
    currentSubIdx++;
  } else {
    currentSubIdx = 0;
    currentMainIdx++;
  }
  
  // Check if quiz is complete
  if (currentMainIdx >= mainQuestions.length) {
    showEndMessage();
  } else {
    // Reset timer for next question
    subQuestionStartTimestamp = Date.now();
    renderCurrentQuestion();
  }
}

function showEndMessage() {
  console.log('Quiz completed!');
  stopQuizClock();
  
  // Calculate final score
  let totalSubQuestions = 0;
  mainQuestions.forEach(mq => {
    if (mq.sub_questions) totalSubQuestions += mq.sub_questions.length;
  });
  
  const finalScore = `${score} / ${totalSubQuestions}`;
  console.log('Final score:', finalScore);
  
  // Redirect to progress page
  window.location.href = 'progress.html';
} 