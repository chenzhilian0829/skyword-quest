import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft, BookOpenCheck, Check, ChevronRight, Gift, Home,
  LockKeyhole, Mic, RotateCcw, Star, Trophy, Volume2, X
} from 'lucide-react';
import { QUESTIONS } from './data/questions.js';
import './styles.css';
import './enhancements.css';
import './scene-backgrounds.css';
import './quiz-characters.css';

const STORAGE_KEY = 'skyword-quest-v1';
const INITIAL_STATE = { points: 0, unlockedLevel: 1, completed: {}, wrongIds: [], claimed: [] };
const MAX_HEALTH = 5;
const LEVEL_COUNT = 60;
const QUIZ_CHARACTERS = Array.from({ length: 15 }, (_, index) => `./assets/characters/character-${String(index + 1).padStart(2, '0')}.webp`);

function loadProgress() {
  try { return { ...INITIAL_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return INITIAL_STATE; }
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeQuizOptions(question) {
  const isPhrase = /[\s,.!?']/u.test(question.word);
  const meaningLength = question.meaning.replace(/[，。！？…\s]/gu, '').length;
  const candidates = QUESTIONS
    .filter((item) => item.id !== question.id && item.meaning !== question.meaning)
    .map((item) => {
      const candidateIsPhrase = /[\s,.!?']/u.test(item.word);
      const candidateLength = item.meaning.replace(/[，。！？…\s]/gu, '').length;
      const nearbyScore = Math.min(Math.abs(item.id - question.id), 40) * 0.7;
      const formatScore = candidateIsPhrase === isPhrase ? 0 : 28;
      const lengthScore = Math.abs(candidateLength - meaningLength) * 2.4;
      return { item, score: nearbyScore + formatScore + lengthScore + Math.random() * 8 };
    })
    .sort((a, b) => a.score - b.score);

  const distractors = [];
  for (const { item } of candidates) {
    if (!distractors.includes(item.meaning)) distractors.push(item.meaning);
    if (distractors.length === 3) break;
  }
  return shuffle([question.meaning, ...distractors]);
}

function playClick(tone = 'tap') {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = playClick.ctx || (playClick.ctx = new AudioContext());
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  oscillator.type = tone === 'success' ? 'sine' : tone === 'error' ? 'square' : 'triangle';
  oscillator.frequency.setValueAtTime(tone === 'success' ? 660 : tone === 'error' ? 180 : 360, now);
  if (tone === 'success') oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.1);
  gain.gain.setValueAtTime(0.055, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.13);
}

function audioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const ctx = playClick.ctx || (playClick.ctx = new AudioContext());
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playCorrectSound() {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + index * 0.075;
    oscillator.type = index < 4 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.075, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.21);
  });
}

function playErrorSound() {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(155, now);
  oscillator.frequency.exponentialRampToValueAtTime(92, now + 0.7);
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  oscillator.connect(filter).connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.82);
}

function speak(word) {
  playClick();
  pronounce(word, 1);
}

function pronounce(word, times = 1) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((item) => item.lang === 'en-US') || voices.find((item) => item.lang.startsWith('en')) || null;
  for (let index = 0; index < times; index += 1) {
    const speech = new SpeechSynthesisUtterance(word.replace(/=.*/, '').trim());
    speech.lang = 'en-US';
    speech.rate = 0.546;
    speech.pitch = 1;
    speech.voice = voice;
    window.speechSynthesis.speak(speech);
  }
}

function rewardFor(wrong) {
  if (wrong === 0) return 50;
  if (wrong <= 2) return 30;
  if (wrong <= 5) return 10;
  return 0;
}

function normalizeSpeech(text) {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = left[row - 1] === right[column - 1]
        ? diagonal
        : Math.min(diagonal, above, previous[column - 1]) + 1;
      diagonal = above;
    }
  }
  return previous[right.length];
}

function scorePronunciation(expectedText, spokenText) {
  const expected = normalizeSpeech(expectedText.replace(/=.*/, ''));
  const spoken = normalizeSpeech(spokenText);
  if (!expected || !spoken) return { stars: 0, similarity: 0 };
  const characterSimilarity = 1 - editDistance(expected, spoken) / Math.max(expected.length, spoken.length);
  const expectedWords = expected.split(' ');
  const spokenWords = spoken.split(' ');
  const wordSimilarity = 1 - editDistance(expectedWords, spokenWords) / Math.max(expectedWords.length, spokenWords.length);
  const similarity = Math.max(0, characterSimilarity * 0.55 + wordSimilarity * 0.45);
  const stars = similarity >= 0.84 ? 3 : similarity >= 0.62 ? 2 : similarity >= 0.36 ? 1 : 0;
  return { stars, similarity };
}

function App() {
  const [view, setView] = useState('home');
  const [progress, setProgress] = useState(loadProgress);
  const [activeLevel, setActiveLevel] = useState(null);
  const [session, setSession] = useState(null);
  const [rewardModal, setRewardModal] = useState(null);
  const autoAdvanceTimer = useRef(null);
  const pronunciationTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => () => {
    clearTimeout(autoAdvanceTimer.current);
    clearTimeout(pronunciationTimer.current);
    window.speechSynthesis?.cancel();
  }, []);

  function schedulePronunciation(word) {
    clearTimeout(pronunciationTimer.current);
    window.speechSynthesis?.cancel();
    pronunciationTimer.current = setTimeout(() => pronounce(word, 2), 1000);
  }

  const wrongQuestions = useMemo(
    () => progress.wrongIds.map((id) => QUESTIONS.find((q) => q.id === id)).filter(Boolean),
    [progress.wrongIds]
  );

  function go(next) { playClick(); setView(next); }

  function applyReadingScore(stars) {
    setProgress((current) => ({ ...current, points: current.points + stars }));
  }

  function startLevel(level) {
    if (level > progress.unlockedLevel) { playClick('error'); return; }
    const questions = shuffle(QUESTIONS).slice(0, 20);
    setActiveLevel(level);
    setSession({ questions, index: 0, answers: [], selected: null, readingConfirmed: false, health: MAX_HEALTH, options: makeOptions(questions[0]), characters: makeCharacters() });
    setView('quiz');
    schedulePronunciation(questions[0].word);
    playClick('success');
  }

  function makeOptions(question) {
    return makeQuizOptions(question);
  }

  function makeCharacters() {
    return shuffle(QUIZ_CHARACTERS).slice(0, 4);
  }

  function answer(option) {
    if (session.selected !== null) return;
    const current = session.questions[session.index];
    const correct = option === current.meaning;
    const answers = [...session.answers, { id: current.id, correct }];
    const health = correct || view === 'review' ? session.health : Math.max(0, session.health - 1);
    correct ? playCorrectSound() : playErrorSound();
    setSession({ ...session, selected: option, answers, health });
    if (correct && session.readingConfirmed) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => advanceQuestion(answers, true), 800);
    } else if (health === 0 && view !== 'review') {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => {
        setSession((currentSession) => ({ ...currentSession, result: { failed: true, score: answers.filter((item) => item.correct).length, wrong: answers.filter((item) => !item.correct).length, reward: 0 } }));
      }, 900);
    }
  }

  function resetReadingConfirmation() {
    setSession((current) => current ? { ...current, readingConfirmed: false } : current);
  }

  function confirmReading(stars) {
    if (!session) return;
    applyReadingScore(stars);
    const currentQuestion = session.questions[session.index];
    const shouldAdvance = session.selected === currentQuestion.meaning;
    const answers = session.answers;
    setSession((current) => ({ ...current, readingConfirmed: true }));
    if (shouldAdvance) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => advanceQuestion(answers, true), 800);
    }
  }

  function advanceQuestion(answers = session.answers, silent = false) {
    if (!silent) playClick();
    if (session.index < session.questions.length - 1) {
      const index = session.index + 1;
      setSession((currentSession) => ({ ...currentSession, answers, index, selected: null, readingConfirmed: false, options: makeOptions(currentSession.questions[index]), characters: makeCharacters() }));
      schedulePronunciation(session.questions[index].word);
      return;
    }
    if (view === 'review') {
      const correctIds = answers.filter((item) => item.correct).map((item) => item.id);
      setProgress({ ...progress, wrongIds: progress.wrongIds.filter((id) => !correctIds.includes(id)) });
      const wrong = answers.filter((item) => !item.correct).length;
      setSession((currentSession) => ({ ...currentSession, answers, result: { score: answers.length - wrong, wrong, reward: 0 } }));
    } else {
      finishLevel(answers);
    }
  }

  function finishLevel(answers) {
    const wrongAnswers = answers.filter((item) => !item.correct);
    const score = answers.length - wrongAnswers.length;
    const reward = rewardFor(wrongAnswers.length);
    const nextPoints = progress.points + reward;
    const newWrong = new Set(progress.wrongIds);
    answers.filter((item) => item.correct).forEach((item) => newWrong.delete(item.id));
    wrongAnswers.forEach((item) => newWrong.add(item.id));
    const newlyClaimed = [];
    [500, 2000].forEach((threshold) => {
      if (nextPoints >= threshold && !progress.claimed.includes(threshold)) newlyClaimed.push(threshold);
    });
    setProgress({
      ...progress,
      points: nextPoints,
      unlockedLevel: Math.max(progress.unlockedLevel, Math.min(LEVEL_COUNT, activeLevel + 1)),
      completed: { ...progress.completed, [activeLevel]: Math.max(progress.completed[activeLevel] || 0, score) },
      wrongIds: [...newWrong],
      claimed: [...progress.claimed, ...newlyClaimed]
    });
    setSession({ ...session, result: { score, wrong: wrongAnswers.length, reward } });
    if (newlyClaimed.length) setRewardModal(newlyClaimed.at(-1));
  }

  return (
    <main className="app-shell">
      <SkyScene />
      <TopBar points={progress.points} view={view} onHome={() => go('home')} />
      <section className="content">
        {view === 'home' && <HomeView progress={progress} onNavigate={go} />}
        {view === 'levels' && <Levels progress={progress} onStart={startLevel} />}
        {view === 'wrong' && <WrongBook questions={wrongQuestions} onReview={() => wrongQuestions.length && startReview(wrongQuestions, setSession, setView)} />}
        {view === 'rewards' && <Rewards points={progress.points} claimed={progress.claimed} />}
        {view === 'quiz' && session && <Quiz session={session} level={activeLevel} onAnswer={answer} onNext={() => advanceQuestion()} onSpeak={speak} onReadingStart={resetReadingConfirmation} onReadingConfirm={confirmReading} onExit={() => go('levels')} onRestart={() => startLevel(activeLevel)} />}
        {view === 'review' && session && <Quiz session={session} level="错题复习" onAnswer={answer} onNext={() => advanceQuestion()} onSpeak={speak} onReadingStart={resetReadingConfirmation} onReadingConfirm={confirmReading} onExit={() => go('wrong')} review />}
      </section>
      {rewardModal && <RewardModal threshold={rewardModal} onClose={() => { playClick('success'); setRewardModal(null); }} />}
    </main>
  );
}

function startReview(questions, setSession, setView) {
  playClick('success');
  const shuffled = shuffle(questions);
  setSession({ questions: shuffled, index: 0, answers: [], selected: null, readingConfirmed: false, health: MAX_HEALTH, options: makeReviewOptions(shuffled[0], questions), characters: shuffle(QUIZ_CHARACTERS).slice(0, 4) });
  setView('review');
}

function makeReviewOptions(question) {
  return makeQuizOptions(question);
}

function SkyScene() {
  return <div className="sky" aria-hidden="true"><div className="cloud c1"/><div className="cloud c2"/><div className="island"><div className="path"/><div className="portal">A</div></div></div>;
}

function TopBar({ points, view, onHome }) {
  return <header className="topbar">
    <button className="icon-btn" onClick={onHome} aria-label="返回首页"><Home size={22}/></button>
    <div className="brand"><span className="brand-cube">A</span><span>天空单词闯关</span></div>
    <div className="points"><Star size={19} fill="currentColor"/><strong>{points}</strong></div>
  </header>;
}

function HomeView({ progress, onNavigate }) {
  const completed = Object.keys(progress.completed).length;
  return <div className="home-view">
    <div className="hero-copy">
      <p>WORD ADVENTURE</p><h1>踏上天空之路<br/>征服每一个单词</h1>
      <div className="progress-line"><span style={{ width: `${(completed / LEVEL_COUNT) * 100}%` }}/></div>
      <small>已完成 {completed} / {LEVEL_COUNT} 关</small>
    </div>
    <nav className="portal-grid">
      <button className="portal-card challenge" onClick={() => onNavigate('levels')}><Trophy/><span><strong>闯关挑战</strong><small>{LEVEL_COUNT} 个天空关卡</small></span><ChevronRight/></button>
      <button className="portal-card" onClick={() => onNavigate('wrong')}><BookOpenCheck/><span><strong>错题集</strong><small>{progress.wrongIds.length} 个待掌握单词</small></span><ChevronRight/></button>
      <button className="portal-card" onClick={() => onNavigate('rewards')}><Gift/><span><strong>奖励机制</strong><small>累计积分解锁奖励</small></span><ChevronRight/></button>
    </nav>
  </div>;
}

function Levels({ progress, onStart }) {
  return <div className="panel levels-panel"><header><p>CHOOSE YOUR PATH</p><h2>选择关卡</h2><span>每关 20 题，完成当前关卡后解锁下一关</span></header>
    <div className="level-grid">{Array.from({ length: LEVEL_COUNT }, (_, index) => {
      const level = index + 1; const locked = level > progress.unlockedLevel; const score = progress.completed[level];
      return <button key={level} className={`level-tile ${locked ? 'locked' : ''} ${score !== undefined ? 'done' : ''}`} onClick={() => onStart(level)}>
        {locked ? <LockKeyhole/> : <span className={`pixel-avatar avatar-${(index % 8) + 1}`}><i/><b/></span>}
        <strong>第 {level} 关</strong><small>{score !== undefined ? `${score} / 20` : locked ? '尚未解锁' : '开始挑战'}</small>
      </button>;
    })}</div>
  </div>;
}

function Quiz({ session, level, onAnswer, onNext, onSpeak, onReadingStart, onReadingConfirm, onExit, onRestart, review }) {
  if (session.result) return <Result result={session.result} onExit={onExit} onRestart={onRestart} review={review}/>;
  const current = session.questions[session.index];
  const sceneClass = typeof level === 'number' ? `scene-${((level - 1) % 16) + 1}` : 'scene-review';
  return <div className={`quiz-panel panel ${sceneClass}`}>
    <div className="word-tools">
      <button className="word-button" onClick={() => onSpeak(current.word)}><span>{current.word}</span><Volume2/></button>
      <FollowRead key={current.id} word={current.word} confirmed={session.readingConfirmed} onStart={onReadingStart} onConfirm={onReadingConfirm}/>
    </div>
    <div className="options">{session.options.map((option, index) => {
      const chosen = session.selected === option; const correct = option === current.meaning; const revealed = session.selected !== null;
      return <button key={option} className={`character-option ${chosen ? 'chosen' : ''} ${revealed && correct ? 'correct' : ''} ${chosen && !correct ? 'incorrect' : ''}`} onClick={() => onAnswer(option)}><span className="option-letter">{String.fromCharCode(65 + index)}</span><PixelCharacter type={session.characters?.[index] || 'steve'} defeated={revealed && correct}/><strong className="option-meaning">{option}</strong>{revealed && correct && <Check className="answer-mark"/>}{chosen && !correct && <X className="answer-mark"/>}</button>;
    })}</div>
    {session.selected !== null && session.selected !== current.meaning && <button className="primary-btn" onClick={onNext}>{session.index === session.questions.length - 1 ? '查看结果' : '下一题'}<ChevronRight/></button>}
    {session.selected === current.meaning && !session.readingConfirmed && <div className="reading-gate-tip"><Mic/>答案正确，请完成跟读并确认成绩</div>}
    <div className="question-counter">第 {session.index + 1} 题 / 共 {session.questions.length} 题</div>
  </div>;
}

function FollowRead({ word, confirmed, onStart, onConfirm }) {
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const errorRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  async function startReading() {
    playClick();
    if (status === 'listening') {
      recognitionRef.current?.stop();
      setStatus('scoring');
      return;
    }
    if (!Recognition) {
      setResult({ error: '当前浏览器不支持语音评分，请使用 iPad Safari 或最新版 Chrome。' });
      return;
    }
    try {
      onStart();
      window.speechSynthesis?.cancel();
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      transcriptRef.current = '';
      errorRef.current = null;
      recognition.onstart = () => setStatus('listening');
      recognition.onresult = (event) => {
        let transcript = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          transcript += `${event.results[index][0].transcript} `;
        }
        transcriptRef.current = transcript.trim();
      };
      recognition.onerror = (event) => {
        errorRef.current = event.error;
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
          setResult({ error: '无法使用麦克风，请在浏览器设置中允许此网页访问麦克风。' });
        }
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setStatus('idle');
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(errorRef.current)) return;
        const scored = scorePronunciation(word, transcriptRef.current);
        setResult({ ...scored, transcript: transcriptRef.current || '未识别到语音' });
        scored.stars >= 2 ? playCorrectSound() : playErrorSound();
      };
      recognitionRef.current = recognition;
      setResult(null);
      setStatus('starting');
      recognition.start();
    } catch (error) {
      setStatus('idle');
      setResult({ error: error?.name === 'NotAllowedError' ? '麦克风权限未开启，请允许后再试。' : '麦克风启动失败，请检查设备设置后重试。' });
    }
  }

  return <div className="follow-read">
    <button className={`follow-button ${status === 'listening' ? 'recording' : ''}`} onClick={startReading} disabled={status === 'starting' || status === 'scoring'}>
      <Mic/>{status === 'listening' ? '结束评分' : status === 'starting' ? '正在启动…' : status === 'scoring' ? '正在评分…' : '跟读'}
    </button>
    {status === 'listening' && <span className="listening-tip"><i/>正在录音，读完后稍等或点击结束</span>}
    {result?.error && <span className="reading-error">{result.error}</span>}
    <span className="reading-stars" aria-label={`${result?.stars || 0} 星`}>{Array.from({ length: 3 }, (_, index) => <Star key={index} fill={result && index < result.stars ? 'currentColor' : 'none'}/>)}</span>
    <button className="confirm-reading" onClick={() => { playClick('success'); onConfirm(result.stars); }} disabled={!result || result.error || confirmed}>提交</button>
  </div>;
}

function PixelCharacter({ type, defeated }) {
  return <span className={`quiz-character ${defeated ? 'defeated' : ''}`} aria-hidden="true"><img src={type} alt="" draggable="false"/></span>;
}

function Result({ result, onExit, onRestart, review }) {
  if (result.failed) return <div className="panel result failure-result"><div className="trophy"><X/></div><p>GAME OVER</p><h2>本关失败</h2><span>5 颗爱心已经用完，重新挑战会恢复全部血量。</span><button className="primary-btn" onClick={onRestart}><RotateCcw/>重新挑战</button><button className="text-btn" onClick={onExit}>返回关卡</button></div>;
  return <div className="panel result"><div className="trophy"><Trophy/></div><p>{review ? 'REVIEW COMPLETE' : 'LEVEL COMPLETE'}</p><h2>{result.score} / {result.score + result.wrong}</h2><span>答对 {result.score} 题 · 答错 {result.wrong} 题</span>{!review && <div className="reward-earned"><Star fill="currentColor"/>本关获得 {result.reward} 积分</div>}<button className="primary-btn" onClick={onExit}>返回关卡<ChevronRight/></button></div>;
}

function WrongBook({ questions, onReview }) {
  return <div className="panel wrong-panel"><header><p>MISTAKE NOTEBOOK</p><h2>错题集</h2><span>点按单词即可听标准英语发音</span></header>{questions.length === 0 ? <div className="empty"><BookOpenCheck/><h3>这里还是空的</h3><p>答错的单词会自动收录，答对后自动移除。</p></div> : <><div className="word-list">{questions.map((q) => <button key={q.id} onClick={() => speak(q.word)}><span><strong>{q.word}</strong><small>{q.meaning}</small></span><Volume2/></button>)}</div><button className="primary-btn sticky" onClick={onReview}><RotateCcw/>复习全部错题</button></>}</div>;
}

function Rewards({ points, claimed }) {
  const rewards = [{ value: 500, title: '玩电脑一次' }, { value: 2000, title: '去游乐场游玩一次' }];
  return <div className="panel rewards-panel"><header><p>YOUR TREASURE</p><h2>奖励机制</h2><span>认真闯关，积攒属于你的星星</span></header><div className="big-score"><Star fill="currentColor"/><strong>{points}</strong><span>累计积分</span></div><div className="rules"><span>全对 <b>+50</b></span><span>错 1–2 题 <b>+30</b></span><span>错 3–5 题 <b>+10</b></span><span>错 5 题以上 <b>+0</b></span><span>跟读 0 星 <b>+0</b></span><span>跟读 1 星 <b>+1</b></span><span>跟读 2 星 <b>+2</b></span><span>跟读 3 星 <b>+3</b></span></div>{rewards.map((reward) => <div className={`reward-row ${claimed.includes(reward.value) ? 'claimed' : ''}`} key={reward.value}><Gift/><span><strong>{reward.title}</strong><small>{claimed.includes(reward.value) ? '奖励已解锁' : `还差 ${Math.max(0, reward.value - points)} 积分`}</small></span><b>{reward.value}</b></div>)}</div>;
}

function RewardModal({ threshold, onClose }) {
  return <div className="modal-backdrop"><div className="reward-modal"><Gift/><p>REWARD UNLOCKED</p><h2>太棒了！</h2><span>{threshold === 500 ? '你获得了玩电脑一次的奖励' : '你获得了去游乐场游玩一次的奖励'}</span><button className="primary-btn" onClick={onClose}>收下奖励<Star fill="currentColor"/></button></div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
