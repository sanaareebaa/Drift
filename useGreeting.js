export function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 22) return 'Good evening'
  return 'Still up?'
}
export const useGreeting = () => greetingFor(new Date().getHours())
