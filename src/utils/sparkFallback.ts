/**
 * LocalStorage-only KV utility for local development
 * GitHub Spark has been completely removed to avoid rate limiting issues
 */

export class SparkFallback {
  static async get<T>(key: string): Promise<T | null> {
    try {
      console.log(`SparkFallback.get("${key}") - using localStorage only`)
      
      // Use localStorage directly - GitHub Spark has been removed
      const localData = localStorage.getItem(`spark_kv_${key}`)
      console.log(`SparkFallback.get("${key}") - localStorage data:`, localData)
      return localData ? JSON.parse(localData) : null
    } catch (error) {
      console.error(`Failed to get "${key}" from localStorage:`, error)
      return null
    }
  }

  static async set(key: string, value: any): Promise<void> {
    try {
      console.log(`SparkFallback.set("${key}") - using localStorage only`)
      
      // Use localStorage directly - GitHub Spark has been removed
      const serializedValue = JSON.stringify(value)
      localStorage.setItem(`spark_kv_${key}`, serializedValue)
      console.log(`SparkFallback.set("${key}") - stored in localStorage`)
    } catch (error) {
      console.error(`Failed to set "${key}" in localStorage:`, error)
      throw error
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      console.log(`SparkFallback.delete("${key}") - using localStorage only`)
      
      // Use localStorage directly - GitHub Spark has been removed
      localStorage.removeItem(`spark_kv_${key}`)
      console.log(`SparkFallback.delete("${key}") - removed from localStorage`)
    } catch (error) {
      console.error(`Failed to delete "${key}" from localStorage:`, error)
      throw error
    }
  }

  static async keys(): Promise<string[]> {
    try {
      console.log('SparkFallback.keys() - using localStorage only')
      
      // Use localStorage directly - GitHub Spark has been removed
      const allKeys = Object.keys(localStorage)
      const sparkKeys = allKeys
        .filter(key => key.startsWith('spark_kv_'))
        .map(key => key.replace('spark_kv_', ''))
      
      console.log('SparkFallback.keys() - found keys:', sparkKeys)
      return sparkKeys
    } catch (error) {
      console.error('Failed to get keys from localStorage:', error)
      return []
    }
  }
}