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

async function checkTimerStatus() {
  const status = await Timer.getStatus();
  const timerControl = DomUtils.querySelector('#timer-control');
  const sliderContainer = DomUtils.querySelector('.slider-container');
  const startStopBtn = DomUtils.querySelector('#start-stop-btn');
  const stopBtn = DomUtils.querySelector('#stop-btn');

  if (status.isActive) {
    timerControl.style.display = 'block';
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    startTimerDisplay();
  } else {
    timerControl.style.display = 'block';
    sliderContainer.style.display = 'block';
    startStopBtn.style.display = 'block';
    stopBtn.style.display = 'none';
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

  // Listen for external schedule changes
  Storage.onScheduleChanged((newSchedule) => {
    enabledCheckbox.checked = newSchedule.enabled;
    renderAllSlots(newSchedule);
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

function renderDaySlots(day, slots) {
  const container = document.querySelector(`.schedule-day-slots[data-day="${day}"]`);
  if (!container) return;

  container.innerHTML = '';

  slots.forEach((slot, index) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'schedule-slot';

    const startInput = document.createElement('input');
    startInput.type = 'time';
    startInput.className = 'schedule-time-input';
    startInput.value = slot.start;

    const separator = document.createElement('span');
    separator.className = 'schedule-slot-separator';
    separator.textContent = '\u2013'; // en-dash

    const endInput = document.createElement('input');
    endInput.type = 'time';
    endInput.className = 'schedule-time-input';
    endInput.value = slot.end;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'schedule-remove-slot';
    removeBtn.textContent = '\u00d7'; // multiplication sign
    removeBtn.title = 'Remove slot';

    const errorEl = document.createElement('span');
    errorEl.className = 'schedule-slot-error';

    slotEl.appendChild(startInput);
    slotEl.appendChild(separator);
    slotEl.appendChild(endInput);
    slotEl.appendChild(removeBtn);
    slotEl.appendChild(errorEl);
    container.appendChild(slotEl);

    // Validate and show error
    function validateSlot() {
      const startMinutes = Schedule.parseTime(startInput.value);
      const endMinutes = Schedule.parseTime(endInput.value);
      if (startMinutes >= endMinutes) {
        errorEl.textContent = 'Start must be before end';
        slotEl.classList.add('schedule-slot-invalid');
      } else {
        errorEl.textContent = '';
        slotEl.classList.remove('schedule-slot-invalid');
      }
    }

    validateSlot();

    const debouncedSaveSlot = MiscUtils.debounce(async () => {
      const schedule = await Storage.loadSchedule();
      if (schedule.days[day] && schedule.days[day][index]) {
        schedule.days[day][index].start = startInput.value;
        schedule.days[day][index].end = endInput.value;
        await Storage.saveSchedule(schedule);
      }
    }, 300);

    startInput.addEventListener('change', () => {
      validateSlot();
      debouncedSaveSlot();
    });

    endInput.addEventListener('change', () => {
      validateSlot();
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
