import React, { ReactNode } from 'react'
import {
  StoreShape,
  StoreClass,
  StoreInstance,
  StoreState,
} from '@bearbytes/zeno'
import { StoreContext } from './Hooks'

export type StoreContainer<T extends StoreShape> = React.FC<
  StoreContainerProps<T>
>

export type StoreContainerProps<T extends StoreShape> = {
  children?: ReactNode
} & ({ storeInstance?: StoreInstance<T> } | { initialState?: StoreState<T> })

export function createStoreContainer<T extends StoreShape>(
  storeClass: StoreClass<T>,
  context: StoreContext<T>
): StoreContainer<T> {
  return function StoreContainer(props: StoreContainerProps<T>) {
    let storeInstance =
      'storeInstance' in props ? props.storeInstance : undefined
    let initialState = 'initialState' in props ? props.initialState : undefined

    storeInstance = storeInstance ?? storeClass.createInstance(initialState)

    return (
      <context.Provider value={{ storeInstance }}>
        {props.children}
      </context.Provider>
    )
  }
}
