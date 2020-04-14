import {
  createStoreClass,
  StoreInterface,
  CreateStoreClassOptions,
  StoreClass,
} from '@bearbytes/zeno'
import { ZenoHooks, createStoreHooks } from './Hooks'

function createStoreClassWithHooks<T extends StoreInterface>(
  options: CreateStoreClassOptions<T>
): StoreClass<T> & ZenoHooks<T> {
  const storeClass = createStoreClass(options)
  const hooks = createStoreHooks(storeClass)
  return { ...storeClass, ...hooks }
}

export * from '@bearbytes/zeno'
export { createStoreClassWithHooks as createStoreClass }
export { createStoreHooks }
