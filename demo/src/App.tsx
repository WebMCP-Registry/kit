import { useState, useSyncExternalStore } from 'react'
import { useWebMCPTool, useWebMCPTools } from 'webmcp-kit/react'
import { setDraftContract } from './draft.tools.js'
import { addTodo, getTodos, subscribe, toggleTodo } from './todo-store.js'
import { todoTools } from './todo.tools.js'

export function App() {
  const todos = useSyncExternalStore(subscribe, getTodos)
  const [draft, setDraft] = useState('')

  // Store-backed tools: complete `defineTool`s from `todo.tools.ts`, registered
  // as a stable array — they need nothing from this component.
  useWebMCPTools(todoTools)

  // Component-state-bound tool: `draft.tools.ts` only declares the contract
  // (schema + metadata). The handler — which calls `setDraft`, a `useState`
  // setter that can't exist outside render — is supplied here, where it's in
  // scope, and bound into a runnable tool by `useWebMCPTool` itself.
  useWebMCPTool(setDraftContract, ({ text }) => {
    setDraft(text)
    return { draft: text }
  })

  // Chrome 149 ships this on `navigator`, not `document` (the spec's stated
  // location) — probe both, same as `getModelContext` in the SDK.
  const hasModelContext =
    (typeof document !== 'undefined' && Boolean(document.modelContext)) ||
    (typeof navigator !== 'undefined' && Boolean(navigator.modelContext))

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    addTodo(text)
  }

  return (
    <main style={{ maxWidth: 480, margin: '3rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>webmcp-kit demo</h1>
      <p style={{ color: hasModelContext ? 'green' : 'crimson' }}>
        {hasModelContext
          ? '✓ modelContext is available — tools are registered (open devtools console for confirmation).'
          : '✗ modelContext is unavailable — enable chrome://flags/#enable-webmcp-testing and reload.'}
      </p>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a todo…"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="submit">Add</button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos.map((todo) => (
          <li key={todo.id} style={{ padding: '0.25rem 0' }}>
            <label style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
              <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />{' '}
              {todo.text}
            </label>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: '2rem', color: '#666', fontSize: '0.9rem' }}>
        Registered WebMCP tools: <code>add-todo</code>, <code>complete-todo</code>,{' '}
        <code>list-todos</code> (store-backed, from <code>todo.tools.ts</code>) and{' '}
        <code>set-draft-text</code> (component-state-bound, from <code>draft.tools.ts</code> +{' '}
        <code>useWebMCPTool</code>). Ask an agent connected to this page to add, list, or complete
        a todo, or to fill in the draft field, to exercise them end to end.
      </p>
    </main>
  )
}
