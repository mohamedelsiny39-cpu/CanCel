import logging
import os

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

BOT_TOKEN = os.environ.get("BOT_TOKEN")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not WEBAPP_URL:
        await update.message.reply_text(
            "⚠️ لسه متظبطش رابط اللعبة (WEBAPP_URL) في إعدادات السيرفر."
        )
        return

    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("🪙 العب دلوقتي", web_app=WebAppInfo(url=WEBAPP_URL))]]
    )
    await update.message.reply_text(
        f"أهلاً {user.first_name}! 👋\n"
        "دوس زر اللعب وابدأ تجمع عملات CanCel (CCL) 🚀",
        reply_markup=keyboard,
    )


def build_bot_app():
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    return application
