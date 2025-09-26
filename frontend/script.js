document.addEventListener("DOMContentLoaded", function () {
  let countdown;
  let focusScoreInterval;

  const path = window.location.pathname;

  if (path.includes("index.html")) {
    setupLoginPage();
  } else if (path.includes("dashboard.html")) {
    setupDashboardPage();
  }
});

function setupLoginPage() {
  document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const fd = {
      username: e.target.username.value,
      password: e.target.password.value,
    };

    fetch("http://127.0.0.1:5000/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fd),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          localStorage.setItem("username", fd.username);
          window.location.href = "dashboard.html";
        } else {
          document.getElementById("message").innerText = data.message;
        }
      })
      .catch((err) => {
        console.error("Login failed:", err);
        document.getElementById("message").innerText =
          "Failed to connect to the server.";
      });
  });
}
function setupDashboardPage() {
  const timerDisplay = document.getElementById("timer");
  const statusDisplay = document.getElementById("status");
  const focusScoreDisplay = document.getElementById("focus-score");
  const videoElement = document.getElementById("video-feed");

  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const resetBtn = document.getElementById("resetBtn");

  let totalSeconds = 0;
  let sessionStartTime = null;

  let isSessionActive = false;

  function formatTime(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function updateTimerDisplay() {
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(totalSeconds);
    }
  }

  async function fetchDuration() {
    const username = localStorage.getItem("username") || "default_user";
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(`http://127.0.0.1:5000/duration`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, date: today }),
      });
      const data = await response.json();
      return data.duration || 25;
    } catch (error) {
      console.error("Failed to fetch session duration:", error);
      return 25;
    }
  }

  function startFocusDetection() {
    if (videoElement) {
      videoElement.src = "http://127.0.0.1:5000/video_feed";
    }
    focusScoreInterval = setInterval(async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_focus_score");
        const data = await response.json();

        if (focusScoreDisplay) {
          focusScoreDisplay.textContent = `Focus Score: ${(
            data.focus_score * 100
          ).toFixed(1)}%`;
        }

        if (statusDisplay) {
          if (data.focus_score > 0.7) {
            statusDisplay.textContent = "Status: Focused";
            statusDisplay.className = "status-focused";
          } else if (data.focus_score > 0.3) {
            statusDisplay.textContent = "Status: Partially Focused";
            statusDisplay.className = "status-partial";
          } else {
            statusDisplay.textContent = "Status: Not Focused";
            statusDisplay.className = "status-not-focused";
          }
        }
      } catch (error) {
        console.error("Error fetching focus score:", error);
      }
    }, 1000);
  }

  function stopFocusDetection() {
    clearInterval(focusScoreInterval);
    if (videoElement) {
      videoElement.src = "";
    }
    if (focusScoreDisplay) {
      focusScoreDisplay.textContent = "Focus Score: -";
    }
    if (statusDisplay) {
      statusDisplay.textContent = "Status: -";
      statusDisplay.className = "";
    }
  }

  async function startTimer() {
    if (isSessionActive) return;

    isSessionActive = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    resetBtn.disabled = true;
    startBtn.innerText = "Session Started";
    stopBtn.innerText = "Stop"; // Added line to reset stop button text

    startFocusDetection();

    try {
      await fetch("http://127.0.0.1:5000/start_session");
      const minutes = await fetchDuration();
      totalSeconds = minutes * 60;
      updateTimerDisplay();
      sessionStartTime = new Date();
      //alert("Started session");
      countdown = setInterval(() => {
        totalSeconds--;
        updateTimerDisplay();
        if (totalSeconds <= 0) {
          clearInterval(countdown);
          stopTimer(true);
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to start session:", error);
      resetState();
    }
  }

  async function stopTimer(autoEnded = false) {
    if (!isSessionActive) return;

    isSessionActive = false;
    clearInterval(countdown);
    stopFocusDetection();

    try {
      const sessionResults = await fetch(
        "http://127.0.0.1:5000/stop_session"
      ).then((res) => res.json());

      const now = new Date();
      const durationCompleted = Math.floor(
        (now - sessionStartTime) / 1000 / 60
      );
      const username = localStorage.getItem("username");

      const payload = {
        username: username,
        session_number: 1,
        duration_completed: durationCompleted,
        date: new Date().toISOString().split("T")[0],
        focus_score: sessionResults.average_focus_score,
        focus_percentage: sessionResults.focus_percentage,
      };

      console.log("Saving session data:", payload);
      await fetch("http://127.0.0.1:5000/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to stop session or save data:", error);
    } finally {
      stopBtn.innerText = autoEnded ? "Session Complete" : "Session Stopped";
      // This timeout allows the button text to show for a moment
      setTimeout(() => {
        resetState();
      }, 1500);
    }
  }

  async function resetTimer() {
    if (isSessionActive) {
      await stopTimer(false);
    }
    const minutes = await fetchDuration();
    totalSeconds = minutes * 60;
    updateTimerDisplay();
    resetState();
  }

  function resetState() {
    isSessionActive = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    resetBtn.disabled = false;
    startBtn.innerText = "Start";
    stopBtn.innerText = "Stop";
  }

  startBtn.addEventListener("click", startTimer);
  stopBtn.addEventListener("click", () => stopTimer(false));
  resetBtn.addEventListener("click", resetTimer);

  // Initialize on page load
  window.addEventListener("load", async () => {
    const minutes = await fetchDuration();
    totalSeconds = minutes * 60;
    updateTimerDisplay();
    stopBtn.disabled = true;
  });
}
function stopSession() {
  fetch("http://127.0.0.1:5000/stop_session")
    .then((r) => r.json())
    .then((data) => console.log("Session stopped:", data));
}
let lastWarningCount = 0;
function checkWarnings() {
  fetch("http://127.0.0.1:5000/warning_status")
    .then((res) => res.json())
    .then((data) => {
      const warnings = data.warnings;
      if (warnings >= 2) {
        console.log("⚠ Auto-clicking Stop button...");
        document.getElementById("stopBtn").click();
      }
      if (warnings > lastWarningCount) {
        alert(`Warning ${warnings} : Stay Focused! `);
      }
      lastWarningCount = warnings;
    });
}

// check every 2 seconds
setInterval(checkWarnings, 2000);
