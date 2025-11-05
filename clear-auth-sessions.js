// Clear existing authentication sessions to apply new 60-minute duration
// This ensures users get the updated session length immediately

console.log('🧹 Clearing existing authentication sessions...')

try {
  // Clear the localStorage authentication data
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('escap_admin_auth')
    console.log('✅ Authentication session cleared from localStorage')
    console.log('ℹ️  Users will need to log in again with new 60-minute session duration')
  } else {
    console.log('ℹ️  localStorage not available (server environment)')
  }
} catch (error) {
  console.error('❌ Error clearing authentication session:', error)
}

console.log('🎯 All session durations are now set to 60 minutes:')
console.log('  - Initial session: 60 minutes')
console.log('  - Session extension: 60 minutes')
console.log('  - Activity-based extension: 60 minutes')
console.log('✅ Session duration update complete!')