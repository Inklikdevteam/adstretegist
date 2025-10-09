/**
 * Parse time period from user query
 * Examples: "last 30 days", "past 10 days", "yesterday", "last week", "last month"
 */
export function parseTimePeriod(query: string): { days: number; label: string } {
  const queryLower = query.toLowerCase();
  
  // Match patterns for days
  const daysMatch = queryLower.match(/(?:last|past|previous)\s+(\d+)\s+days?/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    return { days, label: `last ${days} days` };
  }
  
  // Match "yesterday"
  if (queryLower.includes('yesterday')) {
    return { days: 1, label: 'yesterday' };
  }
  
  // Match "last week" or "past week"
  if (queryLower.match(/(?:last|past|previous)\s+week/)) {
    return { days: 7, label: 'last week' };
  }
  
  // Match "last month" or "past month"
  if (queryLower.match(/(?:last|past|previous)\s+month/)) {
    return { days: 30, label: 'last month' };
  }
  
  // Match "last 2 weeks", "past 3 weeks", etc.
  const weeksMatch = queryLower.match(/(?:last|past|previous)\s+(\d+)\s+weeks?/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    const days = weeks * 7;
    return { days, label: `last ${weeks} week${weeks > 1 ? 's' : ''}` };
  }
  
  // Match "last 2 months", "past 3 months", etc.
  const monthsMatch = queryLower.match(/(?:last|past|previous)\s+(\d+)\s+months?/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1]);
    const days = months * 30;
    return { days, label: `last ${months} month${months > 1 ? 's' : ''}` };
  }
  
  // Match "this week"
  if (queryLower.includes('this week')) {
    return { days: 7, label: 'this week' };
  }
  
  // Match "this month"
  if (queryLower.includes('this month')) {
    return { days: 30, label: 'this month' };
  }
  
  // Default to 7 days if no time period detected
  return { days: 7, label: 'last 7 days' };
}

/**
 * Calculate date range from number of days
 */
export function getDateRange(days: number): { dateFrom: Date; dateTo: Date } {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateTo.getDate() - days);
  
  return { dateFrom, dateTo };
}
