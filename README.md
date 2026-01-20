# undifferent

A diff algorithm and viewer for comparing documents, with special support for UN resolutions.

## Installation

```bash
npm install github:un-fck/undifferent
```

## Usage

### Core Diff Algorithm

The core module provides a pure TypeScript diff algorithm with no React dependency:

```typescript
import { diff, similarity, highlight } from 'undifferent/core'

// Compare two arrays of lines
const result = diff(linesA, linesB, { threshold: 0.8 })

console.log(result.score)  // Overall similarity (0-1)
console.log(result.items)  // Array of diff items with highlighting

// Calculate similarity between two strings
const score = similarity('hello world', 'hello there')

// Get highlighted diff markup
const { left, right } = highlight('old text', 'new text')
// left: "~~old~~ text"
// right: "**new** text"
```

### React Components

The react module provides components for displaying diffs:

```tsx
import { DiffViewer, Comparison, DiffItem } from 'undifferent/react'
import type { DiffResult } from 'undifferent/core'

// Full viewer with titles and score
<DiffViewer 
  data={diffResult}
  leftTitle="Version A"
  rightTitle="Version B"
  showScore
/>

// Or build your own UI with individual components
{diffResult.items.map((item, i) => (
  <Comparison key={i} item={item} />
))}
```

### UN Document Fetching

The un-fetcher module provides utilities for fetching UN documents (server-side only):

```typescript
import { fetchUNDocument, fetchDocumentMetadata } from 'undifferent/un-fetcher'

// Fetch a UN document by symbol
const doc = await fetchUNDocument('A/RES/77/16')
console.log(doc.lines)    // Array of text lines
console.log(doc.format)   // 'doc' or 'pdf'

// Fetch document metadata (title, date, year) from UN Digital Library
const meta = await fetchDocumentMetadata('A/HRC/RES/50/13')
console.log(meta.title)   // "Access to medicines, vaccines..."
console.log(meta.date)    // "2022-07-14"
console.log(meta.year)    // 2022
```

## Styling

The React components use CSS variables for theming:

```css
:root {
  --diff-item-bg: #ffffff;
  --diff-added-bg: #bbf7d0;
  --diff-removed-bg: #fef2f2;
  --diff-moved-bg: #fefce8;
  --diff-aligned-bg: #eff6ff;
  --diff-score-color: #009edb;
}
```

## API Reference

### Core

- `diff(linesA, linesB, options?)` - Compute structured diff
- `similarity(a, b)` - Calculate Levenshtein similarity ratio
- `highlight(a, b)` - Generate diff markup

### React

- `<DiffViewer>` - Full diff viewer component
- `<Comparison>` - Single diff row (left + right)
- `<DiffItem>` - Single side content
- `parseHighlightedText(text)` - Parse diff markup to React elements

### UN Fetcher

- `fetchUNDocument(symbol)` - Fetch UN document content by symbol from [ODS](https://documents.un.org)
- `fetchDocumentMetadata(symbol)` - Fetch metadata (title, date, year) from [UN Digital Library](https://digitallibrary.un.org)

## License

MIT
