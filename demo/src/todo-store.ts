/**
 * Minimal external store for todos — module-level state that both the React
 * component (via `useSyncExternalStore`) and the statically-defined tools in
 * `todo.tools.ts` can read and write, without either depending on the other.
 *
 * This is what makes those tools eligible for `defineTool`: their handlers
 * don't need component state (a `useState` setter in scope), so they can be
 * complete, runnable, CLI-discoverable call sites at module scope.
 */

export interface Todo {
  id: string
  text: string
  done: boolean
}

type Listener = () => void

let todos: Todo[] = []
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function getTodos(): Todo[] {
  return todos
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function addTodo(text: string): Todo {
  const todo: Todo = { id: crypto.randomUUID(), text, done: false }
  todos = [...todos, todo]
  emit()
  return todo
}

export function completeTodo(text: string): Todo | undefined {
  const match = todos.find((todo) => todo.text.toLowerCase().includes(text.toLowerCase()))
  if (!match) return undefined
  todos = todos.map((todo) => (todo.id === match.id ? { ...todo, done: true } : todo))
  emit()
  return match
}

export function toggleTodo(id: string): void {
  todos = todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo))
  emit()
}
