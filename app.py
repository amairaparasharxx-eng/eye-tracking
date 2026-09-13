from flask import Flask, render_template, jsonify
import os

app = Flask(__name__)

TESTS = [
    {"id": "upgaze", "name": "Sustained upward gaze", "duration": 15,
     "instruction": "Keep your head still and look at the target above the camera. Try not to blink unnecessarily."},
    {"id": "horizontal", "name": "Horizontal gaze", "duration": 12,
     "instruction": "Follow the target slowly from left to right using your eyes. Keep your head as still as you comfortably can."},
    {"id": "vertical", "name": "Vertical gaze", "duration": 12,
     "instruction": "Follow the target slowly from top to bottom using your eyes. Keep your head still."},
    {"id": "closure", "name": "Eye-closure observation", "duration": 8,
     "instruction": "Look straight at the camera, then gently close both eyes when prompted. Do not force the eyelids closed."},
    {"id": "repeat", "name": "Repeat gaze observation", "duration": 12,
     "instruction": "Repeat the horizontal gaze task. This repeat is used to look for variation within the same session."}
]

@app.route("/")
def index():
    return render_template("index.html", tests=TESTS)

@app.route("/results")
def results():
    return render_template("results.html")

@app.get("/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
