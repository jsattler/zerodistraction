let selectedDuration = 30; // Default 30 minutes

const timerDisplay = DomUtils.querySelector('#timer-display');
const progressBar = DomUtils.querySelector('#progress-bar');
const progressFill = DomUtils.querySelector('#progress-fill');
const startStopBtn = DomUtils.querySelector('#start-stop-btn');
const durationSlider = DomUtils.querySelector('#duration-slider');
const optionsLink = DomUtils.querySelector('#options-link');

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
  const status = await Timer.getStatus();
  const sliderContainer = DomUtils.querySelector('.slider-container');

  if (status.isActive) {
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';

    updateTimerDisplay(status);

    selectedDuration = Math.floor(status.totalDuration / (60 * 1000));
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
  } else {
    sliderContainer.style.display = 'block';
    startStopBtn.style.display = 'block';
    startStopBtn.textContent = 'Start';
    startStopBtn.className = 'start-stop-btn start-btn btn btn-primary btn-full';

    Timer.stopUpdates();

    selectedDuration = parseInt(durationSlider.value);

    updateTimerDisplay();
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

// Debounced function for any heavy operations (if needed in future)
const handleSliderChangeDebounced = MiscUtils.debounce(async () => {
  // Reserved for heavy operations that need debouncing
}, 100);

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
});

initPopup();
