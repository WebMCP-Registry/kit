/**
 * `*.tools.ts`: a file the CLI can statically discover and import in an
 * isolated Node context (no React/browser deps — only `webmcp-kit`, `zod`,
 * and the plain module-level `todo-store`). Every tool here is a complete,
 * runnable `defineTool` — its handler talks to the store, not component
 * state, so there's nothing about it that requires a component to exist.
 *
 * Compare with `draft.tools.ts`, where the handler *must* live inside a
 * component because it closes over a `useState` setter.
 */
import { defineTool } from 'webmcp-kit'
import { z } from 'zod'
import { addTodo, completeTodo, getTodos } from './todo-store.js'

export const addTodoTool = defineTool({
  name: 'add-todo',
  description: "Add a new item to the user's todo list",
  kind: 'write',
  input: z.object({ text: z.string().describe('The todo text') }),
  handler: ({ text }) => ({ added: addTodo(text) }),
})

export const completeTodoTool = defineTool({
  name: 'complete-todo',
  description: 'Mark a todo item as done, matched by (partial) text',
  kind: 'write',
  input: z.object({
    text: z.string().describe('Text, or partial text, of the todo to mark as done'),
  }),
  handler: ({ text }) => {
    const match = completeTodo(text)
    return match ? { found: true, completed: match.text } : { found: false }
  },
})

export const listTodosTool = defineTool({
  name: 'list-todos',
  description: "List the user's current todo items and whether each is done",
  kind: 'read',
  input: z.object({}),
  handler: () => ({ todos: getTodos() }),
})

export const todoTools = [addTodoTool, completeTodoTool, listTodosTool]
