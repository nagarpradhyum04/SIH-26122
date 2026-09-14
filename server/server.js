const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
app.use(cors());
app.use(express.json());


// =====================================================
// DATABASE
// =====================================================

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});


// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message: "ConstructX Backend is running!",
    project: "ConstructX",
    status: "online",
  });
});


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "ConstructX backend and database are connected",
      database: "connected",
    });

  } catch (error) {
    console.error("HEALTH CHECK ERROR:", error);

    res.status(500).json({
      success: false,
      message: "ConstructX backend is running but database connection failed",
      database: "disconnected",
    });
  }
});


// =====================================================
// TEST DATABASE
// =====================================================

app.get("/api/test-db", async (req, res) => {
  try {

    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected successfully!",
      time: result.rows[0].now,
    });

  } catch (error) {

    console.error("DATABASE ERROR:", error);

    res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
});


// =====================================================
// GET ACTIVITIES
// =====================================================

app.get("/api/activities", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        activity_code,
        name,
        discipline,
        planned_start,
        planned_end,
        planned_progress,
        actual_progress,
        status
      FROM activities
      ORDER BY id;
    `);

    const activities = result.rows.map((activity) => {

      const planned = Number(activity.planned_progress || 0);
      const actual = Number(activity.actual_progress || 0);

      const variance = Number(
        (actual - planned).toFixed(2)
      );

      let performance_status;

      if (variance > 0) {
        performance_status = "Ahead";
      } else if (variance < 0) {
        performance_status = "Behind";
      } else {
        performance_status = "On Schedule";
      }

      return {
        ...activity,

        planned_progress: planned,
        actual_progress: actual,

        progress_variance: variance,

        performance_status,
      };
    });

    res.json(activities);

  } catch (error) {

    console.error("ACTIVITIES ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch activities",
      error: error.message,
    });
  }
});


// =====================================================
// PROJECT PERFORMANCE
// =====================================================

app.get("/api/project-performance", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_activities,

        COUNT(*) FILTER (
          WHERE actual_progress > planned_progress
        ) AS ahead,

        COUNT(*) FILTER (
          WHERE actual_progress = planned_progress
        ) AS on_schedule,

        COUNT(*) FILTER (
          WHERE actual_progress < planned_progress
        ) AS behind,

        ROUND(AVG(planned_progress), 2)
          AS average_planned_progress,

        ROUND(AVG(actual_progress), 2)
          AS average_actual_progress

      FROM activities;
    `);

    const data = result.rows[0];

    const averagePlanned =
      Number(data.average_planned_progress || 0);

    const averageActual =
      Number(data.average_actual_progress || 0);

    const overallVariance = Number(
      (averageActual - averagePlanned).toFixed(2)
    );

    let overallStatus;

    if (overallVariance > 0) {

      overallStatus = "Ahead of Schedule";

    } else if (overallVariance < 0) {

      overallStatus = "Behind Schedule";

    } else {

      overallStatus = "On Schedule";
    }

    res.json({

      total_activities:
        Number(data.total_activities),

      ahead:
        Number(data.ahead),

      on_schedule:
        Number(data.on_schedule),

      behind:
        Number(data.behind),

      average_planned_progress:
        averagePlanned,

      average_actual_progress:
        averageActual,

      overall_variance:
        overallVariance,

      overall_status:
        overallStatus,
    });

  } catch (error) {

    console.error(
      "PROJECT PERFORMANCE ERROR:",
      error
    );

    res.status(500).json({
      message: "Failed to calculate project performance",
      error: error.message,
    });
  }
});


// =====================================================
// DELAY RISK
// =====================================================

app.get("/api/delay-risk", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        activity_code,
        name,
        discipline,
        planned_progress,
        actual_progress,
        status
      FROM activities
      ORDER BY id;
    `);

    const activities = result.rows.map((activity) => {

      const planned =
        Number(activity.planned_progress || 0);

      const actual =
        Number(activity.actual_progress || 0);

      const variance = Number(
        (actual - planned).toFixed(2)
      );

      let risk_level;
      let risk_message;

      if (variance >= 0) {

        risk_level = "Low";

        risk_message =
          "Activity is on or ahead of schedule.";

      } else if (variance >= -10) {

        risk_level = "Medium";

        risk_message =
          `Activity is ${Math.abs(
            variance
          )} percentage points behind plan.`;

      } else {

        risk_level = "High";

        risk_message =
          `Activity is ${Math.abs(
            variance
          )} percentage points behind plan and requires attention.`;
      }

      return {

        activity_id:
          activity.id,

        activity_code:
          activity.activity_code,

        activity_name:
          activity.name,

        discipline:
          activity.discipline,

        planned_progress:
          planned,

        actual_progress:
          actual,

        progress_variance:
          variance,

        risk_level,

        risk_message,
      };
    });

    const highRisk =
      activities.filter(
        (activity) =>
          activity.risk_level === "High"
      );

    const mediumRisk =
      activities.filter(
        (activity) =>
          activity.risk_level === "Medium"
      );

    res.json({

      total_activities:
        activities.length,

      high_risk_count:
        highRisk.length,

      medium_risk_count:
        mediumRisk.length,

      low_risk_count:
        activities.length -
        highRisk.length -
        mediumRisk.length,

      high_risk_activities:
        highRisk,

      medium_risk_activities:
        mediumRisk,

      all_activities:
        activities,
    });

  } catch (error) {

    console.error(
      "DELAY RISK ERROR:",
      error
    );

    res.status(500).json({
      message: "Failed to calculate delay risk",
      error: error.message,
    });
  }
});


// =====================================================
// RECOMMENDATIONS
// =====================================================

app.get("/api/recommendations", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        activity_code,
        name,
        discipline,
        planned_progress,
        actual_progress,
        status
      FROM activities
      ORDER BY id;
    `);

    const recommendations =
      result.rows.map((activity) => {

        const planned =
          Number(activity.planned_progress || 0);

        const actual =
          Number(activity.actual_progress || 0);

        const variance = Number(
          (actual - planned).toFixed(2)
        );

        let risk_level;
        let recommendation;
        let priority;

        if (variance >= 0) {

          risk_level = "Low";
          priority = "Normal";

          recommendation =
            "No immediate action required. Continue monitoring the activity.";

        } else if (variance >= -10) {

          risk_level = "Medium";
          priority = "Monitor";

          recommendation =
            `Review the activity progress and identify the cause of the ${Math.abs(
              variance
            )} percentage-point gap. Monitor the activity closely.`;

        } else {

          risk_level = "High";
          priority = "Urgent";

          recommendation =
            `Immediate attention required. Investigate the cause of the ${Math.abs(
              variance
            )} percentage-point delay and consider reallocating resources or taking corrective action.`;
        }

        return {

          activity_id:
            activity.id,

          activity_code:
            activity.activity_code,

          activity_name:
            activity.name,

          discipline:
            activity.discipline,

          planned_progress:
            planned,

          actual_progress:
            actual,

          progress_variance:
            variance,

          risk_level,

          priority,

          recommendation,
        };
      });

    const action_required =
      recommendations.filter(
        (activity) =>
          activity.risk_level === "High" ||
          activity.risk_level === "Medium"
      );

    res.json({

      total_activities:
        recommendations.length,

      action_required_count:
        action_required.length,

      high_priority_count:
        recommendations.filter(
          (activity) =>
            activity.priority === "Urgent"
        ).length,

      monitor_count:
        recommendations.filter(
          (activity) =>
            activity.priority === "Monitor"
        ).length,

      action_required,

      all_recommendations:
        recommendations,
    });

  } catch (error) {

    console.error(
      "RECOMMENDATIONS ERROR:",
      error
    );

    res.status(500).json({
      message: "Failed to generate recommendations",
      error: error.message,
    });
  }
});


// =====================================================
// PROJECT SUMMARY
// =====================================================

app.get("/api/summary", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_activities,

        COUNT(*) FILTER (
          WHERE status = 'Completed'
        ) AS completed,

        COUNT(*) FILTER (
          WHERE status = 'In Progress'
        ) AS in_progress,

        COUNT(*) FILTER (
          WHERE status = 'On Track'
        ) AS on_track

      FROM activities;
    `);

    res.json({

      total_activities:
        Number(result.rows[0].total_activities || 0),

      completed:
        Number(result.rows[0].completed || 0),

      in_progress:
        Number(result.rows[0].in_progress || 0),

      on_track:
        Number(result.rows[0].on_track || 0),
    });

  } catch (error) {

    console.error(
      "SUMMARY ERROR:",
      error
    );

    res.status(500).json({
      message: "Failed to fetch project summary",
      error: error.message,
    });
  }
});


// =====================================================
// SAVE SUPERVISOR UPDATE
// =====================================================

app.post("/api/progress-updates", async (req, res) => {

  try {

    const { supervisor_input } =
      req.body;

    if (
      !supervisor_input ||
      !supervisor_input.trim()
    ) {

      return res.status(400).json({
        message:
          "Supervisor input is required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO progress_updates
      (supervisor_input)
      VALUES ($1)
      RETURNING *;
      `,
      [
        supervisor_input.trim()
      ]
    );

    res.status(201).json({

      message:
        "Progress update saved successfully",

      update:
        result.rows[0],
    });

  } catch (error) {

    console.error(
      "SAVE UPDATE ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Failed to save progress update",

      error:
        error.message,
    });
  }
});


// =====================================================
// GET SUPERVISOR UPDATES
// =====================================================

app.get("/api/progress-updates", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        supervisor_input,
        extracted_activity,
        extracted_action,
        actual_start,
        actual_end,
        progress_percentage,
        clarification_required,
        clarification_question,
        created_at
      FROM progress_updates
      ORDER BY created_at DESC;
    `);

    res.json(result.rows);

  } catch (error) {

    console.error(
      "GET UPDATES ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch progress updates",

      error:
        error.message,
    });
  }
});


// =====================================================
// PREPARE UPDATE FOR AI
// =====================================================

app.get("/api/process-update/:id", async (req, res) => {

  try {

    const updateId =
      req.params.id;

    const updateResult =
      await pool.query(
        `
        SELECT *
        FROM progress_updates
        WHERE id = $1;
        `,
        [updateId]
      );

    if (
      updateResult.rows.length === 0
    ) {

      return res.status(404).json({
        message:
          "Progress update not found",
      });
    }

    const update =
      updateResult.rows[0];

    const activitiesResult =
      await pool.query(`
        SELECT
          id,
          activity_code,
          name,
          discipline,
          planned_start,
          planned_end,
          planned_progress,
          actual_progress,
          status
        FROM activities
        ORDER BY id;
      `);

    res.json({

      message:
        "Update ready for AI processing",

      supervisor_input:
        update.supervisor_input,

      available_activities:
        activitiesResult.rows,
    });

  } catch (error) {

    console.error(
      "PREPARE UPDATE ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Failed to prepare update for processing",

      error:
        error.message,
    });
  }
});


// =====================================================
// HELPER - SAVE AI RESULT
// =====================================================

async function saveAIResult(
  updateId,
  matchedActivity,
  aiResult,
  updatedActivity
) {

  const details =
    aiResult.extracted_details || {};

  const progress =
    details.progress_percentage;

  await pool.query(
    `
    UPDATE progress_updates
    SET
      extracted_activity = $1,
      extracted_action = $2,
      actual_start = $3,
      actual_end = $4,
      progress_percentage = $5,
      clarification_required = false,
      clarification_question = null
    WHERE id = $6;
    `,
    [

      matchedActivity?.activity_name ||
        null,

      details.action ||
        null,

      details.actual_start ||
        details.date ||
        null,

      details.actual_end ||
        details.time ||
        null,

      progress !== null &&
      progress !== undefined
        ? Number(progress)
        : null,

      updateId,
    ]
  );
}


// =====================================================
// PROCESS UPDATE WITH AI
// =====================================================

app.post("/api/process-update/:id", async (req, res) => {

  try {

    const updateId =
      req.params.id;


    // -------------------------------------------------
    // GET UPDATE
    // -------------------------------------------------

    const updateResult =
      await pool.query(
        `
        SELECT *
        FROM progress_updates
        WHERE id = $1;
        `,
        [updateId]
      );

    if (
      updateResult.rows.length === 0
    ) {

      return res.status(404).json({
        message:
          "Progress update not found",
      });
    }

    const update =
      updateResult.rows[0];


    // -------------------------------------------------
    // GET ACTIVITIES
    // -------------------------------------------------

    const activitiesResult =
      await pool.query(`
        SELECT
          id,
          activity_code,
          name,
          discipline,
          planned_start,
          planned_end,
          planned_progress,
          actual_progress,
          status
        FROM activities
        ORDER BY id;
      `);

    const activities =
      activitiesResult.rows;


    // -------------------------------------------------
    // CALL AI SERVICE
    // -------------------------------------------------

    const aiResponse =
      await fetch(
        `${AI_SERVICE_URL}/api/process-update`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            supervisor_input:
              update.supervisor_input,

            activities:
              activities,
          }),
        }
      );


    if (!aiResponse.ok) {

      const aiError =
        await aiResponse.text();

      console.error(
        "AI SERVICE ERROR:",
        aiError
      );

      return res.status(500).json({

        message:
          "AI processing failed",

        ai_error:
          aiError,
      });
    }


    const aiResult =
      await aiResponse.json();


    // -------------------------------------------------
    // CHECK CLARIFICATION
    // -------------------------------------------------

    if (
      aiResult.clarification &&
      aiResult.clarification
        .clarification_required
    ) {

      await pool.query(
        `
        UPDATE progress_updates
        SET
          extracted_activity = $1,
          extracted_action = $2,
          clarification_required = true,
          clarification_question = $3,
          progress_percentage = $4
        WHERE id = $5;
        `,
        [

          aiResult.matched_activity
            ?.activity_name || null,

          aiResult.extracted_details
            ?.action || null,

          aiResult.clarification
            ?.clarification_question || null,

          aiResult.extracted_details
            ?.progress_percentage || null,

          updateId,
        ]
      );


      return res.json({

        message:
          "Clarification required",

        update_id:
          updateId,

        supervisor_input:
          update.supervisor_input,

        matched_activity:
          aiResult.matched_activity,

        confidence:
          aiResult.confidence,

        extracted_details:
          aiResult.extracted_details,

        clarification:
          aiResult.clarification,

        all_matches:
          aiResult.all_matches,
      });
    }


    // -------------------------------------------------
    // MATCHED ACTIVITY
    // -------------------------------------------------

    const matchedActivity =
      aiResult.matched_activity;


    if (!matchedActivity) {

      return res.status(400).json({

        message:
          "AI could not identify an activity",
      });
    }


    const activityId =
      matchedActivity.activity_id;


    // -------------------------------------------------
    // EXTRACT PROGRESS
    // -------------------------------------------------

    const extractedProgress =
      aiResult.extracted_details
        ?.progress_percentage;


    let updatedActivity = null;


    // -------------------------------------------------
    // UPDATE ACTIVITY
    // -------------------------------------------------

    if (
      extractedProgress !== null &&
      extractedProgress !== undefined
    ) {

      const progress =
        Number(extractedProgress);


      if (
        Number.isNaN(progress) ||
        progress < 0 ||
        progress > 100
      ) {

        return res.status(400).json({

          message:
            "Invalid progress percentage",
        });
      }


      let status;


      if (progress >= 100) {

        status =
          "Completed";

      } else if (progress > 0) {

        status =
          "In Progress";

      } else {

        status =
          "On Track";
      }


      const activityUpdateResult =
        await pool.query(
          `
          UPDATE activities
          SET
            actual_progress = $1,
            status = $2
          WHERE id = $3
          RETURNING *;
          `,
          [
            progress,
            status,
            activityId,
          ]
        );


      updatedActivity =
        activityUpdateResult.rows[0];
    }


    // -------------------------------------------------
    // SAVE AI DATA
    // -------------------------------------------------

    await saveAIResult(
      updateId,
      matchedActivity,
      aiResult,
      updatedActivity
    );


    // -------------------------------------------------
    // FINAL RESPONSE
    // -------------------------------------------------

    res.json({

      message:
        "Update processed successfully",

      update_id:
        updateId,

      supervisor_input:
        update.supervisor_input,

      matched_activity:
        matchedActivity,

      confidence:
        aiResult.confidence,

      extracted_details:
        aiResult.extracted_details,

      clarification:
        aiResult.clarification,

      updated_activity:
        updatedActivity,

      all_matches:
        aiResult.all_matches,
    });

  } catch (error) {

    console.error(
      "PROCESS UPDATE ERROR:",
      error
    );

    res.status(500).json({

      message:
        "Failed to process update",

      error:
        error.message,
    });
  }
});


// =====================================================
// ANSWER CLARIFICATION AND REPROCESS
// =====================================================

app.post("/api/clarify-update/:id", async (req, res) => {

  try {

    const updateId =
      req.params.id;

    const {
      clarification_answer
    } = req.body;


    if (
      !clarification_answer ||
      !clarification_answer.trim()
    ) {

      return res.status(400).json({

        message:
          "Clarification answer is required",
      });
    }


    // -------------------------------------------------
    // GET ORIGINAL UPDATE
    // -------------------------------------------------

    const updateResult =
      await pool.query(
        `
        SELECT *
        FROM progress_updates
        WHERE id = $1;
        `,
        [updateId]
      );


    if (
      updateResult.rows.length === 0
    ) {

      return res.status(404).json({

        message:
          "Progress update not found",
      });
    }


    const update =
      updateResult.rows[0];


    // -------------------------------------------------
    // COMBINE INPUT
    // -------------------------------------------------

    const combinedInput =
      `${update.supervisor_input}. Additional clarification: ${clarification_answer.trim()}`;


    // -------------------------------------------------
    // GET ACTIVITIES
    // -------------------------------------------------

    const activitiesResult =
      await pool.query(`
        SELECT
          id,
          activity_code,
          name,
          discipline,
          planned_start,
          planned_end,
          planned_progress,
          actual_progress,
          status
        FROM activities
        ORDER BY id;
      `);


    const activities =
      activitiesResult.rows;


    // -------------------------------------------------
    // CALL AI AGAIN
    // -------------------------------------------------

    const aiResponse =
      await fetch(
        `${AI_SERVICE_URL}/api/process-update`,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({

            supervisor_input:
              combinedInput,

            activities:
              activities,
          }),
        }
      );


    if (!aiResponse.ok) {

      const aiError =
        await aiResponse.text();

      console.error(
        "AI SERVICE ERROR:",
        aiError
      );

      return res.status(500).json({

        message:
          "AI processing failed",

        ai_error:
          aiError,
      });
    }


    const aiResult =
      await aiResponse.json();


    // -------------------------------------------------
    // STILL NEEDS CLARIFICATION
    // -------------------------------------------------

    if (
      aiResult.clarification &&
      aiResult.clarification
        .clarification_required
    ) {

      await pool.query(
        `
        UPDATE progress_updates
        SET
          supervisor_input = $1,
          extracted_activity = $2,
          extracted_action = $3,
          clarification_required = true,
          clarification_question = $4,
          progress_percentage = $5
        WHERE id = $6;
        `,
        [

          combinedInput,

          aiResult.matched_activity
            ?.activity_name || null,

          aiResult.extracted_details
            ?.action || null,

          aiResult.clarification
            ?.clarification_question || null,

          aiResult.extracted_details
            ?.progress_percentage || null,

          updateId,
        ]
      );


      return res.json({

        message:
          "More clarification required",

        update_id:
          updateId,

        supervisor_input:
          combinedInput,

        matched_activity:
          aiResult.matched_activity,

        confidence:
          aiResult.confidence,

        extracted_details:
          aiResult.extracted_details,

        clarification:
          aiResult.clarification,

        all_matches:
          aiResult.all_matches,
      });
    }


    // -------------------------------------------------
    // MATCHED ACTIVITY
    // -------------------------------------------------

    const matchedActivity =
      aiResult.matched_activity;


    if (!matchedActivity) {

      return res.status(400).json({

        message:
          "AI could not identify an activity",
      });
    }


    const activityId =
      matchedActivity.activity_id;


    // -------------------------------------------------
    // EXTRACT PROGRESS
    // -------------------------------------------------

    const extractedProgress =
      aiResult.extracted_details
        ?.progress_percentage;


    let updatedActivity = null;


    // -------------------------------------------------
    // UPDATE ACTIVITY
    // -------------------------------------------------

    if (
      extractedProgress !== null &&
      extractedProgress !== undefined
    ) {

      const progress =
        Number(extractedProgress);


      if (
        Number.isNaN(progress) ||
        progress < 0 ||
        progress > 100
      ) {

        return res.status(400).json({

          message:
            "Invalid progress percentage",
        });
      }


      let status;


      if (progress >= 100) {

        status =
          "Completed";

      } else if (progress > 0) {

        status =
          "In Progress";

      } else {

        status =
          "On Track";
      }


      const activityUpdateResult =
        await pool.query(
          `
          UPDATE activities
          SET
            actual_progress = $1,
            status = $2
          WHERE id = $3
          RETURNING *;
          `,
          [
            progress,
            status,
            activityId,
          ]
        );


      updatedActivity =
        activityUpdateResult.rows[0];
    }


    // -------------------------------------------------
    // SAVE CLARIFIED UPDATE
    // -------------------------------------------------

    await pool.query(
      `
      UPDATE progress_updates
      SET
        supervisor_input = $1,
        extracted_activity = $2,
        extracted_action = $3,
        actual_start = $4,
        actual_end = $5,
        progress_percentage = $6,
        clarification_required = false,
        clarification_question = null
      WHERE id = $7;
      `,
      [

        combinedInput,

        matchedActivity.activity_name,

        aiResult.extracted_details
          ?.action || null,

        aiResult.extracted_details
          ?.actual_start ||
          aiResult.extracted_details
            ?.date ||
          null,

        aiResult.extracted_details
          ?.actual_end ||
          aiResult.extracted_details
            ?.time ||
          null,

        extractedProgress !== null &&
        extractedProgress !== undefined
          ? Number(extractedProgress)
          : null,

        updateId,
      ]
    );


    // -------------------------------------------------
    // FINAL RESPONSE
    // -------------------------------------------------

    res.json({

      message:
        "Clarification processed successfully",

      update_id:
        updateId,

      supervisor_input:
        combinedInput,

      matched_activity:
        matchedActivity,

      confidence:
        aiResult.confidence,

      extracted_details:
        aiResult.extracted_details,

      clarification:
        aiResult.clarification,

      updated_activity:
        updatedActivity,

      all_matches:
        aiResult.all_matches,
    });

  } catch (error) {

    console.error(
      "CLARIFICATION ERROR:",
      error
    );

    res.status(500).json({

      message:
        "Failed to process clarification",

      error:
        error.message,
    });
  }
});


// =====================================================
// START SERVER
// =====================================================


const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});