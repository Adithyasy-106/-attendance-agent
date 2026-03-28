/**
 * Timetable Logic: Batch Filtering & Schedule Formatting
 */

const TIME_LABELS = ["08:00 - 09:00", "09:00 - 10:00", "10:20 - 11:20", "11:20 - 12:20", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00"];

/** Neutral grid when the user has not confirmed a timetable yet (no mock subjects). */
const EMPTY_GRID_STRINGS = () => {
  const free = 'Free / Break';
  return {
    Monday: Array(7).fill(free),
    Tuesday: Array(7).fill(free),
    Wednesday: Array(7).fill(free),
    Thursday: Array(7).fill(free),
    Friday: Array(7).fill(free),
    Saturday: Array(7).fill(free),
  };
};

const DEFAULT_TIMETABLE = {
  Monday: [
    { time: "08:00 - 09:00", subject: "OE", type: "Theory" },
    { time: "09:00 - 10:00", subject: "Technical Training", type: "Theory" },
    { time: "10:20 - 11:20", subject: "CC", type: "Theory" },
    { time: "11:20 - 12:20", subject: "PE", type: "Theory" },
    { time: "14:00 - 15:00", subject: "ML", type: "Theory" },
    { time: "15:00 - 16:00", subject: "TYL-SoftSkill", type: "Theory" },
    { time: "16:00 - 17:00", subject: "PTR", type: "Theory" }
  ],
  Tuesday: [
    { time: "08:00 - 10:00", subject: "ML Lab", type: "Lab" },
    { time: "08:00 - 10:00", subject: "ML Lab", type: "Lab" },
    { time: "10:20 - 11:20", subject: "TYL-Aptitude", type: "Theory" },
    { time: "11:20 - 12:20", subject: "OE", type: "Theory" },
    { time: "14:00 - 15:00", subject: "PTR", type: "Theory" },
    { time: "15:00 - 16:00", subject: "ML", type: "Theory" },
    { time: "16:00 - 17:00", subject: "CC", type: "Theory" }
  ],
  Wednesday: [
    { time: "08:00 - 10:00", subject: "Devops Lab", type: "Lab" },
    { time: "08:00 - 10:00", subject: "Devops Lab", type: "Lab" },
    { time: "10:20 - 11:20", subject: "OE", type: "Theory" },
    { time: "11:20 - 12:20", subject: "ML", type: "Theory" },
    { time: "14:00 - 15:00", subject: "PE", type: "Theory" },
    { time: "15:00 - 16:00", subject: "Yoga/Sports", type: "Theory" },
    { time: "16:00 - 17:00", subject: "Free", type: "Theory" }
  ],
  Thursday: [
    { time: "08:00 - 09:00", subject: "Technical Training", type: "Theory" },
    { time: "09:00 - 10:00", subject: "PTR", type: "Theory" },
    { time: "10:20 - 11:20", subject: "ML", type: "Theory" },
    { time: "11:20 - 12:20", subject: "PE", type: "Theory" },
    { time: "14:00 - 15:00", subject: "CC", type: "Theory" },
    { time: "15:00 - 16:00", subject: "Club Activity", type: "Theory" },
    { time: "16:00 - 17:00", subject: "Free", type: "Theory" }
  ],
  Friday: [
    { time: "08:00 - 09:00", subject: "CC", type: "Theory" },
    { time: "09:00 - 10:00", subject: "PTR", type: "Theory" },
    { time: "10:20 - 11:20", subject: "TYL-Logical", type: "Theory" },
    { time: "11:20 - 12:20", subject: "OE", type: "Theory" },
    { time: "14:00 - 15:00", subject: "PE", type: "Theory" },
    { time: "15:00 - 16:00", subject: "Cloud Lab", type: "Lab" },
    { time: "16:00 - 17:00", subject: "Cloud Lab", type: "Lab" }
  ],
  Saturday: [
    { time: "08:00 - 09:00", subject: "Project Phase-1", type: "Theory" },
    { time: "09:00 - 10:00", subject: "Project Phase-1", type: "Theory" },
    { time: "10:20 - 11:20", subject: "Free", type: "Theory" },
    { time: "11:20 - 12:20", subject: "Free", type: "Theory" },
    { time: "14:00 - 15:00", subject: "Mentoring", type: "Theory" },
    { time: "15:00 - 16:00", subject: "Library", type: "Theory" },
    { time: "16:00 - 17:00", subject: "Free", type: "Theory" }
  ]
};

/**
 * Converts user grid format (string arrays) to schedule format (objects)
 */
const convertGridToSchedule = (grid) => {
  if (!grid) return null;
  
  // Check if it's already in the correct format
  const firstDay = Object.values(grid)[0];
  if (firstDay && firstDay[0] && typeof firstDay[0] === 'object' && firstDay[0].subject) {
    return grid; // Already in correct format
  }

  // Convert string arrays to object arrays
  const result = {};
  for (const [day, subjects] of Object.entries(grid)) {
    result[day] = subjects.map((subj, i) => ({
      time: TIME_LABELS[i] || `Slot ${i + 1}`,
      subject: subj,
      type: subj.toLowerCase().includes('lab') ? 'Lab' : 'Theory'
    }));
  }
  return result;
};

/**
 * Filters the timetable for a specific batch and calculates the schedule for a given date
 */
const getScheduleForDate = (dateString, timetable, batch, coe) => {
  const date = new Date(dateString);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[date.getDay()];

  if (dayName === "Sunday") return [];

  // Convert grid format if needed
  const normalizedTT = convertGridToSchedule(timetable) || DEFAULT_TIMETABLE;
  const rawDayData = normalizedTT[dayName] || [];
  
  // Filter out "Free / Break" and "Free" entries
  return rawDayData.filter(item => {
    const subj = item.subject.toLowerCase();
    if (subj === 'free' || subj === 'free / break') return false;
    if (item.type === "Lab" && item.batch) {
      return item.batch === batch;
    }
    return true;
  });
};

/**
 * Extracts a list of unique subjects from the timetable
 */
const getRelevantSubjects = (timetable, batch) => {
  const normalizedTT = convertGridToSchedule(timetable) || DEFAULT_TIMETABLE;
  const allEntries = Object.values(normalizedTT).flat();
  const relevantOnes = allEntries.filter(e => !e.batch || e.batch === batch);
  return [...new Set(relevantOnes.map(e => e.subject))];
};

module.exports = {
  getScheduleForDate,
  getRelevantSubjects,
  DEFAULT_TIMETABLE,
  EMPTY_GRID_STRINGS,
  convertGridToSchedule
};
