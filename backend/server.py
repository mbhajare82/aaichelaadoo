from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import json
import math
import uuid
import random
import string
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import asyncio
import io
from PIL import Image
import bcrypt
import jwt
import razorpay
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger("aaicheladau")
logging.basicConfig(level=logging.INFO)

JWT_ALG = "HS256"
LLM_MODEL = ("anthropic", "claude-sonnet-5-5")
PACK_SIZES = [250, 500, 1000]
CATEGORIES = ["sweets", "namkin", "healthy"]
FALLBACK_LINE = "'Aaiche Laado' will call back for serving you..."


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------- Auth ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=8)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


async def require_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"], "role": "admin"}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


class LoginIn(BaseModel):
    email: str
    password: str


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.strip().lower()
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "x")
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("locked_until"):
        if att["locked_until"] > now_iso():
            raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_one({"identifier": ident})
        att = None
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (att or {}).get("count", 0) + 1
        locked = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat() if count >= 5 else ""
        await db.login_attempts.update_one({"identifier": ident},
                                           {"$set": {"count": count, "locked_until": locked}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    token = make_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=8 * 3600, path="/")
    return {"token": token, "user": {"id": user["id"], "email": email, "name": user.get("name"), "role": "admin"}}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(require_admin)):
    return user


# ---------------- Settings & pricing ----------------
DEFAULT_SETTINGS = {"india_per_kg": 250, "abroad_extra_per_kg": 450, "rounding": "round_up", "diwali_deadline": "2026-11-05"}
IST = timezone(timedelta(hours=5, minutes=30))


def diwali_open(s: dict) -> bool:
    return datetime.now(IST).date().isoformat() <= s.get("diwali_deadline", "")


async def get_settings() -> dict:
    s = await db.settings.find_one({"key": "delivery"}, {"_id": 0, "key": 0})
    return {**DEFAULT_SETTINGS, **(s or {})}


def pack_price(price_per_kg: float, grams: int) -> int:
    return int(round(price_per_kg * grams / 1000))


def delivery_fee(weight_g: int, destination: str, s: dict) -> int:
    if weight_g <= 0:
        return 0
    kg = weight_g / 1000
    kg = max(1, math.ceil(kg)) if s["rounding"] == "round_up" else max(1.0, kg)
    rate = s["india_per_kg"] + (s["abroad_extra_per_kg"] if destination == "abroad" else 0)
    return int(round(kg * rate))


def product_public(p: dict) -> dict:
    return {**p, "packs": [{"grams": g, "price": pack_price(p["price_per_kg"], g),
                            "in_stock": p["stock_grams"] >= g} for g in PACK_SIZES],
            "in_stock": p["stock_grams"] >= PACK_SIZES[0]}


def combo_public(c: dict, pmap: dict) -> dict:
    items, cat_totals, ok = [], {}, True
    for it in c.get("items", []):
        p = pmap.get(it["product_id"])
        name = p["name"] if p else "Item removed"
        cat = p["category"] if p else "other"
        cat_totals[cat] = cat_totals.get(cat, 0) + it["grams"]
        if not p or not p.get("active", True) or p["stock_grams"] < it["grams"]:
            ok = False
        items.append({"product_id": it["product_id"], "name": name, "category": cat, "grams": it["grams"]})
    return {**c, "items": items, "category_limits": cat_totals,
            "total_grams": sum(i["grams"] for i in items), "in_stock": ok and bool(items)}


class CartLine(BaseModel):
    kind: Literal["product", "combo"]
    id: str
    grams: Optional[int] = None
    qty: int = Field(ge=1, le=50)


class QuoteIn(BaseModel):
    items: List[CartLine]
    destination: Literal["india", "abroad"] = "india"


async def build_quote(items: List[CartLine], destination: str) -> dict:
    s = await get_settings()
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    pmap = {p["id"]: p for p in products}
    combos = {c["id"]: c for c in await db.combos.find({}, {"_id": 0}).to_list(500)}
    lines, need, errors = [], {}, []
    for li in items:
        if li.kind == "product":
            p = pmap.get(li.id)
            if not p or not p.get("active", True) or li.grams not in PACK_SIZES:
                errors.append("An item in your cart is no longer available")
                continue
            unit = pack_price(p["price_per_kg"], li.grams)
            need[p["id"]] = need.get(p["id"], 0) + li.grams * li.qty
            lines.append({"kind": "product", "id": p["id"], "name": p["name"], "grams": li.grams,
                          "qty": li.qty, "unit_price": unit, "line_total": unit * li.qty,
                          "weight_g": li.grams * li.qty})
        else:
            c = combos.get(li.id)
            if not c or not c.get("active", True):
                errors.append("A combo in your cart is no longer available")
                continue
            cg = sum(i["grams"] for i in c["items"])
            for i in c["items"]:
                need[i["product_id"]] = need.get(i["product_id"], 0) + i["grams"] * li.qty
            lines.append({"kind": "combo", "id": c["id"], "name": c["name"], "grams": cg, "qty": li.qty,
                          "unit_price": int(c["price"]), "line_total": int(c["price"]) * li.qty,
                          "weight_g": cg * li.qty})
    for pid, g in need.items():
        p = pmap.get(pid)
        if not p or p["stock_grams"] < g:
            errors.append(f"{p['name'] if p else 'An item'} is out of stock for the quantity selected")
    subtotal = sum(line["line_total"] for line in lines)
    weight = sum(line["weight_g"] for line in lines)
    fee = delivery_fee(weight, destination, s)
    return {"lines": lines, "subtotal": subtotal, "weight_g": weight, "delivery_fee": fee,
            "total": subtotal + fee, "destination": destination, "errors": errors, "stock_need": need}


# ---------------- Public catalog ----------------
@api.get("/catalog")
async def catalog():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    pmap = {p["id"]: p for p in products}
    combos = await db.combos.find({"active": True}, {"_id": 0}).sort("price", 1).to_list(500)
    s = await get_settings()
    return {"products": [product_public(p) for p in products if p.get("active", True)],
            "combos": [combo_public(c, pmap) for c in combos],
            "settings": {**s, "diwali_open": diwali_open(s)}}


@api.post("/cart/quote")
async def quote(body: QuoteIn):
    q = await build_quote(body.items, body.destination)
    q.pop("stock_need")
    return q


@api.get("/testimonials")
async def public_testimonials():
    return await db.testimonials.find({"published": True}, {"_id": 0, "phone": 0}).sort("created_at", -1).to_list(60)


# ---------------- Orders & Razorpay ----------------
class Customer(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=7, max_length=20)
    email: Optional[str] = ""
    address: str = Field(min_length=5, max_length=400)
    city: str = Field(min_length=2, max_length=80)
    pincode: str = Field(min_length=3, max_length=12)
    country: str = "India"


class OrderIn(BaseModel):
    items: List[CartLine] = Field(min_length=1)
    destination: Literal["india", "abroad"]
    order_type: Literal["diwali", "regular"] = "regular"
    customer: Customer


def rzp_client():
    kid, sec = os.environ.get("RAZORPAY_KEY_ID"), os.environ.get("RAZORPAY_KEY_SECRET")
    if not kid or not sec or not kid.startswith("rzp_"):
        raise HTTPException(503, "Online payment is not set up yet. Please try again later.")
    return razorpay.Client(auth=(kid, sec)), kid


def short_order_id() -> str:
    return "AL" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@api.post("/orders")
async def create_order(body: OrderIn):
    if body.order_type == "diwali" and not diwali_open(await get_settings()):
        raise HTTPException(400, "Diwali orders are closed now. Please choose Regular order.")
    q = await build_quote(body.items, body.destination)
    if q["errors"]:
        raise HTTPException(400, q["errors"][0])
    if q["total"] <= 0:
        raise HTTPException(400, "Cart is empty")
    rz, key_id = rzp_client()
    oid = short_order_id()
    try:
        rz_order = rz.order.create({"amount": q["total"] * 100, "currency": "INR", "receipt": oid,
                                    "payment_capture": 1})
    except Exception as e:
        logger.exception("razorpay order create failed")
        raise HTTPException(502, f"Payment gateway error: {e}")
    doc = {"id": oid, "order_type": body.order_type, "customer": body.customer.model_dump(), "destination": body.destination,
           "lines": q["lines"], "subtotal": q["subtotal"], "weight_g": q["weight_g"],
           "delivery_fee": q["delivery_fee"], "total": q["total"], "stock_need": q["stock_need"],
           "status": "pending", "razorpay_order_id": rz_order["id"], "created_at": now_iso()}
    await db.orders.insert_one(doc)
    return {"order_id": oid, "razorpay_order_id": rz_order["id"], "amount": q["total"] * 100,
            "currency": "INR", "key_id": key_id}


class VerifyIn(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api.post("/orders/verify")
async def verify_order(body: VerifyIn):
    order = await db.orders.find_one({"id": body.order_id, "razorpay_order_id": body.razorpay_order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] != "pending":
        return {"order_id": order["id"], "status": order["status"]}
    rz, _ = rzp_client()
    try:
        rz.utility.verify_payment_signature({"razorpay_order_id": body.razorpay_order_id,
                                             "razorpay_payment_id": body.razorpay_payment_id,
                                             "razorpay_signature": body.razorpay_signature})
    except Exception:
        await db.orders.update_one({"id": order["id"]}, {"$set": {"status": "failed"}})
        raise HTTPException(400, "Payment verification failed")
    res = await db.orders.update_one({"id": order["id"], "status": "pending"},
                                     {"$set": {"status": "paid", "payment_id": body.razorpay_payment_id,
                                               "paid_at": now_iso()}})
    if res.modified_count:
        for pid, g in order.get("stock_need", {}).items():
            await db.products.update_one({"id": pid}, [{"$set": {"stock_grams": {"$max": [0, {"$subtract": ["$stock_grams", g]}]}}}])
    return {"order_id": order["id"], "status": "paid", "total": order["total"]}


# ---------------- Feedback / testimonials ----------------
class FeedbackIn(BaseModel):
    order_id: str
    phone: str
    name: str = Field(min_length=2, max_length=60)
    taste: int = Field(ge=1, le=5)
    price: int = Field(ge=1, le=5)
    nourishment: int = Field(ge=1, le=5)
    comment: str = Field(min_length=5, max_length=600)


def digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")[-10:]


@api.post("/testimonials")
async def submit_feedback(body: FeedbackIn):
    oid = body.order_id.strip().upper()
    order = await db.orders.find_one({"id": oid})
    if not order or digits(order["customer"]["phone"]) != digits(body.phone):
        raise HTTPException(404, "We couldn't find an order with that ID and phone number")
    if order["status"] not in ("paid", "delivered"):
        raise HTTPException(400, "Feedback can be given only for paid orders")
    if await db.testimonials.find_one({"order_id": oid}):
        raise HTTPException(400, "Feedback for this order is already submitted. Thank you!")
    doc = {"id": new_id(), "order_id": oid, "phone": body.phone, "name": body.name.strip(),
           "taste": body.taste, "price": body.price, "nourishment": body.nourishment,
           "comment": body.comment.strip(), "items": [line["name"] for line in order["lines"]],
           "published": False, "created_at": now_iso()}
    await db.testimonials.insert_one(doc)
    return {"ok": True}


# ---------------- Laado chat ----------------
async def laado_system_prompt() -> str:
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    pmap = {p["id"]: p for p in products}
    combos = await db.combos.find({"active": True}, {"_id": 0}).sort("price", 1).to_list(50)
    lines = []
    for c in combos:
        cp = combo_public(c, pmap)
        inc = ", ".join(f"{i['name']} {i['grams']}g" for i in cp["items"])
        lines.append(f"- {c['name']}: Rs {int(c['price'])} (includes: {inc})")
    combo_text = "\n".join(lines) or "- No combos available right now"
    return f"""You are Laado, the friendly chat assistant of "AaicheLadau", a home-made Maharashtrian Diwali sweets and namkin kitchen in Warje, Pune.

Your two jobs:
1. Collect these details from the customer, one or two at a time, politely: full name, phone number, items they want (with approx weight/quantity), and delivery address.
2. Answer questions about combo offer prices using ONLY this information:
{combo_text}

Strict rules:
- For ANY question you cannot answer from the combo information above (individual item prices, delivery times, ingredients, discounts, custom orders, anything else), reply exactly: "{FALLBACK_LINE}" and then gently continue collecting the missing details.
- Never invent prices, items, offers or policies.
- Reply in plain text only: no markdown, no asterisks, no bullet symbols.
- Keep replies short (1-3 sentences), warm, in simple Indian English. You may use a light Marathi touch like "Namaskar".
- Once you have name, phone, items and address, confirm them back in one short message and tell the customer they can tap "End chat" to submit, and our team will call back."""


class ChatIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1, max_length=1000)


@api.post("/chat/message")
async def chat_message(body: ChatIn):
    sess = await db.chat_sessions.find_one({"session_id": body.session_id}, {"_id": 0})
    if sess and sess.get("ended"):
        raise HTTPException(400, "This chat has ended. Please start a new chat.")
    history = (sess or {}).get("messages", [])[-30:]
    system = await laado_system_prompt()
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=body.session_id, system_message=system,
                   initial_messages=[{"role": "system", "content": system}] + history).with_model(*LLM_MODEL)

    async def gen():
        full = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception:
            logger.exception("laado stream failed")
            if not full:
                full = FALLBACK_LINE
                yield f"data: {json.dumps({'delta': full})}\n\n"
        await db.chat_sessions.update_one(
            {"session_id": body.session_id},
            {"$push": {"messages": {"$each": [{"role": "user", "content": body.message},
                                              {"role": "assistant", "content": full}]}},
             "$setOnInsert": {"created_at": now_iso(), "ended": False}}, upsert=True)
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class EndIn(BaseModel):
    session_id: str


def whatsapp_fallback(lead: dict) -> str:
    name = lead.get("name") or "there"
    items = lead.get("items") or "our Diwali faral"
    return (f"Namaskar {name}! This is Aaiche Laado from Warje, Pune. Thank you for chatting with us about {items}. "
            f"Shall I confirm your order and delivery details? Happy to help - just reply here!")


@api.post("/chat/end")
async def chat_end(body: EndIn):
    sess = await db.chat_sessions.find_one({"session_id": body.session_id}, {"_id": 0})
    if not sess or not any(m["role"] == "user" for m in sess.get("messages", [])):
        return {"saved": False}
    if sess.get("ended"):
        return {"saved": True, "lead_id": sess.get("lead_id")}
    transcript = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in sess["messages"])
    prompt = f"""From this chat between a customer and Laado (assistant of AaicheLadau home-made sweets, Warje Pune), extract a lead.
Return ONLY a JSON object with keys:
"name", "phone", "items", "address" (empty string if not given),
"summary": 2-3 short lines summarising what the customer wants,
"label": "Hot" if they gave phone + items and clearly want to order soon; "Warm" if interested and shared some details; "Cold" if just browsing or gave no contact,
"whatsapp_message": a ready-to-send WhatsApp follow-up from 'Aaiche Laado' to the customer in friendly Indian English (2-4 sentences, mention their items, no emojis).

CHAT:
{transcript}"""
    data = {}
    try:
        llm = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"lead-{body.session_id}",
                      system_message="You extract structured lead data. Reply with JSON only.").with_model(*LLM_MODEL)
        raw = await llm.send_message(UserMessage(text=prompt))
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
    except Exception:
        logger.exception("lead extraction failed")
    label = data.get("label") if data.get("label") in ("Hot", "Warm", "Cold") else "Cold"
    lead = {"id": new_id(), "session_id": body.session_id, "name": str(data.get("name", "")),
            "phone": str(data.get("phone", "")), "items": str(data.get("items", "")),
            "address": str(data.get("address", "")), "label": label,
            "summary": str(data.get("summary", "")) or "Customer chatted with Laado; details need a call back.",
            "messages": sess["messages"], "created_at": now_iso()}
    lead["whatsapp_message"] = str(data.get("whatsapp_message", "")) or whatsapp_fallback(lead)
    await db.leads.insert_one(lead)
    await db.chat_sessions.update_one({"session_id": body.session_id}, {"$set": {"ended": True, "lead_id": lead["id"]}})
    return {"saved": True, "lead_id": lead["id"]}


# ---------------- Object storage (product photos) ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_UPLOAD = 5 * 1024 * 1024
_storage_key = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    r = requests.put(f"{STORAGE_URL}/objects/{path}", data=data, timeout=120,
                     headers={"X-Storage-Key": init_storage(), "Content-Type": content_type})
    if r.status_code == 404:
        r = requests.put(f"{STORAGE_URL}/objects/{path}", data=data, timeout=120,
                         headers={"X-Storage-Key": init_storage(force=True), "Content-Type": content_type})
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> bytes:
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    r.raise_for_status()
    return r.content


@api.get("/files/{path:path}")
async def serve_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    data = await asyncio.to_thread(get_object, path)
    return Response(content=data, media_type=rec["content_type"], headers={"Cache-Control": "public, max-age=86400"})


# ---------------- Admin ----------------
admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


@admin.post("/upload")
async def upload_photo(file: UploadFile = File(...)):
    ext = IMAGE_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Please upload a JPG, PNG or WEBP photo")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(400, "Photo is too large (max 5 MB)")
    try:
        Image.open(io.BytesIO(data)).verify()
    except Exception:
        raise HTTPException(400, "Please upload a JPG, PNG or WEBP photo")
    try:
        res = await asyncio.to_thread(put_object, f"aaicheladau/products/{new_id()}.{ext}", data, file.content_type)
    except Exception:
        logger.exception("upload failed")
        raise HTTPException(502, "Photo upload failed. Please try again.")
    await db.files.insert_one({"id": new_id(), "storage_path": res["path"], "original_filename": file.filename,
                               "content_type": file.content_type, "size": len(data), "is_deleted": False,
                               "created_at": now_iso()})
    return {"url": f"/api/files/{res['path']}"}


@admin.get("/stats")
async def stats():
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    paid = await db.orders.find({"status": {"$in": ["paid", "delivered"]}}, {"_id": 0, "total": 1}).to_list(10000)
    return {"total_leads": await db.leads.count_documents({}),
            "hot_this_week": await db.leads.count_documents({"label": "Hot", "created_at": {"$gte": week_ago}}),
            "paid_orders": len(paid), "revenue": sum(o["total"] for o in paid)}


@admin.get("/leads")
async def leads():
    return await db.leads.find({}, {"_id": 0, "messages": 0}).sort("created_at", -1).to_list(1000)


@admin.get("/leads/{lead_id}")
async def lead_detail(lead_id: str):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: Literal["sweets", "namkin", "healthy"]
    description: str = ""
    image: str = ""
    price_per_kg: float = Field(gt=0)
    stock_grams: int = Field(ge=0)
    active: bool = True


@admin.get("/products")
async def admin_products():
    return await db.products.find({}, {"_id": 0}).sort("category", 1).to_list(1000)


@admin.post("/products")
async def add_product(body: ProductIn):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@admin.put("/products/{pid}")
async def edit_product(pid: str, body: ProductIn):
    res = await db.products.update_one({"id": pid}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Product not found")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@admin.delete("/products/{pid}")
async def delete_product(pid: str):
    if await db.combos.find_one({"items.product_id": pid}):
        raise HTTPException(400, "This item is part of a combo. Remove it from the combo first, or hide it instead.")
    res = await db.products.delete_one({"id": pid})
    if not res.deleted_count:
        raise HTTPException(404, "Product not found")
    return {"ok": True}


class ComboItem(BaseModel):
    product_id: str
    grams: int = Field(gt=0, le=10000)


class ComboIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    price: float = Field(gt=0)
    description: str = ""
    image: str = ""
    items: List[ComboItem] = Field(min_length=1)
    active: bool = True


@admin.get("/combos")
async def admin_combos():
    pmap = {p["id"]: p for p in await db.products.find({}, {"_id": 0}).to_list(1000)}
    return [combo_public(c, pmap) for c in await db.combos.find({}, {"_id": 0}).sort("price", 1).to_list(500)]


@admin.post("/combos")
async def add_combo(body: ComboIn):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.combos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@admin.put("/combos/{cid}")
async def edit_combo(cid: str, body: ComboIn):
    res = await db.combos.update_one({"id": cid}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Combo not found")
    return {"ok": True}


@admin.delete("/combos/{cid}")
async def delete_combo(cid: str):
    res = await db.combos.delete_one({"id": cid})
    if not res.deleted_count:
        raise HTTPException(404, "Combo not found")
    return {"ok": True}


@admin.get("/orders")
async def admin_orders():
    return await db.orders.find({}, {"_id": 0, "stock_need": 0}).sort("created_at", -1).to_list(1000)


class StatusIn(BaseModel):
    status: Literal["pending", "paid", "delivered", "failed", "cancelled"]


@admin.patch("/orders/{oid}")
async def order_status(oid: str, body: StatusIn):
    res = await db.orders.update_one({"id": oid}, {"$set": {"status": body.status}})
    if not res.matched_count:
        raise HTTPException(404, "Order not found")
    return {"ok": True}


@admin.get("/testimonials")
async def admin_testimonials():
    return await db.testimonials.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


class PublishIn(BaseModel):
    published: bool


@admin.patch("/testimonials/{tid}")
async def publish_testimonial(tid: str, body: PublishIn):
    res = await db.testimonials.update_one({"id": tid}, {"$set": {"published": body.published}})
    if not res.matched_count:
        raise HTTPException(404, "Testimonial not found")
    return {"ok": True}


class SettingsIn(BaseModel):
    india_per_kg: float = Field(ge=0)
    abroad_extra_per_kg: float = Field(ge=0)
    rounding: Literal["round_up", "exact"]
    diwali_deadline: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


@admin.get("/settings")
async def read_settings():
    return await get_settings()


@admin.put("/settings")
async def save_settings(body: SettingsIn):
    await db.settings.update_one({"key": "delivery"}, {"$set": body.model_dump()}, upsert=True)
    return await get_settings()


# ---------------- Seed ----------------
SEED_PRODUCTS = [
    ("Besan Laddu", "sweets", "Roasted gram flour, pure ghee and cardamom.", "/images/besan_laddu.jpg", 700),
    ("Rava Laddu", "sweets", "Semolina, coconut and ghee, Aai's style.", "/images/rava_laddu.jpg", 600),
    ("Karanji", "sweets", "Crisp pastry filled with coconut and jaggery.", "/images/karanji.jpg", 750),
    ("Anarse", "sweets", "Traditional rice and jaggery Diwali sweet.", "/images/anarse.jpg", 800),
    ("Bhajani Chakli", "namkin", "Crunchy spiral of roasted multigrain bhajani.", "/images/chakli.jpg", 560),
    ("Poha Chivda", "namkin", "Thin poha with peanuts, curry leaves and spices.", "/images/poha_chivda.jpg", 480),
    ("Shankarpali", "namkin", "Sweet-salty diamond bites, fried in ghee.", "/images/shankarpali.jpg", 500),
    ("Kadboli", "namkin", "Spiced lentil-flour rings, hand rolled.", "/images/kadboli.jpg", 580),
    ("Dink Laddu", "healthy", "Edible gum, dry fruits and dates, no sugar.", "/images/dink_laddu.jpg", 1200),
    ("Nachni Laddu", "healthy", "Ragi, jaggery and ghee for winter strength.", "/images/nachni_laddu.jpg", 900),
    ("Roasted Makhana Chivda", "healthy", "Light roasted lotus seeds and nuts.", "/images/makhana_chivda.jpg", 1000),
]

SEED_COMBOS = [
    ("Mini Faral Box", 599, [("Besan Laddu", 250), ("Poha Chivda", 250)]),
    ("Family Faral Box", 999, [("Besan Laddu", 250), ("Karanji", 250), ("Poha Chivda", 250), ("Bhajani Chakli", 250)]),
    ("Diwali Utsav Box", 1499, [("Besan Laddu", 500), ("Rava Laddu", 250), ("Poha Chivda", 250), ("Bhajani Chakli", 250), ("Shankarpali", 250)]),
    ("Grand Aaiche Box", 1999, [("Besan Laddu", 500), ("Karanji", 250), ("Anarse", 250), ("Poha Chivda", 500), ("Bhajani Chakli", 250), ("Dink Laddu", 250)]),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.leads.create_index("created_at")
    await db.files.create_index("storage_path")
    try:
        await asyncio.to_thread(init_storage)
    except Exception:
        logger.exception("storage init failed")
    email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": email}):
        await db.users.insert_one({"id": new_id(), "email": email, "name": "Admin", "role": "admin",
                                   "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
                                   "created_at": now_iso()})
    if await db.products.count_documents({}) == 0:
        ids = {}
        for name, cat, desc, img, price in SEED_PRODUCTS:
            pid = new_id()
            ids[name] = pid
            await db.products.insert_one({"id": pid, "name": name, "category": cat, "description": desc,
                                          "image": img, "price_per_kg": price, "stock_grams": 10000,
                                          "active": True, "created_at": now_iso()})
        for name, price, items in SEED_COMBOS:
            await db.combos.insert_one({"id": new_id(), "name": name, "price": price, "description": "",
                                        "image": f"/images/combo_{price}.jpg",
                                        "items": [{"product_id": ids[n], "grams": g} for n, g in items],
                                        "active": True, "created_at": now_iso()})


app.include_router(api)
app.include_router(admin)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
