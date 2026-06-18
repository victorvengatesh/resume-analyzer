import pdfplumber
from docx import Document

class FileProcessor:
    @staticmethod
    def extract_text(file_path: str, extension: str) -> str:
        if extension == ".pdf":
            with pdfplumber.open(file_path) as pdf:
                return "".join([page.extract_text() for page in pdf.pages])
        elif extension == ".docx":
            doc = Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs])
        return ""