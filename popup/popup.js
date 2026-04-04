let selectedDuration = 30; // Default 30 minutes
let scheduleUpdateInterval = null;

const timerDisplay = DomUtils.querySelector('#timer-display');
const progressBar = DomUtils.querySelector('#progress-bar');
const progressFill = DomUtils.querySelector('#progress-fill');
const startStopBtn = DomUtils.querySelector('#start-stop-btn');
const durationSlider = DomUtils.querySelector('#duration-slider');
const optionsLink = DomUtils.querySelector('#options-link');
const scheduleStatusEl = DomUtils.querySelector('#schedule-status');

function updateTimerDisplay(status = null) {
  if (!status) {
    const currentSliderValue = parseInt(durationSlider.value);
    const durationInMs = currentSliderValue * 60 * 1000;
    timerDisplay.textContent = Formatters.formatTimeRemaining(durationInMs);
    progressFill.style.width = '0%';
    return;
  }

  timerDisplay.textContent = Formatters.formatTimeRemaining(status.timeRemaining);

  const progressPercent = status.progress * 100;
  progressFill.style.width = `${progressPercent}%`;
}

async function updateUI() {
  const timerStatus = await Timer.getStatus();
  const sliderContainer = DomUtils.querySelector('.slider-container');

  // Manual timer takes priority
  if (timerStatus.isActive) {
    stopScheduleUpdates();
    scheduleStatusEl.style.display = 'none';
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';

    updateTimerDisplay(timerStatus);

    selectedDuration = Math.floor(timerStatus.totalDuration / (60 * 1000));
    durationSlider.value = selectedDuration;

    if (!Timer.timerInterval) {
      Timer.startUpdates(
        (status) => {
          updateTimerDisplay(status);
        },
        () => {
          updateUI(); // Refresh UI when timer expires
        }
      );
    }
    return;
  }

  // Check schedule
  const scheduleStatus = await Schedule.getStatus();

  if (scheduleStatus.isActive && scheduleStatus.isScheduled) {
    // Schedule window is active — show countdown to window end
    Timer.stopUpdates();
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';

    scheduleStatusEl.style.display = 'block';
    scheduleStatusEl.className = 'schedule-status active';
    scheduleStatusEl.textContent = 'Schedule active';

    updateTimerDisplay(scheduleStatus);
    startScheduleUpdates();
    return;
  }

  // Nothing active — show normal timer UI
  stopScheduleUpdates();
  sliderContainer.style.display = 'block';
  startStopBtn.style.display = 'block';
  startStopBtn.textContent = 'Start';
  startStopBtn.className = 'start-stop-btn start-btn btn btn-primary btn-full';

  Timer.stopUpdates();

  selectedDuration = parseInt(durationSlider.value);
  updateTimerDisplay();

  // Show next schedule window hint if schedule is configured
  if (scheduleStatus.isScheduled && scheduleStatus.nextWindow) {
    const nw = scheduleStatus.nextWindow;
    const dayName = Schedule.getDayNameShort(nw.day);
    scheduleStatusEl.style.display = 'block';
    scheduleStatusEl.className = 'schedule-status';
    scheduleStatusEl.textContent = `Next: ${dayName} ${nw.slot.start}`;
  } else {
    scheduleStatusEl.style.display = 'none';
  }
}

function startScheduleUpdates() {
  if (scheduleUpdateInterval) return;
  scheduleUpdateInterval = setInterval(async () => {
    const scheduleStatus = await Schedule.getStatus();
    if (scheduleStatus.isActive && scheduleStatus.isScheduled) {
      updateTimerDisplay(scheduleStatus);
    } else {
      // Window ended, refresh full UI
      updateUI();
    }
  }, 1000);
}

function stopScheduleUpdates() {
  if (scheduleUpdateInterval) {
    clearInterval(scheduleUpdateInterval);
    scheduleUpdateInterval = null;
  }
}

async function startBlocking() {
  await Timer.start(selectedDuration);
  await updateUI();
}

// Handle slider changes
async function handleSliderChange() {
  selectedDuration = parseInt(durationSlider.value);
  updateTimerDisplay(); // Update timer display immediately

  // Save duration to storage
  const settings = await Storage.loadTimerSettings();
  settings.duration = selectedDuration;
  await Storage.saveTimerSettings(settings);
}

DomUtils.addEventListener(startStopBtn, 'click', async () => {
  // Only allow starting, stopping is done from options page
  const isActive = await Timer.isActive();
  if (!isActive) {
    startBlocking();
  }
});

DomUtils.addEventListener(durationSlider, 'input', handleSliderChange);
DomUtils.addEventListener(durationSlider, 'change', handleSliderChange);

DomUtils.addEventListener(optionsLink, 'click', (e) => {
  e.preventDefault();
  DomUtils.openOptionsPage();
});

async function initPopup() {
  const settings = await Storage.loadTimerSettings();

  const isActive = await Timer.isActive();
  if (!isActive) {
    if (settings.duration && durationSlider.value == "30") {
      durationSlider.value = settings.duration;
    }
    selectedDuration = parseInt(durationSlider.value);
  }

  await updateUI();

  Timer.onTimerChanged(async (_) => {
    await updateUI();
  });

  // Listen for schedule changes
  Storage.onScheduleChanged(async () => {
    await updateUI();
  });

  // Listen for duration changes from other pages
  Storage.onTimerSettingsChanged(async (newSettings) => {
    if (newSettings.duration && newSettings.duration !== selectedDuration) {
      selectedDuration = newSettings.duration;
      durationSlider.value = selectedDuration;
      const isActive = await Timer.isActive();
      if (!isActive) {
        updateTimerDisplay();
      }
    }
  });
}

DomUtils.addEventListener(window, 'beforeunload', () => {
  Timer.stopUpdates();
  stopScheduleUpdates();
});

initPopup();
