import sys
import os
from pdf2docx import parse

def main():
    if len(sys.argv) < 2:
        print("Usage: python pdf.py <folder>")
        sys.exit(1)
        
    path = sys.argv[1]

    if path.endswith("pdf"):
        pdf2doc(path)
    else: 
        for root, dirs, files in os.walk(path, topdown=False):
            for name in files:
                if name.endswith("pdf"):
                    pdf2doc(os.path.join(root, name))


def pdf2doc(pdf):
    word_file =  pdf.replace(".pdf", ".docx")

    if (os.path.exists(word_file) is False):
        try:
            parse(pdf, word_file, start=0, end=None)
            print("Converted {}".format(word_file))

        except: 
            print("ERROR {}".format(word_file))

if __name__ == "__main__":
    main()
