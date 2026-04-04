document.addEventListener('DOMContentLoaded', function() {
  initOptions();
});

async function initOptions() {
  initTabs();
  await loadOptions();

  const timerDisplayElement = DomUtils.querySelector('#timer-display');
  const durationSlider = DomUtils.querySelector('#duration-slider');
  if (timerDisplayElement && durationSlider && durationSlider.value) {
    const sliderValue = parseInt(durationSlider.value);
    if (!isNaN(sliderValue)) {
      const durationInMs = sliderValue * 60 * 1000;
      timerDisplayElement.textContent = Formatters.formatTimeRemaining(durationInMs);
    }
  }

  await checkTimerStatus();
  await initSchedule();

  DomUtils.addEventListener(DomUtils.querySelector('#stop-btn'), 'click', stopTimer);
  DomUtils.addEventListener(DomUtils.querySelector('#start-stop-btn'), 'click', startTimer);
  DomUtils.addEventListener(DomUtils.querySelector('#schedule-pause-btn'), 'click', async () => {
    await Schedule.pauseUntilWindowEnd();
    await checkTimerStatus();
  });
  DomUtils.addEventListener(DomUtils.querySelector('#schedule-resume-btn'), 'click', async () => {
    await Schedule.resumeFromPause();
    await checkTimerStatus();
  });
  DomUtils.addEventListener(DomUtils.querySelector('#duration-slider'), 'input', () => {
    updateTimerDisplay();
    saveDurationChange();
  });

  Timer.onTimerChanged(async (status) => {
    await checkTimerStatus();
    if (status && status.isActive) {
      startTimerDisplay();
    }
  });

  // Re-check timer area when schedule changes (e.g. pause/resume from popup)
  Storage.onScheduleChanged(async () => {
    await checkTimerStatus();
  });

  Storage.onTimerSettingsChanged(async (newSettings) => {
    const durationSlider = DomUtils.querySelector('#duration-slider');
    if (newSettings.duration && durationSlider && parseInt(durationSlider.value) !== newSettings.duration) {
      durationSlider.value = newSettings.duration;
      updateTimerDisplay();
    }
  });

  // Reactively update UI when user options change externally (e.g. context menu)
  Storage.onUserOptionsChanged((newOptions) => {
    const additionalUrlsInput = DomUtils.querySelector('#additional-urls-input');
    const exceptionsInput = DomUtils.querySelector('#exceptions-input');

    // Only update fields that aren't currently focused (avoid overwriting user input)
    if (document.activeElement !== additionalUrlsInput) {
      additionalUrlsInput.value = newOptions.additionalUrls || '';
    }
    if (document.activeElement !== exceptionsInput) {
      exceptionsInput.value = newOptions.exceptions || '';
    }

    DomUtils.querySelector('#social-checkbox').checked = newOptions.socialEnabled;
    DomUtils.querySelector('#news-checkbox').checked = newOptions.newsEnabled;
    DomUtils.querySelector('#entertainment-checkbox').checked = newOptions.entertainmentEnabled;
  });

  // Only attach saveOptions to blocklist checkboxes (not the schedule toggle)
  ['#social-checkbox', '#news-checkbox', '#entertainment-checkbox'].forEach(selector => {
    const checkbox = DomUtils.querySelector(selector);
    if (checkbox) {
      DomUtils.addEventListener(checkbox, 'change', saveOptions);
    }
  });

  const exceptionsInput = DomUtils.querySelector('#exceptions-input');
  const additionalUrlsInput = DomUtils.querySelector('#additional-urls-input');

  const debouncedSave = MiscUtils.debounce(saveOptions, 500);

  DomUtils.addEventListener(exceptionsInput, 'input', debouncedSave);
  DomUtils.addEventListener(additionalUrlsInput, 'input', debouncedSave);
}

// ─── Tabs ───────────────────────────────────────────────────────────

function initTabs() {
  const tabs = document.querySelectorAll('.tab[data-tab]');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      // Update tab states
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Update panel visibility
      panels.forEach(panel => {
        panel.classList.remove('active');
      });

      const targetPanel = document.querySelector(`#tab-${target}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}

async function loadOptions() {
  try {
    const [options, timerSettings] = await Promise.all([
      Storage.loadUserOptions(),
      Storage.loadTimerSettings()
    ]);

    if (!options) {
      console.error('Failed to load user options');
      return;
    }

    DomUtils.querySelector('#social-checkbox').checked = options.socialEnabled;
    DomUtils.querySelector('#news-checkbox').checked = options.newsEnabled;
    DomUtils.querySelector('#entertainment-checkbox').checked = options.entertainmentEnabled;
    DomUtils.querySelector('#exceptions-input').value = options.exceptions || '';
    DomUtils.querySelector('#additional-urls-input').value = options.additionalUrls || '';

    const durationSlider = DomUtils.querySelector('#duration-slider');
    if (durationSlider && timerSettings && timerSettings.duration) {
      durationSlider.value = timerSettings.duration;
    }
  } catch (error) {
    console.error('Error loading options:', error);
  }
}

async function saveOptions() {
  const options = {
    socialEnabled: DomUtils.querySelector('#social-checkbox').checked,
    newsEnabled: DomUtils.querySelector('#news-checkbox').checked,
    entertainmentEnabled: DomUtils.querySelector('#entertainment-checkbox').checked,
    exceptions: DomUtils.querySelector('#exceptions-input').value,
    additionalUrls: DomUtils.querySelector('#additional-urls-input').value
  };

  await Storage.saveUserOptions(options);
}

async function saveDurationChange() {
  const durationSlider = DomUtils.querySelector('#duration-slider');
  const duration = parseInt(durationSlider.value);

  const settings = await Storage.loadTimerSettings();
  settings.duration = duration;
  await Storage.saveTimerSettings(settings);
}

// ─── Schedule countdown polling for options page ────────────────────
let optionsScheduleInterval = null;

function startOptionsScheduleUpdates() {
  if (optionsScheduleInterval) return;
  optionsScheduleInterval = setInterval(async () => {
    const scheduleStatus = await Schedule.getStatus();
    const timerDisplayElement = DomUtils.querySelector('#timer-display');
    if (scheduleStatus.isActive && scheduleStatus.isScheduled) {
      timerDisplayElement.textContent = Formatters.formatTimeRemaining(scheduleStatus.timeRemaining);
    } else {
      // State changed (window ended or paused externally) — full refresh
      stopOptionsScheduleUpdates();
      await checkTimerStatus();
    }
  }, 1000);
}

function stopOptionsScheduleUpdates() {
  if (optionsScheduleInterval) {
    clearInterval(optionsScheduleInterval);
    optionsScheduleInterval = null;
  }
}

async function checkTimerStatus() {
  const status = await Timer.getStatus();
  const timerControl = DomUtils.querySelector('#timer-control');
  const sliderContainer = DomUtils.querySelector('.slider-container');
  const startStopBtn = DomUtils.querySelector('#start-stop-btn');
  const stopBtn = DomUtils.querySelector('#stop-btn');
  const pauseBtn = DomUtils.querySelector('#schedule-pause-btn');
  const resumeBtn = DomUtils.querySelector('#schedule-resume-btn');

  if (status.isActive) {
    stopOptionsScheduleUpdates();
    timerControl.style.display = 'block';
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    startTimerDisplay();
    return;
  }

  // Check schedule state
  const scheduleStatus = await Schedule.getStatus();

  if (scheduleStatus.isActive && scheduleStatus.isScheduled) {
    // Schedule window is active — show pause button and start countdown
    timerControl.style.display = 'block';
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    pauseBtn.style.display = 'block';
    resumeBtn.style.display = 'none';
    Timer.stopUpdates();

    const timerDisplayElement = DomUtils.querySelector('#timer-display');
    timerDisplayElement.textContent = Formatters.formatTimeRemaining(scheduleStatus.timeRemaining);
    startOptionsScheduleUpdates();
    return;
  }

  if (scheduleStatus.isPaused && scheduleStatus.isScheduled) {
    stopOptionsScheduleUpdates();
    timerControl.style.display = 'block';
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'block';
    Timer.stopUpdates();

    const timerDisplayElement = DomUtils.querySelector('#timer-display');
    timerDisplayElement.textContent = 'Paused';
    return;
  }

  // Nothing active — show normal timer UI
  stopOptionsScheduleUpdates();
  timerControl.style.display = 'block';
  sliderContainer.style.display = 'block';
  startStopBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  pauseBtn.style.display = 'none';
  resumeBtn.style.display = 'none';
  Timer.stopUpdates();

  // Set default timer display
  const timerDisplayElement = DomUtils.querySelector('#timer-display');
  const durationSlider = DomUtils.querySelector('#duration-slider');
  if (durationSlider && durationSlider.value) {
    const currentSliderValue = parseInt(durationSlider.value);
    if (!isNaN(currentSliderValue)) {
      const durationInMs = currentSliderValue * 60 * 1000;
      timerDisplayElement.textContent = Formatters.formatTimeRemaining(durationInMs);
    } else {
      timerDisplayElement.textContent = '00:00:00';
    }
  } else {
    timerDisplayElement.textContent = '00:00:00';
  }
}

function startTimerDisplay() {
  Timer.startUpdates(
    (status) => {
      updateTimerDisplay(status);
    },
    () => {
      checkTimerStatus(); // Hide timer control when expired
    }
  );
}

function updateTimerDisplay(status = null) {
  const timerDisplayElement = DomUtils.querySelector('#timer-display');
  const progressFill = DomUtils.querySelector('#progress-fill');

  if (!status) {
    const durationSlider = DomUtils.querySelector('#duration-slider');
    if (durationSlider && durationSlider.value) {
      const currentSliderValue = parseInt(durationSlider.value);
      if (!isNaN(currentSliderValue)) {
        const durationInMs = currentSliderValue * 60 * 1000;
        timerDisplayElement.textContent = Formatters.formatTimeRemaining(durationInMs);
        if (progressFill) {
          progressFill.style.width = '0%';
        }
        return;
      }
    }
    return; // Don't update if invalid
  }

  timerDisplayElement.textContent = Formatters.formatTimeRemaining(status.timeRemaining);

  if (progressFill && status.progress !== undefined) {
    const progressPercentage = Math.round(status.progress * 100);
    progressFill.style.width = `${progressPercentage}%`;
  }
}

async function startTimer() {
  const durationSlider = DomUtils.querySelector('#duration-slider');
  const selectedDuration = parseInt(durationSlider.value);
  await Timer.start(selectedDuration);
  await checkTimerStatus();
}

async function stopTimer() {
  // If schedule is active, pause it instead of just stopping the timer
  const scheduleStatus = await Schedule.getStatus();
  if (scheduleStatus.isActive && scheduleStatus.isScheduled) {
    await Schedule.pauseUntilWindowEnd();
  }

  await Timer.stop();
  Timer.stopUpdates();
  await checkTimerStatus();
}

// ─── Weekly Schedule ────────────────────────────────────────────────

// Track whether a slider is being actively dragged to suppress re-renders
let scheduleSliderActive = false;
document.addEventListener('mouseup', () => { scheduleSliderActive = false; });
document.addEventListener('touchend', () => { scheduleSliderActive = false; });

async function initSchedule() {
  const schedule = await Storage.loadSchedule();

  const enabledCheckbox = DomUtils.querySelector('#schedule-enabled');
  enabledCheckbox.checked = schedule.enabled;

  renderAllSlots(schedule);
  updateScheduleDaysVisibility(schedule.enabled);

  DomUtils.addEventListener(enabledCheckbox, 'change', async () => {
    const schedule = await Storage.loadSchedule();
    schedule.enabled = enabledCheckbox.checked;
    await Storage.saveSchedule(schedule);
    updateScheduleDaysVisibility(schedule.enabled);
  });

  // Add slot buttons
  DomUtils.querySelectorAll('.schedule-add-slot').forEach(btn => {
    DomUtils.addEventListener(btn, 'click', async () => {
      const day = parseInt(btn.dataset.day);
      const schedule = await Storage.loadSchedule();

      if (!schedule.days[day]) schedule.days[day] = [];
      schedule.days[day].push({ start: '09:00', end: '17:00' });

      await Storage.saveSchedule(schedule);
      renderDaySlots(day, schedule.days[day]);
    });
  });

  // Copy previous day buttons
  DomUtils.querySelectorAll('.schedule-copy-prev').forEach(btn => {
    DomUtils.addEventListener(btn, 'click', async () => {
      const day = parseInt(btn.dataset.day);
      const prevDay = parseInt(btn.dataset.prevDay);
      const schedule = await Storage.loadSchedule();

      const prevSlots = schedule.days[prevDay] || [];
      if (prevSlots.length === 0) return; // nothing to copy

      // Deep-copy the previous day's slots
      schedule.days[day] = prevSlots.map(s => ({ start: s.start, end: s.end }));

      await Storage.saveSchedule(schedule);
      renderDaySlots(day, schedule.days[day]);
    });
  });

  // Listen for external schedule changes (skip re-render while dragging a slider)
  Storage.onScheduleChanged((newSchedule) => {
    enabledCheckbox.checked = newSchedule.enabled;
    if (!scheduleSliderActive) {
      renderAllSlots(newSchedule);
    }
    updateScheduleDaysVisibility(newSchedule.enabled);
  });
}

function updateScheduleDaysVisibility(enabled) {
  const daysContainer = DomUtils.querySelector('#schedule-days');
  if (daysContainer) {
    daysContainer.style.opacity = enabled ? '1' : '0.4';
    daysContainer.style.pointerEvents = enabled ? 'auto' : 'none';
  }
}

function renderAllSlots(schedule) {
  for (let day = 0; day <= 6; day++) {
    const slots = (schedule.days && schedule.days[day]) || [];
    renderDaySlots(day, slots);
  }
}

// Convert minutes since midnight to "HH:MM" string
function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Format minutes since midnight to display label (e.g. "9:00 AM", "1:30 PM")
function minutesToDisplayLabel(minutes) {
  if (minutes >= 1440) return '12:00 AM'; // midnight (end of day)
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + period;
}

function renderDaySlots(day, slots) {
  const container = document.querySelector(`.schedule-day-slots[data-day="${day}"]`);
  if (!container) return;

  container.innerHTML = '';

  // Range: 0 (00:00) to 1440 (24:00), step 15 min
  const STEP = 15;
  const MIN = 0;
  const MAX = 1440;

  slots.forEach((slot, index) => {
    const startMinutes = Schedule.parseTime(slot.start);
    const endMinutes = Schedule.parseTime(slot.end);

    const slotEl = document.createElement('div');
    slotEl.className = 'schedule-slot';

    // Time label
    const label = document.createElement('span');
    label.className = 'schedule-slot-label';
    label.textContent = minutesToDisplayLabel(startMinutes) + ' \u2013 ' + minutesToDisplayLabel(endMinutes);

    // Range slider container
    const slider = document.createElement('div');
    slider.className = 'schedule-range-slider';

    const track = document.createElement('div');
    track.className = 'schedule-range-track';

    const fill = document.createElement('div');
    fill.className = 'schedule-range-fill';

    const startRange = document.createElement('input');
    startRange.type = 'range';
    startRange.min = MIN;
    startRange.max = MAX;
    startRange.step = STEP;
    startRange.value = startMinutes;

    const endRange = document.createElement('input');
    endRange.type = 'range';
    endRange.min = MIN;
    endRange.max = MAX;
    endRange.step = STEP;
    endRange.value = endMinutes;

    slider.appendChild(track);
    slider.appendChild(fill);
    slider.appendChild(startRange);
    slider.appendChild(endRange);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'schedule-remove-slot';
    removeBtn.textContent = '\u00d7';
    removeBtn.title = 'Remove slot';

    slotEl.appendChild(label);
    slotEl.appendChild(slider);
    slotEl.appendChild(removeBtn);
    container.appendChild(slotEl);

    // Update the fill bar position
    function updateFill() {
      const s = parseInt(startRange.value);
      const e = parseInt(endRange.value);
      const leftPct = (s / MAX) * 100;
      const rightPct = (e / MAX) * 100;
      fill.style.left = leftPct + '%';
      fill.style.width = (rightPct - leftPct) + '%';
    }

    updateFill();

    // Debounced save to storage
    const debouncedSaveSlot = MiscUtils.debounce(async () => {
      const schedule = await Storage.loadSchedule();
      if (schedule.days[day] && schedule.days[day][index]) {
        schedule.days[day][index].start = minutesToTimeStr(parseInt(startRange.value));
        schedule.days[day][index].end = minutesToTimeStr(parseInt(endRange.value));
        await Storage.saveSchedule(schedule);
      }
    }, 300);

    // Track active drag to prevent re-renders from destroying the slider
    [startRange, endRange].forEach(input => {
      input.addEventListener('mousedown', () => { scheduleSliderActive = true; });
      input.addEventListener('touchstart', () => { scheduleSliderActive = true; });
    });

    // Enforce: start thumb cannot exceed end thumb (and vice versa)
    startRange.addEventListener('input', () => {
      let s = parseInt(startRange.value);
      const e = parseInt(endRange.value);
      if (s >= e) {
        s = e - STEP;
        if (s < MIN) s = MIN;
        startRange.value = s;
      }
      label.textContent = minutesToDisplayLabel(s) + ' \u2013 ' + minutesToDisplayLabel(e);
      updateFill();
      debouncedSaveSlot();
    });

    endRange.addEventListener('input', () => {
      const s = parseInt(startRange.value);
      let e = parseInt(endRange.value);
      if (e <= s) {
        e = s + STEP;
        if (e > MAX) e = MAX;
        endRange.value = e;
      }
      label.textContent = minutesToDisplayLabel(s) + ' \u2013 ' + minutesToDisplayLabel(e);
      updateFill();
      debouncedSaveSlot();
    });

    removeBtn.addEventListener('click', async () => {
      const schedule = await Storage.loadSchedule();
      if (schedule.days[day]) {
        schedule.days[day].splice(index, 1);
        await Storage.saveSchedule(schedule);
        renderDaySlots(day, schedule.days[day]);
      }
    });
  });
}
