import logging
import os

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

import db

BOT_TOKEN = os.environ.get("BOT_TOKEN")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def play_keyboard():
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🪙 العب دلوقتي", web_app=WebAppInfo(url=WEBAPP_URL))]]
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    referred_by = None
    if context.args:
        arg = context.args[0]
        if arg.startswith("ref_"):
            try:
                candidate = int(arg[4:])
                if candidate != user.id:
                    referred_by = candidate
            except ValueError:
                pass

    db.get_or_create_user(
        user.id,
        first_name=user.first_name or "",
        username=user.username or "",
        referred_by=referred_by,
    )

    if not WEBAPP_URL:
        await update.message.reply_text(
            "⚠️ لسه متظبطش رابط اللعبة (WEBAPP_URL) في إعدادات السيرفر."
        )
        return

    bonus_note = "\n🎁 خدت 20 CCL هدية عشان جيت بدعوة صديق!" if referred_by else ""
    await update.message.reply_text(
        f"أهلاً {user.first_name}! 👋\n"
        f"دوس زر اللعب وابدأ تجمع عملات CanCel (CCL) 🚀{bonus_note}",
        reply_markup=play_keyboard(),
    )


async def invite(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    bot_username = context.bot.username
    link = f"https://t.me/{bot_username}?start=ref_{user.id}"
    await update.message.reply_text(
        "🔗 ابعت اللينك ده لأصدقائك، كل ما حد يدخل بيه تاخد 100 CCL هدية:\n\n"
        f"{link}"
    )


def build_bot_app():
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("invite", invite))
    return application
