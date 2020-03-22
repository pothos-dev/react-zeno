import { createHooks } from '../src'
import { createStoreClass } from '@bearbytes/zeno'
import { renderHook, act } from '@testing-library/react-hooks'

test('create hooks', () => {
  type MyStore = {
    state: { counter: 0 }
    messages: { increment: { by: number } }
  }
  const storeClass = createStoreClass<MyStore>({
    initialState: { counter: 0 },
    messageHandlers: {
      increment(s, m) {
        s.counter += m.by
      },
    },
  })
  const { useStore, useDispatch } = createHooks(storeClass)

  let renderCount = 0
  const { result } = renderHook(() => {
    const storeState = useStore()
    const dispatch = useDispatch()
    renderCount++
    return { storeState, dispatch }
  })
  expect(renderCount).toBe(1)
  expect(result.current.storeState.counter).toBe(0)

  // If the state is not changed, component is not re-rendered
  act(() => {
    result.current.dispatch({ type: 'increment', by: 0 })
  })
  expect(renderCount).toBe(1)
  expect(result.current.storeState.counter).toBe(0)

  act(() => {
    result.current.dispatch({ type: 'increment', by: 42 })
  })
  expect(renderCount).toBe(2)
  expect(result.current.storeState.counter).toBe(42)
})
