// Performance optimization utilities

/**
 * Debounce function with customizable delay
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }
}

/**
 * Throttle function to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastExecution = 0
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    const now = Date.now()
    
    if (now - lastExecution >= delay) {
      lastExecution = now
      func(...args)
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      timeoutId = setTimeout(() => {
        lastExecution = Date.now()
        func(...args)
      }, delay - (now - lastExecution))
    }
  }
}

/**
 * Optimized requestAnimationFrame-based scheduler for smooth 60fps updates
 */
export function scheduleUpdate<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let frameId: number | null = null
  let pendingArgs: Parameters<T> | null = null
  
  return (...args: Parameters<T>) => {
    pendingArgs = args
    
    if (frameId === null) {
      frameId = requestAnimationFrame(() => {
        if (pendingArgs) {
          func(...pendingArgs)
        }
        frameId = null
        pendingArgs = null
      })
    }
  }
}

/**
 * Performance-optimized cache with automatic cleanup
 */
export class PerformanceCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>()
  private maxSize: number
  private ttl: number // Time to live in milliseconds
  
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxSize = maxSize
    this.ttl = ttl
  }
  
  get(key: K): V | undefined {
    const item = this.cache.get(key)
    
    if (!item) {
      return undefined
    }
    
    // Check if item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }
    
    return item.value
  }
  
  set(key: K, value: V): void {
    // Clean up expired items before adding new ones
    this.cleanup()
    
    // If cache is full, remove oldest item
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  }
  
  has(key: K): boolean {
    return this.get(key) !== undefined
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key)
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  size(): number {
    this.cleanup()
    return this.cache.size
  }
  
  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: K[] = []
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        expiredKeys.push(key)
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key))
  }
}

/**
 * Batch async operations to reduce overhead
 */
export function batchAsync<T, R>(
  operations: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize = 10
): Promise<R[]> {
  const batches: T[][] = []
  
  for (let i = 0; i < operations.length; i += batchSize) {
    batches.push(operations.slice(i, i + batchSize))
  }
  
  return Promise.all(
    batches.map(batch => processor(batch))
  ).then(results => results.flat())
}

/**
 * Memory-efficient chunk processing
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (chunk: T[]) => Promise<R[]>,
  chunkSize = 100,
  delayBetweenChunks = 0
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const chunkResults = await processor(chunk)
    results.push(...chunkResults)
    
    // Optional delay to prevent blocking the main thread
    if (delayBetweenChunks > 0 && i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenChunks))
    }
  }
  
  return results
}