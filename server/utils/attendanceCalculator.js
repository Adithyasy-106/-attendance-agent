/**
 * Attendance Calculator: Core Math, Risk Analysis, and Predictive Recovery
 */

const LAST_WORKING_DAY = new Date('2026-05-16');
const HOLIDAYS = [
  // Jan/Feb
  '2026-01-15', '2026-01-17', '2026-01-26', '2026-02-15',
  // March
  '2026-03-19', '2026-03-21', '2026-03-31',
  // April
  '2026-04-03', '2026-04-14', '2026-04-20',
  // May
  '2026-05-01', '2026-05-28'
].map(d => new Date(d).toDateString());

const SAT_TT_DATES = [
  '2026-03-16', '2026-03-26', '2026-04-01', '2026-04-29'
].map(d => new Date(d).toDateString());

const calculatePercentage = (attended, total) => {
  if (total === 0) return 100;
  return Math.round((attended / total) * 100);
};

/** Max additional absences such that attended/(total+k) stays at or above 75% (integer percent). */
const calculateMaxBunkable = (attended, total) => {
  if (total === 0) return 0;
  let canSkip = 0;
  while (Math.round((attended / (total + canSkip + 1)) * 100) >= 75) canSkip++;
  return canSkip;
};

const calculateNeededToReachTarget = (attended, total, target = 0.75) => {
  const needed = Math.ceil((target * total - attended) / (1 - target));
  return Math.max(0, needed);
};

const calculateDrop = (attended, total, skipCount = 1) => {
  const current = calculatePercentage(attended, total);
  const dropped = calculatePercentage(attended, total + skipCount);
  return { current, dropped };
};

/**
 * Predicts the maximum reachable percentage if no more classes are missed until the deadline.
 */
const calculateRecoveryPath = (attended, total, classesPerDay, customLastWorkingDay) => {
  const today = new Date();
  const deadline = customLastWorkingDay ? new Date(customLastWorkingDay) : LAST_WORKING_DAY;
  
  let futureClasses = 0;
  let current = new Date(today);

  while (current <= deadline) {
    const dayStr = current.toDateString();
    const isSunday = current.getDay() === 0;
    const isHoliday = HOLIDAYS.includes(dayStr);
    const isSatTT = SAT_TT_DATES.includes(dayStr);

    if (!isSunday && !isHoliday) {
      // Basic heuristic: Assume 5 classes per weekday, 3 on Saturdays/SAT-TT
      const dailyCount = (current.getDay() === 6 || isSatTT) ? 3 : classesPerDay;
      futureClasses += dailyCount;
    }
    current.setDate(current.getDate() + 1);
  }

  const maxAttended = attended + futureClasses;
  const maxTotal = total + futureClasses;
  const maxPercent = calculatePercentage(maxAttended, maxTotal);

  return { 
    futureClasses, 
    maxPercent, 
    deadline: deadline.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) 
  };
};

const aggregateDailyRisk = (subjectsToday, attendanceData) => {
  let riskyCount = 0;
  let riskyList = [];

  subjectsToday.forEach(sub => {
    // Only consider subjects that have verified attendance data from the ERP
    if (attendanceData && attendanceData[sub.name]) {
      const data = attendanceData[sub.name];
      const pct = calculatePercentage(data.attended, data.total);
      if (pct < 75) {
        riskyCount++;
        riskyList.push(`${sub.name} (${pct}%)`);
      }
    }
  });

  const overallRisk = riskyCount > 1 ? 'High' : (riskyCount > 0 ? 'Medium' : 'Low');
  const recommendation =
    overallRisk === 'Low'
      ? 'No subjects on this day are below 75% in synced ERP data.'
      : overallRisk === 'Medium'
        ? 'At least one class today is under 75%; skipping could worsen those subjects.'
        : 'Multiple subjects are under 75%; treat today as a recovery day if possible.';

  return { riskyCount, riskyList, overallRisk, recommendation };
};

module.exports = {
  calculatePercentage,
  calculateMaxBunkable,
  calculateNeededToReachTarget,
  calculateDrop,
  calculateRecoveryPath,
  aggregateDailyRisk,
  LAST_WORKING_DAY,
  SAT_TT_DATES,
  HOLIDAYS
};
