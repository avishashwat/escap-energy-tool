// Dummy GitHub Spark hook replacements for local development
export const useKVState = () => [null, () => {}]
export const useKV = () => ({ get: () => null, set: () => {}, delete: () => {} })
export const getOrSetKey = () => Promise.resolve(null)
export const setKey = () => Promise.resolve()
export const getKey = () => Promise.resolve(null)
export const deleteKey = () => Promise.resolve()