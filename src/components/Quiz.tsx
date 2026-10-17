"use client";
import Image from "next/image";
import { useState } from "react";
import { photo, type MenuItem } from "@/lib/menu";
import { rupees } from "@/lib/pricing";
import { useStore } from "./Store";
import Reveal from "./Reveal";

const QUESTIONS = [
  {
    q: "How are you feeling today?",
    key: "energy",
    options: [
      { emoji: "😴", label: "Need to wake up", value: 2 },
      { emoji: "🙂", label: "Somewhere in between", value: 1 },
      { emoji: "🧸", label: "Cosy & calm", value: 0 },
    ],
  },
  {
    q: "Hot or iced?",
    key: "temp",
    options: [
      { emoji: "♨️", label: "Warm hug in a mug", value: "hot" },
      { emoji: "🧊", label: "Iced, always", value: "iced" },
    ],
  },
  {
    q: "How's your sweet tooth?",
    key: "sweet",
    options: [
      { emoji: "🖤", label: "Keep it bold", value: 0 },
      { emoji: "🍯", label: "A little sweet", value: 1 },
      { emoji: "🍰", label: "Dessert in a cup", value: 2 },
    ],
  },
] as const;

type Answers = { energy?: number; temp?: string; sweet?: number };

function bestMatch(a: Answers, menu: MenuItem[]): MenuItem | null {
  const drinks = menu.filter((m) => m.traits && !m.soldOut);
  if (!drinks.length) return null;
  const score = (m: MenuItem) =>
    Math.abs(m.traits!.energy - (a.energy ?? 1)) * 1.2 + Math.abs(m.traits!.sweet - (a.sweet ?? 1)) + (m.traits!.temp === a.temp ? 0 : 2.5) + Math.random() * 0.4;
  return drinks.sort((x, y) => score(x) - score(y))[0];
}

export default function Quiz() {
  const { menu, setCustomizing, soldOut, t } = useStore();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<MenuItem | null>(null);

  function answer(key: string, value: string | number) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step + 1 < QUESTIONS.length) setStep(step + 1);
    else setResult(bestMatch(next, menu));
  }

  const reset = () => { setStep(0); setAnswers({}); setResult(null); };
  const Q = QUESTIONS[step];

  return (
    <Reveal id="quiz" className="section">
      <div className="center">
        <p className="eyebrow">{t("quiz.eyebrow")}</p>
        <h2>{t("quiz.title1")} <em>{t("quiz.title2")}</em></h2>
        <p className="lead">{t("quiz.lead")}</p>
      </div>
      <div className="quiz card">
        {!result ? (
          <>
            <div className="quiz-progress">
              {QUESTIONS.map((_, i) => <span key={i} className={i <= step ? "done" : ""} />)}
            </div>
            <h3 style={{ fontSize: "2rem" }}>{Q.q}</h3>
            <div className="quiz-options">
              {Q.options.map((o) => (
                <button key={o.label} className="quiz-opt" onClick={() => answer(Q.key, o.value)}>
                  <span className="emoji">{o.emoji}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="quiz-result">
            <div className="ph"><Image src={photo(result.img, 400)} alt={result.name} fill sizes="180px" /></div>
            <div>
              <p className="eyebrow">your match</p>
              <h3 style={{ fontSize: "2.2rem" }}>{result.name}</h3>
              <p className="muted" style={{ margin: "0.4rem 0 1rem" }}>{result.desc} · {rupees(result.price)}</p>
              <div className="row" style={{ justifyContent: "inherit" }}>
                <button className="btn btn-pink" disabled={soldOut.has(result.id)} onClick={() => setCustomizing(result)}>
                  {soldOut.has(result.id) ? "Sold out today" : "Make it mine"}
                </button>
                <button className="btn btn-ghost" onClick={reset}>Try again</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Reveal>
  );
}
