# Smart Resume Analyzer
### AI-Powered Semantic Resume Evaluation System

---

## Overview

Smart Resume Analyzer is an AI-driven system designed to evaluate candidate resumes against job requirements using semantic understanding and evidence-based analysis.

Unlike traditional keyword-based screening tools, this system leverages modern AI techniques such as semantic search and retrieval-based evaluation to identify how well a candidate’s experience aligns with a given role.

The system not only provides a match score but also explains the reasoning behind the evaluation using actual content extracted from the resume.

---

## Problem Statement

Recruiters often face the challenge of screening large volumes of resumes quickly and accurately. Traditional systems rely heavily on keyword matching, which fails to capture the true relevance of a candidate’s skills and experience.

This leads to:
- missed qualified candidates
- inaccurate filtering
- lack of transparency in decision-making

This project addresses these limitations by building a system that understands context, retrieves relevant evidence, and produces explainable results.

---

## Solution

This project implements a semantic resume evaluation pipeline that:

- extracts and processes resume content
- breaks text into meaningful segments (chunks)
- performs semantic similarity search against a job role
- retrieves the most relevant parts of the resume
- generates a score and explanation based on real evidence

The output is both **quantitative (score)** and **qualitative (explanation + evidence)**.

---

## Key Features

- Upload and analyze resumes in **PDF** and **DOCX** formats  
- Semantic matching against a given job role  
- AI-generated evaluation with explanation  
- Skill detection and missing skill identification  
- Grounded evidence using top retrieved resume sections  
- Candidate ranking based on relevance score  
- Clean and intuitive frontend interface  
- FastAPI-based backend with efficient processing  

---

## System Architecture

### Frontend
- Built using **React**
- Handles resume upload and displays results
- Presents structured evaluation with scores and evidence

### Backend
- Built using **FastAPI**
- Handles file processing, extraction, and analysis
- Manages resume data and evaluation results

### AI / NLP Layer
- Uses **Sentence Transformers (all-MiniLM-L6-v2)** for embeddings
- Implements semantic similarity-based retrieval
- Performs RAG-style evaluation using retrieved context
- Extracts skills and aligns them with job requirements

---

## Workflow

1. **Resume Upload**
   - User uploads one or more resumes

2. **Text Extraction**
   - Extracts text from PDF/DOCX files

3. **Chunking**
   - Splits text into smaller meaningful segments

4. **Embedding & Retrieval**
   - Converts chunks into embeddings
   - Retrieves top relevant chunks based on job role

5. **Evaluation**
   - Computes match score
   - Identifies skills and gaps
   - Generates explanation

6. **Result Display**
   - Displays score, match level, skills, and evidence

---

## Example Output

- **Score:** 54  
- **Match Level:** Moderate Match  
- **Skills Found:** Python, Machine Learning, Pandas, TensorFlow  
- **Explanation:** The resume shows meaningful alignment with the role, supported by relevant technical skills and project experience.  
- **Grounding Evidence:** Top extracted sections from the resume supporting the evaluation  

---

## Technology Stack

### Frontend
- React
- JavaScript
- CSS

### Backend
- FastAPI
- Python
- SQLAlchemy
- SQLite

### AI / NLP
- Sentence Transformers
- NumPy
- Text chunking utilities

### File Processing
- pdfplumber (PDF parsing)
- python-docx (DOCX parsing)

---

## Installation & Setup

### 1. Clone Repository

```bash
git clone <your-repo-link>
cd smart-resume-analyzer
