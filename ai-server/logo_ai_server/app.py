from flask import Flask, request, jsonify
import base64
from io import BytesIO
from logo_generator import generate_logo_from_survey
from logo_composer import compose_final_logo

app = Flask(__name__)


def image_to_base64(img):
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@app.route("/generate-logo", methods=["POST"])
def generate_logo_api():
    survey_input = request.json
    try:
        # generate_logo_from_survey: FLUX로 심볼(도형)만 생성.
        # compose_final_logo: 심볼마다 브랜드명 텍스트 합성 + 배경 노이즈 정리까지
        # 거쳐서 실제로 사용자에게 보여줄 최종 로고를 만든다. 이 단계를 빼먹으면
        # 브랜드명이 없는 심볼 원본만 반환되므로 반드시 함께 호출한다.
        symbols = generate_logo_from_survey(survey_input)
        logos = [compose_final_logo(symbol, survey_input) for symbol in symbols]
        logos_base64 = [image_to_base64(img) for img in logos]
        return jsonify({"success": True, "logos": logos_base64})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)