import re

from fastapi import FastAPI


app = FastAPI()


# =========================================================
# PRE-TRAINED AI MODEL
# =========================================================


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():
    return {
        "message": "AI Service is running!"
    }


# =========================================================
# TEST AI
# =========================================================

@app.post("/api/test-ai")
def test_ai(data: dict):

    text = data.get("text", "")

    embedding = model.encode(text)

    return {
        "text": text,
        "embedding_length": len(embedding),
        "message": "Pre-trained model processed the text successfully!"
    }


# =========================================================
# EXTRACT UPDATE DETAILS
# =========================================================

def extract_update_details(text: str):

    text_lower = text.lower().strip()

    details = {
        "action": None,
        "date": None,
        "time": None,
        "quantity": None,
        "progress_percentage": None
    }

    # =====================================================
    # CASUAL / HINGLISH COMPLETION PHRASES
    # =====================================================

    casual_completion_phrases = [
        "hogyi h",
        "hogayi h",
        "ho gayi",
        "ho gaya",
        "hogaya",
        "hogayi",
        "ho gya",
        "ho gyi",
        "ho chuka",
        "ho chuki",
        "ban gaya",
        "ban gayi",
        "lag gayi",
        "lag gaya",
        "khatam",
        "done",
        "finish ho gaya",
        "finish ho gayi",
        "complete ho gaya",
        "complete ho gayi"
    ]

    for phrase in casual_completion_phrases:

        if phrase in text_lower:

            details["action"] = "completed"

            break

    # =====================================================
    # ACTION DETECTION
    # =====================================================

    if details["action"] is None:

        action_keywords = {

            "erected": "erected",
            "erect": "erected",

            "installed": "installed",
            "install": "installed",
            "installation": "installed",

            "completed": "completed",
            "complete": "completed",

            "started": "started",
            "start": "started",
            "began": "started",
            "begin": "started",

            "finished": "completed",
            "finish": "completed",

            "constructed": "constructed",
            "construct": "constructed",
            "construction": "constructed",

            "plastered": "plastered",
            "plaster": "plastered",
            "plastering": "plastered",

            "tested": "tested",
            "test": "tested"
        }

        for keyword, action in action_keywords.items():

            if re.search(
                r"\b" + re.escape(keyword) + r"\b",
                text_lower
            ):

                details["action"] = action

                break

    # =====================================================
    # NUMERIC PROGRESS DETECTION
    # =====================================================

    progress_patterns = [

        # 60%
        r"\b(\d+(?:\.\d+)?)\s*%",

        # 60 percent
        r"\b(\d+(?:\.\d+)?)\s*percent\b",

        # progress is 60
        r"\bprogress\s*(?:is|at|of)?\s*(\d+(?:\.\d+)?)",

        # completed 60
        r"\b(?:completed|complete|done|finished)\s*"
        r"(?:is|at|of)?\s*(\d+(?:\.\d+)?)"
    ]

    for pattern in progress_patterns:

        progress_match = re.search(
            pattern,
            text_lower
        )

        if progress_match:

            progress = float(
                progress_match.group(1)
            )

            if 0 <= progress <= 100:

                details["progress_percentage"] = progress

            break

    # =====================================================
    # NATURAL LANGUAGE PROGRESS
    # =====================================================

    if details["progress_percentage"] is None:

        natural_progress = {

            # 50%
            "halfway": 50,
            "halfway done": 50,
            "halfway complete": 50,
            "half done": 50,
            "half complete": 50,

            # 25%
            "quarter done": 25,
            "quarter complete": 25,
            "one quarter": 25,

            # 75%
            "three quarters": 75,
            "three quarters done": 75,
            "three quarters complete": 75,
            "three quarter": 75,

            # Approximate progress
            "almost half": 45,
            "nearly half": 45,

            "almost complete": 90,
            "nearly complete": 90,
            "almost finished": 90,
            "nearly finished": 90,

            # Full completion
            "fully complete": 100,
            "fully completed": 100,
            "fully finished": 100,
            "100 percent": 100,
            "100%": 100
        }

        # Check longer phrases first
        sorted_phrases = sorted(
            natural_progress.items(),
            key=lambda item: len(item[0]),
            reverse=True
        )

        for phrase, progress in sorted_phrases:

            if phrase in text_lower:

                details["progress_percentage"] = float(
                    progress
                )

                break

    # =====================================================
    # IF PROGRESS EXISTS BUT ACTION DOES NOT
    # =====================================================

    if (
        details["progress_percentage"] is not None
        and details["action"] is None
    ):

        details["action"] = "completed"

    # =====================================================
    # TIME DETECTION
    # =====================================================

    time_pattern = (
        r"\b(?:at\s+)?"
        r"(\d{1,2})"
        r"(?::(\d{2}))?"
        r"\s*(AM|PM|am|pm)\b"
    )

    time_match = re.search(
        time_pattern,
        text
    )

    if time_match:

        hour = time_match.group(1)

        minute = (
            time_match.group(2)
            or "00"
        )

        meridiem = time_match.group(3).upper()

        details["time"] = (
            f"{hour}:{minute} {meridiem}"
        )

    # =====================================================
    # HINGLISH TIME
    # Examples:
    # "aaj 4 baje"
    # "4 baje"
    # =====================================================

    if details["time"] is None:

        hinglish_time_pattern = (
            r"\b(\d{1,2})"
            r"(?:\s*:\s*(\d{2}))?"
            r"\s*(?:baje|bajey)\b"
        )

        hinglish_time_match = re.search(
            hinglish_time_pattern,
            text_lower
        )

        if hinglish_time_match:

            hour = hinglish_time_match.group(1)

            minute = (
                hinglish_time_match.group(2)
                or "00"
            )

            details["time"] = (
                f"{hour}:{minute}"
            )

    # =====================================================
    # DATE DETECTION
    # =====================================================

    if (
        "today" in text_lower
        or "aaj" in text_lower
    ):

        details["date"] = "today"

    elif (
        "yesterday" in text_lower
        or "kal" in text_lower
    ):

        details["date"] = "yesterday"

    elif "tomorrow" in text_lower:

        details["date"] = "tomorrow"

    else:

        date_patterns = [

            # DD/MM/YYYY
            r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",

            # YYYY/MM/DD
            r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b"
        ]

        for pattern in date_patterns:

            date_match = re.search(
                pattern,
                text_lower
            )

            if date_match:

                details["date"] = (
                    date_match.group(0)
                )

                break

    # =====================================================
    # QUANTITY DETECTION
    # =====================================================

    quantity_pattern = (
        r"\b(\d+(?:\.\d+)?)"
        r"\s*"
        r"(units?|nos?|pieces?|"
        r"meters?|metres?|m|km|kg|tons?)\b"
    )

    quantity_match = re.search(
        quantity_pattern,
        text_lower
    )

    if quantity_match:

        details["quantity"] = (
            quantity_match.group(0)
        )

    return details


# =========================================================
# CLARIFICATION LOGIC
# =========================================================

def generate_clarification(
    activity_name,
    extracted_details
):

    missing_information = []

    action = extracted_details.get("action")
    date = extracted_details.get("date")
    time = extracted_details.get("time")

    # -----------------------------------------------------
    # CHECK REQUIRED INFORMATION
    # -----------------------------------------------------

    if not action:
        missing_information.append("action")

    if not date:
        missing_information.append("date")

    if not time:
        missing_information.append("time")

    # -----------------------------------------------------
    # NO CLARIFICATION REQUIRED
    # -----------------------------------------------------

    if not missing_information:

        return {
            "clarification_required": False,
            "missing_information": [],
            "clarification_question": None
        }

    # -----------------------------------------------------
    # BUILD QUESTION
    # -----------------------------------------------------

    if (
        "action" in missing_information
        and "date" in missing_information
        and "time" in missing_information
    ):

        question = (
            f"Please provide what action was performed "
            f"for {activity_name} and on what date "
            f"and at what time."
        )

    elif (
        "date" in missing_information
        and "time" in missing_information
    ):

        question = (
            f"On what date and at what time "
            f"was {activity_name} completed?"
        )

    elif "date" in missing_information:

        question = (
            f"On what date was {activity_name} completed?"
        )

    elif "time" in missing_information:

        action = extracted_details.get(
            "action",
            "completed"
        )

        question = (
            f"What time was {activity_name} "
            f"{action}?"
        )

    elif "action" in missing_information:

        question = (
            f"What action was performed for "
            f"{activity_name}?"
        )

    else:

        question = (
            f"Please provide the missing information "
            f"for {activity_name}."
        )

    return {
        "clarification_required": True,
        "missing_information": missing_information,
        "clarification_question": question
    }


# =========================================================
# ACTIVITY MATCHING
# =========================================================

@app.post("/api/match-activity")
def match_activity(data: dict):

    supervisor_input = data.get(
        "supervisor_input",
        ""
    )

    activities = data.get(
        "activities",
        []
    )

    if not supervisor_input:

        return {
            "message": "Supervisor input is required"
        }

    if not activities:

        return {
            "message": "Activities are required"
        }

    # -----------------------------------------------------
    # SUPERVISOR EMBEDDING
    # -----------------------------------------------------

    supervisor_embedding = model.encode(
        supervisor_input,
        convert_to_tensor=True
    )

    input_lower = supervisor_input.lower()

    results = []

    # -----------------------------------------------------
    # MATCH EACH ACTIVITY
    # -----------------------------------------------------

    for activity in activities:

        activity_code = activity.get(
            "activity_code",
            ""
        )

        activity_name = activity.get(
            "name",
            ""
        )

        discipline = activity.get(
            "discipline",
            ""
        )

        activity_text = (
            f"{activity_code} "
            f"{activity_name} "
            f"{discipline}"
        )

        activity_embedding = model.encode(
            activity_text,
            convert_to_tensor=True
        )

        # -------------------------------------------------
        # SEMANTIC SCORE
        # -------------------------------------------------

        semantic_score = util.cos_sim(
            supervisor_embedding,
            activity_embedding
        ).item()

        semantic_score = max(
            0,
            semantic_score
        )

        # -------------------------------------------------
        # KEYWORD / IDENTIFIER SCORE
        # -------------------------------------------------

        keyword_score = 0.0

        activity_name_lower = (
            activity_name.lower()
        )

        activity_code_lower = (
            activity_code.lower()
        )

        # Exact activity code
        if activity_code_lower in input_lower:

            keyword_score = 1.0

        else:

            input_numbers = set(
                re.findall(
                    r"\b\d+\b",
                    input_lower
                )
            )

            activity_numbers = set(
                re.findall(
                    r"\b\d+\b",
                    f"{activity_code_lower} "
                    f"{activity_name_lower}"
                )
            )

            # Strong numeric identifier match
            if input_numbers.intersection(
                activity_numbers
            ):

                keyword_score = 0.9

            else:

                words = [
                    word.strip(".,!?")
                    for word
                    in activity_name_lower.split()
                    if len(word) >= 4
                ]

                matched_words = [
                    word
                    for word in words
                    if word in input_lower
                ]

                if matched_words and words:

                    keyword_score = min(
                        len(matched_words)
                        / len(words),
                        1.0
                    )

        # -------------------------------------------------
        # FINAL SCORE
        # -------------------------------------------------

        final_score = (
            (semantic_score * 0.6)
            + (keyword_score * 0.4)
        )

        results.append({

            "activity_id": activity.get("id"),

            "activity_code": activity_code,

            "activity_name": activity_name,

            "semantic_score": round(
                semantic_score,
                4
            ),

            "keyword_score": round(
                keyword_score,
                4
            ),

            "final_score": round(
                final_score,
                4
            )
        })

    # -----------------------------------------------------
    # SORT RESULTS
    # -----------------------------------------------------

    results.sort(
        key=lambda x: x["final_score"],
        reverse=True
    )

    best_match = results[0]

    # -----------------------------------------------------
    # CONFIDENCE
    # -----------------------------------------------------

    if best_match["final_score"] >= 0.70:

        confidence = "high"

    elif best_match["final_score"] >= 0.45:

        confidence = "medium"

    else:

        confidence = "low"

    return {

        "supervisor_input": supervisor_input,

        "best_match": best_match,

        "confidence": confidence,

        "all_matches": results
    }


# =========================================================
# COMPLETE PROCESSING PIPELINE
# =========================================================

@app.post("/api/process-update")
def process_update(data: dict):

    supervisor_input = data.get(
        "supervisor_input",
        ""
    )

    activities = data.get(
        "activities",
        []
    )

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    if not supervisor_input:

        return {
            "message": "Supervisor input is required"
        }

    if not activities:

        return {
            "message": "Activities are required"
        }

    # -----------------------------------------------------
    # MATCH ACTIVITY
    # -----------------------------------------------------

    supervisor_embedding = model.encode(
        supervisor_input,
        convert_to_tensor=True
    )

    input_lower = supervisor_input.lower()

    results = []

    for activity in activities:

        activity_code = activity.get(
            "activity_code",
            ""
        )

        activity_name = activity.get(
            "name",
            ""
        )

        discipline = activity.get(
            "discipline",
            ""
        )

        activity_text = (
            f"{activity_code} "
            f"{activity_name} "
            f"{discipline}"
        )

        activity_embedding = model.encode(
            activity_text,
            convert_to_tensor=True
        )

        semantic_score = util.cos_sim(
            supervisor_embedding,
            activity_embedding
        ).item()

        semantic_score = max(
            0,
            semantic_score
        )

        # -------------------------------------------------
        # KEYWORD SCORE
        # -------------------------------------------------

        keyword_score = 0.0

        activity_name_lower = (
            activity_name.lower()
        )

        activity_code_lower = (
            activity_code.lower()
        )

        if activity_code_lower in input_lower:

            keyword_score = 1.0

        else:

            input_numbers = set(
                re.findall(
                    r"\b\d+\b",
                    input_lower
                )
            )

            activity_numbers = set(
                re.findall(
                    r"\b\d+\b",
                    f"{activity_code_lower} "
                    f"{activity_name_lower}"
                )
            )

            if input_numbers.intersection(
                activity_numbers
            ):

                keyword_score = 0.9

            else:

                words = [
                    word.strip(".,!?")
                    for word
                    in activity_name_lower.split()
                    if len(word) >= 4
                ]

                matched_words = [
                    word
                    for word in words
                    if word in input_lower
                ]

                if matched_words and words:

                    keyword_score = min(
                        len(matched_words)
                        / len(words),
                        1.0
                    )

        final_score = (
            (semantic_score * 0.6)
            + (keyword_score * 0.4)
        )

        results.append({

            "activity_id": activity.get("id"),

            "activity_code": activity_code,

            "activity_name": activity_name,

            "semantic_score": round(
                semantic_score,
                4
            ),

            "keyword_score": round(
                keyword_score,
                4
            ),

            "final_score": round(
                final_score,
                4
            )
        })

    # -----------------------------------------------------
    # SORT RESULTS
    # -----------------------------------------------------

    results.sort(
        key=lambda x: x["final_score"],
        reverse=True
    )

    best_match = results[0]

    # -----------------------------------------------------
    # CONFIDENCE
    # -----------------------------------------------------

    if best_match["final_score"] >= 0.70:

        confidence = "high"

    elif best_match["final_score"] >= 0.45:

        confidence = "medium"

    else:

        confidence = "low"

    # -----------------------------------------------------
    # EXTRACT DETAILS
    # -----------------------------------------------------

    extracted_details = extract_update_details(
        supervisor_input
    )

    # -----------------------------------------------------
    # CLARIFICATION
    # -----------------------------------------------------

    clarification = generate_clarification(
        best_match["activity_name"],
        extracted_details
    )

    # -----------------------------------------------------
    # FINAL RESPONSE
    # -----------------------------------------------------

    return {

        "supervisor_input": supervisor_input,

        "matched_activity": best_match,

        "confidence": confidence,

        "extracted_details": extracted_details,

        "clarification": clarification,

        "all_matches": results
    }