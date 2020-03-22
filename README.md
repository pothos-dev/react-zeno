# Zeno

Zeno is a variant of the [Redux](https://github.com/reduxjs/redux) pattern, but is written from the ground up to make the best use of Typescripts powerful type inference capabilities.

It has a React integration with the companion library [react-zeno](https://github.com/bearbytes/react-zeno).

It aims to:

- provide auto-completion
- minimize the amount of boilerplate
- without sacrificing type safety

It is also opinionated in these ways:

- use [Immer](https://github.com/immerjs/immer) to allow for direct state mutation
- use different terms as the original Redux (_still thinking about this_)

## Table of Contents

#### Getting started

- [Defining Types](#defining-types)
- [Creating a Store](#creating-a-store)
- [Dispatching messages](#dispatching-messages)
- [Reading Store state](#reading-store-state)

#### Advanced Topics

- [Side effects and async functions](#side-effects-and-async-functions)
- [Subscribe to changes](#subscribe-to-changes)
- [Middleware](#middleware)
- [Creating additional store instances](#creating-additional-store-instances)

If you're coming from Redux, here is a glossary with the terms you are familiar with:

| Redux    | Zeno           |     |
| -------- | -------------- | --- |
| Store    | Store          | ✔️  |
| State    | State          | ✔️  |
| Dispatch | Dispatch       | ✔️  |
| Action   | Message        | ❗  |
| Reducer  | MessageHandler | ❗  |

## Getting Started

### Defining Types

Here is an example for the **Store type** of a Todo App:

```ts
type TodoItem = { id: number; text: string; done?: boolean }

type TodoStore = {
  state: {
    // List of Todos
    todos: TodoItem[]

    // The id to be assigned to the next TodoItem
    nextId: number
  }

  messages: {
    // Create a new TodoItem.
    createTodo: { text: string }

    // Change the name of an existing TodoItem.
    changeText: { id: number; newText: string }

    // Mark an existing item as done.
    markAsDone: { id: number }
  }
}
```

As you see, you define the types for the `state`, as well as the names and payloads of `messages` all in one place, without the need for any helper functions or generic types.

This is the only place where you need to mention these types, they will be inferred automatically everywhere else.

### Creating a Store

We have to differentiate between a `StoreDefinition` and a `StoreInstance`.

Store definitions:

- define `state` and `messages` types (as shown above)
- defines behavior using `messageHandlers`
- include at least 1 `StoreInstance`, but can spawn additional instances

Store instance:

- contains the actual `state` values
- receives `messages` and executes the `messageHandlers`

In most cases, you will only ever use the singular `StoreInstance`, but there might be cases where different parts of your application want to manage their own copy of the state.

To create both the `StoreDefinition`, use the `defineStore` method:

```ts
const storeDefinition = defineStore<TodoStore>({
  initialState: {
    // Start with an empty list of Todos.
    todos: [],
  },

  messageHandlers: {
    // Create a new TodoItem.
    createTodo(s, m) {
      const todo = { id: s.nextId, text: m.text }
      s.todos.push(todo)
      s.nextId++
    },

    // Change the name of an existing TodoItem.
    changeText(s, m) {
      const todo = s.todos.find((todo) => todo.id == m.id)!
      todo.text = m.newText
    },

    // Mark an existing item as done.
    markAsDone(s, m) {
      const todo = s.todos.find((todo) => todo.id == m.id)!
      todo.done = true
    },
  },
})
```

The shape of this code mirrors the Type definition we created above.

By passing the **Store type** as generic argument to `defineStore`, the compiler will autocomplete the names of the messages and provide correct type information for the state type (`s`) and the message payloads (`m`).

The `StoreDefinition` can be destructured into these values:

```ts
const { defaultInstance } = storeDefinition
```

### Dispatching messages

A `message` must be dispatched to a specific `StoreInstance`:

```ts
storeInstance.dispatch({ type: 'markAsDone', id: 42 })
```

The `dispatch` function is fully typed and will autocomplete message types and their corresponding payloads.

### Reading Store state

The `state` must be read from a specific `StoreInstance`:

```ts
const currentState = storeInstance.getState()
```

## Advanced Topics

### Side effects and async functions

The Redux pattern is synchronous - at each point in time, the `state` must be valid. This is a problem when interacting with asynchronous operations, like fetching data from the network.

The usual workaround is to define a `message` that starts an asynchronous operation, and then another message that updates the Store when the operation completes.

Zeno implements the [Thunk](https://github.com/reduxjs/redux-thunk) pattern, where you can return a function from `messageHandler` that has access to the `StoreInstance` and can synchronously or asynchronously dispatch new `messages`:

Alternatively, the `StoreInstance` is passed as the third parameter to each `messageHandler` and can be used in the same way.

See this example:

```ts
type Store = {
  state: {
    data?: any
    lastError?: string
    fetchInProgress: boolean
  }

  messages: {
    fetch: {}
    fetchFinished: { data?: any; error?: string }
    clearError: {}
  }
}

const storeDefinition = defineStore<Store>({
  initialState: {
    fetchInProgress: false,
  },

  messageHandlers: {
    fetch(s, m) {
      // The messageHandler updates the state synchronously...
      if (s.fetchInProgress) {
        s.lastError = 'Another fetch is already in progress.'
      } else {
        s.fetchInProgress = true
        // ...and starts of an asynchronous operation,
        // which will dispatch another message when done.
        return async (dispatch) => {
          const { data, error } = await downloadDataAsync()
          dispatch({ type: 'fetchFinished', data, error })
        }
      }
    },

    // extract the dispatch function of the executing store instance instead using Thunk
    fetchFinished(s, m, { dispatch }) {
      s.fetchInProgress = false
      s.data = m.data
      // A messageHandler may also dispatch synchronously.
      // The dispatched message will be executed immediately afterwards,
      // before the views have a chance to re-render.
      dispatch({ type: 'clearError' })
    },

    clearError(s) {
      s.lastError = undefined
    },
  },
})
```

### Subscribe to changes

You can `subscribe` to a `storeInstance` by passing a callback.

The callback will be updated when the state is updated.

If the second parameter of `subscribe` is `true`, the callback will also be executed immediately with the current state.

```ts
const unsubscribe = storeInstance.subscribe(
  (s) => console.log(s),
  true /* immediately logs the current state. optional parameter */
)
unsubscribe()
```

### Middleware

Zeno implements the Redux Middleware API and is compatible with existing middleware libraries.

A middleware has this form:

```ts
const exceptionHandlerMiddleware = (store) => (next) => (actionOrMessage) => {
  // we have access to the store instance
  const prevState = store.getState()

  // call the next middleware (or finally the registered messageHandler)
  try {
    const nextState = next(actionOrMessage)
    // return the updated state from middleware
    return nextState
  } catch (error) {
    // or do some other things, like logging and
    // returning the previous state in case of an error
    console.error(error.message)
    return prevState
  }
}
```

You can pass any number of middlewares to `defineStore`:

```ts
const storeDefinition = defineStore<MyStore>({
  initialState: {...}
  messageHandlers: {...}
  middleware: [loggerMiddleware, exceptionHandlerMiddleware]
})
```

### Creating additional store instances

You can call `createInstance` on a `StoreDefinition` to create a new copy of the state.

Optionally, you can pass an initial state into the instance, otherwise it will use the `initialState` from `defineStore`.

```ts
async function initializeFromStorage(): StoreInstance<any> {
  const loadedState = await loadFromStorage()
  return storeDefinition.createInstance(loadedState)
}
```

If you pass an array of middlewares, they will be called in the given order.

## Future Work:

- Hooks
- Context Providers
- DevTools Integration
- Slices
- Internal Messages
