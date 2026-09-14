import { useEffect, useState } from "react";
import "./App.css";

/* =========================================================
   API CONFIGURATION
========================================================= */

const API_BASE_URL = "http://localhost:5000/api";

/* =========================================================
   APP
========================================================= */

function App() {
  const [dashboard, setDashboard] = useState({
    total_activities: 0,
    average_planned_progress: 0,
    average_actual_progress: 0,
    overall_variance: 0,
    overall_status: "Loading...",
    activities: [],
  });

  const [supervisorInput, setSupervisorInput] = useState("");

  const [result, setResult] = useState(null);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState("");

  /* =========================================================
     LOAD DASHBOARD
  ========================================================= */

  const loadDashboard = async () => {
  try {
    setLoadingDashboard(true);
    setError("");

    const [activitiesResponse, performanceResponse] =
      await Promise.all([
        fetch(`${API_BASE_URL}/activities`),
        fetch(`${API_BASE_URL}/project-performance`),
      ]);

    if (!activitiesResponse.ok) {
      throw new Error(
        `Activities request failed: ${activitiesResponse.status}`
      );
    }

    if (!performanceResponse.ok) {
      throw new Error(
        `Project performance request failed: ${performanceResponse.status}`
      );
    }

    const activitiesData =
      await activitiesResponse.json();

    const performanceData =
      await performanceResponse.json();

    setDashboard({
      total_activities:
        Number(performanceData.total_activities) ||
        activitiesData.length ||
        0,

      average_planned_progress:
        Number(
          performanceData.average_planned_progress
        ) || 0,

      average_actual_progress:
        Number(
          performanceData.average_actual_progress
        ) || 0,

      overall_variance:
        Number(
          performanceData.overall_variance
        ) || 0,

      overall_status:
        performanceData.overall_status ||
        "On Schedule",

      activities:
        Array.isArray(activitiesData)
          ? activitiesData
          : [],
    });

  } catch (err) {
    console.error("Dashboard error:", err);

    setError(
      "Unable to load dashboard data. Please make sure the ConstructX backend is running."
    );

  } finally {
    setLoadingDashboard(false);
  }
};

  /* =========================================================
     INITIAL DASHBOARD LOAD
  ========================================================= */

  useEffect(() => {
    loadDashboard();
  }, []);

  /* =========================================================
     PROCESS SUPERVISOR UPDATE
  ========================================================= */

  const processUpdate = async () => {
    if (!supervisorInput.trim()) {
      setError("Please enter a supervisor progress update.");
      return;
    }

    try {
      setProcessing(true);
      setError("");
      setResult(null);

      const response = await fetch(
        `${API_BASE_URL}/api/process-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supervisor_input: supervisorInput.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to process update."
        );
      }

      setResult(data);

      /*
        If the backend successfully updated PostgreSQL,
        refresh dashboard values.
      */

      if (
        data.message === "Update processed successfully" ||
        data.update_id ||
        data.updated_activity
      ) {
        await loadDashboard();
      }
    } catch (err) {
      console.error("Process update error:", err);

      setError(
        err.message ||
          "Something went wrong while processing the update."
      );
    } finally {
      setProcessing(false);
    }
  };

  /* =========================================================
     ENTER KEY SUPPORT
  ========================================================= */

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && event.ctrlKey) {
      processUpdate();
    }
  };

  /* =========================================================
     FORMAT NUMBER
  ========================================================= */

  const formatPercentage = (value) => {
    const number = Number(value);

    if (Number.isNaN(number)) {
      return "0%";
    }

    return `${number.toFixed(2).replace(/\.00$/, "")}%`;
  };

  /* =========================================================
     RISK
  ========================================================= */

  const getRiskLevel = (activity) => {
    if (activity.risk_level) {
      return activity.risk_level;
    }

    const variance =
      Number(activity.progress_variance) || 0;

    if (variance <= -10) {
      return "High";
    }

    if (variance < 0) {
      return "Medium";
    }

    return "Low";
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="app">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="header">
        <h1>ConstructX</h1>

        <p>
          AI-powered construction progress monitoring
        </p>
      </header>

      <main className="container">

        {/* ===================================================
            DASHBOARD CARDS
        =================================================== */}

        <section className="cards">

          <div className="card">
            <span>Total Activities</span>

            <strong>
              {loadingDashboard
                ? "..."
                : dashboard.total_activities}
            </strong>
          </div>

          <div className="card">
            <span>Planned Progress</span>

            <strong>
              {loadingDashboard
                ? "..."
                : formatPercentage(
                    dashboard.average_planned_progress
                  )}
            </strong>
          </div>

          <div className="card">
            <span>Actual Progress</span>

            <strong>
              {loadingDashboard
                ? "..."
                : formatPercentage(
                    dashboard.average_actual_progress
                  )}
            </strong>
          </div>

          <div className="card">
            <span>Overall Variance</span>

            <strong
              className={
                dashboard.overall_variance < 0
                  ? "negative"
                  : dashboard.overall_variance > 0
                  ? "positive"
                  : ""
              }
            >
              {loadingDashboard
                ? "..."
                : `${dashboard.overall_variance > 0 ? "+" : ""}${Number(
                    dashboard.overall_variance
                  ).toFixed(2)}%`}
            </strong>
          </div>

        </section>

        {/* ===================================================
            PROJECT STATUS
        =================================================== */}

        <section className="status-box">

          <h3>Overall Project Status</h3>

          <div
            className={
              dashboard.overall_status
                ?.toLowerCase()
                .includes("behind")
                ? "status behind"
                : "status"
            }
          >
            {loadingDashboard
              ? "Loading..."
              : dashboard.overall_status}
          </div>

        </section>

        {/* ===================================================
            SUPERVISOR AI INPUT
        =================================================== */}

        <section className="ai-input-section">

          <h2>
            🤖 Supervisor Progress Update
          </h2>

          <p className="section-description">
            Enter the update in normal language. The AI will
            identify the activity, extract progress details,
            detect missing information, and update the project.
          </p>

          <textarea
            value={supervisorInput}
            onChange={(event) =>
              setSupervisorInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder='Example: "Line 240 is 70% complete today at 5 PM"'
            disabled={processing}
          />

          <button
            onClick={processUpdate}
            disabled={processing}
          >
            {processing
              ? "Processing..."
              : "Process Update"}
          </button>

          {error && (
            <div className="error">
              ⚠️ {error}
            </div>
          )}

        </section>

        {/* ===================================================
            AI PROCESSING RESULT
        =================================================== */}

        {result && (
          <section className="result-box">

            <h2>
              ✅ AI Processing Result
            </h2>

            <div className="result-grid">

              {/* MATCHED ACTIVITY */}

              <div>
                <label>Matched Activity</label>

                <strong>
                  {result.matched_activity
                    ?.activity_code ||
                    "Not identified"}
                </strong>

                <p>
                  {result.matched_activity
                    ?.activity_name ||
                    "Not identified"}
                </p>
              </div>

              {/* CONFIDENCE */}

              <div>
                <label>Confidence</label>

                <strong>
                  {result.confidence ||
                    "Not provided"}
                </strong>
              </div>

              {/* ACTION */}

              <div>
                <label>Action</label>

                <strong>
                  {result.extracted_details
                    ?.action ||
                    "Not provided"}
                </strong>
              </div>

              {/* PROGRESS */}

              <div>
                <label>Progress</label>

                <strong>
                  {result.extracted_details
                    ?.progress_percentage != null
                    ? `${result.extracted_details.progress_percentage}%`
                    : "Not provided"}
                </strong>
              </div>

              {/* DATE */}

              <div>
                <label>Date</label>

                <strong>
                  {result.extracted_details
                    ?.date ||
                    "Not provided"}
                </strong>
              </div>

              {/* TIME */}

              <div>
                <label>Time</label>

                <strong>
                  {result.extracted_details
                    ?.time ||
                    "Not provided"}
                </strong>
              </div>

            </div>

            {/* =================================================
                CLARIFICATION
            ================================================= */}

            {result.clarification
              ?.clarification_required && (
              <div className="clarification">

                <strong>
                  ⚠️ Clarification Required
                </strong>

                <div>
                  {result.clarification
                    ?.clarification_question ||
                    "Additional information is required."}
                </div>

              </div>
            )}

            {/* =================================================
                SUCCESS
            ================================================= */}

            {!result.clarification
              ?.clarification_required &&
              (result.updated_activity ||
                result.update_id) && (
              <div className="success">
                ✓ Activity updated successfully in PostgreSQL.
              </div>
            )}

          </section>
        )}

        {/* ===================================================
            ACTIVITY PROGRESS
        =================================================== */}

        <section className="activity-section">

          <h2>Activity Progress</h2>

          <p>
            Planned vs actual project progress
          </p>

          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Discipline</th>
                  <th>Planned</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>

                {dashboard.activities.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={{
                        textAlign: "center",
                        padding: "30px",
                      }}
                    >
                      {loadingDashboard
                        ? "Loading activities..."
                        : "No activities found."}
                    </td>
                  </tr>
                ) : (
                  dashboard.activities.map(
                    (activity) => {

                      const planned =
                        Number(
                          activity.planned_progress
                        ) || 0;

                      const actual =
                        Number(
                          activity.actual_progress
                        ) || 0;

                      const variance =
                        Number(
                          activity.progress_variance
                        ) ||
                        actual - planned;

                      const risk =
                        getRiskLevel(activity);

                      return (
                        <tr
                          key={
                            activity.activity_id ||
                            activity.id
                          }
                        >

                          {/* ACTIVITY */}

                          <td>
                            <strong>
                              {activity.activity_code}
                            </strong>

                            <br />

                            <small>
                              {activity.activity_name ||
                                activity.name}
                            </small>
                          </td>

                          {/* DISCIPLINE */}

                          <td>
                            {activity.discipline ||
                              "—"}
                          </td>

                          {/* PLANNED */}

                          <td>
                            {formatPercentage(
                              planned
                            )}
                          </td>

                          {/* ACTUAL */}

                          <td>
                            {formatPercentage(
                              actual
                            )}
                          </td>

                          {/* VARIANCE */}

                          <td
                            className={
                              variance > 0
                                ? "positive"
                                : variance < 0
                                ? "negative"
                                : ""
                            }
                          >
                            {variance > 0
                              ? "+"
                              : ""}
                            {variance}%
                          </td>

                          {/* RISK */}

                          <td>
                            <span
                              className={`risk ${risk.toLowerCase()}`}
                            >
                              {risk}
                            </span>
                          </td>

                          {/* STATUS */}

                          <td>
                            {activity.status ||
                              (variance < 0
                                ? "Behind"
                                : variance === 0
                                ? "On Track"
                                : "Ahead")}
                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

      </main>

    </div>
  );
}

export default App;