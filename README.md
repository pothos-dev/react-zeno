[![NPM Version](https://img.shields.io/npm/v/@bearbytes/react-zeno.svg?style=flat)](https://www.npmjs.com/package/@bearbytes/react-zeno)
[![Actions Status](https://github.com/bearbytes/react-zeno/workflows/CI/badge.svg)](https://github.com/bearbytes/react-zeno/actions)

# React-Zeno

<!-- TOC depthFrom:2 -->

- [What is Zeno?](#what-is-zeno)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Defining Types](#defining-types)
  - [Creating a Store](#creating-a-store)
  - [Dispatching messages](#dispatching-messages)
  - [Reading Store state](#reading-store-state)
- [Advanced Topics](#advanced-topics)
  - [Side effects and async functions](#side-effects-and-async-functions)
  - [Subscribe to changes](#subscribe-to-changes)
  - [Middleware](#middleware)
  - [Redux DevTools Integration](#redux-devtools-integration)
  - [Creating additional store instances](#creating-additional-store-instances)
- [FAQ](#faq)
  - [Is this compatible with Redux middleware?](#is-this-compatible-with-redux-middleware)
  - [Why "message" over "action"?](#why-message-over-action)
  - [Why "messageHandler" over "reducer"?](#why-messagehandler-over-reducer)
- [Future Work](#future-work)
  - [Sending Messages from Redux DevTools Extensions](#sending-messages-from-redux-devtools-extensions)
  - [Slices](#slices)
  - [Internal Messages](#internal-messages)

<!-- /TOC -->

## What is Zeno?

Zeno is a variant of the [Redux](https://github.com/reduxjs/redux) pattern, but is written from the ground up to make the best use of Typescripts powerful type inference capabilities.

This library is the same as [zeno](https://github.com/bearbytes/zeno), but also provides typesafe React Hooks.

It aims to:

- provide auto-completion
- minimize the amount of boilerplate
- without sacrificing type safety

It is also opinionated in these ways:

- use [Immer](https://github.com/immerjs/immer) to allow for direct state mutation
- use different terms as the original Redux (see [why](#why-message-over-action))

If you're coming from Redux, here is a glossary with the terms you are familiar with:

| Redux    | Zeno                                      |     |
| -------- | ----------------------------------------- | --- |
| Store    | StoreInterface, StoreClass, StoreInstance | ❗  |
| Action   | Message                                   | ❗  |
| Dispatch | Dispatch                                  | ✔️  |
| State    | State                                     | ✔️  |
| Reducer  | MessageHandler                            | ❗  |

## Getting Started

### Installation

```
npm i @bearytes/react-zeno
# or
yarn add @bearbytes/react-zeno
```

### Defining Types

Here is an example for the `StoreInterface` of a Todo App:

```ts
// This is called the interface of a store: It defines the public surface (state and messages).
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

type TodoItem = { id: number; text: string; done?: boolean }
```

As you see, you define the types for the `state`, as well as the names and payloads of `messages` all in one place, without the need for any helper functions or generic types.

This is the only place where you need to mention these types, they will be inferred automatically everywhere else.

### Creating a Store

We have to differentiate between a `StoreClass` and a `StoreInstance`.

`StoreClass`:

- define `state` and `messages` types (as shown above)
- defines behavior using `messageHandlers`
- include at least 1 `StoreInstance`, but can spawn additional instances

`StoreInstance`:

- contains the actual `state` values
- receives `messages` and executes the `messageHandlers`

In most cases, you will only ever use the singular `StoreInstance`, but there might be cases where different parts of your application want to manage their own copy of the state.

To create both the `StoreClass`, use the `createStoreClass` method:

```ts
const storeClass = createStoreClass<TodoStore>({
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

By passing the `StoreInterface` as generic argument to `createStoreClass`, the compiler will autocomplete the names of the messages and provide correct type information for the state type (`s`) and the message payloads (`m`).

The `StoreClass` can be destructured into these values:

```ts
const {
  // Primary StoreInstance, used by default when using Hooks
  defaultInstance,
  // Hook to access some state from the Store
  useStore,
  // Hook to access the dispatch method of the Store
  useDispatch,
  // Hook to get the Store instance that is used in this component subtree
  useStoreInstance,
  // Context Provider component to use a different StoreInstance in the component subtree
  StoreContainer,
} = storeClass
```

### Dispatching messages

A `message` must be dispatched to a specific `StoreInstance`:

```ts
// with hooks
const dispatch = useDispatch()
dispatch({ type: 'markAsDone', id: 42 })

// or anywhere with a storeInstance
storeInstance.dispatch({ type: 'markAsDone', id: 42 })
```

The `dispatch` function is fully typed and will autocomplete message types and their corresponding payloads.

### Reading Store state

The `state` must be read from a specific `StoreInstance`:

```ts
// with hooks - subscribes to changes and rerenders the component automatically
const currentState = useStore()

// will only re-render the component if the selected state changes
const selectedState = useStore((s) => s.todos)

// or anywhere with a storeInstance
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

const storeClass = createStoreClass<Store>({
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

You can pass any number of middlewares to `createStoreClass`:

```ts
const storeClass = createStoreClass<MyStore>({
  initialState: {...}
  messageHandlers: {...}
  middleware: [loggerMiddleware, exceptionHandlerMiddleware]
})
```

### Redux DevTools Integration

`StoreInstance`s will automatically connect to a Redux DevTools Extension in the Browser, if available.

It is possible to pass configuration for the Integration to `createStoreClass` and overwrite it in `createInstance`.

It is currently not possible to send Messages from the DevTools to the Store, but this feature [can be added](#sending-messages-from-redux-devtools-extensions) if requested.

### Creating additional store instances

You can call `createInstance` on a `StoreClass` to create a new copy of the state.

Optionally, you can pass an initial state into the instance, otherwise it will use the `initialState` from `createStoreClass`.

```ts
async function initializeFromStorage(): StoreInstance<any> {
  const loadedState = await loadFromStorage()
  return storeClass.createInstance(loadedState)
}
```

If you pass an array of middlewares, they will be called in the given order.

## FAQ

### Is this compatible with Redux middleware?

Yes. However, this library cannot guarantee that any outside middleware conforms to the `state` and `message` types defined for a Zeno store. Middlewares could dispatch actions or create state that cannot be dealt with in a type-safe way. This is not a problem for most middlewares though, as these implement features that do not interfere with the predefined types.

### Why "message" over "action"?

One reason to use the Redux pattern is to separate the concerns of "what happens" with "how does the state change". Essentially, we are implementing a [Publish–subscribe pattern](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern), where the UI (or other parts of the applications) publish events, and the Store subscribes to these events to update its internal state.

Passing detailed instructions to the Store about how the state should exactly change, breaks the encapsulation and tightly couples the business logic with the event dispatcher (that often lives in the UI). So if we'd often have actions called `'setFoo'`, we would be missing the point of Redux, [as stated by Dan Abramov](https://twitter.com/dan_abramov/status/800310397538619393).

Due to this reason, I find the term "_action_" to be confusing, as it implies a specific instruction, rather than an informative event, that the Store is free to act on in any way appropriate. However, using the term "_event_" is also quite restricting, as now the user is encouraged to write `'somethingHappened'` events instead of `'doSomething'` actions.

I chose the term "_message_", as this word carries all the right connotations without implying a certain way of thinking, opening it up for event- and action-based usages. It simply implies an asynchronous packet of information with no added behavior, that can be serialized and sent over a network (as is often useful, for example when working with the Redux DevTools).

### Why "messageHandler" over "reducer"?

The term "_reducer_" is named after [an operation often used in functional programming](<https://en.wikipedia.org/wiki/Fold_(higher-order_function)>), where an initial value (`state`) and any number of additional values (`action`s) are _reduced_ to a single value again (the next `state`). In fact, this is exactly how Redux works and is an appropriate, albeit sometimes confusing term.

However, using Reducers forces the programmer to consider their state immutable, and create new copies of the state, which often leads to a lot of boilerplate and hard to read code. For this reason, nowadays it is often recommended to use [Immer](https://github.com/immerjs/immer) to allow mutating the state in-place. This library does the same thing. But while there is still a `reduce` happening in the internals of the library, the actual user code written to handle a message can no longer be best described by the term "_reducer_".

The term "_messageHandler_" simply states that we need to deal with a message in any way. This might be updating state, creating side-effects (like starting network requests) or dispatching additional messages. It doesn't imply that we are performing a `reduce` operation, like the original term would.

## Future Work

### Sending Messages from Redux DevTools Extensions

For this to work, the lifetime of a StoreInstance must be tracked, otherwise subscribing to DevTools will create memory leaks.

The [Redux DevTools](https://github.com/reduxjs/redux-devtools) are very useful when debugging what happens in the Store, and should probably be built into most libraries that implement Redux.

### Slices

As the Store grows and features ever more messages, it is useful to break it up into different parts, which are called [Slice](https://redux-toolkit.js.org/tutorials/basic-tutorial#introducing-createslice) in the Redux world.

### Internal Messages

Just as classes have public and private methods, a Store might have public and private messages. From the outside, only public messages can be dispatched, but the `messageHandlers` of the store might also dispatch private messages, which allows the programmer to extract repeated tasks into an internal `messageHandler`.
