// Weekly schedule logic for ZeroDistraction

const Schedule = {
  // Parse "HH:MM" string to minutes since midnight
  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },

  // Check if a given time (minutes since midnight) falls within a slot
  isInSlot(currentMinutes, slot) {
    const start = this.parseTime(slot.start);
    const end = this.parseTime(slot.end);

    // Normal slot: start < end (e.g., 08:00 - 18:00)
    if (start < end) {
      return currentMinutes >= start && currentMinutes < end;
    }

    // Invalid or zero-length slot
    return false;
  },

  // Get the active slot for the current time, or null
  getActiveSlot(schedule, now) {
    if (!schedule || !schedule.enabled) return null;

    now = now || new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = schedule.days[dayOfWeek];
    if (!slots || slots.length === 0) return null;

    for (const slot of slots) {
      if (this.isInSlot(currentMinutes, slot)) {
        return slot;
      }
    }

    return null;
  },

  // Check if blocking should be active right now based on the schedule
  async isInScheduledWindow() {
    const schedule = await Storage.loadSchedule();
    if (!schedule || !schedule.enabled) return false;

    // Check if schedule is paused (STOP button was pressed)
    if (schedule.schedulePausedUntil) {
      const now = Date.now();
      if (now < schedule.schedulePausedUntil) {
        return false; // Still paused
      }
      // Pause expired, clear it
      schedule.schedulePausedUntil = null;
      await Storage.saveSchedule(schedule);
    }

    return this.getActiveSlot(schedule) !== null;
  },

  // Get schedule status (similar shape to Timer.getStatus for popup reuse)
  async getStatus() {
    const schedule = await Storage.loadSchedule();
    if (!schedule || !schedule.enabled) {
      return { isActive: false, isScheduled: false, timeRemaining: 0, progress: 0 };
    }

    // Check pause state
    if (schedule.schedulePausedUntil && Date.now() < schedule.schedulePausedUntil) {
      return { isActive: false, isScheduled: true, isPaused: true, timeRemaining: 0, progress: 0 };
    }

    const now = new Date();
    const slot = this.getActiveSlot(schedule, now);

    if (!slot) {
      const nextWindow = this.getNextWindow(schedule, now);
      return {
        isActive: false,
        isScheduled: true,
        timeRemaining: 0,
        progress: 0,
        nextWindow: nextWindow
      };
    }

    const startMinutes = this.parseTime(slot.start);
    const endMinutes = this.parseTime(slot.end);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSeconds = now.getSeconds();

    const totalDurationMs = (endMinutes - startMinutes) * 60 * 1000;
    const elapsedMs = ((currentMinutes - startMinutes) * 60 + currentSeconds) * 1000;
    const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
    const progress = Math.min(1, Math.max(0, elapsedMs / totalDurationMs));

    return {
      isActive: remainingMs > 0,
      isScheduled: true,
      timeRemaining: remainingMs,
      totalDuration: totalDurationMs,
      progress: progress,
      currentSlot: slot,
      endTime: this.parseTime(slot.end)
    };
  },

  // Find the next upcoming window from a given time
  getNextWindow(schedule, now) {
    now = now || new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Check remaining slots today
    const todaySlots = schedule.days[currentDay] || [];
    for (const slot of todaySlots) {
      const startMinutes = this.parseTime(slot.start);
      if (startMinutes > currentMinutes) {
        return { day: currentDay, slot: slot };
      }
    }

    // Check subsequent days (wrap around the week)
    for (let offset = 1; offset <= 7; offset++) {
      const day = (currentDay + offset) % 7;
      const daySlots = schedule.days[day] || [];
      if (daySlots.length > 0) {
        // Return the first slot of that day
        const sorted = [...daySlots].sort((a, b) => this.parseTime(a.start) - this.parseTime(b.start));
        return { day: day, slot: sorted[0] };
      }
    }

    return null; // No windows configured
  },

  // Pause the schedule until the end of the current window
  async pauseUntilWindowEnd() {
    const schedule = await Storage.loadSchedule();
    if (!schedule || !schedule.enabled) return;

    const now = new Date();
    const slot = this.getActiveSlot(schedule, now);
    if (!slot) return;

    const endMinutes = this.parseTime(slot.end);
    const pauseUntil = new Date(now);
    pauseUntil.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

    schedule.schedulePausedUntil = pauseUntil.getTime();
    await Storage.saveSchedule(schedule);
  },

  // Day name helpers
  DAY_NAMES_SHORT: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

  getDayNameShort(dayIndex) {
    return this.DAY_NAMES_SHORT[dayIndex];
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Schedule;
} else {
  window.Schedule = Schedule;
}
