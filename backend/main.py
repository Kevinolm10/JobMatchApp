from fastapi import FastAPI
from typing import List

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Job Matcher API Running"}

@app.post("/match")
def match_jobs(candidate: dict, jobs: List[dict]):
    matched_jobs = []

    for job in jobs:
        score = sum(skill in job["required_skills"] for skill in candidate["skills"])
        if score > 0:
            job["match_score"] = score
            matched_jobs.append(job)

    matched_jobs.sort(key=lambda x: x["match_score"], reverse=True)
    return {"matches": matched_jobs}
