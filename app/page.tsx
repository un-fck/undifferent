'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Comparison } from '../src/react/Comparison'
import type { DiffResult } from '../src/core'

interface DocumentMetadata {
  symbol: string
  title: string
  date: string | null
  year: number | null
  subjects: string[]
  vote?: {
    inFavour: number
    against: number
    abstaining: number
  }
  agendaInfo?: string
}

interface DiffResponse extends DiffResult {
  formats?: {
    left: 'doc' | 'pdf'
    right: 'doc' | 'pdf'
  }
  metadata?: {
    left: DocumentMetadata
    right: DocumentMetadata
  }
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [symbol1, setSymbol1] = useState(
    searchParams.get('symbol1') || 'A/RES/60/152'
  )
  const [symbol2, setSymbol2] = useState(
    searchParams.get('symbol2') || 'A/RES/61/156'
  )
  const [diffData, setDiffData] = useState<DiffResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDiff = async (sym1?: string, sym2?: string) => {
    const symbolA = sym1 || symbol1
    const symbolB = sym2 || symbol2

    if (!symbolA.trim() || !symbolB.trim()) {
      setError('Both document symbols are required')
      return
    }

    setLoading(true)
    setError(null)
    setDiffData(null)

    try {
      const response = await fetch('/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbolA: symbolA.trim(),
          symbolB: symbolB.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch diff')
      }

      const data = await response.json()
      setDiffData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const updateUrl = (sym1?: string, sym2?: string) => {
    const symbolA = sym1 || symbol1
    const symbolB = sym2 || symbol2
    const params = new URLSearchParams()
    if (symbolA.trim()) params.set('symbol1', symbolA.trim())
    if (symbolB.trim()) params.set('symbol2', symbolB.trim())
    router.push(`/?${params.toString()}`)
  }

  useEffect(() => {
    const symbol1Param = searchParams.get('symbol1')
    const symbol2Param = searchParams.get('symbol2')

    if (symbol1Param) setSymbol1(symbol1Param)
    if (symbol2Param) setSymbol2(symbol2Param)

    if (symbol1Param && symbol2Param) {
      fetchDiff(symbol1Param, symbol2Param)
    }
  }, [searchParams])

  const hasQueryParams =
    searchParams.get('symbol1') || searchParams.get('symbol2')

  const exampleComparisons = [
    { symbol1: 'A/RES/60/152', year1: '2005', symbol2: 'A/RES/61/156', year2: '2006' },
    { symbol1: 'A/RES/78/14', year1: '2023', symbol2: 'A/RES/79/15', year2: '2024' },
    { symbol1: 'A/RES/77/157', year1: '2022', symbol2: 'A/RES/78/143', year2: '2023' },
    { symbol1: 'A/RES/62/22', year1: '2007', symbol2: 'A/RES/63/66', year2: '2008' },
    { symbol1: 'A/RES/77/18', year1: '2022', symbol2: 'A/RES/79/9', year2: '2024' },
    { symbol1: 'A/HRC/RES/50/13', year1: '2022', symbol2: 'A/HRC/RES/59/7', year2: '2025' },
  ]

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Title */}
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <svg className="h-6 w-6 text-[#009edb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {hasQueryParams ? (
            <button
              onClick={() => router.push('/')}
              className="cursor-pointer transition-colors hover:text-[#009edb]"
              title="Return to start page"
            >
              Document Comparison
            </button>
          ) : (
            <span>Document Comparison</span>
          )}
        </h1>

        {!hasQueryParams && (
          <div className="space-y-6">
            {/* Input Section */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Compare Documents</h2>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Document Symbol 1
                  </label>
                  <input
                    type="text"
                    value={symbol1}
                    onChange={(e) => setSymbol1(e.target.value)}
                    placeholder="e.g., A/RES/77/16"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#009edb] focus:ring-1 focus:ring-[#009edb] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Document Symbol 2
                  </label>
                  <input
                    type="text"
                    value={symbol2}
                    onChange={(e) => setSymbol2(e.target.value)}
                    placeholder="e.g., A/RES/79/326"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#009edb] focus:ring-1 focus:ring-[#009edb] focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  updateUrl()
                  fetchDiff()
                }}
                disabled={loading || !symbol1.trim() || !symbol2.trim()}
                className="flex items-center gap-2 rounded-md bg-[#009edb] px-4 py-2 text-white transition-colors hover:bg-[#007ab8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {loading ? 'Loading...' : 'Compare Documents'}
              </button>
            </div>

            {/* Example Comparisons */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Example Comparisons</h2>
              <p className="mb-4 text-sm text-gray-600">
                Click on any comparison below to see how documents have evolved over time:
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {exampleComparisons.map((example, index) => (
                  <a
                    key={index}
                    href={`/?symbol1=${encodeURIComponent(example.symbol1)}&symbol2=${encodeURIComponent(example.symbol2)}`}
                    className="group block rounded-lg border border-gray-200 p-3 transition-colors hover:border-[#009edb] hover:bg-blue-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-[#009edb]">
                          {example.symbol1} ({example.year1})
                        </span>
                        <span className="text-gray-500">vs</span>
                        <span className="font-mono text-[#009edb]">
                          {example.symbol2} ({example.year2})
                        </span>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-[#009edb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {hasQueryParams && diffData && (
          <div className="space-y-4">
            {/* Document Headers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-left">
                <h3 className="text-base font-semibold">{symbol1}</h3>
                {diffData?.metadata?.left?.date && (
                  <p className="mt-1 text-sm text-gray-600">
                    {new Date(diffData.metadata.left.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
                <a
                  href={`https://documents.un.org/api/symbol/access?s=${encodeURIComponent(symbol1)}&l=en&t=pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm text-[#009edb] hover:underline"
                >
                  View PDF →
                </a>
                {diffData?.metadata?.left?.vote && (
                  <p className="mt-1 text-xs text-gray-500">
                    Vote: {diffData.metadata.left.vote.inFavour}–{diffData.metadata.left.vote.against}–{diffData.metadata.left.vote.abstaining}
                  </p>
                )}
                {diffData?.formats?.left === 'pdf' && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    PDF source (lower quality)
                  </p>
                )}
              </div>
              <div className="text-left">
                <h3 className="text-base font-semibold">{symbol2}</h3>
                {diffData?.metadata?.right?.date && (
                  <p className="mt-1 text-sm text-gray-600">
                    {new Date(diffData.metadata.right.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
                <a
                  href={`https://documents.un.org/api/symbol/access?s=${encodeURIComponent(symbol2)}&l=en&t=pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm text-[#009edb] hover:underline"
                >
                  View PDF →
                </a>
                {diffData?.metadata?.right?.vote && (
                  <p className="mt-1 text-xs text-gray-500">
                    Vote: {diffData.metadata.right.vote.inFavour}–{diffData.metadata.right.vote.against}–{diffData.metadata.right.vote.abstaining}
                  </p>
                )}
                {diffData?.formats?.right === 'pdf' && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    PDF source (lower quality)
                  </p>
                )}
              </div>
            </div>

            {/* Diff Content */}
            {loading ? (
              <div className="py-8 text-center">
                <div className="inline-flex items-center gap-2 text-gray-600">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#009edb]"></div>
                  Loading comparison...
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {diffData.items.map((item, index) => (
                  <Comparison key={index} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {hasQueryParams && loading && !diffData && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#009edb]"></div>
              Loading comparison...
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#009edb]"></div>
              Loading...
            </div>
          </div>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  )
}
