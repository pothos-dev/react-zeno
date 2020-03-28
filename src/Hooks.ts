import {
  StoreClass,
  StoreInterface,
  Dispatch,
  StoreInstance,
  StoreState,
} from '@bearbytes/zeno'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  DependencyList,
} from 'react'
import { StoreContainer, createStoreContainer } from './StoreContainer'

export interface ZenoHooks<T extends StoreInterface> {
  useStore(): StoreState<T>
  useStore<R>(selector: Selector<T, R>, dependencyList: DependencyList): R

  useDispatch(): Dispatch<T>

  useStoreInstance(): StoreInstance<T>

  StoreContainer: StoreContainer<T>
}

export type StoreContext<T extends StoreInterface> = React.Context<{
  storeInstance: StoreInstance<T>
}>

type Selector<T extends StoreInterface, R> = (storeState: StoreState<T>) => R

export function createZenoHooks<T extends StoreInterface>(
  storeClass: StoreClass<T>
): ZenoHooks<T> {
  const storeContext: StoreContext<T> = createContext({
    storeInstance: storeClass.defaultInstance,
  })

  const StoreContainer = createStoreContainer(storeClass, storeContext)

  function useStoreInstance(): StoreInstance<T> {
    return useContext(storeContext).storeInstance
  }

  function useDispatch(): Dispatch<T> {
    return useStoreInstance().dispatch
  }

  function useStore(): StoreState<T>
  function useStore<R>(selector: Selector<T, R>): R
  function useStore<R>(
    selector?: Selector<T, R>,
    dependencyList?: DependencyList
  ): R | StoreState<T> {
    const safeSelector = selector ?? ((state) => state)

    const storeInstance = useStoreInstance()
    const [state, setState] = useState(() =>
      safeSelector(storeInstance.getState())
    )

    useEffect(() => {
      const unsubscribe = storeInstance.subscribe(
        (storeState) => {
          const selectedState = safeSelector(storeState)
          setState(selectedState)
        },
        // grab state immediately, as it might have changed between initialization and first execution of useEffect()
        true
      )
      return unsubscribe
    }, dependencyList ?? [])

    return state
  }

  return {
    StoreContainer,
    useStoreInstance,
    useDispatch,
    useStore,
  }
}
