'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  BrainCircuit, Trophy, RotateCcw, Plus, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, BookOpen,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard'
type QuizType = 'multiple_choice' | 'true_false' | 'short_answer' | 'mixed'

interface QuizQuestion {
  id: number
  type: 'multiple_choice' | 'true_false' | 'short_answer'
  question: string
  options?: string[]
  answer: string
  explanation: string
}

interface Quiz {
  id: string
  settings: { count: number; difficulty: Difficulty; type: QuizType }
  questions: QuizQuestion[]
  created_at: string
  quiz_results?: { score: number; total: number; completed_at: string }[]
}

interface AnswerRecord {
  userAnswer: string
  correct: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
}

const TYPE_LABELS: Record<QuizType, string> = {
  multiple_choice: '객관식',
  true_false: 'O/X',
  short_answer: '단답형',
  mixed: '혼합',
}

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  medium: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  hard: 'text-red-600 bg-red-100 dark:bg-red-900/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function isCorrect(question: QuizQuestion, userAnswer: string): boolean {
  if (question.type === 'short_answer') return false // self-graded
  const a = question.answer.trim().toLowerCase()
  const b = userAnswer.trim().toLowerCase()
  return a === b
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function OptionButton({
  label, selected, correct, wrong, disabled, onClick,
}: {
  label: string
  selected: boolean
  correct: boolean
  wrong: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-4 py-3 rounded-lg border text-sm transition-all',
        'disabled:cursor-not-allowed',
        correct && 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        wrong && 'bg-red-50 border-red-400 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        !correct && !wrong && selected && 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/30',
        !correct && !wrong && !selected && !disabled && 'border-border hover:border-indigo-300 hover:bg-muted/50',
        !correct && !wrong && !selected && disabled && 'border-border opacity-50',
      )}
    >
      <span className="flex items-center gap-2">
        {correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
        {wrong && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
        {label}
      </span>
    </button>
  )
}

// ─── History item ─────────────────────────────────────────────────────────────

function HistoryItem({ quiz, onPlay }: { quiz: Quiz; onPlay: (quiz: Quiz) => void }) {
  const lastResult = quiz.quiz_results?.[0]
  const pct = lastResult ? Math.round((lastResult.score / lastResult.total) * 100) : null

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card text-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
        <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{quiz.settings.count}문제</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', DIFFICULTY_COLORS[quiz.settings.difficulty])}>
            {DIFFICULTY_LABELS[quiz.settings.difficulty]}
          </span>
          <span className="text-xs text-muted-foreground">{TYPE_LABELS[quiz.settings.type]}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(quiz.created_at)}
          {pct !== null && (
            <span className={cn('ml-2 font-semibold', pct >= 70 ? 'text-green-600' : 'text-red-500')}>
              {lastResult!.score}/{lastResult!.total} ({pct}%)
            </span>
          )}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => onPlay(quiz)}>
        다시 풀기
      </Button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  documentId: string
  disabled: boolean
}

type View = 'settings' | 'playing' | 'results'

export function QuizTab({ documentId, disabled }: Props) {
  // Settings
  const [quizCount, setQuizCount] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [quizType, setQuizType] = useState<QuizType>('mixed')
  const [generating, setGenerating] = useState(false)

  // Quiz state
  const [view, setView] = useState<View>('settings')
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerRecord>>({})
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [shortInput, setShortInput] = useState('')
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const [selfGradeVisible, setSelfGradeVisible] = useState(false)

  // History
  const [history, setHistory] = useState<Quiz[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  // Results UI
  const [expandedWrong, setExpandedWrong] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (disabled) return
    setHistoryLoading(true)
    fetch(`/api/documents/${documentId}/quiz`)
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [documentId, disabled])

  // ── Generate ──────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: quizCount, difficulty, type: quizType }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || '퀴즈 생성에 실패했습니다.')
      }
      const quiz: Quiz = await res.json()
      setHistory(prev => [quiz, ...prev])
      startQuiz(quiz)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '퀴즈 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Play ──────────────────────────────────────────────────────────────────

  function startQuiz(quiz: Quiz) {
    setCurrentQuiz(quiz)
    setCurrentIdx(0)
    setAnswers({})
    setSelectedOption(null)
    setShortInput('')
    setFeedbackVisible(false)
    setSelfGradeVisible(false)
    setView('playing')
  }

  const currentQuestion = currentQuiz?.questions[currentIdx] ?? null

  function handleSelectOption(option: string) {
    if (feedbackVisible || !currentQuestion) return
    setSelectedOption(option)
    const correct = isCorrect(currentQuestion, option)
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: { userAnswer: option, correct } }))
    setFeedbackVisible(true)
  }

  function handleSubmitShort() {
    if (!currentQuestion || feedbackVisible) return
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: { userAnswer: shortInput, correct: false } }))
    setFeedbackVisible(true)
    setSelfGradeVisible(true)
  }

  function handleSelfGrade(correct: boolean) {
    if (!currentQuestion) return
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: { ...prev[currentQuestion.id], correct },
    }))
    setSelfGradeVisible(false)
    setFeedbackVisible(true) // keep feedback visible, just hide self-grade buttons
  }

  function handleNext() {
    if (!currentQuiz) return
    if (currentIdx + 1 >= currentQuiz.questions.length) {
      finishQuiz()
    } else {
      setCurrentIdx(i => i + 1)
      setSelectedOption(null)
      setShortInput('')
      setFeedbackVisible(false)
      setSelfGradeVisible(false)
    }
  }

  async function finishQuiz() {
    if (!currentQuiz) return
    const score = Object.values(answers).filter(a => a.correct).length
    const total = currentQuiz.questions.length

    // Save result
    try {
      await fetch(`/api/documents/${documentId}/quiz/${currentQuiz.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, total, answers }),
      })
      // Refresh history to include new result
      const refreshed = await fetch(`/api/documents/${documentId}/quiz`).then(r => r.json())
      if (Array.isArray(refreshed)) setHistory(refreshed)
    } catch {
      // Non-critical — show results anyway
    }
    setExpandedWrong(new Set())
    setView('results')
  }

  // ─── Render: Settings ─────────────────────────────────────────────────────

  if (view === 'settings') {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        {/* Intro */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
            <BrainCircuit className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">퀴즈 생성</p>
            <p className="text-xs text-muted-foreground">문서 내용을 바탕으로 AI가 퀴즈를 출제합니다</p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-5 max-w-lg">
          {/* Count */}
          <div>
            <p className="text-sm font-medium mb-2">문제 수</p>
            <div className="flex gap-2">
              {([5, 10, 15, 20] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setQuizCount(n)}
                  className={cn(
                    'px-4 py-1.5 text-sm rounded-lg border font-medium transition-colors',
                    quizCount === n
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                  )}
                >
                  {n}개
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-sm font-medium mb-2">난이도</p>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'px-4 py-1.5 text-sm rounded-lg border font-medium transition-colors',
                    difficulty === d
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                  )}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-sm font-medium mb-2">문제 유형</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['multiple_choice', '객관식 (4지선다)'],
                ['true_false', 'O/X (참/거짓)'],
                ['short_answer', '단답형'],
                ['mixed', '혼합 (랜덤 조합)'],
              ] as [QuizType, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setQuizType(value)}
                  className={cn(
                    'px-4 py-2 text-sm rounded-lg border font-medium transition-colors text-left',
                    quizType === value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="bg-indigo-600 hover:bg-indigo-700 gap-2 w-full sm:w-auto"
            onClick={handleGenerate}
            disabled={generating || disabled}
          >
            {generating
              ? <><LoadingSpinner className="h-4 w-4" /> AI가 퀴즈를 생성하고 있습니다...</>
              : <><BrainCircuit className="h-4 w-4" /> 퀴즈 생성</>}
          </Button>
        </div>

        {/* History */}
        {!historyLoading && history.length > 0 && (
          <div className="mt-8 max-w-lg">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              이전 퀴즈 기록 ({history.length}개)
            </button>
            {showHistory && (
              <div className="space-y-2">
                {history.map(quiz => (
                  <HistoryItem key={quiz.id} quiz={quiz} onPlay={startQuiz} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Render: Playing ──────────────────────────────────────────────────────

  if (view === 'playing' && currentQuiz && currentQuestion) {
    const total = currentQuiz.questions.length
    const progress = ((currentIdx) / total) * 100
    const answerRecord = answers[currentQuestion.id]
    const isAnswered = !!answerRecord
    const canGoNext = isAnswered && (currentQuestion.type !== 'short_answer' || !selfGradeVisible)

    return (
      <div className="flex-1 overflow-y-auto p-5">
        {/* Progress */}
        <div className="mb-5 max-w-lg">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{currentIdx + 1} / {total}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentIdx + (isAnswered ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="max-w-lg space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {currentIdx + 1}번
              </span>
              <span className="text-xs text-muted-foreground">
                {currentQuestion.type === 'multiple_choice' && '객관식'}
                {currentQuestion.type === 'true_false' && 'O/X'}
                {currentQuestion.type === 'short_answer' && '단답형'}
              </span>
            </div>
            <p className="font-medium text-sm leading-relaxed">{currentQuestion.question}</p>
          </div>

          {/* Multiple choice */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="space-y-2">
              {currentQuestion.options.map(option => {
                const isSelected = selectedOption === option
                const isCorrectOption = option === currentQuestion.answer
                return (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={isSelected}
                    correct={feedbackVisible && isCorrectOption}
                    wrong={feedbackVisible && isSelected && !isCorrectOption}
                    disabled={feedbackVisible}
                    onClick={() => handleSelectOption(option)}
                  />
                )
              })}
            </div>
          )}

          {/* True / False */}
          {currentQuestion.type === 'true_false' && (
            <div className="flex gap-3">
              {(['O', 'X'] as const).map(val => {
                const isSelected = selectedOption === val
                const isCorrectOption = val === currentQuestion.answer
                return (
                  <button
                    key={val}
                    onClick={() => handleSelectOption(val)}
                    disabled={feedbackVisible}
                    className={cn(
                      'flex-1 py-6 text-3xl font-bold rounded-xl border transition-all disabled:cursor-not-allowed',
                      feedbackVisible && isCorrectOption && 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30',
                      feedbackVisible && isSelected && !isCorrectOption && 'bg-red-50 border-red-400 text-red-600 dark:bg-red-900/30',
                      !feedbackVisible && isSelected && 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/30',
                      !feedbackVisible && !isSelected && 'border-border hover:border-indigo-300 hover:bg-muted/50',
                      feedbackVisible && !isSelected && !isCorrectOption && 'opacity-40',
                    )}
                  >
                    {val}
                  </button>
                )
              })}
            </div>
          )}

          {/* Short answer */}
          {currentQuestion.type === 'short_answer' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shortInput}
                  onChange={e => setShortInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !feedbackVisible) handleSubmitShort() }}
                  disabled={feedbackVisible}
                  placeholder="답을 입력하세요"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
                {!feedbackVisible && (
                  <Button
                    size="sm"
                    onClick={handleSubmitShort}
                    disabled={!shortInput.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                  >
                    제출
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedbackVisible && (
            <div className={cn(
              'rounded-lg p-4 text-sm space-y-2',
              currentQuestion.type !== 'short_answer' && answerRecord?.correct
                ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800'
                : currentQuestion.type !== 'short_answer'
                ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
                : 'bg-muted/50 border border-border',
            )}>
              {/* Auto-graded result */}
              {currentQuestion.type !== 'short_answer' && (
                <div className="flex items-center gap-2 font-semibold">
                  {answerRecord?.correct
                    ? <><CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /><span className="text-green-700 dark:text-green-400">정답입니다!</span></>
                    : <><XCircle className="h-4 w-4 text-red-500 shrink-0" /><span className="text-red-700 dark:text-red-400">오답입니다. 정답: {currentQuestion.answer}</span></>}
                </div>
              )}

              {/* Short answer: show correct answer */}
              {currentQuestion.type === 'short_answer' && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">모범 답안</p>
                  <p className="font-semibold">{currentQuestion.answer}</p>
                </div>
              )}

              {/* Self-grade for short answer */}
              {selfGradeVisible && currentQuestion.type === 'short_answer' && (
                <div className="flex gap-2 pt-1">
                  <p className="text-xs text-muted-foreground self-center mr-1">내 답이:</p>
                  <button
                    onClick={() => handleSelfGrade(true)}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 font-medium transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> 맞았어요
                  </button>
                  <button
                    onClick={() => handleSelfGrade(false)}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 font-medium transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" /> 틀렸어요
                  </button>
                </div>
              )}

              {/* Explanation */}
              {(!selfGradeVisible || currentQuestion.type !== 'short_answer') && (
                <p className="text-xs text-muted-foreground leading-relaxed">{currentQuestion.explanation}</p>
              )}
            </div>
          )}

          {/* Next button */}
          {canGoNext && (
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={handleNext}
            >
              {currentIdx + 1 >= total ? '결과 확인' : '다음 문제 →'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ─── Render: Results ──────────────────────────────────────────────────────

  if (view === 'results' && currentQuiz) {
    const score = Object.values(answers).filter(a => a.correct).length
    const total = currentQuiz.questions.length
    const pct = Math.round((score / total) * 100)

    const wrongQuestions = currentQuiz.questions.filter(q => !answers[q.id]?.correct)
    const correctQuestions = currentQuiz.questions.filter(q => answers[q.id]?.correct)

    let grade = ''
    let gradeColor = ''
    if (pct >= 90) { grade = '완벽해요! 🏆'; gradeColor = 'text-yellow-500' }
    else if (pct >= 70) { grade = '잘했어요! 👍'; gradeColor = 'text-green-600' }
    else if (pct >= 50) { grade = '조금 더 해봐요 💪'; gradeColor = 'text-amber-500' }
    else { grade = '다시 도전해봐요 📖'; gradeColor = 'text-red-500' }

    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-lg space-y-5">
          {/* Score card */}
          <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
            <div className="flex items-center justify-center mb-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="text-5xl font-bold mb-1">{score}<span className="text-2xl text-muted-foreground">/{total}</span></div>
            <div className="text-lg font-semibold text-muted-foreground mb-2">{pct}%</div>

            {/* Circle progress */}
            <div className="flex justify-center mb-3">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                  transform="rotate(-90 40 40)"
                  className={pct >= 70 ? 'text-green-500' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
                <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="bold" fill="currentColor" className="text-foreground">
                  {pct}%
                </text>
              </svg>
            </div>

            <p className={cn('text-base font-semibold', gradeColor)}>{grade}</p>
            <p className="text-xs text-muted-foreground mt-1">
              맞은 문제 {correctQuestions.length}개 · 틀린 문제 {wrongQuestions.length}개
            </p>
          </div>

          {/* Wrong questions */}
          {wrongQuestions.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">
                틀린 문제 ({wrongQuestions.length}개)
              </p>
              <div className="space-y-2">
                {wrongQuestions.map(q => {
                  const isExpanded = expandedWrong.has(q.id)
                  const userAns = answers[q.id]?.userAnswer ?? ''
                  return (
                    <div key={q.id} className="rounded-lg border border-red-200 dark:border-red-800 bg-card overflow-hidden">
                      <button
                        onClick={() => setExpandedWrong(prev => {
                          const next = new Set(prev)
                          isExpanded ? next.delete(q.id) : next.add(q.id)
                          return next
                        })}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted/30 transition-colors"
                      >
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="flex-1 font-medium truncate">{q.question}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 text-sm border-t border-red-100 dark:border-red-900 pt-3">
                          {userAns && <p className="text-red-600 dark:text-red-400"><span className="font-medium">내 답:</span> {userAns}</p>}
                          <p className="text-green-700 dark:text-green-400"><span className="font-medium">정답:</span> {q.answer}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Correct questions */}
          {correctQuestions.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">
                맞은 문제 ({correctQuestions.length}개)
              </p>
              <div className="space-y-1.5">
                {correctQuestions.map(q => (
                  <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800 text-sm bg-card">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-muted-foreground truncate">{q.question}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => startQuiz(currentQuiz)}
            >
              <RotateCcw className="h-4 w-4" /> 다시 풀기
            </Button>
            <Button
              className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setView('settings')}
            >
              <Plus className="h-4 w-4" /> 새 퀴즈 생성
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
