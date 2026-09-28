/** Time-of-day phase for the world's sky and light. Dark mode always gets night. */
export function phaseFor(hour, dark) {
  if (dark) return 'night';
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}
