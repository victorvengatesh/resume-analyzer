class ResumeAnalyzer:
    def __init__(self, job_skills=None):
        self.job_skills = job_skills or ["python", "fastapi", "react", "sql"]

    def calculate_match(self, resume_skills):
        # Turn everything to lowercase to match correctly
        resume_skills = [s.lower() for s in resume_skills]
        matched = [s for s in self.job_skills if s in resume_skills]

        score = (len(matched) / len(self.job_skills)) * 100
        return {
            "score": score,
            "matched": matched,
            "missing": [s for s in self.job_skills if s not in matched]
        }