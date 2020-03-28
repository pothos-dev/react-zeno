import {
  createStoreClass,
  StoreInterface,
  CreateStoreClassOptions,
  StoreClass,
} from '@bearbytes/zeno'
import { ZenoHooks, createZenoHooks } from './Hooks'

function createStoreClassWithHooks<T extends StoreInterface>(
  options: CreateStoreClassOptions<T>
): StoreClass<T> & ZenoHooks<T> {
  const storeClass = createStoreClass(options)
  const hooks = createZenoHooks(storeClass)
  return { ...storeClass, ...hooks }
}

export * from '@bearbytes/zeno'
export { createStoreClassWithHooks as createStoreClass }
export { createZenoHooks }
