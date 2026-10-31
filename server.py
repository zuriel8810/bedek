#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bedek-App Engineering Expert Server
Serves static PWA files and provides /api/chat with Vision OCR,
1,773 Building Standards & Findings Matcher, and Web Search (DuckDuckGo).
"""

import os
import io
import re
import json
import base64
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageStat, ImageFilter
import pytesseract
import requests
from bs4 import BeautifulSoup

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Load 1,773 Findings Database
# ---------------------------------------------------------------------------
FINDINGS_FILE = os.path.join(BASE_DIR, "findings_data.js")
FINDINGS_DB = {"repos": [], "categories": [], "findings": []}

try:
    with open(FINDINGS_FILE, "r", encoding="utf-8") as f:
        content = f.read().strip()
    if content.startswith("window.REPORTO_DB ="):
        content = content[len("window.REPORTO_DB ="):].strip()
    if content.endswith(";"):
        content = content[:-1].strip()
    FINDINGS_DB = json.loads(content)
    print(f"Loaded {len(FINDINGS_DB['findings'])} findings across {len(FINDINGS_DB['categories'])} categories.")
except Exception as e:
    print(f"Error loading findings database: {e}")

SYNONYMS = {
    "איטום": ["רטיבות", "חדירת מים", "הרטבה", "רובה", "סיליקון", "מסטיק", "פוגות", "רולקה", "אטימה"],
    "רטיבות": ["איטום", "סימני רטיבות", "עובש", "קילוף", "קפילרית", "נזילה", "כתמי מים"],
    "סדק": ["סדקים", "נימי", "טיח", "צבע", "הפרדות", "סדיקה", "שבר"],
    "ריצוף": ["אריחים", "גרניט פורצלן", "קרמיקה", "פוגות", "מישקים", "שקיעה", "שבירה", "חלול"],
    "חיפוי": ["קרמיקה", "הדבקה", "אריחי קיר", "פוגות", "נשירה"],
    "מעקה": ["מסעד", "גובה מגן", "מדרגות", "מרפסת", "סורג", "1142"],
    "שיפוע": ["ניקוז", "עמידת מים", "שיפועים", "קולטן", "מרפסת", "גג"],
    "ממד": ["ממ\"ד", "דלת הדף", "חלון הדף", "שסתום", "צנרת", "איוורור", "הג\"א"],
    "דלת": ["משקוף", "כנף", "מנעול", "סף", "הלבשות", "מרווח"],
    "חלון": ["אלומיניום", "כנף", "זכוכית", "מסילה", "איטום", "גומיות"],
    "אינסטלציה": ["סיפון", "ברז", "אסלה", "ניאגרה", "כיור", "ביקורת", "מחסום רצפה", "קולטן"],
    "אקוסטיקה": ["בידוד אקוסטי", "רעש", "הולם", "קול"],
    "גבס": ["מחיצת גבס", "לוחות גבס", "חיזוקים", "סדק גבס"]
}

KNOWN_STANDARDS = {
    "1555": "ת\"י 1555 (מערכות ריצוף וחיפוי קרמיקה ופסיפס בבניינים)",
    "1205": "ת\"י 1205 (התקנת מתקני תברואה ובדיקתם / הל\"ת)",
    "1142": "ת\"י 1142 (מעקים ומסעדים)",
    "1752": "ת\"י 1752 (איטום גגות ומבנים)",
    "1920": "ת\"י 1920 (עבודות טיח)",
    "1099": "ת\"י 1099 (שמשות בבניינים ובטיחותן)",
    "1068": "ת\"י 1068 (בידוד אקוסטי במבנים)",
    "5100": "ת\"י 1490 ו-1924 (מחיצות ועבודות לוחות גבס)",
    "2378": "ת\"י 2378 (חיפוי קירות באבן טבעית)",
    "5556": "ת\"י 5556 (דלתות כניסה וביטחון)",
    "הלת": "הוראות למתקני תברואה (הל\"ת) ותקנות התכנון והבנייה",
    "הל\"ת": "הוראות למתקני תברואה (הל\"ת) ותקנות התכנון והבנייה",
    "חוק המכר": "חוק המכר (דירות), תשל\"ג-1973 ותקופות הבדק"
}


def search_web_ddg(query, max_results=4):
    """Search DuckDuckGo HTML for Israeli construction standards and findings."""
    search_term = f"{query} תקן ישראלי בדק בית ליקוי"
    q = urllib.parse.quote_plus(search_term)
    url = f"https://html.duckduckgo.com/html/?q={q}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    results = []
    try:
        r = requests.get(url, headers=headers, timeout=8)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for res in soup.select(".result"):
                title_el = res.select_one(".result__title")
                snippet_el = res.select_one(".result__snippet")
                url_el = res.select_one(".result__url")
                if title_el and snippet_el:
                    title = title_el.get_text(strip=True)
                    snippet = snippet_el.get_text(strip=True)
                    link = url_el.get_text(strip=True) if url_el else ""
                    results.append({"title": title, "snippet": snippet, "url": link})
                if len(results) >= max_results:
                    break
    except Exception as e:
        print(f"Web search error: {e}")
    return results


def process_image(image_base64):
    """
    Decodes base64 image, extracts OCR text (Hebrew/English)
    and analyzes visual features (stains, edges, brightness).
    """
    if not image_base64:
        return "", {}

    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        if max(img.size) > 1600:
            img.thumbnail((1600, 1600))

        ocr_text = ""
        try:
            ocr_text = pytesseract.image_to_string(img, lang="heb+eng").strip()
        except Exception as ocr_err:
            print(f"OCR warning: {ocr_err}")

        stat = ImageStat.Stat(img)
        avg_brightness = sum(stat.mean) / 3.0

        edges = img.filter(ImageFilter.FIND_EDGES).convert("L")
        edge_stat = ImageStat.Stat(edges)
        edge_density = edge_stat.mean[0]

        features = {
            "width": img.width,
            "height": img.height,
            "brightness": round(avg_brightness, 1),
            "edge_density": round(edge_density, 1),
            "ocr_text": ocr_text
        }

        visual_hints = []
        if edge_density > 28.0:
            visual_hints.append("סדק או פגיעה נראית במרקם")
        if avg_brightness < 90:
            visual_hints.append("אזור כהה ייתכן כתם רטיבות או עובש")

        features["hints"] = visual_hints
        return ocr_text, features
    except Exception as e:
        print(f"Image processing error: {e}")
        return "", {"error": str(e)}


def match_database(query, room=""):
    """
    Scores the 1,773 findings against query, room and synonyms.
    """
    q_lower = query.lower()
    raw_words = [w for w in re.findall(r"[\w\u0590-\u05fe]+", q_lower) if len(w) > 1]
    if not raw_words:
        return []

    expanded_words = set(raw_words)
    for w in raw_words:
        for k, syn_list in SYNONYMS.items():
            if k == w or k in w or w in k:
                expanded_words.update(syn_list[:3])

    findings = FINDINGS_DB.get("findings", [])
    categories = FINDINGS_DB.get("categories", [])
    scored = []

    std_numbers = re.findall(r"\b\d{3,4}\b", query)

    for f in findings:
        score = 0
        name = f.get("name", "").lower()
        std = (f.get("std") or "").lower()
        rec = (f.get("rec") or "").lower()
        cat_idx = f.get("c", 0)
        cat = (categories[cat_idx] if cat_idx < len(categories) else "").lower()

        for num in std_numbers:
            if num in std or num in name:
                score += 25

        for w in expanded_words:
            is_direct = w in raw_words
            weight = 1.0 if is_direct else 0.5

            if w in name: score += int(14 * weight)
            if w in std: score += int(9 * weight)
            if w in rec: score += int(6 * weight)
            if w in cat: score += int(8 * weight)

            if len(w) > 3 and w[0] in "הבלכמשו":
                sub = w[1:]
                if sub in name: score += int(7 * weight)
                if sub in std: score += int(5 * weight)
                if sub in rec: score += int(3 * weight)
                if sub in cat: score += int(4 * weight)

        if room:
            room_l = room.lower()
            if any(k in room_l for k in ["רחצה", "מקלחת", "שירותים", "סניטרי"]):
                if any(k in cat or k in name for k in ["אינסטלציה", "איטום", "רובה", "קרמיקה", "מקלחון"]):
                    score += 10
            elif any(k in room_l for k in ["מרפסת", "גג", "חצר"]):
                if any(k in cat or k in name for k in ["איטום", "ניקוז", "שיפוע", "מעקה", "יריעות"]):
                    score += 10
            elif "ממד" in room_l or "ממ\"ד" in room_l:
                if "ממ\"ד" in cat or "ממ\"ד" in name or "הדף" in name:
                    score += 15
            elif "מטבח" in room_l:
                if any(k in cat or k in name for k in ["מטבח", "אינסטלציה", "שיש", "ארונות"]):
                    score += 10

        if score > 0:
            scored.append((score, f))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored


def generate_expert_response(user_query, image_data=None, room="סלון", force_web=False):
    ocr_text = ""
    img_features = {}
    if image_data:
        ocr_text, img_features = process_image(image_data)

    combined_query = user_query.strip()
    if ocr_text:
        combined_query = f"{combined_query} {ocr_text}".strip()

    if not combined_query and img_features.get("hints"):
        combined_query = " ".join(img_features["hints"])

    if not combined_query:
        combined_query = "ליקוי כללי בבנייה"

    matched = match_database(combined_query, room=room)
    top_score = matched[0][0] if matched else 0
    top_finding = matched[0][1] if matched else None

    use_web = force_web or (top_score < 20) or ("תקן" in user_query and top_score < 30)
    web_results = []
    if use_web:
        web_results = search_web_ddg(combined_query, max_results=3)

    categories = FINDINGS_DB.get("categories", [])
    cat_name = categories[top_finding["c"]] if (top_finding and top_finding.get("c") < len(categories)) else "כללי"

    if top_finding and top_score >= 15:
        defect_title = top_finding.get("name", "").strip()
        defect_std = (top_finding.get("std") or "").strip()
        defect_rec = (top_finding.get("rec") or "").strip()
        price = top_finding.get("up") or 250
        unit = top_finding.get("ut") or "יח\'"
        finding_id = top_finding.get("id")
    else:
        first_web = web_results[0] if web_results else None
        defect_title = f"ליקוי ואי התאמה: {user_query}"
        defect_std = first_web.get("snippet", "תקנות התכנון והבנייה וכללי המקצוע המקובלים") if first_web else "תקנות התכנון והבנייה"
        defect_rec = "נדרש לתקן את הליקוי בהתאם לתקנים הרלוונטיים והנחיות היצרן"
        price = 350
        unit = "יח\'"
        finding_id = "custom_" + str(abs(hash(user_query)))[:8]

    if not defect_std:
        for num, full_name in KNOWN_STANDARDS.items():
            if num in defect_title or num in combined_query:
                defect_std = full_name
                break
        if not defect_std:
            defect_std = "תקנות התכנון והבנייה וההמפרט הכללי לעבודות בנייה"

    if not defect_rec:
        defect_rec = "יש לבצע פירוק, הכנה מחדש וביצוע מקצועי עפ\"י הנחיות התקן והיצרן."

    reply_paragraphs = []
    
    if img_features:
        if ocr_text:
            reply_paragraphs.append(f"🔍 **זיהוי Vision & OCR:** זוהה טקסט/סימון בתמונה: *\"{ocr_text[:80]}\"*")
        if img_features.get("hints"):
            reply_paragraphs.append(f"📷 **מאפיינים חזותיים:** {' | '.join(img_features['hints'])}")

    reply_paragraphs.append(
        f"👷 **חוות דעת הנדסית ({room}):**\n"
        f"בבחינת הממצא, מדובר בליקוי מקצועי מסוג **{defect_title}**."
    )

    reply_paragraphs.append(
        f"📜 **דרישת התקן והחוק:**\n{defect_std}"
    )

    reply_paragraphs.append(
        f"🔧 **אופן התיקון הנדרש:**\n{defect_rec}"
    )

    reply_paragraphs.append(
        f"💰 **אומדן עלות משוער:** {price} ₪ ל-{unit}"
    )

    if web_results and use_web:
        web_snippets = "\n".join([f"• [{w['title']}]({w['url']}): {w['snippet'][:120]}..." for w in web_results[:2]])
        reply_paragraphs.append(f"🌐 **מידע נוסף מתקנים ברשת (DuckDuckGo):**\n{web_snippets}")

    full_reply = "\n\n".join(reply_paragraphs)

    structured_defect = {
        "title": defect_title,
        "std": defect_std,
        "rec": defect_rec,
        "price": price,
        "unit": unit,
        "qty": 1,
        "room": room,
        "findingId": finding_id,
        "category": cat_name
    }

    return {
        "success": True,
        "reply": full_reply,
        "std_citation": defect_std,
        "recommendation": defect_rec,
        "defect": structured_defect,
        "web_searched": bool(web_results),
        "sources_count": len(matched)
    }


class BedekHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            resp = {
                "status": "healthy",
                "findings_count": len(FINDINGS_DB.get("findings", [])),
                "ocr_ready": True,
                "version": "2.0.0"
            }
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))
            return

        super().do_GET()

    def do_POST(self):
        if self.path == "/api/chat":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                post_body = self.rfile.read(content_length)
                req_data = json.loads(post_body.decode("utf-8"))

                user_message = req_data.get("message", "")
                image_base64 = req_data.get("image", None)
                active_room = req_data.get("room", "סלון")
                force_web = bool(req_data.get("web_search", False))

                result = generate_expert_response(
                    user_query=user_message,
                    image_data=image_base64,
                    room=active_room,
                    force_web=force_web
                )

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                err_resp = {"success": False, "error": str(e)}
                self.wfile.write(json.dumps(err_resp, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()


def run():
    print(f"Starting Bedek Beit Server on port {PORT}...")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), BedekHTTPRequestHandler)
    print(f"Server ready at http://0.0.0.0:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run()
