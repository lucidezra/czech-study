import { useState, useEffect, useCallback, useMemo } from "react";
import ALL_DATA from "./data.js";

// ── Flatten all questions ──────────────────────────────────────────────────
const ALL_CARDS = [];
ALL_DATA.forEach((area, ai) => {
  area.topics.forEach((topic, ti) => {
    topic.questions.forEach((q) => {
      ALL_CARDS.push({
        ...q,
        area: area.area,
        areaEn: area.areaEn,
        areaIdx: ai,
        topic: topic.name,
        topicEn: topic.nameEn,
        topicIdx: ti,
        areaColor: area.color,
      });
    });
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── localStorage persistence ───────────────────────────────────────────────
const STORAGE_KEY = "czech-study-progress";
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveProgress(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// Progress structure: { [questionText]: { correct: number, wrong: number, lastSeen: timestamp } }

// ── Czech vocabulary mini-glossary per question ────────────────────────────
const VOCAB = {
  "svátek": "holiday/celebration", "slaví": "celebrate", "tradice": "tradition",
  "květen": "May", "leden": "January", "únor": "February", "březen": "March",
  "duben": "April", "červen": "June", "červenec": "July", "srpen": "August",
  "září": "September", "říjen": "October", "listopad": "November", "prosinec": "December",
  "jaro": "spring", "léto": "summer", "podzim": "autumn", "zima": "winter",
  "řidič": "driver", "řízení": "driving", "silnice": "road", "chodník": "pavement",
  "kolo": "bicycle", "auto": "car", "tramvaj": "tram", "dálnice": "highway",
  "pojištění": "insurance", "průkaz": "card/licence", "povinnost": "duty/obligation",
  "zákon": "law", "právo": "right/law", "soud": "court", "soudce": "judge",
  "policie": "police", "hasiči": "firefighters", "lékař": "doctor",
  "nemocnice": "hospital", "pojišťovna": "insurance company",
  "škola": "school", "žák": "pupil", "student": "student", "učitel": "teacher",
  "vzdělání": "education", "zkouška": "exam", "ústava": "constitution",
  "prezident": "president", "vláda": "government", "parlament": "parliament",
  "poslanec": "MP/deputy", "senátor": "senator", "ministr": "minister",
  "volby": "elections", "hlasování": "voting", "občan": "citizen",
  "obyvatel": "resident/inhabitant", "cizinec": "foreigner",
  "úřad": "office/authority", "žádost": "application/request",
  "daň": "tax", "příjem": "income", "mzda": "wage/salary",
  "zaměstnanec": "employee", "zaměstnavatel": "employer", "práce": "work/job",
  "smlouva": "contract", "výpověď": "notice/termination",
  "podnikání": "business/enterprise", "živnost": "trade licence",
  "banka": "bank", "koruna": "crown (currency)", "bankovka": "banknote",
  "mince": "coin", "rodina": "family", "manželství": "marriage",
  "rozvod": "divorce", "dítě": "child", "rodný list": "birth certificate",
  "nájem": "rent", "byt": "apartment", "dům": "house",
  "kraj": "region", "obec": "municipality", "město": "city/town",
  "hora": "mountain", "řeka": "river", "jezero": "lake", "les": "forest",
  "příroda": "nature", "park": "park", "krajina": "landscape",
  "obyvatelstvo": "population", "menšina": "minority",
  "kultura": "culture", "umění": "art", "divadlo": "theatre",
  "král": "king", "kníže": "prince/duke", "válka": "war", "bitva": "battle",
  "revoluce": "revolution", "republika": "republic", "stát": "state",
  "století": "century", "dějiny": "history", "osobnost": "personality/figure",
  "spisovatel": "writer", "skladatel": "composer", "malíř": "painter",
  "architekt": "architect", "vědec": "scientist", "vynálezce": "inventor",
  "kostel": "church", "hrad": "castle", "zámek": "chateau",
  "Most": "bridge (also a city)", "Praha": "Prague",
  "Brno": "Brno", "Ostrava": "Ostrava", "Plzeň": "Pilsen",
  "moře": "sea", "sever": "north", "jih": "south", "západ": "west", "východ": "east",
  "hranice": "border", "soused": "neighbour",
  "ochrana": "protection", "životní prostředí": "environment",
  "odpad": "waste", "recyklace": "recycling",
  "důchod": "pension/retirement", "nemocenská": "sick pay",
  "podpora": "benefit/support", "nezaměstnanost": "unemployment",
  "správné": "correct", "nesprávné": "incorrect",
  "patří": "belongs to", "nepatří": "does not belong to",
  "povinný": "mandatory", "dobrovolný": "voluntary",
  "nejvyšší": "highest", "nejnižší": "lowest",
  "kolik": "how many/much", "kdy": "when", "kde": "where", "kdo": "who",
  "jak": "how", "který": "which", "co": "what",
};

function getVocabForQuestion(questionText) {
  const lower = questionText.toLowerCase();
  const matches = [];
  // Check multi-word entries first, then single words
  const entries = Object.entries(VOCAB).sort((a, b) => b[0].length - a[0].length);
  for (const [cz, en] of entries) {
    if (lower.includes(cz.toLowerCase()) && matches.length < 5) {
      matches.push({ cz, en });
    }
  }
  return matches;
}

// ── Theme (light only) ─────────────────────────────────────────────────────
const t = {
  bg: "#f5f3f0",
  card: "#ffffff",
  cardBorder: "#e0dbd5",
  text: "#2c2418",
  textGold: "#3d2e1e",
  textMuted: "#6b5e50",
  textDim: "#9a8d7f",
  btnBg: "#f0ece7",
  btnBorder: "#d5cfc7",
  btnText: "#3d2e1e",
  successBg: "rgba(22,163,74,0.1)",
  successBorder: "#16a34a",
  successText: "#15803d",
  errorBg: "rgba(220,38,38,0.08)",
  errorBorder: "#dc2626",
  errorText: "#b91c1c",
  hintBg: "rgba(234,179,8,0.1)",
  hintBorder: "rgba(202,138,4,0.3)",
  hintText: "#92400e",
  progressBg: "#e5e0da",
  vocabBg: "rgba(79,70,229,0.06)",
  vocabBorder: "rgba(79,70,229,0.15)",
  vocabText: "#4338ca",
};

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("home");
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [progress, setProgress] = useState(loadProgress);

  // Flashcard state
  const [deck, setDeck] = useState([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [unknown, setUnknown] = useState(new Set());
  const [showVocab, setShowVocab] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Quiz state
  const [quizCards, setQuizCards] = useState([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [quizShuffledOptions, setQuizShuffledOptions] = useState([]);

  // Exam sim state
  const [examTimer, setExamTimer] = useState(45 * 60);
  const [examActive, setExamActive] = useState(false);

  // Exam timer
  useEffect(() => {
    if (!examActive || mode !== "exam") return;
    if (examTimer <= 0) { setMode("results"); return; }
    const id = setInterval(() => setExamTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [examActive, mode, examTimer]);

  // Build filtered deck
  const buildDeck = useCallback(() => {
    let cards = ALL_CARDS;
    if (selectedArea !== null) {
      cards = cards.filter((c) => c.areaIdx === selectedArea);
      if (selectedTopic !== null) {
        cards = cards.filter((c) => c.topicIdx === selectedTopic);
      }
    }
    return cards;
  }, [selectedArea, selectedTopic]);

  // Spaced repetition sort: cards you got wrong or haven't seen come first
  const buildSmartDeck = useCallback(() => {
    const cards = buildDeck();
    const scored = cards.map((c) => {
      const p = progress[c.q];
      if (!p) return { card: c, score: 0 }; // never seen = high priority
      const ratio = p.correct / (p.correct + p.wrong || 1);
      const recency = (Date.now() - (p.lastSeen || 0)) / (1000 * 60 * 60 * 24); // days
      return { card: c, score: ratio - recency * 0.05 }; // lower = higher priority
    });
    scored.sort((a, b) => a.score - b.score);
    // Mix: 70% weak cards first, 30% random from the rest
    const weakCount = Math.ceil(scored.length * 0.7);
    const weak = scored.slice(0, weakCount).map((s) => s.card);
    const rest = scored.slice(weakCount).map((s) => s.card);
    return [...shuffle(weak), ...shuffle(rest)];
  }, [buildDeck, progress]);

  const updateProgress = useCallback((questionText, isCorrect) => {
    setProgress((prev) => {
      const entry = prev[questionText] || { correct: 0, wrong: 0, lastSeen: 0 };
      const updated = {
        ...prev,
        [questionText]: {
          correct: entry.correct + (isCorrect ? 1 : 0),
          wrong: entry.wrong + (isCorrect ? 0 : 1),
          lastSeen: Date.now(),
        },
      };
      saveProgress(updated);
      return updated;
    });
  }, []);

  const startFlashcards = () => {
    const d = buildSmartDeck();
    setDeck(d);
    setCardIdx(0);
    setFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setShowVocab(false);
    setMode("flashcard");
  };

  const prepareQuizOptions = useCallback((cards) => {
    return cards.map((card) => shuffle([...card.options]));
  }, []);

  const startQuiz = () => {
    const cards = shuffle(buildDeck()).slice(0, 20);
    setQuizCards(cards);
    setQuizShuffledOptions(prepareQuizOptions(cards));
    setQuizIdx(0);
    setQuizAnswers([]);
    setQuizSelected(null);
    setQuizRevealed(false);
    setShowHint(false);
    setMode("quiz");
  };

  const startExam = () => {
    // Real exam: 30 questions, one per topic
    const examCards = [];
    ALL_DATA.forEach((area) => {
      area.topics.forEach((topic) => {
        const validQs = topic.questions.filter(
          (q) => !q.options.some((o) => o.includes("[image]"))
        );
        if (validQs.length > 0) {
          const pick = validQs[Math.floor(Math.random() * validQs.length)];
          examCards.push({
            ...pick,
            area: area.area,
            areaEn: area.areaEn,
            topic: topic.name,
            topicEn: topic.nameEn,
            areaColor: area.color,
          });
        }
      });
    });
    setQuizCards(examCards);
    setQuizShuffledOptions(prepareQuizOptions(examCards));
    setQuizIdx(0);
    setQuizAnswers([]);
    setQuizSelected(null);
    setQuizRevealed(false);
    setShowHint(false);
    setExamTimer(45 * 60);
    setExamActive(true);
    setMode("exam");
  };

  // Flashcard nav
  const markCard = (isKnown) => {
    const card = deck[cardIdx];
    updateProgress(card.q, isKnown);
    const newSet = isKnown ? new Set([...known, cardIdx]) : new Set([...unknown, cardIdx]);
    if (isKnown) setKnown(newSet); else setUnknown(newSet);
    setTimeout(() => {
      if (cardIdx < deck.length - 1) { setCardIdx(cardIdx + 1); setFlipped(false); setShowVocab(false); }
      else setMode("flashcard_done");
    }, 200);
  };

  const currentCard = deck[cardIdx];
  const currentQuiz = quizCards[quizIdx];
  const currentOptions = quizShuffledOptions[quizIdx] || [];

  const handleQuizAnswer = (opt) => {
    if (quizRevealed) return;
    setQuizSelected(opt);
    setQuizRevealed(true);
    const isCorrect = opt === currentQuiz.correct;
    updateProgress(currentQuiz.q, isCorrect);
    setQuizAnswers((prev) => [...prev, { correct: isCorrect, question: currentQuiz.q, picked: opt, answer: currentQuiz.correct }]);
  };

  const nextQuiz = () => {
    if (quizIdx < quizCards.length - 1) {
      setQuizIdx(quizIdx + 1);
      setQuizSelected(null);
      setQuizRevealed(false);
      setShowHint(false);
    } else {
      setExamActive(false);
      setMode("results");
    }
  };

  const score = quizAnswers.filter((a) => a.correct).length;

  // Topic progress stats
  const topicStats = useMemo(() => {
    const stats = {};
    ALL_DATA.forEach((area) => {
      area.topics.forEach((topic) => {
        let seen = 0, correct = 0, total = topic.questions.length;
        topic.questions.forEach((q) => {
          const p = progress[q.q];
          if (p) { seen++; correct += p.correct; }
        });
        stats[topic.name] = { seen, correct, total, mastery: total > 0 ? seen / total : 0 };
      });
    });
    return stats;
  }, [progress]);

  // Common styles
  const s = {
    app: {
      minHeight: "100vh", background: t.bg,
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      color: t.text, padding: 0, fontSize: "17px", lineHeight: 1.5,
    },
    header: { padding: "28px 24px 0", textAlign: "center" },
    title: {
      fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 700,
      color: t.textGold, margin: "0 0 6px", letterSpacing: "0.02em",
    },
    subtitle: {
      fontSize: "15px", color: t.textMuted, letterSpacing: "0.08em",
      textTransform: "uppercase", margin: "0 0 24px",
    },
    navBtn: (active) => ({
      background: active ? "#3d2e1e" : t.btnBg,
      border: `1px solid ${active ? "#3d2e1e" : t.btnBorder}`,
      color: active ? "#fff" : t.btnText,
      padding: "8px 18px", borderRadius: "20px", cursor: "pointer",
      fontSize: "14px", letterSpacing: "0.04em", transition: "all 0.2s",
      whiteSpace: "nowrap", fontWeight: active ? 600 : 400,
    }),
    actionBtn: (color) => ({
      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      color: "#fff", border: "none", borderRadius: "12px",
      padding: "16px 36px", fontSize: "17px", fontWeight: 600,
      cursor: "pointer", boxShadow: `0 4px 20px ${color}44`,
      transition: "transform 0.15s", minWidth: "150px",
    }),
    backBtn: {
      background: "none", border: "none", color: t.textMuted,
      cursor: "pointer", fontSize: "16px", padding: "4px 8px",
    },
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const ss = secs % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  // ── HOME ─────────────────────────────────────────────────────────────────
  if (mode === "home") {
    const filteredCount = buildDeck().length;
    const totalSeen = Object.keys(progress).length;
    return (
      <div style={s.app}>
        <div style={s.header}>
          <div style={{ fontSize: "44px", lineHeight: 1, marginBottom: "8px" }}>🇨🇿</div>
          <h1 style={s.title}>Czech Citizenship Exam</h1>
          <p style={s.subtitle}>
            {ALL_CARDS.length} Questions · 30 Topics · B1 Level
          </p>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", padding: "0 16px 12px", flexWrap: "wrap" }}>
          <button style={s.navBtn(selectedArea === null)}
            onClick={() => { setSelectedArea(null); setSelectedTopic(null); }}>All Topics</button>
          {ALL_DATA.map((a, i) => (
            <button key={i} style={s.navBtn(selectedArea === i)}
              onClick={() => { setSelectedArea(i); setSelectedTopic(null); }}>
              {a.icon} {a.areaEn}
            </button>
          ))}
        </div>

        {/* Topic sub-filter */}
        {selectedArea !== null && (
          <div style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "0 16px 16px", flexWrap: "wrap" }}>
            <button style={s.navBtn(selectedTopic === null)}
              onClick={() => setSelectedTopic(null)}>All in area</button>
            {ALL_DATA[selectedArea].topics.map((tp, i) => (
              <button key={i} style={s.navBtn(selectedTopic === i)}
                onClick={() => setSelectedTopic(i)}>{tp.nameEn}</button>
            ))}
          </div>
        )}

        {/* Progress dashboard */}
        {totalSeen > 0 && (
          <div style={{ maxWidth: "900px", margin: "0 auto 20px", padding: "0 24px" }}>
            <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: "16px", padding: "16px 20px" }}>
              <div style={{ fontSize: "16px", fontWeight: 600, color: t.textGold, marginBottom: "12px" }}>
                Your Progress
              </div>
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "14px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: t.textGold }}>{totalSeen}</div>
                  <div style={{ fontSize: "13px", color: t.textMuted }}>Questions Seen</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: t.textGold }}>{ALL_CARDS.length - totalSeen}</div>
                  <div style={{ fontSize: "13px", color: t.textMuted }}>Remaining</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: t.successText }}>
                    {Math.round((totalSeen / ALL_CARDS.length) * 100)}%
                  </div>
                  <div style={{ fontSize: "13px", color: t.textMuted }}>Coverage</div>
                </div>
              </div>
              {/* Topic mastery bars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
                {ALL_DATA.map((area) =>
                  area.topics.map((topic) => {
                    const st = topicStats[topic.name];
                    const pct = Math.round(st.mastery * 100);
                    return (
                      <div key={topic.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, fontSize: "13px", color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {topic.nameEn}
                        </div>
                        <div style={{ width: "60px", height: "6px", background: t.progressBg, borderRadius: "3px", overflow: "hidden", flexShrink: 0 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: area.color, borderRadius: "3px", transition: "width 0.3s" }} />
                        </div>
                        <div style={{ fontSize: "12px", color: t.textDim, width: "28px", textAlign: "right" }}>{pct}%</div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ textAlign: "right", marginTop: "8px" }}>
                {!confirmReset ? (
                  <button onClick={() => setConfirmReset(true)}
                    style={{ ...s.backBtn, fontSize: "11px", color: t.errorText }}>Reset progress</button>
                ) : (
                  <span style={{ fontSize: "11px" }}>
                    <span style={{ color: t.errorText, marginRight: "8px" }}>Reset all progress?</span>
                    <button onClick={() => { saveProgress({}); setProgress({}); setConfirmReset(false); }}
                      style={{ ...s.backBtn, fontSize: "11px", color: t.errorText, fontWeight: 700 }}>Yes</button>
                    <button onClick={() => setConfirmReset(false)}
                      style={{ ...s.backBtn, fontSize: "11px", color: t.textMuted }}>No</button>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Area + topic cards */}
        <div style={{ padding: "0 24px 24px", maxWidth: "900px", margin: "0 auto" }}>
          {ALL_DATA.map((area, ai) => {
            if (selectedArea !== null && selectedArea !== ai) return null;
            return (
              <div key={ai} style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "26px" }}>{area.icon}</span>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: t.textGold }}>{area.area}</div>
                    <div style={{ fontSize: "14px", color: t.textMuted }}>
                      {area.areaEn} · {area.topics.reduce((s, tp) => s + tp.questions.length, 0)} questions
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                  {area.topics.map((topic, ti) => {
                    if (selectedTopic !== null && selectedTopic !== ti) return null;
                    const st = topicStats[topic.name];
                    return (
                      <div key={ti} style={{
                        background: t.bg, borderLeft: `3px solid ${area.color}`,
                        borderRadius: "4px", padding: "10px 14px", cursor: "default",
                        userSelect: "none",
                      }}>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: t.text, marginBottom: "2px" }}>{topic.name}</div>
                        <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "4px" }}>{topic.nameEn}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", color: t.textDim }}>
                            {topic.questions.length} questions
                          </span>
                          {st.seen > 0 && (
                            <span style={{ fontSize: "12px", color: t.successText }}>
                              · {st.seen}/{st.total} seen
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "28px", flexWrap: "wrap" }}>
            <button onClick={startFlashcards} style={s.actionBtn("#1a56db")}>📚 Flashcards</button>
            <button onClick={startQuiz} style={s.actionBtn("#7c3aed")}>🎯 Quiz (20)</button>
            <button onClick={startExam} style={s.actionBtn("#9f1239")}>📝 Exam Sim</button>
          </div>
          <p style={{ textAlign: "center", color: t.textDim, fontSize: "14px", marginTop: "12px" }}>
            {filteredCount} cards selected · Quiz uses 20 · Exam simulates real test (30 Qs, 45 min, pass: 20/30)
          </p>
        </div>
      </div>
    );
  }

  // ── FLASHCARD ────────────────────────────────────────────────────────────
  if (mode === "flashcard" && currentCard) {
    const prog = (cardIdx / deck.length) * 100;
    const vocab = getVocabForQuestion(currentCard.q);
    return (
      <div style={{ ...s.app, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
        <div style={{ width: "100%", maxWidth: "600px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <button onClick={() => setMode("home")} style={s.backBtn}>← Back</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "16px", color: t.textMuted }}>{cardIdx + 1} / {deck.length}</div>
              <div style={{ fontSize: "13px", color: t.textDim }}>{currentCard.topicEn}</div>
            </div>
            <div style={{ fontSize: "15px" }}>
              <span style={{ color: t.successText }}>✓{known.size}</span>{" · "}
              <span style={{ color: t.errorText }}>✗{unknown.size}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: "3px", background: t.progressBg, borderRadius: "2px", marginBottom: "20px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${prog}%`, background: `linear-gradient(90deg, ${currentCard.areaColor}, #60a5fa)`, borderRadius: "2px", transition: "width 0.3s" }} />
          </div>

          {/* Card */}
          <div onClick={() => setFlipped(!flipped)} style={{
            minHeight: "220px", borderRadius: "16px", cursor: "pointer",
            background: flipped ? `linear-gradient(135deg, ${currentCard.areaColor}22, ${currentCard.areaColor}08)` : t.card,
            border: `1px solid ${flipped ? currentCard.areaColor + "66" : t.cardBorder}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "28px 24px", textAlign: "center", transition: "all 0.3s",
          }}>
            {!flipped ? (
              <>
                <div style={{ fontSize: "13px", letterSpacing: "0.12em", color: t.textMuted, textTransform: "uppercase", marginBottom: "16px" }}>
                  Question — tap to reveal
                </div>
                <div style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 600, color: t.textGold, lineHeight: 1.45 }}>
                  {currentCard.q}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "13px", letterSpacing: "0.12em", color: currentCard.areaColor, textTransform: "uppercase", marginBottom: "16px" }}>
                  Correct Answer
                </div>
                <div style={{ fontSize: "clamp(20px, 3.5vw, 28px)", fontWeight: 700, color: t.successText, marginBottom: "12px", lineHeight: 1.3 }}>
                  {currentCard.correct}
                </div>
                {/* Show all options */}
                <div style={{ fontSize: "14px", color: t.textMuted, lineHeight: 1.7, marginTop: "4px" }}>
                  {currentCard.options.filter((o) => o !== currentCard.correct).map((o, i) => (
                    <div key={i} style={{ opacity: 0.6 }}>✗ {o}</div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Vocab toggle */}
          {vocab.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <button onClick={(e) => { e.stopPropagation(); setShowVocab(!showVocab); }}
                style={{ ...s.backBtn, fontSize: "14px", color: t.vocabText, width: "100%", textAlign: "center" }}>
                {showVocab ? "Hide vocabulary" : "📖 Show Czech vocabulary"}
              </button>
              {showVocab && (
                <div style={{ background: t.vocabBg, border: `1px solid ${t.vocabBorder}`, borderRadius: "10px", padding: "12px 16px", marginTop: "6px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {vocab.map((v, i) => (
                      <span key={i} style={{ fontSize: "14px", color: t.vocabText }}>
                        <strong>{v.cz}</strong> = {v.en}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          {flipped ? (
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={() => markCard(false)} style={{
                flex: 1, padding: "14px", borderRadius: "10px",
                border: `1px solid ${t.errorBorder}44`, background: t.errorBg,
                color: t.errorText, cursor: "pointer", fontSize: "16px", fontWeight: 600,
              }}>✗ Still learning</button>
              <button onClick={() => markCard(true)} style={{
                flex: 1, padding: "14px", borderRadius: "10px",
                border: `1px solid ${t.successBorder}44`, background: t.successBg,
                color: t.successText, cursor: "pointer", fontSize: "16px", fontWeight: 600,
              }}>✓ Got it!</button>
            </div>
          ) : (
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button onClick={() => setFlipped(true)} style={{
                background: t.btnBg, border: `1px solid ${t.btnBorder}`,
                color: t.btnText, padding: "10px 28px", borderRadius: "10px",
                cursor: "pointer", fontSize: "13px",
              }}>Tap card or click to flip</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── FLASHCARD DONE ───────────────────────────────────────────────────────
  if (mode === "flashcard_done") {
    const pct = deck.length > 0 ? Math.round((known.size / deck.length) * 100) : 0;
    return (
      <div style={{ ...s.app, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "32px 16px", textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🎉</div>
        <h2 style={{ fontSize: "26px", color: t.textGold, marginBottom: "6px" }}>Deck Complete!</h2>
        <p style={{ color: t.textMuted, marginBottom: "8px" }}>
          <span style={{ color: t.successText }}>✓ {known.size} known</span>{" · "}
          <span style={{ color: t.errorText }}>✗ {unknown.size} still learning</span>{" · "}{deck.length} total
        </p>
        {pct > 0 && <p style={{ color: t.textGold, fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>{pct}% mastered</p>}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={startFlashcards} style={s.actionBtn("#1a56db")}>🔄 Reshuffle</button>
          <button onClick={() => setMode("home")} style={{ ...s.actionBtn("#555"), boxShadow: "none" }}>← Home</button>
        </div>
      </div>
    );
  }

  // ── QUIZ / EXAM ──────────────────────────────────────────────────────────
  if ((mode === "quiz" || mode === "exam") && currentQuiz) {
    const isExam = mode === "exam";
    const qProgress = (quizIdx / quizCards.length) * 100;
    const isCorrect = quizSelected === currentQuiz.correct;
    const vocab = getVocabForQuestion(currentQuiz.q);

    return (
      <div style={{ ...s.app, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
        <div style={{ width: "100%", maxWidth: "640px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <button onClick={() => { setExamActive(false); setMode("home"); }} style={s.backBtn}>← Exit</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "16px", color: t.textGold, fontWeight: 600 }}>
                {isExam ? "EXAM" : "QUIZ"} · {quizIdx + 1} / {quizCards.length}
              </div>
              <div style={{ fontSize: "13px", color: t.textMuted }}>{currentQuiz.topicEn || currentQuiz.topic}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "16px", color: t.successText, fontWeight: 600 }}>{score} pts</div>
              {isExam && (
                <div style={{ fontSize: "14px", color: examTimer < 300 ? t.errorText : t.textMuted, fontWeight: examTimer < 300 ? 700 : 400 }}>
                  ⏱ {formatTime(examTimer)}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: "3px", background: t.progressBg, borderRadius: "2px", marginBottom: "20px" }}>
            <div style={{ height: "100%", width: `${qProgress}%`, background: isExam ? "linear-gradient(90deg, #9f1239, #e11d48)" : "linear-gradient(90deg, #7c3aed, #a78bfa)", borderRadius: "2px", transition: "width 0.3s" }} />
          </div>

          {/* Question */}
          <div style={{ background: t.card, borderRadius: "14px", padding: "20px", marginBottom: "12px", border: `1px solid ${t.cardBorder}` }}>
            <div style={{ fontSize: "clamp(17px, 2.5vw, 22px)", color: t.textGold, fontWeight: 600, lineHeight: 1.5 }}>
              {currentQuiz.q}
            </div>
          </div>

          {/* Vocab */}
          {vocab.length > 0 && !quizRevealed && (
            <div style={{ marginBottom: "8px" }}>
              <button onClick={() => setShowVocab(!showVocab)}
                style={{ ...s.backBtn, fontSize: "14px", color: t.vocabText, width: "100%", textAlign: "center" }}>
                {showVocab ? "Hide vocabulary" : "📖 Vocabulary help"}
              </button>
              {showVocab && (
                <div style={{ background: t.vocabBg, border: `1px solid ${t.vocabBorder}`, borderRadius: "10px", padding: "10px 14px", marginTop: "4px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {vocab.map((v, i) => (
                      <span key={i} style={{ fontSize: "14px", color: t.vocabText }}>
                        <strong>{v.cz}</strong> = {v.en}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hint (not in exam mode) */}
          {!isExam && !quizRevealed && (
            <div style={{ textAlign: "right", marginBottom: "6px" }}>
              <button onClick={() => setShowHint(!showHint)}
                style={{ ...s.backBtn, fontSize: "14px", color: t.hintText }}>
                {showHint ? "Hide hint" : "💡 Hint"}
              </button>
            </div>
          )}

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {currentOptions.map((opt, i) => {
              let bg = t.card;
              let border = `1px solid ${t.cardBorder}`;
              let color = t.btnText;
              if (quizRevealed) {
                if (opt === currentQuiz.correct) { bg = t.successBg; border = `1px solid ${t.successBorder}`; color = t.successText; }
                else if (opt === quizSelected) { bg = t.errorBg; border = `1px solid ${t.errorBorder}`; color = t.errorText; }
              }
              return (
                <button key={i} onClick={() => handleQuizAnswer(opt)} disabled={quizRevealed} style={{
                  background: bg, border, color, borderRadius: "10px", padding: "12px 16px",
                  textAlign: "left", cursor: quizRevealed ? "default" : "pointer",
                  fontSize: "clamp(15px, 2vw, 17px)", transition: "all 0.2s", lineHeight: 1.5,
                }}>
                  <span style={{ opacity: 0.4, marginRight: "8px" }}>{String.fromCharCode(65 + i)})</span>
                  {opt}
                  {quizRevealed && opt === currentQuiz.correct && " ✓"}
                  {quizRevealed && opt === quizSelected && opt !== currentQuiz.correct && " ✗"}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {quizRevealed && (
            <div style={{
              background: isCorrect ? t.successBg : t.errorBg,
              border: `1px solid ${isCorrect ? t.successBorder : t.errorBorder}66`,
              borderRadius: "10px", padding: "12px 16px", marginBottom: "12px",
            }}>
              <div style={{ fontWeight: 700, color: isCorrect ? t.successText : t.errorText, marginBottom: "2px", fontSize: "14px" }}>
                {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
              </div>
              {!isCorrect && <div style={{ color: t.text, fontSize: "15px" }}>Correct: <strong>{currentQuiz.correct}</strong></div>}
            </div>
          )}

          {quizRevealed && (
            <button onClick={nextQuiz} style={{
              ...s.actionBtn(isExam ? "#9f1239" : "#7c3aed"), width: "100%",
            }}>
              {quizIdx < quizCards.length - 1 ? "Next Question →" : "See Results"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────
  if (mode === "results") {
    const total = quizCards.length;
    const pct = Math.round((score / total) * 100);
    const isExam = total === 30;
    const passThreshold = isExam ? 20 : Math.ceil(total * 0.67);
    const passed = score >= passThreshold;
    const wrongOnes = quizAnswers.filter((a) => !a.correct);

    return (
      <div style={{ ...s.app, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", textAlign: "center" }}>
        <div style={{ maxWidth: "520px", width: "100%" }}>
          <div style={{ fontSize: "56px", marginBottom: "12px" }}>{pct >= 80 ? "🏆" : pct >= 67 ? "📚" : "💪"}</div>
          <h2 style={{ fontSize: "28px", color: t.textGold, margin: "0 0 4px" }}>{score} / {total}</h2>
          <div style={{ fontSize: "42px", fontWeight: 700, color: passed ? t.successText : t.errorText, marginBottom: "6px" }}>{pct}%</div>
          <p style={{ color: t.textMuted, marginBottom: "20px", fontSize: "14px" }}>
            {passed
              ? (pct >= 80 ? "Excellent! You're exam-ready!" : "Passed! Keep sharpening the weak spots.")
              : `Need ${passThreshold}/${total} to pass. Keep studying!`}
          </p>

          {isExam && (
            <div style={{ background: t.card, borderRadius: "14px", padding: "16px", marginBottom: "20px", border: `1px solid ${t.cardBorder}` }}>
              <div style={{ fontSize: "15px", color: t.textMuted, marginBottom: "8px" }}>
                Real exam pass mark: <strong style={{ color: t.textGold }}>20/30 (67%)</strong>
              </div>
              <div style={{ fontSize: "17px", color: passed ? t.successText : t.errorText, fontWeight: 700 }}>
                {passed ? "You would PASS the real exam!" : "You would not pass yet — review the topics below."}
              </div>
            </div>
          )}

          {/* Wrong answers review */}
          {wrongOnes.length > 0 && (
            <div style={{ background: t.card, borderRadius: "14px", padding: "16px", marginBottom: "20px", border: `1px solid ${t.cardBorder}`, textAlign: "left" }}>
              <div style={{ fontSize: "16px", fontWeight: 600, color: t.errorText, marginBottom: "12px" }}>
                Review incorrect answers ({wrongOnes.length}):
              </div>
              {wrongOnes.map((w, i) => (
                <div key={i} style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: i < wrongOnes.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div style={{ fontSize: "15px", color: t.text, marginBottom: "4px", lineHeight: 1.5 }}>{w.question}</div>
                  <div style={{ fontSize: "14px", color: t.errorText }}>Your answer: {w.picked}</div>
                  <div style={{ fontSize: "14px", color: t.successText }}>Correct: {w.answer}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {isExam && <button onClick={startExam} style={s.actionBtn("#9f1239")}>🔄 Retry Exam</button>}
            {!isExam && <button onClick={startQuiz} style={s.actionBtn("#7c3aed")}>🔄 New Quiz</button>}
            <button onClick={startFlashcards} style={s.actionBtn("#1a56db")}>📚 Flashcards</button>
            <button onClick={() => setMode("home")} style={{ ...s.actionBtn("#555"), boxShadow: "none" }}>← Home</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
