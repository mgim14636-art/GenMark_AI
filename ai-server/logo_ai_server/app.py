from flask import Flask, request, jsonify
import base64
from io import BytesIO
from logo_generator import generate_logo_from_survey

app = Flask(__name__)


def image_to_base64(img):
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@app.route("/generate-logo", methods=["POST"])
def generate_logo_api():
    survey_input = request.json
    try:
        images = generate_logo_from_survey(survey_input)
        logos_base64 = [image_to_base64(img) for img in images]
        return jsonify({"success": True, "logos": logos_base64})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)